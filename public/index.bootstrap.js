(function () {
    const root = document.getElementById('root');

    const APP_SCRIPTS = [
        '/core/runtime.js',
        '/core/import-guards.js',
        '/core/schema.js',
        '/core/sync.js',
        '/core/store.js',
        '/ui/modal.js',
        '/points/config.js',
        '/points/controller.js',
        '/attendance/points.js',
        '/attendance/admin-tools.js',
        '/attendance/module.js',
        '/attendance/settings.js',
        '/treasure/points.js',
        '/treasure/actions.js',
        '/treasure/io.js',
        '/treasure/module.js',
        '/nav/module.js',
        '/dashboard/module.js',
        '/operations/ui-state.js',
        '/operations/selectors.js',
        '/operations/builders.js',
        '/operations/actions.js',
        '/operations/views.js',
        '/operations/settings.js',
        '/operations/history-section.js',
        '/operations/admin-tools.js',
        '/operations/module.js',
        '/profile/utils.js',
        '/profile/avatar-ui.js',
        '/profile/persistence.js',
        '/script.js'
    ];

    const setStatus = (message) => {
        if (!root) return;
        root.textContent = message;
    };

    const loadScript = (src) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`加载脚本失败: ${src}`));
        document.body.appendChild(script);
    });

    const loadScriptsSequentially = async (scripts) => {
        for (const src of scripts) {
            await loadScript(src);
        }
    };

    window.__MULTI_USER_MODE__ = true;

    void (async () => {
        try {
            setStatus('正在验证登录状态...');
            const user = await window.__verifySession__();

            if (!user) {
                window.location.replace('/login.html');
                return;
            }

            if (user.role !== 'user') {
                window.location.replace('/admin.html');
                return;
            }

            setStatus('正在加载班级管理系统...');
            await loadScriptsSequentially(APP_SCRIPTS);
        } catch (error) {
            console.error('初始化主页面失败:', error);
            setStatus(error.message || '页面初始化失败，请刷新重试');
        }
    })();
})();
