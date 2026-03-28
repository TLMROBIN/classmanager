#!/usr/bin/env node

const fs = require('fs');
const { execFileSync } = require('child_process');
const {
    ROOT_DIR,
    DEFAULT_ALERT_DIR,
    ensureDir,
    formatTimestamp,
    parseArgs,
    resolveInputPath,
    toRelativePath
} = require('./backup-utils');

const runCommand = (command, args) => {
    try {
        return execFileSync(command, args, { encoding: 'utf8' }).trim();
    } catch (error) {
        const stdout = error.stdout ? String(error.stdout) : '';
        const stderr = error.stderr ? String(error.stderr) : '';
        return [stdout, stderr].filter(Boolean).join('\n').trim();
    }
};

const escapeUnitForFile = (unit) => {
    return String(unit || 'unknown')
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-');
};

const main = () => {
    const args = parseArgs(process.argv.slice(2));
    const unit = args.unit || 'unknown';
    const reason = args.reason || 'service-failure';
    const isManualTest = reason === 'manual-test' || unit === 'manual-test';
    const alertDir = resolveInputPath(args['alert-dir'], DEFAULT_ALERT_DIR);

    ensureDir(alertDir);

    const createdAt = new Date();
    const timestamp = formatTimestamp(createdAt);
    const safeUnit = escapeUnitForFile(unit);
    const jsonPath = require('path').join(alertDir, `${timestamp}_${safeUnit}.json`);
    const latestPath = require('path').join(alertDir, 'latest-failure.json');
    const logPath = require('path').join(alertDir, 'failures.log');

    const systemctlShow = isManualTest
        ? 'manual-test'
        : runCommand('systemctl', [
            '--user',
            'show',
            unit,
            '--property=Id,Result,ExecMainStatus,ExecMainCode,ActiveState,SubState'
        ]);
    const recentJournal = isManualTest
        ? 'manual-test'
        : runCommand('journalctl', [
            '--user',
            '-u',
            unit,
            '-n',
            '30',
            '--no-pager',
            '--output=short-iso'
        ]);

    const payload = {
        createdAt: createdAt.toISOString(),
        unit,
        reason,
        cwd: ROOT_DIR,
        alertDir: toRelativePath(alertDir),
        systemctlShow,
        recentJournal
    };

    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.writeFileSync(latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.appendFileSync(
        logPath,
        `[${payload.createdAt}] unit=${unit} reason=${reason} detail=${systemctlShow.replace(/\n/g, ' | ')}\n`,
        'utf8'
    );

    const title = 'Classmanager 备份告警';
    const body = `${unit} 失败，详情已写入 ${toRelativePath(jsonPath)}`;

    try {
        execFileSync('/usr/bin/notify-send', [title, body], { stdio: 'ignore' });
    } catch (_) {}

    console.log('已记录备份失败告警');
    console.log(`- 单元: ${unit}`);
    console.log(`- 原因: ${reason}`);
    console.log(`- 详情文件: ${toRelativePath(jsonPath)}`);
    console.log(`- 最新告警: ${toRelativePath(latestPath)}`);
    console.log(`- 汇总日志: ${toRelativePath(logPath)}`);
};

try {
    main();
} catch (error) {
    console.error('❌ 备份告警记录失败');
    console.error(error.message);
    process.exit(1);
}
