const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

console.log('=== 重建数据库并重置用户 yubin ===\n');

const adminPassword = process.env.REBUILD_ADMIN_PASSWORD;
if (!adminPassword || adminPassword.length < 8) {
    console.error('❌ 请通过 REBUILD_ADMIN_PASSWORD 环境变量提供新的管理员密码，且长度至少 8 个字符');
    process.exit(1);
}

const dbPath = path.join(__dirname, 'database', 'classmanager.db');

console.log('1. 备份并删除旧数据库...');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
console.log('   - 已删除旧数据库文件\n');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

console.log('2. 创建数据库表结构...');
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
console.log('   - 表结构已创建\n');

console.log('3. 创建 admin 用户...');
const adminPasswordHash = bcrypt.hashSync(adminPassword, 10);
const adminResult = db.prepare(`
    INSERT INTO users (username, password_hash, role)
    VALUES (?, ?, 'admin')
`).run('admin', adminPasswordHash);
const adminId = adminResult.lastInsertRowid;
console.log(`   - admin 用户已创建 (id: ${adminId})\n`);

console.log('4. 导入 admin 数据...');
const dataExportPath = path.join(__dirname, 'admin_data_export.json');
if (fs.existsSync(dataExportPath)) {
    const adminData = JSON.parse(fs.readFileSync(dataExportPath, 'utf-8'));
    const insertData = db.prepare(`
        INSERT INTO class_data (user_id, data_key, data_value, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    for (const row of adminData) {
        insertData.run(adminId, row.data_key, row.data_value);
    }
    console.log(`   - 已导入 ${adminData.length} 条数据记录\n`);
} else {
    console.log('   - 未找到 admin_data_export.json，跳过数据导入\n');
}

console.log('5. 创建 yubin 用户...');
const yubinPasswordHash = bcrypt.hashSync('yubin123', 10);
const yubinResult = db.prepare(`
    INSERT INTO users (username, password_hash, role)
    VALUES (?, ?, 'user')
`).run('yubin', yubinPasswordHash);
const yubinId = yubinResult.lastInsertRowid;
console.log(`   - yubin 用户已创建 (id: ${yubinId}, 密码: yubin123)\n`);

console.log('6. 复制 admin 数据到 yubin...');
const adminClassData = db.prepare('SELECT data_key, data_value FROM class_data WHERE user_id = ?').all(adminId);
if (adminClassData.length > 0) {
    const insertData = db.prepare(`
        INSERT INTO class_data (user_id, data_key, data_value, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    for (const row of adminClassData) {
        insertData.run(yubinId, row.data_key, row.data_value);
    }
    console.log(`   - 已复制 ${adminClassData.length} 条数据记录到 yubin\n`);
}

console.log('7. 创建其他现有用户...');
const existingUsers = [
    { username: 'liping', password: 'liping123' },
    { username: 'ZHANGZHITAO', password: 'zhang123' },
    { username: 'yangmei', password: 'yangmei123' },
    { username: 'tlmrobin3', password: 'robin123' },
    { username: 'twst13455', password: 'twst123' },
    { username: 'zhoutingshan', password: 'zhou123' },
    { username: 'Huang Lixue', password: 'huang123' }
];

for (const user of existingUsers) {
    try {
        const hash = bcrypt.hashSync(user.password, 10);
        db.prepare(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'user')`).run(user.username, hash);
        console.log(`   - 已创建用户: ${user.username}`);
    } catch (e) {
        console.log(`   - 创建用户 ${user.username} 失败: ${e.message}`);
    }
}

console.log('\n=== 操作完成 ===');
console.log('\n用户账户信息:');
console.log('  admin / <由 REBUILD_ADMIN_PASSWORD 提供> (管理员)');
console.log('  yubin / yubin123 (已复制 admin 数据)');

db.close();
