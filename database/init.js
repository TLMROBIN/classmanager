const Database = require('better-sqlite3');
const { dbPath, ensureSchema } = require('./schema');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
ensureSchema(db);

console.log('✅ 数据库初始化完成');
console.log(`   数据库位置: ${dbPath}`);
console.log('ℹ️  首个管理员需通过本地初始化脚本手动创建');

db.close();
