const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const ROOT_DIR = path.resolve(__dirname, '..');
const resolveConfiguredPath = (configuredPath, fallbackPath) => {
    if (!configuredPath) return fallbackPath;
    return path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(process.cwd(), configuredPath);
};
const DEFAULT_DB_PATH = resolveConfiguredPath(
    process.env.CLASSMANAGER_DB_PATH,
    path.join(ROOT_DIR, 'database', 'classmanager.db')
);
const DEFAULT_BACKUP_DIR = resolveConfiguredPath(
    process.env.CLASSMANAGER_BACKUP_DIR,
    path.join(ROOT_DIR, 'backups', 'sqlite')
);

const pad2 = (value) => String(value).padStart(2, '0');

const formatTimestamp = (date = new Date()) => {
    return [
        date.getFullYear(),
        pad2(date.getMonth() + 1),
        pad2(date.getDate())
    ].join('') + '_' + [
        pad2(date.getHours()),
        pad2(date.getMinutes()),
        pad2(date.getSeconds())
    ].join('');
};

const toRelativePath = (targetPath) => {
    return path.relative(ROOT_DIR, targetPath) || '.';
};

const resolveInputPath = (inputPath, fallbackPath) => {
    const target = inputPath || fallbackPath;
    return path.isAbsolute(target) ? target : path.resolve(ROOT_DIR, target);
};

const ensureDir = (dirPath) => {
    fs.mkdirSync(dirPath, { recursive: true });
};

const sanitizeLabel = (label) => {
    if (!label) return '';
    return String(label)
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-_.]+|[-_.]+$/g, '');
};

const parseArgs = (argv) => {
    const args = { _: [] };

    for (let index = 0; index < argv.length; index += 1) {
        const current = argv[index];
        if (!current.startsWith('--')) {
            args._.push(current);
            continue;
        }

        const normalized = current.slice(2);
        const equalIndex = normalized.indexOf('=');
        if (equalIndex >= 0) {
            const key = normalized.slice(0, equalIndex);
            const value = normalized.slice(equalIndex + 1);
            args[key] = value;
            continue;
        }

        const next = argv[index + 1];
        if (next && !next.startsWith('--')) {
            args[normalized] = next;
            index += 1;
            continue;
        }

        args[normalized] = true;
    }

    return args;
};

const fileExists = (filePath) => {
    try {
        fs.accessSync(filePath, fs.constants.F_OK);
        return true;
    } catch (_) {
        return false;
    }
};

const safeUnlink = (filePath) => {
    if (fileExists(filePath)) {
        fs.unlinkSync(filePath);
    }
};

const computeFileSha256 = (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
};

const safeTableCount = (db, tableName) => {
    try {
        const row = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get();
        return row ? row.count : null;
    } catch (_) {
        return null;
    }
};

const runIntegrityCheck = (dbPath) => {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true, timeout: 5000 });

    try {
        const integrityRows = db.prepare('PRAGMA integrity_check').pluck().all();
        const integrity = integrityRows.join('\n');
        const pageCount = db.pragma('page_count', { simple: true });
        const userCount = safeTableCount(db, 'users');
        const classDataCount = safeTableCount(db, 'class_data');

        return {
            ok: integrityRows.length === 1 && integrityRows[0] === 'ok',
            integrity,
            pageCount,
            userCount,
            classDataCount
        };
    } finally {
        db.close();
    }
};

const manifestPathForBackup = (backupPath) => {
    return backupPath.replace(/\.db$/i, '.manifest.json');
};

const timestampToDate = (timestamp) => {
    const match = timestamp.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
    if (!match) return null;

    const [, year, month, day, hour, minute, second] = match;
    const date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
    );

    return Number.isNaN(date.getTime()) ? null : date;
};

const parseBackupFilename = (fileName) => {
    const match = fileName.match(/^classmanager_(\d{8}_\d{6})(?:_[a-zA-Z0-9._-]+)?\.db$/);
    if (!match) return null;

    const timestamp = match[1];
    const date = timestampToDate(timestamp);
    if (!date) return null;

    return { timestamp, date };
};

const isoWeekKey = (date) => {
    const target = new Date(date.getTime());
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + 4 - (target.getDay() || 7));
    const yearStart = new Date(target.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
    return `${target.getFullYear()}-W${pad2(weekNo)}`;
};

const readBackupEntries = (dirPath) => {
    if (!fileExists(dirPath)) return [];

    return fs.readdirSync(dirPath)
        .filter((fileName) => fileName.endsWith('.db'))
        .map((fileName) => {
            const parsed = parseBackupFilename(fileName);
            if (!parsed) return null;
            const fullPath = path.join(dirPath, fileName);
            const stats = fs.statSync(fullPath);

            return {
                fileName,
                filePath: fullPath,
                manifestPath: manifestPathForBackup(fullPath),
                timestamp: parsed.timestamp,
                date: parsed.date,
                mtimeMs: stats.mtimeMs,
                sizeBytes: stats.size
            };
        })
        .filter(Boolean)
        .sort((left, right) => right.date.getTime() - left.date.getTime());
};

const readSourceSidecarStats = (dbPath) => {
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    const candidates = [
        { kind: 'db', filePath: dbPath },
        { kind: 'wal', filePath: walPath },
        { kind: 'shm', filePath: shmPath }
    ];

    return candidates.map(({ kind, filePath }) => {
        if (!fileExists(filePath)) {
            return { kind, path: toRelativePath(filePath), exists: false, sizeBytes: 0 };
        }

        const stats = fs.statSync(filePath);
        return {
            kind,
            path: toRelativePath(filePath),
            exists: true,
            sizeBytes: stats.size,
            mtime: stats.mtime.toISOString()
        };
    });
};

module.exports = {
    ROOT_DIR,
    DEFAULT_DB_PATH,
    DEFAULT_BACKUP_DIR,
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
    readBackupEntries,
    isoWeekKey,
    readSourceSidecarStats
};
