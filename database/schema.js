const path = require('path');

const DEFAULT_DB_PATH = path.join(__dirname, 'classmanager.db');
const resolveConfiguredPath = (configuredPath, fallbackPath) => {
    if (!configuredPath) return fallbackPath;
    return path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(process.cwd(), configuredPath);
};

const dbPath = resolveConfiguredPath(process.env.CLASSMANAGER_DB_PATH, DEFAULT_DB_PATH);

const SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    );

    CREATE TABLE IF NOT EXISTS class_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        data_key TEXT NOT NULL,
        data_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, data_key)
    );

    CREATE INDEX IF NOT EXISTS idx_class_data_user ON class_data(user_id);
    CREATE INDEX IF NOT EXISTS idx_class_data_key ON class_data(user_id, data_key);

    CREATE TABLE IF NOT EXISTS maintenance_credentials (
        user_id INTEGER PRIMARY KEY,
        password_hash TEXT NOT NULL,
        migrated_from_legacy INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS test_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        sim_time_ms INTEGER,
        time_speed REAL NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_test_sessions_user ON test_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_test_sessions_expires ON test_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS test_class_data (
        session_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        data_key TEXT NOT NULL,
        data_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id, user_id, data_key),
        FOREIGN KEY (session_id) REFERENCES test_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_test_class_data_session_user ON test_class_data(session_id, user_id);

    CREATE TABLE IF NOT EXISTS test_maintenance_credentials (
        session_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        password_hash TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id, user_id),
        FOREIGN KEY (session_id) REFERENCES test_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`;

const ensureSchema = (db) => {
    db.exec(SCHEMA_SQL);
};

const countAdmins = (db) => {
    const row = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get();
    return Number(row?.count) || 0;
};

module.exports = {
    dbPath,
    ensureSchema,
    countAdmins
};
