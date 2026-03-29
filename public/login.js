(function () {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const loading = document.getElementById('loading');
    const loginButton = document.getElementById('loginButton');
    const registerButton = document.getElementById('registerButton');
    const changePasswordButton = document.getElementById('changePasswordButton');
    const showRegisterButton = document.getElementById('showRegisterButton');
    const showLoginButton = document.getElementById('showLoginButton');
    const showChangePasswordButton = document.getElementById('showChangePasswordButton');
    const showLoginFromChangeButton = document.getElementById('showLoginFromChangeButton');
    let activeView = 'login';

    const showOnly = (target) => {
        activeView = target;
        loginForm.classList.toggle('hidden', target !== 'login');
        registerForm.classList.toggle('hidden', target !== 'register');
        changePasswordForm.classList.toggle('hidden', target !== 'changePassword');
    };

    const showRegister = () => {
        showOnly('register');
    };

    const showLogin = () => {
        showOnly('login');
    };

    const showChangePassword = () => {
        const loginUsername = document.getElementById('username').value.trim();
        const changeUsername = document.getElementById('changeUsername');
        if (loginUsername && changeUsername && !changeUsername.value.trim()) {
            changeUsername.value = loginUsername;
        }
        showOnly('changePassword');
    };

    const showLoading = (show) => {
        if (show) {
            loginForm.classList.add('hidden');
            registerForm.classList.add('hidden');
            changePasswordForm.classList.add('hidden');
        } else {
            showOnly(activeView);
        }
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

    const handleChangePassword = async () => {
        const username = document.getElementById('changeUsername').value.trim();
        const currentPassword = document.getElementById('changeCurrentPassword').value;
        const newPassword = document.getElementById('changeNewPassword').value;
        const confirmPassword = document.getElementById('changeConfirmPassword').value;

        if (!username || !currentPassword || !newPassword) {
            alert('请填写用户名、当前密码和新密码');
            return;
        }

        if (newPassword.length < 6) {
            alert('新密码长度至少6个字符');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('两次输入的新密码不一致');
            return;
        }

        showLoading(true);

        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, currentPassword, newPassword })
            });
            const data = await parseJsonResponse(res);

            if (res.ok && data && data.success) {
                alert(data.message || '密码修改成功');
                document.getElementById('username').value = username;
                document.getElementById('password').value = '';
                document.getElementById('changeCurrentPassword').value = '';
                document.getElementById('changeNewPassword').value = '';
                document.getElementById('changeConfirmPassword').value = '';
                showLoading(false);
                showLogin();
                return;
            }

            alert((data && data.error) || '修改密码失败');
        } catch (error) {
            console.error('修改密码失败:', error);
            alert('网络错误，请重试');
        }

        showLoading(false);
    };

    loginButton.addEventListener('click', handleLogin);
    registerButton.addEventListener('click', handleRegister);
    changePasswordButton.addEventListener('click', handleChangePassword);
    showRegisterButton.addEventListener('click', showRegister);
    showLoginButton.addEventListener('click', showLogin);
    showChangePasswordButton.addEventListener('click', showChangePassword);
    showLoginFromChangeButton.addEventListener('click', showLogin);

    document.addEventListener('keypress', (event) => {
        if (event.key !== 'Enter') return;

        if (!loginForm.classList.contains('hidden')) {
            void handleLogin();
            return;
        }

        if (!registerForm.classList.contains('hidden')) {
            void handleRegister();
            return;
        }

        if (!changePasswordForm.classList.contains('hidden')) {
            void handleChangePassword();
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
