const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';
const MAINTENANCE_TOKEN_EXPIRES_IN = '10m';
const MAINTENANCE_TOKEN_TTL_MS = 10 * 60 * 1000;

if (!JWT_SECRET) {
    throw new Error('缺少 JWT_SECRET 环境变量，服务拒绝启动');
}

const generateToken = (user) => {
    return jwt.sign(
        { type: 'access', id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

const generateMaintenanceToken = (userId) => {
    return jwt.sign(
        { type: 'maintenance', userId: Number(userId) },
        JWT_SECRET,
        { expiresIn: MAINTENANCE_TOKEN_EXPIRES_IN }
    );
};

const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded?.type === 'access' ? decoded : null;
    } catch (err) {
        return null;
    }
};

const verifyMaintenanceToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded?.type === 'maintenance' ? decoded : null;
    } catch (err) {
        return null;
    }
};

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未授权，请先登录' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded) {
        return res.status(401).json({ error: 'Token无效或已过期' });
    }
    
    req.user = decoded;
    next();
};

const adminMiddleware = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
};

const userMiddleware = (req, res, next) => {
    if (req.user.role !== 'user') {
        return res.status(403).json({ error: '普通用户页面不允许管理员访问' });
    }
    next();
};

module.exports = {
    generateToken,
    generateMaintenanceToken,
    verifyToken,
    verifyMaintenanceToken,
    authMiddleware,
    adminMiddleware,
    userMiddleware,
    MAINTENANCE_TOKEN_TTL_MS
};
