#!/usr/bin/env node

const {
    DEFAULT_BACKUP_DIR,
    parseArgs,
    resolveInputPath,
    toRelativePath,
    readBackupEntries,
    safeUnlink,
    isoWeekKey
} = require('./backup-utils');

const dayKey = (date) => date.toISOString().slice(0, 10);
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const collectKeepKeys = (entries, limit, keyBuilder) => {
    const keep = new Set();
    const seen = new Set();

    for (const entry of entries) {
        const key = keyBuilder(entry.date);
        if (seen.has(key)) continue;
        seen.add(key);
        keep.add(entry.filePath);
        if (seen.size >= limit) break;
    }

    return keep;
};

const main = () => {
    const args = parseArgs(process.argv.slice(2));
    const backupDir = resolveInputPath(args.dir, DEFAULT_BACKUP_DIR);
    const apply = Boolean(args.apply);
    const entries = readBackupEntries(backupDir);

    if (entries.length === 0) {
        console.log(`没有找到可清理的备份文件: ${toRelativePath(backupDir)}`);
        return;
    }

    const keepDaily = collectKeepKeys(entries, 7, dayKey);
    const keepWeekly = collectKeepKeys(entries, 4, isoWeekKey);
    const keepMonthly = collectKeepKeys(entries, 3, monthKey);
    const keepLatest = new Set(entries.slice(0, 1).map((entry) => entry.filePath));

    const keepAll = new Set([
        ...keepDaily,
        ...keepWeekly,
        ...keepMonthly,
        ...keepLatest
    ]);

    const toDelete = entries.filter((entry) => !keepAll.has(entry.filePath));

    console.log(`备份目录: ${toRelativePath(backupDir)}`);
    console.log(`- 总备份数: ${entries.length}`);
    console.log(`- 保留数: ${keepAll.size}`);
    console.log(`- 待清理数: ${toDelete.length}`);
    console.log(`- 模式: ${apply ? 'apply' : 'dry-run'}`);

    if (toDelete.length === 0) {
        console.log('没有需要清理的旧备份。');
        return;
    }

    for (const entry of toDelete) {
        console.log(`- ${apply ? '删除' : '预览删除'}: ${toRelativePath(entry.filePath)}`);
        if (!apply) continue;
        safeUnlink(entry.filePath);
        safeUnlink(entry.manifestPath);
    }

    if (!apply) {
        console.log('提示: 使用 --apply 执行实际删除。');
    }
};

try {
    main();
} catch (error) {
    console.error('❌ 清理失败');
    console.error(error.message);
    process.exit(1);
}
