const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { dbPath } = require('../database/schema');

const TARGET_DATE = '2026-03-24';
const TARGET_SESSION_ID = 'evening';
const TARGETS = [
    { username: '14ban', studentName: '代韧康' },
    { username: 'Lixue', studentName: '李思颖' }
];
const DEFAULT_EVENING_START = '18:00';

const parseJson = (raw, fallback) => {
    try {
        return JSON.parse(raw);
    } catch (_) {
        return fallback;
    }
};

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const getSessionStartTime = (config) => {
    const schedule = Array.isArray(config?.systemConfig?.attendance?.schedule)
        ? config.systemConfig.attendance.schedule
        : [];
    const item = schedule.find((entry) => isPlainObject(entry) && entry.id === TARGET_SESSION_ID);
    const start = String(item?.start || '').trim();
    return /^\d{2}:\d{2}$/.test(start) ? start : DEFAULT_EVENING_START;
};

const buildTimestamp = (dateStr, timeStr) => {
    const dt = new Date(`${dateStr}T${timeStr}:00`);
    return Number.isNaN(dt.getTime()) ? Date.now() : dt.getTime();
};

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const now = new Date();
const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
].join('');
const backupDir = path.join(process.cwd(), 'backups', 'sqlite');
const backupPath = path.join(backupDir, `classmanager_pre_evening_fix_${stamp}.db`);

fs.mkdirSync(backupDir, { recursive: true });

db.backup(backupPath)
    .then(() => {
        const selectUser = db.prepare('SELECT id, username FROM users WHERE username = ?');
        const selectClassData = db.prepare('SELECT data_key, data_value FROM class_data WHERE user_id = ?');
        const upsertClassData = db.prepare(`
            INSERT INTO class_data (user_id, data_key, data_value, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, data_key)
            DO UPDATE SET data_value = excluded.data_value, updated_at = CURRENT_TIMESTAMP
        `);

        const grouped = TARGETS.reduce((acc, item) => {
            if (!acc[item.username]) acc[item.username] = [];
            acc[item.username].push(item.studentName);
            return acc;
        }, {});
        const nowTs = Date.now();
        const results = [];

        const tx = db.transaction(() => {
            Object.entries(grouped).forEach(([username, studentNames]) => {
                const user = selectUser.get(username);
                if (!user) {
                    results.push({ username, fixed: [], skipped: studentNames, reason: 'USER_NOT_FOUND' });
                    return;
                }

                const rows = selectClassData.all(user.id);
                const rowMap = new Map(rows.map((row) => [row.data_key, row.data_value]));
                const attendanceRecords = parseJson(rowMap.get('attendanceRecords') || rowMap.get('attendance_records'), {});
                const config = parseJson(rowMap.get('config'), {});
                const meta = parseJson(rowMap.get('__meta'), {});

                const dayMap = isPlainObject(attendanceRecords[TARGET_DATE]) ? { ...attendanceRecords[TARGET_DATE] } : {};
                const checkTime = getSessionStartTime(config);
                const timestamp = buildTimestamp(TARGET_DATE, checkTime);
                const fixed = [];
                const skipped = [];

                studentNames.forEach((studentName) => {
                    const sessionMap = isPlainObject(dayMap[studentName]) ? { ...dayMap[studentName] } : null;
                    const existing = sessionMap?.[TARGET_SESSION_ID];
                    if (!existing || existing.status !== 'absent') {
                        skipped.push(studentName);
                        return;
                    }
                    sessionMap[TARGET_SESSION_ID] = {
                        status: 'ok',
                        checkTime,
                        timestamp
                    };
                    dayMap[studentName] = sessionMap;
                    fixed.push(studentName);
                });

                if (fixed.length > 0) {
                    const nextAttendanceRecords = isPlainObject(attendanceRecords) ? { ...attendanceRecords } : {};
                    nextAttendanceRecords[TARGET_DATE] = dayMap;
                    const nextMeta = isPlainObject(meta)
                        ? { ...meta, updatedAt: nowTs, baseUpdatedAt: Number(meta.updatedAt) || 0 }
                        : { updatedAt: nowTs, baseUpdatedAt: 0 };
                    upsertClassData.run(user.id, 'attendanceRecords', JSON.stringify(nextAttendanceRecords));
                    upsertClassData.run(user.id, '__meta', JSON.stringify(nextMeta));
                }

                results.push({
                    username,
                    fixed,
                    skipped,
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
            results
        }, null, 2));
    })
    .catch((err) => {
        console.error('修复失败:', err);
        process.exitCode = 1;
    });
