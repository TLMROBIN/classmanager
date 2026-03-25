const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { dbPath } = require('../database/schema');

const TARGET_DATE = '2026-03-25';
const TARGET_SESSION_ID = 'noon';
const DEFAULT_NOON_START = '14:00';

const parseJson = (raw, fallback) => {
    try {
        return JSON.parse(raw);
    } catch (_) {
        return fallback;
    }
};

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const getNoonStartTime = (config) => {
    const schedule = Array.isArray(config?.systemConfig?.attendance?.schedule)
        ? config.systemConfig.attendance.schedule
        : [];
    const noon = schedule.find((item) => isPlainObject(item) && item.id === TARGET_SESSION_ID);
    const start = String(noon?.start || '').trim();
    return /^\d{2}:\d{2}$/.test(start) ? start : DEFAULT_NOON_START;
};

const buildTimestamp = (dateStr, timeStr) => {
    const isoLike = `${dateStr}T${timeStr}:00`;
    const dt = new Date(isoLike);
    if (Number.isNaN(dt.getTime())) return Date.now();
    return dt.getTime();
};

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const now = new Date();
const backupStamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
].join('');
const backupDir = path.join(process.cwd(), 'backups', 'sqlite');
const backupPath = path.join(backupDir, `classmanager_pre_noon_fix_${backupStamp}.db`);

fs.mkdirSync(backupDir, { recursive: true });
db.backup(backupPath)
    .then(() => {
        const selectUsers = db.prepare(`
            SELECT id, username
            FROM users
            ORDER BY id ASC
        `);
        const selectClassData = db.prepare(`
            SELECT data_key, data_value
            FROM class_data
            WHERE user_id = ?
        `);
        const upsertClassData = db.prepare(`
            INSERT INTO class_data (user_id, data_key, data_value, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, data_key)
            DO UPDATE SET data_value = excluded.data_value, updated_at = CURRENT_TIMESTAMP
        `);

        const users = selectUsers.all();
        const nowTs = Date.now();
        const results = [];

        const tx = db.transaction(() => {
            users.forEach((user) => {
                const rows = selectClassData.all(user.id);
                const rowMap = new Map(rows.map((row) => [row.data_key, row.data_value]));
                const students = parseJson(rowMap.get('students'), []);
                const config = parseJson(rowMap.get('config'), {});
                const existingAttendance = parseJson(
                    rowMap.get('attendanceRecords') || rowMap.get('attendance_records'),
                    {}
                );
                const existingMeta = parseJson(rowMap.get('__meta'), {});

                const studentNames = (Array.isArray(students) ? students : [])
                    .map((student) => String(student?.name || '').trim())
                    .filter(Boolean);

                if (studentNames.length === 0) {
                    results.push({
                        userId: user.id,
                        username: user.username,
                        studentCount: 0,
                        changedCount: 0,
                        skipped: true
                    });
                    return;
                }

                const checkTime = getNoonStartTime(config);
                const timestamp = buildTimestamp(TARGET_DATE, checkTime);
                const nextAttendance = isPlainObject(existingAttendance) ? { ...existingAttendance } : {};
                const dayMap = isPlainObject(nextAttendance[TARGET_DATE]) ? { ...nextAttendance[TARGET_DATE] } : {};
                let changedCount = 0;

                studentNames.forEach((name) => {
                    const studentMap = isPlainObject(dayMap[name]) ? { ...dayMap[name] } : {};
                    const prev = studentMap[TARGET_SESSION_ID];
                    const nextRecord = {
                        status: 'ok',
                        checkTime,
                        timestamp
                    };
                    const prevComparable = prev && isPlainObject(prev)
                        ? JSON.stringify({
                            status: String(prev.status || ''),
                            checkTime: String(prev.checkTime || ''),
                            timestamp: Number(prev.timestamp) || 0
                        })
                        : '';
                    const nextComparable = JSON.stringify(nextRecord);
                    if (prevComparable !== nextComparable) {
                        changedCount += 1;
                    }
                    studentMap[TARGET_SESSION_ID] = nextRecord;
                    dayMap[name] = studentMap;
                });

                nextAttendance[TARGET_DATE] = dayMap;

                const nextMeta = isPlainObject(existingMeta)
                    ? { ...existingMeta, updatedAt: nowTs, baseUpdatedAt: Number(existingMeta.updatedAt) || 0 }
                    : { updatedAt: nowTs, baseUpdatedAt: 0 };

                upsertClassData.run(user.id, 'attendanceRecords', JSON.stringify(nextAttendance));
                upsertClassData.run(user.id, '__meta', JSON.stringify(nextMeta));

                results.push({
                    userId: user.id,
                    username: user.username,
                    studentCount: studentNames.length,
                    changedCount,
                    checkTime
                });
            });
        });

        tx();

        console.log(JSON.stringify({
            success: true,
            targetDate: TARGET_DATE,
            sessionId: TARGET_SESSION_ID,
            backupPath,
            users: results
        }, null, 2));
    })
    .catch((err) => {
        console.error('备份或修复失败:', err);
        process.exitCode = 1;
    });
