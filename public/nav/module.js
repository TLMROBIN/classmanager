(function() {
    window.createNavView = function createNavView(deps) {
        const {
            h,
            Icon,
            getSystemConfig,
            getCurrentUser,
            logout
        } = deps || {};

        if (!h || !Icon || !getSystemConfig || !getCurrentUser || !logout) {
            throw new Error('Nav dependencies are missing');
        }

        return function Nav({ activeTab, setActiveTab, syncStatus, config }) {
            const systemConfig = getSystemConfig(config);
            const battleEnabled = systemConfig.enabledFeatures?.battle ?? true;
            const petEnabled = systemConfig.enabledFeatures?.pet === true;
            const currentUser = getCurrentUser();
            const tabs = [
                { id: 'dashboard', label: '仪表盘', icon: 'chart' },
                { id: 'operations', label: '积分', icon: 'star' },
                { id: 'attendance', label: '考勤', icon: 'clock' },
                { id: 'tasks', label: '任务', icon: 'tasks' },
                { id: 'battle', label: '双子星', icon: 'swords', requiresFeature: 'battle' },
                { id: 'pet', label: '宠物', icon: 'heart', requiresFeature: 'pet' },
                { id: 'treasure', label: '藏宝阁', icon: 'gift' },
                { id: 'profile', label: '头像', icon: 'smile' },
                { id: 'settings', label: '维护', icon: 'menu' }
            ].filter(item => {
                if (item.requiresFeature === 'battle') return battleEnabled;
                if (item.requiresFeature === 'pet') return petEnabled;
                return true;
            });

            const getSyncIcon = () => {
                if (syncStatus === 'success' || syncStatus === 'saved') {
                    return h(Icon, { name: "cloud", className: "text-green-500", size: 16 });
                }
                if (syncStatus === 'unsaved' || syncStatus === 'error') {
                    return h(Icon, { name: "wifiOff", className: "text-red-500", size: 16 });
                }
                return h(Icon, { name: "wifi", className: "text-gray-400", size: 16 });
            };

            return h("nav", { className: "bg-white border-b sticky top-0 z-30 px-4" },
                h("div", { className: "max-w-6xl mx-auto flex justify-between items-center" },
                    h("div", { className: "flex gap-6 overflow-x-auto scrollbar-hide flex-1" },
                        tabs.map(item =>
                            h("button", {
                                key: item.id,
                                onClick: () => setActiveTab(item.id),
                                className: `flex items-center gap-2 py-4 px-2 border-b-2 font-medium transition whitespace-nowrap ${activeTab === item.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`
                            }, h(Icon, { name: item.icon }), item.label)
                        )
                    ),
                    h("div", { className: "ml-4 flex items-center gap-3 text-xs shrink-0" },
                        h("div", { className: "flex items-center gap-2", title: "数据同步状态" },
                            getSyncIcon(),
                            h("span", { className: syncStatus === 'error' || syncStatus === 'unsaved' ? 'text-red-500' : 'text-gray-500' },
                                syncStatus === 'success' ? '已同步' :
                                syncStatus === 'saved' ? '已保存' :
                                syncStatus === 'unsaved' ? '未同步' : '连接异常'
                            )
                        ),
                        currentUser && h("div", { className: "flex items-center gap-2 border-l pl-3 ml-1" },
                            h("span", { className: "font-medium text-gray-700" }, currentUser.username),
                            currentUser.role === 'admin' && h("a", {
                                href: "/admin.html",
                                className: "px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-xs font-medium transition"
                            }, "管理后台"),
                            h("button", {
                                onClick: () => logout(),
                                className: "px-2 py-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                            }, "退出")
                        )
                    )
                )
            );
        };
    };
})();
