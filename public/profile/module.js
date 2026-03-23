(function() {
    window.createProfileView = function createProfileView(deps) {
        const {
            h,
            useState,
            Modal,
            Icon,
            requireAdminAuth
        } = deps || {};
        const profileUtils = window.ProfileUtils || {};
        const {
            compressImage,
            normalizeStudentProfiles,
            getStudentProfile,
            getAvatar,
            handleAvatarError
        } = profileUtils;

        if (!h || !useState || !Modal || !Icon || !requireAdminAuth || !compressImage || !normalizeStudentProfiles || !getStudentProfile || !getAvatar || !handleAvatarError) {
            throw new Error('ProfileView dependencies are missing');
        }

        return function ProfileView({ students, studentProfiles, setStudentProfiles, history, adminPassword }) {
            const [viewHistoryStudent, setViewHistoryStudent] = useState(null);
            const [filterType, setFilterType] = useState('all');

            const updateStudentProfile = (studentId, patch) => {
                setStudentProfiles(prev => {
                    const normalized = normalizeStudentProfiles(prev, students);
                    const student = (students || []).find(item => String(item.id) === String(studentId)) || null;
                    const current = getStudentProfile(normalized, studentId, student);
                    const nextEntry = {
                        avatarHappy: patch.avatarHappy !== undefined ? patch.avatarHappy : current.avatarHappy,
                        avatarSad: patch.avatarSad !== undefined ? patch.avatarSad : current.avatarSad,
                        titleLeft: patch.titleLeft !== undefined ? patch.titleLeft : current.titleLeft,
                        titleRight: patch.titleRight !== undefined ? patch.titleRight : current.titleRight
                    };
                    const nextEntries = { ...(normalized.entries || {}) };
                    if (nextEntry.avatarHappy || nextEntry.avatarSad || nextEntry.titleLeft || nextEntry.titleRight) {
                        nextEntries[String(studentId)] = nextEntry;
                    } else {
                        delete nextEntries[String(studentId)];
                    }
                    return {
                        version: Number(normalized.version) || 1,
                        entries: nextEntries
                    };
                });
            };

            const handleAvatarUpload = (studentId, mood, file) => {
                if (!file) return;
                if (!requireAdminAuth("修改头像需要管理员权限，请输入密码：", adminPassword || window.DEFAULT_ADMIN_PASSWORD)) return;
                compressImage(file, (base64) => {
                    updateStudentProfile(studentId, mood === 'happy' ? { avatarHappy: base64 } : { avatarSad: base64 });
                });
            };

            const handleSetTitle = (studentId, side) => {
                const student = (students || []).find(item => item.id === studentId);
                if (!student) return;
                if (!requireAdminAuth("设置称号需要管理员权限，请输入密码：", adminPassword || window.DEFAULT_ADMIN_PASSWORD)) return;

                const currentProfile = getStudentProfile(studentProfiles, student.id, student);
                const currentValue = side === 'left' ? (currentProfile.titleLeft || "") : (currentProfile.titleRight || "");
                const newTitle = prompt(`请输入${side === 'left' ? '左侧' : '右侧'}称号（最多4个字）：`, currentValue);

                if (newTitle === null) return;
                const trimmed = newTitle.trim();
                if (trimmed.length > 4) return alert("称号长度不能超过4个字");

                updateStudentProfile(studentId, side === 'left' ? { titleLeft: trimmed } : { titleRight: trimmed });
            };

            const getFilteredRecords = () => {
                if (!viewHistoryStudent) return [];
                const records = (Array.isArray(history) ? history : []).filter(item => item.studentId === viewHistoryStudent.id);
                if (filterType === 'all') return records;
                if (filterType === 'bonus') return records.filter(item => item.val > 0);
                if (filterType === 'penalty') return records.filter(item => item.val < 0 && !item.reason.includes('兑换') && !item.reason.includes('祈愿'));
                if (filterType === 'spending') return records.filter(item => item.reason.includes('兑换') || item.reason.includes('祈愿'));
                return records;
            };

            const records = getFilteredRecords();

            return h("div", { className: "bg-white p-6 rounded-xl shadow-sm animate-fade-in" },
                h("h3", { className: "font-bold text-lg mb-6 flex items-center gap-2" }, h(Icon, { name: "money" }), "全班余额监控 (点击卡片查看详情)"),
                h("div", { className: "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4" },
                    (Array.isArray(students) ? students : []).map(student => {
                        const profile = getStudentProfile(studentProfiles, student.id, student);
                        return h("div", {
                            key: student.id,
                            onClick: (e) => {
                                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
                                    setViewHistoryStudent(student);
                                }
                            },
                            className: "border rounded-lg p-3 flex flex-col items-center gap-2 relative group cursor-pointer hover:shadow-md transition"
                        },
                        h("label", { className: "absolute top-1 left-1 opacity-0 group-hover:opacity-100 cursor-pointer bg-white/80 p-1 rounded z-10", title: "上传开心" }, h(Icon, { name: "smile", size: 14 }), h("input", { type: "file", className: "hidden", accept: "image/*", onChange: e => handleAvatarUpload(student.id, 'happy', e.target.files[0]) })),
                        h("label", { className: "absolute top-1 right-1 opacity-0 group-hover:opacity-100 cursor-pointer bg-white/80 p-1 rounded z-10", title: "上传难过" }, h(Icon, { name: "frown", size: 14 }), h("input", { type: "file", className: "hidden", accept: "image/*", onChange: e => handleAvatarUpload(student.id, 'sad', e.target.files[0]) })),
                            h("div", { className: "flex items-center gap-2 w-full justify-center" },
                                (profile.titleLeft || profile.titleRight) && h("div", { className: "absolute -top-2 left-0 right-0 flex justify-center gap-1 pointer-events-none" },
                                    profile.titleLeft && h("span", { className: "bg-amber-500 text-white text-[8px] px-1 rounded-sm shadow-sm" }, profile.titleLeft),
                                    profile.titleRight && h("span", { className: "bg-blue-500 text-white text-[8px] px-1 rounded-sm shadow-sm" }, profile.titleRight)
                                ),
                                h("div", {
                                    className: "text-[10px] bg-amber-100 text-amber-800 px-1 rounded cursor-pointer min-w-[20px] h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition",
                                    onClick: (e) => { e.stopPropagation(); handleSetTitle(student.id, 'left'); },
                                    title: "设置左称号"
                                }, profile.titleLeft || "+"),
                                h("img", { src: getAvatar(student, studentProfiles, 'happy'), className: "w-12 h-12 rounded-full", onError: (e) => handleAvatarError(e, student.name, 'happy') }),
                                h("div", {
                                    className: "text-[10px] bg-blue-100 text-blue-800 px-1 rounded cursor-pointer min-w-[20px] h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition",
                                    onClick: (e) => { e.stopPropagation(); handleSetTitle(student.id, 'right'); },
                                    title: "设置右称号"
                                }, profile.titleRight || "+")
                            ),
                        h("div", { className: "font-bold text-gray-800" }, student.name),
                        h("div", { className: `text-lg font-mono font-bold ${student.balance < 0 ? 'text-red-500' : 'text-green-600'}` }, student.balance)
                    );
                    })
                ),

                viewHistoryStudent && h(Modal, {
                    isOpen: !!viewHistoryStudent,
                    title: `${viewHistoryStudent.name} 的积分记录`,
                    onClose: () => setViewHistoryStudent(null)
                },
                    h("div", { className: "space-y-4" },
                        h("div", { className: "flex gap-2 overflow-x-auto pb-2" },
                            ['all', 'bonus', 'penalty', 'spending'].map(type =>
                                h("button", {
                                    key: type,
                                    onClick: () => setFilterType(type),
                                    className: `px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${filterType === type ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`
                                }, { all: '全部', bonus: '奖励', penalty: '扣分', spending: '消费' }[type])
                            )
                        ),
                        h("div", { className: "max-h-80 overflow-y-auto border rounded-lg" },
                            h("table", { className: "w-full text-sm text-left" },
                                h("thead", { className: "bg-gray-50 sticky top-0" },
                                    h("tr", null,
                                        h("th", { className: "p-2 font-medium text-gray-500" }, "时间"),
                                        h("th", { className: "p-2 font-medium text-gray-500" }, "事项"),
                                        h("th", { className: "p-2 font-medium text-gray-500 text-right" }, "变动"),
                                        h("th", { className: "p-2 font-medium text-gray-500 text-right" }, "余额")
                                    )
                                ),
                                h("tbody", { className: "divide-y" },
                                    records.length === 0 ? h("tr", null, h("td", { colSpan: 4, className: "p-4 text-center text-gray-400" }, "暂无相关记录")) :
                                    records.map(record =>
                                        h("tr", { key: record.id, className: "hover:bg-gray-50" },
                                            h("td", { className: "p-2 text-xs text-gray-400" }, new Date(record.ts).toLocaleString()),
                                            h("td", { className: "p-2" }, record.reason),
                                            h("td", { className: `p-2 font-bold text-right ${record.val > 0 ? 'text-green-600' : 'text-red-500'}` }, record.val > 0 ? `+${record.val}` : record.val),
                                            h("td", { className: "p-2 text-right font-mono text-gray-600" }, record.snapshot ? record.snapshot.balance : '-')
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            );
        };
    };
})();
