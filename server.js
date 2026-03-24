const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const { hashPassword, verifyPassword } = require('./utils/password');
const { generateToken, authMiddleware, adminMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3002;

const dbPath = path.join(__dirname, 'database', 'classmanager.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const normalizeTreasureDomain = (domain) => {
    const safe = domain || {};
    const storage = safe.storage && typeof safe.storage === 'object' && !Array.isArray(safe.storage)
        ? safe.storage
        : {};
    return {
        treasures: Array.isArray(safe.treasures) ? safe.treasures : [],
        storage,
        logs: Array.isArray(safe.logs) ? safe.logs : []
    };
};

const hasTreasureDomainData = (domain) => {
    const normalized = normalizeTreasureDomain(domain);
    return normalized.treasures.length > 0
        || normalized.logs.length > 0
        || Object.keys(normalized.storage).length > 0;
};

const readStoredJson = (userId, dataKey) => {
    const row = db.prepare('SELECT data_value FROM class_data WHERE user_id = ? AND data_key = ?').get(userId, dataKey);
    if (!row) return null;
    try {
        return JSON.parse(row.data_value);
    } catch (_) {
        return null;
    }
};

const getStoredTreasureDomain = (userId) => normalizeTreasureDomain({
    treasures: readStoredJson(userId, 'treasures'),
    storage: readStoredJson(userId, 'storage'),
    logs: readStoredJson(userId, 'logs')
});

const getProtectedTreasureDomain = (userId, data, incomingMeta) => {
    if (incomingMeta?.allowTreasureEmptyOverwrite === true) return null;
    const hasTreasureKeys = ['treasures', 'storage', 'logs'].every(key => Object.prototype.hasOwnProperty.call(data || {}, key));
    if (!hasTreasureKeys) return null;
    const incomingDomain = normalizeTreasureDomain(data);
    if (hasTreasureDomainData(incomingDomain)) return null;
    const existingDomain = getStoredTreasureDomain(userId);
    if (!hasTreasureDomainData(existingDomain)) return null;
    console.warn(`[藏宝阁] 阻止用户 ${userId} 的整域空覆盖保存`);
    return existingDomain;
};

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== 认证 API ====================

// 注册
app.post('/api/auth/register', (req, res) => {
    const { username, password, email } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: '用户名长度需在3-20个字符之间' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: '密码长度至少6个字符' });
    }
    
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
        return res.status(400).json({ error: '用户名已存在' });
    }
    
    const passwordHash = hashPassword(password);
    
    try {
        const result = db.prepare(`
            INSERT INTO users (username, password_hash, email)
            VALUES (?, ?, ?)
        `).run(username, passwordHash, email || null);
        
        const user = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
        
        const token = generateToken(user);
        
        res.json({ 
            success: true, 
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (err) {
        console.error('注册失败:', err);
        res.status(500).json({ error: '注册失败，请重试' });
    }
});

// 登录
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    if (!verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    
    const token = generateToken(user);
    
    res.json({
        success: true,
        token,
        user: { id: user.id, username: user.username, role: user.role }
    });
});

// 验证token
app.get('/api/auth/verify', authMiddleware, (req, res) => {
    const user = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ 
        success: true,
        user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
});

// 登出
app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true, message: '登出成功' });
});

// ==================== 数据 API ====================

// 获取数据
app.get('/api/data', authMiddleware, (req, res) => {
    const userId = req.user.id;
    
    try {
        const rows = db.prepare('SELECT data_key, data_value FROM class_data WHERE user_id = ?').all(userId);
        
        const data = {};
        rows.forEach(row => {
            try {
                data[row.data_key] = JSON.parse(row.data_value);
            } catch {
                data[row.data_key] = row.data_value;
            }
        });
        
        res.json(data);
    } catch (err) {
        console.error('读取数据出错:', err);
        res.status(500).json({ error: '读取数据失败' });
    }
});

// 保存数据
app.post('/api/data', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const data = req.body;
    
    try {
        const incomingMeta = data?.__meta && typeof data.__meta === 'object' ? data.__meta : {};
        const existingMetaRow = db.prepare('SELECT data_value FROM class_data WHERE user_id = ? AND data_key = ?').get(userId, '__meta');
        let existingMeta = {};
        try {
            existingMeta = existingMetaRow ? (JSON.parse(existingMetaRow.data_value) || {}) : {};
        } catch (_) {
            existingMeta = {};
        }
        const existingUpdatedAt = Number(existingMeta.updatedAt) || 0;
        const baseUpdatedAt = Number(incomingMeta.baseUpdatedAt) || 0;
        const allowServerOverwrite = incomingMeta.allowServerOverwrite === true;
        if (existingUpdatedAt > 0 && !allowServerOverwrite && baseUpdatedAt !== existingUpdatedAt) {
            return res.status(409).json({
                error: '服务器数据已被其他会话更新，请先刷新后再保存',
                code: 'DATA_CONFLICT',
                serverUpdatedAt: existingUpdatedAt
            });
        }
        const protectedTreasureDomain = getProtectedTreasureDomain(userId, data, incomingMeta);

        const upsert = db.prepare(`
            INSERT INTO class_data (user_id, data_key, data_value, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, data_key) 
            DO UPDATE SET data_value = excluded.data_value, updated_at = CURRENT_TIMESTAMP
        `);
        
        const transaction = db.transaction(() => {
            for (const [key, value] of Object.entries(data)) {
                let finalValue = protectedTreasureDomain && Object.prototype.hasOwnProperty.call(protectedTreasureDomain, key)
                    ? protectedTreasureDomain[key]
                    : value;
                if (key === 'examArchives') {
                    const incomingExams = Array.isArray(value?.exams) ? value.exams : [];
                    if (incomingExams.length === 0) {
                        const existingRow = db.prepare('SELECT data_value FROM class_data WHERE user_id = ? AND data_key = ?').get(userId, 'examArchives');
                        if (existingRow) {
                            try {
                                const existingValue = JSON.parse(existingRow.data_value);
                                const existingExams = Array.isArray(existingValue?.exams) ? existingValue.exams : [];
                                if (existingExams.length > 0) {
                                    finalValue = existingValue;
                                }
                            } catch (_) {}
                        }
                    }
                }
                upsert.run(userId, key, JSON.stringify(finalValue));
            }
        });
        
        transaction();
        
        console.log(`[${new Date().toLocaleTimeString()}] 用户 ${req.user.username} 数据已保存`);
        res.json({
            success: true,
            message: '保存成功',
            updatedAt: Number(incomingMeta.updatedAt) || Date.now()
        });
    } catch (err) {
        console.error('保存数据出错:', err);
        res.status(500).json({ error: '保存失败' });
    }
});

// 获取加扣分记录
app.get('/api/adjustments', authMiddleware, (req, res) => {
    const userId = req.user.id;
    
    try {
        const dataRow = db.prepare('SELECT data_value FROM class_data WHERE user_id = ? AND data_key = ?').get(userId, 'data');
        
        if (!dataRow) {
            return res.json({ updatedAt: null, adjustments: [] });
        }
        
        const data = JSON.parse(dataRow.data_value);
        const history = Array.isArray(data?.history) ? data.history : [];
        
        const adjustments = history.filter(item => {
            if (!item) return false;
            const val = Number(item.val);
            if (!Number.isFinite(val) || val === 0) return false;
            if (item.type === 'bonus' || item.type === 'penalty') return true;
            return val > 0 || val < 0;
        });
        
        res.json({ 
            updatedAt: data?.__meta?.updatedAt ?? null, 
            adjustments 
        });
    } catch (err) {
        console.error('读取加扣分数据出错:', err);
        res.status(500).json({ error: '读取加扣分数据失败' });
    }
});

// ==================== 管理员 API ====================

// 获取用户列表
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const users = db.prepare(`
            SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login,
                   (SELECT COUNT(*) FROM class_data WHERE user_id = u.id) as data_count
            FROM users u
            ORDER BY u.created_at DESC
        `).all();
        
        res.json({ success: true, users });
    } catch (err) {
        console.error('获取用户列表失败:', err);
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

// 删除用户
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
    const userId = req.params.id;
    
    if (Number(userId) === req.user.id) {
        return res.status(400).json({ error: '不能删除自己的账户' });
    }
    
    try {
        db.prepare('DELETE FROM class_data WHERE user_id = ?').run(userId);
        const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        res.json({ success: true, message: '用户已删除' });
    } catch (err) {
        console.error('删除用户失败:', err);
        res.status(500).json({ error: '删除用户失败' });
    }
});

// 修改用户角色
app.put('/api/admin/users/:id/role', authMiddleware, adminMiddleware, (req, res) => {
    const userId = req.params.id;
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: '无效的角色' });
    }
    
    try {
        const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        res.json({ success: true, message: '角色已更新' });
    } catch (err) {
        console.error('更新角色失败:', err);
        res.status(500).json({ error: '更新角色失败' });
    }
});

// 系统统计
app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const dataCount = db.prepare('SELECT COUNT(*) as count FROM class_data').get().count;
        
        res.json({
            success: true,
            stats: {
                totalUsers: userCount,
                totalDataRecords: dataCount
            }
        });
    } catch (err) {
        console.error('获取统计失败:', err);
        res.status(500).json({ error: '获取统计失败' });
    }
});

// ==================== 启动服务器 ====================

const dbInitPath = path.join(__dirname, 'database', 'classmanager.db');
const dbInit = new Database(dbInitPath);

dbInit.exec(`
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

const bcrypt = require('bcryptjs');
const adminExists = dbInit.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    dbInit.prepare(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`).run('admin', passwordHash);
    console.log('✅ 默认管理员账户已创建 (admin / admin123)');
}
dbInit.close();

app.listen(PORT, '0.0.0.0', () => {
    console.log('=====================================================');
    console.log(`✅ 班级管理系统（多用户版）已启动！`);
    console.log(`📂 本机访问: http://localhost:${PORT}`);
    console.log(`📡 局域网访问: 请使用本机 IP 地址 + :${PORT}`);
    console.log(`👤 默认管理员: admin / admin123`);
    console.log(`🔧 管理员后台: http://localhost:${PORT}/admin.html`);
    console.log('=====================================================');
});

process.on('SIGINT', () => {
    db.close();
    process.exit();
});
