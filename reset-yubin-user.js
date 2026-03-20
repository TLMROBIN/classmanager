const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database', 'classmanager.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

console.log('=== 开始重置用户 yubin ===\n');

const transaction = db.transaction(() => {
    const yubinUser = db.prepare('SELECT id FROM users WHERE username = ?').get('yubin');
    
    if (yubinUser) {
        console.log(`1. 找到用户 yubin (id: ${yubinUser.id})`);
        
        const dataCount = db.prepare('SELECT COUNT(*) as count FROM class_data WHERE user_id = ?').get(yubinUser.id).count;
        console.log(`   - 该用户有 ${dataCount} 条数据记录`);
        
        db.prepare('DELETE FROM class_data WHERE user_id = ?').run(yubinUser.id);
        console.log('   - 已删除用户数据');
        
        db.prepare('DELETE FROM users WHERE id = ?').run(yubinUser.id);
        console.log('   - 已删除用户\n');
    } else {
        console.log('1. 用户 yubin 不存在，跳过删除步骤\n');
    }
    
    console.log('2. 创建新用户 yubin...');
    const passwordHash = bcrypt.hashSync('yubin123', 10);
    const insertResult = db.prepare(`
        INSERT INTO users (username, password_hash, role)
        VALUES (?, ?, 'user')
    `).run('yubin', passwordHash);
    
    const newUserId = insertResult.lastInsertRowid;
    console.log(`   - 新用户已创建 (id: ${newUserId})`);
    console.log('   - 密码: yubin123\n');
    
    console.log('3. 复制 admin 的数据到 yubin...');
    const adminData = db.prepare('SELECT data_key, data_value FROM class_data WHERE user_id = ?').all(1);
    
    if (adminData.length > 0) {
        const insertData = db.prepare(`
            INSERT INTO class_data (user_id, data_key, data_value, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        for (const row of adminData) {
            insertData.run(newUserId, row.data_key, row.data_value);
        }
        
        console.log(`   - 已复制 ${adminData.length} 条数据记录\n`);
    } else {
        console.log('   - admin 没有数据\n');
    }
    
    console.log('=== 操作完成 ===');
    console.log('用户: yubin');
    console.log('密码: yubin123');
});

try {
    transaction();
} catch (err) {
    console.error('操作失败:', err);
    process.exit(1);
}

db.close();