const path = require('path');

const dbPath = path.join(__dirname, 'classmanager.db');

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
