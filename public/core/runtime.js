(function() {
    const getRawStorageItem = (storage, key) => {
        try {
            return storage.getItem(key);
        } catch (_) {
            return null;
        }
    };

    const setRawStorageItem = (storage, key, value) => {
        try {
            storage.setItem(key, value);
        } catch (_) {}
    };

    const removeRawStorageItem = (storage, key) => {
        try {
            storage.removeItem(key);
        } catch (_) {}
    };

    const getScopedLocalStorageKey = (key) => {
        if (window.__CM_TEST_MODE__ && window.__CM_TEST_SESSION_ID__) {
            return `cm_test:${window.__CM_TEST_SESSION_ID__}:${key}`;
        }
        return key;
    };

    const getStorageItem = (key) => getRawStorageItem(localStorage, getScopedLocalStorageKey(key));
    const setStorageItem = (key, value) => setRawStorageItem(localStorage, getScopedLocalStorageKey(key), value);
    const getSessionItem = (key) => getRawStorageItem(sessionStorage, key);
    const setSessionItem = (key, value) => setRawStorageItem(sessionStorage, key, value);
    const removeSessionItem = (key) => removeRawStorageItem(sessionStorage, key);

    const TEST_SESSION_ID_KEY = 'cm_test_session_id';
    const TEST_SIM_TIME_KEY = 'cm_test_sim_time';
    const TEST_TIME_SPEED_KEY = 'cm_test_time_speed';
    const TEST_SESSION_INVALID_EVENT = 'cm:test-session-invalid';
    const TEST_SESSION_ERROR_CODES = new Set([
        'TEST_SESSION_INVALID',
        'TEST_SESSION_EXPIRED'
    ]);

    const clearLocalStorageByPrefix = (prefix) => {
        if (!prefix) return;
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) keys.push(key);
            }
            keys.forEach((key) => localStorage.removeItem(key));
        } catch (_) {}
    };

    const getStoredTestSessionState = () => {
        const sessionId = getSessionItem(TEST_SESSION_ID_KEY) || '';
        const simTimeMs = Number(getSessionItem(TEST_SIM_TIME_KEY));
        const timeSpeed = Number(getSessionItem(TEST_TIME_SPEED_KEY));
        return {
            sessionId,
            simTimeMs: Number.isFinite(simTimeMs) ? simTimeMs : Date.now(),
            timeSpeed: timeSpeed > 0 ? timeSpeed : 1
        };
    };

    const storeTestSessionState = ({ sessionId, simTimeMs, timeSpeed }) => {
        if (!sessionId) return;
        setSessionItem(TEST_SESSION_ID_KEY, String(sessionId));
        setSessionItem(TEST_SIM_TIME_KEY, String(Number.isFinite(Number(simTimeMs)) ? Number(simTimeMs) : Date.now()));
        setSessionItem(TEST_TIME_SPEED_KEY, String(timeSpeed > 0 ? timeSpeed : 1));
    };

    const clearStoredTestSessionState = () => {
        removeSessionItem(TEST_SESSION_ID_KEY);
        removeSessionItem(TEST_SIM_TIME_KEY);
        removeSessionItem(TEST_TIME_SPEED_KEY);
    };

    const applyTestRuntimeContext = ({ enabled, sessionId, simTimeMs, timeSpeed } = {}) => {
        const active = enabled === true && !!sessionId;
        window.__CM_TEST_MODE__ = active;
        window.__CM_TEST_SESSION_ID__ = active ? String(sessionId) : null;
        window.__CM_TEST_TIME__ = active
            ? (Number.isFinite(Number(simTimeMs)) ? Number(simTimeMs) : Date.now())
            : null;
        window.__CM_TEST_TIME_SPEED__ = active
            ? (timeSpeed > 0 ? timeSpeed : 1)
            : 1;
    };

    const notifyInvalidTestSession = (message) => {
        const sessionId = window.__CM_TEST_SESSION_ID__ ? String(window.__CM_TEST_SESSION_ID__) : '';
        clearStoredTestSessionState();
        try {
            window.dispatchEvent(new CustomEvent(TEST_SESSION_INVALID_EVENT, {
                detail: {
                    message: message || '测试会话已失效，请重新进入测试模式。',
                    sessionId
                }
            }));
        } catch (_) {}
    };

    const handleTestSessionApiError = (res, data) => {
        void res;
        const code = data?.code || '';
        if (!window.__CM_TEST_MODE__) return false;
        if (!TEST_SESSION_ERROR_CODES.has(code)) return false;
        notifyInvalidTestSession(data?.error || '测试会话已失效，请重新进入测试模式。');
        return true;
    };

    const getTestRequestHeaders = () => {
        if (!window.__CM_TEST_MODE__ || !window.__CM_TEST_SESSION_ID__) return {};
        const headers = {
            'X-Test-Session': String(window.__CM_TEST_SESSION_ID__)
        };
        const simTimeMs = Number(window.__CM_TEST_TIME__);
        if (Number.isFinite(simTimeMs)) {
            headers['X-Test-Now'] = String(simTimeMs);
        }
        return headers;
    };

    const initialTestSessionState = getStoredTestSessionState();
    applyTestRuntimeContext({
        enabled: Boolean(initialTestSessionState.sessionId),
        sessionId: initialTestSessionState.sessionId,
        simTimeMs: initialTestSessionState.simTimeMs,
        timeSpeed: initialTestSessionState.timeSpeed
    });

    const getNow = () => {
        if (window.__CM_TEST_MODE__) {
            const t = Number(window.__CM_TEST_TIME__);
            if (Number.isFinite(t)) {
                const d = new Date(t);
                if (!isNaN(d.getTime())) return d;
            }
            return new Date();
        }
        return new Date();
    };

    const getTodayStr = (now = getNow()) => {
        const d = new Date(now);
        const target = isNaN(d.getTime()) ? new Date() : d;
        const pad = (n) => String(n).padStart(2, '0');
        return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
    };

    const timeToMinutes = (timeStr) => {
        const parts = timeStr.split(':');
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };

    const getDateString = (date) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };

    const DAY_MS = 24 * 60 * 60 * 1000;
    const getStartOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = (from, to) => Math.floor((to - from) / DAY_MS);

    const getApiUrl = () => {
        if (window.location.protocol.startsWith('http')) {
            return '/api/data';
        }
        return null;
    };

    const loadScriptOnce = (src) => {
        if (!window.__cmScriptPromises) window.__cmScriptPromises = {};
        if (window.__cmScriptPromises[src]) return window.__cmScriptPromises[src];
        window.__cmScriptPromises[src] = new Promise((resolve, reject) => {
            const handleError = () => {
                delete window.__cmScriptPromises[src];
                reject(new Error(`Failed to load ${src}`));
            };
            const existing = document.querySelector(`script[data-src="${src}"]`);
            if (existing) {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', handleError, { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.dataset.src = src;
            script.onload = resolve;
            script.onerror = handleError;
            document.body.appendChild(script);
        });
        return window.__cmScriptPromises[src];
    };

    const ADMIN_AUTH_TOKEN_KEY = 'maintenance_token';
    const ADMIN_AUTH_EXPIRES_KEY = 'maintenance_token_expires_at';
    const ADMIN_AUTH_TTL_MS = 10 * 60 * 1000;

    const getScopedAdminAuthKey = (baseKey) => {
        if (window.__CM_TEST_MODE__ && window.__CM_TEST_SESSION_ID__) {
            return `${baseKey}:test:${window.__CM_TEST_SESSION_ID__}`;
        }
        return `${baseKey}:formal`;
    };

    const getAdminAuthUntil = () => {
        try {
            const raw = getSessionItem(getScopedAdminAuthKey(ADMIN_AUTH_EXPIRES_KEY));
            return raw ? Number(raw) : 0;
        } catch (_) {
            return 0;
        }
    };

    const clearAdminAuth = () => {
        removeSessionItem(getScopedAdminAuthKey(ADMIN_AUTH_TOKEN_KEY));
        removeSessionItem(getScopedAdminAuthKey(ADMIN_AUTH_EXPIRES_KEY));
    };

    const getAdminAuthToken = () => {
        const token = getSessionItem(getScopedAdminAuthKey(ADMIN_AUTH_TOKEN_KEY));
        if (!token) return null;
        const expiresAt = getAdminAuthUntil();
        if (!expiresAt || expiresAt <= Date.now()) {
            clearAdminAuth();
            return null;
        }
        return token;
    };

    const setAdminAuthSession = ({ token, expiresAt }) => {
        if (!token) return;
        setSessionItem(getScopedAdminAuthKey(ADMIN_AUTH_TOKEN_KEY), token);
        if (expiresAt) {
            setSessionItem(getScopedAdminAuthKey(ADMIN_AUTH_EXPIRES_KEY), String(expiresAt));
        } else {
            setSessionItem(getScopedAdminAuthKey(ADMIN_AUTH_EXPIRES_KEY), String(Date.now() + ADMIN_AUTH_TTL_MS));
        }
    };

    const clearScopedTestArtifacts = (sessionId) => {
        if (!sessionId) return;
        clearLocalStorageByPrefix(`cm_test:${sessionId}:`);
        removeSessionItem(`${ADMIN_AUTH_TOKEN_KEY}:test:${sessionId}`);
        removeSessionItem(`${ADMIN_AUTH_EXPIRES_KEY}:test:${sessionId}`);
    };

    const isAdminAuthed = () => Boolean(getAdminAuthToken());
    const getAdminAuthHeaders = () => {
        const token = getAdminAuthToken();
        return token ? { 'X-Maintenance-Token': token } : {};
    };

    const parseApiResponse = async (res) => {
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (!contentType.includes('application/json')) {
            try {
                const text = await res.text();
                return { data: {}, text };
            } catch (_) {
                return { data: {}, text: '' };
            }
        }
        try {
            return { data: await res.json(), text: '' };
        } catch (_) {
            return { data: {}, text: '' };
        }
    };

    const buildAccessAuthError = (res, data) => {
        const authErrorType = res && res.headers && typeof res.headers.get === 'function'
            ? res.headers.get('x-auth-error')
            : '';
        const isAccessAuthError = res.status === 401 && (
            authErrorType === 'access-required'
            || data?.code === 'AUTH_REQUIRED'
            || data?.error === '未授权，请先登录'
            || data?.error === 'Token无效或已过期'
        );
        if (!isAccessAuthError) return null;

        if (typeof window.__clearAuthAndRedirect__ === 'function') {
            window.__clearAuthAndRedirect__();
        } else if (window.__handleAuthError__(res)) {
            // no-op: global handler already redirected
        }

        const error = new Error('登录已失效，请重新登录');
        error.code = 'AUTH_REQUIRED';
        return error;
    };

    const requestMaintenanceJson = async (url, options = {}) => {
        const res = await fetch(url, {
            ...options,
            headers: {
                ...window.__getAuthHeaders__(),
                ...getTestRequestHeaders(),
                ...getAdminAuthHeaders(),
                ...(options.headers || {})
            }
        });
        const { data, text } = await parseApiResponse(res);
        if (handleTestSessionApiError(res, data)) {
            const error = new Error(data?.error || '测试会话已失效');
            error.code = data?.code || 'TEST_SESSION_INVALID';
            throw error;
        }

        const accessAuthError = buildAccessAuthError(res, data);
        if (accessAuthError) throw accessAuthError;

        if (!res.ok) {
            let message = data.error || '请求失败';
            if (res.status === 404 && url.startsWith('/api/maintenance/')) {
                message = '当前运行的后端尚未启用维护接口，请重启服务后重试';
            } else if (!data.error && text) {
                message = `服务返回异常响应（HTTP ${res.status}）`;
            }
            const error = new Error(message);
            error.code = data.code || (res.status === 404 && url.startsWith('/api/maintenance/')
                ? 'MAINTENANCE_API_MISSING'
                : `HTTP_${res.status}`);
            throw error;
        }
        return data;
    };

    const requestAttendanceJson = async (url, options = {}) => {
        const includeMaintenanceAuth = options?.includeMaintenanceAuth === true;
        const fetchOptions = { ...(options || {}) };
        delete fetchOptions.includeMaintenanceAuth;

        const res = await fetch(url, {
            ...fetchOptions,
            headers: {
                ...window.__getAuthHeaders__(),
                ...getTestRequestHeaders(),
                ...(includeMaintenanceAuth ? getAdminAuthHeaders() : {}),
                ...(fetchOptions.headers || {})
            }
        });
        const { data, text } = await parseApiResponse(res);
        if (handleTestSessionApiError(res, data)) {
            const error = new Error(data?.error || '测试会话已失效');
            error.code = data?.code || 'TEST_SESSION_INVALID';
            throw error;
        }

        const accessAuthError = buildAccessAuthError(res, data);
        if (accessAuthError) throw accessAuthError;

        if (res.status === 403 && data?.code === 'MAINTENANCE_AUTH_REQUIRED') {
            clearAdminAuth();
            const error = new Error(data?.error || '当前操作需要重新验证维护密码');
            error.code = data?.code || 'MAINTENANCE_AUTH_REQUIRED';
            throw error;
        }
        if (!res.ok) {
            const error = new Error(data?.error || text || '请求失败');
            error.code = data?.code || `HTTP_${res.status}`;
            throw error;
        }
        return data;
    };

    const fetchMaintenanceStatus = async () => requestMaintenanceJson('/api/maintenance/status');

    const unlockAdminAuth = async (password) => {
        const data = await requestMaintenanceJson('/api/maintenance/unlock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        setAdminAuthSession(data);
        return data;
    };

    const setupAdminAuth = async (password) => {
        const data = await requestMaintenanceJson('/api/maintenance/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        setAdminAuthSession(data);
        return data;
    };

    const changeAdminAuthPassword = async (currentPassword, newPassword) => {
        const data = await requestMaintenanceJson('/api/maintenance/change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        setAdminAuthSession(data);
        return data;
    };

    const requireAdminAuth = async (promptText = '请输入维护密码：') => {
        if (isAdminAuthed()) return true;
        const input = prompt(promptText);
        if (input === null) return false;
        try {
            await unlockAdminAuth(input.trim());
            return true;
        } catch (error) {
            if (error.code === 'MAINTENANCE_NOT_CONFIGURED') {
                alert('维护密码尚未初始化，请先进入“维护”页面完成设置。');
                return false;
            }
            if (error.code !== 'AUTH_REQUIRED') {
                alert(error.message || '维护密码验证失败');
            }
            return false;
        }
    };

    window.ClassManagerRuntime = {
        TEST_SESSION_INVALID_EVENT,
        initialTestSessionState,
        getStorageItem,
        setStorageItem,
        getSessionItem,
        setSessionItem,
        removeSessionItem,
        storeTestSessionState,
        clearStoredTestSessionState,
        applyTestRuntimeContext,
        handleTestSessionApiError,
        getTestRequestHeaders,
        getNow,
        getTodayStr,
        timeToMinutes,
        getDateString,
        DAY_MS,
        getStartOfDay,
        diffDays,
        getApiUrl,
        loadScriptOnce,
        clearAdminAuth,
        clearScopedTestArtifacts,
        isAdminAuthed,
        getAdminAuthHeaders,
        parseApiResponse,
        requestAttendanceJson,
        fetchMaintenanceStatus,
        unlockAdminAuth,
        setupAdminAuth,
        changeAdminAuthPassword,
        requireAdminAuth
    };
})();
