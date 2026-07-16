(function() {
    window.createAttendanceView = function createAttendanceView(deps) {
        const {
            h,
            useState,
            useEffect,
            useMemo,
            useRef,
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
            awardPerfectAttendance
        } = attendancePoints || {};
        const createAttendanceAdminTools = window.createAttendanceAdminTools;

        if (
            !h ||
            !useState ||
            !useEffect ||
            !useMemo ||
            !useRef ||
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
            attendanceRecords,
            onAttendanceCheckIn,
            onAttendanceMaintenance,
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

            const [currentTime, setCurrentTime] = useState(getNow());
            const [view, setView] = useState('checkin');
            const [checkInReceipt, setCheckInReceipt] = useState(null);
            const [checkInError, setCheckInError] = useState(null);
            const [pendingStudentName, setPendingStudentName] = useState('');
            const pendingCheckInRef = useRef(new Set());
            const [perfectBonusPending, setPerfectBonusPending] = useState(false);
            const [startDate, setStartDate] = useState(() => getThisWeekRange().start);
            const [endDate, setEndDate] = useState(() => getThisWeekRange().end);
            const [selectedIssues, setSelectedIssues] = useState([]);
            const [filterSession, setFilterSession] = useState('all');
            const [filterDate, setFilterDate] = useState('');
            const [filterType, setFilterType] = useState('all');
            const [newTeacherMsg, setNewTeacherMsg] = useState("");
            const [newStudentMsg, setNewStudentMsg] = useState("");
            const [queryStudentName, setQueryStudentName] = useState("");
            const records = attendanceRecords || {};

            useEffect(() => {
                const timer = setInterval(() => {
                    setCurrentTime(getNow());
                }, 1000);
                return () => clearInterval(timer);
            }, []);

            useEffect(() => {
                try {
                    const raw = sessionStorage.getItem('classmanager:pending-attendance');
                    if (!raw) return;
                    const pending = JSON.parse(raw);
                    if (!pending?.studentName || Date.now() - Number(pending.createdAt || 0) > 30 * 60 * 1000) {
                        sessionStorage.removeItem('classmanager:pending-attendance');
                        return;
                    }
                    setCheckInError({
                        studentName: pending.studentName,
                        message: `登录已恢复，请确认后重新为 ${pending.studentName} 打卡。`,
                        canRetry: true
                    });
                } catch (_) {
                    // Storage may be unavailable or contain stale data.
                }
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
                void now;
                const dateStr = getDateString(dateObj);
                return sourceRecords?.[dateStr]?.[studentName]?.[rule.id] || null;
            };

            const todayRules = useMemo(() => getRulesForDate(currentTime), [
                config,
                currentTime.getFullYear(),
                currentTime.getMonth(),
                currentTime.getDate()
            ]);

            const todayQuote = useMemo(() => {
                const safeQuotes = Array.isArray(quotes) ? quotes.filter(Boolean) : [];
                if (safeQuotes.length === 0) return '认真记录每一次成长';
                const start = new Date(currentTime.getFullYear(), 0, 0);
                const diff = currentTime - start;
                const oneDay = 1000 * 60 * 60 * 24;
                const dayOfYear = Math.floor(diff / oneDay);
                return safeQuotes[dayOfYear % safeQuotes.length];
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

            const handleCheckIn = async (studentName) => {
                if (pendingCheckInRef.current.has(studentName)) return;
                if (typeof onAttendanceCheckIn !== 'function') {
                    setCheckInError({ studentName, message: '考勤服务暂时不可用，请稍后重试。', canRetry: true });
                    return;
                }
                pendingCheckInRef.current.add(studentName);
                setPendingStudentName(studentName);
                setCheckInError(null);
                try {
                    const result = await onAttendanceCheckIn(studentName);
                    const checkIn = result?.checkIn || {};
                    if (!checkIn?.record) throw new Error('服务未返回有效打卡凭据');
                    const latestRecords = result?.attendanceRecords || records;
                    const streak = calculateStreak(studentName, latestRecords, currentTime);
                    setCheckInReceipt({
                        student: studentName,
                        sessionName: checkIn.sessionName || currentSession?.name || '当前时段',
                        checkTime: checkIn.record?.checkTime || currentTime.toLocaleTimeString('zh-CN', { hour12: false }),
                        streak,
                        status: checkIn.status,
                        usedMorningLateCard: checkIn.status === 'late' && checkIn.usedMorningLateCard,
                        pointsDelta: Number(checkIn.pointsDelta) || 0,
                        newBalance: Number(checkIn.newBalance) || 0
                    });
                    try {
                        sessionStorage.removeItem('classmanager:pending-attendance');
                    } catch (_) {
                        // Ignore storage errors after a successful server receipt.
                    }
                } catch (error) {
                    if (error?.code === 'ATTENDANCE_EXISTS') {
                        setCheckInError({ studentName, message: `${studentName} 在当前时段已经打卡，无需重复提交。`, canRetry: false });
                    } else if (error?.code === 'ATTENDANCE_SESSION_CLOSED') {
                        setCheckInError({ studentName, message: '当前不在可打卡时段，未写入任何记录。', canRetry: false });
                    } else if (error?.code === 'AUTH_REQUIRED') {
                        try {
                            sessionStorage.setItem('classmanager:pending-attendance', JSON.stringify({ studentName, createdAt: Date.now() }));
                        } catch (_) {
                            // The inline error still explains how to recover.
                        }
                        setCheckInError({
                            studentName,
                            message: `登录已失效，${studentName} 的打卡尚未提交。请重新登录后再确认一次。`,
                            requiresLogin: true,
                            canRetry: false
                        });
                    } else {
                        setCheckInError({ studentName, message: error?.message || '打卡失败，未写入记录。', canRetry: true });
                    }
                } finally {
                    pendingCheckInRef.current.delete(studentName);
                    setPendingStudentName(current => current === studentName ? '' : current);
                }
            };

            const handleLoginRecovery = () => {
                if (typeof window.__clearAuthAndRedirect__ === 'function') {
                    window.__clearAuthAndRedirect__();
                    return;
                }
                window.location.assign('/login.html');
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
                const updated = (teacherMessages || []).filter(msg => msg.id !== id);
                setTeacherMessages(updated);
            };

            const handlePostStudentMsg = () => {
                if (!newStudentMsg.trim()) return;
                const now = getNow();
                const msg = {
                    id: now.getTime(),
                    content: newStudentMsg,
                    time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                    date: getTodayStr(now)
                };
                const updatedMessages = [msg, ...(studentMessages || [])].slice(0, 20);
                setStudentMessages(updatedMessages);
                setNewStudentMsg("");
            };

            const handleDeleteStudentMsg = (id) => {
                const updated = (studentMessages || []).filter(msg => msg.id !== id);
                setStudentMessages(updated);
            };

            const getStreakDayStatus = (name, data, dateObj, now) => {
                const rules = getRulesForDate(dateObj);
                if (rules.length === 0) return 'skip';

                const dateStr = getDateString(dateObj);
                const dayRecords = data?.[dateStr]?.[name] || {};
                const isToday = getDateString(dateObj) === getDateString(now);
                let hasPendingSession = false;

                for (const rule of rules) {
                    const record = dayRecords?.[rule.id] || null;
                    if (record) {
                        if (record.status !== 'ok') return 'break';
                        continue;
                    }

                    if (isToday && !isPeriodEnded(dateObj, rule, now)) {
                        hasPendingSession = true;
                        continue;
                    }

                    return 'break';
                }

                if (isToday && hasPendingSession) return 'pending';
                return 'perfect';
            };

            const calculateStreak = (name, data, endDate) => {
                let streak = 0;
                let d = new Date(endDate);
                for (let i = 0; i < 365; i++) {
                    const dayStatus = getStreakDayStatus(name, data, d, endDate);
                    if (dayStatus === 'skip') {
                        d.setDate(d.getDate() - 1);
                        continue;
                    }
                    if (dayStatus === 'perfect') streak++;
                    else if (dayStatus === 'break') break;
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
                    stats[student.name] = { late: 0, absent: 0, perfect: true, streak: calculateStreak(student.name, records, currentTime) };
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
                if (await requireAdminAuth("请输入维护密码以进入修正模式：")) setView('revoke');
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
                                list.push({ id: `${dateStr}-${student.name}-${rule.id}`, date: dateStr, name: student.name, session: rule.name, sessionId: rule.id, type: 'late', desc: `迟到 ${rec.checkTime}` });
                            } else if (rec && rec.status === 'absent') {
                                if (filterType !== 'all' && filterType !== 'absent') return;
                                list.push({
                                    id: `${dateStr}-${student.name}-${rule.id}`,
                                    date: dateStr,
                                    name: student.name,
                                    session: rule.name,
                                    sessionId: rule.id,
                                    type: 'absent',
                                    settled: rec.checkTime === '已扣分',
                                    desc: rec.checkTime === '已扣分' ? '缺勤（已结算）' : '缺勤'
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

            const handleBatchCorrect = async () => {
                if (selectedIssues.length === 0) return;
                if (typeof onAttendanceMaintenance !== 'function') return alert("考勤维护接口未就绪");
                if (!confirm(`确定将选中的 ${selectedIssues.length} 条记录修正为“正常”吗？\n迟到：返还扣分\n缺勤：补录为正常`)) return;
                if (!await requireAdminAuth("请输入维护密码：")) return;
                try {
                    await onAttendanceMaintenance('correct', selectedIssues.map(id => abnormalRecords.find(item => item.id === id)).filter(Boolean));
                    setSelectedIssues([]);
                    alert("修正成功");
                } catch (error) {
                    if (error?.code !== 'AUTH_REQUIRED') {
                        alert(error?.message || '考勤修正失败');
                    }
                }
            };

            const handleBatchAbsent = async () => {
                const absentItems = selectedIssues
                    .map(id => abnormalRecords.find(item => item.id === id))
                    .filter(item => item && item.type === 'absent' && !item.settled);
                if (typeof onAttendanceMaintenance !== 'function') return alert("考勤维护接口未就绪");
                if (isFrozen) return alert("假期封存中，无法结算缺勤。请先在维护页面解除封存。");
                if (absentItems.length === 0) return alert("请至少选择一条缺勤记录");
                const penaltyRules = getPenaltyRules(config);
                const absentPenalty = penaltyRules.absent || -5;
                if (!confirm(`确定将选中的 ${absentItems.length} 条缺勤记录进行结算扣分吗？\n每条扣除 ${Math.abs(absentPenalty)} 分。`)) return;
                if (!await requireAdminAuth("请输入维护密码：")) return;
                try {
                    await onAttendanceMaintenance('settleAbsent', absentItems);
                    setSelectedIssues([]);
                    alert("结算成功");
                } catch (error) {
                    if (error?.code !== 'AUTH_REQUIRED') {
                        alert(error?.message || '缺勤结算失败');
                    }
                }
            };

            const handleSettleAllAbsent = async () => {
                if (typeof onAttendanceMaintenance !== 'function') return alert("考勤维护接口未就绪");
                if (isFrozen) return alert("假期封存中，无法结算缺勤。请先在维护页面解除封存。");
                const allAbsentItems = abnormalRecords.filter(item => item.type === 'absent' && !item.settled);
                if (allAbsentItems.length === 0) return alert("当前没有待结算的缺勤记录");
                const penaltyRules = getPenaltyRules(config);
                const absentPenalty = penaltyRules.absent || -5;
                if (!confirm(`确定要一键结算当前列表中的 ${allAbsentItems.length} 条缺勤记录吗？\n每条扣除 ${Math.abs(absentPenalty)} 分。`)) return;
                if (!await requireAdminAuth("请输入维护密码：")) return;
                try {
                    await onAttendanceMaintenance('settleAbsent', allAbsentItems);
                    const settledIds = new Set(allAbsentItems.map(item => item.id));
                    setSelectedIssues(selectedIssues.filter(id => !settledIds.has(id)));
                    alert("批量结算成功");
                } catch (error) {
                    if (error?.code !== 'AUTH_REQUIRED') {
                        alert(error?.message || '批量结算失败');
                    }
                }
            };

            const handlePerfectBonus = async () => {
                if (perfectBonusPending) return;
                if (isFrozen) return alert("假期封存中，无法发放全勤奖。请先在维护页面解除封存。");
                if (statsData.perfects.length === 0) return alert("当前名单无全勤学生");
                const penaltyRules = getPenaltyRules(config);
                const perfectAttendanceBonus = penaltyRules.perfectAttendance || 10;
                if (!confirm(`确定为当前全勤名单中的 ${statsData.perfects.length} 人发放 +${perfectAttendanceBonus} 分"周全勤奖"吗？`)) return;
                setPerfectBonusPending(true);
                try {
                    await Promise.resolve(awardPerfectAttendance({
                        perfectNames: statsData.perfects,
                        students,
                        perfectAttendanceBonus,
                        updatePoints
                    }));
                    alert("全勤奖已保存");
                } catch (error) {
                    alert(`全勤奖保存失败：${error?.message || '请检查网络后重试'}`);
                } finally {
                    setPerfectBonusPending(false);
                }
            };

            return h("div", { className: "space-y-4" },
                h("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative" },
                h("div", { className: "bg-blue-700 p-4 text-white flex justify-between items-center gap-4" },
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
                    h("div", { className: "flex items-center gap-2" }, h("div", { className: `px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 ${currentSession ? (currentSession.isLateNow ? 'bg-amber-100 text-amber-900' : 'bg-white text-blue-800') : 'bg-blue-900 text-blue-100'}` }, h("span", { className: `w-2 h-2 rounded-full ${currentSession ? (currentSession.isLateNow ? 'bg-amber-600' : 'bg-green-600') : 'bg-blue-300'}` }), currentSession ? `${currentSession.name} ${currentSession.isLateNow ? '已进入迟到时段' : '可打卡'}` : '当前非打卡时段'))
                ),
                h("div", { className: "md:hidden attendance-quote-mobile" },
                    h("div", { className: "attendance-quote-text" }, `“${todayQuote}”`)
                ),
                isFrozen && h("div", { className: "bg-amber-100 border-b border-amber-200 text-amber-900 text-sm py-2 px-4 text-center font-medium" }, "假期封存中：缺勤不记录、迟到不扣分、结算与全勤奖已暂停"),
                h("div", { className: "flex border-b bg-gray-50", role: "group", 'aria-label': "考勤功能" }, [{ id: 'checkin', label: '学生打卡', icon: 'check' }, { id: 'stats', label: '统计', icon: 'chart' }, { id: 'tools', label: '教师工具', icon: 'settings' }, { id: 'revoke', label: '修正', icon: 'clipboard' }].map(item => h("button", { key: item.id, 'aria-pressed': view === item.id, onClick: () => item.id === 'revoke' ? handleRevokeAuth() : setView(item.id), className: `flex-1 min-h-11 py-3 px-2 flex justify-center items-center gap-2 text-sm font-medium transition ${view === item.id ? 'bg-white text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-100'}` }, h(Icon, { name: item.icon, size: 16 }), item.label))),
                h("div", { className: "p-4 min-h-[400px]" },
                    view === 'checkin' && h("div", { className: "animate-fade-in space-y-4" },
                        h("section", { className: "bg-amber-50 border border-amber-200 rounded-xl p-4", 'aria-labelledby': 'attendance-notice-title' },
                            h("div", { className: "flex items-center gap-2 mb-3" },
                                h(Icon, { name: "message", className: "text-amber-700", size: 16 }),
                                h("h3", { id: 'attendance-notice-title', className: "font-bold text-amber-900 text-sm" }, "班主任通知")
                            ),
                            h("div", { className: "space-y-2" },
                                (!teacherMessages || teacherMessages.length === 0)
                                    ? h("div", { className: "text-amber-800 text-sm" }, "暂无通知")
                                    : teacherMessages.map(msg =>
                                        h("div", { key: msg.id, className: "bg-white p-3 rounded-lg border border-amber-100 text-sm" },
                                            h("div", { className: "text-gray-900 font-medium" }, msg.content),
                                            h("div", { className: "text-gray-500 text-xs text-right mt-1" }, `${msg.date} ${msg.time}`)
                                        )
                                    )
                            )
                        ),
                        h("div", { className: "p-3 bg-blue-50 rounded-lg border border-blue-100 flex flex-wrap items-center justify-between gap-2" }, h("div", { className: "font-bold text-blue-900 flex items-center gap-2" }, h(Icon, { name: "coffee" }), "今日规则"), todayRules.length === 0 ? h("span", { className: "text-sm text-blue-700" }, "休息日") : h("div", { className: "flex flex-wrap gap-2" }, todayRules.map(rule => h("span", { key: rule.id, className: "text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-700" }, `${rule.start}-${rule.end}（${rule.lateTime} 后记迟到）`)))),
                        checkInReceipt && h("section", {
                            className: `rounded-xl border p-4 ${checkInReceipt.status === 'ok' ? 'bg-green-50 border-green-200' : (checkInReceipt.usedMorningLateCard ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200')}`,
                            role: 'status',
                            'aria-live': 'polite',
                            'aria-atomic': 'true'
                        },
                            h("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" },
                                h("div", { className: "space-y-1" },
                                    h("h3", { className: `font-bold ${checkInReceipt.status === 'ok' ? 'text-green-900' : (checkInReceipt.usedMorningLateCard ? 'text-amber-900' : 'text-red-900')}` }, checkInReceipt.status === 'ok' ? '准点打卡已记录' : '迟到已记录'),
                                    h("p", { className: "text-sm text-gray-800" }, `${checkInReceipt.student} · ${checkInReceipt.sessionName} · ${checkInReceipt.checkTime}`),
                                    h("p", { className: "text-sm text-gray-700" }, checkInReceipt.status === 'ok'
                                        ? `${checkInReceipt.pointsDelta > 0 ? `本次加 ${checkInReceipt.pointsDelta} 分` : '本次积分不变'}，当前余额 ${checkInReceipt.newBalance} 分${checkInReceipt.streak > 0 ? `，连续全勤 ${checkInReceipt.streak} 天` : ''}。`
                                        : checkInReceipt.usedMorningLateCard
                                            ? `迟到卡已生效，本次不扣分；当前余额 ${checkInReceipt.newBalance} 分。`
                                            : `本次${checkInReceipt.pointsDelta < 0 ? `扣 ${Math.abs(checkInReceipt.pointsDelta)} 分` : '积分不变'}，当前余额 ${checkInReceipt.newBalance} 分。`)
                                ),
                                h("div", { className: "flex gap-2" },
                                    h("button", { onClick: handleRevokeAuth, className: "min-h-11 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50" }, "需要修正"),
                                    h("button", { onClick: () => setCheckInReceipt(null), 'aria-label': '关闭打卡凭据', className: "min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-gray-600 hover:bg-white" }, h(Icon, { name: 'x', size: 18 }))
                                )
                            )
                        ),
                        checkInError && h("section", { className: "rounded-xl border border-red-200 bg-red-50 p-4", role: 'alert' },
                            h("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" },
                                h("p", { className: "text-sm font-medium text-red-900" }, checkInError.message),
                                h("div", { className: "flex gap-2" },
                                    checkInError.requiresLogin && h("button", { onClick: handleLoginRecovery, className: "min-h-11 px-4 py-2 rounded-lg bg-red-700 text-white text-sm hover:bg-red-800" }, "重新登录"),
                                    checkInError.canRetry && h("button", { onClick: () => handleCheckIn(checkInError.studentName), className: "min-h-11 px-4 py-2 rounded-lg bg-red-700 text-white text-sm hover:bg-red-800" }, "重新提交"),
                                    h("button", { onClick: () => setCheckInError(null), className: "min-h-11 px-3 py-2 rounded-lg border border-red-300 bg-white text-red-800 text-sm" }, "关闭")
                                )
                            )
                        ),
                        h("div", { className: "grid grid-cols-4 sm:grid-cols-5 gap-2" }, students.map(student => {
                            const todayKey = getDateString(currentTime);
                            const isDone = currentSession && records[todayKey]?.[student.name]?.[currentSession.id];
                            const status = isDone?.status;
                            const isPending = pendingStudentName === student.name;
                            return h("button", {
                                key: student.id,
                                disabled: !currentSession || !!isDone || isPending,
                                onClick: () => handleCheckIn(student.name),
                                'aria-label': `${student.name}${isDone ? `，${status === 'ok' ? '已到' : '迟到'} ${isDone.checkTime}` : (isPending ? '，正在提交' : '，提交打卡')}`,
                                'aria-busy': isPending ? 'true' : undefined,
                                className: `p-2 rounded-lg border text-sm font-medium transition relative overflow-hidden min-h-[56px] flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDone ? (status === 'ok' ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800') : (currentSession ? 'bg-white border-gray-300 hover:border-blue-500' : 'bg-gray-50 border-gray-100 text-gray-400')}`
                            }, h("span", null, isPending ? '提交中…' : student.name), isDone && h("span", { className: "text-xs opacity-80 mt-1" }, `${status === 'ok' ? '已到' : '迟到'} ${isDone.checkTime}`));
                        }))
                    ),
                    view === 'tools' && h("div", { className: "animate-fade-in space-y-4" },
                        h("section", { className: "rounded-xl border border-gray-200 bg-white p-4 space-y-4", 'aria-labelledby': 'teacher-notice-tools-title' },
                            h("div", null,
                                h("h3", { id: 'teacher-notice-tools-title', className: "font-bold text-gray-900" }, "通知管理"),
                                h("p", { className: "mt-1 text-sm text-gray-600" }, "学生打卡页只展示已发布通知，编辑操作集中在这里。")
                            ),
                            h("div", { className: "flex flex-col gap-2 sm:flex-row" },
                                h("label", { className: "flex-1 text-sm font-medium text-gray-700", htmlFor: 'attendance-teacher-message' },
                                    "通知内容",
                                    h("input", {
                                        id: 'attendance-teacher-message',
                                        type: "text",
                                        className: "mt-1 w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                                        placeholder: "输入要展示给学生的通知",
                                        value: newTeacherMsg,
                                        onChange: (e) => setNewTeacherMsg(e.target.value),
                                        onKeyDown: (e) => e.key === 'Enter' && handlePostTeacherMsg()
                                    })
                                ),
                                h("button", { onClick: handlePostTeacherMsg, className: "min-h-11 self-end bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800" }, "发布通知")
                            ),
                            h("div", { className: "space-y-2" },
                                (!teacherMessages || teacherMessages.length === 0)
                                    ? h("p", { className: "text-sm text-gray-500" }, "暂无已发布通知")
                                    : teacherMessages.map(msg => h("div", { key: msg.id, className: "flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between" },
                                        h("div", null,
                                            h("p", { className: "text-sm font-medium text-gray-900" }, msg.content),
                                            h("p", { className: "mt-1 text-xs text-gray-500" }, `${msg.date} ${msg.time}`)
                                        ),
                                        h("button", { onClick: () => handleDeleteTeacherMsg(msg.id), 'aria-label': `删除通知：${msg.content}`, className: "min-h-11 px-3 py-2 rounded-lg border border-red-200 bg-white text-sm text-red-700 hover:bg-red-50" }, "删除")
                                    ))
                            )
                        ),
                        h("section", { className: "rounded-xl border border-gray-200 bg-white p-4 space-y-4", 'aria-labelledby': 'student-message-tools-title' },
                            h("div", null,
                                h("h3", { id: 'student-message-tools-title', className: "font-bold text-gray-900" }, "留言管理"),
                                h("p", { className: "mt-1 text-sm text-gray-600" }, "留言发布和清理不再占用学生打卡主流程。")
                            ),
                            h("div", { className: "flex flex-col gap-2 sm:flex-row" },
                                h("label", { className: "flex-1 text-sm font-medium text-gray-700", htmlFor: 'attendance-student-message' },
                                    "留言内容",
                                    h("input", {
                                        id: 'attendance-student-message',
                                        type: "text",
                                        className: "mt-1 w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                                        placeholder: "输入要记录的留言",
                                        value: newStudentMsg,
                                        onChange: (e) => setNewStudentMsg(e.target.value),
                                        onKeyDown: (e) => e.key === 'Enter' && handlePostStudentMsg()
                                    })
                                ),
                                h("button", { onClick: handlePostStudentMsg, className: "min-h-11 self-end bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800" }, "添加留言")
                            ),
                            h("div", { className: "space-y-2 max-h-56 overflow-y-auto" },
                                (!studentMessages || studentMessages.length === 0)
                                    ? h("p", { className: "text-sm text-gray-500" }, "暂无留言")
                                    : studentMessages.map(msg => h("div", { key: msg.id, className: "flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between" },
                                        h("div", null,
                                            h("p", { className: "text-sm text-gray-900 break-all" }, msg.content),
                                            h("p", { className: "mt-1 text-xs text-gray-500" }, `${msg.date} ${msg.time}`)
                                        ),
                                        h("button", { onClick: () => handleDeleteStudentMsg(msg.id), 'aria-label': `删除留言：${msg.content}`, className: "min-h-11 px-3 py-2 rounded-lg border border-red-200 bg-white text-sm text-red-700 hover:bg-red-50" }, "删除")
                                    ))
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
                            : h("div", { className: "bg-white rounded-xl border border-gray-200 p-4 space-y-2" },
                                h("div", { className: "font-bold text-sm text-gray-800" }, "考勤设置"),
                                h("div", { className: "text-sm text-gray-600" }, "考勤设置模块加载失败，请刷新页面后重试。")
                            )
                    ),
                    view === 'stats' && h("div", { className: "animate-fade-in space-y-6" },
                        h("div", { className: "flex items-end gap-2 text-sm bg-gray-50 p-3 rounded-lg flex-wrap" },
                            h("label", { className: "text-gray-700 font-medium", htmlFor: 'attendance-stats-start' }, "开始日期",
                                h("input", { id: 'attendance-stats-start', type: "date", value: startDate, onChange: e => setStartDate(e.target.value), className: "block mt-1 min-h-11 border rounded-lg px-2" })
                            ),
                            h("span", null, "-"),
                            h("label", { className: "text-gray-700 font-medium", htmlFor: 'attendance-stats-end' }, "结束日期",
                                h("input", { id: 'attendance-stats-end', type: "date", value: endDate, onChange: e => setEndDate(e.target.value), className: "block mt-1 min-h-11 border rounded-lg px-2" })
                            ),
                            h("label", { className: "text-gray-700 font-medium flex-1 min-w-[160px]", htmlFor: 'attendance-stats-student' }, "查询学生",
                                h("input", {
                                    id: 'attendance-stats-student',
                                    type: "text",
                                    value: queryStudentName,
                                    onChange: e => setQueryStudentName(e.target.value),
                                    placeholder: "输入学生姓名",
                                    className: "block mt-1 w-full min-h-11 border rounded-lg px-3 py-2"
                                })
                            )
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
                                        return h("button", {
                                            onClick: handlePerfectBonus,
                                            disabled: perfectBonusPending,
                                            'aria-busy': perfectBonusPending ? 'true' : undefined,
                                            className: "min-h-11 px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        }, perfectBonusPending ? "正在保存…" : `全勤奖 +${perfectAttendanceBonus}`);
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
                        h("div", { className: "bg-orange-50 border border-orange-200 text-orange-800 p-3 rounded mb-4 text-xs" }, "维护修正模式：输入维护密码后，可将迟到或缺勤修正为正常。"),
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
                                h("button", { onClick: handleExportAttendanceExcel, className: "min-h-11 bg-white border text-gray-700 text-xs px-3 py-2 rounded-lg hover:bg-gray-50" }, "导出 Excel"),
                                h("button", { onClick: handleBatchCorrect, disabled: selectedIssues.length === 0, className: "min-h-11 bg-green-700 text-white text-xs px-3 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50" }, `修正/补卡`),
                                (() => {
                                    const penaltyRules = getPenaltyRules(config);
                                    const absentPenalty = penaltyRules.absent || -5;
                                    return h("button", { onClick: handleBatchAbsent, disabled: selectedIssues.length === 0, className: "min-h-11 bg-red-700 text-white text-xs px-3 py-2 rounded-lg hover:bg-red-800 disabled:opacity-50" }, `结算缺勤 (${absentPenalty})`);
                                })(),
                                h("button", { onClick: handleSettleAllAbsent, className: "min-h-11 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-1" }, h(Icon, { name: "lightning", size: 12 }), `一键结算所有`)
                            )
                        ),
                        h("div", { className: "border rounded bg-white max-h-80 overflow-y-auto" }, abnormalRecords.map(item => h("label", { key: item.id, className: "min-h-11 flex items-center p-2 border-b last:border-0 hover:bg-gray-50 text-xs cursor-pointer" }, h("input", { type: "checkbox", checked: selectedIssues.includes(item.id), onChange: () => { const set = new Set(selectedIssues); if (set.has(item.id)) set.delete(item.id); else set.add(item.id); setSelectedIssues(Array.from(set)); }, className: "mr-2" }), h("span", { className: "sr-only" }, `选择 ${item.name} ${item.date} ${item.session} ${item.desc}`), h("div", { className: "flex-1 grid grid-cols-4 gap-1" }, h("span", null, item.date), h("span", { className: "font-bold" }, item.name), h("span", { className: "text-gray-500" }, item.session), h("span", { className: item.type === 'late' ? 'text-red-700' : 'text-gray-600' }, item.desc)))))
                    )
                )
                )
            );
        };
    };
})();
