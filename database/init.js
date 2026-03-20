const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'classmanager.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
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
`);

const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
        INSERT INTO users (username, password_hash, role)
        VALUES (?, ?, 'admin')
    `).run('admin', passwordHash);
    console.log('✅ 默认管理员账户已创建');
    console.log('   用户名: admin');
    console.log('   密码: admin123');
    console.log('   请在首次登录后立即修改密码！');
}

console.log('✅ 数据库初始化完成');
console.log(`   数据库位置: ${dbPath}`);

db.close();