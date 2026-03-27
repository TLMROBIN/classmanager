(function() {
    window.createTasksView = function createTasksView(deps) {
        const { h, useState, Modal, Icon, requireAdminAuth, getNow } = deps || {};

        if (!h || !useState || !Modal || !Icon || !requireAdminAuth) {
            throw new Error('TasksView dependencies are missing');
        }

        const readNow = typeof getNow === 'function'
            ? getNow
            : () => new Date();

        return function TasksView({ students, tasks, setTasks, onClaimTask }) {
            const [currentUser, setCurrentUser] = useState("");
            const [isAdminMode, setIsAdminMode] = useState(false);
            const [showAddModal, setShowAddModal] = useState(false);
            const [newTask, setNewTask] = useState({ title: '', desc: '', points: 5, startTime: '', endTime: '' });

            const toggleAdminMode = async () => {
                if (isAdminMode) {
                    setIsAdminMode(false);
                } else {
                    if (await requireAdminAuth("请输入维护密码：")) setIsAdminMode(true);
                }
            };

            const handleAddTask = () => {
                if (!newTask.title || !newTask.points || !newTask.startTime || !newTask.endTime) return alert("请填写完整信息");
                const task = {
                    id: Date.now(),
                    ...newTask,
                    points: parseFloat(newTask.points),
                    claimedBy: []
                };
                setTasks(prev => [...(Array.isArray(prev) ? prev : []), task]);
                setShowAddModal(false);
                setNewTask({ title: '', desc: '', points: 5, startTime: '', endTime: '' });
            };

            const handleDeleteTask = (id) => {
                if (confirm("确定删除此任务吗？")) {
                    setTasks(prev => (Array.isArray(prev) ? prev : []).filter(t => t.id !== id));
                }
            };

            const handleResetAllTasks = () => {
                if (!confirm("确定将所有任务重置为未领取状态吗？")) return;
                setTasks(prev => (Array.isArray(prev) ? prev : []).map(t => ({ ...t, claimedBy: [] })));
                alert("已重置所有任务");
            };

            const taskList = Array.isArray(tasks) ? tasks : [];

            const handleClaimTask = (taskId) => {
                if (!currentUser) return alert("请先选择当前学生身份");

                const taskIndex = taskList.findIndex(t => t.id === taskId);
                if (taskIndex === -1) return;
                const task = taskList[taskIndex];

                const now = readNow();
                const start = new Date(task.startTime || 0);
                const end = new Date(task.endTime || 0);
                if (isNaN(start.getTime()) || isNaN(end.getTime())) return alert("任务时间无效");
                if (now < start) return alert("任务尚未开始");
                if (now > end) return alert("任务已结束");

                const claimed = task.claimedBy || [];
                if (claimed.length > 0) return alert("该任务已被领取");

                const ok = onClaimTask(taskId, currentUser);
                if (ok) alert("领取成功！获得 " + task.points + " 积分");
                else alert("领取失败，请重试");
            };

            const now = readNow();
            const displayedTasks = isAdminMode
                ? [...taskList].sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0))
                : taskList
                    .filter(t => new Date(t.endTime || 0) > now && new Date(t.startTime || 0) <= now)
                    .sort((a, b) => new Date(a.endTime || 0) - new Date(b.endTime || 0));

            return h("div", { className: "space-y-6 animate-fade-in" },
                h("div", { className: "bg-white p-4 rounded-xl shadow-sm flex justify-between items-center" },
                    h("div", { className: "flex items-center gap-2" },
                        h("span", { className: "font-bold text-gray-700" }, "我是:"),
                        h("select", { className: "border rounded p-2 text-sm w-40", value: currentUser, onChange: e => setCurrentUser(e.target.value) },
                            h("option", { value: "" }, "请选择..."),
                            (Array.isArray(students) ? students : []).map(s => h("option", { key: s.id, value: s.id }, s.name))
                        )
                    ),
                    h("button", {
                        onClick: toggleAdminMode,
                        className: `px-3 py-1 rounded text-xs font-bold border ${isAdminMode ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`
                    }, isAdminMode ? "退出管理" : "管理模式")
                ),

                isAdminMode && h("div", { className: "bg-blue-50 border border-blue-200 p-4 rounded-xl flex flex-wrap gap-3 justify-between items-center" },
                    h("h3", { className: "font-bold text-blue-800" }, "任务发布中心"),
                    h("div", { className: "flex flex-wrap gap-2" },
                        h("button", { onClick: () => setShowAddModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2" }, h(Icon, { name: "plus", size: 16 }), "发布新任务"),
                        h("button", { onClick: handleResetAllTasks, className: "bg-amber-600 text-white px-4 py-2 rounded shadow hover:bg-amber-700 flex items-center gap-2" }, h(Icon, { name: "refresh", size: 16 }), "重置所有任务")
                    )
                ),

                h("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
                    displayedTasks.length === 0
                        ? h("div", { className: "col-span-full text-center text-gray-400 py-10" }, "暂无可用任务")
                        : displayedTasks.map(task => {
                            const start = new Date(task.startTime || 0);
                            const end = new Date(task.endTime || 0);
                            const isActive = !isNaN(start) && !isNaN(end) && now >= start && now <= end;
                            const isExpired = now > end;
                            const isUpcoming = now < start;
                            const claimedIds = task.claimedBy || [];
                            const isClaimed = claimedIds.length > 0;
                            const claimerId = claimedIds[0];
                            const claimer = claimerId != null ? (Array.isArray(students) ? students : []).find(s => String(s.id) === String(claimerId)) : null;
                            const claimerLabel = claimer ? claimer.name : (claimerId != null ? "未知" : "");

                            return h("div", { key: task.id, className: `bg-white rounded-xl shadow-sm border-2 p-4 flex flex-col relative ${isExpired ? 'border-gray-200 opacity-60' : isActive ? 'border-blue-500' : 'border-yellow-400'}` },
                                isClaimed && h("div", { className: "absolute top-2 right-2 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold" }, claimerLabel ? `已领取 · ${claimerLabel}` : "已领取"),
                                h("div", { className: "font-bold text-lg text-gray-800 mb-1" }, task.title),
                                h("div", { className: "text-sm text-gray-500 mb-3 flex-1" }, task.desc),

                                h("div", { className: "text-xs text-gray-400 mb-4 space-y-1" },
                                    h("div", null, `开始: ${start.toLocaleString()}`),
                                    h("div", null, `结束: ${end.toLocaleString()}`)
                                ),

                                h("div", { className: "flex justify-between items-center mt-auto" },
                                    h("span", { className: "text-orange-500 font-bold text-lg" }, `+${task.points} 分`),
                                    isAdminMode ? (
                                        h("button", { onClick: () => handleDeleteTask(task.id), className: "text-red-500 hover:bg-red-50 p-2 rounded" }, h(Icon, { name: "trash", size: 16 }))
                                    ) : (
                                        h("button", {
                                            onClick: () => handleClaimTask(task.id),
                                            disabled: !isActive || isClaimed || !currentUser,
                                            className: `px-4 py-2 rounded text-sm font-bold text-white transition ${isClaimed ? 'bg-green-500' : !isActive ? 'bg-gray-400 cursor-not-allowed' : !currentUser ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg transform active:scale-95'}`
                                        }, isClaimed ? "已领取" : isUpcoming ? "未开始" : isExpired ? "已结束" : "立即领取")
                                    )
                                )
                            );
                        })
                ),

                h(Modal, {
                    isOpen: showAddModal,
                    title: "发布限时任务",
                    onClose: () => setShowAddModal(false),
                    onConfirm: handleAddTask,
                    confirmText: "发布"
                },
                    h("div", { className: "space-y-4" },
                        h("div", null,
                            h("label", { className: "block text-sm font-bold text-gray-700 mb-1" }, "任务标题"),
                            h("input", { className: "w-full border rounded p-2", value: newTask.title, onChange: e => setNewTask({ ...newTask, title: e.target.value }) })
                        ),
                        h("div", null,
                            h("label", { className: "block text-sm font-bold text-gray-700 mb-1" }, "任务描述"),
                            h("textarea", { className: "w-full border rounded p-2", rows: 3, value: newTask.desc, onChange: e => setNewTask({ ...newTask, desc: e.target.value }) })
                        ),
                        h("div", null,
                            h("label", { className: "block text-sm font-bold text-gray-700 mb-1" }, "奖励分值"),
                            h("input", { type: "number", className: "w-full border rounded p-2", value: newTask.points, onChange: e => setNewTask({ ...newTask, points: e.target.value }) })
                        ),
                        h("div", { className: "grid grid-cols-2 gap-4" },
                            h("div", null,
                                h("label", { className: "block text-sm font-bold text-gray-700 mb-1" }, "开始时间"),
                                h("input", { type: "datetime-local", className: "w-full border rounded p-2", value: newTask.startTime, onChange: e => setNewTask({ ...newTask, startTime: e.target.value }) })
                            ),
                            h("div", null,
                                h("label", { className: "block text-sm font-bold text-gray-700 mb-1" }, "结束时间"),
                                h("input", { type: "datetime-local", className: "w-full border rounded p-2", value: newTask.endTime, onChange: e => setNewTask({ ...newTask, endTime: e.target.value }) })
                            )
                        )
                    )
                )
            );
        };
    };
})();
