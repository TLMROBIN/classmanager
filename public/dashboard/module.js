(function() {
    window.createDashboardView = function createDashboardView(deps) {
        const {
            h,
            useState,
            useMemo,
            Icon,
            requireAdminAuth,
            getNow,
            getDateString,
            getStartOfDay,
            DAY_MS,
            getSystemConfig,
            getCustomRoles,
            getCommissionerRoles,
            getGroupsConfig,
            normalizePointScene,
            normalizePointCategory,
            getProfileAvatarUI
        } = deps || {};

        if (!h || !useState || !useMemo || !Icon || !requireAdminAuth || !getNow || !getDateString || !getStartOfDay || !DAY_MS || !getSystemConfig || !getCustomRoles || !getCommissionerRoles || !getGroupsConfig || !normalizePointScene || !normalizePointCategory || !getProfileAvatarUI) {
            throw new Error('DashboardView dependencies are missing');
        }

        return function DashboardView({ students, studentProfiles, history, config, setConfig, updatePoints, handleUndo }) {
            const profileAvatarUI = getProfileAvatarUI();
            const studentsWithDefaults = (Array.isArray(students) ? students : []).map(student => ({
                ...student,
                zizai: student.zizai ?? 0,
                penalty: student.penalty ?? 0
            }));
            const sortedZizai = [...studentsWithDefaults].sort((a, b) => (b.zizai || 0) - (a.zizai || 0)).slice(0, 5);
            const sortedPenalty = [...studentsWithDefaults].sort((a, b) => (b.penalty || 0) - (a.penalty || 0)).slice(0, 5);

            const [dormChartRange, setDormChartRange] = useState(() => {
                const now = getNow();
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                return { start: getDateString(start), end: getDateString(end) };
            });

            const dormStats = useMemo(() => {
                const stats = {};
                const systemConfig = getSystemConfig(config);
                const dorms = systemConfig.organization.dorms || [];

                dorms.forEach(dorm => {
                    stats[dorm.id] = { name: dorm.name, bonus: 0, discipline: 0, hygiene: 0 };
                });

                const startTime = new Date(dormChartRange.start).getTime();
                const endTime = new Date(dormChartRange.end).getTime() + 86399999;

                (Array.isArray(history) ? history : []).forEach(item => {
                    if (normalizePointScene(item.scene) !== "宿舍") return;
                    if (item.ts < startTime || item.ts > endTime) return;

                    const student = (Array.isArray(students) ? students : []).find(s => s.id === item.studentId);
                    if (!student || !student.dorm || !stats[student.dorm]) return;

                    const val = Number(item.val) || 0;
                    if (val > 0) {
                        stats[student.dorm].bonus += val;
                    } else if (val < 0) {
                        const category = normalizePointCategory(item.category);
                        if (category === "卫生") {
                            stats[student.dorm].hygiene += Math.abs(val);
                        } else {
                            stats[student.dorm].discipline += Math.abs(val);
                        }
                    }
                });
                return Object.values(stats);
            }, [history, dormChartRange, students, config]);

            const rawRecent = (Array.isArray(history) ? history : []).filter(item => (new Date() - new Date(item.ts)) < 48 * 3600000);
            const aggregatedHistory = [];
            const wageMap = {};
            const wageGroupNameMap = new Map(((getSystemConfig(config).organization?.groups) || []).map(group => [group.id, group.name || group.id]));
            const handleProtectedUndo = async (recordId) => {
                if (!await requireAdminAuth("撤销积分记录需要维护密码，请输入：")) return;
                handleUndo(recordId);
            };
            const wageGroupLabels = (() => {
                const groupIds = Array.isArray(getSystemConfig(config).points?.dailyWageGroups)
                    ? getSystemConfig(config).points.dailyWageGroups
                    : ['discipline', 'hygiene'];
                const labels = groupIds
                    .map(id => wageGroupNameMap.get(id) || id)
                    .filter(Boolean)
                    .map(name => String(name).replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '').trim());
                return labels.length > 0 ? labels.join('/') : "工资组";
            })();

            rawRecent.forEach(item => {
                if (item.reason === "每日工资") {
                    const dateKey = getDateString(new Date(item.ts));
                    if (!wageMap[dateKey]) {
                        const aggItem = {
                            id: `agg_wage_${dateKey}`,
                            ts: item.ts,
                            studentName: wageGroupLabels,
                            reason: "每日工资",
                            val: 0,
                            count: 0,
                            isAggregated: true
                        };
                        wageMap[dateKey] = aggItem;
                        aggregatedHistory.push(aggItem);
                    }
                    wageMap[dateKey].val += item.val;
                    wageMap[dateKey].count++;
                } else {
                    aggregatedHistory.push(item);
                }
            });

            aggregatedHistory.sort((a, b) => b.ts - a.ts);
            const recentHistory = aggregatedHistory.slice(0, 100);

            const isValidScheduleDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
            const scheduleNotes = Object.entries((config && config.scheduleNotes) ? config.scheduleNotes : {})
                .reduce((acc, [date, note]) => {
                    const safeDate = String(date || '').trim();
                    const safeNote = String(note || '').trim();
                    if (!isValidScheduleDate(safeDate) || !safeNote) return acc;
                    acc[safeDate] = safeNote;
                    return acc;
                }, {});
            const scheduleDays = (() => {
                const now = getNow();
                const list = [];
                for (let i = 0; i < 8; i++) {
                    const date = new Date(now);
                    date.setDate(now.getDate() + i);
                    const dateStr = getDateString(date);
                    const day = date.getDay();
                    list.push({ date: dateStr, label: `${dateStr} 周${['日','一','二','三','四','五','六'][day]}` });
                }
                return list;
            })();
            const scheduleDisplayDays = scheduleDays
                .map(day => ({
                    ...day,
                    note: String(scheduleNotes[day.date] || '').trim()
                }))
                .filter(day => day.note);

            const countdownEvents = Array.isArray(config?.countdownEvents) ? config.countdownEvents : [];
            const countdownList = useMemo(() => {
                const today = getStartOfDay(getNow());
                return countdownEvents
                    .filter(item => item && item.name && item.date)
                    .map(item => {
                        const target = getStartOfDay(new Date(item.date));
                        const diff = Math.ceil((target - today) / DAY_MS);
                        return { ...item, diff };
                    })
                    .sort((a, b) => a.diff - b.diff);
            }, [countdownEvents]);

            const customRoleAnnouncements = useMemo(() => {
                return getCustomRoles(config)
                    .map((role, idx) => {
                        const student = (Array.isArray(students) ? students : []).find(s => String(s.id) === String(role.studentId));
                        return {
                            id: role.id || `custom_role_${idx + 1}`,
                            name: role.name || `职务${idx + 1}`,
                            studentName: student ? student.name : "",
                            dailyWage: Number.isFinite(Number(role.dailyWage)) ? Number(role.dailyWage) : 0
                        };
                    })
                    .filter(role => role.studentName);
            }, [config, students]);

            const commissionerAnnouncements = useMemo(() => {
                return getCommissionerRoles(config)
                    .map((role, idx) => {
                        const student = (Array.isArray(students) ? students : []).find(s => String(s.id) === String(role.studentId));
                        return {
                            id: role.id || `commissioner_${idx + 1}`,
                            name: role.name || `纪律专员${idx + 1}`,
                            studentName: student ? student.name : ""
                        };
                    })
                    .filter(item => item.studentName);
            }, [config, students]);

            const hygieneDutyAnnouncements = useMemo(() => {
                const dayNameMap = { mon: "周一", tue: "周二", wed: "周三", thu: "周四", fri: "周五" };
                const safeStudents = Array.isArray(students) ? students : [];
                return Object.entries(config.duty || {})
                    .map(([day, dutyList]) => ({
                        id: day,
                        name: dayNameMap[day] || day,
                        members: (Array.isArray(dutyList) ? dutyList : [])
                            .map((member) => {
                                const text = String(member || '').trim();
                                if (!text) return '';
                                const matchedStudent = safeStudents.find((student) => (
                                    String(student.id) === text || String(student.name || '').trim() === text
                                ));
                                return matchedStudent ? matchedStudent.name : text;
                            })
                            .filter(Boolean)
                    }))
                    .filter(item => item.members.length > 0);
            }, [config, students]);

            const penaltyLastMap = useMemo(() => {
                const map = new Map();
                (Array.isArray(history) ? history : []).forEach(item => {
                    if (!item || item.studentId == null) return;
                    if (item.isUndoLog) return;
                    if (item.type !== 'penalty') return;
                    if (!(Number(item.val) < 0)) return;
                    const studentKey = String(item.studentId);
                    const prev = map.get(studentKey) || 0;
                    if (item.ts > prev) map.set(studentKey, item.ts);
                });
                return map;
            }, [history]);

            const penaltyDecayConfig = useMemo(() => {
                const pointsConfig = getSystemConfig(config).points || {};
                const cycleDays = Math.max(0, Math.floor(Number(pointsConfig.penaltyDecayDays) || 0));
                const decayAmount = Math.max(0, Number(pointsConfig.penaltyDecayAmount) || 0);
                return { cycleDays, decayAmount };
            }, [config]);

            const formatPenaltyDecayValue = (value) => {
                const numeric = Number(value) || 0;
                return Number.isInteger(numeric) ? String(numeric) : String(Number(numeric.toFixed(2)));
            };

            const getNoPenaltyText = (student) => {
                const { cycleDays, decayAmount } = penaltyDecayConfig;
                if (cycleDays <= 0 || decayAmount <= 0) return "扣分衰减已关闭";

                const penaltyVal = Math.max(0, Number(student.penalty) || 0);
                if (penaltyVal <= 0) return "当前无待衰减扣分";

                const lastFromHistory = penaltyLastMap.get(String(student.id)) || 0;
                const lastPenaltyAt = Math.max(Number(student.lastPenaltyAt) || 0, lastFromHistory || 0);
                const nextReduce = Math.min(decayAmount, penaltyVal);
                if (!lastPenaltyAt) {
                    return `再有${cycleDays}天不扣分，即可减${formatPenaltyDecayValue(nextReduce)}分`;
                }

                const nowTs = getNow().getTime();
                const nextDecayAt = lastPenaltyAt + (cycleDays * DAY_MS);
                const remainingMs = nextDecayAt - nowTs;
                const remainingDays = Math.max(0, Math.ceil(remainingMs / DAY_MS));
                if (remainingDays <= 0) {
                    return `已达到减${formatPenaltyDecayValue(nextReduce)}分条件`;
                }
                return `再有${remainingDays}天不扣分，即可减${formatPenaltyDecayValue(nextReduce)}分`;
            };

            return h("div", { className: "space-y-6 animate-fade-in" },
                h("div", { className: "bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-3 items-center" },
                    h("h3", { className: "font-bold text-gray-800 flex items-center gap-2" }, h(Icon, { name: "clock" }), "倒数日"),
                    countdownList.length === 0 ? h("span", { className: "text-sm text-gray-400" }, "暂无倒数日") :
                    h("div", { className: "flex flex-wrap gap-2" },
                        countdownList.map(item => h("div", { key: item.id || `${item.name}-${item.date}`, className: "px-3 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100" }, `${item.name} ${item.diff >= 0 ? `还有${item.diff}天` : `已过${Math.abs(item.diff)}天`}`))
                    )
                ),
                h("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6" },
                    h("div", { className: "space-y-6" },
                        scheduleDisplayDays.length > 0 && h("div", { className: "bg-white p-4 rounded-xl shadow-sm" },
                            h("h3", { className: "font-bold text-gray-800 mb-4 flex items-center gap-2" }, h(Icon, { name: "calendar" }), "日历日程"),
                            h("div", { className: "space-y-2" },
                                scheduleDisplayDays.map(day => h("div", { key: day.date, className: "flex flex-col sm:flex-row items-start gap-2 min-w-0" },
                                    h("div", { className: "w-full sm:w-28 shrink-0 text-xs text-gray-500 pt-1" }, day.label),
                                    h("div", { className: "w-full sm:flex-1 sm:min-w-0 border rounded p-2 text-sm bg-gray-50 text-gray-700 whitespace-pre-wrap break-words min-h-[56px]" }, day.note)
                                ))
                            )
                        ),
                        (hygieneDutyAnnouncements.length > 0 || commissionerAnnouncements.length > 0) && h("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4" },
                            hygieneDutyAnnouncements.length > 0 && h("div", { className: "bg-white p-3 rounded-xl shadow-sm" },
                                h("h3", { className: "font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm" }, h(Icon, { name: "users" }), "卫生督查公示"),
                                h("div", { className: "space-y-2" },
                                    hygieneDutyAnnouncements.map(item => h("div", { key: item.id, className: "rounded-lg border border-gray-100 bg-gray-50 px-3 py-2" },
                                        h("div", { className: "text-xs font-medium text-gray-800" }, item.name),
                                        h("div", { className: "text-[11px] text-gray-500 mt-1 leading-5 break-words" }, item.members.join("、"))
                                    ))
                                ),
                                h("div", { className: "text-[11px] text-gray-400 mt-3" }, "编辑请到维护区的“自定义角色 > 卫生督查”")
                            ),
                            commissionerAnnouncements.length > 0 && h("div", { className: "bg-white p-3 rounded-xl shadow-sm" },
                                h("h3", { className: "font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm" }, h(Icon, { name: "star" }), "纪律专员公示"),
                                h("div", { className: "space-y-2" },
                                    commissionerAnnouncements.map(item => h("div", { key: item.id, className: "rounded-lg border border-gray-100 bg-gray-50 px-3 py-2" },
                                        h("div", { className: "text-xs font-medium text-gray-800" }, item.name),
                                        h("div", { className: "text-[11px] text-gray-500 mt-1 break-words" }, item.studentName)
                                    ))
                                ),
                                h("div", { className: "text-[11px] text-gray-400 mt-3" }, "编辑请到维护区的“自定义角色 > 专员角色”")
                            )
                        )
                    ),
                    h("div", { className: "space-y-6" },
                        h("div", { className: "bg-white p-4 rounded-xl shadow-sm flex flex-col" },
                            h("div", { className: "flex justify-between items-center mb-4 border-b pb-2" }, h("h3", { className: "font-bold text-orange-600 flex items-center gap-2" }, h(Icon, { name: "smile" }), "自在榜 (Top 5)"), h("span", { className: "text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded" }, "荣誉总分")),
                            h("div", { className: "flex-1 space-y-4" },
                                sortedZizai.length === 0 ? h("div", { className: "text-center text-gray-400 py-4" }, "暂无数据") : sortedZizai.map((student, idx) => {
                                    const isTop3 = idx < 3;
                                    const rankColors = ['text-cyan-500', 'text-yellow-500', 'text-slate-400'];
                                    const wingColors = ['bg-cyan-300', 'bg-yellow-400', 'bg-slate-300'];
                                    const frames = ['frame-diamond', 'frame-gold', 'frame-silver'];
                                    const cardGradients = [
                                        'from-cyan-100 via-blue-100 to-indigo-100',
                                        'from-yellow-100 via-orange-100 to-yellow-50',
                                        'from-slate-100 via-gray-100 to-blue-50'
                                    ];

                                    return h("div", { key: student.id, className: `flex items-center gap-4 p-2 rounded-lg transition border shimmer-effect ${isTop3 ? `bg-gradient-to-r ${cardGradients[idx]} animate-gradient-x border-white shadow-md` : 'border-transparent hover:bg-orange-50'}` },
                                        h("div", { className: `text-xl font-bold w-6 text-center ${isTop3 ? rankColors[idx] : 'text-gray-400'}` }, idx + 1),
                                        h("div", { className: "relative" },
                                            isTop3 && h("div", { className: "absolute -inset-x-8 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-0" },
                                                h("svg", { viewBox: "0 0 24 24", className: `w-9 h-9 opacity-90 ${wingColors[idx].replace('bg-', 'text-')} animate-float`, style: { transform: 'scaleX(-1) rotate(-15deg)' } },
                                                    h("path", { fill: "currentColor", d: "M21,12C21,12 19,13 16,13C13,13 11,12 11,12C11,12 9,13 6,13C3,13 1,12 1,12C1,12 3,11 6,11C9,11 11,12 11,12C11,12 13,11 16,11C19,11 21,12 21,12M16,12C16,12 15,12.5 13.5,12.5C12,12.5 11,12 11,12C11,12 12,11.5 13.5,11.5C15,11.5 16,12 16,12Z" })
                                                ),
                                                h("svg", { viewBox: "0 0 24 24", className: `w-9 h-9 opacity-90 ${wingColors[idx].replace('bg-', 'text-')} animate-float`, style: { transform: 'rotate(-15deg)' } },
                                                    h("path", { fill: "currentColor", d: "M21,12C21,12 19,13 16,13C13,13 11,12 11,12C11,12 9,13 6,13C3,13 1,12 1,12C1,12 3,11 6,11C9,11 11,12 11,12C11,12 13,11 16,11C19,11 21,12 21,12M16,12C16,12 15,12.5 13.5,12.5C12,12.5 11,12 11,12C11,12 12,11.5 13.5,11.5C15,11.5 16,12 16,12Z" })
                                                )
                                            ),
                                            profileAvatarUI.renderAvatarImage({ student, studentProfiles, mood: 'happy', className: `w-10 h-10 rounded-full bg-gray-100 relative z-10 ${isTop3 ? frames[idx] : 'border-transparent'}` })
                                        ),
                                        h("div", { className: "flex-1" },
                                            h("div", { className: `font-bold ${isTop3 ? 'text-gray-800' : ''}` }, student.name),
                                            h("div", { className: "text-xs text-gray-400" }, (() => {
                                                const groupsConfig = getGroupsConfig(config);
                                                return groupsConfig[student.group]?.name || student.group;
                                            })())
                                        ),
                                        h("div", { className: "font-mono font-bold text-orange-600 text-lg" }, student.zizai ?? 0)
                                    );
                                })
                            )
                        ),
                        h("div", { className: "bg-white p-4 rounded-xl shadow-sm" },
                            h("div", { className: "mb-4 border-b pb-2" },
                                h("div", { className: "flex justify-between items-center mb-2" },
                                    h("h3", { className: "font-bold text-indigo-600 flex items-center gap-2" }, h(Icon, { name: "chart" }), "宿舍分值图"),
                                    h("div", { className: "flex gap-3 text-[10px] text-gray-500" },
                                        h("div", { className: "flex items-center gap-1" }, h("div", { className: "w-2 h-2 bg-green-500 rounded-full" }), "加分"),
                                        h("div", { className: "flex items-center gap-1" }, h("div", { className: "w-2 h-2 bg-red-400 rounded-full" }), "纪律/出勤扣分"),
                                        h("div", { className: "flex items-center gap-1" }, h("div", { className: "w-2 h-2 bg-yellow-400 rounded-full" }), "卫生扣分")
                                    )
                                ),
                                h("div", { className: "flex justify-end items-center gap-1" },
                                    h("input", { type: "date", className: "text-xs border rounded p-1", value: dormChartRange.start, onChange: e => setDormChartRange({ ...dormChartRange, start: e.target.value }) }),
                                    h("span", { className: "text-xs text-gray-400" }, "-"),
                                    h("input", { type: "date", className: "text-xs border rounded p-1", value: dormChartRange.end, onChange: e => setDormChartRange({ ...dormChartRange, end: e.target.value }) })
                                )
                            ),
                            h("div", { className: "space-y-6 pt-2" },
                                dormStats.length === 0 ? h("div", { className: "text-center text-gray-400 py-4" }, "暂无宿舍数据") :
                                (() => {
                                    const maxVal = Math.max(...dormStats.map(item => Math.max(item.bonus, item.discipline, item.hygiene)), 10);
                                    return dormStats.map(item => h("div", { key: item.name, className: "space-y-1" },
                                        h("div", { className: "text-xs font-bold text-gray-600 flex justify-between" }, h("span", null, item.name)),
                                        h("div", { className: "space-y-1.5" },
                                            h("div", { className: "flex items-center gap-2" },
                                                h("div", { className: "flex-1 h-3 bg-gray-100 rounded-full overflow-hidden" },
                                                    h("div", { className: "h-full bg-green-500 transition-all", style: { width: `${(item.bonus / maxVal) * 100}%` } })
                                                ),
                                                h("span", { className: "text-[10px] w-8 font-mono text-green-600" }, `+${item.bonus}`)
                                            ),
                                            h("div", { className: "flex items-center gap-2" },
                                                h("div", { className: "flex-1 h-3 bg-gray-100 rounded-full overflow-hidden" },
                                                    h("div", { className: "h-full bg-red-400 transition-all", style: { width: `${(item.discipline / maxVal) * 100}%` } })
                                                ),
                                                h("span", { className: "text-[10px] w-8 font-mono text-red-500" }, `-${item.discipline}`)
                                            ),
                                            h("div", { className: "flex items-center gap-2" },
                                                h("div", { className: "flex-1 h-3 bg-gray-100 rounded-full overflow-hidden" },
                                                    h("div", { className: "h-full bg-yellow-400 transition-all", style: { width: `${(item.hygiene / maxVal) * 100}%` } })
                                                ),
                                                h("span", { className: "text-[10px] w-8 font-mono text-yellow-600" }, `-${item.hygiene}`)
                                            )
                                        )
                                    ));
                                })()
                            )
                        )
                    ),
                    h("div", { className: "space-y-6" },
                        h("div", { className: "bg-white p-4 rounded-xl shadow-sm" },
                            h("div", { className: "flex justify-between items-center mb-4 border-b pb-2" }, h("h3", { className: "font-bold text-gray-600 flex items-center gap-2" }, h(Icon, { name: "frown" }), "不自在榜"), h("span", { className: "text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded" }, "违纪统计")),
                            h("div", { className: "space-y-3" },
                                sortedPenalty.map((student, idx) => {
                                    const isTop3 = idx < 3;
                                    return h("div", { key: student.id, className: "flex items-center gap-3 text-sm relative" },
                                        h("span", { className: "w-4 text-gray-400 font-bold" }, idx + 1),
                                        h("div", { className: "relative" },
                                            isTop3 && h("div", { className: "absolute -top-1 left-0 right-0 flex justify-between px-0.5 z-20 pointer-events-none" },
                                                h("div", { className: "w-1.5 h-1.5 bg-red-600", style: { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', transform: 'rotate(-20deg)' } }),
                                                h("div", { className: "w-1.5 h-1.5 bg-red-600", style: { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', transform: 'rotate(20deg)' } })
                                            ),
                                            isTop3 && h("div", { className: "absolute -right-1 -bottom-1 w-3 h-3 text-red-500 z-0 pointer-events-none", style: { transform: 'rotate(15deg)' } },
                                                h("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-full h-full opacity-70" },
                                                    h("path", { d: "M12,2L14,6L18,2L16,10L22,12L16,14L18,22L14,18L12,22L10,18L6,22L8,14L2,12L8,10L6,2L10,6L12,2Z" })
                                                )
                                            ),
                                            profileAvatarUI.renderAvatarImage({ student, studentProfiles, mood: 'sad', className: `w-8 h-8 rounded-full relative z-10 border ${isTop3 ? 'border-red-400' : 'border-transparent'}` })
                                        ),
                                        h("div", { className: "flex-1" },
                                            h("div", { className: "font-medium" }, student.name),
                                            h("div", { className: "text-xs text-gray-400" }, getNoPenaltyText(student))
                                        ),
                                        h("span", { className: "text-red-500 font-bold" }, student.penalty)
                                    );
                                })
                            )
                        ),
                        customRoleAnnouncements.length > 0 && h("div", { className: "bg-white p-4 rounded-xl shadow-sm" },
                            h("h3", { className: "font-bold text-gray-800 mb-4 flex items-center gap-2" }, h(Icon, { name: "clipboard" }), "班级职务公示"),
                            h("div", { className: "space-y-2" },
                                customRoleAnnouncements.map(role => h("div", { key: role.id, className: "flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2" },
                                    h("div", null,
                                        h("div", { className: "text-sm font-medium text-gray-800" }, role.name),
                                        h("div", { className: "text-xs text-gray-500" }, role.studentName)
                                    ),
                                    h("div", { className: "text-xs text-emerald-600 whitespace-nowrap" }, `日薪 ${role.dailyWage} 分`)
                                ))
                            )
                        ),
                        h("div", { className: "bg-white p-4 rounded-xl shadow-sm" },
                            h("h3", { className: "font-bold text-gray-800 mb-2 text-sm" }, "近期动态 (Top 100)"),
                            h("div", { className: "space-y-2 max-h-96 overflow-y-auto" },
                                recentHistory.map(item => h("div", { key: item.id, className: "text-xs flex justify-between p-2 bg-gray-50 rounded" },
                                    h("div", null,
                                        h("span", { className: "font-bold mr-2" }, item.studentName),
                                        h("span", { className: "text-gray-500" }, item.isAggregated ? `${item.reason} (${item.count}人)` : item.reason)
                                    ),
                                    h("div", { className: "flex items-center gap-2" },
                                        h("span", { className: item.val > 0 ? "text-green-600" : "text-red-600" }, item.val > 0 ? `+${item.val}` : item.val),
                                        !item.isAggregated && !item.isUndoLog && h("button", { onClick: () => handleProtectedUndo(item.id), className: "text-gray-300 hover:text-blue-500", title: "撤销" }, h(Icon, { name: "undo", size: 12 }))
                                    )
                                ))
                            )
                        )
                    )
                )
            );
        };
    };
})();
