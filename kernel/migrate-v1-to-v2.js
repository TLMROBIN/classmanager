const { ensureSchema } = require('../database/schema');
const { stripLegacyAdminPasswordFromConfig } = require('../utils/config-security');
const { isValidStandardCategory, normalizeStandardCategory } = require('./taxonomy');
const { ensureOfficialPluginCatalog } = require('./plugins');
const { ensureDeploymentSettings, getDeploymentSettings } = require('./auth-adapter');
const {
    getDefaultClassIdForUser,
    findPrimaryClassForUser,
    ensureClassForUser,
    readPluginStorageRow,
    upsertPluginStorageValue,
    writeConfig,
    writeStudents,
    writeStudentProfiles,
    syncHistoryFromV1,
    writeExamArchives,
    createV2CompatStore,
    stringifyComparable
} = require('./v2-store');

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

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

const LEGACY_REMOVABLE_V1_KEYS = new Set([
    'battleSnapshots',
    'effectiveTreasures',
    'data'
]);

const normalizeLegacyUserDomains = (rawRows) => {
    const raw = parseStoredRows(rawRows);
    const normalized = { ...raw };

    if (Object.prototype.hasOwnProperty.call(normalized, 'attendance_records')) {
        if (!Object.prototype.hasOwnProperty.call(normalized, 'attendanceRecords')) {
            normalized.attendanceRecords = normalized.attendance_records;
        }
        delete normalized.attendance_records;
    }

    if (Object.prototype.hasOwnProperty.call(normalized, 'attendanceRecords')) {
        normalized.attendanceRecords = stripDerivedAttendanceRecords(normalized.attendanceRecords);
    }

    if (Object.prototype.hasOwnProperty.call(normalized, 'config')) {
        normalized.config = stripLegacyAdminPasswordFromConfig(normalized.config);
    }

    for (const key of Object.keys(normalized)) {
        if (LEGACY_REMOVABLE_V1_KEYS.has(key)) {
            delete normalized[key];
        }
    }

    return normalized;
};

const findUnmigratedLegacyUsers = (db) => {
    return db.prepare(`
        SELECT u.id, u.username, COUNT(cd.id) AS legacy_row_count
        FROM users u
        INNER JOIN class_data cd ON cd.user_id = u.id
        LEFT JOIN classes c ON c.owner_teacher_id = u.id
        WHERE u.role = 'user' AND c.id IS NULL
        GROUP BY u.id, u.username
        ORDER BY u.id ASC
    `).all();
};

const MIGRATE_PLUGIN_KEYS = [
    'attendanceRecords',
    'messages',
    'teacherMessages',
    'treasures',
    'storage',
    'logs',
    'redemptionHistory',
    'dailyRedemptionCounts',
    'dailyUsageCounts',
    'liquidatedTreasures',
    'tasks',
    'battle',
    'pets',
    'quotes',
    '__meta'
];

const migrateDatabaseV1ToV2 = (db, options = {}) => {
    const {
        mode = 'personal',
        schoolName = null
    } = options;

    ensureSchema(db);
    const deployment = ensureDeploymentSettings(db, {
        mode,
        schoolName,
        forceUpdate: true
    });
    ensureOfficialPluginCatalog(db);

    const userRows = db.prepare("SELECT id, username, role FROM users WHERE role = 'user' ORDER BY id ASC").all();
    const selectClassDataByUser = db.prepare('SELECT data_key, data_value FROM class_data WHERE user_id = ?');

    const userReports = [];

    db.transaction(() => {
        for (const user of userRows) {
            const existingClass = findPrimaryClassForUser(db, user.id);
            if (existingClass) {
                const migrationMetaRow = readPluginStorageRow(db, existingClass.id, 'core', 'v2MigrationMeta');
                if (migrationMetaRow) {
                    userReports.push({
                        userId: user.id,
                        username: user.username,
                        classId: existingClass.id,
                        status: 'skipped_already_migrated'
                    });
                    continue;
                }
            }

            const legacyRows = selectClassDataByUser.all(user.id);
            const normalizedDomains = normalizeLegacyUserDomains(legacyRows);
            const config = isPlainObject(normalizedDomains.config) ? normalizedDomains.config : {};
            const classRow = ensureClassForUser(db, user.id, {
                classId: getDefaultClassIdForUser(user.id),
                title: config?.systemConfig?.className || `${user.username}的班级`,
                config
            });
            const classId = classRow.id;
            const compatStore = createV2CompatStore({
                db,
                userId: user.id,
                mode: 'formal'
            });

            if (Object.prototype.hasOwnProperty.call(normalizedDomains, 'config')) {
                writeConfig(db, classId, normalizedDomains.config);
            }
            if (Object.prototype.hasOwnProperty.call(normalizedDomains, 'students')) {
                writeStudents(db, null, classId, normalizedDomains.students, { emitEvents: false });
            }
            if (Object.prototype.hasOwnProperty.call(normalizedDomains, 'studentProfiles')) {
                writeStudentProfiles(db, classId, normalizedDomains.studentProfiles);
            }

            const categoryStats = {};
            if (Object.prototype.hasOwnProperty.call(normalizedDomains, 'history')) {
                const historyArr = Array.isArray(normalizedDomains.history) ? normalizedDomains.history : [];
                historyArr.forEach((item) => {
                    const { category } = normalizeStandardCategory(item?.category, {
                        type: item?.type,
                        reason: item?.reason
                    });
                    categoryStats[category] = (categoryStats[category] || 0) + 1;
                });
                syncHistoryFromV1(db, null, classId, historyArr, { emitEvents: false });
            }

            if (Object.prototype.hasOwnProperty.call(normalizedDomains, 'examArchives')) {
                writeExamArchives(db, classId, normalizedDomains.examArchives);
            }

            let pluginStorageMigratedCount = 0;
            for (const key of MIGRATE_PLUGIN_KEYS) {
                if (Object.prototype.hasOwnProperty.call(normalizedDomains, key)) {
                    compatStore.upsertDataKey(key, JSON.stringify(normalizedDomains[key]), { emitEvents: false });
                    pluginStorageMigratedCount += 1;
                }
            }

            const activeStudentCount = db.prepare(
                "SELECT COUNT(*) AS count FROM class_enrollments WHERE class_id = ? AND status = 'active'"
            ).get(classId).count;
            const archivedStudentCount = db.prepare(
                "SELECT COUNT(*) AS count FROM class_enrollments WHERE class_id = ? AND status = 'archived'"
            ).get(classId).count;
            const ledgerCount = db.prepare(
                "SELECT COUNT(*) AS count FROM point_ledger WHERE class_id = ? AND status = 'applied'"
            ).get(classId).count;
            const examCount = db.prepare(
                'SELECT COUNT(*) AS count FROM exam_archives WHERE class_id = ?'
            ).get(classId).count;

            upsertPluginStorageValue(db, classId, 'core', 'v2MigrationMeta', {
                migratedAt: new Date().toISOString(),
                sourceRowCount: legacyRows.length,
                mode: deployment.mode
            });

            userReports.push({
                userId: user.id,
                username: user.username,
                classId,
                status: 'migrated',
                legacyRowCount: legacyRows.length,
                activeStudentCount,
                archivedStudentCount,
                ledgerCount,
                examCount,
                pluginStorageMigratedCount,
                categoryStats
            });
        }
    })();

    return {
        deployment,
        users: userReports
    };
};

const almostEqual = (left, right, epsilon = 1e-9) => {
    const a = Number(left) || 0;
    const b = Number(right) || 0;
    return Math.abs(a - b) <= epsilon;
};

const canonicalizeForCompare = (value) => {
    if (Array.isArray(value)) {
        return value.map(canonicalizeForCompare);
    }
    if (isPlainObject(value)) {
        const sorted = {};
        for (const key of Object.keys(value).sort()) {
            if (value[key] === undefined) continue;
            sorted[key] = canonicalizeForCompare(value[key]);
        }
        return sorted;
    }
    return value;
};

const deepEqualCanonical = (left, right) => (
    stringifyComparable(canonicalizeForCompare(left)) === stringifyComparable(canonicalizeForCompare(right))
);

const verifyV1ToV2Migration = (db) => {
    const integrityRows = db.prepare('PRAGMA integrity_check').pluck().all();
    const integrity = integrityRows.join('\n');
    const foreignKeyViolations = db.prepare('PRAGMA foreign_key_check').all();
    const errors = [];

    if (!(integrityRows.length === 1 && integrityRows[0] === 'ok')) {
        errors.push(`SQLite integrity_check 失败: ${integrity}`);
    }
    if (foreignKeyViolations.length > 0) {
        errors.push(`外键完整性异常: ${foreignKeyViolations.length} 条`);
    }

    const userRows = db.prepare("SELECT id, username FROM users WHERE role = 'user' ORDER BY id ASC").all();
    const selectClassDataByUser = db.prepare('SELECT data_key, data_value FROM class_data WHERE user_id = ?');
    const userSummaries = [];

    const DOMAIN_KEYS_TO_VERIFY = [
        'studentProfiles',
        'config',
        'examArchives',
        'attendanceRecords',
        'treasures',
        'storage',
        'logs',
        'redemptionHistory',
        'dailyRedemptionCounts',
        'dailyUsageCounts',
        'liquidatedTreasures',
        'tasks',
        'battle',
        'pets',
        'messages',
        'teacherMessages',
        'quotes',
        '__meta'
    ];

    for (const user of userRows) {
        const legacyRows = selectClassDataByUser.all(user.id);
        const classRow = findPrimaryClassForUser(db, user.id);

        if (legacyRows.length > 0 && !classRow) {
            errors.push(`用户 ${user.username}#${user.id} 尚未迁移到 V2 classes 表`);
            continue;
        }
        if (!classRow) {
            userSummaries.push({
                userId: user.id,
                username: user.username,
                classId: null,
                status: 'empty_user',
                studentCount: 0,
                historyCount: 0
            });
            continue;
        }

        const expected = normalizeLegacyUserDomains(legacyRows);
        const store = createV2CompatStore({ db, userId: user.id, mode: 'formal' });
        const actual = store.readAllData();
        const userErrors = [];

        // 1. Students & three-track totals
        const expectedStudents = Array.isArray(expected.students) ? expected.students : null;
        const actualStudents = Array.isArray(actual.students) ? actual.students : null;
        let expectedTotals = { zizai: 0, penalty: 0, balance: 0 };
        let actualTotals = { zizai: 0, penalty: 0, balance: 0 };

        if ((expectedStudents === null) !== (actualStudents === null)) {
            userErrors.push(`students 存在性不一致 (v1=${expectedStudents !== null}, v2=${actualStudents !== null})`);
        } else if (expectedStudents && actualStudents) {
            if (expectedStudents.length !== actualStudents.length) {
                userErrors.push(`students 人数不一致 (v1=${expectedStudents.length}, v2=${actualStudents.length})`);
            } else {
                for (let i = 0; i < expectedStudents.length; i += 1) {
                    const expStu = expectedStudents[i];
                    const actStu = actualStudents[i];
                    expectedTotals.zizai += Number(expStu?.zizai) || 0;
                    expectedTotals.penalty += Number(expStu?.penalty) || 0;
                    expectedTotals.balance += Number(expStu?.balance) || 0;
                    actualTotals.zizai += Number(actStu?.zizai) || 0;
                    actualTotals.penalty += Number(actStu?.penalty) || 0;
                    actualTotals.balance += Number(actStu?.balance) || 0;

                    if (!deepEqualCanonical(expStu, actStu)) {
                        userErrors.push(`学生第 ${i} 项 (${expStu?.name || expStu?.id}) 往返比对不一致`);
                        break;
                    }
                }
                if (
                    !almostEqual(expectedTotals.zizai, actualTotals.zizai)
                    || !almostEqual(expectedTotals.penalty, actualTotals.penalty)
                    || !almostEqual(expectedTotals.balance, actualTotals.balance)
                ) {
                    userErrors.push('学生三轨积分总和不匹配');
                }
            }
        }

        // 2. History & point_ledger standard categories
        const expectedHistory = Array.isArray(expected.history) ? expected.history : null;
        const actualHistory = Array.isArray(actual.history) ? actual.history : null;
        if ((expectedHistory === null) !== (actualHistory === null)) {
            userErrors.push(`history 存在性不一致 (v1=${expectedHistory !== null}, v2=${actualHistory !== null})`);
        } else if (expectedHistory && actualHistory) {
            if (expectedHistory.length !== actualHistory.length) {
                userErrors.push(`history 条数不一致 (v1=${expectedHistory.length}, v2=${actualHistory.length})`);
            } else {
                for (let i = 0; i < expectedHistory.length; i += 1) {
                    if (!deepEqualCanonical(expectedHistory[i], actualHistory[i])) {
                        userErrors.push(`history 第 ${i} 条往返比对不一致`);
                        break;
                    }
                }
            }
        }

        const ledgerCategories = db.prepare(
            "SELECT DISTINCT category FROM point_ledger WHERE class_id = ? AND status = 'applied'"
        ).pluck().all(classRow.id);
        for (const cat of ledgerCategories) {
            if (!isValidStandardCategory(cat)) {
                userErrors.push(`point_ledger 存在非标准分类: ${cat}`);
            }
        }

        // 3. Remaining domains
        for (const key of DOMAIN_KEYS_TO_VERIFY) {
            const hasExpected = Object.prototype.hasOwnProperty.call(expected, key);
            const hasActual = Object.prototype.hasOwnProperty.call(actual, key);
            if (hasExpected !== hasActual) {
                userErrors.push(`域 ${key} 存在性不一致 (v1=${hasExpected}, v2=${hasActual})`);
                continue;
            }
            if (hasExpected && !deepEqualCanonical(expected[key], actual[key])) {
                userErrors.push(`域 ${key} 内容往返比对不一致`);
            }
        }

        userErrors.forEach((msg) => errors.push(`[${user.username}#${user.id}] ${msg}`));
        userSummaries.push({
            userId: user.id,
            username: user.username,
            classId: classRow.id,
            status: userErrors.length === 0 ? 'verified' : 'mismatch',
            studentCount: actualStudents ? actualStudents.length : 0,
            historyCount: actualHistory ? actualHistory.length : 0,
            totals: actualTotals,
            errors: userErrors
        });
    }

    return {
        ok: errors.length === 0,
        deployment: getDeploymentSettings(db),
        integrity,
        foreignKeyViolations,
        users: userSummaries,
        errors
    };
};

module.exports = {
    normalizeLegacyUserDomains,
    findUnmigratedLegacyUsers,
    migrateDatabaseV1ToV2,
    verifyV1ToV2Migration
};
