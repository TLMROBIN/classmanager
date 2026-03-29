const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { hashPassword, verifyPassword } = require('./utils/password');
const { buildHealthReport } = require('./utils/health');
const {
    generateToken,
    generateMaintenanceToken,
    verifyMaintenanceToken,
    createAuthMiddleware,
    ACCESS_TOKEN_COOKIE_NAME,
    ACCESS_TOKEN_TTL_MS,
    adminMiddleware,
    userMiddleware,
    MAINTENANCE_TOKEN_TTL_MS
} = require('./middleware/auth');
const { dbPath, ensureSchema, countAdmins } = require('./database/schema');
const { stripLegacyAdminPasswordFromConfig } = require('./utils/config-security');

const app = express();
const PORT = process.env.PORT || 3002;
const HOST = process.env.CLASSMANAGER_HOST || '0.0.0.0';
const startedAtMs = Date.now();
const SHUTDOWN_TIMEOUT_MS = 10 * 1000;
const REQUEST_BODY_LIMIT = process.env.CLASSMANAGER_REQUEST_BODY_LIMIT || '10mb';

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
ensureSchema(db);

const MAINTENANCE_TOKEN_HEADER = 'x-maintenance-token';
const TEST_SESSION_HEADER = 'x-test-session';
const TEST_NOW_HEADER = 'x-test-now';
const DIRECT_MAINTENANCE_KEYS = ['studentProfiles', 'examArchives'];
const PUBLIC_TREASURE_LOG_ACTIONS = new Set(['兑换', '使用', '祈愿']);
const TEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const TEST_SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const KB = 1024;
const MB = 1024 * KB;
const CSP_REPORT_URI = '/api/security/csp-report';
const AUTH_COOKIE_SECURE_MODE = String(process.env.AUTH_COOKIE_SECURE || 'auto').toLowerCase();
const LEGACY_DATA_KEY_ALIASES = Object.freeze({
    attendance_records: 'attendanceRecords'
});
const MAX_DATA_PAYLOAD_BYTES = 8 * MB;
const DATA_DOMAIN_RULES = Object.freeze({
    students: { kind: 'array', maxBytes: 1 * MB },
    studentProfiles: { kind: 'object', maxBytes: 1 * MB },
    history: { kind: 'array', maxBytes: 2 * MB },
    config: { kind: 'object', maxBytes: 512 * KB },
    attendanceRecords: { kind: 'object', maxBytes: 2 * MB },
    pets: { kind: 'object', maxBytes: 1 * MB },
    treasures: { kind: 'array', maxBytes: 512 * KB },
    storage: { kind: 'object', maxBytes: 512 * KB },
    logs: { kind: 'array', maxBytes: 1 * MB },
    quotes: { kind: 'array', maxBytes: 128 * KB },
    messages: { kind: 'array', maxBytes: 512 * KB },
    teacherMessages: { kind: 'array', maxBytes: 512 * KB },
    redemptionHistory: { kind: 'object', maxBytes: 256 * KB },
    dailyRedemptionCounts: { kind: 'object', maxBytes: 256 * KB },
    dailyUsageCounts: { kind: 'object', maxBytes: 256 * KB },
    tasks: { kind: 'array', maxBytes: 512 * KB },
    battle: { kind: 'object', maxBytes: 1 * MB },
    examArchives: { kind: 'object', maxBytes: 2 * MB },
    __meta: { kind: 'object', maxBytes: 32 * KB }
});
const ALLOWED_DATA_KEYS = new Set(Object.keys(DATA_DOMAIN_RULES));
const CSP_POLICY = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'report-sample'",
    "connect-src 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    `report-uri ${CSP_REPORT_URI}`
].join('; ');

const selectClassDataRows = db.prepare('SELECT data_key, data_value FROM class_data WHERE user_id = ?');
const selectClassDataValue = db.prepare('SELECT data_value FROM class_data WHERE user_id = ? AND data_key = ?');
const selectAccessAuthUserById = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?');
const deleteClassDataKey = db.prepare('DELETE FROM class_data WHERE user_id = ? AND data_key = ?');
const upsertClassData = db.prepare(`
    INSERT INTO class_data (user_id, data_key, data_value, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, data_key)
    DO UPDATE SET data_value = excluded.data_value, updated_at = CURRENT_TIMESTAMP
`);
const selectMaintenanceCredential = db.prepare('SELECT user_id, password_hash, updated_at FROM maintenance_credentials WHERE user_id = ?');
const insertMaintenanceCredential = db.prepare(`
    INSERT INTO maintenance_credentials (user_id, password_hash, migrated_from_legacy, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
`);
const updateMaintenanceCredential = db.prepare(`
    UPDATE maintenance_credentials
    SET password_hash = ?, migrated_from_legacy = 0, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
`);
const selectTestSessionById = db.prepare(`
    SELECT id, user_id, status, sim_time_ms, time_speed, created_at, updated_at, expires_at
    FROM test_sessions
    WHERE id = ?
`);
const selectOwnedTestSessionById = db.prepare(`
    SELECT id, user_id, status, sim_time_ms, time_speed, created_at, updated_at, expires_at
    FROM test_sessions
    WHERE id = ? AND user_id = ?
`);
const insertTestSession = db.prepare(`
    INSERT INTO test_sessions (id, user_id, status, sim_time_ms, time_speed, expires_at, updated_at)
    VALUES (?, ?, 'active', ?, ?, ?, CURRENT_TIMESTAMP)
`);
const updateTestSessionState = db.prepare(`
    UPDATE test_sessions
    SET sim_time_ms = ?, time_speed = ?, updated_at = CURRENT_TIMESTAMP, expires_at = ?
    WHERE id = ? AND user_id = ?
`);
const touchTestSession = db.prepare(`
    UPDATE test_sessions
    SET updated_at = CURRENT_TIMESTAMP, expires_at = ?
    WHERE id = ?
`);
const deleteTestSessionByIdAndUser = db.prepare('DELETE FROM test_sessions WHERE id = ? AND user_id = ?');
const deleteTestSessionsByUser = db.prepare('DELETE FROM test_sessions WHERE user_id = ?');
const deleteExpiredTestSessions = db.prepare(`
    DELETE FROM test_sessions
    WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
`);
const selectTestClassDataRows = db.prepare(`
    SELECT data_key, data_value
    FROM test_class_data
    WHERE session_id = ? AND user_id = ?
`);
const selectTestClassDataValue = db.prepare(`
    SELECT data_value
    FROM test_class_data
    WHERE session_id = ? AND user_id = ? AND data_key = ?
`);
const deleteTestClassDataKey = db.prepare(`
    DELETE FROM test_class_data
    WHERE session_id = ? AND user_id = ? AND data_key = ?
`);
const upsertTestClassData = db.prepare(`
    INSERT INTO test_class_data (session_id, user_id, data_key, data_value, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(session_id, user_id, data_key)
    DO UPDATE SET data_value = excluded.data_value, updated_at = CURRENT_TIMESTAMP
`);
const copyClassDataToTestSession = db.prepare(`
    INSERT INTO test_class_data (session_id, user_id, data_key, data_value, updated_at)
    SELECT ?, user_id, data_key, data_value, CURRENT_TIMESTAMP
    FROM class_data
    WHERE user_id = ?
`);
const selectTestMaintenanceCredential = db.prepare(`
    SELECT session_id, user_id, password_hash, updated_at
    FROM test_maintenance_credentials
    WHERE session_id = ? AND user_id = ?
`);
const insertTestMaintenanceCredential = db.prepare(`
    INSERT INTO test_maintenance_credentials (session_id, user_id, password_hash, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
`);
const updateTestMaintenanceCredential = db.prepare(`
    UPDATE test_maintenance_credentials
    SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE session_id = ? AND user_id = ?
`);
const copyMaintenanceCredentialToTestSession = db.prepare(`
    INSERT INTO test_maintenance_credentials (session_id, user_id, password_hash, updated_at)
    SELECT ?, user_id, password_hash, CURRENT_TIMESTAMP
    FROM maintenance_credentials
    WHERE user_id = ?
`);

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
const DEFAULT_SUNDAY_SPECIAL_LATE_TIME = { evening: '19:00' };
const ATTENDANCE_LOOKBACK_DAYS = 60;
const ABSENT_GRACE_MS = 2 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PENALTY_DECAY_DAYS = 7;
const DEFAULT_PENALTY_DECAY_AMOUNT = 10;

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const parseStoredValue = (value) => {
    if (typeof value !== 'string') return null;
    try {
        return JSON.parse(value);
    } catch (_) {
        return null;
    }
};
const parseStoredRow = (row) => parseStoredValue(row?.data_value);
const parseStoredRows = (rows) => {
    const data = {};
    rows.forEach((row) => {
        if (!row?.data_key) return;
        try {
            data[row.data_key] = JSON.parse(row.data_value);
        } catch (_) {
            data[row.data_key] = row.data_value;
        }
    });
    return data;
};
const getSingleHeaderValue = (value) => Array.isArray(value) ? value[0] : value;
const shouldUseSecureAuthCookie = (req) => {
    if (AUTH_COOKIE_SECURE_MODE === 'true') return true;
    if (AUTH_COOKIE_SECURE_MODE === 'false') return false;

    const forwardedProto = getSingleHeaderValue(req.headers['x-forwarded-proto']);
    return Boolean(req.secure || forwardedProto === 'https');
};
const buildAuthCookieOptions = (req) => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureAuthCookie(req),
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_MS
});
const setAccessAuthCookie = (req, res, token) => {
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, token, buildAuthCookieOptions(req));
};
const clearAccessAuthCookie = (req, res) => {
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax',
        secure: shouldUseSecureAuthCookie(req),
        path: '/'
    });
};
const serializeAuthUser = (user) => ({
    id: user.id,
    username: user.username,
    role: user.role
});
const sendAuthSuccess = (req, res, user, token) => {
    setAccessAuthCookie(req, res, token);
    res.set('Cache-Control', 'no-store');
    res.json({
        success: true,
        user: serializeAuthUser(user)
    });
};
const toSqlDateTime = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 19).replace('T', ' ');
};
const parseSqlDateTimeMs = (value) => {
    if (typeof value !== 'string' || !value) return null;
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const parsed = Date.parse(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
    return Number.isFinite(parsed) ? parsed : null;
};
const createTestSessionId = () => `test_${crypto.randomBytes(12).toString('hex')}`;
const normalizeTestSession = (row) => {
    if (!row) return null;
    return {
        id: String(row.id),
        userId: Number(row.user_id),
        status: String(row.status || ''),
        simTimeMs: Number.isFinite(Number(row.sim_time_ms)) ? Number(row.sim_time_ms) : null,
        timeSpeed: Number(row.time_speed) > 0 ? Number(row.time_speed) : 1,
        createdAt: parseSqlDateTimeMs(row.created_at),
        updatedAt: parseSqlDateTimeMs(row.updated_at),
        expiresAt: parseSqlDateTimeMs(row.expires_at)
    };
};
const getOwnedTestSession = (sessionId, userId) => normalizeTestSession(
    selectOwnedTestSessionById.get(String(sessionId), Number(userId))
);
const cleanupExpiredTestSessions = () => {
    try {
        return deleteExpiredTestSessions.run();
    } catch (err) {
        console.error('清理过期测试会话失败:', err);
        return { changes: 0 };
    }
};

const createDataStore = (req, userId = req?.user?.id) => {
    const normalizedUserId = Number(userId);
    if (!Number.isFinite(normalizedUserId)) {
        throw new Error('无效用户上下文');
    }
    if (req?.testSession?.id) {
        const sessionId = String(req.testSession.id);
        return {
            mode: 'test',
            userId: normalizedUserId,
            testSessionId: sessionId,
            readDataKey(dataKey) {
                return parseStoredRow(selectTestClassDataValue.get(sessionId, normalizedUserId, dataKey));
            },
            readAllData() {
                return parseStoredRows(selectTestClassDataRows.all(sessionId, normalizedUserId));
            },
            upsertDataKey(dataKey, value) {
                return upsertTestClassData.run(sessionId, normalizedUserId, dataKey, value);
            },
            deleteDataKeys(dataKeys) {
                const keys = Array.isArray(dataKeys) ? dataKeys : [];
                keys.forEach((dataKey) => {
                    deleteTestClassDataKey.run(sessionId, normalizedUserId, String(dataKey));
                });
            },
            readMaintenanceCredential() {
                return selectTestMaintenanceCredential.get(sessionId, normalizedUserId);
            },
            insertMaintenanceCredential(passwordHash, migratedFromLegacy = 0) {
                void migratedFromLegacy;
                return insertTestMaintenanceCredential.run(sessionId, normalizedUserId, passwordHash);
            },
            updateMaintenanceCredential(passwordHash) {
                return updateTestMaintenanceCredential.run(passwordHash, sessionId, normalizedUserId);
            }
        };
    }

    return {
        mode: 'formal',
        userId: normalizedUserId,
        testSessionId: null,
        readDataKey(dataKey) {
            return parseStoredRow(selectClassDataValue.get(normalizedUserId, dataKey));
        },
        readAllData() {
            return parseStoredRows(selectClassDataRows.all(normalizedUserId));
        },
        upsertDataKey(dataKey, value) {
            return upsertClassData.run(normalizedUserId, dataKey, value);
        },
        deleteDataKeys(dataKeys) {
            const keys = Array.isArray(dataKeys) ? dataKeys : [];
            keys.forEach((dataKey) => {
                deleteClassDataKey.run(normalizedUserId, String(dataKey));
            });
        },
        readMaintenanceCredential() {
            return selectMaintenanceCredential.get(normalizedUserId);
        },
        insertMaintenanceCredential(passwordHash, migratedFromLegacy = 0) {
            return insertMaintenanceCredential.run(normalizedUserId, passwordHash, migratedFromLegacy);
        },
        updateMaintenanceCredential(passwordHash) {
            return updateMaintenanceCredential.run(passwordHash, normalizedUserId);
        }
    };
};
const getRequestDataStore = (req) => req.dataStore || createDataStore(req);
const getRequestNow = (req) => {
    if (Number.isFinite(req?.effectiveNow)) return new Date(req.effectiveNow);
    return new Date();
};

const getDateKey = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const stripDerivedAttendanceRecords = (records) => {
    if (!isPlainObject(records)) return {};
    const cleaned = {};
    Object.entries(records).forEach(([dateKey, studentMap]) => {
        if (!isPlainObject(studentMap)) return;
        const nextStudentMap = {};
        Object.entries(studentMap).forEach(([studentName, sessionMap]) => {
            if (!isPlainObject(sessionMap)) return;
            const nextSessionMap = {};
            Object.entries(sessionMap).forEach(([sessionId, record]) => {
                if (!isPlainObject(record)) return;
                if (record.isDerived === true) return;
                nextSessionMap[sessionId] = { ...record };
            });
            if (Object.keys(nextSessionMap).length > 0) {
                nextStudentMap[studentName] = nextSessionMap;
            }
        });
        if (Object.keys(nextStudentMap).length > 0) {
            cleaned[dateKey] = nextStudentMap;
        }
    });
    return cleaned;
};

const getAttendanceConfig = (config) => {
    const attendance = isPlainObject(config?.systemConfig?.attendance) ? config.systemConfig.attendance : {};
    const schedule = Array.isArray(attendance.schedule) && attendance.schedule.length > 0
        ? attendance.schedule
            .filter(item => isPlainObject(item) && item.id)
            .map(item => ({ ...item }))
        : DEFAULT_ATTENDANCE_SCHEDULE.map(item => ({ ...item }));
    const weekendRules = {
        ...DEFAULT_WEEKEND_RULES,
        ...(isPlainObject(attendance.weekendRules) ? attendance.weekendRules : {})
    };
    const sundaySpecialLateTime = {
        ...DEFAULT_SUNDAY_SPECIAL_LATE_TIME,
        ...(isPlainObject(attendance.sundaySpecialLateTime) ? attendance.sundaySpecialLateTime : {})
    };
    return { schedule, weekendRules, sundaySpecialLateTime };
};

const getPenaltyDecayConfig = (config) => {
    const points = isPlainObject(config?.systemConfig?.points) ? config.systemConfig.points : {};
    const cycleDays = Number(points.penaltyDecayDays);
    const decayAmount = Number(points.penaltyDecayAmount);
    return {
        cycleDays: Number.isFinite(cycleDays) ? Math.max(0, Math.floor(cycleDays)) : DEFAULT_PENALTY_DECAY_DAYS,
        decayAmount: Number.isFinite(decayAmount) ? Math.max(0, decayAmount) : DEFAULT_PENALTY_DECAY_AMOUNT
    };
};

const buildPenaltyLastMap = (history) => {
    const lastMap = new Map();
    (Array.isArray(history) ? history : []).forEach(item => {
        if (!item || item.studentId == null) return;
        if (item.isUndoLog) return;
        if (item.type !== 'penalty') return;
        if (!(Number(item.val) < 0)) return;
        const studentKey = String(item.studentId);
        const currentTs = Number(item.ts) || 0;
        const prevTs = lastMap.get(studentKey) || 0;
        if (currentTs > prevTs) lastMap.set(studentKey, currentTs);
    });
    return lastMap;
};

const resetPenaltyDecayClock = (students, nowTs) => {
    if (!Array.isArray(students)) return { students: [], changed: false };
    let changed = false;
    const nextStudents = students.map(student => {
        const nextLastPenaltyAt = Number(nowTs) || 0;
        if (Number(student?.lastPenaltyAt) === nextLastPenaltyAt) return student;
        changed = true;
        return {
            ...student,
            lastPenaltyAt: nextLastPenaltyAt
        };
    });
    return { students: nextStudents, changed };
};

const applyPenaltyDecayToStudents = (students, history, config, now) => {
    if (!Array.isArray(students) || students.length === 0) {
        return { students: Array.isArray(students) ? students : [], changed: false };
    }
    if (config?.frozen) {
        return { students, changed: false };
    }

    const { cycleDays, decayAmount } = getPenaltyDecayConfig(config);
    if (cycleDays <= 0 || decayAmount <= 0) {
        return { students, changed: false };
    }

    const cycleMs = cycleDays * DAY_MS;
    const nowTs = now instanceof Date ? now.getTime() : Number(now);
    if (!Number.isFinite(nowTs)) {
        return { students, changed: false };
    }

    const lastPenaltyMap = buildPenaltyLastMap(history);
    let changed = false;
    const nextStudents = students.map(student => {
        const studentKey = String(student?.id ?? '');
        const lastFromHistory = lastPenaltyMap.get(studentKey) || 0;
        const storedLastPenaltyAt = Number(student?.lastPenaltyAt) || 0;
        const lastPenaltyAt = Math.max(storedLastPenaltyAt, lastFromHistory);
        const penaltyVal = Number(student?.penalty) || 0;

        if (!lastPenaltyAt || penaltyVal <= 0) return student;

        const cycles = Math.floor((nowTs - lastPenaltyAt) / cycleMs);
        if (cycles <= 0) return student;

        const nextPenalty = Math.max(0, penaltyVal - (decayAmount * cycles));
        const nextLastPenaltyAt = lastPenaltyAt + (cycles * cycleMs);
        if (nextPenalty === penaltyVal && nextLastPenaltyAt === storedLastPenaltyAt) return student;

        changed = true;
        return {
            ...student,
            penalty: nextPenalty,
            lastPenaltyAt: nextLastPenaltyAt
        };
    });

    return { students: nextStudents, changed };
};

const applyPenaltyDecayLifecycle = ({
    students,
    history,
    config,
    now,
    previousConfig
}) => {
    const safeStudents = Array.isArray(students) ? students : [];
    let nextStudents = safeStudents;
    let changed = false;

    if (previousConfig?.frozen === true && config?.frozen === false) {
        const resetResult = resetPenaltyDecayClock(nextStudents, now instanceof Date ? now.getTime() : now);
        nextStudents = resetResult.students;
        changed = resetResult.changed || changed;
    }

    const decayResult = applyPenaltyDecayToStudents(nextStudents, history, config, now);
    nextStudents = decayResult.students;
    changed = decayResult.changed || changed;

    return {
        students: nextStudents,
        changed
    };
};

const buildNextStoredMeta = (existingMeta, now) => {
    const nowTs = now instanceof Date ? now.getTime() : Number(now);
    const existingUpdatedAt = Number(existingMeta?.updatedAt) || 0;
    const nextUpdatedAt = Number.isFinite(nowTs)
        ? Math.max(nowTs, existingUpdatedAt + 1)
        : Math.max(Date.now(), existingUpdatedAt + 1);
    return {
        ...(isPlainObject(existingMeta) ? existingMeta : {}),
        updatedAt: nextUpdatedAt
    };
};

const persistDataObject = (store, dataObject) => {
    const entries = Object.entries(dataObject || {});
    const transaction = db.transaction(() => {
        entries.forEach(([key, value]) => {
            store.upsertDataKey(key, JSON.stringify(value));
        });
    });
    transaction();
};

const getRulesForDate = (config, dateObj) => {
    const { schedule, weekendRules, sundaySpecialLateTime } = getAttendanceConfig(config);
    const day = dateObj.getDay();
    let periodIndices = [];
    if (day === 1) periodIndices = weekendRules.monday || [];
    else if (day === 2) periodIndices = weekendRules.tuesday || [];
    else if (day === 3) periodIndices = weekendRules.wednesday || [];
    else if (day === 4) periodIndices = weekendRules.thursday || [];
    else if (day === 5) periodIndices = weekendRules.friday || [];
    else if (day === 6) periodIndices = weekendRules.saturday || [];
    else if (day === 0) periodIndices = weekendRules.sunday || [];

    return periodIndices.map(idx => {
        if (idx < 0 || idx >= schedule.length) return null;
        const period = { ...schedule[idx] };
        if (day === 0 && sundaySpecialLateTime[period.id]) {
            period.lateTime = sundaySpecialLateTime[period.id];
        }
        return period;
    }).filter(Boolean);
};

const isPeriodEnded = (dateObj, rule, now) => {
    const parts = String(rule?.end || '').split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10) || 0;
    if (!Number.isFinite(hour)) return false;
    const periodEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hour, minute, 0, 0);
    return now > new Date(periodEnd.getTime() + ABSENT_GRACE_MS);
};

const buildAttendanceRecordsForResponse = (data, now = new Date()) => {
    const rawRecords = stripDerivedAttendanceRecords(data?.attendanceRecords || data?.attendance_records || {});
    const students = Array.isArray(data?.students) ? data.students : [];
    if (students.length === 0 || data?.config?.frozen) return rawRecords;

    const hasPresentAttendanceActivity = (dateKey, sessionId) => Object.values(rawRecords?.[dateKey] || {}).some((sessionMap) => {
        const record = sessionMap?.[sessionId];
        return isPlainObject(record) && (record.status === 'ok' || record.status === 'late');
    });

    const derived = {};
    Object.entries(rawRecords).forEach(([dateKey, studentMap]) => {
        derived[dateKey] = {};
        Object.entries(studentMap || {}).forEach(([studentName, sessionMap]) => {
            derived[dateKey][studentName] = {};
            Object.entries(sessionMap || {}).forEach(([sessionId, record]) => {
                derived[dateKey][studentName][sessionId] = { ...record };
            });
        });
    });

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 0; i < ATTENDANCE_LOOKBACK_DAYS; i += 1) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - i);
        const rules = getRulesForDate(data?.config, targetDate);
        if (rules.length === 0) continue;
        const dateKey = getDateKey(targetDate);
        rules.forEach(rule => {
            if (!isPeriodEnded(targetDate, rule, now)) return;
            if (!hasPresentAttendanceActivity(dateKey, rule.id)) return;
            students.forEach(student => {
                const studentName = typeof student?.name === 'string' ? student.name : '';
                if (!studentName) return;
                const existingRecord = derived[dateKey]?.[studentName]?.[rule.id];
                if (existingRecord) return;
                if (!derived[dateKey]) derived[dateKey] = {};
                if (!derived[dateKey][studentName]) derived[dateKey][studentName] = {};
                derived[dateKey][studentName][rule.id] = {
                    status: 'absent',
                    checkTime: '缺勤',
                    timestamp: 0,
                    isDerived: true,
                    source: 'server'
                };
            });
        });
    }

    return derived;
};

const cloneAttendanceRecords = (records) => {
    const next = {};
    Object.entries(stripDerivedAttendanceRecords(records || {})).forEach(([dateKey, studentMap]) => {
        next[dateKey] = {};
        Object.entries(studentMap || {}).forEach(([studentName, sessionMap]) => {
            next[dateKey][studentName] = {};
            Object.entries(sessionMap || {}).forEach(([sessionId, record]) => {
                next[dateKey][studentName][sessionId] = isPlainObject(record) ? { ...record } : record;
            });
        });
    });
    return next;
};

const getStoredAttendanceRecords = (store) => stripDerivedAttendanceRecords(
    readStoredJson(store, 'attendanceRecords') || readStoredJson(store, 'attendance_records') || {}
);

const getStoredStudents = (store) => {
    const value = readStoredJson(store, 'students');
    return Array.isArray(value) ? value.map(student => ({ ...student })) : [];
};

const getStoredHistory = (store) => {
    const value = readStoredJson(store, 'history');
    return Array.isArray(value) ? value.map(item => ({ ...item })) : [];
};

const getStoredLogs = (store) => {
    const value = readStoredJson(store, 'logs');
    return Array.isArray(value) ? value : [];
};

const getStoredConfig = (store) => readStoredJson(store, 'config') || {};

const parseDateKey = (dateKey) => {
    const [year, month, day] = String(dateKey || '').split('-').map(num => parseInt(num, 10));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const formatAttendanceTime = (dateObj) => {
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};

const timeToMinutes = (value) => {
    const parts = String(value || '').split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10) || 0;
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
};

const getCurrentAttendanceSession = (config, now) => {
    const rules = getRulesForDate(config, now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    for (const session of rules) {
        const start = timeToMinutes(session.start);
        const end = timeToMinutes(session.end);
        const lateTime = timeToMinutes(session.lateTime);
        if (start == null || end == null || lateTime == null) continue;
        if (nowMinutes >= start && nowMinutes <= end) {
            return {
                ...session,
                isLateNow: nowMinutes > lateTime
            };
        }
    }
    return null;
};

const getAttendancePenaltyRules = (config) => {
    const penaltyRules = isPlainObject(config?.systemConfig?.attendance?.penaltyRules)
        ? config.systemConfig.attendance.penaltyRules
        : {};
    const punctual = Number(penaltyRules.punctual);
    const late = Number(penaltyRules.late);
    const absent = Number(penaltyRules.absent);
    const perfectAttendance = Number(penaltyRules.perfectAttendance);
    return {
        punctual: Number.isFinite(punctual) ? punctual : 0,
        late: Number.isFinite(late) ? late : -1,
        absent: Number.isFinite(absent) ? absent : -5,
        perfectAttendance: Number.isFinite(perfectAttendance) ? perfectAttendance : 10
    };
};

const findStudentByName = (students, studentName) => (
    (Array.isArray(students) ? students : []).find(student => String(student?.name || '').trim() === String(studentName || '').trim()) || null
);

const getAttendanceSessionName = (config, dateKey, sessionId) => {
    const dateObj = parseDateKey(dateKey);
    const targetId = String(sessionId || '');
    if (dateObj) {
        const rule = getRulesForDate(config, dateObj).find(item => String(item?.id || '') === targetId);
        if (rule?.name) return String(rule.name);
    }
    const fallback = getAttendanceConfig(config).schedule.find(item => String(item?.id || '') === targetId);
    return String(fallback?.name || targetId);
};

const usedMorningLateCardYesterday = ({ logs, studentName, now }) => {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = getDateKey(yesterday);
    return (Array.isArray(logs) ? logs : []).some(log => {
        if (log?.action !== '使用') return false;
        if (String(log?.studentName || '').trim() !== String(studentName || '').trim()) return false;
        if (String(log?.itemName || '').trim() !== '早读迟到卡') return false;
        const logDate = new Date(log?.ts);
        if (Number.isNaN(logDate.getTime())) return false;
        return getDateKey(logDate) === yesterdayKey;
    });
};

const setAttendanceRecord = (records, dateKey, studentName, sessionId, record) => {
    if (!records[dateKey]) records[dateKey] = {};
    if (!records[dateKey][studentName]) records[dateKey][studentName] = {};
    records[dateKey][studentName][sessionId] = { ...record };
};

const applyPointChange = ({
    students,
    history,
    studentId,
    val,
    reason,
    type = 'bonus',
    scene = '班级',
    category = '出勤',
    nowTs
}) => {
    const nextStudents = Array.isArray(students) ? students.map(student => ({ ...student })) : [];
    const nextHistory = Array.isArray(history) ? history.map(item => ({ ...item })) : [];
    const idx = nextStudents.findIndex(student => String(student?.id) === String(studentId));
    if (idx === -1) {
        return { students: nextStudents, history: nextHistory, changed: false };
    }

    const student = nextStudents[idx];
    student.zizai = Number.isFinite(Number(student.zizai)) ? Number(student.zizai) : 0;
    student.balance = Number.isFinite(Number(student.balance)) ? Number(student.balance) : 0;
    student.penalty = Number.isFinite(Number(student.penalty)) ? Number(student.penalty) : 0;

    const numericVal = Number(val);
    if (!Number.isFinite(numericVal) || numericVal === 0) {
        return { students: nextStudents, history: nextHistory, changed: false };
    }

    const snapshot = {
        zizai: student.zizai,
        balance: student.balance,
        penalty: student.penalty
    };

    if (numericVal > 0) student.zizai += numericVal;
    student.balance += numericVal;
    if (numericVal < 0 && type === 'penalty') {
        student.penalty += Math.abs(numericVal);
        student.lastPenaltyAt = nowTs;
    }

    nextHistory.unshift({
        id: nowTs + Math.random(),
        ts: nowTs,
        studentId: student.id,
        studentName: student.name,
        val: numericVal,
        reason,
        snapshot,
        type,
        scene,
        category
    });

    return {
        students: nextStudents,
        history: nextHistory,
        changed: true
    };
};

const undoPointChangeByReasons = ({
    students,
    history,
    studentId,
    reasons,
    nowTs
}) => {
    const nextStudents = Array.isArray(students) ? students.map(student => ({ ...student })) : [];
    const sourceHistory = Array.isArray(history) ? history.map(item => ({ ...item })) : [];
    const reasonList = Array.isArray(reasons) ? reasons.filter(Boolean) : [reasons].filter(Boolean);
    if (reasonList.length === 0) {
        return { students: nextStudents, history: sourceHistory, changed: false };
    }

    const recordIndex = sourceHistory.findIndex(item => (
        String(item?.studentId) === String(studentId)
        && !item?.isUndoLog
        && reasonList.includes(item?.reason)
    ));
    if (recordIndex === -1) {
        return { students: nextStudents, history: sourceHistory, changed: false };
    }

    const record = sourceHistory[recordIndex];
    const studentIndex = nextStudents.findIndex(student => String(student?.id) === String(studentId));
    let undoSnapshot = null;

    if (studentIndex !== -1) {
        const student = nextStudents[studentIndex];
        student.zizai = Number.isFinite(Number(student.zizai)) ? Number(student.zizai) : 0;
        student.balance = Number.isFinite(Number(student.balance)) ? Number(student.balance) : 0;
        student.penalty = Number.isFinite(Number(student.penalty)) ? Number(student.penalty) : 0;

        const numericVal = Number(record?.val) || 0;
        undoSnapshot = {
            zizai: student.zizai,
            balance: student.balance,
            penalty: student.penalty
        };

        if (numericVal > 0) {
            student.zizai -= numericVal;
        }
        student.balance -= numericVal;
        if (numericVal < 0 && record?.type === 'penalty') {
            student.penalty = Math.max(0, student.penalty + numericVal);
        }

        if (record?.type === 'penalty') {
            const remainingPenalties = sourceHistory.filter((item, idx) => (
                idx !== recordIndex
                && String(item?.studentId) === String(studentId)
                && item?.type === 'penalty'
                && !item?.isUndoLog
            ));
            if (remainingPenalties.length > 0) {
                const latest = remainingPenalties.reduce((acc, item) => {
                    const itemTs = Number(item?.ts) || 0;
                    const accTs = Number(acc?.ts) || 0;
                    return itemTs > accTs ? item : acc;
                }, remainingPenalties[0]);
                student.lastPenaltyAt = Number(latest?.ts) || 0;
            } else {
                student.lastPenaltyAt = 0;
            }
        }
    }

    const filteredHistory = sourceHistory.filter((_, idx) => idx !== recordIndex);
    filteredHistory.unshift({
        id: nowTs + Math.random(),
        ts: nowTs,
        studentId: record?.studentId,
        studentName: record?.studentName,
        val: -(Number(record?.val) || 0),
        reason: `撤销扣分: ${record?.reason || ''}`,
        snapshot: undoSnapshot || { zizai: 0, balance: 0, penalty: 0 },
        type: 'bonus',
        isUndoLog: true,
        scene: record?.scene || '班级',
        category: record?.category || '出勤'
    });

    return {
        students: nextStudents,
        history: filteredHistory,
        changed: true
    };
};

const persistAttendanceMutation = ({
    store,
    attendanceRecords,
    students,
    history,
    now
}) => {
    const existingMeta = readStoredJson(store, '__meta') || {};
    const nextMeta = buildNextStoredMeta(existingMeta, now);
    const transaction = db.transaction(() => {
        store.upsertDataKey('attendanceRecords', JSON.stringify(stripDerivedAttendanceRecords(attendanceRecords)));
        if (Array.isArray(students)) {
            store.upsertDataKey('students', JSON.stringify(students));
        }
        if (Array.isArray(history)) {
            store.upsertDataKey('history', JSON.stringify(history));
        }
        store.upsertDataKey('__meta', JSON.stringify(nextMeta));
    });
    transaction();
    return nextMeta;
};

const buildAttendanceApiPayload = ({
    config,
    sourceStudents,
    attendanceRecords,
    students,
    history,
    updatedAt,
    now,
    extra
}) => {
    const payload = {
        success: true,
        attendanceRecords: buildAttendanceRecordsForResponse({
            config,
            students: Array.isArray(sourceStudents) ? sourceStudents : [],
            attendanceRecords
        }, now),
        updatedAt: Number(updatedAt) || null
    };
    if (Array.isArray(students)) payload.students = students;
    if (Array.isArray(history)) payload.history = history;
    if (isPlainObject(extra)) {
        Object.assign(payload, extra);
    }
    return payload;
};

const normalizeAttendanceMaintenanceItems = (items) => (
    Array.isArray(items) ? items : []
).map(item => ({
    date: String(item?.date || '').trim(),
    studentName: String(item?.studentName || item?.name || '').trim(),
    sessionId: String(item?.sessionId || '').trim()
})).filter(item => item.date && item.studentName && item.sessionId);

const resolveTestSessionMiddleware = (req, res, next) => {
    cleanupExpiredTestSessions();
    req.testSession = null;
    req.effectiveNow = null;

    const rawSessionId = getSingleHeaderValue(req.headers[TEST_SESSION_HEADER]);
    if (!rawSessionId) {
        req.dataStore = createDataStore(req);
        return next();
    }

    const session = normalizeTestSession(selectTestSessionById.get(String(rawSessionId)));
    if (!session || session.userId !== Number(req.user?.id) || session.status !== 'active') {
        return res.status(404).json({
            error: '测试会话不存在或已失效',
            code: 'TEST_SESSION_INVALID'
        });
    }

    if (session.expiresAt && session.expiresAt <= Date.now()) {
        deleteTestSessionByIdAndUser.run(session.id, session.userId);
        return res.status(410).json({
            error: '测试会话已过期，请重新进入测试模式',
            code: 'TEST_SESSION_EXPIRED'
        });
    }

    const rawNow = getSingleHeaderValue(req.headers[TEST_NOW_HEADER]);
    if (rawNow !== undefined && rawNow !== null && rawNow !== '') {
        const parsedNow = Number(rawNow);
        if (!Number.isFinite(parsedNow)) {
            return res.status(400).json({
                error: '测试时间参数无效',
                code: 'TEST_NOW_INVALID'
            });
        }
        req.effectiveNow = parsedNow;
    } else if (Number.isFinite(session.simTimeMs)) {
        req.effectiveNow = session.simTimeMs;
    }

    touchTestSession.run(toSqlDateTime(Date.now() + TEST_SESSION_TTL_MS), session.id);
    req.testSession = session;
    req.dataStore = createDataStore(req);
    next();
};

const normalizeTreasureDomain = (domain) => {
    const safe = domain || {};
    const storage = safe.storage && typeof safe.storage === 'object' && !Array.isArray(safe.storage)
        ? safe.storage
        : {};
    return {
        treasures: Array.isArray(safe.treasures) ? safe.treasures : [],
        storage,
        logs: Array.isArray(safe.logs) ? safe.logs : []
    };
};

const hasTreasureDomainData = (domain) => {
    const normalized = normalizeTreasureDomain(domain);
    return normalized.treasures.length > 0
        || normalized.logs.length > 0
        || Object.keys(normalized.storage).length > 0;
};

const readStoredJson = (store, dataKey) => store.readDataKey(dataKey);

const getStoredTreasureDomain = (store) => normalizeTreasureDomain({
    treasures: readStoredJson(store, 'treasures'),
    storage: readStoredJson(store, 'storage'),
    logs: readStoredJson(store, 'logs')
});

const getProtectedTreasureDomain = (store, data, incomingMeta) => {
    if (incomingMeta?.allowTreasureEmptyOverwrite === true) return null;
    const hasTreasureKeys = ['treasures', 'storage', 'logs'].every(key => Object.prototype.hasOwnProperty.call(data || {}, key));
    if (!hasTreasureKeys) return null;
    const incomingDomain = normalizeTreasureDomain(data);
    if (hasTreasureDomainData(incomingDomain)) return null;
    const existingDomain = getStoredTreasureDomain(store);
    if (!hasTreasureDomainData(existingDomain)) return null;
    console.warn(`[藏宝阁] 阻止${store.mode === 'test' ? `测试会话 ${store.testSessionId}` : `用户 ${store.userId}`}的整域空覆盖保存`);
    return existingDomain;
};

const getMaintenanceCredential = (store) => store.readMaintenanceCredential();

const getMaintenanceSession = (req) => {
    const token = req.headers[MAINTENANCE_TOKEN_HEADER];
    const normalizedToken = getSingleHeaderValue(token);
    if (!normalizedToken || !req.user) return null;
    const decoded = verifyMaintenanceToken(normalizedToken);
    if (!decoded || Number(decoded.userId) !== Number(req.user.id)) return null;
    const requestTestSessionId = req.testSession?.id ? String(req.testSession.id) : null;
    const tokenTestSessionId = decoded.testSessionId ? String(decoded.testSessionId) : null;
    if (tokenTestSessionId !== requestTestSessionId) return null;
    return decoded;
};

const hasMaintenanceAccess = (req) => Boolean(getMaintenanceSession(req));
const getMaintenanceTokenScope = (req) => (
    req.testSession?.id ? { testSessionId: req.testSession.id } : {}
);

const formatByteLimit = (bytes) => {
    if (bytes >= MB) {
        const value = bytes / MB;
        return `${Number.isInteger(value) ? value : value.toFixed(1)}MB`;
    }
    if (bytes >= KB) {
        const value = bytes / KB;
        return `${Number.isInteger(value) ? value : value.toFixed(1)}KB`;
    }
    return `${bytes}B`;
};

const measureSerializedSize = (value) => {
    try {
        return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
    } catch (_) {
        return Infinity;
    }
};

const matchesDomainKind = (value, kind) => {
    if (kind === 'array') return Array.isArray(value);
    if (kind === 'object') return isPlainObject(value);
    return false;
};

const normalizeStoredDataDomains = (store, payload) => {
    const safe = isPlainObject(payload) ? { ...payload } : {};
    const removableKeys = new Set();

    if (Object.prototype.hasOwnProperty.call(safe, 'attendance_records')) {
        if (!Object.prototype.hasOwnProperty.call(safe, 'attendanceRecords')) {
            safe.attendanceRecords = stripDerivedAttendanceRecords(safe.attendance_records);
            store.upsertDataKey('attendanceRecords', JSON.stringify(safe.attendanceRecords));
        }
        delete safe.attendance_records;
        removableKeys.add('attendance_records');
    }

    Object.keys(safe).forEach((key) => {
        if (ALLOWED_DATA_KEYS.has(key)) return;
        delete safe[key];
        removableKeys.add(key);
    });

    if (removableKeys.size > 0) {
        store.deleteDataKeys([...removableKeys]);
    }

    return safe;
};

const normalizeIncomingDataPayload = (payload) => {
    if (!isPlainObject(payload)) {
        return { data: payload, error: null };
    }

    const normalized = {};
    const unsupportedKeys = [];
    const conflictingAliases = [];

    Object.entries(payload).forEach(([rawKey, rawValue]) => {
        const key = LEGACY_DATA_KEY_ALIASES[rawKey] || rawKey;
        if (!ALLOWED_DATA_KEYS.has(key)) {
            unsupportedKeys.push(rawKey);
            return;
        }
        if (Object.prototype.hasOwnProperty.call(normalized, key)) {
            if (stringifyComparable(normalized[key]) !== stringifyComparable(rawValue)) {
                conflictingAliases.push(key);
            }
            return;
        }
        normalized[key] = rawValue;
    });

    if (unsupportedKeys.length > 0) {
        return {
            data: null,
            error: {
                status: 400,
                code: 'UNSUPPORTED_DATA_DOMAIN',
                message: `包含不支持的数据域: ${unsupportedKeys.join(', ')}`
            }
        };
    }

    if (conflictingAliases.length > 0) {
        return {
            data: null,
            error: {
                status: 400,
                code: 'CONFLICTING_DATA_DOMAIN',
                message: `检测到重复且冲突的数据域别名: ${conflictingAliases.join(', ')}`
            }
        };
    }

    return { data: normalized, error: null };
};

const validateDataPayload = (payload) => {
    if (!isPlainObject(payload)) {
        return {
            data: payload,
            error: { status: 400, code: 'INVALID_DATA_PAYLOAD', message: '保存数据格式无效' }
        };
    }

    const normalized = {};
    let totalBytes = 0;

    for (const [key, rawValue] of Object.entries(payload)) {
        const rule = DATA_DOMAIN_RULES[key];
        if (!rule) {
            return {
                data: null,
                error: { status: 400, code: 'UNSUPPORTED_DATA_DOMAIN', message: `不支持的数据域: ${key}` }
            };
        }

        let value = rawValue;
        if (key === 'config') {
            value = stripLegacyAdminPasswordFromConfig(value);
        }
        if (key === 'attendanceRecords') {
            value = stripDerivedAttendanceRecords(value);
        }

        if (!matchesDomainKind(value, rule.kind)) {
            return {
                data: null,
                error: { status: 400, code: 'INVALID_DATA_DOMAIN', message: `${key} 数据格式无效` }
            };
        }

        const sizeBytes = measureSerializedSize(value);
        if (!Number.isFinite(sizeBytes)) {
            return {
                data: null,
                error: { status: 400, code: 'INVALID_DATA_DOMAIN', message: `${key} 数据无法序列化` }
            };
        }
        if (sizeBytes > rule.maxBytes) {
            return {
                data: null,
                error: {
                    status: 413,
                    code: 'DATA_DOMAIN_TOO_LARGE',
                    message: `${key} 数据过大，超过 ${formatByteLimit(rule.maxBytes)}`
                }
            };
        }

        normalized[key] = value;
        totalBytes += sizeBytes;
    }

    if (totalBytes > MAX_DATA_PAYLOAD_BYTES) {
        return {
            data: null,
            error: {
                status: 413,
                code: 'DATA_PAYLOAD_TOO_LARGE',
                message: `保存数据总量过大，超过 ${formatByteLimit(MAX_DATA_PAYLOAD_BYTES)}`
            }
        };
    }

    return { data: normalized, error: null };
};

const sanitizePayloadConfig = (payload) => {
    if (!isPlainObject(payload)) return payload;
    if (!Object.prototype.hasOwnProperty.call(payload, 'config')) return payload;
    return {
        ...payload,
        config: stripLegacyAdminPasswordFromConfig(payload.config)
    };
};

const stringifyComparable = (value) => JSON.stringify(value ?? null);

const getComparableConfigForMaintenance = (config) => {
    const safe = stripLegacyAdminPasswordFromConfig(isPlainObject(config) ? config : {});
    const comparable = { ...safe };
    delete comparable.lastWageDate;
    delete comparable.scheduleNotes;
    return comparable;
};

const getComparableStudentRoster = (students) => {
    return (Array.isArray(students) ? students : []).map(student => ({
        id: String(student?.id ?? ''),
        name: String(student?.name ?? ''),
        gender: String(student?.gender ?? ''),
        group: String(student?.group ?? ''),
        role: String(student?.role ?? ''),
        dorm: String(student?.dorm ?? '')
    }));
};

const getComparableTaskMeta = (task) => ({
    id: String(task?.id ?? ''),
    title: String(task?.title ?? ''),
    desc: String(task?.desc ?? ''),
    points: Number(task?.points) || 0,
    startTime: String(task?.startTime ?? ''),
    endTime: String(task?.endTime ?? '')
});

const getComparableTaskClaims = (task) => {
    return (Array.isArray(task?.claimedBy) ? task.claimedBy : []).map(claimedId => String(claimedId));
};

const getComparableTreasureMeta = (item) => ({
    id: String(item?.id ?? ''),
    name: String(item?.name ?? ''),
    rarity: String(item?.rarity ?? ''),
    price: Number(item?.price) || 0,
    desc: String(item?.desc ?? ''),
    ladderPrices: (Array.isArray(item?.ladderPrices) ? item.ladderPrices : []).map(price => Number(price) || 0),
    dailyLimit: Number(item?.dailyLimit) || 0
});

const getTreasureStock = (item) => Number(item?.stock) || 0;

const hasNonDecreasingNestedCounts = (existingValue, incomingValue) => {
    const existing = isPlainObject(existingValue) ? existingValue : {};
    const incoming = isPlainObject(incomingValue) ? incomingValue : {};

    return Object.entries(existing).every(([outerKey, existingInner]) => {
        if (!isPlainObject(existingInner)) return true;
        const incomingInner = isPlainObject(incoming[outerKey]) ? incoming[outerKey] : null;
        if (!incomingInner) return false;
        return Object.entries(existingInner).every(([innerKey, existingCount]) => {
            const incomingCount = Number(incomingInner[innerKey]);
            return Number.isFinite(incomingCount) && incomingCount >= Number(existingCount || 0);
        });
    });
};

const getTreasureLogAppendAction = (existingLogs, incomingLogs) => {
    const existing = Array.isArray(existingLogs) ? existingLogs : [];
    const incoming = Array.isArray(incomingLogs) ? incomingLogs : [];
    if (incoming.length < existing.length) return null;
    const added = incoming.length - existing.length;
    if (added > 1) return null;
    if (stringifyComparable(incoming.slice(added)) !== stringifyComparable(existing)) return null;
    if (added === 0) return '';
    const nextAction = String(incoming[0]?.action ?? '');
    return PUBLIC_TREASURE_LOG_ACTIONS.has(nextAction) ? nextAction : null;
};

const hasConfigMaintenanceMutation = (store, payload) => {
    if (!Object.prototype.hasOwnProperty.call(payload, 'config')) return false;
    const incomingValue = getComparableConfigForMaintenance(payload.config);
    const existingValue = getComparableConfigForMaintenance(readStoredJson(store, 'config'));
    return stringifyComparable(existingValue) !== stringifyComparable(incomingValue);
};

const hasStudentRosterMaintenanceMutation = (store, payload) => {
    if (!Object.prototype.hasOwnProperty.call(payload, 'students')) return false;
    const incomingValue = getComparableStudentRoster(payload.students);
    const existingValue = getComparableStudentRoster(readStoredJson(store, 'students'));
    return stringifyComparable(existingValue) !== stringifyComparable(incomingValue);
};

const hasDirectMaintenanceKeyMutation = (store, payload) => {
    return DIRECT_MAINTENANCE_KEYS.some((key) => {
        if (!Object.prototype.hasOwnProperty.call(payload, key)) return false;
        return stringifyComparable(readStoredJson(store, key)) !== stringifyComparable(payload[key]);
    });
};

const hasHistoryMaintenanceMutation = (store, payload) => {
    if (!Object.prototype.hasOwnProperty.call(payload, 'history')) return false;
    const existingHistory = Array.isArray(readStoredJson(store, 'history')) ? readStoredJson(store, 'history') : [];
    const incomingHistory = Array.isArray(payload.history) ? payload.history : [];
    if (incomingHistory.length < existingHistory.length) return true;
    const prependedCount = incomingHistory.length - existingHistory.length;
    return stringifyComparable(incomingHistory.slice(prependedCount)) !== stringifyComparable(existingHistory);
};

const hasTaskMaintenanceMutation = (store, payload) => {
    if (!Object.prototype.hasOwnProperty.call(payload, 'tasks')) return false;
    const existingTasks = Array.isArray(readStoredJson(store, 'tasks')) ? readStoredJson(store, 'tasks') : [];
    const incomingTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    if (existingTasks.length !== incomingTasks.length) return true;

    for (let i = 0; i < existingTasks.length; i += 1) {
        const existingTask = existingTasks[i];
        const incomingTask = incomingTasks[i];
        if (stringifyComparable(getComparableTaskMeta(existingTask)) !== stringifyComparable(getComparableTaskMeta(incomingTask))) {
            return true;
        }

        const existingClaims = getComparableTaskClaims(existingTask);
        const incomingClaims = getComparableTaskClaims(incomingTask);
        if (stringifyComparable(existingClaims) === stringifyComparable(incomingClaims)) continue;
        if (existingClaims.length === 0 && incomingClaims.length === 1) continue;
        return true;
    }

    return false;
};

const hasTreasureMaintenanceMutation = (store, payload) => {
    const relevantKeys = ['treasures', 'storage', 'logs', 'redemptionHistory', 'dailyRedemptionCounts', 'dailyUsageCounts'];
    if (!relevantKeys.some((key) => Object.prototype.hasOwnProperty.call(payload, key))) return false;

    const existingTreasures = Array.isArray(readStoredJson(store, 'treasures')) ? readStoredJson(store, 'treasures') : [];
    const incomingTreasures = Array.isArray(payload.treasures) ? payload.treasures : existingTreasures;
    const existingStorage = isPlainObject(readStoredJson(store, 'storage')) ? readStoredJson(store, 'storage') : {};
    const incomingStorage = isPlainObject(payload.storage) ? payload.storage : existingStorage;
    const existingLogs = Array.isArray(readStoredJson(store, 'logs')) ? readStoredJson(store, 'logs') : [];
    const incomingLogs = Array.isArray(payload.logs) ? payload.logs : existingLogs;
    const existingRedemptionHistory = isPlainObject(readStoredJson(store, 'redemptionHistory')) ? readStoredJson(store, 'redemptionHistory') : {};
    const incomingRedemptionHistory = isPlainObject(payload.redemptionHistory) ? payload.redemptionHistory : existingRedemptionHistory;
    const existingDailyRedemptionCounts = isPlainObject(readStoredJson(store, 'dailyRedemptionCounts')) ? readStoredJson(store, 'dailyRedemptionCounts') : {};
    const incomingDailyRedemptionCounts = isPlainObject(payload.dailyRedemptionCounts) ? payload.dailyRedemptionCounts : existingDailyRedemptionCounts;
    const existingDailyUsageCounts = isPlainObject(readStoredJson(store, 'dailyUsageCounts')) ? readStoredJson(store, 'dailyUsageCounts') : {};
    const incomingDailyUsageCounts = isPlainObject(payload.dailyUsageCounts) ? payload.dailyUsageCounts : existingDailyUsageCounts;

    const treasuresChanged = stringifyComparable(existingTreasures) !== stringifyComparable(incomingTreasures);
    const storageChanged = stringifyComparable(existingStorage) !== stringifyComparable(incomingStorage);
    const logsChanged = stringifyComparable(existingLogs) !== stringifyComparable(incomingLogs);
    const redemptionChanged = stringifyComparable(existingRedemptionHistory) !== stringifyComparable(incomingRedemptionHistory);
    const dailyRedemptionChanged = stringifyComparable(existingDailyRedemptionCounts) !== stringifyComparable(incomingDailyRedemptionCounts);
    const dailyUsageChanged = stringifyComparable(existingDailyUsageCounts) !== stringifyComparable(incomingDailyUsageCounts);

    if (!treasuresChanged && !storageChanged && !logsChanged && !redemptionChanged && !dailyRedemptionChanged && !dailyUsageChanged) {
        return false;
    }

    if (existingTreasures.length !== incomingTreasures.length) return true;

    let hasStockDecrease = false;
    for (let i = 0; i < existingTreasures.length; i += 1) {
        const existingItem = existingTreasures[i];
        const incomingItem = incomingTreasures[i];
        if (stringifyComparable(getComparableTreasureMeta(existingItem)) !== stringifyComparable(getComparableTreasureMeta(incomingItem))) {
            return true;
        }
        const existingStock = getTreasureStock(existingItem);
        const incomingStock = getTreasureStock(incomingItem);
        if (incomingStock > existingStock) return true;
        if (incomingStock < existingStock) hasStockDecrease = true;
    }

    if (!hasNonDecreasingNestedCounts(existingRedemptionHistory, incomingRedemptionHistory)) return true;
    if (!hasNonDecreasingNestedCounts(existingDailyRedemptionCounts, incomingDailyRedemptionCounts)) return true;
    if (!hasNonDecreasingNestedCounts(existingDailyUsageCounts, incomingDailyUsageCounts)) return true;

    const logAppendAction = getTreasureLogAppendAction(existingLogs, incomingLogs);
    if (logAppendAction === null) return true;

    if (!storageChanged) {
        return hasStockDecrease || redemptionChanged || dailyRedemptionChanged || dailyUsageChanged || Boolean(logAppendAction);
    }

    if (!logAppendAction) return true;

    if (logAppendAction === '使用') {
        return hasStockDecrease || redemptionChanged || dailyRedemptionChanged || !dailyUsageChanged;
    }
    if (logAppendAction === '兑换') {
        return !hasStockDecrease || !redemptionChanged || dailyUsageChanged;
    }
    if (logAppendAction === '祈愿') {
        return !hasStockDecrease || redemptionChanged || dailyUsageChanged;
    }

    return true;
};

const hasMaintenanceProtectedMutation = (store, payload) => {
    return hasConfigMaintenanceMutation(store, payload)
        || hasStudentRosterMaintenanceMutation(store, payload)
        || hasDirectMaintenanceKeyMutation(store, payload)
        || hasHistoryMaintenanceMutation(store, payload)
        || hasTaskMaintenanceMutation(store, payload)
        || hasTreasureMaintenanceMutation(store, payload);
};

const buildMaintenanceResponse = (store) => ({
    success: true,
    configured: Boolean(getMaintenanceCredential(store))
});
const authMiddleware = createAuthMiddleware({
    findUserById(userId) {
        return selectAccessAuthUserById.get(Number(userId));
    }
});

cleanupExpiredTestSessions();
const testSessionCleanupTimer = setInterval(cleanupExpiredTestSessions, TEST_SESSION_CLEANUP_INTERVAL_MS);
if (typeof testSessionCleanupTimer.unref === 'function') {
    testSessionCleanupTimer.unref();
}

app.use(cors());
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', CSP_POLICY);
    next();
});
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));

app.get('/api/health', (req, res) => {
    const report = buildHealthReport({
        db,
        dbPath,
        startedAtMs
    });
    res.status(report.statusCode).json(report.body);
});

app.post(
    CSP_REPORT_URI,
    express.json({ type: ['application/csp-report', 'application/reports+json', 'application/json'] }),
    (req, res) => {
        const rawReports = Array.isArray(req.body) ? req.body : [req.body];
        rawReports
            .filter(Boolean)
            .slice(0, 5)
            .forEach((entry) => {
                const report = entry['csp-report'] || entry.body || entry;
                console.warn('[CSP-REPORT]', JSON.stringify({
                    documentUri: report['document-uri'] || report.documentURL || report.documentUri || '',
                    violatedDirective: report['violated-directive'] || report.violatedDirective || '',
                    effectiveDirective: report['effective-directive'] || report.effectiveDirective || '',
                    blockedUri: report['blocked-uri'] || report.blockedURL || report.blockedUri || '',
                    sourceFile: report['source-file'] || report.sourceFile || '',
                    lineNumber: report['line-number'] || report.lineNumber || ''
                }));
            });
        res.status(204).end();
    }
);

app.use(express.static(path.join(__dirname, 'public')));

// ==================== 认证 API ====================

const normalizeUsername = (value) => String(value || '').trim();
const selectUserIdByUsername = db.prepare('SELECT id FROM users WHERE lower(trim(username)) = lower(?) LIMIT 1');
const selectUserByUsername = db.prepare('SELECT * FROM users WHERE lower(trim(username)) = lower(?) LIMIT 1');
const selectUserPasswordByUsername = db.prepare('SELECT id, username, password_hash FROM users WHERE lower(trim(username)) = lower(?) LIMIT 1');

// 注册
app.post('/api/auth/register', (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || '');
    const email = String(req.body?.email || '').trim();
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: '用户名长度需在3-20个字符之间' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: '密码长度至少6个字符' });
    }
    
    const existingUser = selectUserIdByUsername.get(username);
    if (existingUser) {
        return res.status(400).json({ error: '用户名已存在' });
    }
    
    const passwordHash = hashPassword(password);
    
    try {
        const result = db.prepare(`
            INSERT INTO users (username, password_hash, email)
            VALUES (?, ?, ?)
        `).run(username, passwordHash, email || null);
        
        const user = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
        
        const token = generateToken(user);

        sendAuthSuccess(req, res, user, token);
    } catch (err) {
        console.error('注册失败:', err);
        res.status(500).json({ error: '注册失败，请重试' });
    }
});

// 登录
app.post('/api/auth/login', (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || '');
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    const user = selectUserByUsername.get(username);
    
    if (!user) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    if (!verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    
    const token = generateToken(user);

    sendAuthSuccess(req, res, user, token);
});

// 修改密码
app.post('/api/auth/change-password', (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!username || !currentPassword || !newPassword) {
        return res.status(400).json({ error: '用户名、当前密码和新密码不能为空' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: '新密码长度至少6个字符' });
    }

    const user = selectUserPasswordByUsername.get(username);
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
        return res.status(401).json({ error: '用户名或当前密码错误' });
    }

    if (verifyPassword(newPassword, user.password_hash)) {
        return res.status(400).json({ error: '新密码不能与当前密码相同' });
    }

    try {
        const passwordHash = hashPassword(newPassword);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
        res.json({ success: true, message: '密码修改成功，请使用新密码登录' });
    } catch (err) {
        console.error('修改密码失败:', err);
        res.status(500).json({ error: '修改密码失败，请重试' });
    }
});

// 验证token
app.get('/api/auth/verify', authMiddleware, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ 
        success: true,
        user: { id: req.user.id, username: req.user.username, email: req.user.email, role: req.user.role }
    });
});

// 登出
app.post('/api/auth/logout', (req, res) => {
    clearAccessAuthCookie(req, res);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, message: '登出成功' });
});

// ==================== 测试模式 API ====================

app.post('/api/test-sessions', authMiddleware, userMiddleware, (req, res) => {
    const requestedSimTimeMs = Number(req.body?.simTimeMs);
    const requestedTimeSpeed = Number(req.body?.timeSpeed);
    const simTimeMs = Number.isFinite(requestedSimTimeMs) ? requestedSimTimeMs : Date.now();
    const timeSpeed = requestedTimeSpeed > 0 ? requestedTimeSpeed : 1;
    const sessionId = createTestSessionId();
    const expiresAtMs = Date.now() + TEST_SESSION_TTL_MS;

    try {
        cleanupExpiredTestSessions();
        db.transaction(() => {
            deleteTestSessionsByUser.run(req.user.id);
            insertTestSession.run(
                sessionId,
                req.user.id,
                simTimeMs,
                timeSpeed,
                toSqlDateTime(expiresAtMs)
            );
            copyClassDataToTestSession.run(sessionId, req.user.id);
            copyMaintenanceCredentialToTestSession.run(sessionId, req.user.id);
        })();

        res.json({
            success: true,
            sessionId,
            simTimeMs,
            timeSpeed,
            expiresAt: expiresAtMs
        });
    } catch (err) {
        console.error('创建测试会话失败:', err);
        res.status(500).json({ error: '创建测试会话失败' });
    }
});

app.get('/api/test-sessions/:id', authMiddleware, userMiddleware, (req, res) => {
    cleanupExpiredTestSessions();
    const session = getOwnedTestSession(req.params.id, req.user.id);
    if (!session || session.status !== 'active') {
        return res.status(404).json({
            error: '测试会话不存在或已失效',
            code: 'TEST_SESSION_INVALID'
        });
    }

    res.json({
        success: true,
        sessionId: session.id,
        simTimeMs: session.simTimeMs,
        timeSpeed: session.timeSpeed,
        expiresAt: session.expiresAt
    });
});

app.patch('/api/test-sessions/:id', authMiddleware, userMiddleware, (req, res) => {
    cleanupExpiredTestSessions();
    const session = getOwnedTestSession(req.params.id, req.user.id);
    if (!session || session.status !== 'active') {
        return res.status(404).json({
            error: '测试会话不存在或已失效',
            code: 'TEST_SESSION_INVALID'
        });
    }

    const hasSimTime = Object.prototype.hasOwnProperty.call(req.body || {}, 'simTimeMs');
    const hasTimeSpeed = Object.prototype.hasOwnProperty.call(req.body || {}, 'timeSpeed');
    const nextSimTimeMs = hasSimTime ? Number(req.body?.simTimeMs) : session.simTimeMs;
    const nextTimeSpeed = hasTimeSpeed ? Number(req.body?.timeSpeed) : session.timeSpeed;

    if (hasSimTime && !Number.isFinite(nextSimTimeMs)) {
        return res.status(400).json({ error: '模拟时间无效' });
    }
    if (hasTimeSpeed && !(nextTimeSpeed > 0)) {
        return res.status(400).json({ error: '时间流速无效' });
    }

    const expiresAtMs = Date.now() + TEST_SESSION_TTL_MS;

    try {
        updateTestSessionState.run(
            nextSimTimeMs,
            nextTimeSpeed,
            toSqlDateTime(expiresAtMs),
            session.id,
            req.user.id
        );
        res.json({
            success: true,
            sessionId: session.id,
            simTimeMs: nextSimTimeMs,
            timeSpeed: nextTimeSpeed,
            expiresAt: expiresAtMs
        });
    } catch (err) {
        console.error('更新测试会话失败:', err);
        res.status(500).json({ error: '更新测试会话失败' });
    }
});

app.delete('/api/test-sessions/:id', authMiddleware, userMiddleware, (req, res) => {
    try {
        const result = deleteTestSessionByIdAndUser.run(String(req.params.id), Number(req.user.id));
        res.json({
            success: true,
            deleted: result.changes > 0
        });
    } catch (err) {
        console.error('删除测试会话失败:', err);
        res.status(500).json({ error: '删除测试会话失败' });
    }
});

// ==================== 维护权限 API ====================

const validateMaintenancePassword = (password) => {
    if (!password) return '维护密码不能为空';
    if (password.length < 6) return '维护密码长度至少 6 个字符';
    return null;
};

app.get('/api/maintenance/status', authMiddleware, userMiddleware, resolveTestSessionMiddleware, (req, res) => {
    const store = getRequestDataStore(req);
    const session = getMaintenanceSession(req);
    res.json({
        ...buildMaintenanceResponse(store),
        unlocked: Boolean(session),
        expiresAt: session?.exp ? Number(session.exp) * 1000 : null
    });
});

app.post('/api/maintenance/setup', authMiddleware, userMiddleware, resolveTestSessionMiddleware, (req, res) => {
    const store = getRequestDataStore(req);
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    const validationError = validateMaintenancePassword(password);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    if (getMaintenanceCredential(store)) {
        return res.status(400).json({ error: '维护密码已存在，请使用修改功能' });
    }

    try {
        store.insertMaintenanceCredential(hashPassword(password), 0);
        const token = generateMaintenanceToken(req.user.id, getMaintenanceTokenScope(req));
        res.json({
            success: true,
            token,
            expiresAt: Date.now() + MAINTENANCE_TOKEN_TTL_MS
        });
    } catch (err) {
        console.error('初始化维护密码失败:', err);
        res.status(500).json({ error: '初始化维护密码失败' });
    }
});

app.post('/api/maintenance/unlock', authMiddleware, userMiddleware, resolveTestSessionMiddleware, (req, res) => {
    const store = getRequestDataStore(req);
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    const credential = getMaintenanceCredential(store);

    if (!credential) {
        return res.status(400).json({ error: '维护密码尚未初始化', code: 'MAINTENANCE_NOT_CONFIGURED' });
    }
    if (!password) {
        return res.status(400).json({ error: '请输入维护密码' });
    }
    if (!verifyPassword(password, credential.password_hash)) {
        return res.status(401).json({ error: '维护密码错误' });
    }

    const token = generateMaintenanceToken(req.user.id, getMaintenanceTokenScope(req));
    res.json({
        success: true,
        token,
        expiresAt: Date.now() + MAINTENANCE_TOKEN_TTL_MS
    });
});

app.post('/api/maintenance/change', authMiddleware, userMiddleware, resolveTestSessionMiddleware, (req, res) => {
    const store = getRequestDataStore(req);
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword.trim() : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword.trim() : '';
    const credential = getMaintenanceCredential(store);

    if (!credential) {
        return res.status(400).json({ error: '维护密码尚未初始化', code: 'MAINTENANCE_NOT_CONFIGURED' });
    }

    const validationError = validateMaintenancePassword(newPassword);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }
    if (!verifyPassword(currentPassword, credential.password_hash)) {
        return res.status(401).json({ error: '当前维护密码错误' });
    }

    try {
        store.updateMaintenanceCredential(hashPassword(newPassword));
        const token = generateMaintenanceToken(req.user.id, getMaintenanceTokenScope(req));
        res.json({
            success: true,
            token,
            expiresAt: Date.now() + MAINTENANCE_TOKEN_TTL_MS
        });
    } catch (err) {
        console.error('修改维护密码失败:', err);
        res.status(500).json({ error: '修改维护密码失败' });
    }
});

app.get('/api/attendance', authMiddleware, userMiddleware, resolveTestSessionMiddleware, (req, res) => {
    const store = getRequestDataStore(req);
    try {
        const now = getRequestNow(req);
        const students = getStoredStudents(store);
        const config = getStoredConfig(store);
        const attendanceRecords = getStoredAttendanceRecords(store);
        const meta = readStoredJson(store, '__meta') || {};
        res.json(buildAttendanceApiPayload({
            config,
            sourceStudents: students,
            attendanceRecords,
            updatedAt: Number(meta?.updatedAt) || null,
            now
        }));
    } catch (err) {
        console.error('读取考勤数据失败:', err);
        res.status(500).json({ error: '读取考勤数据失败' });
    }
});

app.post(['/api/attendance/check-in', '/api/attendance/checkin'], authMiddleware, userMiddleware, resolveTestSessionMiddleware, (req, res) => {
    const store = getRequestDataStore(req);
    const studentName = typeof req.body?.studentName === 'string' ? req.body.studentName.trim() : '';
    if (!studentName) {
        return res.status(400).json({ error: '学生姓名不能为空' });
    }

    try {
        const now = getRequestNow(req);
        const nowTs = now.getTime();
        const students = getStoredStudents(store);
        const history = getStoredHistory(store);
        const logs = getStoredLogs(store);
        const config = getStoredConfig(store);
        const student = findStudentByName(students, studentName);
        if (!student) {
            return res.status(404).json({ error: '未找到该学生' });
        }

        const currentSession = getCurrentAttendanceSession(config, now);
        if (!currentSession) {
            return res.status(400).json({ error: '当前不在打卡时段', code: 'ATTENDANCE_SESSION_CLOSED' });
        }

        const attendanceRecords = getStoredAttendanceRecords(store);
        const dateKey = getDateKey(now);
        if (attendanceRecords?.[dateKey]?.[studentName]?.[currentSession.id]) {
            return res.status(409).json({
                error: '已打卡',
                code: 'ATTENDANCE_EXISTS'
            });
        }

        const nextAttendanceRecords = cloneAttendanceRecords(attendanceRecords);
        const record = {
            status: currentSession.isLateNow ? 'late' : 'ok',
            checkTime: formatAttendanceTime(now),
            timestamp: nowTs
        };
        setAttendanceRecord(nextAttendanceRecords, dateKey, studentName, currentSession.id, record);

        let nextStudents = students;
        let nextHistory = history;
        let pointsChanged = false;
        let pointsDelta = 0;
        const penaltyRules = getAttendancePenaltyRules(config);
        const usedMorningLateCard = currentSession.id === 'morning'
            ? usedMorningLateCardYesterday({ logs, studentName, now })
            : false;

        if (!config?.frozen) {
            if (record.status === 'late' && !usedMorningLateCard) {
                const penaltyResult = applyPointChange({
                    students: nextStudents,
                    history: nextHistory,
                    studentId: student.id,
                    val: penaltyRules.late,
                    reason: `考勤迟到: ${currentSession.name}`,
                    type: 'penalty',
                    scene: '班级',
                    category: '出勤',
                    nowTs
                });
                nextStudents = penaltyResult.students;
                nextHistory = penaltyResult.history;
                pointsChanged = penaltyResult.changed === true;
                pointsDelta = Number(penaltyRules.late) || 0;
            } else if (record.status === 'ok' && Number(penaltyRules.punctual) !== 0) {
                const bonusResult = applyPointChange({
                    students: nextStudents,
                    history: nextHistory,
                    studentId: student.id,
                    val: penaltyRules.punctual,
                    reason: `考勤准点: ${currentSession.name}`,
                    type: Number(penaltyRules.punctual) > 0 ? 'bonus' : 'penalty',
                    scene: '班级',
                    category: '出勤',
                    nowTs
                });
                nextStudents = bonusResult.students;
                nextHistory = bonusResult.history;
                pointsChanged = bonusResult.changed === true;
                pointsDelta = Number(penaltyRules.punctual) || 0;
            }
        }

        const nextMeta = persistAttendanceMutation({
            store,
            attendanceRecords: nextAttendanceRecords,
            students: pointsChanged ? nextStudents : undefined,
            history: pointsChanged ? nextHistory : undefined,
            now
        });

        res.json(buildAttendanceApiPayload({
            config,
            sourceStudents: nextStudents,
            attendanceRecords: nextAttendanceRecords,
            students: pointsChanged ? nextStudents : undefined,
            history: pointsChanged ? nextHistory : undefined,
            updatedAt: nextMeta.updatedAt,
            now,
            extra: {
                checkIn: {
                    studentName,
                    sessionId: currentSession.id,
                    sessionName: currentSession.name,
                    status: record.status,
                    record,
                    usedMorningLateCard,
                    pointsDelta
                }
            }
        }));
    } catch (err) {
        console.error('考勤打卡失败:', err);
        res.status(500).json({ error: '考勤打卡失败' });
    }
});

app.post('/api/attendance/maintenance', authMiddleware, userMiddleware, resolveTestSessionMiddleware, (req, res) => {
    const store = getRequestDataStore(req);
    if (!hasMaintenanceAccess(req)) {
        return res.status(403).json({
            error: '当前操作需要维护密码验证',
            code: 'MAINTENANCE_AUTH_REQUIRED'
        });
    }

    const action = String(req.body?.action || '').trim();
    const items = normalizeAttendanceMaintenanceItems(req.body?.items);
    if (!action || items.length === 0) {
        return res.status(400).json({ error: '考勤维护参数无效' });
    }

    if (!['correct', 'settleAbsent'].includes(action)) {
        return res.status(400).json({ error: '不支持的考勤维护操作' });
    }

    try {
        const now = getRequestNow(req);
        const nowTs = now.getTime();
        let students = getStoredStudents(store);
        let history = getStoredHistory(store);
        const config = getStoredConfig(store);
        if (action === 'settleAbsent' && config?.frozen) {
            return res.status(400).json({
                error: '假期封存中，无法结算缺勤',
                code: 'ATTENDANCE_FROZEN'
            });
        }
        const penaltyRules = getAttendancePenaltyRules(config);
        const attendanceRecords = getStoredAttendanceRecords(store);
        const nextAttendanceRecords = cloneAttendanceRecords(attendanceRecords);
        let changed = false;
        let pointsChanged = false;

        items.forEach((item) => {
            const currentRecords = buildAttendanceRecordsForResponse({
                config,
                students,
                attendanceRecords: nextAttendanceRecords
            }, now);
            const currentRecord = currentRecords?.[item.date]?.[item.studentName]?.[item.sessionId];
            if (!currentRecord) return;

            const student = findStudentByName(students, item.studentName);
            const sessionName = getAttendanceSessionName(config, item.date, item.sessionId);
            const lateReasonCandidates = [`考勤迟到: ${item.date} ${sessionName}`, `考勤迟到: ${sessionName}`];
            const absentReasonCandidates = [`缺勤扣分: ${item.date} ${sessionName}`];

            if (action === 'correct') {
                if (currentRecord.status === 'ok') return;
                const nextCheckTime = currentRecord.status === 'late'
                    ? `${currentRecord.checkTime} (已撤销)`
                    : '维护补卡';
                setAttendanceRecord(nextAttendanceRecords, item.date, item.studentName, item.sessionId, {
                    status: 'ok',
                    checkTime: nextCheckTime,
                    timestamp: nowTs
                });
                if (student && currentRecord.status === 'late') {
                    const undoResult = undoPointChangeByReasons({
                        students,
                        history,
                        studentId: student.id,
                        reasons: lateReasonCandidates,
                        nowTs
                    });
                    students = undoResult.students;
                    history = undoResult.history;
                    pointsChanged = undoResult.changed || pointsChanged;
                }
                if (student && currentRecord.status === 'absent') {
                    const undoResult = undoPointChangeByReasons({
                        students,
                        history,
                        studentId: student.id,
                        reasons: absentReasonCandidates,
                        nowTs
                    });
                    students = undoResult.students;
                    history = undoResult.history;
                    pointsChanged = undoResult.changed || pointsChanged;
                }
                changed = true;
                return;
            }

            if (currentRecord.status !== 'absent') return;
            const existingStoredRecord = nextAttendanceRecords?.[item.date]?.[item.studentName]?.[item.sessionId];
            if (existingStoredRecord?.status === 'absent' && String(existingStoredRecord?.checkTime || '').trim() === '已扣分') {
                return;
            }

            setAttendanceRecord(nextAttendanceRecords, item.date, item.studentName, item.sessionId, {
                status: 'absent',
                checkTime: '已扣分',
                timestamp: nowTs
            });

            if (student) {
                const penaltyResult = applyPointChange({
                    students,
                    history,
                    studentId: student.id,
                    val: penaltyRules.absent,
                    reason: `缺勤扣分: ${item.date} ${sessionName}`,
                    type: 'penalty',
                    scene: '班级',
                    category: '出勤',
                    nowTs
                });
                students = penaltyResult.students;
                history = penaltyResult.history;
                pointsChanged = penaltyResult.changed || pointsChanged;
            }
            changed = true;
        });

        const nextMeta = changed
            ? persistAttendanceMutation({
                store,
                attendanceRecords: nextAttendanceRecords,
                students: pointsChanged ? students : undefined,
                history: pointsChanged ? history : undefined,
                now
            })
            : (readStoredJson(store, '__meta') || {});

        res.json(buildAttendanceApiPayload({
            config,
            sourceStudents: students,
            attendanceRecords: nextAttendanceRecords,
            students: pointsChanged ? students : undefined,
            history: pointsChanged ? history : undefined,
            updatedAt: nextMeta?.updatedAt,
            now,
            extra: {
                action,
                changed
            }
        }));
    } catch (err) {
        console.error('考勤维护失败:', err);
        res.status(500).json({ error: '考勤维护失败' });
    }
});

// ==================== 数据 API ====================

// 获取数据
app.get('/api/data', authMiddleware, userMiddleware, resolveTestSessionMiddleware, (req, res) => {
    const store = getRequestDataStore(req);

    try {
        const data = normalizeStoredDataDomains(store, store.readAllData());
        const now = getRequestNow(req);
        const existingMeta = readStoredJson(store, '__meta') || data.__meta || {};
        const decayResult = applyPenaltyDecayLifecycle({
            students: data.students,
            history: data.history,
            config: data.config,
            now
        });
        if (decayResult.changed) {
            data.students = decayResult.students;
            data.__meta = buildNextStoredMeta(existingMeta, now);
            persistDataObject(store, {
                students: data.students,
                __meta: data.__meta
            });
        }
        data.config = stripLegacyAdminPasswordFromConfig(data.config);
        delete data.attendanceRecords;
        delete data.attendance_records;

        res.json(data);
    } catch (err) {
        console.error('读取数据出错:', err);
        res.status(500).json({ error: '读取数据失败' });
    }
});

// 保存数据
app.post('/api/data', authMiddleware, userMiddleware, resolveTestSessionMiddleware, (req, res) => {
    const store = getRequestDataStore(req);
    const normalizedPayload = normalizeIncomingDataPayload(req.body);
    if (normalizedPayload.error) {
        return res.status(normalizedPayload.error.status).json({
            error: normalizedPayload.error.message,
            code: normalizedPayload.error.code
        });
    }
    const validatedPayload = validateDataPayload(sanitizePayloadConfig(normalizedPayload.data));
    if (validatedPayload.error) {
        return res.status(validatedPayload.error.status).json({
            error: validatedPayload.error.message,
            code: validatedPayload.error.code
        });
    }
    const data = validatedPayload.data;

    if (!isPlainObject(data)) {
        return res.status(400).json({ error: '保存数据格式无效' });
    }
    
    try {
        normalizeStoredDataDomains(store, store.readAllData());
        const now = getRequestNow(req);
        const incomingMeta = data?.__meta && typeof data.__meta === 'object' ? data.__meta : {};
        const existingMeta = readStoredJson(store, '__meta') || {};
        const existingUpdatedAt = Number(existingMeta.updatedAt) || 0;
        const baseUpdatedAt = Number(incomingMeta.baseUpdatedAt) || 0;
        const allowServerOverwrite = incomingMeta.allowServerOverwrite === true;
        const allowEmptyExamArchives = incomingMeta.allowEmptyExamArchives === true;
        if (existingUpdatedAt > 0 && !allowServerOverwrite && baseUpdatedAt !== existingUpdatedAt) {
            return res.status(409).json({
                error: '服务器数据已被其他会话更新，请先刷新后再保存',
                code: 'DATA_CONFLICT',
                serverUpdatedAt: existingUpdatedAt
            });
        }
        if (hasMaintenanceProtectedMutation(store, data) && !hasMaintenanceAccess(req)) {
            return res.status(403).json({
                error: '当前操作需要维护密码验证',
                code: 'MAINTENANCE_AUTH_REQUIRED'
            });
        }
        const existingStudents = Array.isArray(readStoredJson(store, 'students')) ? readStoredJson(store, 'students') : [];
        const existingHistory = Array.isArray(readStoredJson(store, 'history')) ? readStoredJson(store, 'history') : [];
        const existingConfig = readStoredJson(store, 'config') || {};
        const mergedStudents = Array.isArray(data.students) ? data.students : existingStudents;
        const mergedHistory = Array.isArray(data.history) ? data.history : existingHistory;
        const mergedConfig = Object.prototype.hasOwnProperty.call(data, 'config') ? data.config : existingConfig;
        const decayResult = applyPenaltyDecayLifecycle({
            students: mergedStudents,
            history: mergedHistory,
            config: mergedConfig,
            now,
            previousConfig: existingConfig
        });
        const normalizedIncomingMeta = {
            ...incomingMeta,
            updatedAt: Number(incomingMeta.updatedAt) || Date.now()
        };
        if (decayResult.changed) {
            data.students = decayResult.students;
            normalizedIncomingMeta.updatedAt = Math.max(
                normalizedIncomingMeta.updatedAt,
                Number(now.getTime()) || 0,
                existingUpdatedAt + 1
            );
        }
        data.__meta = normalizedIncomingMeta;
        const protectedTreasureDomain = getProtectedTreasureDomain(store, data, incomingMeta);

        const transaction = db.transaction(() => {
            for (const [key, value] of Object.entries(data)) {
                let finalValue = protectedTreasureDomain && Object.prototype.hasOwnProperty.call(protectedTreasureDomain, key)
                    ? protectedTreasureDomain[key]
                    : value;
                if (key === 'examArchives') {
                    const incomingExams = Array.isArray(value?.exams) ? value.exams : [];
                    if (incomingExams.length === 0 && !allowEmptyExamArchives) {
                        const existingValue = readStoredJson(store, 'examArchives');
                        const existingExams = Array.isArray(existingValue?.exams) ? existingValue.exams : [];
                        if (existingExams.length > 0) {
                            finalValue = existingValue;
                        }
                    }
                }
                if (key === 'attendanceRecords' || key === 'attendance_records') {
                    continue;
                }
                if (key === 'config') {
                    finalValue = stripLegacyAdminPasswordFromConfig(finalValue);
                }
                store.upsertDataKey(key, JSON.stringify(finalValue));
            }
        });
        
        transaction();
        
        console.log(`[${new Date().toLocaleTimeString()}] 用户 ${req.user.username}${store.mode === 'test' ? `（测试会话 ${store.testSessionId}）` : ''} 数据已保存`);
        res.json({
            success: true,
            message: '保存成功',
            updatedAt: Number(normalizedIncomingMeta.updatedAt) || Date.now()
        });
    } catch (err) {
        console.error('保存数据出错:', err);
        res.status(500).json({ error: '保存失败' });
    }
});

// 获取加扣分记录
app.get('/api/adjustments', authMiddleware, userMiddleware, resolveTestSessionMiddleware, (req, res) => {
    const store = getRequestDataStore(req);

    try {
        const meta = readStoredJson(store, '__meta');
        const history = readStoredJson(store, 'history');
        const historyList = Array.isArray(history) ? history : [];
        
        const adjustments = historyList.filter(item => {
            if (!item) return false;
            const val = Number(item.val);
            if (!Number.isFinite(val) || val === 0) return false;
            if (item.type === 'bonus' || item.type === 'penalty') return true;
            return val > 0 || val < 0;
        });
        
        res.json({ 
            updatedAt: Number(meta?.updatedAt) || null,
            adjustments 
        });
    } catch (err) {
        console.error('读取加扣分数据出错:', err);
        res.status(500).json({ error: '读取加扣分数据失败' });
    }
});

// ==================== 管理员 API ====================

// 获取用户列表
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const users = db.prepare(`
            SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login,
                   (SELECT COUNT(*) FROM class_data WHERE user_id = u.id) as data_count
            FROM users u
            ORDER BY u.created_at DESC
        `).all();
        
        res.json({ success: true, users });
    } catch (err) {
        console.error('获取用户列表失败:', err);
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

// 删除用户
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
    const userId = req.params.id;
    
    if (Number(userId) === req.user.id) {
        return res.status(400).json({ error: '不能删除自己的账户' });
    }
    
    try {
        const targetUser = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
        if (!targetUser) {
            return res.status(404).json({ error: '用户不存在' });
        }
        if (targetUser.role === 'admin' && countAdmins(db) <= 1) {
            return res.status(400).json({ error: '系统至少需要保留一个管理员账户' });
        }

        db.prepare('DELETE FROM maintenance_credentials WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM class_data WHERE user_id = ?').run(userId);
        const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        if (result.changes === 0) return res.status(404).json({ error: '用户不存在' });
        
        res.json({ success: true, message: '用户已删除' });
    } catch (err) {
        console.error('删除用户失败:', err);
        res.status(500).json({ error: '删除用户失败' });
    }
});

// 修改用户角色
app.put('/api/admin/users/:id/role', authMiddleware, adminMiddleware, (req, res) => {
    const userId = req.params.id;
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: '无效的角色' });
    }
    
    try {
        const targetUser = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
        if (!targetUser) {
            return res.status(404).json({ error: '用户不存在' });
        }
        if (targetUser.role === 'admin' && role === 'user' && countAdmins(db) <= 1) {
            return res.status(400).json({ error: '系统至少需要保留一个管理员账户' });
        }

        const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
        if (result.changes === 0) return res.status(404).json({ error: '用户不存在' });
        
        res.json({ success: true, message: '角色已更新' });
    } catch (err) {
        console.error('更新角色失败:', err);
        res.status(500).json({ error: '更新角色失败' });
    }
});

// 系统统计
app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const dataCount = db.prepare('SELECT COUNT(*) as count FROM class_data').get().count;
        
        res.json({
            success: true,
            stats: {
                totalUsers: userCount,
                totalDataRecords: dataCount
            }
        });
    } catch (err) {
        console.error('获取统计失败:', err);
        res.status(500).json({ error: '获取统计失败' });
    }
});

// ==================== 启动服务器 ====================
if (countAdmins(db) === 0) {
    console.error('❌ 未检测到管理员账户，服务拒绝启动');
    console.error('ℹ️  请先执行以下命令创建首个管理员:');
    console.error('   npm run bootstrap-admin');
    db.close();
    process.exit(1);
}

const server = app.listen(PORT, HOST, () => {
    const address = server.address();
    const boundPort = address && typeof address === 'object' ? address.port : PORT;
    console.log('=====================================================');
    console.log(`✅ 班级管理系统（多用户版）已启动！`);
    console.log(`📂 本机访问: http://localhost:${boundPort}`);
    console.log(`📡 局域网访问: 请使用本机 IP 地址 + :${boundPort}`);
    console.log(`🔧 管理员后台: http://localhost:${boundPort}/admin.html`);
    console.log('=====================================================');
});

let shutdownStarted = false;
let shutdownTimer = null;
const finishShutdown = (exitCode) => {
    if (shutdownTimer) {
        clearTimeout(shutdownTimer);
        shutdownTimer = null;
    }
    try {
        db.close();
    } catch (err) {
        console.error('关闭 SQLite 连接失败:', err);
        process.exit(1);
        return;
    }
    process.exit(exitCode);
};
const shutdown = (signal) => {
    if (shutdownStarted) {
        console.warn(`已收到停机信号，忽略重复的 ${signal}`);
        return;
    }
    shutdownStarted = true;
    console.log(`收到 ${signal}，正在优雅停止服务...`);
    clearInterval(testSessionCleanupTimer);
    shutdownTimer = setTimeout(() => {
        console.error(`优雅停机超时（>${SHUTDOWN_TIMEOUT_MS}ms），强制退出`);
        finishShutdown(1);
    }, SHUTDOWN_TIMEOUT_MS);
    if (typeof shutdownTimer.unref === 'function') {
        shutdownTimer.unref();
    }
    server.close((err) => {
        if (err) {
            console.error('关闭 HTTP 服务失败:', err);
            finishShutdown(1);
            return;
        }
        finishShutdown(0);
    });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
