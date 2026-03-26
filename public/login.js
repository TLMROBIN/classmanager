(function () {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loading = document.getElementById('loading');
    const loginButton = document.getElementById('loginButton');
    const registerButton = document.getElementById('registerButton');
    const showRegisterButton = document.getElementById('showRegisterButton');
    const showLoginButton = document.getElementById('showLoginButton');

    const showRegister = () => {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    };

    const showLogin = () => {
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    };

    const showLoading = (show) => {
        loginForm.classList.toggle('hidden', show);
        registerForm.classList.toggle('hidden', show);
        loading.classList.toggle('hidden', !show);
    };

    const parseJsonResponse = async (res) => {
        const text = await res.text();
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch (_) {
            return null;
        }
    };

    const handleAuthSuccess = (user) => {
        window.__resetUserPrivateCaches__();
        window.__setCurrentUser__(user);
        window.__redirectByRole__(user);
    };

    const handleLogin = async () => {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            alert('请输入用户名和密码');
            return;
        }

        showLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await parseJsonResponse(res);

            if (res.ok && data && data.success && data.user) {
                handleAuthSuccess(data.user);
                return;
            }

            alert((data && data.error) || '登录失败');
        } catch (error) {
            console.error('登录失败:', error);
            alert('网络错误，请重试');
        }

        showLoading(false);
    };

    const handleRegister = async () => {
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;

        if (!username || !password) {
            alert('请填写用户名和密码');
            return;
        }

        if (username.length < 3 || username.length > 20) {
            alert('用户名长度需在3-20个字符之间');
            return;
        }

        if (password.length < 6) {
            alert('密码长度至少6个字符');
            return;
        }

        if (password !== confirmPassword) {
            alert('两次输入的密码不一致');
            return;
        }

        showLoading(true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, email })
            });
            const data = await parseJsonResponse(res);

            if (res.ok && data && data.success && data.user) {
                handleAuthSuccess(data.user);
                return;
            }

            alert((data && data.error) || '注册失败');
        } catch (error) {
            console.error('注册失败:', error);
            alert('网络错误，请重试');
        }

        showLoading(false);
    };

    loginButton.addEventListener('click', handleLogin);
    registerButton.addEventListener('click', handleRegister);
    showRegisterButton.addEventListener('click', showRegister);
    showLoginButton.addEventListener('click', showLogin);

    document.addEventListener('keypress', (event) => {
        if (event.key !== 'Enter') return;

        if (!loginForm.classList.contains('hidden')) {
            void handleLogin();
            return;
        }

        if (!registerForm.classList.contains('hidden')) {
            void handleRegister();
        }
    });

    void (async () => {
        try {
            const user = await window.__verifySession__();
            if (user) {
                window.__redirectByRole__(user);
            }
        } catch (error) {
            console.error('验证现有登录态失败:', error);
        }
    })();
})();
