#!/usr/bin/env node

const path = require('path');
const Database = require('better-sqlite3');
const { dbPath: defaultDbPath } = require('../database/schema');
const { stripLegacyAdminPasswordFromConfig } = require('../utils/config-security');
const {
    DEFAULT_BACKUP_DIR,
    ensureDir,
    formatTimestamp,
    parseArgs,
    resolveInputPath,
    toRelativePath
} = require('./backup-utils');

const KB = 1024;
const MB = 1024 * KB;
const LEGACY_DATA_KEY_ALIASES = Object.freeze({
    attendance_records: 'attendanceRecords'
});
const SAFE_REMOVABLE_DATA_KEYS = Object.freeze({
    battleSnapshots: '旧版战斗快照缓存，已废弃',
    effectiveTreasures: '旧版奖品缓存，已废弃'
});
const DATA_DOMAIN_RULES = Object.freeze({
    students: { kind: 'array', maxBytes: 1 * MB },
    studentProfiles: { kind: 'object', maxBytes: 1 * MB },
    history: { kind: 'array', maxBytes: 2 * MB },
    config: { kind: 'object', maxBytes: 512 * KB },
    attendanceRecords: { kind: 'object', maxBytes: 2 * MB },
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
const args = parseArgs(process.argv.slice(2));

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const stringifyComparable = (value) => JSON.stringify(value ?? null);

const stripSystemConfigTreasures = (systemConfig) => {
    if (!isPlainObject(systemConfig)) return systemConfig;
    if (!Object.prototype.hasOwnProperty.call(systemConfig, 'treasures')) return systemConfig;
    const { treasures, ...rest } = systemConfig;
    void treasures;
    return rest;
};

const stripLegacyPsychologyCommittee = (config) => {
    if (!isPlainObject(config)) return config;
    if (!Object.prototype.hasOwnProperty.call(config, 'psychologyCommittee')) return config;
    const { psychologyCommittee, ...rest } = config;
    void psychologyCommittee;
    return rest;
};

const stripTreasureConfig = (config) => {
    if (!isPlainObject(config)) return config;
    if (!isPlainObject(config.systemConfig)) return config;
    const nextSystemConfig = stripSystemConfigTreasures(config.systemConfig);
    if (nextSystemConfig === config.systemConfig) return config;
    return {
        ...config,
        systemConfig: nextSystemConfig
    };
};

const sanitizeStoredConfig = (config) => {
    return stripLegacyPsychologyCommittee(
        stripLegacyAdminPasswordFromConfig(
            stripTreasureConfig(config)
        )
    );
};

const getLegacyConfigFieldPaths = (config) => {
    const fields = [];
    if (!isPlainObject(config)) return fields;
    if (Object.prototype.hasOwnProperty.call(config, 'psychologyCommittee')) {
        fields.push('psychologyCommittee');
    }
    if (isPlainObject(config.systemConfig) && Object.prototype.hasOwnProperty.call(config.systemConfig, 'treasures')) {
        fields.push('systemConfig.treasures');
    }
    if (isPlainObject(config.systemConfig) && Object.prototype.hasOwnProperty.call(config.systemConfig, 'adminPassword')) {
        fields.push('systemConfig.adminPassword');
    }
    return fields;
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

const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes < 0) return '未知';
    if (bytes >= MB) return `${(bytes / MB).toFixed(bytes % MB === 0 ? 0 : 1)}MB`;
    if (bytes >= KB) return `${(bytes / KB).toFixed(bytes % KB === 0 ? 0 : 1)}KB`;
    return `${bytes}B`;
};

const getValueKind = (value) => {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
};

const formatUserLabel = (user) => `${user.username}#${user.userId}`;

const buildIssue = ({
    code,
    user,
    dataKey,
    detail,
    fixable = false,
    actionSummary = null
}) => ({
    code,
    userId: user.userId,
    username: user.username,
    role: user.role,
    dataKey,
    detail,
    fixable,
    actionSummary
});

const registerAction = (actionMap, action) => {
    const key = `${action.kind}:${action.userId}:${action.dataKey}`;
    actionMap.set(key, action);
};

const parseStoredRow = (row) => {
    try {
        return {
            ok: true,
            value: JSON.parse(row.dataValue),
            sizeBytes: Buffer.byteLength(row.dataValue, 'utf8')
        };
    } catch (error) {
        return {
            ok: false,
            error: error.message,
            sizeBytes: Buffer.byteLength(row.dataValue, 'utf8')
        };
    }
};

const collectUsers = (db, userFilter) => {
    const rows = db.prepare(`
        SELECT
            cd.user_id AS user_id,
            u.username AS username,
            u.role AS role,
            cd.data_key AS data_key,
            cd.data_value AS data_value
        FROM class_data cd
        INNER JOIN users u ON u.id = cd.user_id
        ORDER BY cd.user_id ASC, cd.data_key ASC
    `).all();

    const normalizedFilter = userFilter == null ? null : String(userFilter).trim();
    const grouped = new Map();

    rows.forEach((row) => {
        const matchesFilter = !normalizedFilter
            || String(row.user_id) === normalizedFilter
            || String(row.username) === normalizedFilter;
        if (!matchesFilter) return;

        if (!grouped.has(row.user_id)) {
            grouped.set(row.user_id, {
                userId: Number(row.user_id),
                username: String(row.username || ''),
                role: String(row.role || ''),
                rows: new Map()
            });
        }

        grouped.get(row.user_id).rows.set(String(row.data_key), {
            dataKey: String(row.data_key),
            dataValue: String(row.data_value)
        });
    });

    return [...grouped.values()];
};

const analyzeAllowedDomain = (user, dataKey, parsedRow, actionMap) => {
    const issues = [];
    const rule = DATA_DOMAIN_RULES[dataKey];
    const value = parsedRow.value;

    if (!matchesDomainKind(value, rule.kind)) {
        issues.push(buildIssue({
            code: 'INVALID_DOMAIN_TYPE',
            user,
            dataKey,
            detail: `数据类型错误，期望 ${rule.kind}，实际 ${getValueKind(value)}`
        }));
        return issues;
    }

    if (parsedRow.sizeBytes > rule.maxBytes) {
        issues.push(buildIssue({
            code: 'DOMAIN_TOO_LARGE',
            user,
            dataKey,
            detail: `数据体积 ${formatBytes(parsedRow.sizeBytes)}，超过限制 ${formatBytes(rule.maxBytes)}`
        }));
    }

    if (dataKey === 'config') {
        const legacyFields = getLegacyConfigFieldPaths(value);
        const sanitized = sanitizeStoredConfig(value);
        if (legacyFields.length > 0 && stringifyComparable(sanitized) !== stringifyComparable(value)) {
            issues.push(buildIssue({
                code: 'LEGACY_CONFIG_FIELDS',
                user,
                dataKey,
                detail: `包含遗留字段: ${legacyFields.join(', ')}`,
                fixable: true,
                actionSummary: '清理遗留配置字段'
            }));
            registerAction(actionMap, {
                kind: 'upsert',
                userId: user.userId,
                dataKey,
                nextValue: JSON.stringify(sanitized)
            });
        }
    }

    if (dataKey === 'attendanceRecords') {
        const sanitized = stripDerivedAttendanceRecords(value);
        if (stringifyComparable(sanitized) !== stringifyComparable(value)) {
            issues.push(buildIssue({
                code: 'DERIVED_ATTENDANCE_ROWS',
                user,
                dataKey,
                detail: '包含服务端可重新生成的派生考勤记录',
                fixable: true,
                actionSummary: '剥离派生考勤记录'
            }));
            registerAction(actionMap, {
                kind: 'upsert',
                userId: user.userId,
                dataKey,
                nextValue: JSON.stringify(sanitized)
            });
        }
    }

    return issues;
};

const analyzeLegacyAttendanceAlias = (user, rows, parsedRows, actionMap) => {
    if (!rows.has('attendance_records')) {
        return [];
    }

    const issues = [];
    const aliasRow = parsedRows.get('attendance_records');
    const canonicalRow = parsedRows.get('attendanceRecords') || null;

    if (!aliasRow.ok) {
        if (canonicalRow) {
            issues.push(buildIssue({
                code: 'REDUNDANT_LEGACY_ALIAS',
                user,
                dataKey: 'attendance_records',
                detail: '旧别名数据损坏，但 canonical 键已存在，可安全删除旧键',
                fixable: true,
                actionSummary: '删除损坏的旧别名键'
            }));
            registerAction(actionMap, {
                kind: 'delete',
                userId: user.userId,
                dataKey: 'attendance_records'
            });
        }
        return issues;
    }

    const aliasValue = aliasRow.value;
    if (!matchesDomainKind(aliasValue, 'object')) {
        issues.push(buildIssue({
            code: 'INVALID_LEGACY_ALIAS_TYPE',
            user,
            dataKey: 'attendance_records',
            detail: `旧别名数据类型错误，期望 object，实际 ${getValueKind(aliasValue)}`
        }));
        return issues;
    }

    const sanitizedAliasValue = stripDerivedAttendanceRecords(aliasValue);
    const aliasSize = measureSerializedSize(sanitizedAliasValue);
    if (aliasSize > DATA_DOMAIN_RULES.attendanceRecords.maxBytes) {
        issues.push(buildIssue({
            code: 'LEGACY_ALIAS_TOO_LARGE',
            user,
            dataKey: 'attendance_records',
            detail: `迁移后的 attendanceRecords 体积 ${formatBytes(aliasSize)}，超过限制 ${formatBytes(DATA_DOMAIN_RULES.attendanceRecords.maxBytes)}`
        }));
        return issues;
    }

    if (!canonicalRow) {
        issues.push(buildIssue({
            code: 'MIGRATABLE_LEGACY_ALIAS',
            user,
            dataKey: 'attendance_records',
            detail: '可迁移到 attendanceRecords，并删除旧别名键',
            fixable: true,
            actionSummary: '迁移 attendance_records -> attendanceRecords'
        }));
        registerAction(actionMap, {
            kind: 'upsert',
            userId: user.userId,
            dataKey: 'attendanceRecords',
            nextValue: JSON.stringify(sanitizedAliasValue)
        });
        registerAction(actionMap, {
            kind: 'delete',
            userId: user.userId,
            dataKey: 'attendance_records'
        });
        return issues;
    }

    if (!canonicalRow.ok || !matchesDomainKind(canonicalRow.value, 'object')) {
        issues.push(buildIssue({
            code: 'LEGACY_ALIAS_CONFLICT',
            user,
            dataKey: 'attendance_records',
            detail: '旧别名和 canonical 键同时存在，但 canonical 键本身异常，工具不自动覆盖'
        }));
        return issues;
    }

    const sanitizedCanonicalValue = stripDerivedAttendanceRecords(canonicalRow.value);
    if (stringifyComparable(sanitizedAliasValue) === stringifyComparable(sanitizedCanonicalValue)) {
        issues.push(buildIssue({
            code: 'REDUNDANT_LEGACY_ALIAS',
            user,
            dataKey: 'attendance_records',
            detail: '旧别名与 canonical 键内容一致，可安全删除旧键',
            fixable: true,
            actionSummary: '删除冗余旧别名键'
        }));
        registerAction(actionMap, {
            kind: 'delete',
            userId: user.userId,
            dataKey: 'attendance_records'
        });
        return issues;
    }

    issues.push(buildIssue({
        code: 'LEGACY_ALIAS_CONFLICT',
        user,
        dataKey: 'attendance_records',
        detail: '旧别名与 attendanceRecords 内容不一致，需人工判定保留哪份数据'
    }));
    return issues;
};

const scanDatabase = (db, userFilter) => {
    const users = collectUsers(db, userFilter);
    const issues = [];
    const actionMap = new Map();
    let scannedRows = 0;

    users.forEach((user) => {
        const parsedRows = new Map();

        user.rows.forEach((row, dataKey) => {
            scannedRows += 1;
            parsedRows.set(dataKey, parseStoredRow(row));
        });

        user.rows.forEach((row, dataKey) => {
            const parsedRow = parsedRows.get(dataKey);

            if (!parsedRow.ok) {
                issues.push(buildIssue({
                    code: 'INVALID_JSON',
                    user,
                    dataKey,
                    detail: `JSON 解析失败: ${parsedRow.error}`
                }));
                return;
            }

            if (dataKey === 'attendance_records') {
                return;
            }

            if (!ALLOWED_DATA_KEYS.has(dataKey)) {
                if (dataKey === 'data') {
                    issues.push(buildIssue({
                        code: 'LEGACY_BUNDLED_DATA_KEY',
                        user,
                        dataKey,
                        detail: '发现旧版整包 data 键，工具暂不自动拆分，请人工确认是否还需要'
                    }));
                    return;
                }

                if (Object.prototype.hasOwnProperty.call(SAFE_REMOVABLE_DATA_KEYS, dataKey)) {
                    issues.push(buildIssue({
                        code: 'DEPRECATED_DATA_KEY',
                        user,
                        dataKey,
                        detail: SAFE_REMOVABLE_DATA_KEYS[dataKey],
                        fixable: true,
                        actionSummary: '删除废弃数据键'
                    }));
                    registerAction(actionMap, {
                        kind: 'delete',
                        userId: user.userId,
                        dataKey
                    });
                    return;
                }

                const normalizedKey = LEGACY_DATA_KEY_ALIASES[dataKey];
                if (normalizedKey) {
                    return;
                }

                issues.push(buildIssue({
                    code: 'UNSUPPORTED_DATA_KEY',
                    user,
                    dataKey,
                    detail: '不在当前允许写入的 domain 白名单内'
                }));
                return;
            }

            issues.push(...analyzeAllowedDomain(user, dataKey, parsedRow, actionMap));
        });

        issues.push(...analyzeLegacyAttendanceAlias(user, user.rows, parsedRows, actionMap));
    });

    const fixableIssues = issues.filter((issue) => issue.fixable);
    const reportOnlyIssues = issues.filter((issue) => !issue.fixable);
    const issueCounts = issues.reduce((accumulator, issue) => {
        accumulator[issue.code] = (accumulator[issue.code] || 0) + 1;
        return accumulator;
    }, {});

    return {
        usersScanned: users.length,
        rowsScanned: scannedRows,
        issues,
        fixableIssues,
        reportOnlyIssues,
        issueCounts,
        actions: [...actionMap.values()]
    };
};

const printIssueGroup = (title, items) => {
    if (items.length === 0) return;
    console.log(`\n${title}`);
    items
        .slice()
        .sort((left, right) => {
            if (left.userId !== right.userId) return left.userId - right.userId;
            if (left.dataKey !== right.dataKey) return left.dataKey.localeCompare(right.dataKey);
            return left.code.localeCompare(right.code);
        })
        .forEach((issue) => {
            const actionText = issue.fixable && issue.actionSummary ? ` | 修复: ${issue.actionSummary}` : '';
            console.log(`- [${formatUserLabel(issue)}] ${issue.dataKey} | ${issue.code} | ${issue.detail}${actionText}`);
        });
};

const printIssueCounts = (issueCounts) => {
    const entries = Object.entries(issueCounts).sort((left, right) => left[0].localeCompare(right[0]));
    if (entries.length === 0) return;
    console.log('\n问题统计');
    entries.forEach(([code, count]) => {
        console.log(`- ${code}: ${count}`);
    });
};

const printScanResult = ({ title, mode, dbPath, userFilter, result }) => {
    console.log('\n==========================================');
    console.log(`  ${title}`);
    console.log('==========================================');
    console.log(`- 模式: ${mode}`);
    console.log(`- 数据库: ${toRelativePath(dbPath)}`);
    console.log(`- 用户过滤: ${userFilter ? String(userFilter) : '全部'}`);
    console.log(`- 扫描用户: ${result.usersScanned}`);
    console.log(`- 扫描数据行: ${result.rowsScanned}`);
    console.log(`- 发现问题: ${result.issues.length}`);
    console.log(`- 可自动修复: ${result.fixableIssues.length}`);
    console.log(`- 仅报告: ${result.reportOnlyIssues.length}`);
    console.log(`- 待执行修复动作: ${result.actions.length}`);

    if (result.issues.length === 0) {
        console.log('✅ 未发现异常数据');
        return;
    }

    printIssueCounts(result.issueCounts);
    printIssueGroup('可自动修复', result.fixableIssues);
    printIssueGroup('需人工处理', result.reportOnlyIssues);
};

const createSafetyBackup = async (db, dbPath, backupDir) => {
    ensureDir(backupDir);
    const baseName = path.basename(dbPath, path.extname(dbPath));
    const backupPath = path.join(backupDir, `${baseName}_pre_data_audit_${formatTimestamp(new Date())}.db`);
    await db.backup(backupPath);
    return backupPath;
};

const applyActions = (db, actions) => {
    const upsertClassData = db.prepare(`
        INSERT INTO class_data (user_id, data_key, data_value, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, data_key)
        DO UPDATE SET data_value = excluded.data_value, updated_at = CURRENT_TIMESTAMP
    `);
    const deleteClassData = db.prepare(`
        DELETE FROM class_data
        WHERE user_id = ? AND data_key = ?
    `);

    const transaction = db.transaction((pendingActions) => {
        pendingActions.forEach((action) => {
            if (action.kind === 'upsert') {
                upsertClassData.run(action.userId, action.dataKey, action.nextValue);
                return;
            }
            if (action.kind === 'delete') {
                deleteClassData.run(action.userId, action.dataKey);
            }
        });
    });

    transaction(actions);
};

const printHelp = () => {
    console.log('class_data 巡检 / 修复工具');
    console.log('');
    console.log('用法:');
    console.log('  node scripts/audit-class-data.js [--user <用户名或ID>] [--db <数据库路径>] [--apply] [--skip-backup]');
    console.log('');
    console.log('说明:');
    console.log('  - 默认只读巡检，不会写数据库');
    console.log('  - --apply 会执行安全修复，并在默认情况下先创建一份修复前备份');
    console.log('  - 当前仅自动修复旧键迁移、废弃键删除、遗留配置字段清理、派生考勤记录剥离');
};

const main = async () => {
    if (args.help) {
        printHelp();
        return;
    }

    const applyMode = Boolean(args.apply);
    const userFilter = args.user || null;
    const skipBackup = Boolean(args['skip-backup']);
    const targetDbPath = resolveInputPath(args.db, defaultDbPath);
    const backupDir = resolveInputPath(args['backup-dir'], DEFAULT_BACKUP_DIR);
    const db = new Database(targetDbPath, {
        readonly: !applyMode,
        fileMustExist: true,
        timeout: 5000
    });

    try {
        const beforeResult = scanDatabase(db, userFilter);

        if (userFilter && beforeResult.usersScanned === 0) {
            console.log(`未找到匹配用户: ${userFilter}`);
            return;
        }

        printScanResult({
            title: applyMode ? '修复前巡检' : '只读巡检',
            mode: applyMode ? 'apply' : 'read-only',
            dbPath: targetDbPath,
            userFilter,
            result: beforeResult
        });

        if (!applyMode) {
            return;
        }

        if (beforeResult.actions.length === 0) {
            console.log('\n没有可自动修复的异常，未执行任何写入。');
            return;
        }

        let backupPath = null;
        if (!skipBackup) {
            backupPath = await createSafetyBackup(db, targetDbPath, backupDir);
            console.log(`\n已创建修复前备份: ${toRelativePath(backupPath)}`);
        }

        applyActions(db, beforeResult.actions);
        console.log(`已执行修复动作: ${beforeResult.actions.length}`);

        const afterResult = scanDatabase(db, userFilter);
        printScanResult({
            title: '修复后复检',
            mode: 'post-apply',
            dbPath: targetDbPath,
            userFilter,
            result: afterResult
        });
    } finally {
        db.close();
    }
};

main().catch((error) => {
    console.error(`❌ 巡检失败: ${error.message}`);
    process.exitCode = 1;
});
