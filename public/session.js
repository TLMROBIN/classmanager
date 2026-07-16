(function () {
    const LOGIN_URL = '/login.html';
    const ADMIN_URL = '/admin.html';
    const USER_HOME_URL = '/';

    let currentUser = null;

    const safeRemoveItem = (storage, key) => {
        try {
            storage.removeItem(key);
        } catch (_) {
            // ignore storage access errors
        }
    };

    const clearAuthArtifacts = () => {
        currentUser = null;
        safeRemoveItem(localStorage, 'token');
        safeRemoveItem(localStorage, 'user');
        safeRemoveItem(localStorage, 'cm_battle_snapshots_v1');
        safeRemoveItem(sessionStorage, 'maintenance_token');
        safeRemoveItem(sessionStorage, 'maintenance_token_expires_at');
    };

    const clearUserPrivateCaches = () => {
        clearAuthArtifacts();
        safeRemoveItem(localStorage, 'class_manager_snapshots');
        safeRemoveItem(localStorage, 'class_manager_snapshot_last_date');
    };

    const redirectByRole = (user) => {
        window.location.replace(user && user.role === 'admin' ? ADMIN_URL : USER_HOME_URL);
    };

    const parseJsonResponse = async (res) => {
        const text = await res.text();
        if (!text) {
            return { data: null, text: '' };
        }

        try {
            return { data: JSON.parse(text), text };
        } catch (_) {
            return { data: null, text };
        }
    };

    const verifySession = async () => {
        const res = await fetch('/api/auth/verify', {
            cache: 'no-store',
            headers: { Accept: 'application/json' }
        });
        const { data } = await parseJsonResponse(res);

        if (res.ok && data && data.success && data.user) {
            currentUser = data.user;
            safeRemoveItem(localStorage, 'token');
            safeRemoveItem(localStorage, 'user');
            return currentUser;
        }

        currentUser = null;

        if (res.status === 401 || res.status === 404) {
            clearAuthArtifacts();
            return null;
        }

        const error = new Error(data && data.error ? data.error : '无法验证登录状态');
        error.status = res.status;
        throw error;
    };

    window.__getAuthHeaders__ = function () {
        return {};
    };

    window.__getCurrentUser__ = function () {
        return currentUser;
    };

    window.__isAdmin__ = function () {
        return currentUser && currentUser.role === 'admin';
    };

    window.__setCurrentUser__ = function (user) {
        currentUser = user || null;
        return currentUser;
    };

    window.__verifySession__ = verifySession;
    window.__resetUserPrivateCaches__ = clearUserPrivateCaches;
    window.__clearAuthAndRedirect__ = function () {
        try {
            sessionStorage.setItem('classmanager:auth-expired', String(Date.now()));
        } catch (_) {
            // The login page still works when storage is unavailable.
        }
        clearAuthArtifacts();
        window.location.replace(LOGIN_URL);
    };

    window.__handleAuthError__ = function (res) {
        const authErrorType = res && res.headers && typeof res.headers.get === 'function'
            ? res.headers.get('x-auth-error')
            : '';
        const requestUrl = res && typeof res.url === 'string' ? res.url : '';
        const isMaintenanceApi = requestUrl.includes('/api/maintenance/');

        if (res && res.status === 401 && (authErrorType === 'access-required' || !isMaintenanceApi)) {
            window.__clearAuthAndRedirect__();
            return true;
        }

        return false;
    };

    window.__logout__ = async function () {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { Accept: 'application/json' }
            });
        } catch (error) {
            console.error('登出请求失败:', error);
        } finally {
            clearAuthArtifacts();
            window.location.replace(LOGIN_URL);
        }
    };

    window.__redirectByRole__ = redirectByRole;
})();
