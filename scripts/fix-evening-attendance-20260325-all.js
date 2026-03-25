const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { dbPath } = require('../database/schema');

const TARGET_DATE = '2026-03-25';
const TARGET_SESSION_ID = 'evening';
const DEFAULT_ATTENDANCE_SCHEDULE = [
    { id: 'morning', name: '早读', start: '06:00', end: '07:20', lateTime: '07:00' },
    { id: 'noon', name: '午练', start: '14:00', end: '14:40', lateTime: '14:20' },
    { id: 'evening', name: '晚自习', start: '18:00', end: '19:00', lateTime: '18:30' }
];
const DEFAULT_WEEKEND_RULES = {
    monday: [0, 1, 2],
    tuesday: [0, 1, 2],
    wednesday: [0, 1, 2],
    thursday: [0, 1, 2],
    friday: [0, 1],
    saturday: [],
    sunday: [2]
};

const parseJson = (raw, fallback) => {
    try {
        return JSON.parse(raw);
    } catch (_) {
        return fallback;
    }
};

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const getRulesForDate = (config, dateObj) => {
    const attendance = isPlainObject(config?.systemConfig?.attendance) ? config.systemConfig.attendance : {};
    const schedule = Array.isArray(attendance.schedule) && attendance.schedule.length > 0
        ? attendance.schedule.filter((item) => isPlainObject(item) && item.id).map((item) => ({ ...item }))
        : DEFAULT_ATTENDANCE_SCHEDULE.map((item) => ({ ...item }));
    const weekendRules = {
        ...DEFAULT_WEEKEND_RULES,
        ...(isPlainObject(attendance.weekendRules) ? attendance.weekendRules : {})
    };

    const day = dateObj.getDay();
    let indices = [];
    if (day === 1) indices = weekendRules.monday || [];
    else if (day === 2) indices = weekendRules.tuesday || [];
    else if (day === 3) indices = weekendRules.wednesday || [];
    else if (day === 4) indices = weekendRules.thursday || [];
    else if (day === 5) indices = weekendRules.friday || [];
    else if (day === 6) indices = weekendRules.saturday || [];
    else if (day === 0) indices = weekendRules.sunday || [];

    return indices
        .map((idx) => schedule[idx])
        .filter((item) => isPlainObject(item) && item.id);
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
const backupPath = path.join(backupDir, `classmanager_pre_evening_all_fix_${stamp}.db`);

fs.mkdirSync(backupDir, { recursive: true });

db.backup(backupPath)
    .then(() => {
        const targetDateObj = new Date(`${TARGET_DATE}T00:00:00`);
        const selectUsers = db.prepare(`
            SELECT id, username
            FROM users
            WHERE role = 'user'
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

        const nowTs = Date.now();
        const users = selectUsers.all();
        const results = [];

        const tx = db.transaction(() => {
            users.forEach((user) => {
                const rows = selectClassData.all(user.id);
                const rowMap = new Map(rows.map((row) => [row.data_key, row.data_value]));
                const students = parseJson(rowMap.get('students'), []);
                const config = parseJson(rowMap.get('config'), {});
                const attendanceRecords = parseJson(rowMap.get('attendanceRecords') || rowMap.get('attendance_records'), {});
                const meta = parseJson(rowMap.get('__meta'), {});

                const studentNames = (Array.isArray(students) ? students : [])
                    .map((student) => String(student?.name || '').trim())
                    .filter(Boolean);
                if (studentNames.length === 0) {
                    results.push({
                        username: user.username,
                        studentCount: 0,
                        fixedCount: 0,
                        skipped: true,
                        reason: 'NO_STUDENTS'
                    });
                    return;
                }

                const eveningRule = getRulesForDate(config, targetDateObj).find((item) => item.id === TARGET_SESSION_ID);
                if (!eveningRule) {
                    results.push({
                        username: user.username,
                        studentCount: studentNames.length,
                        fixedCount: 0,
                        skipped: true,
                        reason: 'NO_EVENING_RULE'
                    });
                    return;
                }

                const checkTime = /^\d{2}:\d{2}$/.test(String(eveningRule.start || '').trim())
                    ? String(eveningRule.start).trim()
                    : '18:00';
                const timestamp = buildTimestamp(TARGET_DATE, checkTime);
                const nextAttendanceRecords = isPlainObject(attendanceRecords) ? { ...attendanceRecords } : {};
                const dayMap = isPlainObject(nextAttendanceRecords[TARGET_DATE]) ? { ...nextAttendanceRecords[TARGET_DATE] } : {};
                let fixedCount = 0;

                studentNames.forEach((name) => {
                    const sessionMap = isPlainObject(dayMap[name]) ? { ...dayMap[name] } : {};
                    const nextRecord = {
                        status: 'ok',
                        checkTime,
                        timestamp
                    };
                    const prev = sessionMap[TARGET_SESSION_ID];
                    const prevComparable = prev && isPlainObject(prev)
                        ? JSON.stringify({
                            status: String(prev.status || ''),
                            checkTime: String(prev.checkTime || ''),
                            timestamp: Number(prev.timestamp) || 0
                        })
                        : '';
                    const nextComparable = JSON.stringify(nextRecord);
                    if (prevComparable !== nextComparable) fixedCount += 1;
                    sessionMap[TARGET_SESSION_ID] = nextRecord;
                    dayMap[name] = sessionMap;
                });

                nextAttendanceRecords[TARGET_DATE] = dayMap;
                const nextMeta = isPlainObject(meta)
                    ? { ...meta, updatedAt: nowTs, baseUpdatedAt: Number(meta.updatedAt) || 0 }
                    : { updatedAt: nowTs, baseUpdatedAt: 0 };

                upsertClassData.run(user.id, 'attendanceRecords', JSON.stringify(nextAttendanceRecords));
                upsertClassData.run(user.id, '__meta', JSON.stringify(nextMeta));

                results.push({
                    username: user.username,
                    studentCount: studentNames.length,
                    fixedCount,
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
