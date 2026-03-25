const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { hashPassword, verifyPassword } = require('./utils/password');
const {
    generateToken,
    generateMaintenanceToken,
    verifyMaintenanceToken,
    authMiddleware,
    adminMiddleware,
    userMiddleware,
    MAINTENANCE_TOKEN_TTL_MS
} = require('./middleware/auth');
const { dbPath, ensureSchema, countAdmins } = require('./database/schema');
const { stripLegacyAdminPasswordFromConfig } = require('./utils/config-security');

const app = express();
const PORT = process.env.PORT || 3002;

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
ensureSchema(db);

const MAINTENANCE_TOKEN_HEADER = 'x-maintenance-token';
const TEST_SESSION_HEADER = 'x-test-session';
const TEST_NOW_HEADER = 'x-test-now';
const DIRECT_MAINTENANCE_KEYS = ['studentProfiles', 'examArchives'];
const PUBLIC_TREASURE_LOG_ACTIONS = new Set(['兑换', '使用', '祈愿']);
const PUBLIC_ATTENDANCE_STATUSES = new Set(['ok', 'late']);
const TEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const TEST_SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const selectClassDataRows = db.prepare('SELECT data_key, data_value FROM class_data WHERE user_id = ?');
const selectClassDataValue = db.prepare('SELECT data_value FROM class_data WHERE user_id = ? AND data_key = ?');
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

const normalizeAttendanceRecordComparable = (record) => {
    if (!isPlainObject(record)) return null;
    return {
        status: String(record.status ?? ''),
        checkTime: String(record.checkTime ?? ''),
        timestamp: Number(record.timestamp) || 0
    };
};

const isPublicAttendanceCheckTime = (value) => /^\d{2}:\d{2}$/.test(String(value ?? '').trim());

const iterateAttendanceRecords = (records, visitor) => {
    Object.entries(stripDerivedAttendanceRecords(records || {})).forEach(([dateKey, studentMap]) => {
        Object.entries(studentMap || {}).forEach(([studentName, sessionMap]) => {
            Object.entries(sessionMap || {}).forEach(([sessionId, record]) => {
                visitor({
                    dateKey,
                    studentName,
                    sessionId,
                    record: normalizeAttendanceRecordComparable(record)
                });
            });
        });
    });
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

const hasAttendanceMaintenanceMutation = (store, payload) => {
    const hasAttendanceKey = Object.prototype.hasOwnProperty.call(payload, 'attendanceRecords')
        || Object.prototype.hasOwnProperty.call(payload, 'attendance_records');
    if (!hasAttendanceKey) return false;

    const existingRecords = stripDerivedAttendanceRecords(
        readStoredJson(store, 'attendanceRecords') || readStoredJson(store, 'attendance_records') || {}
    );
    const incomingRecords = stripDerivedAttendanceRecords(payload.attendanceRecords || payload.attendance_records || {});
    let requiresMaintenance = false;

    iterateAttendanceRecords(existingRecords, ({ dateKey, studentName, sessionId, record }) => {
        if (requiresMaintenance) return;
        const incomingRecord = normalizeAttendanceRecordComparable(incomingRecords?.[dateKey]?.[studentName]?.[sessionId]);
        if (!incomingRecord || stringifyComparable(incomingRecord) !== stringifyComparable(record)) {
            requiresMaintenance = true;
        }
    });

    if (requiresMaintenance) return true;

    iterateAttendanceRecords(incomingRecords, ({ dateKey, studentName, sessionId, record }) => {
        if (requiresMaintenance) return;
        const existingRecord = normalizeAttendanceRecordComparable(existingRecords?.[dateKey]?.[studentName]?.[sessionId]);
        if (existingRecord) return;
        if (!record || !PUBLIC_ATTENDANCE_STATUSES.has(record.status)) {
            requiresMaintenance = true;
            return;
        }
        if (record.timestamp <= 0 || !isPublicAttendanceCheckTime(record.checkTime)) {
            requiresMaintenance = true;
        }
    });

    return requiresMaintenance;
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
        || hasAttendanceMaintenanceMutation(store, payload)
        || hasTreasureMaintenanceMutation(store, payload);
};

const buildMaintenanceResponse = (store) => ({
    success: true,
    configured: Boolean(getMaintenanceCredential(store))
});

cleanupExpiredTestSessions();
const testSessionCleanupTimer = setInterval(cleanupExpiredTestSessions, TEST_SESSION_CLEANUP_INTERVAL_MS);
if (typeof testSessionCleanupTimer.unref === 'function') {
    testSessionCleanupTimer.unref();
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== 认证 API ====================

// 注册
app.post('/api/auth/register', (req, res) => {
    const { username, password, email } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: '用户名长度需在3-20个字符之间' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: '密码长度至少6个字符' });
    }
    
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
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
        
        res.json({ 
            success: true, 
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (err) {
        console.error('注册失败:', err);
        res.status(500).json({ error: '注册失败，请重试' });
    }
});

// 登录
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    if (!verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    
    const token = generateToken(user);
    
    res.json({
        success: true,
        token,
        user: { id: user.id, username: user.username, role: user.role }
    });
});

// 验证token
app.get('/api/auth/verify', authMiddleware, (req, res) => {
    const user = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ 
        success: true,
        user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
});

// 登出
app.post('/api/auth/logout', (req, res) => {
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

// ==================== 数据 API ====================

// 获取数据
app.get('/api/data', authMiddleware, userMiddleware, resolveTestSessionMiddleware, (req, res) => {
    const store = getRequestDataStore(req);

    try {
        const data = store.readAllData();
        data.config = stripLegacyAdminPasswordFromConfig(data.config);
        data.attendanceRecords = buildAttendanceRecordsForResponse(data, getRequestNow(req));

        res.json(data);
    } catch (err) {
        console.error('读取数据出错:', err);
        res.status(500).json({ error: '读取数据失败' });
    }
});

// 保存数据
app.post('/api/data', authMiddleware, userMiddleware, resolveTestSessionMiddleware, (req, res) => {
    const store = getRequestDataStore(req);
    const data = sanitizePayloadConfig(req.body);

    if (!isPlainObject(data)) {
        return res.status(400).json({ error: '保存数据格式无效' });
    }
    
    try {
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
                    finalValue = stripDerivedAttendanceRecords(finalValue);
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
            updatedAt: Number(incomingMeta.updatedAt) || Date.now()
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

app.listen(PORT, '0.0.0.0', () => {
    console.log('=====================================================');
    console.log(`✅ 班级管理系统（多用户版）已启动！`);
    console.log(`📂 本机访问: http://localhost:${PORT}`);
    console.log(`📡 局域网访问: 请使用本机 IP 地址 + :${PORT}`);
    console.log(`🔧 管理员后台: http://localhost:${PORT}/admin.html`);
    console.log('=====================================================');
});

process.on('SIGINT', () => {
    clearInterval(testSessionCleanupTimer);
    db.close();
    process.exit();
});
