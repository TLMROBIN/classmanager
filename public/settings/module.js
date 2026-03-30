(function() {
    window.createSettingsView = function createSettingsView(deps) {
        const {
            h,
            useState,
            useEffect,
            Icon,
            getNow,
            getDateString,
            getTodayStr,
            getSystemConfig,
            getGroupsConfig,
            getDormsConfig,
            getScheduleConfig,
            isAdminAuthed,
            clearAdminAuth,
            unlockAdminAuth,
            setupAdminAuth,
            changeAdminAuthPassword,
            fetchMaintenanceStatus,
            DEFAULT_SYSTEM_CONFIG,
            stripSystemConfigTreasures,
            sanitizeStoredConfig,
            normalizeCommissionerRoles,
            normalizeCustomRoles,
            getCustomRoles,
            getCommissionerRoles,
            buildNormalizedStudentProfiles,
            remapStudentProfilesToStudentsByName,
            hasStudentProfilesInData,
            restoreStudentProfilesFromData,
            battleNormalize,
            normalizeExamArchives,
            loadScriptOnce,
            getExamArchivesView,
            createSettingsExamArchivesSection,
            createSettingsStudentRosterSection,
            createSettingsSystemConfigSection,
            createSettingsToolsSection
        } = deps || {};

        if (
            !h ||
            !useState ||
            !useEffect ||
            !Icon ||
            !getNow ||
            !getDateString ||
            !getTodayStr ||
            !getSystemConfig ||
            !getGroupsConfig ||
            !getDormsConfig ||
            !getScheduleConfig ||
            !isAdminAuthed ||
            !clearAdminAuth ||
            !unlockAdminAuth ||
            !setupAdminAuth ||
            !changeAdminAuthPassword ||
            !fetchMaintenanceStatus ||
            !DEFAULT_SYSTEM_CONFIG ||
            !stripSystemConfigTreasures ||
            !sanitizeStoredConfig ||
            !normalizeCommissionerRoles ||
            !normalizeCustomRoles ||
            !getCustomRoles ||
            !getCommissionerRoles ||
            !buildNormalizedStudentProfiles ||
            !remapStudentProfilesToStudentsByName ||
            !hasStudentProfilesInData ||
            !restoreStudentProfilesFromData ||
            !battleNormalize ||
            !normalizeExamArchives ||
            !loadScriptOnce ||
            !getExamArchivesView ||
            !createSettingsExamArchivesSection ||
            !createSettingsStudentRosterSection ||
            !createSettingsSystemConfigSection ||
            !createSettingsToolsSection
        ) {
            throw new Error('SettingsView dependencies are missing');
        }

        const renderExamArchivesSection = createSettingsExamArchivesSection({ h, Icon });
        const StudentRosterSection = createSettingsStudentRosterSection({ h });
        const renderSystemConfigSection = createSettingsSystemConfigSection({ h, Icon });
        const renderToolsSection = createSettingsToolsSection({ h, useState, getNow, getDateString });
        const isValidScheduleDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
        const normalizeScheduleNotes = (value) => {
            if (!value || typeof value !== 'object') return {};
            return Object.entries(value).reduce((acc, [date, note]) => {
                const safeDate = String(date || '').trim();
                const safeNote = String(note || '').trim();
                if (!isValidScheduleDate(safeDate) || !safeNote) return acc;
                acc[safeDate] = safeNote;
                return acc;
            }, {});
        };

    const SettingsView = ({ students, studentProfiles, setStudentProfiles, history, config, setStudents, setHistory, setConfig, treasures, setTreasures, storage, setStorage, logs, setLogs, quotes, setQuotes, persistData, persistDataPatch, tasks, setTasks, messages, setMessages, teacherMessages, setTeacherMessages, redemptionHistory, setRedemptionHistory, dailyRedemptionCounts, setDailyRedemptionCounts, dailyUsageCounts, setDailyUsageCounts, battle, setBattle, examArchives, setExamArchives, isDirtyRef, testMode, enterTestMode, exitTestMode, simTime, setSimTime, timeSpeed, setTimeSpeed }) => {
        const [isAuthenticated, setIsAuthenticated] = useState(isAdminAuthed());
        const [pwd, setPwd] = useState('');
        const [setupPassword, setSetupPassword] = useState('');
        const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
        const [authPending, setAuthPending] = useState(false);
        const [maintenanceStatus, setMaintenanceStatus] = useState({
            loading: true,
            configured: false,
            unlocked: isAdminAuthed(),
            expiresAt: null,
            error: ''
        });
        const getReportRange = (days) => {
            const end = getTodayStr();
            const start = new Date(getNow());
            start.setDate(start.getDate() - (days - 1));
            return { start: getDateString(start), end };
        };
        const [reportStart, setReportStart] = useState(() => getReportRange(7).start);
        const [reportEnd, setReportEnd] = useState(() => getReportRange(7).end);
        const [countdownName, setCountdownName] = useState("");
        const [countdownDate, setCountdownDate] = useState("");
        const initialScheduleDate = getDateString(getNow());
        const [scheduleDate, setScheduleDate] = useState(() => initialScheduleDate);
        const [scheduleText, setScheduleText] = useState(() => {
            const scheduleNotes = config?.scheduleNotes && typeof config.scheduleNotes === 'object'
                ? config.scheduleNotes
                : {};
            return String(scheduleNotes[initialScheduleDate] || '');
        });
        const [showExamArchivesManager, setShowExamArchivesManager] = useState(false);
        const [showStudentRosterManager, setShowStudentRosterManager] = useState(false);
        const [showOrganizationManager, setShowOrganizationManager] = useState(false);
        const [showCustomRolesManager, setShowCustomRolesManager] = useState(false);
        const [examArchivesModuleStatus, setExamArchivesModuleStatus] = useState(typeof window.createExamArchivesView === 'function' ? 'ready' : 'idle');
        const setConfigSafe = (next) => {
            if (typeof setConfig !== 'function') return;
            if (typeof next === 'function') {
                setConfig(prev => sanitizeStoredConfig(next(prev)));
                return;
            }
            setConfig(sanitizeStoredConfig(next));
        };
        const systemConfig = getSystemConfig(config);
        const ExamArchivesView = examArchivesModuleStatus === 'ready' ? getExamArchivesView() : null;
        const formatDateTimeLocal = (ts) => {
            const d = new Date(ts);
            if (isNaN(d.getTime())) return "";
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        const refreshMaintenanceState = () => {
            setMaintenanceStatus(prev => ({ ...prev, loading: true, error: '' }));
            return fetchMaintenanceStatus()
                .then(status => {
                    const nextStatus = {
                        loading: false,
                        configured: !!status?.configured,
                        unlocked: !!status?.unlocked,
                        expiresAt: status?.expiresAt || null,
                        error: ''
                    };
                    setMaintenanceStatus(nextStatus);
                    setIsAuthenticated(nextStatus.unlocked);
                    return nextStatus;
                })
                .catch(err => {
                    console.error('获取维护状态失败:', err);
                    setMaintenanceStatus({
                        loading: false,
                        configured: false,
                        unlocked: false,
                        expiresAt: null,
                        error: err?.message || '获取维护状态失败'
                    });
                    setIsAuthenticated(false);
                    return null;
                });
        };

        useEffect(() => {
            refreshMaintenanceState();
        }, []);

        const handleUnlock = () => {
            const nextPassword = pwd.trim();
            if (!nextPassword) return alert("请输入维护密码");
            setAuthPending(true);
            unlockAdminAuth(nextPassword)
                .then(() => {
                    setPwd('');
                    setIsAuthenticated(true);
                    return refreshMaintenanceState();
                })
                .catch(err => {
                    if (err?.code !== 'AUTH_REQUIRED') {
                        alert(err?.message || '维护密码验证失败');
                    }
                })
                .finally(() => setAuthPending(false));
        };

        const handleSetupMaintenance = () => {
            const nextPassword = setupPassword.trim();
            const confirmPassword = setupConfirmPassword.trim();
            if (!nextPassword) return alert("请输入新的维护密码");
            if (nextPassword.length < 6) return alert("维护密码长度至少 6 个字符");
            if (nextPassword !== confirmPassword) return alert("两次输入的维护密码不一致");
            setAuthPending(true);
            setupAdminAuth(nextPassword)
                .then(() => {
                    setSetupPassword('');
                    setSetupConfirmPassword('');
                    setIsAuthenticated(true);
                    return refreshMaintenanceState();
                })
                .catch(err => {
                    if (err?.code !== 'AUTH_REQUIRED') {
                        alert(err?.message || '初始化维护密码失败');
                    }
                })
                .finally(() => setAuthPending(false));
        };

        const handleChangeMaintenancePassword = () => {
            const currentPassword = prompt("请输入当前维护密码：");
            if (currentPassword === null) return;
            const newPassword = prompt("请输入新的维护密码：");
            if (newPassword === null) return;
            const confirmPassword = prompt("请再次输入新的维护密码：");
            if (confirmPassword === null) return;
            if (newPassword.trim() !== confirmPassword.trim()) {
                alert("两次输入的维护密码不一致");
                return;
            }
            setAuthPending(true);
            changeAdminAuthPassword(currentPassword.trim(), newPassword.trim())
                .then(() => {
                    alert("维护密码已更新");
                    return refreshMaintenanceState();
                })
                .catch(err => {
                    if (err?.code !== 'AUTH_REQUIRED') {
                        alert(err?.message || '修改维护密码失败');
                    }
                })
                .finally(() => setAuthPending(false));
        };

        const applySystemConfig = (next) => {
            const newConfig = { ...config, systemConfig: stripSystemConfigTreasures(next) };
            setConfigSafe(newConfig);
            if (Array.isArray(next.quotes)) setQuotes(next.quotes);
        };

        const updateSystemConfig = (updater) => {
            const next = updater(getSystemConfig(config));
            applySystemConfig(next);
        };

        const addCountdownEvent = () => {
            const name = (countdownName || "").trim();
            if (!name || !countdownDate) return alert("请填写事件名称和日期");
            const list = Array.isArray(config.countdownEvents) ? [...config.countdownEvents] : [];
            list.push({ id: Date.now(), name, date: countdownDate });
            setConfigSafe({ ...config, countdownEvents: list });
            setCountdownName("");
            setCountdownDate("");
        };
        const removeCountdownEvent = (id) => {
            const list = Array.isArray(config.countdownEvents) ? config.countdownEvents.filter(e => e.id !== id) : [];
            setConfigSafe({ ...config, countdownEvents: list });
        };
        const handleGenerateBrief = () => {
            const start = new Date(reportStart);
            const end = new Date(reportEnd);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return alert("日期范围无效");
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            const list = (history || []).filter(h => h && h.ts >= start.getTime() && h.ts <= end.getTime());
            const byStudent = new Map();
            list.forEach(h => {
                const arr = byStudent.get(h.studentId) || [];
                arr.push(h);
                byStudent.set(h.studentId, arr);
            });
            const lines = [];
            lines.push(`简报 ${reportStart} ~ ${reportEnd}`);
            (students || []).forEach(s => {
                lines.push("");
                lines.push(s.name);
                const items = (byStudent.get(s.id) || []).sort((a, b) => a.ts - b.ts);
                if (items.length === 0) {
                    lines.push("  无记录");
                } else {
                    items.forEach(it => {
                        const val = Number(it.val) || 0;
                        const signVal = val > 0 ? `+${val}` : `${val}`;
                        lines.push(`  ${new Date(it.ts).toLocaleString('zh-CN', { hour12: false })} ${it.reason} ${signVal}`);
                    });
                }
            });
            const blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `简报_${reportStart}_${reportEnd}.txt`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        };

        const scheduleNotes = normalizeScheduleNotes(config?.scheduleNotes);
        const handleScheduleDateChange = (value) => {
            const nextDate = String(value || '').trim();
            setScheduleDate(nextDate);
            setScheduleText(isValidScheduleDate(nextDate) ? String(scheduleNotes[nextDate] || '') : '');
        };
        const handleScheduleEdit = (date, note = '') => {
            const nextDate = String(date || '').trim();
            if (!isValidScheduleDate(nextDate)) return;
            setScheduleDate(nextDate);
            setScheduleText(String(note || '').trim());
        };
        const handleSaveSchedule = (nextDateInput = scheduleDate, nextTextInput = scheduleText) => {
            if (nextDateInput && typeof nextDateInput === 'object' && nextDateInput.target) {
                nextDateInput = scheduleDate;
            }
            if (nextTextInput && typeof nextTextInput === 'object' && nextTextInput.target) {
                nextTextInput = scheduleText;
            }
            const nextDate = String(nextDateInput || '').trim();
            const nextText = String(nextTextInput || '').trim();
            if (!nextDate) return alert('请选择日程日期');
            if (!isValidScheduleDate(nextDate)) return alert('日程日期格式无效，请重新选择');
            setConfigSafe(prev => {
                const nextScheduleNotes = normalizeScheduleNotes(prev?.scheduleNotes);
                if (nextText) {
                    nextScheduleNotes[nextDate] = nextText;
                } else {
                    delete nextScheduleNotes[nextDate];
                }
                return { ...prev, scheduleNotes: nextScheduleNotes };
            });
            setScheduleText(nextText);
            alert(nextText ? '日程已保存' : '日程已清空');
        };
        const handleDeleteSchedule = (date) => {
            if (!date) return;
            setConfigSafe(prev => {
                const nextScheduleNotes = normalizeScheduleNotes(prev?.scheduleNotes);
                delete nextScheduleNotes[String(date).trim()];
                return { ...prev, scheduleNotes: nextScheduleNotes };
            });
            if (date === scheduleDate) {
                setScheduleText('');
            }
        };

        const historySource = Array.isArray(history) ? history : [];

        const STUDENT_IMPORT_HEADERS = ["姓名", "性别", "小组", "职位", "宿舍"];
        const getStudentImportArchitecture = () => {
            const systemConfig = getSystemConfig(config);
            return {
                systemConfig,
                groupsList: Array.isArray(systemConfig.organization?.groups) ? systemConfig.organization.groups : [],
                dormsList: Array.isArray(systemConfig.organization?.dorms) ? systemConfig.organization.dorms : []
            };
        };
        const validateStudentImportPrerequisites = (actionLabel) => {
            const architecture = getStudentImportArchitecture();
            const missing = [];
            if (architecture.groupsList.length === 0) missing.push("小组");
            if (architecture.dormsList.length === 0) missing.push("宿舍");
            if (missing.length > 0) {
                alert(`请先在“系统配置 -> 组织架构”中完成${missing.join("、")}设置，再${actionLabel}。`);
                return null;
            }
            return architecture;
        };
        const handleDownloadStudentTemplate = () => {
            const architecture = validateStudentImportPrerequisites("下载学生名单导入模板");
            if (!architecture) return;
            const { systemConfig, groupsList, dormsList } = architecture;
            const templateSheet = XLSX.utils.aoa_to_sheet([STUDENT_IMPORT_HEADERS]);
            templateSheet["!cols"] = [
                { wch: 12 },
                { wch: 8 },
                { wch: 14 },
                { wch: 10 },
                { wch: 14 }
            ];
            const guideSheet = XLSX.utils.aoa_to_sheet([
                ["说明", "请勿修改第 1 行表头。学生数据从第 2 行开始填写；任一条数据错误都会导致整批导入失败。"],
                ["班级", systemConfig.className || ""],
                ["模板生成日期", getTodayStr()],
                [],
                ["允许的性别"],
                ["男"],
                ["女"],
                [],
                ["允许的职位"],
                ["组长"],
                ["组员"],
                [],
                ["允许的小组"],
                ...groupsList.map(group => [group.name || ""]),
                [],
                ["允许的宿舍"],
                ...dormsList.map(dorm => [dorm.name || ""])
            ]);
            guideSheet["!cols"] = [{ wch: 24 }, { wch: 48 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, templateSheet, "学生名单");
            XLSX.utils.book_append_sheet(wb, guideSheet, "导入说明");
            XLSX.writeFile(wb, `学生名单导入模板_${getTodayStr()}.xlsx`);
        };
        const parseStudentImportWorkbook = (sheet) => {
            const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
            const headerRow = Array.isArray(rawRows[0]) ? rawRows[0].map(val => String(val || "").trim()) : [];
            const expected = STUDENT_IMPORT_HEADERS;
            const headerMatched = expected.every((label, idx) => headerRow[idx] === label);
            const extraHeaders = headerRow.slice(expected.length).filter(Boolean);
            if (!headerMatched || headerRow.length < expected.length || extraHeaders.length > 0) {
                return {
                    ok: false,
                    error: `表头错误。\n要求表头：${expected.join(" / ")}\n当前表头：${headerRow.slice(0, expected.length).join(" / ") || "空"}`
                };
            }
            return {
                ok: true,
                rows: rawRows.slice(1).map((row, index) => ({
                    excelRow: index + 2,
                    name: String(row[0] || "").trim(),
                    genderRaw: String(row[1] || "").trim(),
                    groupRaw: String(row[2] || "").trim(),
                    roleRaw: String(row[3] || "").trim(),
                    dormRaw: String(row[4] || "").trim()
                }))
            };
        };
        const validateStudentImportRows = (rows, architecture) => {
            const groupMap = new Map();
            const dormMap = new Map();
            architecture.groupsList.forEach(group => {
                if (group?.id != null) groupMap.set(String(group.id), String(group.id));
                if (group?.name) groupMap.set(String(group.name), String(group.id));
            });
            architecture.dormsList.forEach(dorm => {
                if (dorm?.id != null) dormMap.set(String(dorm.id), String(dorm.id));
                if (dorm?.name) dormMap.set(String(dorm.name), String(dorm.id));
            });

            const errors = [];
            const nameSeen = new Map();
            const normalizedRows = [];
            rows.forEach(row => {
                const values = [row.name, row.genderRaw, row.groupRaw, row.roleRaw, row.dormRaw];
                if (values.every(val => !String(val || "").trim())) return;

                const genderToken = row.genderRaw ? String(row.genderRaw).trim().toUpperCase() : "";
                const roleToken = row.roleRaw ? String(row.roleRaw).trim().toLowerCase() : "";
                if (!row.name) {
                    errors.push(`第 ${row.excelRow} 行：姓名不能为空`);
                } else if (nameSeen.has(row.name)) {
                    errors.push(`第 ${row.excelRow} 行：姓名“${row.name}”重复（首次出现在第 ${nameSeen.get(row.name)} 行）`);
                } else {
                    nameSeen.set(row.name, row.excelRow);
                }
                if (genderToken && genderToken !== "男" && genderToken !== "女" && genderToken !== "M" && genderToken !== "F") {
                    errors.push(`第 ${row.excelRow} 行：性别“${row.genderRaw}”不合法，只允许填写 男/女`);
                }
                if (roleToken && roleToken !== "组长" && roleToken !== "组员" && roleToken !== "leader" && roleToken !== "member") {
                    errors.push(`第 ${row.excelRow} 行：职位“${row.roleRaw}”不合法，只允许填写 组长/组员`);
                }
                if (row.groupRaw && !groupMap.has(row.groupRaw)) {
                    errors.push(`第 ${row.excelRow} 行：小组“${row.groupRaw}”未在组织架构中定义`);
                }
                if (row.dormRaw && !dormMap.has(row.dormRaw)) {
                    errors.push(`第 ${row.excelRow} 行：宿舍“${row.dormRaw}”未在组织架构中定义`);
                }

                normalizedRows.push({
                    excelRow: row.excelRow,
                    name: row.name,
                    gender: genderToken === "男" || genderToken === "M" ? "M" : genderToken === "女" || genderToken === "F" ? "F" : "",
                    group: row.groupRaw ? groupMap.get(row.groupRaw) : "",
                    role: roleToken === "组长" || roleToken === "leader" ? "leader" : roleToken === "组员" || roleToken === "member" ? "member" : "",
                    dorm: row.dormRaw ? dormMap.get(row.dormRaw) : ""
                });
            });

            if (normalizedRows.length === 0) {
                errors.push("导入文件中没有可用的学生数据");
            }

            return { errors, normalizedRows };
        };
        const handleExportStudentsExcel = () => {
            const groupsConfig = getGroupsConfig(config);
            const dormsConfig = getDormsConfig(config);
            const data = (students || []).map(s => ({
                "姓名": s.name || "",
                "性别": s.gender === 'M' ? '男' : s.gender === 'F' ? '女' : '',
                "小组": groupsConfig[s.group]?.name || s.group || "",
                "职位": s.role === 'leader' ? '组长' : s.role === 'member' ? '组员' : '',
                "宿舍": dormsConfig[s.dorm] || s.dorm || ""
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "学生名单");
            XLSX.writeFile(wb, `学生名单_${getTodayStr()}.xlsx`);
        };

        const persistStudentRosterChanges = ({ nextStudents, nextStudentProfiles, successMessage }) => {
            setStudents(nextStudents);
            if (typeof setStudentProfiles === 'function') {
                setStudentProfiles(nextStudentProfiles);
            }
            if (isDirtyRef) isDirtyRef.current = true;
            if (typeof persistDataPatch !== 'function') {
                if (isDirtyRef) isDirtyRef.current = false;
                if (successMessage) alert(successMessage);
                return Promise.resolve();
            }
            return persistDataPatch({
                students: nextStudents,
                studentProfiles: nextStudentProfiles
            }, {
                suppressFollowupAutoSave: true
            }).then(() => {
                if (isDirtyRef) isDirtyRef.current = false;
                if (successMessage) alert(successMessage);
            }).catch(err => {
                if (isDirtyRef) isDirtyRef.current = false;
                console.error('学生名单保存失败:', err);
                alert(err?.message || '学生名单已导入，但保存失败，请先不要退出登录并重试');
                if (err && typeof err === 'object') err.__studentRosterSaveAlerted = true;
                throw err;
            });
        };
        
        const handleImportStudentsExcel = (e, mode = 'overwrite') => {
            const file = e.target.files[0];
            if (!file) return;
            const architecture = validateStudentImportPrerequisites("导入学生名单");
            if (!architecture) {
                e.target.value = '';
                return;
            }
            const importGuards = window.ClassManagerImportGuards;
            if (!importGuards?.readWorkbookFromFile || !importGuards?.getFirstWorksheet || !importGuards?.assertWorksheetRows) {
                alert("导入组件未加载，请刷新后重试");
                e.target.value = '';
                return;
            }
            void importGuards.readWorkbookFromFile({
                file,
                xlsx: XLSX,
                label: "导入学生名单",
                maxSheets: 2
            }).then((wb) => {
                const parsedWorkbook = parseStudentImportWorkbook(importGuards.getFirstWorksheet(wb, "导入学生名单"));
                if (!parsedWorkbook.ok) {
                    alert(parsedWorkbook.error);
                    return;
                }
                importGuards.assertWorksheetRows(parsedWorkbook.rows, {
                    label: "导入学生名单",
                    maxRows: 500,
                    emptyMessage: "导入文件中没有可用的学生数据"
                });
                const validation = validateStudentImportRows(parsedWorkbook.rows, architecture);
                if (validation.errors.length > 0) {
                    const visibleErrors = validation.errors.slice(0, 12);
                    const remaining = validation.errors.length - visibleErrors.length;
                    alert([
                        `导入失败，共发现 ${validation.errors.length} 处问题：`,
                        ...visibleErrors,
                        remaining > 0 ? `……其余 ${remaining} 处问题未展开` : ""
                    ].filter(Boolean).join("\n"));
                    return;
                }
                const normalizeName = (val) => String(val || "").trim();
                if (mode === 'merge') {
                    if (!confirm(`解析到 ${validation.normalizedRows.length} 条学生记录，确定【增量导入】吗？将更新同名学生并新增不存在学生。`)) return;
                    const incoming = validation.normalizedRows.map(({ excelRow, ...student }) => student).filter(s => s.name);
                    const list = Array.isArray(students) ? students : [];
                    const byName = new Map(list.map(s => [normalizeName(s.name), s]));
                    const updates = new Map(incoming.map(s => [normalizeName(s.name), s]));
                    const updated = list.map(s => {
                        const key = normalizeName(s.name);
                        const patch = updates.get(key);
                        if (!patch) return s;
                        return { ...s, ...patch };
                    });
                    const now = Date.now();
                    const additions = incoming
                        .filter(s => !byName.has(normalizeName(s.name)))
                        .map((s, idx) => ({ id: now + idx, ...s, zizai: 0, balance: 0, penalty: 0 }));
                    const nextStudents = [...updated, ...additions];
                    const nextStudentProfiles = restoreStudentProfilesFromData({ students: nextStudents }, studentProfiles, list);
                    return persistStudentRosterChanges({
                        nextStudents,
                        nextStudentProfiles,
                        successMessage: "学生名单已增量导入并保存"
                    });
                } else {
                    if (!confirm(`解析到 ${validation.normalizedRows.length} 条学生记录，确定覆盖现有名单吗？`)) return;
                    const now = Date.now();
                    const newStudents = validation.normalizedRows.map((row, idx) => {
                        const { excelRow, ...parsed } = row;
                        return {
                            id: now + idx,
                            ...parsed,
                            zizai: 0,
                            balance: 0,
                            penalty: 0
                        };
                    });
                    const nextStudentProfiles = remapStudentProfilesToStudentsByName(students, newStudents, studentProfiles);
                    return persistStudentRosterChanges({
                        nextStudents: newStudents,
                        nextStudentProfiles,
                        successMessage: "学生名单已更新并保存"
                    });
                }
            }).catch((error) => {
                if (error?.__studentRosterSaveAlerted) return;
                alert(error?.message || "导入失败，请检查 Excel 文件");
            }).finally(() => {
                e.target.value = '';
            });
        };
        const updateStudent = (id, patch) => {
            setStudents(prev => (Array.isArray(prev) ? prev : []).map(s => s.id === id ? { ...s, ...patch } : s));
        };
        const removeStudent = (id) => {
            setStudents(prev => (Array.isArray(prev) ? prev : []).filter(s => s.id !== id));
            setStudentProfiles(prev => {
                const normalized = buildNormalizedStudentProfiles(prev, students);
                const nextEntries = { ...(normalized.entries || {}) };
                delete nextEntries[String(id)];
                return { ...normalized, entries: nextEntries };
            });
        };
        const addStudent = () => {
            const now = Date.now();
            const newStudent = { id: now, name: "", gender: "", group: "", role: "member", dorm: "", zizai: 0, balance: 0, penalty: 0 };
            setStudents([...(Array.isArray(students) ? students : []), newStudent]);
        };
        // 锁屏界面逻辑
        if (!isAuthenticated) {
            return h("div", { className: "min-h-[500px] flex items-center justify-center animate-fade-in" },
                h("div", { className: "bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center" },
                    h("div", { className: "mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-blue-600" }, h(Icon, { name: "lock", size: 32 })),
                    h("h2", { className: "text-2xl font-bold text-gray-800 mb-2" }, "维护验证"),
                    h("p", { className: "text-gray-500 mb-4 text-sm" }, maintenanceStatus.loading ? "正在检查维护权限..." : "进入维护中心需要维护密码验证"),
                    maintenanceStatus.error && h("div", { className: "bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-left text-sm text-red-600" }, maintenanceStatus.error),
                    maintenanceStatus.loading
                        ? h("div", { className: "text-sm text-gray-500 py-6" }, "请稍候...")
                        : maintenanceStatus.error
                            ? h("div", { className: "space-y-4" },
                                h("div", { className: "text-sm text-gray-500" }, "无法获取维护状态，请检查服务后重试。"),
                                h("button", {
                                    onClick: refreshMaintenanceState,
                                    className: "w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition"
                                }, "重新检查")
                            )
                            : maintenanceStatus.configured
                            ? h("div", { className: "space-y-4" },
                                h("input", {
                                    type: "password",
                                    value: pwd,
                                    onChange: e => setPwd(e.target.value),
                                    onKeyDown: e => {
                                        if (e.key === 'Enter' && !authPending) handleUnlock();
                                    },
                                    placeholder: "请输入维护密码",
                                    className: "w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition"
                                }),
                                h("button", {
                                    onClick: handleUnlock,
                                    disabled: authPending,
                                    className: "w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
                                }, authPending ? "验证中..." : "解锁进入")
                            )
                            : h("div", { className: "space-y-4 text-left" },
                                h("div", { className: "bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700" }, "当前账号尚未初始化维护密码。设置完成后，修改设置和维护数据时将使用新的维护密码验证。"),
                                h("input", {
                                    type: "password",
                                    value: setupPassword,
                                    onChange: e => setSetupPassword(e.target.value),
                                    placeholder: "请输入新的维护密码",
                                    className: "w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition"
                                }),
                                h("input", {
                                    type: "password",
                                    value: setupConfirmPassword,
                                    onChange: e => setSetupConfirmPassword(e.target.value),
                                    onKeyDown: e => {
                                        if (e.key === 'Enter' && !authPending) handleSetupMaintenance();
                                    },
                                    placeholder: "请再次输入维护密码",
                                    className: "w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition"
                                }),
                                h("button", {
                                    onClick: handleSetupMaintenance,
                                    disabled: authPending,
                                    className: "w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
                                }, authPending ? "初始化中..." : "初始化维护密码")
                            )
                )
            );
        }

        const handleResetSystemConfig = () => {
            if (!confirm("确定要将系统配置恢复为默认值吗？")) return;
            applySystemConfig(JSON.parse(JSON.stringify(DEFAULT_SYSTEM_CONFIG)));
            setTreasures(DEFAULT_SYSTEM_CONFIG.treasures || []);
            alert("系统配置已重置");
        };

        const ensureExamArchivesModule = () => {
            if (examArchivesModuleStatus === 'ready' || examArchivesModuleStatus === 'loading') return;
            setExamArchivesModuleStatus('loading');
            loadScriptOnce('exam-archives-module.js')
                .then(() => {
                    if (typeof window.createExamArchivesView === 'function') {
                        getExamArchivesView();
                        setExamArchivesModuleStatus('ready');
                    } else {
                        setExamArchivesModuleStatus('error');
                    }
                })
                .catch(err => {
                    console.error('加载考试档案模块失败:', err);
                    setExamArchivesModuleStatus('error');
                });
        };

        const openExamArchivesManager = () => {
            setShowExamArchivesManager(prev => !prev);
            ensureExamArchivesModule();
        };
        const handleDutyChange = (day, idx, name) => {
            const newDuty = { ...(config.duty || {}) };
            const row = Array.isArray(newDuty[day]) ? [...newDuty[day]] : [];
            row[idx] = name;
            newDuty[day] = row;
            setConfigSafe({ ...config, duty: newDuty });
        };
        const persistExamArchiveChanges = ({ battle: nextBattle, examArchives: nextExamArchives, successMessage, failureMessage }) => {
            if (isDirtyRef) isDirtyRef.current = true;
            if (typeof persistDataPatch !== 'function') {
                if (isDirtyRef) isDirtyRef.current = false;
                if (successMessage) alert(successMessage);
                return Promise.resolve();
            }
            return persistDataPatch({
                battle: nextBattle,
                examArchives: nextExamArchives
            }, {
                suppressFollowupAutoSave: true
            }).then(() => {
                if (isDirtyRef) isDirtyRef.current = false;
                if (successMessage) alert(successMessage);
            }).catch(err => {
                if (isDirtyRef) isDirtyRef.current = false;
                console.error('考试档案保存失败:', err);
                alert(failureMessage || "考试档案已更新，但保存失败，请手动刷新确认");
            });
        };

        const handleSaveConfigChanges = () => {
            const saveAction = typeof persistDataPatch === 'function'
                ? persistDataPatch({
                    config,
                    quotes
                }, {
                    suppressFollowupAutoSave: true
                })
                : (typeof persistData === 'function'
                    ? persistData({
                        config,
                        quotes
                    })
                    : Promise.resolve());

            return Promise.resolve(saveAction)
                .then(() => {
                    alert("配置已保存！");
                })
                .catch(err => {
                    console.error('配置保存失败:', err);
                    alert(err?.message || '配置保存失败');
                });
        };

        return h("div", { className: "bg-white p-8 rounded-xl shadow-lg animate-fade-in max-w-4xl mx-auto flex flex-col gap-8" },
            h("div", { className: "border-b pb-4 flex justify-between items-center", style: { order: -2 } },
                h("div", null,
                    h("h2", { className: "text-2xl font-bold text-gray-800" }, "🔧 系统维护中心"), 
                    h("p", { className: "text-gray-500 text-sm mt-1" }, "已获取维护权限")
                ),
                h("button", { 
                    onClick: () => {
                        clearAdminAuth();
                        setIsAuthenticated(false);
                        setMaintenanceStatus(prev => ({ ...prev, unlocked: false }));
                    }, 
                    className: "text-sm text-red-500 hover:underline" 
                }, "退出登录")
            ),
            renderSystemConfigSection({
                config,
                systemConfig,
                students,
                DEFAULT_SYSTEM_CONFIG,
                handleResetSystemConfig,
                updateSystemConfig,
                showOrganizationManager,
                onToggleOrganizationManager: () => setShowOrganizationManager(prev => !prev),
                showCustomRolesManager,
                onToggleCustomRolesManager: () => setShowCustomRolesManager(prev => !prev),
                normalizeCommissionerRoles,
                normalizeCustomRoles,
                getCommissionerRoles,
                getCustomRoles,
                handleDutyChange,
                StudentRosterSection,
                studentRosterProps: {
                    showStudentRosterManager,
                    onToggleOpen: () => setShowStudentRosterManager(prev => !prev),
                    handleExportStudentsExcel,
                    handleDownloadStudentTemplate,
                    handleImportStudentsExcel,
                    addStudent,
                    students,
                    systemConfig,
                    updateStudent,
                    removeStudent
                },
                onChangeMaintenancePassword: handleChangeMaintenancePassword,
                onSaveConfig: handleSaveConfigChanges
            }),
            renderToolsSection({
                config,
                setConfigSafe,
                students,
                setStudents,
                testMode,
                enterTestMode,
                exitTestMode,
                simTime,
                setSimTime,
                timeSpeed,
                setTimeSpeed,
                getNow,
                formatDateTimeLocal,
                scheduleDate,
                scheduleText,
                setScheduleText,
                handleScheduleDateChange,
                handleScheduleEdit,
                handleSaveSchedule,
                handleDeleteSchedule,
                countdownName,
                setCountdownName,
                countdownDate,
                setCountdownDate,
                addCountdownEvent,
                removeCountdownEvent,
                reportStart,
                setReportStart,
                reportEnd,
                setReportEnd,
                getReportRange,
                handleGenerateBrief
            }),
            renderExamArchivesSection({
                examArchivesModuleStatus,
                showExamArchivesManager,
                openExamArchivesManager,
                setExamArchivesModuleStatus,
                ensureExamArchivesModule,
                ExamArchivesView,
                students,
                battle,
                examArchives,
                setBattle,
                setExamArchives,
                persistExamArchives: persistExamArchiveChanges
            })
        );
    };

        return SettingsView;
    };
})();
