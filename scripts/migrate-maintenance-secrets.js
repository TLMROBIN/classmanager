const Database = require('better-sqlite3');
const { hashPassword } = require('../utils/password');
const { dbPath, ensureSchema } = require('../database/schema');
const {
    stripLegacyAdminPasswordFromConfig,
    extractLegacyMaintenancePassword,
    shouldMigrateLegacyMaintenancePassword
} = require('../utils/config-security');

const args = process.argv.slice(2);

const hasFlag = (flag) => args.includes(flag);

const getArgValue = (name) => {
    const exact = args.find(arg => arg.startsWith(`${name}=`));
    if (exact) return exact.slice(name.length + 1);
    const index = args.findIndex(arg => arg === name);
    if (index >= 0 && args[index + 1]) return args[index + 1];
    return null;
};

const dryRun = hasFlag('--dry-run');
const adminPassword = getArgValue('--admin-password') || process.env.ADMIN_PASSWORD || null;

if (!dryRun && (!adminPassword || adminPassword.length < 8)) {
    console.error('❌ 迁移需要通过 --admin-password 或 ADMIN_PASSWORD 提供新的 admin 密码，且长度至少 8 个字符');
    process.exit(1);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
ensureSchema(db);

const users = db.prepare('SELECT id, username, role FROM users ORDER BY id ASC').all();
const adminUser = users.find(user => user.username === 'admin') || users.find(user => user.role === 'admin');

if (!adminUser) {
    console.error('❌ 未找到管理员账户，无法执行迁移');
    db.close();
    process.exit(1);
}

const getConfigRow = db.prepare('SELECT id, data_value FROM class_data WHERE user_id = ? AND data_key = ?');
const upsertConfig = db.prepare(`
    INSERT INTO class_data (user_id, data_key, data_value, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, data_key)
    DO UPDATE SET data_value = excluded.data_value, updated_at = CURRENT_TIMESTAMP
`);
const deleteClassData = db.prepare('DELETE FROM class_data WHERE user_id = ?');
const deleteMaintenanceCredential = db.prepare('DELETE FROM maintenance_credentials WHERE user_id = ?');
const getMaintenanceCredential = db.prepare('SELECT user_id FROM maintenance_credentials WHERE user_id = ?');
const insertMaintenanceCredential = db.prepare(`
    INSERT INTO maintenance_credentials (user_id, password_hash, migrated_from_legacy, updated_at)
    VALUES (?, ?, 1, CURRENT_TIMESTAMP)
`);
const updateAdminPassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');

const summary = {
    usersScanned: users.length,
    maintenanceMigrated: 0,
    maintenanceSkippedExisting: 0,
    legacyDefaultDiscarded: 0,
    configsSanitized: 0,
    adminRowsDeleted: 0,
    adminPasswordReset: false,
    parseErrors: 0
};

const transaction = db.transaction(() => {
    if (!dryRun) {
        deleteMaintenanceCredential.run(adminUser.id);
        const deletedRows = deleteClassData.run(adminUser.id);
        summary.adminRowsDeleted = Number(deletedRows.changes) || 0;
        updateAdminPassword.run(hashPassword(adminPassword), adminUser.id);
        summary.adminPasswordReset = true;
    } else {
        const adminRowCount = db.prepare('SELECT COUNT(*) AS count FROM class_data WHERE user_id = ?').get(adminUser.id);
        summary.adminRowsDeleted = Number(adminRowCount?.count) || 0;
    }

    users.forEach(user => {
        if (user.id === adminUser.id) return;
        const row = getConfigRow.get(user.id, 'config');
        if (!row) return;

        let parsedConfig = null;
        try {
            parsedConfig = JSON.parse(row.data_value);
        } catch (_) {
            summary.parseErrors += 1;
            return;
        }

        const legacyPassword = extractLegacyMaintenancePassword(parsedConfig);
        const sanitizedConfig = stripLegacyAdminPasswordFromConfig(parsedConfig);
        const configChanged = JSON.stringify(parsedConfig) !== JSON.stringify(sanitizedConfig);

        if (legacyPassword && shouldMigrateLegacyMaintenancePassword(legacyPassword)) {
            if (getMaintenanceCredential.get(user.id)) {
                summary.maintenanceSkippedExisting += 1;
            } else if (!dryRun) {
                insertMaintenanceCredential.run(user.id, hashPassword(legacyPassword));
                summary.maintenanceMigrated += 1;
            } else {
                summary.maintenanceMigrated += 1;
            }
        } else if (legacyPassword) {
            summary.legacyDefaultDiscarded += 1;
        }

        if (configChanged) {
            if (!dryRun) {
                upsertConfig.run(user.id, 'config', JSON.stringify(sanitizedConfig));
            }
            summary.configsSanitized += 1;
        }
    });
});

try {
    transaction();
    console.log(dryRun ? '✅ 安全迁移 dry-run 完成' : '✅ 安全迁移完成');
    console.log(`   扫描用户数: ${summary.usersScanned}`);
    console.log(`   迁移维护密码: ${summary.maintenanceMigrated}`);
    console.log(`   已存在维护密码，跳过覆盖: ${summary.maintenanceSkippedExisting}`);
    console.log(`   丢弃默认/空维护密码: ${summary.legacyDefaultDiscarded}`);
    console.log(`   已清理遗留明文配置: ${summary.configsSanitized}`);
    console.log(`   已删除 admin 业务数据行: ${summary.adminRowsDeleted}`);
    console.log(`   admin 密码已重置: ${summary.adminPasswordReset ? '是' : '否（dry-run）'}`);
    if (summary.parseErrors > 0) {
        console.log(`   配置解析失败: ${summary.parseErrors}`);
    }
} catch (error) {
    console.error(`❌ 迁移失败: ${error.message}`);
    process.exitCode = 1;
} finally {
    db.close();
}
