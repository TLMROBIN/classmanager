#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const Database = require('better-sqlite3');
const {
    DEFAULT_BACKUP_DIR,
    DEFAULT_DB_PATH,
    parseArgs,
    resolveInputPath,
    toRelativePath,
    fileExists
} = require('./backup-utils');
const { ensureSchema } = require('../database/schema');
const {
    VALID_DEPLOYMENT_MODES
} = require('../kernel/auth-adapter');
const {
    migrateDatabaseV1ToV2,
    verifyV1ToV2Migration
} = require('../kernel/migrate-v1-to-v2');

const printHelp = () => {
    console.log('ClassManager V1 -> V2 (阶段 0) 无损迁移工具');
    console.log('');
    console.log('用法:');
    console.log('  node scripts/migrate-v1-to-v2.js [选项]');
    console.log('');
    console.log('选项:');
    console.log('  --db <路径>             目标 SQLite 数据库路径（默认读 CLASSMANAGER_DB_PATH）');
    console.log('  --mode <school|personal> 部署模式（默认 personal，校内服务器推荐 school）');
    console.log('  --school-name <名称>    校园模式学校名称（可选）');
    console.log('  --backup-dir <路径>     迁移前备份输出目录');
    console.log('  --dry-run               在临时副本上演练迁移与对账，绝不改动源数据库');
    console.log('  --verify-only           仅执行 V1/V2 对账校验，不执行写入');
    console.log('  --skip-backup           跳过迁移前自动备份（仅限测试环境）');
    console.log('  --json                  以 JSON 格式输出最终报告');
    console.log('  --help                  显示此帮助');
};

const runPreMigrationBackup = (targetDbPath, backupDir) => {
    const backupScript = path.join(__dirname, 'backup-sqlite.js');
    const result = spawnSync(
        process.execPath,
        [backupScript, '--db', targetDbPath, '--out-dir', backupDir, '--label', 'pre-v2-migration'],
        {
            cwd: path.resolve(__dirname, '..'),
            stdio: 'inherit',
            shell: false
        }
    );
    if (result.status !== 0) {
        throw new Error(`迁移前备份失败（exit=${result.status}），已中止迁移`);
    }
};

const copyDbOnlineForDryRun = async (sourcePath, tempCopyPath) => {
    const sourceDb = new Database(sourcePath, {
        readonly: true,
        fileMustExist: true,
        timeout: 5000
    });
    try {
        await sourceDb.backup(tempCopyPath);
    } finally {
        sourceDb.close();
    }
};

const printReport = ({ dryRun, verifyOnly, targetDbPath, mode, migrationResult, verification }) => {
    console.log('\n==========================================');
    console.log(
        verifyOnly
            ? '  V1/V2 数据对账校验报告'
            : dryRun
                ? '  V1 -> V2 迁移演练报告 (dry-run)'
                : '  V1 -> V2 无损迁移完成报告'
    );
    console.log('==========================================');
    console.log(`- 数据库: ${toRelativePath(targetDbPath)}`);
    console.log(`- 部署模式: ${verification.deployment?.mode || mode}`);
    console.log(`- 完整性检查: ${verification.integrity}`);
    console.log(`- 外键异常数: ${verification.foreignKeyViolations.length}`);

    if (migrationResult?.users?.length) {
        console.log('\n迁移明细:');
        migrationResult.users.forEach((u) => {
            if (u.status === 'skipped_already_migrated') {
                console.log(`  - ${u.username}#${u.userId} (${u.classId}): 已迁移，跳过`);
            } else {
                console.log(
                    `  - ${u.username}#${u.userId} -> ${u.classId} | 在籍学生=${u.activeStudentCount} | 归档学生=${u.archivedStudentCount} | 账本=${u.ledgerCount} | 考试=${u.examCount} | 插件域=${u.pluginStorageMigratedCount}`
                );
            }
        });
    }

    if (verification.users.length > 0) {
        console.log('\n逐班对账结果:');
        verification.users.forEach((u) => {
            const totals = u.totals
                ? ` | 自在值=${u.totals.zizai}, 不自在值=${u.totals.penalty}, 余额=${u.totals.balance}`
                : '';
            console.log(`  - ${u.username}#${u.userId} [${u.status}]: 学生=${u.studentCount}, 流水=${u.historyCount}${totals}`);
        });
    }

    if (!verification.ok) {
        console.error('\n❌ 对账发现以下问题:');
        verification.errors.forEach((err) => console.error(`  - ${err}`));
    } else {
        console.log('\n✅ 全部核对项 100% 一致（零误差）');
    }
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const dryRun = Boolean(args['dry-run']);
    const verifyOnly = Boolean(args['verify-only']);
    const skipBackup = Boolean(args['skip-backup']);
    const jsonMode = Boolean(args.json);
    const mode = String(args.mode || 'personal').trim().toLowerCase();
    const schoolName = typeof args['school-name'] === 'string' ? args['school-name'].trim() : null;

    if (!VALID_DEPLOYMENT_MODES.has(mode)) {
        throw new Error(`无效的 --mode 参数: ${mode}，仅支持 school 或 personal`);
    }

    const targetDbPath = resolveInputPath(args.db, DEFAULT_DB_PATH);
    const backupDir = resolveInputPath(args['backup-dir'], DEFAULT_BACKUP_DIR);

    if (!fileExists(targetDbPath)) {
        throw new Error(`数据库文件不存在: ${targetDbPath}`);
    }

    let workingDbPath = targetDbPath;
    let tempDir = null;
    let migrationResult = null;
    let verification = null;

    try {
        if (dryRun) {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-v2-dryrun-'));
            workingDbPath = path.join(tempDir, 'dryrun.db');
            await copyDbOnlineForDryRun(targetDbPath, workingDbPath);
        } else if (!verifyOnly && !skipBackup) {
            runPreMigrationBackup(targetDbPath, backupDir);
        }

        const db = new Database(workingDbPath, {
            readonly: verifyOnly && !dryRun,
            fileMustExist: true,
            timeout: 5000
        });
        db.pragma('foreign_keys = ON');
        if (!(verifyOnly && !dryRun)) {
            db.pragma('journal_mode = WAL');
            ensureSchema(db);
        }

        try {
            if (!verifyOnly) {
                migrationResult = migrateDatabaseV1ToV2(db, {
                    mode,
                    schoolName
                });
            }
            verification = verifyV1ToV2Migration(db);
        } finally {
            db.close();
        }

        if (jsonMode) {
            console.log(JSON.stringify({
                dryRun,
                verifyOnly,
                targetDbPath,
                migrationResult,
                verification
            }, null, 2));
        } else {
            printReport({
                dryRun,
                verifyOnly,
                targetDbPath,
                mode,
                migrationResult,
                verification
            });
        }

        if (!verification.ok) {
            process.exitCode = 1;
        }
    } finally {
        if (tempDir) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
};

main().catch((error) => {
    console.error('❌ V2 迁移失败:', error.message);
    process.exit(1);
});
