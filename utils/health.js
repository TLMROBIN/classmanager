const {
    DEFAULT_BACKUP_DIR,
    readBackupEntries,
    readSourceSidecarStats,
    toRelativePath
} = require('../scripts/backup-utils');

const DEFAULT_BACKUP_MAX_AGE_HOURS = 36;

const normalizeBackupMaxAgeHours = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0
        ? parsed
        : DEFAULT_BACKUP_MAX_AGE_HOURS;
};

const buildDatabaseHealth = ({ db, dbPath }) => {
    try {
        db.prepare('SELECT 1 AS ok').get();
        const journalMode = db.pragma('journal_mode', { simple: true });
        const foreignKeys = db.pragma('foreign_keys', { simple: true });
        const userCount = Number(db.prepare('SELECT COUNT(*) AS count FROM users').get()?.count) || 0;

        return {
            ok: true,
            path: toRelativePath(dbPath),
            journalMode: String(journalMode || ''),
            foreignKeysEnabled: Boolean(foreignKeys),
            userCount,
            sidecars: readSourceSidecarStats(dbPath)
        };
    } catch (error) {
        return {
            ok: false,
            path: toRelativePath(dbPath),
            error: error.message || 'SQLite 状态检查失败'
        };
    }
};

const buildBackupHealth = ({ backupDir, maxAgeHours, nowMs }) => {
    try {
        const entries = readBackupEntries(backupDir);
        if (entries.length === 0) {
            return {
                ok: false,
                status: 'missing',
                directory: toRelativePath(backupDir),
                maxAgeHours,
                latest: null,
                ageHours: null
            };
        }

        const latest = entries[0];
        const ageHours = Math.round(((nowMs - latest.date.getTime()) / (60 * 60 * 1000)) * 100) / 100;
        const ok = ageHours <= maxAgeHours;

        return {
            ok,
            status: ok ? 'fresh' : 'stale',
            directory: toRelativePath(backupDir),
            maxAgeHours,
            latest: {
                file: toRelativePath(latest.filePath),
                timestamp: latest.timestamp,
                createdAt: latest.date.toISOString(),
                sizeBytes: latest.sizeBytes
            },
            ageHours
        };
    } catch (error) {
        return {
            ok: false,
            status: 'error',
            directory: toRelativePath(backupDir),
            maxAgeHours,
            latest: null,
            ageHours: null,
            error: error.message || '备份状态检查失败'
        };
    }
};

const buildHealthReport = ({ db, dbPath, startedAtMs }) => {
    const nowMs = Date.now();
    const backupDir = DEFAULT_BACKUP_DIR;
    const maxAgeHours = normalizeBackupMaxAgeHours(process.env.CLASSMANAGER_BACKUP_MAX_AGE_HOURS);
    const database = buildDatabaseHealth({ db, dbPath });
    const backup = buildBackupHealth({ backupDir, maxAgeHours, nowMs });
    const status = !database.ok
        ? 'error'
        : backup.ok
            ? 'ok'
            : 'degraded';

    return {
        statusCode: database.ok ? 200 : 503,
        body: {
            status,
            ok: status === 'ok',
            ready: database.ok,
            time: new Date(nowMs).toISOString(),
            uptimeSeconds: Math.max(0, Math.floor((nowMs - startedAtMs) / 1000)),
            checks: {
                database,
                backup
            }
        }
    };
};

module.exports = {
    buildHealthReport,
    DEFAULT_BACKUP_MAX_AGE_HOURS
};
