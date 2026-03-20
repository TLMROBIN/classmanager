/**
 * 数据迁移脚本
 * 将原系统 data.json 数据迁移到多用户版本的 SQLite 数据库
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SOURCE_FILE = path.join(__dirname, '..', 'data.json');
const DB_PATH = path.join(__dirname, 'database', 'classmanager.db');
const TARGET_USERNAME = process.argv[2] || 'yubin';

console.log('==========================================');
console.log('  班级管理系统数据迁移工具');
console.log('==========================================');
console.log(`源文件: ${SOURCE_FILE}`);
console.log(`目标数据库: ${DB_PATH}`);
console.log(`目标用户: ${TARGET_USERNAME}`);
console.log('');

// 检查源文件
if (!fs.existsSync(SOURCE_FILE)) {
    console.error('❌ 错误: 源文件 data.json 不存在');
    process.exit(1);
}

// 连接数据库
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// 检查用户
const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(TARGET_USERNAME);
if (!user) {
    console.error(`❌ 错误: 用户 "${TARGET_USERNAME}" 不存在`);
    const users = db.prepare('SELECT id, username, role FROM users').all();
    console.log('\n现有用户列表:');
    users.forEach(u => console.log(`  - ${u.username} (ID: ${u.id}, 角色: ${u.role})`));
    db.close();
    process.exit(1);
}

const userId = user.id;
console.log(`✅ 找到用户: ${user.username} (ID: ${userId})`);

// 读取源数据
console.log('\n📖 读取源数据...');
let sourceData;
try {
    const content = fs.readFileSync(SOURCE_FILE, 'utf8');
    sourceData = JSON.parse(content);
} catch (err) {
    console.error('❌ 读取源文件失败:', err.message);
    db.close();
    process.exit(1);
}

const dataKeys = Object.keys(sourceData);
console.log(`   发现 ${dataKeys.length} 个数据字段: ${dataKeys.join(', ')}`);

// 检查是否已有数据
const existingData = db.prepare('SELECT COUNT(*) as count FROM class_data WHERE user_id = ?').get(userId);
if (existingData.count > 0) {
    console.log(`\n⚠️  警告: 用户 ${TARGET_USERNAME} 已有 ${existingData.count} 条数据记录`);
    console.log('   继续迁移将覆盖现有数据！');
    
    if (!process.argv.includes('--force')) {
        console.log('\n   使用 --force 参数强制覆盖');
        db.close();
        process.exit(1);
    }
    
    // 清除现有数据
    console.log('   清除现有数据...');
    db.prepare('DELETE FROM class_data WHERE user_id = ?').run(userId);
}

// 迁移数据
console.log('\n📦 开始迁移数据...');

const upsert = db.prepare(`
    INSERT INTO class_data (user_id, data_key, data_value, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, data_key) 
    DO UPDATE SET data_value = excluded.data_value, updated_at = CURRENT_TIMESTAMP
`);

const transaction = db.transaction(() => {
    let successCount = 0;
    let errorCount = 0;
    
    for (const key of dataKeys) {
        const value = sourceData[key];
        if (value === undefined || value === null) continue;
        
        try {
            const jsonValue = JSON.stringify(value);
            upsert.run(userId, key, jsonValue);
            successCount++;
            console.log(`   ✓ ${key} (${typeof value === 'object' ? (Array.isArray(value) ? value.length + ' 条' : '对象') : typeof value})`);
        } catch (err) {
            errorCount++;
            console.error(`   ✗ ${key}: ${err.message}`);
        }
    }
    
    return { successCount, errorCount };
});

const result = transaction();

console.log('\n==========================================');
console.log('✅ 迁移完成！');
console.log(`   成功: ${result.successCount} 条`);
if (result.errorCount > 0) {
    console.log(`   失败: ${result.errorCount} 条`);
}
console.log(`\n   用户 ${TARGET_USERNAME} 现在可以登录查看数据`);
console.log('==========================================');

db.close();