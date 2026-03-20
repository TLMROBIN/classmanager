const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database', 'classmanager.db');
const db = new Database(dbPath);

const battleData = JSON.parse(fs.readFileSync(path.join(__dirname, 'battle_v81.json'), 'utf8'));

const users = db.prepare('SELECT id, username FROM users').all();
console.log('用户列表:', users);

if (users.length === 0) {
    console.error('没有找到用户！');
    process.exit(1);
}

const targetUser = users.find(u => u.username === 'yubin') || users[0];
console.log(`将数据恢复到用户: ${targetUser.username} (ID: ${targetUser.id})`);

const existingData = db.prepare('SELECT data_value FROM class_data WHERE user_id = ? AND data_key = ?').get(targetUser.id, 'data');

let fullData = {};
if (existingData) {
    fullData = JSON.parse(existingData.data_value);
    console.log('找到现有数据，将合并battle数据...');
}

fullData.battle = {
    version: 1,
    teams: battleData.teams || [],
    squads: battleData.squads || [],
    battles: battleData.battles || [],
    logs: battleData.logs || [],
    history: [],
    settlements: [],
    season: 1,
    rules: {},
    exams: [],
    teamBaseExamId: '',
    settleExamId: ''
};

if (battleData.students && battleData.students.length > 0) {
    fullData.students = battleData.students;
    console.log('同时恢复学生数据...');
}

fullData.__meta = {
    updatedAt: Date.now(),
    deviceId: 'restore-script'
};

const upsert = db.prepare(`
    INSERT INTO class_data (user_id, data_key, data_value, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, data_key) 
    DO UPDATE SET data_value = excluded.data_value, updated_at = CURRENT_TIMESTAMP
`);

upsert.run(targetUser.id, 'data', JSON.stringify(fullData));

console.log('✅ 数据恢复成功！');
console.log(`   - 战队数: ${battleData.teams?.length || 0}`);
console.log(`   - 共鸣数: ${battleData.squads?.length || 0}`);
console.log(`   - 对战数: ${battleData.battles?.length || 0}`);
console.log(`   - 学生数: ${battleData.students?.length || 0}`);

db.close();