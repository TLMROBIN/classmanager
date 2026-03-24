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
            getStorageItem,
            setStorageItem,
            getSystemConfig,
            getGroupsConfig,
            getDormsConfig,
            getScheduleConfig,
            clearStorage,
            isAdminAuthed,
            clearAdminAuth,
            setAdminAuthUntil,
            ADMIN_AUTH_TTL_MS,
            DEFAULT_SYSTEM_CONFIG,
            stripTreasureConfig,
            stripSystemConfigTreasures,
            getLegacyTreasureList,
            normalizeCustomRoles,
            getCustomRoles,
            getCommissionerRoles,
            buildNormalizedStudentProfiles,
            remapStudentProfilesToStudentsByName,
            hasStudentProfilesInData,
            restoreStudentProfilesFromData,
            battleNormalize,
            normalizeExamArchives,
            normalizeBattleSnapshots,
            loadScriptOnce,
            getExamArchivesView
        } = deps || {};

        if (
            !h ||
            !useState ||
            !useEffect ||
            !Icon ||
            !getNow ||
            !getDateString ||
            !getTodayStr ||
            !getStorageItem ||
            !setStorageItem ||
            !getSystemConfig ||
            !getGroupsConfig ||
            !getDormsConfig ||
            !getScheduleConfig ||
            !clearStorage ||
            !isAdminAuthed ||
            !clearAdminAuth ||
            !setAdminAuthUntil ||
            !ADMIN_AUTH_TTL_MS ||
            !DEFAULT_SYSTEM_CONFIG ||
            !stripTreasureConfig ||
            !stripSystemConfigTreasures ||
            !getLegacyTreasureList ||
            !normalizeCustomRoles ||
            !getCustomRoles ||
            !getCommissionerRoles ||
            !buildNormalizedStudentProfiles ||
            !remapStudentProfilesToStudentsByName ||
            !hasStudentProfilesInData ||
            !restoreStudentProfilesFromData ||
            !battleNormalize ||
            !normalizeExamArchives ||
            !normalizeBattleSnapshots ||
            !loadScriptOnce ||
            !getExamArchivesView
        ) {
            throw new Error('SettingsView dependencies are missing');
        }

    const SettingsView = ({ students, studentProfiles, setStudentProfiles, history, config, setStudents, setHistory, setConfig, attendanceRecords, setAttendanceRecords, treasures, setTreasures, storage, setStorage, logs, setLogs, quotes, setQuotes, persistData, persistDataPatch, tasks, setTasks, messages, setMessages, teacherMessages, setTeacherMessages, redemptionHistory, setRedemptionHistory, dailyRedemptionCounts, setDailyRedemptionCounts, dailyUsageCounts, setDailyUsageCounts, battle, setBattle, examArchives, setExamArchives, battleSnapshots, setBattleSnapshots, isDirtyRef, createSnapshot, testMode, enterTestMode, exitTestMode, simTime, setSimTime, timeSpeed, setTimeSpeed }) => {
        const [isAuthenticated, setIsAuthenticated] = useState(isAdminAuthed());
        const [pwd, setPwd] = useState('');
        const [selectedSnapshotId, setSelectedSnapshotId] = useState(null);
        const [desktopConfig, setDesktopConfig] = useState(null);
        const [desktopStatus, setDesktopStatus] = useState(null);
        const [desktopPing, setDesktopPing] = useState(null);
        const [desktopBusy, setDesktopBusy] = useState(false);
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
        const [showExamArchivesManager, setShowExamArchivesManager] = useState(false);
        const [showStudentRosterManager, setShowStudentRosterManager] = useState(false);
        const [showOrganizationManager, setShowOrganizationManager] = useState(false);
        const [showCustomRolesManager, setShowCustomRolesManager] = useState(false);
        const [showDutyManager, setShowDutyManager] = useState(false);
        const [examArchivesModuleStatus, setExamArchivesModuleStatus] = useState(typeof window.createExamArchivesView === 'function' ? 'ready' : 'idle');
        const systemConfig = getSystemConfig(config);
        const ExamArchivesView = examArchivesModuleStatus === 'ready' ? getExamArchivesView() : null;
        const formatDateTimeLocal = (ts) => {
            const d = new Date(ts);
            if (isNaN(d.getTime())) return "";
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        const applySystemConfig = (next) => {
            const newConfig = { ...config, systemConfig: stripSystemConfigTreasures(next) };
            setConfig(newConfig);
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
            setConfig({ ...config, countdownEvents: list });
            setCountdownName("");
            setCountdownDate("");
        };
        const removeCountdownEvent = (id) => {
            const list = Array.isArray(config.countdownEvents) ? config.countdownEvents.filter(e => e.id !== id) : [];
            setConfig({ ...config, countdownEvents: list });
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

        const historySource = Array.isArray(history) ? history : [];

        useEffect(() => {
            if (!window.desktopApi) return;
            window.desktopApi.getConfig().then(cfg => setDesktopConfig(cfg || { serverUrl: "", preferredMode: "auto" }));
            window.desktopApi.getStatus().then(setDesktopStatus);
        }, []);

        const modeLabel = (mode) => ({ online: '在线', offline: '离线', auto: '自动' }[mode] || '未知');

        const handleDesktopSave = async () => {
            if (!window.desktopApi || !desktopConfig) return;
            setDesktopBusy(true);
            const next = { ...desktopConfig, serverUrl: (desktopConfig.serverUrl || "").trim() };
            try {
                const saved = await window.desktopApi.setConfig(next);
                setDesktopConfig(saved);
                const status = await window.desktopApi.getStatus();
                setDesktopStatus(status);
            } finally {
                setDesktopBusy(false);
            }
        };

        const handleDesktopPing = async () => {
            if (!window.desktopApi || !desktopConfig) return;
            const url = (desktopConfig.serverUrl || "").trim();
            if (!url) {
                setDesktopPing({ ok: false, text: "请先填写服务器地址" });
                return;
            }
            setDesktopBusy(true);
            setDesktopPing(null);
            const ok = await window.desktopApi.pingServer(url);
            setDesktopPing({ ok, text: ok ? "连接正常" : "连接失败" });
            setDesktopBusy(false);
        };

        const saveOfflineSnapshot = async () => {
            const nowTs = getNow().getTime();
            const normalizedStudentProfiles = buildNormalizedStudentProfiles(studentProfiles, students);
            let att = {};
            try {
                const raw = getStorageItem('attendance_records');
                if (raw) att = JSON.parse(raw);
            } catch (_) {}
            const fullData = {
                students,
                history,
                config,
                attendanceRecords: att,
                treasures,
                storage,
                logs,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts,
                tasks,
                battle,
                examArchives,
                battleSnapshots,
                studentProfiles: normalizedStudentProfiles
            };
            const payload = { ts: nowTs, data: fullData };
            if (window.desktopApi && typeof window.desktopApi.setOfflineSnapshot === 'function') {
                await window.desktopApi.setOfflineSnapshot(payload);
            } else {
                setStorageItem('cm_offline_snapshot', JSON.stringify(payload));
            }
        };

        const handleDesktopMode = async (mode) => {
            if (!window.desktopApi) return;
            if (mode === 'online') {
                const url = (desktopConfig?.serverUrl || "").trim();
                if (!url) {
                    alert("请先填写服务器地址");
                    return;
                }
            }
            if (mode === 'offline') {
                await saveOfflineSnapshot();
            }
            setDesktopBusy(true);
            const status = await window.desktopApi.setMode(mode);
            setDesktopStatus(status);
            setDesktopBusy(false);
        };

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
        
        const handleImportStudentsExcel = (e, mode = 'overwrite') => {
            const file = e.target.files[0];
            if (!file) return;
            const architecture = validateStudentImportPrerequisites("导入学生名单");
            if (!architecture) {
                e.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (evt) => {
                const wb = XLSX.read(evt.target.result, { type: 'array' });
                const sheetName = wb.SheetNames[0];
                const parsedWorkbook = parseStudentImportWorkbook(wb.Sheets[sheetName]);
                if (!parsedWorkbook.ok) {
                    alert(parsedWorkbook.error);
                    return;
                }
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
                    setStudents(prev => {
                        const list = Array.isArray(prev) ? prev : [];
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
                        return [...updated, ...additions];
                    });
                    alert("学生名单已增量导入");
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
                    setStudents(newStudents);
                    setStudentProfiles(remapStudentProfilesToStudentsByName(students, newStudents, studentProfiles));
                    alert("学生名单已更新");
                }
            };
            reader.readAsArrayBuffer(file);
            e.target.value = '';
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
                    h("h2", { className: "text-2xl font-bold text-gray-800 mb-2" }, "管理员验证"),
                    h("p", { className: "text-gray-500 mb-4 text-sm" }, "进入维护中心需要验证权限"),
                    h("div", { className: "bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-left" },
                        h("p", { className: "text-xs text-amber-600 mb-1" }, "默认管理密码："),
                        h("p", { className: "text-sm font-mono text-amber-800 font-semibold" }, "K9x4B2m7Q5w8Z1v3"),
                        h("p", { className: "text-xs text-amber-500 mt-1" }, "登录后可在「系统配置」中修改密码")
                    ),
                    h("input", { 
                        type: "password", 
                        value: pwd,
                        onChange: e => setPwd(e.target.value),
                        onKeyDown: e => {
                            if (e.key === 'Enter') {
                                const systemConfig = getSystemConfig(config);
                                if (pwd === systemConfig.adminPassword) {
                                    setAdminAuthUntil(getNow().getTime() + ADMIN_AUTH_TTL_MS);
                                    setIsAuthenticated(true);
                                    setPwd('');
                                } else {
                                    alert("密码错误");
                                    setPwd('');
                                }
                            }
                        },
                        placeholder: "请输入管理员密码",
                        className: "w-full border rounded-lg p-3 mb-4 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    }),
                    h("button", {
                        onClick: () => {
                            const systemConfig = getSystemConfig(config);
                            if (pwd === systemConfig.adminPassword) {
                                setAdminAuthUntil(getNow().getTime() + ADMIN_AUTH_TTL_MS);
                                setIsAuthenticated(true);
                                setPwd('');
                            } else {
                                alert("密码错误");
                                setPwd('');
                            }
                        },
                        className: "w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition"
                    }, "解锁进入")
                )
            );
        }

        // 验证通过后的功能逻辑
        const downloadBackup = () => {
            const normalizedStudentProfiles = buildNormalizedStudentProfiles(studentProfiles, students);
            let latestAttendance = attendanceRecords;
            try {
                const saved = getStorageItem('attendance_records');
                if (saved) latestAttendance = JSON.parse(saved);
            } catch (_) {}
            const fullData = {
                students, history, config: stripTreasureConfig(config),
                attendance_records: latestAttendance || {},
                class_treasure_data: { treasures, storage, logs },
                quotes: quotes,
                battle: battle,
                examArchives: examArchives,
                battleSnapshots: battleSnapshots,
                studentProfiles: normalizedStudentProfiles
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullData));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "class_full_backup_" + getTodayStr() + ".json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        };

        const handleImportJSON = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (confirm("确定要恢复全量备份吗？当前数据将被覆盖！")) {
                        const importedTreasureList = Array.isArray(data?.class_treasure_data?.treasures)
                            ? data.class_treasure_data.treasures
                            : getLegacyTreasureList(data.config);
                        if (data.students) setStudents(data.students);
                        if (hasStudentProfilesInData(data)) setStudentProfiles(restoreStudentProfilesFromData(data, studentProfiles, students));
                        if (data.history) setHistory(data.history);
                        if (data.config) {
                            const merged = getSystemConfig({ systemConfig: data.config.systemConfig || {} });
                            setConfig(stripTreasureConfig({ ...data.config, systemConfig: merged }));
                            if (Array.isArray(merged.quotes)) setQuotes(merged.quotes);
                        }
                        if (data.attendance_records) {
                            setAttendanceRecords(data.attendance_records);
                            setStorageItem('attendance_records', JSON.stringify(data.attendance_records));
                        }
                        if (data.class_treasure_data) {
                            if (Array.isArray(importedTreasureList)) setTreasures(importedTreasureList);
                            setStorage(data.class_treasure_data.storage || {});
                            setLogs(data.class_treasure_data.logs || []);
                        } else if (Array.isArray(importedTreasureList)) {
                            setTreasures(importedTreasureList);
                        }
                        if (data.quotes) setQuotes(data.quotes);
                        if (data.battle) setBattle(battleNormalize(data.battle));
                        if (data.examArchives) setExamArchives(normalizeExamArchives(data.examArchives, data.battle || battle));
                        if (data.battleSnapshots) setBattleSnapshots(normalizeBattleSnapshots(data.battleSnapshots));
                        alert("恢复成功！");
                    }
                } catch (err) { alert("文件格式错误"); }
            };
            reader.readAsText(file);
            e.target.value = '';
        };

        const getSnapshots = () => {
            try {
                const s = getStorageItem('class_manager_snapshots');
                return s ? JSON.parse(s) : [];
            } catch (_) { return []; }
        };

        const handleRestoreSnapshot = () => {
            const list = getSnapshots();
            const snap = list.find(x => x.id === selectedSnapshotId);
            if (!snap) {
                alert("请先选择一个快照");
                return;
            }
            if (!confirm(`确定将系统数据恢复为快照「${snap.label}」吗？当前数据将被覆盖！`)) return;
            const d = snap.data;
            const nextStudentProfiles = restoreStudentProfilesFromData(d, studentProfiles, students);
            if (d.students) setStudents(d.students);
            if (hasStudentProfilesInData(d)) setStudentProfiles(nextStudentProfiles);
            if (d.history) setHistory(d.history);
            if (d.config) setConfig(stripTreasureConfig(d.config));
            if (d.attendanceRecords) setAttendanceRecords(d.attendanceRecords);
            if (d.treasures) setTreasures(d.treasures || []);
            if (d.storage) setStorage(d.storage || {});
            if (d.logs) setLogs(d.logs || []);
            if (d.quotes) setQuotes(d.quotes || []);
            if (d.messages) setMessages(d.messages || []);
            if (d.teacherMessages) setTeacherMessages(d.teacherMessages || []);
            if (d.redemptionHistory) setRedemptionHistory(d.redemptionHistory || {});
            if (d.dailyRedemptionCounts) setDailyRedemptionCounts(d.dailyRedemptionCounts || {});
            if (d.dailyUsageCounts) setDailyUsageCounts(d.dailyUsageCounts || {});
            if (d.tasks) setTasks(d.tasks || []);
            if (d.battle) setBattle(battleNormalize(d.battle));
            if (d.examArchives) setExamArchives(normalizeExamArchives(d.examArchives, d.battle || battle));
            if (d.battleSnapshots) setBattleSnapshots(normalizeBattleSnapshots(d.battleSnapshots));
            if (typeof persistData === 'function') persistData({ ...d, studentProfiles: nextStudentProfiles });
            setSelectedSnapshotId(null);
            alert("已恢复为选中快照！");
        };

        const handleManualSnapshot = () => {
            if (!confirm("确定立即生成一个手动快照吗？")) return;
            const ok = typeof createSnapshot === 'function' ? createSnapshot({ note: '(手动)' }) : false;
            if (ok) alert("已生成快照！");
            else alert("生成快照失败，请稍后重试");
        };

        const handleExportScoreExcel = () => {
            const data = students.map(s => ({
                "姓名": s.name, 
                "小组": (() => {
                    const groupsConfig = getGroupsConfig(config);
                    return groupsConfig[s.group]?.name || s.group;
                })(), 
                "职位": s.role === 'leader' ? '组长' : '组员',
                "宿舍": (() => {
                    const dormsConfig = getDormsConfig(config);
                    return dormsConfig[s.dorm] || s.dorm;
                })(), 
                "自在值": s.zizai, "余额": s.balance, "不自在值": s.penalty
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "积分表");
            XLSX.writeFile(wb, `积分表_${getTodayStr()}.xlsx`);
        };

        const handleImportScoreExcel = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                if (confirm(`解析到 ${json.length} 条数据，确定更新积分吗？`)) {
                    const newStudents = [...students];
                    json.forEach(row => {
                        const t = newStudents.find(s => s.name === row["姓名"]);
                        if (t) {
                            if (row["自在值"] !== undefined) t.zizai = Number(row["自在值"]);
                            if (row["余额"] !== undefined) t.balance = Number(row["余额"]);
                            if (row["不自在值"] !== undefined) t.penalty = Number(row["不自在值"]);
                        }
                    });
                    setStudents(newStudents);
                    alert("积分更新成功");
                }
            };
            reader.readAsArrayBuffer(file);
            e.target.value = '';
        };

        const handleRecoverFromHistory = () => {
            const name = prompt("输入要恢复积分的学生姓名（如：陈正岳）：");
            if (!name || !name.trim()) return;
            const s = students.find(st => st.name.trim() === name.trim());
            if (!s) {
                alert("未找到该学生");
                return;
            }
            const myHistory = (history || []).filter(h => h.studentId === s.id && h.snapshot);
            if (myHistory.length === 0) {
                alert(`未找到 ${s.name} 的历史记录，无法恢复。`);
                return;
            }
            let best = { zizai: 0, balance: 0, penalty: 0 };
            let bestRecord = null;
            myHistory.forEach(h => {
                if (!h.snapshot) return;
                const z = Number(h.snapshot.zizai);
                if (isNaN(z)) return;
                if (z > (best.zizai ?? 0)) {
                    best = { zizai: h.snapshot.zizai, balance: h.snapshot.balance, penalty: h.snapshot.penalty };
                    bestRecord = h;
                }
            });
            const snap = bestRecord;
            const when = snap ? new Date(snap.ts).toLocaleString() : "";
            if (!confirm(`将 ${s.name} 的积分恢复为：\n自在值 ${best.zizai}，余额 ${best.balance}，不自在值 ${best.penalty}\n（来自历史记录${when ? " " + when : ""}）\n\n确定恢复？`)) return;
            const newStudents = students.map(st => {
                if (st.id !== s.id) return st;
                return {
                    ...st,
                    zizai: best.zizai != null ? Number(best.zizai) : st.zizai,
                    balance: best.balance != null ? Number(best.balance) : st.balance,
                    penalty: best.penalty != null ? Number(best.penalty) : st.penalty
                };
            });
            setStudents(newStudents);

            let att = {};
            try { const r = getStorageItem('attendance_records'); if (r) att = JSON.parse(r); } catch (_) {}
            const fullData = {
                students: newStudents,
                studentProfiles,
                history,
                config,
                attendanceRecords: att,
                treasures,
                storage,
                logs,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts,
                tasks,
                battle,
                battleSnapshots
            };
            if (typeof persistData === 'function') persistData(fullData);

            alert("已恢复");
        };

        const handleFixScore = () => {
            const name = prompt("输入要修正积分的学生姓名（如：陈正岳）：");
            if (!name || !name.trim()) return;
            const s = students.find(st => st.name.trim() === name.trim());
            if (!s) {
                alert("未找到该学生");
                return;
            }
            const zizaiStr = prompt("自在值（直接回车则不修改）", String(s.zizai ?? 0));
            const balanceStr = prompt("余额（直接回车则不修改）", String(s.balance ?? 0));
            const penaltyStr = prompt("不自在值（直接回车则不修改）", String(s.penalty ?? 0));
            const newZizai = zizaiStr === "" || zizaiStr === null ? s.zizai : Number(zizaiStr);
            const newBalance = balanceStr === "" || balanceStr === null ? s.balance : Number(balanceStr);
            const newPenalty = penaltyStr === "" || penaltyStr === null ? s.penalty : Number(penaltyStr);
            if (isNaN(newZizai) || isNaN(newBalance) || isNaN(newPenalty)) {
                alert("请输入有效数字");
                return;
            }
            const newStudents = students.map(st => {
                if (st.id !== s.id) return st;
                return { ...st, zizai: newZizai, balance: newBalance, penalty: newPenalty };
            });
            setStudents(newStudents);

            let att = {};
            try { const r = getStorageItem('attendance_records'); if (r) att = JSON.parse(r); } catch (_) {}
            const fullData = {
                students: newStudents,
                studentProfiles,
                history,
                config,
                attendanceRecords: att,
                treasures,
                storage,
                logs,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts,
                tasks,
                battle,
                battleSnapshots
            };
            if (typeof persistData === 'function') persistData(fullData);

            alert("已修正");
        };

        const handleExportTreasureExcel = () => {
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(treasures), "宝物库存");
            const storageRows = [];
            Object.keys(storage).forEach(sid => {
                const sName = students.find(s => s.id == sid)?.name || sid;
                Object.keys(storage[sid]).forEach(tid => {
                    const tName = treasures.find(t => t.id == tid)?.name || tid;
                    storageRows.push({ "学生": sName, "物品": tName, "数量": storage[sid][tid] });
                });
            });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(storageRows), "学生储物箱");
            XLSX.writeFile(wb, `藏宝阁数据_${getTodayStr()}.xlsx`);
        };

        const handleImportTreasureExcel = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const wb = XLSX.read(evt.target.result, { type: 'array' });
                let msg = "";
                if (wb.SheetNames.includes("宝物库存")) {
                    const data = XLSX.utils.sheet_to_json(wb.Sheets["宝物库存"]);
                    const formatted = data.map((item, idx) => ({
                        ...item, id: item.id || (Date.now()+idx), stock: item.stock || item['库存'], price: item.price||item['价格'], name: item.name||item['名称'], rarity: item.rarity||item['稀有度']
                    }));
                    setTreasures(formatted);
                    msg += "库存已更新 ";
                }
                if (wb.SheetNames.includes("学生储物箱")) {
                    const raw = XLSX.utils.sheet_to_json(wb.Sheets["学生储物箱"]);
                    const newStorage = {};
                    raw.forEach(r => {
                        const s = students.find(x => x.name === r["学生"]);
                        const t = treasures.find(x => x.name === r["物品"]); 
                        if (s && t) {
                            if (!newStorage[s.id]) newStorage[s.id] = {};
                            newStorage[s.id][t.id] = r["数量"];
                        }
                    });
                    setStorage(newStorage);
                    msg += "储物箱已更新";
                }
                alert(msg || "未识别有效Sheet");
            };
            reader.readAsArrayBuffer(file);
            e.target.value = '';
        };

        const handleExportAttendanceExcel = () => {
            const rows = [];
            Object.keys(attendanceRecords).forEach(date => {
                Object.keys(attendanceRecords[date]).forEach(name => {
                    const sessions = attendanceRecords[date][name];
                    const row = { "日期": date, "姓名": name };
                    const scheduleConfig = getScheduleConfig(config);
                    scheduleConfig.forEach(s => {
                        const sid = s.id;
                        const sessName = s.name;
                        const rec = sessions[sid];
                        row[sessName] = rec ? `${rec.status === 'ok' ? '✅' : '❌'}${rec.status==='late'?'(迟)':''} ${rec.checkTime}` : '-';
                    });
                    rows.push(row);
                });
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "考勤记录");
            XLSX.writeFile(wb, `考勤记录_${getTodayStr()}.xlsx`);
        };

        const handleImportAttendanceExcel = (e) => {
             const file = e.target.files[0];
             if (!file) return;
             const reader = new FileReader();
             reader.onload = (evt) => {
                 const wb = XLSX.read(evt.target.result, { type: 'array' });
                 const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                 if(confirm(`解析到 ${json.length} 条考勤记录，确定要【合并】到现有记录吗？`)) {
                     const newRecs = { ...attendanceRecords };
                     json.forEach(row => {
                         const date = row["日期"];
                         const name = row["姓名"];
                         if (!newRecs[date]) newRecs[date] = {};
                         if (!newRecs[date][name]) newRecs[date][name] = {};
                        const scheduleConfig = getScheduleConfig(config);
                        scheduleConfig.forEach(s => {
                            const cName = s.name;
                            const cell = row[cName];
                            if (cell && cell !== '-') {
                                const sid = s.id;
                                 let status = 'ok';
                                 if (cell.includes('❌') || cell.includes('迟')) status = 'late';
                                 newRecs[date][name][sid] = {
                                     status: status,
                                     checkTime: cell.replace(/[✅❌(迟)]/g, '').trim() || '导入记录',
                                     timestamp: Date.now()
                                 };
                             }
                         });
                     });
                     setAttendanceRecords(newRecs);
                     alert("考勤记录已合并导入");
                 }
             };
             reader.readAsArrayBuffer(file);
             e.target.value = '';
        };

        const handleExportSystemConfig = () => {
            const { treasures, ...exportSystemConfig } = systemConfig;
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportSystemConfig));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "system_config_" + getTodayStr() + ".json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        };

        const handleImportSystemConfig = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = JSON.parse(evt.target.result);
                    const merged = getSystemConfig({ systemConfig: data || {} });
                    const importedTreasures = getLegacyTreasureList({ systemConfig: data || {} });
                    applySystemConfig(merged);
                    if (Array.isArray(importedTreasures)) setTreasures(importedTreasures);
                    alert("系统配置已导入");
                } catch (err) {
                    alert("配置文件格式错误");
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        };

        const handleResetSystemConfig = () => {
            if (!confirm("确定要将系统配置恢复为默认值吗？")) return;
            applySystemConfig(JSON.parse(JSON.stringify(DEFAULT_SYSTEM_CONFIG)));
            setTreasures(DEFAULT_SYSTEM_CONFIG.treasures || []);
            alert("系统配置已重置");
        };

        const handleReset = () => {
            if (confirm("危险操作：确定要清空所有数据吗？此操作不可逆！")) { 
                clearStorage(); 
                location.reload(); 
            }
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
            setConfig({ ...config, duty: newDuty });
        };
        const handleCommissionerChange = (roleId, studentId) => {
            setConfig({ ...config, commissioners: { ...(config.commissioners || {}), [roleId]: studentId ? parseInt(studentId) : null } });
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
            }).then(() => {
                if (isDirtyRef) isDirtyRef.current = false;
                if (successMessage) alert(successMessage);
            }).catch(err => {
                if (isDirtyRef) isDirtyRef.current = false;
                console.error('考试档案保存失败:', err);
                alert(failureMessage || "考试档案已更新，但保存失败，请手动刷新确认");
            });
        };

        return h("div", { className: "bg-white p-8 rounded-xl shadow-lg animate-fade-in max-w-4xl mx-auto flex flex-col gap-8" },
            h("div", { className: "border-b pb-4 flex justify-between items-center", style: { order: -2 } },
                h("div", null,
                    h("h2", { className: "text-2xl font-bold text-gray-800" }, "🔧 系统维护中心"), 
                    h("p", { className: "text-gray-500 text-sm mt-1" }, "已获取管理员权限")
                ),
                h("button", { 
                    onClick: () => { clearAdminAuth(); setIsAuthenticated(false); }, 
                    className: "text-sm text-red-500 hover:underline" 
                }, "退出登录")
            ),
            h("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },
                h("div", { className: "border rounded-xl p-4 bg-blue-50 border-blue-100" }, h("h3", { className: "font-bold text-blue-800 mb-3 flex items-center gap-2" }, h(Icon, { name: "star" }), "积分数据"), h("div", { className: "space-y-2" }, h("button", { onClick: handleExportScoreExcel, className: "w-full py-2 bg-white border border-blue-200 text-blue-600 rounded hover:bg-blue-100 text-sm font-medium" }, "导出 Excel"), h("div", { className: "relative w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium text-center cursor-pointer" }, "导入 Excel", h("input", { type: "file", className: "absolute inset-0 opacity-0 cursor-pointer", accept: ".xlsx", onChange: handleImportScoreExcel })), h("button", { onClick: handleRecoverFromHistory, className: "w-full py-2 bg-white border border-blue-200 text-blue-600 rounded hover:bg-blue-100 text-sm font-medium" }, "从历史恢复"), h("button", { onClick: handleFixScore, className: "w-full py-2 bg-white border border-blue-200 text-blue-600 rounded hover:bg-blue-100 text-sm font-medium" }, "手动修正积分"))),
                h("div", { className: "border rounded-xl p-4 bg-green-50 border-green-100" }, h("h3", { className: "font-bold text-green-800 mb-3 flex items-center gap-2" }, h(Icon, { name: "clock" }), "考勤数据"), h("div", { className: "space-y-2" }, h("button", { onClick: handleExportAttendanceExcel, className: "w-full py-2 bg-white border border-green-200 text-green-600 rounded hover:bg-green-100 text-sm font-medium" }, "导出 Excel"), h("div", { className: "relative w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium text-center cursor-pointer" }, "导入 Excel", h("input", { type: "file", className: "absolute inset-0 opacity-0 cursor-pointer", accept: ".xlsx", onChange: handleImportAttendanceExcel })))),
                h("div", { className: "border rounded-xl p-4 bg-purple-50 border-purple-100" }, h("h3", { className: "font-bold text-purple-800 mb-3 flex items-center gap-2" }, h(Icon, { name: "gift" }), "藏宝阁数据"), h("div", { className: "space-y-2" }, h("button", { onClick: handleExportTreasureExcel, className: "w-full py-2 bg-white border border-purple-200 text-purple-600 rounded hover:bg-purple-100 text-sm font-medium" }, "导出 Excel"), h("div", { className: "relative w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm font-medium text-center cursor-pointer" }, "导入 Excel", h("input", { type: "file", className: "absolute inset-0 opacity-0 cursor-pointer", accept: ".xlsx", onChange: handleImportTreasureExcel }))))
            ),
            h("div", { className: "border-t pt-6 space-y-4" },
                h("div", { className: "border rounded-xl p-4 bg-indigo-50 border-indigo-100" },
                    h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                        h("div", null,
                            h("h3", { className: "font-bold text-indigo-800 mb-1 flex items-center gap-2" }, h(Icon, { name: "fileText" }), "考试档案"),
                            h("p", { className: "text-sm text-indigo-700/80" }, "考试导入、删除和档案查看已从双子星移到这里。模块默认不加载，点开后才按需加载。")
                        ),
                        h("button", {
                            onClick: openExamArchivesManager,
                            className: "px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium"
                        }, showExamArchivesManager ? "收起考试档案" : "打开考试档案")
                    )
                ),
                showExamArchivesManager && (
                    examArchivesModuleStatus === 'ready' && ExamArchivesView
                        ? h(ExamArchivesView, {
                            students,
                            battle,
                            examArchives,
                            setBattle,
                            setExamArchives,
                            persistExamArchives: persistExamArchiveChanges,
                            adminPassword: window.DEFAULT_ADMIN_PASSWORD
                        })
                        : h("div", { className: "border rounded-xl p-6 bg-gray-50 text-center space-y-2" },
                            h("div", { className: "font-bold text-gray-800" }, examArchivesModuleStatus === 'error' ? "考试档案模块加载失败" : "考试档案模块加载中"),
                            h("div", { className: "text-sm text-gray-500" }, examArchivesModuleStatus === 'error' ? "请重试加载考试档案模块。" : "首次打开维护页中的考试档案时会按需加载。"),
                            examArchivesModuleStatus === 'error' && h("button", {
                                onClick: () => {
                                    setExamArchivesModuleStatus('idle');
                                    setTimeout(ensureExamArchivesModule, 0);
                                },
                                className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            }, "重试")
                        )
                )
            ),
            h("div", { className: "border-t pt-6" },
                h("div", { className: "bg-gray-50 border rounded-lg p-4 space-y-4" },
                    h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                        h("div", null,
                            h("h3", { className: "font-bold text-gray-700 mb-1" }, "学生名单维护"),
                            h("p", { className: "text-xs text-gray-500" }, "导入、导出、增量更新和手动编辑学生名单都收在这里。")
                        ),
                        h("button", {
                            onClick: () => setShowStudentRosterManager(prev => !prev),
                            className: "px-4 py-2 bg-white border rounded hover:bg-gray-100 text-sm font-medium"
                        }, showStudentRosterManager ? "收起学生名单维护" : "打开学生名单维护")
                    ),
                    showStudentRosterManager && h("div", { className: "border-t pt-4" },
                        h("div", { className: "flex flex-wrap gap-2 mb-4" },
                            h("button", { onClick: handleExportStudentsExcel, className: "px-3 py-2 border border-blue-500 text-blue-600 rounded hover:bg-blue-50 text-sm" }, "导出学生名单"),
                            h("button", { onClick: handleDownloadStudentTemplate, className: "px-3 py-2 border border-sky-500 text-sky-600 rounded hover:bg-sky-50 text-sm" }, "下载导入模板"),
                            h("label", { className: "px-3 py-2 border border-emerald-500 text-emerald-600 rounded hover:bg-emerald-50 text-sm cursor-pointer" },
                                "增量导入",
                                h("input", { type: "file", accept: ".xlsx,.xls", onChange: e => handleImportStudentsExcel(e, 'merge'), style: { display: 'none' } })
                            ),
                            h("label", { className: "px-3 py-2 border border-amber-500 text-amber-600 rounded hover:bg-amber-50 text-sm cursor-pointer" },
                                "覆盖导入",
                                h("input", { type: "file", accept: ".xlsx,.xls", onChange: e => handleImportStudentsExcel(e, 'overwrite'), style: { display: 'none' } })
                            ),
                            h("button", { onClick: addStudent, className: "px-3 py-2 border border-green-500 text-green-600 rounded hover:bg-green-50 text-sm" }, "新增学生")
                        ),
                        h("p", { className: "text-xs text-gray-500 mb-4" }, "导入学生名单前，请先在“系统配置 -> 组织架构”中维护小组和宿舍，再使用系统模板填写。表头错误或小组/宿舍名称不匹配时，将整批拒绝导入。"),
                        h("div", { className: "max-h-96 overflow-y-auto border rounded" },
                            h("table", { className: "w-full text-sm text-left" },
                                h("thead", null,
                                    h("tr", { className: "bg-gray-50" },
                                        h("th", { className: "p-2" }, "姓名"),
                                        h("th", { className: "p-2" }, "性别"),
                                        h("th", { className: "p-2" }, "小组"),
                                        h("th", { className: "p-2" }, "职位"),
                                        h("th", { className: "p-2" }, "宿舍"),
                                        h("th", { className: "p-2" }, "操作")
                                    )
                                ),
                                h("tbody", null,
                                    (Array.isArray(students) ? students : []).map(s => h("tr", { key: s.id, className: "border-t" },
                                        h("td", { className: "p-2" }, h("input", { className: "w-full border rounded p-1", value: s.name || "", onChange: e => updateStudent(s.id, { name: e.target.value }) })),
                                        h("td", { className: "p-2" }, h("select", { className: "w-full border rounded p-1", value: s.gender || "", onChange: e => updateStudent(s.id, { gender: e.target.value }) }, h("option", { value: "" }, "-"), h("option", { value: "M" }, "男"), h("option", { value: "F" }, "女"))),
                                        h("td", { className: "p-2" }, (() => {
                                            const groups = systemConfig.organization.groups || [];
                                            return h("select", { className: "w-full border rounded p-1", value: s.group || "", onChange: e => updateStudent(s.id, { group: e.target.value }) },
                                                h("option", { value: "" }, "-"),
                                                groups.map(g => h("option", { key: g.id, value: g.id }, g.name))
                                            );
                                        })()),
                                        h("td", { className: "p-2" }, h("select", { className: "w-full border rounded p-1", value: s.role || "member", onChange: e => updateStudent(s.id, { role: e.target.value }) }, h("option", { value: "leader" }, "组长"), h("option", { value: "member" }, "组员"))),
                                        h("td", { className: "p-2" }, (() => {
                                            const dorms = systemConfig.organization.dorms || [];
                                            return h("select", { className: "w-full border rounded p-1", value: s.dorm || "", onChange: e => updateStudent(s.id, { dorm: e.target.value }) },
                                                h("option", { value: "" }, "-"),
                                                dorms.map(d => h("option", { key: d.id, value: d.id }, d.name))
                                            );
                                        })()),
                                        h("td", { className: "p-2" }, h("button", { onClick: () => removeStudent(s.id), className: "px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600" }, "删除"))
                                    ))
                                )
                            )
                        )
                    )
                )
            ),
            window.desktopApi && h("div", { className: "border-t pt-6" },
                h("h3", { className: "font-bold text-gray-700 mb-2" }, "🖥️ 桌面端连接"),
                !desktopConfig ? h("div", { className: "text-gray-400 text-sm" }, "正在加载桌面端配置...") : h("div", { className: "bg-gray-50 border rounded-lg p-4 space-y-4" },
                    h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
                        h("div", null,
                            h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "服务器地址"),
                            h("input", {
                                type: "text",
                                className: "w-full border rounded-lg p-2 text-sm",
                                value: desktopConfig.serverUrl || "",
                                onChange: e => setDesktopConfig({ ...desktopConfig, serverUrl: e.target.value }),
                                placeholder: "http://127.0.0.1:3000"
                            })
                        ),
                        h("div", null,
                            h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "连接偏好"),
                            h("select", {
                                className: "w-full border rounded-lg p-2 text-sm",
                                value: desktopConfig.preferredMode || "auto",
                                onChange: e => setDesktopConfig({ ...desktopConfig, preferredMode: e.target.value })
                            }, [
                                h("option", { value: "auto" }, "自动"),
                                h("option", { value: "online" }, "强制在线"),
                                h("option", { value: "offline" }, "强制离线")
                            ])
                        )
                    ),
                    h("div", { className: "flex flex-wrap gap-2" },
                        h("button", { onClick: handleDesktopPing, disabled: desktopBusy, className: "px-3 py-2 bg-white border rounded text-xs hover:bg-gray-100 disabled:opacity-50" }, "测试连接"),
                        h("button", { onClick: handleDesktopSave, disabled: desktopBusy, className: "px-3 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50" }, "保存并应用"),
                        h("button", { onClick: () => handleDesktopMode('online'), disabled: desktopBusy, className: "px-3 py-2 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50" }, "切换在线"),
                        h("button", { onClick: () => handleDesktopMode('offline'), disabled: desktopBusy, className: "px-3 py-2 bg-gray-700 text-white rounded text-xs hover:bg-gray-800 disabled:opacity-50" }, "切换离线")
                    ),
                    h("div", { className: "text-xs text-gray-500 flex flex-wrap gap-4" },
                        h("span", null, `当前模式：${modeLabel(desktopStatus?.mode)}`),
                        h("span", null, `连接偏好：${modeLabel(desktopConfig.preferredMode)}`),
                        h("span", null, `服务器：${desktopConfig.serverUrl || "未设置"}`)
                    ),
                    desktopPing && h("div", { className: `text-xs font-medium ${desktopPing.ok ? "text-green-600" : "text-red-600"}` }, desktopPing.text)
                )
            ),
            h("div", { className: "border-t pt-6" },
                h("h3", { className: "font-bold text-gray-700 mb-2" }, "❄️ 假期封存"),
                h("p", { className: "text-gray-500 text-sm mb-3" }, "开启后暂停缺勤记录、迟到扣分、缺勤结算、全勤奖等所有自动机制，适用于假期。"),
                h("button", {
                    onClick: () => {
                        const newFrozen = !config.frozen;
                        setConfig(c => ({ ...c, frozen: newFrozen }));
                        
                        if (!newFrozen) {
                            const now = Date.now();
                            const newStudents = students.map(s => ({
                                ...s,
                                lastPenaltyAt: now
                            }));
                            setStudents(newStudents);
                            alert("系统已解封，所有学生的未扣分天数已重置为0天");
                        }
                    },
                    className: `w-full max-w-xs py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${config.frozen ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`
                }, config.frozen ? "✓ 已封存（点击解除）" : "未封存（点击开启）")
            ),
            h("div", { className: "border-t pt-6" },
                h("h3", { className: "font-bold text-gray-700 mb-2" }, "🧪 测试模式"),
                h("p", { className: "text-gray-500 text-sm mb-3" }, "进入后所有操作仅在测试隔离环境中生效，退出后自动还原。"),
                h("div", { className: "flex flex-wrap gap-3 items-center mb-4" },
                    h("button", {
                        onClick: () => testMode ? exitTestMode() : enterTestMode(),
                        className: `px-4 py-2 rounded-lg font-bold text-sm ${testMode ? "bg-red-500 text-white hover:bg-red-600" : "bg-blue-600 text-white hover:bg-blue-700"}`
                    }, testMode ? "退出测试模式" : "进入测试模式"),
                    h("span", { className: `text-xs font-medium ${testMode ? "text-green-600" : "text-gray-400"}` }, testMode ? "已启用" : "未启用")
                ),
                testMode && h("div", { className: "bg-gray-50 border rounded-lg p-4 space-y-4" },
                    h("div", { className: "text-sm text-gray-700" }, `当前模拟时间：${new Date(simTime).toLocaleString()}`),
                    h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
                        h("div", null,
                            h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "设置模拟时间"),
                            h("input", {
                                type: "datetime-local",
                                className: "w-full border rounded-lg p-2 text-sm",
                                value: formatDateTimeLocal(simTime),
                                onChange: (e) => {
                                    const v = e.target.value;
                                    if (!v) return;
                                    const t = new Date(v);
                                    if (!isNaN(t.getTime())) setSimTime(t.getTime());
                                }
                            })
                        ),
                        h("div", null,
                            h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "时间流速"),
                            h("div", { className: "flex gap-2 flex-wrap" },
                                [1, 2, 5, 10, 30, 60].map(s => h("button", {
                                    key: s,
                                    onClick: () => setTimeSpeed(s),
                                    className: `px-3 py-2 rounded-lg text-xs font-bold ${timeSpeed === s ? "bg-blue-600 text-white" : "bg-white border text-gray-700 hover:bg-gray-100"}`
                                }, `${s}x`))
                            )
                        )
                    ),
                    h("div", { className: "flex flex-wrap gap-2" },
                        h("button", { onClick: () => setSimTime(t => t - 60 * 60 * 1000), className: "px-3 py-2 bg-white border rounded text-xs hover:bg-gray-100" }, "后退 1 小时"),
                        h("button", { onClick: () => setSimTime(t => t + 60 * 60 * 1000), className: "px-3 py-2 bg-white border rounded text-xs hover:bg-gray-100" }, "前进 1 小时"),
                        h("button", { onClick: () => setSimTime(t => t - 24 * 60 * 60 * 1000), className: "px-3 py-2 bg-white border rounded text-xs hover:bg-gray-100" }, "后退 1 天"),
                        h("button", { onClick: () => setSimTime(t => t + 24 * 60 * 60 * 1000), className: "px-3 py-2 bg-white border rounded text-xs hover:bg-gray-100" }, "前进 1 天"),
                        h("button", { onClick: () => setSimTime(getNow().getTime()), className: "px-3 py-2 bg-gray-200 rounded text-xs hover:bg-gray-300" }, "重置为当前时间")
                    )
                )
            ),
            h("div", { className: "border-t pt-6" }, h("h3", { className: "font-bold text-gray-700 mb-4" }, "📦 系统全量备份 (JSON)"), h("div", { className: "flex gap-4" }, h("button", { onClick: downloadBackup, className: "flex-1 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 font-bold flex items-center justify-center gap-2" }, h(Icon, { name: "download" }), "下载全量备份"), h("div", { className: "flex-1 relative py-3 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 font-bold flex items-center justify-center gap-2 cursor-pointer" }, h(Icon, { name: "upload" }), "恢复全量备份", h("input", { type: "file", className: "absolute inset-0 opacity-0 cursor-pointer", accept: ".json", onChange: handleImportJSON })))),
            h("div", { className: "border-t pt-6" },
                h("h3", { className: "font-bold text-gray-700 mb-2" }, "🕐 数据快照 (自动 + 手动，最多 10 个)"),
                h("p", { className: "text-gray-500 text-sm mb-3" }, "系统每天 22:30 后自动保存快照；若错过会在下次打开时补生成。也可手动生成。"),
                h("button", { onClick: handleManualSnapshot, className: "mb-3 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-sm font-medium flex items-center gap-2" }, h(Icon, { name: "plus", size: 16 }), "立即生成快照"),
                (() => {
                    const list = getSnapshots().slice().sort((a, b) => b.ts - a.ts);
                    if (list.length === 0) return h("div", { className: "text-gray-400 text-sm py-4" }, "暂无快照");
                    return h("div", { className: "space-y-2" },
                        h("div", { className: "max-h-48 overflow-y-auto border rounded-lg bg-gray-50 p-2 space-y-1" },
                            list.map(s => h("label", { key: s.id, className: "flex items-center gap-2 p-2 rounded hover:bg-white cursor-pointer" },
                                h("input", { type: "radio", name: "snapshot", checked: selectedSnapshotId === s.id, onChange: () => setSelectedSnapshotId(s.id) }),
                                h("span", { className: "text-sm font-medium" }, s.label),
                                h("span", { className: "text-gray-400 text-xs" }, new Date(s.ts).toLocaleString())
                            ))
                        ),
                        h("button", { onClick: handleRestoreSnapshot, disabled: selectedSnapshotId == null, className: "mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium" }, "恢复为选中快照")
                    );
                })()
            ),
            h("div", { className: "border-t pt-6", style: { order: -1 } },
                h("h3", { className: "font-bold text-gray-700 mb-4 flex items-center gap-2" }, h(Icon, { name: "settings" }), "⚙️ 系统配置"),
                h("div", { className: "bg-gray-50 border rounded-lg p-6 space-y-8" },
                    h("div", { className: "flex flex-wrap gap-2" },
                        h("button", { onClick: handleExportSystemConfig, className: "px-3 py-2 bg-white border rounded hover:bg-gray-100 text-sm" }, "导出配置 JSON"),
                        h("div", { className: "relative px-3 py-2 bg-white border rounded hover:bg-gray-100 text-sm cursor-pointer" }, "导入配置 JSON", h("input", { type: "file", className: "absolute inset-0 opacity-0 cursor-pointer", accept: ".json", onChange: handleImportSystemConfig })),
                        h("button", { onClick: handleResetSystemConfig, className: "px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded hover:bg-red-100 text-sm" }, "恢复默认配置")
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "基础设置"),
                        h("div", { className: "space-y-4" },
                            h("div", null,
                                h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "班级名称"),
                                h("input", {
                                    type: "text",
                                    className: "w-full border rounded-lg p-2 text-sm",
                                    value: systemConfig.className || "",
                                    onChange: (e) => updateSystemConfig(sc => ({ ...sc, className: e.target.value })),
                                    placeholder: "请输入班级名称"
                                })
                            ),
                            h("div", null,
                                h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "管理员密码"),
                                h("div", { className: "flex gap-2" },
                                    h("button", {
                                        onClick: () => {
                                            const oldPassInput = prompt("请输入旧密码以验证：");
                                            if (oldPassInput === null) return;
                                            
                                            const currentPass = systemConfig.adminPassword || DEFAULT_SYSTEM_CONFIG.adminPassword;
                                            if (oldPassInput !== currentPass) {
                                                return alert("旧密码验证失败！");
                                            }
                                            
                                            const newPassInput = prompt("验证成功！请输入新密码：");
                                            if (newPassInput === null) return;
                                            if (!newPassInput.trim()) return alert("新密码不能为空！");
                                            
                                            updateSystemConfig(sc => ({ ...sc, adminPassword: newPassInput.trim() }));
                                            alert("密码修改成功，请牢记新密码。");
                                        },
                                        className: "px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm"
                                    }, "🔐 修改管理员密码"),
                                    h("button", {
                                         onClick: () => {
                                             if (confirm(`确定要重置为默认密码吗？（默认密码：${DEFAULT_SYSTEM_CONFIG.adminPassword}）`)) {
                                                 updateSystemConfig(sc => ({ ...sc, adminPassword: DEFAULT_SYSTEM_CONFIG.adminPassword }));
                                                 alert(`已重置为默认密码：${DEFAULT_SYSTEM_CONFIG.adminPassword}`);
                                             }
                                         },
                                         className: "px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                                     }, "重置默认")
                                ),
                                h("p", { className: "text-xs text-gray-500 mt-2" }, "修改密码后，所有受限操作（如修改设置、修正积分等）将使用新密码验证。")
                            ),
                            h("div", null,
                                h("label", { className: "block text-sm font-medium text-gray-700 mb-2" }, "功能开关"),
                                h("div", { className: "space-y-2 bg-gray-50 p-3 rounded-lg" },
                                    h("label", { className: "flex items-center gap-3 cursor-pointer" },
                                        h("input", {
                                            type: "checkbox",
                                            checked: systemConfig.enabledFeatures?.battle ?? true,
                                            onChange: (e) => updateSystemConfig(sc => ({
                                                ...sc,
                                                enabledFeatures: {
                                                    ...(sc.enabledFeatures || {}),
                                                    battle: e.target.checked
                                                }
                                            })),
                                            className: "w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        }),
                                        h("span", { className: "text-sm text-gray-700" }, "启用双子星对战系统"),
                                        h("span", { className: "text-xs text-gray-500" }, "（关闭后导航栏将隐藏此功能）")
                                    )
                                )
                            ),
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "组织与角色"),
                        h("div", { className: "space-y-4" },
                            h("div", { className: "bg-white border rounded-lg p-4 space-y-4" },
                                h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                                    h("div", null,
                                        h("div", { className: "text-sm font-medium text-gray-700" }, "组织架构"),
                                        h("p", { className: "text-xs text-gray-500 mt-1" }, "小组管理、宿舍管理和工资设置统一收在这里。")
                                    ),
                                    h("button", {
                                        onClick: () => setShowOrganizationManager(prev => !prev),
                                        className: "px-4 py-2 bg-white border rounded hover:bg-gray-100 text-sm font-medium"
                                    }, showOrganizationManager ? "收起组织架构" : "打开组织架构")
                                ),
                                showOrganizationManager && h("div", { className: "border-t pt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start max-w-5xl" },
                                    h("div", { className: "w-full max-w-xs sm:max-w-sm bg-white border rounded-lg p-4 space-y-3" },
                                        h("div", { className: "flex justify-between items-center" },
                                            h("span", { className: "text-sm font-medium text-gray-700" }, "小组管理"),
                                            h("button", { onClick: () => updateSystemConfig(sc => {
                                                const list = [...(sc.organization.groups || [])];
                                                list.push({ id: `group_${Date.now()}`, name: "新小组", color: "bg-gray-100 text-gray-700 border-gray-200" });
                                                return { ...sc, organization: { ...sc.organization, groups: list } };
                                            }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增小组")
                                        ),
                                        (systemConfig.organization.groups || []).length === 0
                                            ? h("div", { className: "text-sm text-gray-400 py-2" }, "暂无小组")
                                            : h("div", { className: "space-y-2" },
                                                (systemConfig.organization.groups || []).map((g, idx) => h("div", { key: g.id || idx, className: "flex items-center gap-2 bg-gray-50 p-2 rounded border" },
                                                    h("input", { className: "w-32 sm:w-36 max-w-full border rounded p-2 text-sm bg-white", value: g.name || "", onChange: e => updateSystemConfig(sc => {
                                                        const list = [...sc.organization.groups];
                                                        list[idx] = { ...list[idx], name: e.target.value };
                                                        return { ...sc, organization: { ...sc.organization, groups: list } };
                                                    }), placeholder: "小组名称" }),
                                                    h("button", { onClick: () => updateSystemConfig(sc => {
                                                        const list = [...sc.organization.groups];
                                                        list.splice(idx, 1);
                                                        return { ...sc, organization: { ...sc.organization, groups: list } };
                                                    }), className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs shrink-0" }, "删除")
                                                ))
                                            )
                                    ),
                                    h("div", { className: "w-full max-w-xs sm:max-w-sm bg-white border rounded-lg p-4 space-y-3" },
                                        h("div", { className: "flex justify-between items-center" },
                                            h("span", { className: "text-sm font-medium text-gray-700" }, "宿舍管理"),
                                            h("button", { onClick: () => updateSystemConfig(sc => {
                                                const list = [...(sc.organization.dorms || [])];
                                                list.push({ id: `dorm_${Date.now()}`, name: "新宿舍" });
                                                return { ...sc, organization: { ...sc.organization, dorms: list } };
                                            }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增宿舍")
                                        ),
                                        (systemConfig.organization.dorms || []).length === 0
                                            ? h("div", { className: "text-sm text-gray-400 py-2" }, "暂无宿舍")
                                            : h("div", { className: "space-y-2" },
                                                (systemConfig.organization.dorms || []).map((d, idx) => h("div", { key: d.id || idx, className: "flex items-center gap-2 bg-gray-50 p-2 rounded border" },
                                                    h("input", { className: "w-32 sm:w-36 max-w-full border rounded p-2 text-sm bg-white", value: d.name || "", onChange: e => updateSystemConfig(sc => {
                                                        const list = [...sc.organization.dorms];
                                                        list[idx] = { ...list[idx], name: e.target.value };
                                                        return { ...sc, organization: { ...sc.organization, dorms: list } };
                                                    }), placeholder: "宿舍名称" }),
                                                    h("button", { onClick: () => updateSystemConfig(sc => {
                                                        const list = [...sc.organization.dorms];
                                                        list.splice(idx, 1);
                                                        return { ...sc, organization: { ...sc.organization, dorms: list } };
                                                    }), className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs shrink-0" }, "删除")
                                                ))
                                            )
                                    ),
                                    h("div", { className: "w-full max-w-xs sm:max-w-sm bg-white border rounded-lg p-4 space-y-4" },
                                        h("div", { className: "text-sm font-medium text-gray-700" }, "工资设置"),
                                        h("div", { className: "space-y-4" },
                                            h("div", null,
                                                h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "每日工资基础分"),
                                                h("input", {
                                                    type: "number",
                                                    className: "w-full border rounded-lg p-2 text-sm",
                                                    value: systemConfig.points.dailyWageAmount ?? 5,
                                                    onChange: e => updateSystemConfig(sc => ({
                                                        ...sc,
                                                        points: {
                                                            ...sc.points,
                                                            dailyWageAmount: Number(e.target.value)
                                                        }
                                                    }))
                                                }),
                                                h("p", { className: "text-xs text-gray-500 mt-1" }, "普通成员按此分值发放，组长固定额外 +1 分。")
                                            ),
                                            h("div", null,
                                                h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "发放工资的小组"),
                                                h("div", { className: "space-y-2 border rounded-lg p-3 bg-gray-50" },
                                                    (systemConfig.organization.groups || []).map(group => {
                                                        const selectedGroups = Array.isArray(systemConfig.points.dailyWageGroups) ? systemConfig.points.dailyWageGroups : [];
                                                        const checked = selectedGroups.includes(group.id);
                                                        return h("label", { key: group.id, className: "flex items-center gap-2 text-sm text-gray-700" },
                                                            h("input", {
                                                                type: "checkbox",
                                                                checked,
                                                                onChange: e => updateSystemConfig(sc => {
                                                                    const current = Array.isArray(sc.points.dailyWageGroups) ? sc.points.dailyWageGroups : [];
                                                                    const next = e.target.checked
                                                                        ? [...new Set([...current, group.id])]
                                                                        : current.filter(id => id !== group.id);
                                                                    return {
                                                                        ...sc,
                                                                        points: {
                                                                            ...sc.points,
                                                                            dailyWageGroups: next
                                                                        }
                                                                    };
                                                                })
                                                            }),
                                                            h("span", null, group.name || group.id)
                                                        );
                                                    })
                                                ),
                                                h("p", { className: "text-xs text-gray-500 mt-1" }, "“一键工资”只会给这里勾选的小组成员发放工资。")
                                            )
                                        )
                                    )
                                )
                            ),
                            h("div", { className: "bg-white border rounded-lg p-4 space-y-4" },
                                h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                                    h("div", null,
                                        h("div", { className: "text-sm font-medium text-gray-700" }, "自定义角色"),
                                        h("p", { className: "text-xs text-gray-500 mt-1" }, "专员角色、班级自定义角色和岗位值日维护统一收在这里。")
                                    ),
                                    h("button", {
                                        onClick: () => setShowCustomRolesManager(prev => !prev),
                                        className: "px-4 py-2 bg-white border rounded hover:bg-gray-100 text-sm font-medium"
                                    }, showCustomRolesManager ? "收起自定义角色" : "打开自定义角色")
                                ),
                                showCustomRolesManager && h("div", { className: "border-t pt-4 space-y-4" },
                                    h("div", { className: "grid grid-cols-1 xl:grid-cols-2 gap-4 items-start max-w-4xl" },
                                        h("div", { className: "w-full max-w-sm bg-white border rounded-lg p-4 space-y-3" },
                                            h("div", { className: "flex justify-between items-center" },
                                                h("span", { className: "text-sm font-medium text-gray-700" }, "专员角色"),
                                                h("button", { onClick: () => updateSystemConfig(sc => {
                                                    const list = [...(sc.organization.commissionerRoles || [])];
                                                    list.push({ id: `role_${Date.now()}`, name: "新角色" });
                                                    return { ...sc, organization: { ...sc.organization, commissionerRoles: list } };
                                                }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增角色")
                                            ),
                                            (systemConfig.organization.commissionerRoles || []).length === 0
                                                ? h("div", { className: "text-sm text-gray-400 py-2" }, "暂无专员角色")
                                                : h("div", { className: "space-y-2" },
                                                    (systemConfig.organization.commissionerRoles || []).map((r, idx) => h("div", { key: r.id || idx, className: "flex items-center gap-2 bg-gray-50 p-2 rounded border" },
                                                        h("input", { className: "w-36 sm:w-40 max-w-full border rounded p-2 text-sm bg-white", value: r.name || "", onChange: e => updateSystemConfig(sc => {
                                                            const list = [...sc.organization.commissionerRoles];
                                                            list[idx] = { ...list[idx], name: e.target.value };
                                                            return { ...sc, organization: { ...sc.organization, commissionerRoles: list } };
                                                        }), placeholder: "角色名称" }),
                                                        h("button", { onClick: () => updateSystemConfig(sc => {
                                                            const list = [...sc.organization.commissionerRoles];
                                                            list.splice(idx, 1);
                                                            return { ...sc, organization: { ...sc.organization, commissionerRoles: list } };
                                                        }), className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs shrink-0" }, "删除")
                                                    ))
                                                )
                                        ),
                                        h("div", { className: "w-full max-w-xl bg-white border rounded-lg p-4 space-y-3" },
                                            h("div", { className: "flex justify-between items-center" },
                                                h("span", { className: "text-sm font-medium text-gray-700" }, "班级自定义角色"),
                                                h("button", { onClick: () => updateSystemConfig(sc => {
                                                    const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                    list.push({ id: `custom_role_${Date.now()}`, name: "新职务", dailyWage: 2, studentId: null });
                                                    return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                                }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增职务")
                                            ),
                                            h("p", { className: "text-xs text-gray-500" }, "只维护职务名称、每日工资和任职学生，内部编号继续保留但不在这里编辑。"),
                                            getCustomRoles(config).length === 0
                                                ? h("div", { className: "text-sm text-gray-400 py-2" }, "暂无班级自定义角色")
                                                : h("div", { className: "space-y-2" },
                                                    getCustomRoles(config).map((role, idx) => h("div", { key: role.id || idx, className: "bg-gray-50 p-3 rounded border space-y-2" },
                                                        h("div", { className: "flex items-center gap-2" },
                                                            h("input", { className: "w-36 sm:w-40 max-w-full border rounded p-2 text-sm bg-white", value: role.name || "", onChange: e => updateSystemConfig(sc => {
                                                                const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                                list[idx] = { ...list[idx], name: e.target.value };
                                                                return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                                            }), placeholder: "职务名称" }),
                                                            h("input", { type: "number", className: "w-24 border rounded p-2 text-sm bg-white", value: role.dailyWage ?? 0, onChange: e => updateSystemConfig(sc => {
                                                                const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                                list[idx] = { ...list[idx], dailyWage: Number(e.target.value) };
                                                                return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                                            }), placeholder: "工资" }),
                                                            h("button", { onClick: () => updateSystemConfig(sc => {
                                                                const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                                list.splice(idx, 1);
                                                                return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                                            }), className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs shrink-0" }, "删除")
                                                        ),
                                                        h("select", { className: "w-full max-w-xs border rounded p-2 text-sm bg-white", value: role.studentId || "", onChange: e => updateSystemConfig(sc => {
                                                            const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                            list[idx] = { ...list[idx], studentId: e.target.value ? Number(e.target.value) : null };
                                                            return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                                        }) },
                                                            h("option", { value: "" }, "未设置任职学生"),
                                                            (students || []).map(student => h("option", { key: student.id, value: student.id }, student.name))
                                                        )
                                                    ))
                                                )
                                        )
                                    ),
                                    h("div", { className: "w-full max-w-4xl bg-white border rounded-lg p-4 space-y-4" },
                                        h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                                            h("div", null,
                                                h("h4", { className: "font-bold text-gray-800 mb-1 text-sm flex items-center gap-2" }, h(Icon, { name: "users" }), "岗位与值日维护"),
                                                h("p", { className: "text-xs text-gray-500" }, "卫生值日和纪律专员的人员安排统一收在这里。")
                                            ),
                                            h("button", {
                                                onClick: () => setShowDutyManager(prev => !prev),
                                                className: "px-4 py-2 bg-white border rounded hover:bg-gray-100 text-sm font-medium"
                                            }, showDutyManager ? "收起岗位与值日维护" : "打开岗位与值日维护")
                                        ),
                                        showDutyManager && h("div", { className: "border-t pt-4 space-y-6" },
                                            h("div", null,
                                                h("h4", { className: "font-bold text-gray-800 mb-3 text-sm flex items-center gap-2" }, h(Icon, { name: "users" }), "卫生值日设置"),
                                                h("div", { className: "space-y-2 text-sm" },
                                                    Object.keys(config.duty || {}).map(day => h("div", { key: day, className: "flex items-center" },
                                                        h("span", { className: "w-12 text-gray-500" }, { mon: "周一", tue: "周二", wed: "周三", thu: "周四", fri: "周五" }[day]),
                                                        (config.duty?.[day] || []).map((val, idx) => h("select", { key: idx, value: val, onChange: e => handleDutyChange(day, idx, e.target.value), className: "ml-2 border rounded p-1 flex-1 bg-white" }, h("option", { value: "" }, "-"), students.filter(s => s.group === 'hygiene').map(s => h("option", { key: s.id, value: s.name }, s.name))))
                                                    ))
                                                )
                                            ),
                                            h("div", null,
                                                h("h4", { className: "font-bold text-gray-800 mb-3 text-sm flex items-center gap-2" }, h(Icon, { name: "star" }), "纪律专员设置"),
                                                h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
                                                    getCommissionerRoles(config).map(role => h("div", { key: role.id },
                                                        h("div", { className: "text-xs text-gray-500 mb-1" }, role.name),
                                                        h("select", { value: config.commissioners?.[role.id] || "", onChange: e => handleCommissionerChange(role.id, e.target.value), className: "w-full border rounded p-2 text-sm bg-white" }, h("option", { value: "" }, "未设置"), students.filter(s => s.group === 'discipline').map(s => h("option", { key: s.id, value: s.id }, s.name)))
                                                    ))
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "倒数日设置"),
                        h("div", { className: "flex flex-col md:flex-row gap-2 mb-3" },
                            h("input", { className: "border rounded p-2 text-sm flex-1", value: countdownName, onChange: e => setCountdownName(e.target.value), placeholder: "事件名称" }),
                            h("input", { type: "date", className: "border rounded p-2 text-sm", value: countdownDate, onChange: e => setCountdownDate(e.target.value) }),
                            h("button", { onClick: addCountdownEvent, className: "px-3 py-2 bg-blue-600 text-white rounded text-sm" }, "新增")
                        ),
                        h("div", { className: "space-y-2" },
                            (Array.isArray(config.countdownEvents) ? config.countdownEvents : []).map(e => h("div", { key: e.id || `${e.name}-${e.date}`, className: "flex items-center gap-2 bg-white p-2 rounded border text-sm" },
                                h("div", { className: "flex-1" }, `${e.name} · ${e.date}`),
                                h("button", { onClick: () => removeCountdownEvent(e.id), className: "px-2 py-1 text-xs bg-red-50 text-red-600 rounded" }, "删除")
                            ))
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "简报生成"),
                        h("div", { className: "flex flex-wrap gap-2 mb-3" },
                            h("button", { onClick: () => { const r = getReportRange(7); setReportStart(r.start); setReportEnd(r.end); }, className: "px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded" }, "近7天"),
                            h("button", { onClick: () => { const r = getReportRange(30); setReportStart(r.start); setReportEnd(r.end); }, className: "px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded" }, "近30天")
                        ),
                        h("div", { className: "flex flex-col md:flex-row gap-2" },
                            h("input", { type: "date", className: "border rounded p-2 text-sm", value: reportStart, onChange: e => setReportStart(e.target.value) }),
                            h("input", { type: "date", className: "border rounded p-2 text-sm", value: reportEnd, onChange: e => setReportEnd(e.target.value) }),
                            h("button", { onClick: handleGenerateBrief, className: "px-3 py-2 bg-emerald-600 text-white rounded text-sm" }, "生成简报")
                        )
                    ),
                    h("div", { className: "border-t pt-4" },
                        h("button", {
                            onClick: () => {
                                const fullData = {
                                    students,
                                    history,
                                    config,
                                    attendanceRecords,
                                    treasures,
                                    storage,
                                    logs,
                                    quotes,
                                    messages,
                                    teacherMessages,
                                    redemptionHistory,
                                    dailyRedemptionCounts,
                                    dailyUsageCounts,
                                    tasks,
                                    battle
                                };
                                if (typeof persistData === 'function') persistData(fullData);
                                alert("配置已保存！");
                            },
                            className: "w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                        }, "💾 保存配置")
                    )
                )
            ),
            h("div", { className: "border-t pt-6 text-center" }, h("button", { onClick: handleReset, className: "text-red-500 text-sm hover:underline hover:bg-red-50 px-4 py-2 rounded" }, "危险区域：清空重置所有数据"))
        );
    };

        return SettingsView;
    };
})();
