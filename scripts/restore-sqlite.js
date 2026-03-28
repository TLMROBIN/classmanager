#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const {
    ROOT_DIR,
    DEFAULT_DB_PATH,
    DEFAULT_BACKUP_DIR,
    DEFAULT_RECOVERY_DIR,
    ensureDir,
    parseArgs,
    fileExists,
    safeUnlink,
    formatTimestamp,
    resolveInputPath,
    toRelativePath,
    runIntegrityCheck,
    readBackupEntries
} = require('./backup-utils');
const isWindows = process.platform === 'win32';

const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes < 0) return '未知';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDateTime = (date) => {
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);
};

const normalizeBoolean = (value, fallback) => {
    if (value == null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['y', 'yes', 'true', '1', '是'].includes(normalized)) return true;
    if (['n', 'no', 'false', '0', '否'].includes(normalized)) return false;
    return fallback;
};

const ask = (rl, question) => {
    return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
};

const confirm = async (rl, message, defaultYes = true) => {
    const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
    const answer = await ask(rl, `${message}${suffix}`);
    return normalizeBoolean(answer, defaultYes);
};

const runCommand = (command, args, dryRun) => {
    const display = `${command} ${args.join(' ')}`.trim();
    if (dryRun) {
        console.log(`- [dry-run] ${display}`);
        return;
    }

    const result = spawnSync(command, args, {
        cwd: ROOT_DIR,
        stdio: 'inherit',
        shell: false
    });

    if (result.status !== 0) {
        throw new Error(`命令执行失败: ${display}`);
    }
};

const runLifecycleScript = (scriptName, dryRun) => {
    if (isWindows) {
        runCommand('cmd.exe', ['/c', scriptName], dryRun);
    } else {
        runCommand('/bin/bash', [scriptName], dryRun);
    }
};

const resolveLifecycleScript = (baseName) => {
    return path.join(ROOT_DIR, `${baseName}.${isWindows ? 'bat' : 'sh'}`);
};

const printBackupList = (entries) => {
    console.log('\n可用备份：');
    entries.forEach((entry, index) => {
        console.log(
            `  ${index + 1}. ${entry.fileName} | ${formatDateTime(entry.date)} | ${formatBytes(entry.sizeBytes)}`
        );
    });
};

const chooseBackup = async (rl, entries, explicitFile, autoYes) => {
    if (explicitFile) {
        const stats = fs.statSync(explicitFile);
        return {
            fileName: path.basename(explicitFile),
            filePath: explicitFile,
            sizeBytes: stats.size,
            date: stats.mtime
        };
    }

    if (entries.length === 0) {
        throw new Error('未找到可恢复的备份文件。');
    }

    printBackupList(entries);

    if (autoYes) {
        return entries[0];
    }

    while (true) {
        const answer = await ask(rl, `\n请选择要恢复的备份序号 [默认 1]：`);
        const selectedIndex = answer ? Number(answer) : 1;

        if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > entries.length) {
            console.log('输入无效，请重新输入有效序号。');
            continue;
        }

        return entries[selectedIndex - 1];
    }
};

const copyFileWithLog = (source, target, dryRun) => {
    console.log(`- ${toRelativePath(source)} -> ${toRelativePath(target)}`);
    if (!dryRun) {
        fs.copyFileSync(source, target);
    }
};

const createSafetySnapshot = (dbPath, recoveryDir, dryRun) => {
    const timestamp = formatTimestamp(new Date());
    const snapshotTargets = [
        { source: dbPath, suffix: 'db' },
        { source: `${dbPath}-wal`, suffix: 'db-wal' },
        { source: `${dbPath}-shm`, suffix: 'db-shm' }
    ].filter((item) => fileExists(item.source));

    if (snapshotTargets.length === 0) {
        console.log('- 当前没有可封存的数据库现场文件');
        return [];
    }

    ensureDir(recoveryDir);
    const saved = [];

    console.log('\n封存当前现场到安全目录：');
    for (const item of snapshotTargets) {
        const fileName = `${path.basename(dbPath)}.${timestamp}.${item.suffix}`;
        const target = path.join(recoveryDir, fileName);
        copyFileWithLog(item.source, target, dryRun);
        saved.push(target);
    }

    return saved;
};

const verifyDatabaseFile = (dbFilePath) => {
    const verification = runIntegrityCheck(dbFilePath);
    if (!verification.ok) {
        throw new Error(`完整性校验失败：\n${verification.integrity}`);
    }
    return verification;
};

const restoreBackup = (backupPath, dbPath, dryRun) => {
    console.log('\n恢复备份到主库：');
    copyFileWithLog(backupPath, dbPath, dryRun);

    console.log('- 删除旧的 WAL/SHM 边车文件');
    if (!dryRun) {
        safeUnlink(`${dbPath}-wal`);
        safeUnlink(`${dbPath}-shm`);
    }
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    const dryRun = Boolean(args['dry-run']);
    const autoYes = Boolean(args.yes);
    const skipStart = Boolean(args['skip-start']);
    const skipStop = Boolean(args['skip-stop']);

    const dbPath = resolveInputPath(args.db, DEFAULT_DB_PATH);
    const backupDir = resolveInputPath(args['backup-dir'], DEFAULT_BACKUP_DIR);
    const recoveryDir = resolveInputPath(args['recovery-dir'], DEFAULT_RECOVERY_DIR);
    const explicitFile = args.file ? resolveInputPath(args.file, DEFAULT_BACKUP_DIR) : null;

    const stopScript = resolveLifecycleScript('stop');
    const startScript = resolveLifecycleScript('start');

    if (!fileExists(stopScript)) {
        throw new Error(`未找到停服脚本：${stopScript}`);
    }

    if (!fileExists(startScript)) {
        throw new Error(`未找到启动脚本：${startScript}`);
    }

    if (!fileExists(backupDir)) {
        throw new Error(`备份目录不存在：${backupDir}`);
    }

    if (explicitFile && !fileExists(explicitFile)) {
        throw new Error(`指定的备份文件不存在：${explicitFile}`);
    }

    const backupEntries = explicitFile ? [] : readBackupEntries(backupDir);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        console.log('==========================================');
        console.log('  SQLite 交互式恢复向导');
        console.log('==========================================');
        console.log(`- 模式: ${dryRun ? 'dry-run（只演练，不写文件）' : '正式恢复'}`);
        console.log(`- 主库: ${toRelativePath(dbPath)}`);
        console.log(`- 备份目录: ${toRelativePath(backupDir)}`);
        console.log(`- 安全封存目录: ${toRelativePath(recoveryDir)}`);

        const selectedBackup = await chooseBackup(rl, backupEntries, explicitFile, autoYes);

        console.log('\n已选择备份：');
        console.log(`- 文件: ${toRelativePath(selectedBackup.filePath)}`);
        console.log(`- 时间: ${formatDateTime(selectedBackup.date)}`);
        console.log(`- 大小: ${formatBytes(selectedBackup.sizeBytes)}`);

        if (!autoYes) {
            const proceed = await confirm(rl, '确认用这份备份继续恢复吗？', true);
            if (!proceed) {
                console.log('已取消恢复。');
                return;
            }
        }

        console.log('\n校验所选备份文件...');
        const selectedVerification = verifyDatabaseFile(selectedBackup.filePath);
        console.log(`- 校验结果: ${selectedVerification.integrity}`);

        const continueRestore = autoYes
            ? true
            : await confirm(rl, '确认开始执行恢复流程？这会覆盖当前主库。', false);

        if (!continueRestore) {
            console.log('已取消恢复。');
            return;
        }

        if (!skipStop) {
            console.log('\n停止当前服务...');
            runLifecycleScript(stopScript, dryRun);
        } else {
            console.log('\n- 已跳过停服步骤');
        }

        createSafetySnapshot(dbPath, recoveryDir, dryRun);
        restoreBackup(selectedBackup.filePath, dbPath, dryRun);

        if (!dryRun) {
            console.log('\n校验恢复后的主库...');
            const restoredVerification = verifyDatabaseFile(dbPath);
            console.log(`- 校验结果: ${restoredVerification.integrity}`);
        } else {
            console.log('\n- [dry-run] 已跳过恢复后主库完整性校验');
        }

        let shouldStart = !skipStart;
        if (!skipStart && !autoYes) {
            shouldStart = await confirm(rl, '是否现在启动服务？', true);
        }

        if (shouldStart && !skipStart) {
            console.log('\n启动服务...');
            runLifecycleScript(startScript, dryRun);
        } else if (skipStart) {
            console.log('\n- 已按参数跳过启动步骤');
        } else {
            console.log('\n- 你选择了暂不启动服务');
        }

        console.log('\n==========================================');
        console.log(`✅ 恢复流程${dryRun ? '演练完成' : '完成'}`);
        console.log('==========================================');
        console.log(`- 使用备份: ${toRelativePath(selectedBackup.filePath)}`);
        console.log(`- 主库位置: ${toRelativePath(dbPath)}`);
        console.log(`- 安全封存目录: ${toRelativePath(recoveryDir)}`);
    } finally {
        rl.close();
    }
};

main().catch((error) => {
    console.error('❌ 恢复流程失败');
    console.error(error.message);
    process.exit(1);
});
