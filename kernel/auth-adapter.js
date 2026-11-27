const { DEFAULT_COMP_EVAL_MAPPING } = require('./taxonomy');

const VALID_DEPLOYMENT_MODES = new Set(['personal', 'school']);

const parseJsonSafe = (raw, fallback) => {
    if (typeof raw !== 'string' || !raw) return fallback;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_) {
        return fallback;
    }
};

const resolvePreferredMode = (requestedMode) => {
    const normalized = String(requestedMode || process.env.CLASSMANAGER_DEPLOYMENT_MODE || 'personal').trim().toLowerCase();
    return VALID_DEPLOYMENT_MODES.has(normalized) ? normalized : 'personal';
};

/**
 * Initialize or update singleton deployment_settings row.
 * Existing deployments retain their saved mode unless forceUpdate is true.
 */
const ensureDeploymentSettings = (db, options = {}) => {
    const {
        mode,
        schoolName,
        officialMarketUrl,
        forceUpdate = false
    } = options || {};

    const existing = db.prepare('SELECT id, mode, school_name, official_market_url, settings_json FROM deployment_settings WHERE id = 1').get();
    const resolvedMode = mode && VALID_DEPLOYMENT_MODES.has(String(mode).trim().toLowerCase())
        ? String(mode).trim().toLowerCase()
        : resolvePreferredMode(null);

    if (!existing) {
        const settingsJson = JSON.stringify({
            compEvalMapping: { ...DEFAULT_COMP_EVAL_MAPPING }
        });
        db.prepare(`
            INSERT INTO deployment_settings (id, mode, school_name, official_market_url, settings_json)
            VALUES (1, ?, ?, ?, ?)
        `).run(
            resolvedMode,
            schoolName != null ? String(schoolName) : null,
            officialMarketUrl != null ? String(officialMarketUrl) : null,
            settingsJson
        );
    } else {
        const currentSettings = parseJsonSafe(existing.settings_json, {});
        let nextSettingsJson = existing.settings_json;
        if (!currentSettings.compEvalMapping || typeof currentSettings.compEvalMapping !== 'object') {
            nextSettingsJson = JSON.stringify({
                ...currentSettings,
                compEvalMapping: { ...DEFAULT_COMP_EVAL_MAPPING }
            });
        }

        if (forceUpdate) {
            db.prepare(`
                UPDATE deployment_settings
                SET mode = ?,
                    school_name = COALESCE(?, school_name),
                    official_market_url = COALESCE(?, official_market_url),
                    settings_json = ?
                WHERE id = 1
            `).run(
                mode && VALID_DEPLOYMENT_MODES.has(String(mode).trim().toLowerCase())
                    ? String(mode).trim().toLowerCase()
                    : existing.mode,
                schoolName !== undefined ? schoolName : null,
                officialMarketUrl !== undefined ? officialMarketUrl : null,
                nextSettingsJson
            );
        } else if (nextSettingsJson !== existing.settings_json) {
            db.prepare('UPDATE deployment_settings SET settings_json = ? WHERE id = 1').run(nextSettingsJson);
        }
    }

    return getDeploymentSettings(db);
};

const getDeploymentSettings = (db) => {
    const row = db.prepare('SELECT id, mode, school_name, official_market_url, settings_json FROM deployment_settings WHERE id = 1').get();
    if (!row) {
        return {
            mode: 'personal',
            schoolName: null,
            officialMarketUrl: null,
            settings: {
                compEvalMapping: { ...DEFAULT_COMP_EVAL_MAPPING }
            }
        };
    }

    return {
        mode: VALID_DEPLOYMENT_MODES.has(row.mode) ? row.mode : 'personal',
        schoolName: row.school_name || null,
        officialMarketUrl: row.official_market_url || null,
        settings: parseJsonSafe(row.settings_json, {
            compEvalMapping: { ...DEFAULT_COMP_EVAL_MAPPING }
        })
    };
};

const normalizeUsername = (value) => String(value || '').trim();

/**
 * Pluggable authentication adapter.
 * Both personal and school modes retain built-in username+password login as a first-class provider.
 */
const createAuthAdapter = ({ db, hashPassword, verifyPassword, generateToken, onUserCreated }) => {
    const selectUserIdByUsername = db.prepare('SELECT id FROM users WHERE lower(trim(username)) = lower(?) LIMIT 1');
    const selectUserByUsername = db.prepare('SELECT * FROM users WHERE lower(trim(username)) = lower(?) LIMIT 1');
    const selectUserPasswordByUsername = db.prepare('SELECT id, username, password_hash FROM users WHERE lower(trim(username)) = lower(?) LIMIT 1');
    const insertUser = db.prepare(`
        INSERT INTO users (username, password_hash, email)
        VALUES (?, ?, ?)
    `);
    const selectCreatedUser = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?');
    const touchLastLogin = db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
    const updateUserPassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');

    const getCapabilities = () => {
        const deployment = getDeploymentSettings(db);
        const ssoEnabled = deployment.mode === 'school' && deployment.settings?.sso?.enabled === true;
        return {
            mode: deployment.mode,
            schoolName: deployment.schoolName,
            providers: ssoEnabled ? ['password', 'sso'] : ['password'],
            passwordLoginEnabled: true,
            ssoEnabled
        };
    };

    const authenticatePassword = ({ username, password }) => {
        const normalizedUsername = normalizeUsername(username);
        const rawPassword = String(password || '');
        if (!normalizedUsername || !rawPassword) {
            return { ok: false, status: 400, error: '用户名和密码不能为空' };
        }

        const user = selectUserByUsername.get(normalizedUsername);
        if (!user || !verifyPassword(rawPassword, user.password_hash)) {
            return { ok: false, status: 401, error: '用户名或密码错误' };
        }

        touchLastLogin.run(user.id);
        const token = generateToken(user);
        return { ok: true, user, token };
    };

    const registerPasswordUser = ({ username, password, email }) => {
        const normalizedUsername = normalizeUsername(username);
        const rawPassword = String(password || '');
        const trimmedEmail = String(email || '').trim();

        if (!normalizedUsername || !rawPassword) {
            return { ok: false, status: 400, error: '用户名和密码不能为空' };
        }
        if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
            return { ok: false, status: 400, error: '用户名长度需在3-20个字符之间' };
        }
        if (rawPassword.length < 6) {
            return { ok: false, status: 400, error: '密码长度至少6个字符' };
        }

        const existingUser = selectUserIdByUsername.get(normalizedUsername);
        if (existingUser) {
            return { ok: false, status: 400, error: '用户名已存在' };
        }

        const passwordHash = hashPassword(rawPassword);
        const createdUser = db.transaction(() => {
            const result = insertUser.run(normalizedUsername, passwordHash, trimmedEmail || null);
            const user = selectCreatedUser.get(result.lastInsertRowid);
            if (typeof onUserCreated === 'function') {
                onUserCreated(user);
            }
            return user;
        })();

        const token = generateToken(createdUser);
        return { ok: true, user: createdUser, token };
    };

    const changePassword = ({ username, currentPassword, newPassword }) => {
        const normalizedUsername = normalizeUsername(username);
        const rawCurrent = String(currentPassword || '');
        const rawNew = String(newPassword || '');

        if (!normalizedUsername || !rawCurrent || !rawNew) {
            return { ok: false, status: 400, error: '用户名、当前密码和新密码不能为空' };
        }
        if (rawNew.length < 6) {
            return { ok: false, status: 400, error: '新密码长度至少6个字符' };
        }

        const user = selectUserPasswordByUsername.get(normalizedUsername);
        if (!user || !verifyPassword(rawCurrent, user.password_hash)) {
            return { ok: false, status: 401, error: '用户名或当前密码错误' };
        }
        if (verifyPassword(rawNew, user.password_hash)) {
            return { ok: false, status: 400, error: '新密码不能与当前密码相同' };
        }

        const passwordHash = hashPassword(rawNew);
        updateUserPassword.run(passwordHash, user.id);
        return { ok: true, message: '密码修改成功，请使用新密码登录' };
    };

    return {
        getCapabilities,
        authenticatePassword,
        registerPasswordUser,
        changePassword
    };
};

module.exports = {
    VALID_DEPLOYMENT_MODES,
    ensureDeploymentSettings,
    getDeploymentSettings,
    createAuthAdapter
};
