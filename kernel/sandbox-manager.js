const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { ensureSchema } = require('../database/schema');

const safeUnlink = (targetPath) => {
    try {
        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
        }
    } catch (_) {
        // Ignore cleanup errors for transient sidecars
    }
};

const copyTableRows = (sourceDb, targetDb, tableName, selectSql, params = []) => {
    const rows = sourceDb.prepare(selectSql).all(...params);
    if (rows.length === 0) return 0;

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const insertStmt = targetDb.prepare(
        `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
    );
    for (const row of rows) {
        insertStmt.run(...columns.map((col) => row[col]));
    }
    return rows.length;
};

/**
 * Manages per-session isolated SQLite snapshot files for True Test Mode.
 * Requests with X-Test-Session transparently switch their SQLite handle to the sandbox file.
 */
const createTestSandboxManager = ({ mainDb, mainDbPath }) => {
    const resolvedMainDbPath = path.resolve(mainDbPath);
    const sandboxDir = path.join(path.dirname(resolvedMainDbPath), '.test-sandboxes');
    const openSandboxes = new Map();

    const getSandboxPath = (sessionId) => {
        const safeId = String(sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeId) throw new Error('无效测试会话 ID');
        return path.join(sandboxDir, `${safeId}.db`);
    };

    const openSandboxDb = (filePath) => {
        const sandboxDb = new Database(filePath, { timeout: 5000 });
        sandboxDb.pragma('journal_mode = WAL');
        sandboxDb.pragma('foreign_keys = ON');
        return sandboxDb;
    };

    const closeSandboxHandle = (sessionId) => {
        const entry = openSandboxes.get(String(sessionId));
        if (!entry) return;
        openSandboxes.delete(String(sessionId));
        try {
            entry.db.close();
        } catch (_) {
            // Already closed
        }
    };

    const removeSandboxFiles = (filePath) => {
        safeUnlink(filePath);
        safeUnlink(`${filePath}-wal`);
        safeUnlink(`${filePath}-shm`);
    };

    const destroySessionSandbox = (sessionId) => {
        const normalizedId = String(sessionId || '');
        if (!normalizedId) return;
        closeSandboxHandle(normalizedId);
        const filePath = getSandboxPath(normalizedId);
        removeSandboxFiles(filePath);
    };

    const createSessionSandbox = ({ sessionId, userId }) => {
        const normalizedSessionId = String(sessionId);
        const normalizedUserId = Number(userId);
        fs.mkdirSync(sandboxDir, { recursive: true });
        const filePath = getSandboxPath(normalizedSessionId);
        removeSandboxFiles(filePath);

        const sandboxDb = openSandboxDb(filePath);
        ensureSchema(sandboxDb);

        const classRows = mainDb.prepare('SELECT id FROM classes WHERE owner_teacher_id = ?').all(normalizedUserId);
        const classIds = classRows.map((row) => row.id);

        sandboxDb.transaction(() => {
            copyTableRows(mainDb, sandboxDb, 'deployment_settings', 'SELECT * FROM deployment_settings');
            copyTableRows(mainDb, sandboxDb, 'plugin_packages', 'SELECT * FROM plugin_packages');

            const teacherIds = new Set([normalizedUserId]);
            if (classIds.length > 0) {
                const placeholders = classIds.map(() => '?').join(', ');
                const extraTeachers = mainDb.prepare(
                    `SELECT DISTINCT teacher_id FROM class_teachers WHERE class_id IN (${placeholders})`
                ).all(...classIds);
                extraTeachers.forEach((row) => teacherIds.add(Number(row.teacher_id)));
            }

            const teacherIdList = [...teacherIds];
            const teacherPlaceholders = teacherIdList.map(() => '?').join(', ');
            copyTableRows(
                mainDb,
                sandboxDb,
                'users',
                `SELECT * FROM users WHERE id IN (${teacherPlaceholders})`,
                teacherIdList
            );
            copyTableRows(
                mainDb,
                sandboxDb,
                'maintenance_credentials',
                'SELECT * FROM maintenance_credentials WHERE user_id = ?',
                [normalizedUserId]
            );
            copyTableRows(
                mainDb,
                sandboxDb,
                'school_staff_roles',
                'SELECT * FROM school_staff_roles WHERE teacher_id = ?',
                [normalizedUserId]
            );

            if (classIds.length > 0) {
                const classPlaceholders = classIds.map(() => '?').join(', ');
                copyTableRows(mainDb, sandboxDb, 'classes', `SELECT * FROM classes WHERE id IN (${classPlaceholders})`, classIds);
                copyTableRows(mainDb, sandboxDb, 'class_teachers', `SELECT * FROM class_teachers WHERE class_id IN (${classPlaceholders})`, classIds);
                copyTableRows(mainDb, sandboxDb, 'class_roles', `SELECT * FROM class_roles WHERE class_id IN (${classPlaceholders})`, classIds);
                copyTableRows(mainDb, sandboxDb, 'kiosk_devices', `SELECT * FROM kiosk_devices WHERE class_id IN (${classPlaceholders})`, classIds);
                copyTableRows(
                    mainDb,
                    sandboxDb,
                    'student_accounts',
                    `SELECT * FROM student_accounts WHERE id IN (
                        SELECT DISTINCT student_account_id FROM class_enrollments WHERE class_id IN (${classPlaceholders})
                    )`,
                    classIds
                );
                copyTableRows(mainDb, sandboxDb, 'class_enrollments', `SELECT * FROM class_enrollments WHERE class_id IN (${classPlaceholders})`, classIds);
                copyTableRows(
                    mainDb,
                    sandboxDb,
                    'enrollment_roles',
                    `SELECT * FROM enrollment_roles WHERE enrollment_id IN (
                        SELECT id FROM class_enrollments WHERE class_id IN (${classPlaceholders})
                    )`,
                    classIds
                );
                copyTableRows(mainDb, sandboxDb, 'point_ledger', `SELECT * FROM point_ledger WHERE class_id IN (${classPlaceholders})`, classIds);
                copyTableRows(mainDb, sandboxDb, 'exam_archives', `SELECT * FROM exam_archives WHERE class_id IN (${classPlaceholders})`, classIds);
                copyTableRows(mainDb, sandboxDb, 'exam_scores', `SELECT * FROM exam_scores WHERE class_id IN (${classPlaceholders})`, classIds);
                copyTableRows(mainDb, sandboxDb, 'class_plugins', `SELECT * FROM class_plugins WHERE class_id IN (${classPlaceholders})`, classIds);
                copyTableRows(mainDb, sandboxDb, 'plugin_storage', `SELECT * FROM plugin_storage WHERE class_id IN (${classPlaceholders})`, classIds);
            }
        })();

        openSandboxes.set(normalizedSessionId, { db: sandboxDb, filePath, userId: normalizedUserId });
        return sandboxDb;
    };

    const getSessionDb = (sessionId) => {
        const normalizedId = String(sessionId || '');
        if (!normalizedId) return null;
        const cached = openSandboxes.get(normalizedId);
        if (cached) return cached.db;

        const filePath = getSandboxPath(normalizedId);
        if (!fs.existsSync(filePath)) return null;

        const sandboxDb = openSandboxDb(filePath);
        ensureSchema(sandboxDb);
        openSandboxes.set(normalizedId, { db: sandboxDb, filePath });
        return sandboxDb;
    };

    const destroyUserSandboxes = (userId) => {
        const normalizedUserId = Number(userId);
        const rows = mainDb.prepare('SELECT id FROM test_sessions WHERE user_id = ?').all(normalizedUserId);
        rows.forEach((row) => destroySessionSandbox(row.id));
        mainDb.prepare('DELETE FROM test_sessions WHERE user_id = ?').run(normalizedUserId);
    };

    const cleanupExpiredSandboxes = () => {
        let deletedCount = 0;
        try {
            const expiredRows = mainDb.prepare(`
                SELECT id FROM test_sessions
                WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
            `).all();

            expiredRows.forEach((row) => {
                destroySessionSandbox(row.id);
            });

            if (expiredRows.length > 0) {
                const res = mainDb.prepare(`
                    DELETE FROM test_sessions
                    WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
                `).run();
                deletedCount = res.changes || 0;
            }

            if (fs.existsSync(sandboxDir)) {
                const activeIds = new Set(
                    mainDb.prepare('SELECT id FROM test_sessions').all().map((row) => String(row.id))
                );
                for (const fileName of fs.readdirSync(sandboxDir)) {
                    if (!fileName.endsWith('.db')) continue;
                    const id = fileName.slice(0, -3);
                    if (!activeIds.has(id)) {
                        closeSandboxHandle(id);
                        removeSandboxFiles(path.join(sandboxDir, fileName));
                    }
                }
            }
        } catch (err) {
            console.error('清理过期测试沙盒失败:', err);
        }
        return { changes: deletedCount };
    };

    const closeAll = () => {
        for (const sessionId of [...openSandboxes.keys()]) {
            closeSandboxHandle(sessionId);
        }
    };

    return {
        sandboxDir,
        createSessionSandbox,
        getSessionDb,
        destroySessionSandbox,
        destroyUserSandboxes,
        cleanupExpiredSandboxes,
        closeAll
    };
};

module.exports = {
    createTestSandboxManager
};
