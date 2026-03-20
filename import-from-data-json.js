const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('==========================================');
console.log('  data.json 导入脚本');
console.log('==========================================\n');

const dbPath = path.join(__dirname, 'database', 'classmanager.db');
const dataJsonPath = path.join(__dirname, '..', 'data.json');

console.log('数据库路径:', dbPath);
console.log('数据源路径:', dataJsonPath);
console.log();

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));

console.log('data.json 数据统计:');
console.log('  学生数:', data.students ? data.students.length : 0);
console.log('  历史记录:', data.history ? data.history.length : 0);
console.log('  储物箱:', data.storage ? Object.keys(data.storage).length : 0);
console.log('  考勤记录:', data.attendanceRecords ? data.attendanceRecords.length : 0);
console.log('  藏宝阁:', data.treasures ? data.treasures.length : 0);
console.log();

const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');

if (!adminUser) {
    console.error('❌ 错误: 未找到 admin 用户');
    console.log('请先运行 node database/init.js 初始化数据库');
    process.exit(1);
}

console.log('找到 admin 用户，ID:', adminUser.id);
console.log();

const insertOrUpdate = db.prepare(`
    INSERT INTO class_data (user_id, data_key, data_value, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, data_key) 
    DO UPDATE SET data_value = excluded.data_value, updated_at = CURRENT_TIMESTAMP
`);

const importData = (key, value) => {
    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
    insertOrUpdate.run(adminUser.id, key, jsonValue);
    console.log('✅ 已导入:', key, typeof value === 'object' ? `(${Array.isArray(value) ? value.length : Object.keys(value).length} 条)` : '');
};

console.log('开始导入数据...\n');

if (data.students) {
    data.students.forEach(student => {
        if (!student.history) {
            student.history = [];
        }
        if (!student.storageItems) {
            student.storageItems = [];
        }
    });
    importData('students', data.students);
}

if (data.history) {
    importData('history', data.history);
}

if (data.storage) {
    Object.keys(data.storage).forEach(studentId => {
        const student = data.students.find(s => s.id == studentId);
        if (student && Array.isArray(data.storage[studentId])) {
            student.storageItems = data.storage[studentId];
        }
    });
    console.log('✅ 储物箱数据已合并到学生记录中');
}

if (data.config) {
    importData('config', data.config);
}

if (data.attendanceRecords) {
    importData('attendanceRecords', data.attendanceRecords);
}

if (data.treasures) {
    importData('treasures', data.treasures);
}

if (data.tasks) {
    importData('tasks', data.tasks);
}

if (data.quotes) {
    importData('quotes', data.quotes);
}

if (data.messages) {
    importData('messages', data.messages);
}

if (data.teacherMessages) {
    importData('teacherMessages', data.teacherMessages);
}

if (data.redemptionHistory) {
    importData('redemptionHistory', data.redemptionHistory);
}

if (data.dailyRedemptionCounts) {
    importData('dailyRedemptionCounts', data.dailyRedemptionCounts);
}

if (data.dailyUsageCounts) {
    importData('dailyUsageCounts', data.dailyUsageCounts);
}

if (data.battle) {
    importData('battle', data.battle);
}

if (data.logs) {
    importData('logs', data.logs);
}

console.log('\n验证导入结果...\n');

const studentsRow = db.prepare('SELECT data_value FROM class_data WHERE user_id = ? AND data_key = ?').get(adminUser.id, 'students');
if (studentsRow) {
    const students = JSON.parse(studentsRow.data_value);
    console.log('✅ 学生数:', students.length);
    
    const targets = ['胡诺翔', '陈正岳', '徐青阳'];
    targets.forEach(name => {
        const student = students.find(s => s.name === name);
        if (student) {
            console.log('\n  ' + name + ':');
            console.log('    积分:', student.zizai);
            console.log('    余额:', student.balance);
            console.log('    历史记录:', student.history ? student.history.length : 0, '条');
            console.log('    储物箱:', student.storageItems ? student.storageItems.length : 0, '个物品');
        }
    });
}

const historyRow = db.prepare('SELECT data_value FROM class_data WHERE user_id = ? AND data_key = ?').get(adminUser.id, 'history');
if (historyRow) {
    const history = JSON.parse(historyRow.data_value);
    console.log('\n✅ 历史记录:', history.length, '条');
}

db.close();

console.log('\n==========================================');
console.log('✅ 数据导入完成！');
console.log('==========================================');
console.log('\n下一步:');
console.log('  1. 运行 ./start.sh 启动服务');
console.log('  2. 使用 admin/admin123 登录');
console.log('  3. 验证数据是否正确\n');