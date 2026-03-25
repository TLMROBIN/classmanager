(function() {
    window.createAttendanceView = function createAttendanceView(deps) {
        const {
            h,
            useState,
            useEffect,
            useMemo,
            Icon,
            requireAdminAuth,
            getNow,
            getDateString,
            getTodayStr,
            timeToMinutes,
            getSystemConfig,
            getScheduleConfig,
            getWeekendRules,
            getPenaltyRules,
            attendancePoints,
            AttendanceSettingsSection
        } = deps || {};

        const {
            applyLatePenalty,
            correctSelectedIssues,
            settleAbsentItems,
            awardPerfectAttendance
        } = attendancePoints || {};
        const createAttendanceAdminTools = window.createAttendanceAdminTools;

        if (
            !h ||
            !useState ||
            !useEffect ||
            !useMemo ||
            !Icon ||
            !requireAdminAuth ||
            !getNow ||
            !getDateString ||
            !getTodayStr ||
            !timeToMinutes ||
            !getSystemConfig ||
            !getScheduleConfig ||
            !getWeekendRules ||
            !getPenaltyRules ||
            !applyLatePenalty ||
            !correctSelectedIssues ||
            !settleAbsentItems ||
            !awardPerfectAttendance ||
            !createAttendanceAdminTools
        ) {
            throw new Error('AttendanceView dependencies are missing');
        }

        const attendanceAdminTools = createAttendanceAdminTools({ getTodayStr });

        return function AttendanceView({
            students,
            updatePoints,
            config,
            quotes,
            teacherMessages,
            setTeacherMessages,
            studentMessages,
            setStudentMessages,
            logs,
            attendanceRecords,
            handleUndoByReasons,
            onAttendanceRecordsChange,
            onUpdateAttendanceConfig
        }) {
            const isFrozen = !!(config && config.frozen);

            const getThisWeekRange = () => {
                const now = getNow();
                const currentDay = now.getDay();
                const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
                const monday = new Date(now);
                monday.setDate(now.getDate() - distanceToMonday);
                const friday = new Date(monday);
                friday.setDate(monday.getDate() + 4);
                return { start: getDateString(monday), end: getDateString(friday) };
            };

            const [records, setRecords] = useState({});
            const [currentTime, setCurrentTime] = useState(getNow());
            const [view, setView] = useState('checkin');
            const [checkInEffect, setCheckInEffect] = useState(null);
            const [startDate, setStartDate] = useState(() => getThisWeekRange().start);
            const [endDate, setEndDate] = useState(() => getThisWeekRange().end);
            const [selectedIssues, setSelectedIssues] = useState([]);
            const [filterSession, setFilterSession] = useState('all');
            const [filterDate, setFilterDate] = useState('');
            const [filterType, setFilterType] = useState('all');
            const [newTeacherMsg, setNewTeacherMsg] = useState("");
            const [newStudentMsg, setNewStudentMsg] = useState("");
            const [queryStudentName, setQueryStudentName] = useState("");

            const syncAttendanceRecords = (nextRecords, options = {}) => {
                if (typeof onAttendanceRecordsChange === 'function') {
                    return onAttendanceRecordsChange(nextRecords || {}, options);
                }
                return null;
            };

            useEffect(() => {
                setRecords(attendanceRecords || {});
            }, [attendanceRecords]);

            useEffect(() => {
                const timer = setInterval(() => {
                    setCurrentTime(getNow());
                }, 1000);
                return () => clearInterval(timer);
            }, []);

            const getRulesForDate = (dateObj) => {
                const scheduleConfig = getScheduleConfig(config);
                const weekendRules = getWeekendRules(config);
                const sundaySpecialLateTime = getSystemConfig(config).attendance.sundaySpecialLateTime || {};
                const day = dateObj.getDay();

                let periodIndices = [];
                if (day === 1) periodIndices = weekendRules.monday || [];
                else if (day === 2) periodIndices = weekendRules.tuesday || [];
                else if (day === 3) periodIndices = weekendRules.wednesday || [];
                else if (day === 4) periodIndices = weekendRules.thursday || [];
                else if (day === 5) periodIndices = weekendRules.friday || [];
                else if (day === 6) periodIndices = weekendRules.saturday || [];
                else if (day === 0) periodIndices = weekendRules.sunday || [];

                const periods = periodIndices.map(idx => {
                    if (idx >= 0 && idx < scheduleConfig.length) {
                        const period = { ...scheduleConfig[idx] };
                        if (day === 0 && sundaySpecialLateTime[period.id]) {
                            period.lateTime = sundaySpecialLateTime[period.id];
                        }
                        return period;
                    }
                    return null;
                }).filter(Boolean);

                return periods;
            };

            const isPeriodEnded = (dateObj, rule, now) => {
                const parts = rule.end.split(':');
                const hNum = parseInt(parts[0], 10);
                const mNum = parseInt(parts[1], 10) || 0;
                const periodEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hNum, mNum, 0, 0);
                const ABSENT_GRACE_MS = 2 * 60 * 1000;
                return now > new Date(periodEnd.getTime() + ABSENT_GRACE_MS);
            };

            const getDisplayRecord = (dateObj, studentName, rule, now, sourceRecords = records) => {
                const dateStr = getDateString(dateObj);
                const existingRecord = sourceRecords?.[dateStr]?.[studentName]?.[rule.id] || null;
                if (existingRecord) return existingRecord;
                if (isFrozen || !isPeriodEnded(dateObj, rule, now)) return null;
                return {
                    status: 'absent',
                    checkTime: '缺勤',
                    timestamp: 0,
                    isDerived: true
                };
            };

            const todayRules = useMemo(() => getRulesForDate(currentTime), [currentTime.getDate()]);

            const todayQuote = useMemo(() => {
                const start = new Date(currentTime.getFullYear(), 0, 0);
                const diff = currentTime - start;
                const oneDay = 1000 * 60 * 60 * 24;
                const dayOfYear = Math.floor(diff / oneDay);
                return quotes[dayOfYear % quotes.length];
            }, [currentTime, quotes]);

            const currentSession = useMemo(() => {
                const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
                for (const session of todayRules) {
                    const start = timeToMinutes(session.start);
                    const end = timeToMinutes(session.end);
                    if (nowMinutes >= start && nowMinutes <= end) {
                        return { ...session, isLateNow: nowMinutes > timeToMinutes(session.lateTime) };
                    }
                }
                return null;
            }, [currentTime, todayRules]);

            const usedMorningLateCardYesterday = (name) => {
                const logList = logs || [];
                const yesterday = new Date(currentTime);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = getDateString(yesterday);
                return logList.some(log => {
                    if (log.action !== '使用' || !log.itemName || log.studentName !== name) return false;
                    if (String(log.itemName).trim() !== '早读迟到卡') return false;
                    return getDateString(new Date(log.ts)) === yesterdayStr;
                });
            };

            const handleCheckIn = (studentName) => {
                if (!currentSession) return alert("当前不在打卡时段！");
                const dateKey = getDateString(currentTime);
                let result = null;

                setRecords(currentRecords => {
                    if (currentRecords[dateKey]?.[studentName]?.[currentSession.id]) {
                        result = { status: 'exists' };
                        return currentRecords;
                    }

                    const isLate = currentSession.isLateNow;
                    const usedLateCardYesterday = currentSession.id === 'morning' && usedMorningLateCardYesterday(studentName);

                    const newRecord = {
                        status: isLate ? 'late' : 'ok',
                        checkTime: currentTime.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                        timestamp: getNow().getTime()
                    };

                    const newRecords = {
                        ...currentRecords,
                        [dateKey]: {
                            ...(currentRecords[dateKey] || {}),
                            [studentName]: {
                                ...(currentRecords[dateKey]?.[studentName] || {}),
                                [currentSession.id]: newRecord
                            }
                        }
                    };

                    result = { status: isLate ? 'late' : 'ok', newRecord, newRecords, usedLateCardYesterday };
                    return newRecords;
                });

                if (!result) return;
                if (result.status === 'exists') return alert("已打卡！");
                syncAttendanceRecords(result.newRecords, {
                    persistImmediately: true,
                    actionLabel: '打卡记录'
                });

                const student = students.find(stu => stu.name === studentName);
                if (result.status === 'late' && student && !result.usedLateCardYesterday) {
                    const penaltyRules = getPenaltyRules(config);
                    const latePenalty = penaltyRules.late || -1;
                    applyLatePenalty({
                        student,
                        sessionName: currentSession.name,
                        latePenalty,
                        updatePoints,
                        isFrozen
                    });
                }

                const streak = calculateStreak(studentName, result.newRecords, currentTime);
                setCheckInEffect({ show: true, student: studentName, streak, usedMorningLateCard: result.status === 'late' && result.usedLateCardYesterday });
                setTimeout(() => setCheckInEffect(null), 3000);
            };

            const handlePostTeacherMsg = () => {
                if (!newTeacherMsg.trim()) return;

                const msg = {
                    id: getNow().getTime(),
                    content: newTeacherMsg,
                    time: getNow().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                    date: getTodayStr()
                };
                const updatedMessages = [msg, ...(teacherMessages || [])].slice(0, 5);
                setTeacherMessages(updatedMessages);
                setNewTeacherMsg("");
            };

            const handleDeleteTeacherMsg = (id) => {
                const updated = teacherMessages.filter(msg => msg.id !== id);
                setTeacherMessages(updated);
            };

            const handlePostStudentMsg = () => {
                if (!newStudentMsg.trim()) return;
                const msg = {
                    id: Date.now(),
                    content: newStudentMsg,
                    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                    date: getTodayStr()
                };
                const updatedMessages = [msg, ...(studentMessages || [])].slice(0, 20);
                setStudentMessages(updatedMessages);
                setNewStudentMsg("");
            };

            const handleDeleteStudentMsg = (id) => {
                const updated = studentMessages.filter(msg => msg.id !== id);
                setStudentMessages(updated);
            };

            const calculateStreak = (name, data, endDate) => {
                let streak = 0;
                let d = new Date(endDate);
                d.setDate(d.getDate() - 1);
                for (let i = 0; i < 365; i++) {
                    const dateStr = getDateString(d);
                    const rules = getRulesForDate(d);
                    if (rules.length === 0) {
                        d.setDate(d.getDate() - 1);
                        continue;
                    }
                    let perfect = true;
                    const dayRec = data[dateStr]?.[name];
                    if (!dayRec) {
                        perfect = false;
                    } else {
                        for (const rule of rules) {
                            if (!dayRec[rule.id] || dayRec[rule.id].status !== 'ok') {
                                perfect = false;
                                break;
                            }
                        }
                    }
                    if (perfect) streak++;
                    else break;
                    d.setDate(d.getDate() - 1);
                }
                return streak;
            };

            const statsData = useMemo(() => {
                const start = new Date(startDate);
                const end = new Date(endDate);
                const list = [];
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) list.push(new Date(d));
                const stats = {};
                students.forEach(student => {
                    stats[student.name] = { late: 0, absent: 0, perfect: true, streak: calculateStreak(student.name, records, getNow()) };
                });
                const now = getNow();
                list.forEach(dateObj => {
                    const dateStr = getDateString(dateObj);
                    const rules = getRulesForDate(dateObj);
                    rules.forEach(rule => {
                        if (!isPeriodEnded(dateObj, rule, now)) return;
                        students.forEach(student => {
                            const rec = getDisplayRecord(dateObj, student.name, rule, now);
                            if (rec) {
                                if (rec.status === 'late') {
                                    stats[student.name].late++;
                                    stats[student.name].perfect = false;
                                } else if (rec.status === 'absent') {
                                    stats[student.name].absent++;
                                    stats[student.name].perfect = false;
                                } else if (rec.status !== 'ok') {
                                    stats[student.name].perfect = false;
                                }
                            } else {
                                stats[student.name].perfect = false;
                            }
                        });
                    });
                });
                const bestStreaks = students.map(student => ({ name: student.name, val: stats[student.name].streak })).filter(item => item.val > 0).sort((a, b) => b.val - a.val);
                const mostLates = students.map(student => ({ name: student.name, val: stats[student.name].late })).filter(item => item.val > 0).sort((a, b) => b.val - a.val);
                const mostAbsents = students.map(student => ({ name: student.name, val: stats[student.name].absent })).filter(item => item.val > 0).sort((a, b) => b.val - a.val);
                const perfects = students.filter(student => stats[student.name].perfect).map(student => student.name);
                return { stats, bestStreaks, mostLates, mostAbsents, perfects, dates: list };
            }, [records, students, startDate, endDate, currentTime]);

            const handleRevokeAuth = async () => {
                if (await requireAdminAuth("请输入维护密码：")) setView('revoke');
            };

            const handleExportAttendanceExcel = () => attendanceAdminTools.exportAttendanceExcel({
                records,
                scheduleConfig: getScheduleConfig(config)
            });

            const abnormalRecords = useMemo(() => {
                if (view !== 'revoke') return [];
                const list = [];
                const now = getNow();
                statsData.dates.forEach(dateObj => {
                    const dateStr = getDateString(dateObj);
                    if (filterDate && dateStr !== filterDate) return;
                    const rules = getRulesForDate(dateObj);
                    rules.forEach(rule => {
                        if (!isPeriodEnded(dateObj, rule, now)) return;
                        if (filterSession !== 'all' && rule.id !== filterSession) return;
                        students.forEach(student => {
                            const rec = getDisplayRecord(dateObj, student.name, rule, now);
                            if (rec && rec.status === 'late') {
                                if (filterType !== 'all' && filterType !== 'late') return;
                                list.push({ id: `${dateStr}-${student.name}-${rule.id}`, date: dateStr, name: student.name, session: rule.name, type: 'late', desc: `迟到 ${rec.checkTime}` });
                            } else if (rec && rec.status === 'absent') {
                                if (filterType !== 'all' && filterType !== 'absent') return;
                                list.push({
                                    id: `${dateStr}-${student.name}-${rule.id}`,
                                    date: dateStr,
                                    name: student.name,
                                    session: rule.name,
                                    type: 'absent',
                                    desc: '缺勤'
                                });
                            }
                        });
                    });
                });
                return list;
            }, [view, statsData, filterSession, filterDate, filterType, records, students]);

            const toggleSelectAll = () => {
                if (selectedIssues.length === abnormalRecords.length && abnormalRecords.length > 0) {
                    setSelectedIssues([]);
                } else {
                    setSelectedIssues(abnormalRecords.map(record => record.id));
                }
            };

            const isAllSelected = abnormalRecords.length > 0 && selectedIssues.length === abnormalRecords.length;

            const handleBatchCorrect = () => {
                if (selectedIssues.length === 0) return;
                if (!confirm(`确定将选中的 ${selectedIssues.length} 条记录修正为“正常”吗？\n迟到：返还扣分\n缺勤：补录为正常`)) return;
                const newRec = correctSelectedIssues({
                    selectedIds: selectedIssues,
                    abnormalRecords,
                    students,
                    records,
                    nowTs: getNow().getTime(),
                    handleUndoByReasons
                });
                setRecords(newRec);
                syncAttendanceRecords(newRec, {
                    persistImmediately: true,
                    actionLabel: '考勤修正'
                });
                setSelectedIssues([]);
                alert("修正成功");
            };

            const handleBatchAbsent = () => {
                const absentItems = selectedIssues.map(id => abnormalRecords.find(item => item.id === id)).filter(item => item && item.type === 'absent');
                if (isFrozen) return alert("假期封存中，无法结算缺勤。请先在维护页面解除封存。");
                if (absentItems.length === 0) return alert("请至少选择一条缺勤记录");
                const penaltyRules = getPenaltyRules(config);
                const absentPenalty = penaltyRules.absent || -5;
                if (!confirm(`确定将选中的 ${absentItems.length} 条缺勤记录进行结算扣分吗？\n每条扣除 ${Math.abs(absentPenalty)} 分。`)) return;
                const newRec = settleAbsentItems({
                    items: absentItems,
                    students,
                    records,
                    nowTs: getNow().getTime(),
                    absentPenalty,
                    updatePoints
                });
                setRecords(newRec);
                syncAttendanceRecords(newRec, {
                    persistImmediately: true,
                    actionLabel: '缺勤结算'
                });
                setSelectedIssues([]);
                alert("结算成功");
            };

            const handleSettleAllAbsent = () => {
                if (isFrozen) return alert("假期封存中，无法结算缺勤。请先在维护页面解除封存。");
                const allAbsentItems = abnormalRecords.filter(item => item.type === 'absent');
                if (allAbsentItems.length === 0) return alert("当前没有待结算的缺勤记录");
                const penaltyRules = getPenaltyRules(config);
                const absentPenalty = penaltyRules.absent || -5;
                if (!confirm(`确定要一键结算当前列表中的 ${allAbsentItems.length} 条缺勤记录吗？\n每条扣除 ${Math.abs(absentPenalty)} 分。`)) return;
                const newRec = settleAbsentItems({
                    items: allAbsentItems,
                    students,
                    records,
                    nowTs: getNow().getTime(),
                    absentPenalty,
                    updatePoints
                });
                setRecords(newRec);
                syncAttendanceRecords(newRec, {
                    persistImmediately: true,
                    actionLabel: '缺勤批量结算'
                });
                const settledIds = new Set(allAbsentItems.map(item => item.id));
                setSelectedIssues(selectedIssues.filter(id => !settledIds.has(id)));
                alert("批量结算成功");
            };

            const handlePerfectBonus = () => {
                if (isFrozen) return alert("假期封存中，无法发放全勤奖。请先在维护页面解除封存。");
                if (statsData.perfects.length === 0) return alert("当前名单无全勤学生");
                const penaltyRules = getPenaltyRules(config);
                const perfectAttendanceBonus = penaltyRules.perfectAttendance || 10;
                if (!confirm(`确定为当前全勤名单中的 ${statsData.perfects.length} 人发放 +${perfectAttendanceBonus} 分"周全勤奖"吗？`)) return;
                awardPerfectAttendance({
                    perfectNames: statsData.perfects,
                    students,
                    perfectAttendanceBonus,
                    updatePoints
                });
                alert("发放成功！");
            };

            return h("div", { className: "space-y-4" },
                h("div", { className: "bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden relative" },
                checkInEffect && h("div", { className: "fixed inset-0 z-50 flex items-center justify-center pointer-events-none" },
                    h("div", { className: "absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in" }),
                    h("div", { className: "bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-pop relative z-10 border-4 border-orange-200" },
                        h("div", { className: "text-orange-500 animate-firework rounded-full mb-4" }, h(Icon, { name: "flame", size: 64 })),
                        h("h2", { className: "text-2xl font-bold text-gray-800 mb-2" }, "🎉 打卡成功！"),
                        h("div", { className: "text-lg text-gray-600 mb-4" }, checkInEffect.student),
                        checkInEffect.usedMorningLateCard ? h("div", { className: "bg-amber-100 text-amber-800 px-4 py-2 rounded-full font-bold" }, "早读迟到卡已抵扣，记录迟到但不扣分") : checkInEffect.streak > 0 ? h("div", { className: "bg-orange-100 text-orange-700 px-4 py-2 rounded-full font-bold animate-pulse" }, `🔥 已连续全勤 ${checkInEffect.streak} 天！`) : h("div", { className: "text-blue-600 font-medium" }, "好的开始，继续保持！")
                    )
                ),
                h("div", { className: "bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center" },
                    h("div", { className: "flex items-center gap-3" }, h(Icon, { name: "clock", size: 24 }),
                        h("div", null,
                            h("div", { className: "text-xl font-bold" }, currentTime.toLocaleTimeString('zh-CN', { hour12: false })),
                            h("div", { className: "text-xs opacity-80" }, getDateString(currentTime))
                        )
                    ),
                    h("div", { className: "hidden md:flex flex-1 justify-center px-4 attendance-quote-shell" },
                        h("div", { className: "attendance-quote-banner" },
                            h("div", { className: "attendance-quote-text" }, `“${todayQuote}”`)
                        )
                    ),
                    h("div", { className: "flex items-center gap-2" }, h("div", { className: `px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${currentSession ? (currentSession.isLateNow ? 'bg-red-500' : 'bg-green-500') : 'bg-gray-500'}` }, h("span", { className: "w-2 h-2 rounded-full bg-white animate-pulse" }), currentSession ? `${currentSession.name} ${currentSession.isLateNow ? '迟到' : '进行中'}` : '非时段'))
                ),
                h("div", { className: "md:hidden attendance-quote-mobile" },
                    h("div", { className: "attendance-quote-text" }, `“${todayQuote}”`)
                ),
                isFrozen && h("div", { className: "bg-amber-100 border-b border-amber-200 text-amber-800 text-sm py-2 px-4 text-center font-medium" }, "❄️ 假期封存中：缺勤不记录、迟到不扣分、结算与全勤奖已暂停"),
                h("div", { className: "flex border-b bg-gray-50" }, [{ id: 'checkin', label: '打卡', icon: 'check' }, { id: 'stats', label: '统计', icon: 'chart' }, { id: 'revoke', label: '修正', icon: 'clipboard' }].map(item => h("button", { key: item.id, onClick: () => item.id === 'revoke' ? handleRevokeAuth() : setView(item.id), className: `flex-1 py-3 flex justify-center items-center gap-2 text-sm font-medium transition ${view === item.id ? 'bg-white text-blue-600 border-t-2 border-blue-500' : 'text-gray-500 hover:bg-gray-100'}` }, h(Icon, { name: item.icon, size: 16 }), item.label))),
                h("div", { className: "p-4 min-h-[400px]" },
                    view === 'checkin' && h("div", { className: "animate-fade-in space-y-4" },
                        h("div", { className: "bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-2" },
                            h("div", { className: "flex items-center gap-2 mb-2 border-b border-yellow-100 pb-1" },
                                h(Icon, { name: "message", className: "text-yellow-600", size: 16 }),
                                h("h3", { className: "font-bold text-yellow-800 text-sm" }, "📢 班主任通知")
                            ),
                            h("div", { className: "space-y-2 mb-2" },
                                (!teacherMessages || teacherMessages.length === 0)
                                    ? h("div", { className: "text-gray-400 text-xs italic" }, "暂无通知")
                                    : teacherMessages.map(msg =>
                                        h("div", { key: msg.id, className: "bg-white p-2 rounded border border-yellow-100 text-sm shadow-sm relative group" },
                                            h("div", { className: "text-gray-800 font-medium pr-6" }, msg.content),
                                            h("div", { className: "text-gray-400 text-xs text-right mt-1" }, `${msg.date} ${msg.time}`),
                                            h("button", {
                                                onClick: () => handleDeleteTeacherMsg(msg.id),
                                                className: "absolute top-1 right-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            }, h(Icon, { name: "trash", size: 14 }))
                                        )
                                    )
                            ),
                            h("div", { className: "flex gap-2" },
                                h("input", {
                                    type: "text",
                                    className: "flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-500",
                                    placeholder: "发布新通知...",
                                    value: newTeacherMsg,
                                    onChange: (e) => setNewTeacherMsg(e.target.value),
                                    onKeyPress: (e) => e.key === 'Enter' && handlePostTeacherMsg()
                                }),
                                h("button", {
                                    onClick: handlePostTeacherMsg,
                                    className: "bg-yellow-500 text-white px-3 py-1 rounded text-xs hover:bg-yellow-600 transition"
                                }, "发布")
                            )
                        ),
                        h("div", { className: "mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-between" }, h("div", { className: "font-bold text-blue-800 flex items-center gap-2" }, h(Icon, { name: "coffee" }), "今日规则"), todayRules.length === 0 ? h("span", { className: "text-xs text-gray-500" }, "休息日") : h("div", { className: "flex gap-2" }, todayRules.map(rule => h("span", { key: rule.id, className: "text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-600" }, `${rule.start}-${rule.end} (${rule.lateTime}后迟到)`)))),
                        h("div", { className: "grid grid-cols-4 sm:grid-cols-5 gap-2" }, students.map(student => {
                            const todayKey = getDateString(currentTime);
                            const isDone = currentSession && records[todayKey]?.[student.name]?.[currentSession.id];
                            const status = isDone?.status;
                            return h("button", { key: student.id, disabled: !currentSession || !!isDone, onClick: () => handleCheckIn(student.name), className: `p-2 rounded border text-sm font-medium transition relative overflow-hidden h-14 flex flex-col items-center justify-center ${isDone ? (status === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700') : (currentSession ? 'bg-white border-gray-200 hover:border-blue-400 hover:shadow' : 'bg-gray-50 border-transparent text-gray-300')}` }, h("span", { className: "z-10" }, student.name), isDone && h("span", { className: "text-[10px] opacity-80 mt-1" }, `${status === 'ok' ? '已到' : '迟到'} ${isDone.checkTime}`));
                        })),
                        h("div", { className: "mt-6 pt-4 border-t border-gray-200" },
                            h("div", { className: "flex items-center gap-2 mb-3" },
                                h(Icon, { name: "message", className: "text-blue-500" }),
                                h("h3", { className: "font-bold text-gray-700" }, "💬 同学留言板")
                            ),
                            h("div", { className: "flex gap-2 mb-4" },
                                h("input", {
                                    type: "text",
                                    className: "flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                                    placeholder: "说点什么...",
                                    value: newStudentMsg,
                                    onChange: (e) => setNewStudentMsg(e.target.value),
                                    onKeyPress: (e) => e.key === 'Enter' && handlePostStudentMsg()
                                }),
                                h("button", {
                                    onClick: handlePostStudentMsg,
                                    className: "bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition"
                                }, "发送")
                            ),
                            h("div", { className: "space-y-2 max-h-40 overflow-y-auto" },
                                (!studentMessages || studentMessages.length === 0)
                                    ? h("div", { className: "text-gray-400 text-sm text-center py-2" }, "暂无留言")
                                    : studentMessages.map(msg =>
                                        h("div", { key: msg.id, className: "bg-gray-50 p-2 rounded text-sm flex justify-between items-start border border-gray-100 relative group" },
                                            h("div", { className: "flex-1 pr-6" },
                                                h("span", { className: "text-gray-800 break-all" }, msg.content)
                                            ),
                                            h("div", { className: "flex flex-col items-end gap-1" },
                                                h("span", { className: "text-gray-400 text-xs whitespace-nowrap" }, `${msg.date} ${msg.time}`),
                                                h("button", {
                                                    onClick: () => handleDeleteStudentMsg(msg.id),
                                                    className: "text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                }, h(Icon, { name: "trash", size: 12 }))
                                            )
                                        )
                                    )
                            )
                        )
                    ),
                    view === 'stats' && h("div", { className: "animate-fade-in space-y-6" },
                        h("div", { className: "flex items-center gap-2 text-sm bg-gray-50 p-2 rounded flex-wrap" },
                            h("span", { className: "text-gray-500" }, "范围:"),
                            h("input", { type: "date", value: startDate, onChange: e => setStartDate(e.target.value), className: "border rounded px-1" }),
                            h("span", null, "-"),
                            h("input", { type: "date", value: endDate, onChange: e => setEndDate(e.target.value), className: "border rounded px-1" }),
                            h("span", { className: "text-gray-500 ml-2" }, "查询学生:"),
                            h("input", {
                                type: "text",
                                value: queryStudentName,
                                onChange: e => setQueryStudentName(e.target.value),
                                placeholder: "输入学生姓名",
                                className: "border rounded px-2 py-1 flex-1 min-w-[120px]"
                            })
                        ),
                        queryStudentName ? (() => {
                            const student = students.find(item => item.name.trim() === queryStudentName.trim());
                            if (!student) {
                                return h("div", { className: "bg-yellow-50 border border-yellow-200 p-4 rounded text-center text-yellow-700" }, "未找到该学生");
                            }
                            const studentRecords = [];
                            const now = getNow();
                            statsData.dates.forEach(dateObj => {
                                const dateStr = getDateString(dateObj);
                                const rules = getRulesForDate(dateObj);
                                rules.forEach(rule => {
                                    if (!isPeriodEnded(dateObj, rule, now)) return;
                                    const rec = getDisplayRecord(dateObj, student.name, rule, now);
                                    studentRecords.push({
                                        date: dateStr,
                                        session: rule.name,
                                        status: rec ? rec.status : null,
                                        checkTime: rec ? rec.checkTime : '—'
                                    });
                                });
                            });
                            return h("div", { className: "bg-white border rounded-lg p-4" },
                                h("h4", { className: "font-bold mb-3 text-lg" }, `${student.name} 的详细出勤情况`),
                                h("div", { className: "max-h-96 overflow-y-auto border rounded" },
                                    h("table", { className: "w-full text-sm text-left" },
                                        h("thead", { className: "bg-gray-50 sticky top-0" },
                                            h("tr", null,
                                                h("th", { className: "p-2 border-b" }, "日期"),
                                                h("th", { className: "p-2 border-b" }, "时段"),
                                                h("th", { className: "p-2 border-b" }, "状态"),
                                                h("th", { className: "p-2 border-b" }, "打卡时间")
                                            )
                                        ),
                                        h("tbody", null,
                                            studentRecords.length === 0
                                                ? h("tr", null, h("td", { colSpan: 4, className: "p-4 text-center text-gray-400" }, "暂无记录"))
                                                : studentRecords.map((rec, idx) => {
                                                    const statusText = rec.status === 'ok'
                                                        ? '正常'
                                                        : rec.status === 'late'
                                                            ? '迟到'
                                                            : rec.status === 'absent'
                                                                ? '缺勤'
                                                                    : '无记录';
                                                    const statusClass = rec.status === 'ok'
                                                        ? 'text-green-600'
                                                        : rec.status === 'late'
                                                            ? 'text-red-600'
                                                            : rec.status === 'absent'
                                                                ? 'text-gray-600'
                                                                : 'text-gray-400';
                                                    return h("tr", { key: idx, className: "border-b hover:bg-gray-50" },
                                                        h("td", { className: "p-2" }, rec.date),
                                                        h("td", { className: "p-2" }, rec.session),
                                                        h("td", { className: `p-2 font-bold ${statusClass}` }, statusText),
                                                        h("td", { className: "p-2 text-gray-500" }, rec.checkTime)
                                                    );
                                                })
                                        )
                                    )
                                )
                            );
                        })() : null,
                        h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
                            h("div", { className: "bg-white border rounded-lg p-3 relative" },
                                h("div", { className: "flex justify-between items-center mb-2" },
                                    h("h4", { className: "font-bold text-green-600 flex items-center gap-2 text-sm" }, h(Icon, { name: "shield" }), "区间全勤"),
                                    (() => {
                                        const penaltyRules = getPenaltyRules(config);
                                        const perfectAttendanceBonus = penaltyRules.perfectAttendance || 10;
                                        return h("button", { onClick: handlePerfectBonus, className: "text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 shadow-sm" }, `🏆 全勤奖 +${perfectAttendanceBonus}`);
                                    })()
                                ),
                                h("div", { className: "flex flex-wrap gap-1" }, statsData.perfects.length > 0 ? statsData.perfects.map(name => h("span", { key: name, className: "text-xs bg-green-50 text-green-700 px-2 py-1 rounded" }, name)) : h("span", { className: "text-xs text-gray-400" }, "无"))
                            ),
                            h("div", { className: "bg-white border rounded-lg p-3" }, h("h4", { className: "font-bold text-orange-500 flex items-center gap-2 text-sm mb-2" }, h(Icon, { name: "flame" }), "连胜榜"), h("div", { className: "space-y-1 max-h-32 overflow-y-auto" }, statsData.bestStreaks.map((item, idx) => h("div", { key: item.name, className: "flex justify-between text-xs" }, h("span", null, `${idx + 1}. ${item.name}`), h("span", { className: "font-bold text-orange-600" }, `${item.val} 天`))))),
                            h("div", { className: "bg-white border rounded-lg p-3" }, h("h4", { className: "font-bold text-red-500 flex items-center gap-2 text-sm mb-2" }, h(Icon, { name: "alert" }), "迟到预警"), h("div", { className: "space-y-1 max-h-32 overflow-y-auto" }, statsData.mostLates.map(item => h("div", { key: item.name, className: "flex justify-between text-xs" }, h("span", null, item.name), h("span", { className: "font-bold text-red-600" }, `${item.val} 次`))))),
                            h("div", { className: "bg-white border rounded-lg p-3" }, h("h4", { className: "font-bold text-gray-600 flex items-center gap-2 text-sm mb-2" }, h(Icon, { name: "users" }), "缺勤统计"), h("div", { className: "space-y-1 max-h-32 overflow-y-auto" }, statsData.mostAbsents.map(item => h("div", { key: item.name, className: "flex justify-between text-xs" }, h("span", null, item.name), h("span", { className: "font-bold text-gray-700" }, `${item.val} 次`)))))
                        )
                    ),
                    view === 'revoke' && h("div", { className: "animate-fade-in" },
                        h("div", { className: "bg-orange-50 border border-orange-200 text-orange-800 p-3 rounded mb-4 text-xs" }, "管理员模式：勾选异常记录进行修正。"),
                        h("div", { className: "flex flex-wrap gap-2 justify-between mb-2 items-center" },
                            h("div", { className: "flex flex-wrap gap-3 items-center" },
                                h("span", { className: "text-sm font-bold" }, `发现 ${abnormalRecords.length} 条异常`),
                                h("label", { className: "flex items-center text-xs font-bold text-blue-600 cursor-pointer" },
                                    h("input", { type: "checkbox", checked: isAllSelected, onChange: toggleSelectAll, className: "mr-1" }),
                                    "全选当前"
                                ),
                                h("div", { className: "flex items-center gap-1" },
                                    h("span", { className: "text-xs text-gray-500" }, "日期:"),
                                    h("input", { type: "date", value: filterDate, onChange: e => setFilterDate(e.target.value), className: "border rounded text-xs p-1" })
                                ),
                                h("select", { value: filterSession, onChange: e => setFilterSession(e.target.value), className: "border rounded text-xs p-1" },
                                    h("option", { value: "all" }, "全部时段"),
                                    getScheduleConfig(config).map(item => h("option", { key: item.id, value: item.id }, item.name))
                                ),
                                h("select", { value: filterType, onChange: e => setFilterType(e.target.value), className: "border rounded text-xs p-1" },
                                    h("option", { value: "all" }, "全部类型"),
                                    h("option", { value: "late" }, "迟到"),
                                    h("option", { value: "absent" }, "缺勤")
                                )
                            ),
                            h("div", { className: "flex gap-2" },
                                h("button", { onClick: handleExportAttendanceExcel, className: "bg-white border text-gray-700 text-xs px-3 py-1 rounded hover:bg-gray-50" }, "导出 Excel"),
                                h("button", { onClick: handleBatchCorrect, disabled: selectedIssues.length === 0, className: "bg-green-600 text-white text-xs px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50" }, `修正/补卡`),
                                (() => {
                                    const penaltyRules = getPenaltyRules(config);
                                    const absentPenalty = penaltyRules.absent || -5;
                                    return h("button", { onClick: handleBatchAbsent, disabled: selectedIssues.length === 0, className: "bg-red-500 text-white text-xs px-3 py-1 rounded hover:bg-red-600 disabled:opacity-50" }, `结算缺勤 (${absentPenalty})`);
                                })(),
                                h("button", { onClick: handleSettleAllAbsent, className: "bg-gray-800 text-white text-xs px-3 py-1 rounded hover:bg-gray-700 flex items-center gap-1" }, h(Icon, { name: "lightning", size: 12 }), `一键结算所有`)
                            )
                        ),
                        h("div", { className: "border rounded bg-white max-h-80 overflow-y-auto" }, abnormalRecords.map(item => h("div", { key: item.id, className: "flex items-center p-2 border-b last:border-0 hover:bg-gray-50 text-xs cursor-pointer", onClick: () => { const set = new Set(selectedIssues); if (set.has(item.id)) set.delete(item.id); else set.add(item.id); setSelectedIssues(Array.from(set)); } }, h("input", { type: "checkbox", checked: selectedIssues.includes(item.id), readOnly: true, className: "mr-2" }), h("div", { className: "flex-1 grid grid-cols-4 gap-1" }, h("span", null, item.date), h("span", { className: "font-bold" }, item.name), h("span", { className: "text-gray-500" }, item.session), h("span", { className: item.type === 'late' ? 'text-red-500' : 'text-gray-500' }, item.desc)))))
                    )
                )
                ),
                AttendanceSettingsSection
                    ? h(AttendanceSettingsSection, {
                        systemConfig: getSystemConfig(config),
                        updateSystemConfig: (updater) => {
                            if (typeof updater !== 'function') return;
                            const nextSystemConfig = updater(getSystemConfig(config));
                            if (!nextSystemConfig) return;
                            if (typeof onUpdateAttendanceConfig === 'function') {
                                onUpdateAttendanceConfig(nextSystemConfig);
                                return;
                            }
                            alert("考勤设置已修改，但当前页面未提供配置持久化回调。");
                        }
                    })
                    : h("div", { className: "bg-white rounded-xl shadow-sm border p-4 space-y-2" },
                        h("div", { className: "font-bold text-sm text-gray-800" }, "考勤设置"),
                        h("div", { className: "text-xs text-gray-500" }, "考勤设置模块加载失败，请检查 `attendance/settings.js` 是否正常加载。")
                    )
            );
        };
    };
})();
