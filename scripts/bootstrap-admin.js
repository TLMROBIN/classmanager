const readline = require('readline');
const Database = require('better-sqlite3');
const { hashPassword } = require('../utils/password');
const { dbPath, ensureSchema, countAdmins } = require('../database/schema');

const args = process.argv.slice(2);

const getArgValue = (name) => {
    const exact = args.find(arg => arg.startsWith(`${name}=`));
    if (exact) return exact.slice(name.length + 1);
    const index = args.findIndex(arg => arg === name);
    if (index >= 0 && args[index + 1]) return args[index + 1];
    return null;
};

const ask = (rl, question) => new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));

const run = async () => {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    ensureSchema(db);

    if (countAdmins(db) > 0) {
        console.error('❌ 已存在管理员账户，首个管理员初始化脚本不可重复使用');
        db.close();
        process.exit(1);
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        const username = getArgValue('--username') || await ask(rl, '请输入管理员用户名: ');
        const password = getArgValue('--password') || await ask(rl, '请输入管理员密码: ');
        const confirmPassword = getArgValue('--confirm-password') || await ask(rl, '请再次输入管理员密码: ');

        if (!username || username.length < 3 || username.length > 20) {
            throw new Error('管理员用户名长度需在 3 到 20 个字符之间');
        }
        if (!password || password.length < 8) {
            throw new Error('管理员密码长度至少 8 个字符');
        }
        if (password !== confirmPassword) {
            throw new Error('两次输入的管理员密码不一致');
        }

        const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existingUser) {
            throw new Error('该用户名已存在');
        }

        const result = db.prepare(`
            INSERT INTO users (username, password_hash, role)
            VALUES (?, ?, 'admin')
        `).run(username, hashPassword(password));

        console.log(`✅ 已创建管理员账户: ${username} (id: ${result.lastInsertRowid})`);
    } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exitCode = 1;
    } finally {
        rl.close();
        db.close();
    }
};

run();
