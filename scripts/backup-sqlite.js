#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const {
    DEFAULT_BACKUP_DIR,
    DEFAULT_DB_PATH,
    ensureDir,
    parseArgs,
    fileExists,
    safeUnlink,
    formatTimestamp,
    resolveInputPath,
    sanitizeLabel,
    toRelativePath,
    computeFileSha256,
    runIntegrityCheck,
    manifestPathForBackup,
    readSourceSidecarStats
} = require('./backup-utils');

const buildBackupName = (timestamp, label) => {
    return `classmanager_${timestamp}${label ? `_${label}` : ''}`;
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    const sourceDbPath = resolveInputPath(args.db, DEFAULT_DB_PATH);
    const outputDir = resolveInputPath(args['out-dir'], DEFAULT_BACKUP_DIR);
    const label = sanitizeLabel(args.label);

    if (!fileExists(sourceDbPath)) {
        throw new Error(`数据库文件不存在: ${sourceDbPath}`);
    }

    ensureDir(outputDir);

    const startedAt = new Date();
    const startedTime = Date.now();
    const timestamp = formatTimestamp(startedAt);
    const backupName = buildBackupName(timestamp, label);
    const tempBackupPath = path.join(outputDir, `${backupName}.tmp.db`);
    const finalBackupPath = path.join(outputDir, `${backupName}.db`);

    if (fileExists(tempBackupPath) || fileExists(finalBackupPath)) {
        throw new Error(`备份文件已存在，请稍后重试: ${backupName}`);
    }

    let sourceDb;
    try {
        sourceDb = new Database(sourceDbPath, {
            readonly: true,
            fileMustExist: true,
            timeout: 5000
        });

        console.log('开始执行 SQLite 在线备份...');
        console.log(`- 源库: ${toRelativePath(sourceDbPath)}`);
        console.log(`- 输出目录: ${toRelativePath(outputDir)}`);

        await sourceDb.backup(tempBackupPath);
    } finally {
        if (sourceDb) sourceDb.close();
    }

    try {
        const verification = runIntegrityCheck(tempBackupPath);
        if (!verification.ok) {
            throw new Error(`备份完整性校验失败:\n${verification.integrity}`);
        }

        const sha256 = await computeFileSha256(tempBackupPath);
        fs.renameSync(tempBackupPath, finalBackupPath);

        const backupStats = fs.statSync(finalBackupPath);
        const completedAt = new Date();
        const manifest = {
            type: 'sqlite-online-backup',
            createdAt: startedAt.toISOString(),
            completedAt: completedAt.toISOString(),
            durationMs: Date.now() - startedTime,
            sourceDbPath: toRelativePath(sourceDbPath),
            backupPath: toRelativePath(finalBackupPath),
            sizeBytes: backupStats.size,
            sha256,
            integrityCheck: verification.integrity,
            pageCount: verification.pageCount,
            rowCounts: {
                users: verification.userCount,
                class_data: verification.classDataCount
            },
            sourceFiles: readSourceSidecarStats(sourceDbPath)
        };

        fs.writeFileSync(
            manifestPathForBackup(finalBackupPath),
            `${JSON.stringify(manifest, null, 2)}\n`,
            'utf8'
        );

        console.log('✅ SQLite 在线备份完成');
        console.log(`- 备份文件: ${toRelativePath(finalBackupPath)}`);
        console.log(`- 校验结果: ${verification.integrity}`);
        console.log(`- 文件大小: ${backupStats.size} bytes`);
        console.log(`- SHA256: ${sha256}`);
        safeUnlink(`${tempBackupPath}-wal`);
        safeUnlink(`${tempBackupPath}-shm`);
    } catch (error) {
        safeUnlink(tempBackupPath);
        safeUnlink(finalBackupPath);
        safeUnlink(`${tempBackupPath}-wal`);
        safeUnlink(`${tempBackupPath}-shm`);
        throw error;
    }
};

main().catch((error) => {
    console.error('❌ 备份失败');
    console.error(error.message);
    process.exit(1);
});
