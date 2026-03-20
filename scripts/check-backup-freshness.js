#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
    ROOT_DIR,
    DEFAULT_BACKUP_DIR,
    ensureDir,
    formatTimestamp,
    parseArgs,
    resolveInputPath,
    toRelativePath,
    readBackupEntries
} = require('./backup-utils');

const DEFAULT_MAX_AGE_HOURS = 36;
const DEFAULT_ALERT_DIR = path.join(ROOT_DIR, 'backups', 'alerts');

const roundHours = (hours) => Math.round(hours * 100) / 100;

const safeName = (value) => String(value)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-');

const tryNotify = (title, body) => {
    try {
        execFileSync('/usr/bin/notify-send', [title, body], { stdio: 'ignore' });
    } catch (_) {}
};

const writeAlert = ({ reason, summary, detail, backupDir, alertDir, maxAgeHours, latestEntry, ageHours }) => {
    ensureDir(alertDir);

    const createdAt = new Date();
    const timestamp = formatTimestamp(createdAt);
    const safeReason = safeName(reason);
    const jsonPath = path.join(alertDir, `${timestamp}_${safeReason}.json`);
    const latestPath = path.join(alertDir, 'latest-stale-backup.json');
    const logPath = path.join(alertDir, 'stale-backups.log');

    const payload = {
        createdAt: createdAt.toISOString(),
        unit: 'classmanager-backup-freshness.service',
        reason,
        summary,
        detail,
        cwd: ROOT_DIR,
        backupDir: toRelativePath(backupDir),
        alertDir: toRelativePath(alertDir),
        thresholdHours: maxAgeHours,
        latestBackup: latestEntry ? {
            filePath: toRelativePath(latestEntry.filePath),
            timestamp: latestEntry.timestamp,
            sizeBytes: latestEntry.sizeBytes
        } : null,
        latestBackupAgeHours: ageHours == null ? null : roundHours(ageHours)
    };

    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.writeFileSync(latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.appendFileSync(
        logPath,
        `[${payload.createdAt}] reason=${reason} summary=${summary} latest=${payload.latestBackup ? payload.latestBackup.filePath : 'none'} ageHours=${payload.latestBackupAgeHours == null ? 'n/a' : payload.latestBackupAgeHours}\n`,
        'utf8'
    );

    tryNotify('Classmanager 备份过期告警', `${summary}，详情见 ${toRelativePath(jsonPath)}`);

    console.log('已记录备份过期告警');
    console.log(`- 原因: ${reason}`);
    console.log(`- 详情文件: ${toRelativePath(jsonPath)}`);
    console.log(`- 最新告警: ${toRelativePath(latestPath)}`);
    console.log(`- 汇总日志: ${toRelativePath(logPath)}`);
};

const main = () => {
    const args = parseArgs(process.argv.slice(2));
    const backupDir = resolveInputPath(args.dir, DEFAULT_BACKUP_DIR);
    const alertDir = resolveInputPath(args['alert-dir'], DEFAULT_ALERT_DIR);
    const rawMaxAge = args['max-age-hours'] == null ? DEFAULT_MAX_AGE_HOURS : Number(args['max-age-hours']);

    if (!Number.isFinite(rawMaxAge) || rawMaxAge <= 0) {
        throw new Error(`无效的 max-age-hours: ${args['max-age-hours']}`);
    }

    const entries = readBackupEntries(backupDir);
    if (entries.length === 0) {
        writeAlert({
            reason: 'missing-backup',
            summary: '未找到任何 SQLite 备份文件',
            detail: '备份目录为空，或没有匹配 classmanager_*.db 的文件',
            backupDir,
            alertDir,
            maxAgeHours: rawMaxAge,
            latestEntry: null,
            ageHours: null
        });
        process.exit(1);
    }

    const latestEntry = entries[0];
    const ageMs = Date.now() - latestEntry.date.getTime();
    const ageHours = ageMs / (60 * 60 * 1000);

    console.log('备份新鲜度检查');
    console.log(`- 备份目录: ${toRelativePath(backupDir)}`);
    console.log(`- 最新备份: ${toRelativePath(latestEntry.filePath)}`);
    console.log(`- 备份时间: ${latestEntry.date.toISOString()}`);
    console.log(`- 备份年龄: ${roundHours(ageHours)} 小时`);
    console.log(`- 阈值: ${rawMaxAge} 小时`);

    if (ageHours <= rawMaxAge) {
        console.log('✅ 备份仍在新鲜度阈值内');
        return;
    }

    writeAlert({
        reason: 'stale-backup',
        summary: 'SQLite 备份超过新鲜度阈值',
        detail: `最新备份已超过 ${rawMaxAge} 小时未更新`,
        backupDir,
        alertDir,
        maxAgeHours: rawMaxAge,
        latestEntry,
        ageHours
    });
    process.exit(1);
};

try {
    main();
} catch (error) {
    console.error('❌ 备份新鲜度检查失败');
    console.error(error.message);
    process.exit(1);
}
