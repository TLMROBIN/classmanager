#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    DEFAULT_BACKUP_DIR,
    DEFAULT_DB_PATH,
    parseArgs,
    resolveInputPath,
    toRelativePath,
    computeFileSha256,
    runIntegrityCheck,
    manifestPathForBackup,
    readBackupEntries,
    fileExists,
    safeUnlink
} = require('./backup-utils');

const pickLatestBackup = (dirPath) => {
    const entries = readBackupEntries(dirPath);
    return entries.length > 0 ? entries[0] : null;
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    const backupDir = resolveInputPath(args.dir, DEFAULT_BACKUP_DIR);
    const explicitFile = args.file ? resolveInputPath(args.file, DEFAULT_DB_PATH) : null;
    const latest = explicitFile ? null : pickLatestBackup(backupDir);
    const targetPath = explicitFile || (latest ? latest.filePath : null);

    if (!targetPath) {
        throw new Error(`未找到可校验的备份文件: ${toRelativePath(backupDir)}`);
    }

    if (!fileExists(targetPath)) {
        throw new Error(`目标文件不存在: ${targetPath}`);
    }

    const verification = runIntegrityCheck(targetPath);
    const sha256 = await computeFileSha256(targetPath);
    const stats = fs.statSync(targetPath);
    const relativeToBackupDir = path.relative(backupDir, targetPath);
    const isInsideBackupDir = relativeToBackupDir && !relativeToBackupDir.startsWith('..') && !path.isAbsolute(relativeToBackupDir);

    console.log('备份校验结果');
    console.log(`- 文件: ${toRelativePath(targetPath)}`);
    console.log(`- 大小: ${stats.size} bytes`);
    console.log(`- 完整性: ${verification.integrity}`);
    console.log(`- page_count: ${verification.pageCount}`);
    console.log(`- users: ${verification.userCount == null ? 'N/A' : verification.userCount}`);
    console.log(`- class_data: ${verification.classDataCount == null ? 'N/A' : verification.classDataCount}`);
    console.log(`- SHA256: ${sha256}`);

    if (isInsideBackupDir || args['cleanup-sidecars']) {
        safeUnlink(`${targetPath}-wal`);
        safeUnlink(`${targetPath}-shm`);
    }

    if (args['write-manifest']) {
        const manifest = {
            type: 'sqlite-backup-verification',
            verifiedAt: new Date().toISOString(),
            backupPath: toRelativePath(targetPath),
            sizeBytes: stats.size,
            sha256,
            integrityCheck: verification.integrity,
            pageCount: verification.pageCount,
            rowCounts: {
                users: verification.userCount,
                class_data: verification.classDataCount
            }
        };

        fs.writeFileSync(
            manifestPathForBackup(targetPath),
            `${JSON.stringify(manifest, null, 2)}\n`,
            'utf8'
        );

        console.log(`- 已写入校验清单: ${toRelativePath(manifestPathForBackup(targetPath))}`);
    }

    if (!verification.ok) {
        process.exit(1);
    }
};

main().catch((error) => {
    console.error('❌ 备份校验失败');
    console.error(error.message);
    process.exit(1);
});
