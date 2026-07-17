(function() {
    window.createOperationView = function createOperationView(deps) {
        const {
            h,
            useState,
            useEffect,
            useRef,
            Modal,
            Icon,
            requireAdminAuth,
            getNow,
            getTodayStr,
            getDateString,
            getSystemConfig,
            getGroupsConfig,
            getDormsConfig,
            getReasonsPreset,
            getSubjectsConfig,
            normalizePointScene,
            normalizePointCategory,
            POINT_SCENES,
            POINT_CATEGORIES,
            DEFAULT_POINT_SCENE,
            DEFAULT_POINT_CATEGORY
        } = deps || {};
        const uiState = window.OperationUiState || {};
        const selectors = window.OperationSelectors || {};
        const builders = window.OperationBuilders || {};
        const {
            DEFAULT_UI_STATE,
            readUiState,
            writeUiState,
            setsAreEqual,
            parseNumericInput
        } = uiState;
        const {
            buildStudentMap,
            getFilteredStudents,
            getFilteredSelectedCount,
            getReasonsByType,
            getHomeworkSubjects,
            getHomeworkDates,
            getRecentHistory,
            sanitizeIdSetByStudents
        } = selectors;
        const {
            buildModalStudents,
            buildBatchUpdates,
            buildHomeworkUpdates,
            buildHomeworkConfirmMessage,
            buildRunningExerciseUpdates,
            buildRunningExerciseConfirmMessage,
            buildHygieneUpdates,
            buildHygieneConfirmMessage,
            buildDisciplineUpdates,
            buildDisciplineConfirmMessage
        } = builders;
        const createOperationHandlers = window.createOperationHandlers;
        const createOperationViews = window.createOperationViews;
        const createOperationSettingsSections = window.createOperationSettingsSections;
        const createOperationHistorySection = window.createOperationHistorySection;
        const createOperationAdminTools = window.createOperationAdminTools;

        if (
            !h ||
            !useState ||
            !useEffect ||
            !useRef ||
            !Modal ||
            !Icon ||
            !requireAdminAuth ||
            !getNow ||
            !getTodayStr ||
            !getDateString ||
            !getSystemConfig ||
            !getGroupsConfig ||
            !getDormsConfig ||
            !getReasonsPreset ||
            !getSubjectsConfig ||
            !normalizePointScene ||
            !normalizePointCategory ||
            !POINT_SCENES ||
            !POINT_CATEGORIES ||
            !DEFAULT_POINT_SCENE ||
            !DEFAULT_POINT_CATEGORY ||
            !DEFAULT_UI_STATE ||
            !readUiState ||
            !writeUiState ||
            !setsAreEqual ||
            !parseNumericInput ||
            !buildStudentMap ||
            !getFilteredStudents ||
            !getFilteredSelectedCount ||
            !getReasonsByType ||
            !getHomeworkSubjects ||
            !getHomeworkDates ||
            !getRecentHistory ||
            !sanitizeIdSetByStudents ||
            !buildModalStudents ||
            !buildBatchUpdates ||
            !buildHomeworkUpdates ||
            !buildHomeworkConfirmMessage ||
            !buildRunningExerciseUpdates ||
            !buildRunningExerciseConfirmMessage ||
            !buildHygieneUpdates ||
            !buildHygieneConfirmMessage ||
            !buildDisciplineUpdates ||
            !buildDisciplineConfirmMessage ||
            !createOperationHandlers ||
            !createOperationViews ||
            !createOperationSettingsSections ||
            !createOperationHistorySection ||
            !createOperationAdminTools
        ) {
            throw new Error('OperationView dependencies are missing');
        }

        const {
            SelectionPanel,
            StudentSelectionGrid,
            ReasonToolbar,
            HomeworkPanel,
            RunningExercisePanel,
            HygienePanel,
            DisciplinePanel,
            RecentHistoryPanel,
            BatchAdjustModalView
        } = createOperationViews({
            h,
            useState,
            useEffect,
            useRef,
            Modal,
            Icon,
            normalizePointScene,
            normalizePointCategory,
            POINT_SCENES,
            POINT_CATEGORIES,
            DEFAULT_POINT_SCENE,
            DEFAULT_POINT_CATEGORY
        });
        const {
            SubjectConfigSection,
            ReasonsConfigSection,
            PenaltyDecaySection,
            RunningExerciseSettingsSection,
            HygieneRegisterSettingsSection,
            DisciplineRegisterSettingsSection,
            RecordAttributesSection
        } = createOperationSettingsSections({
            h,
            useState,
            useEffect,
            Icon,
            requireAdminAuth,
            getSystemConfig,
            normalizePointScene,
            normalizePointCategory,
            POINT_SCENES,
            POINT_CATEGORIES,
            DEFAULT_POINT_SCENE,
            DEFAULT_POINT_CATEGORY
        });
        const OperationHistorySection = createOperationHistorySection({
            h,
            useState,
            Icon,
            requireAdminAuth,
            normalizePointScene,
            normalizePointCategory
        });
        const operationAdminTools = createOperationAdminTools({ getTodayStr });

        return function OperationView({
            students,
            handleWage,
            history,
            handleUndo,
            batchUpdatePoints,
            config,
            setConfig,
            setHistory,
            onApplyFixedStudents
        }) {
            const initialUiState = readUiState();
            const [selectedIdsState, setSelectedIdsState] = useState(() => new Set(initialUiState.selectedIds));
            const [filterGroupState, setFilterGroupState] = useState(() => initialUiState.filterGroup);
            const [filterDormState, setFilterDormState] = useState(() => initialUiState.filterDorm);
            const [opTabState, setOpTabState] = useState(() => initialUiState.opTab);
            const [workspaceSection, setWorkspaceSection] = useState('quick');
            const [registerMode, setRegisterMode] = useState('homework');
            const [settingsOpen, setSettingsOpen] = useState(false);
            const operationPendingRef = useRef(false);
            const [operationPending, setOperationPending] = useState(false);
            const [operationFeedback, setOperationFeedback] = useState(null);
            const operationConfirmResolverRef = useRef(null);
            const [operationConfirm, setOperationConfirm] = useState(null);
            const [batchAdjustModal, setBatchAdjustModal] = useState({
                open: false,
                reason: null,
                students: [],
                type: 'bonus',
                isMulti: false,
                factor: 1,
                isCustom: false,
                customReasonName: "",
                scene: DEFAULT_POINT_SCENE,
                category: DEFAULT_POINT_CATEGORY
            });
            const [hwSubject, setHwSubject] = useState("");
            const [hwDate, setHwDate] = useState("");
            const [hwSelectedIds, setHwSelectedIds] = useState(new Set());
            const [runDate, setRunDate] = useState("");
            const [runSelectedAbsentIds, setRunSelectedAbsentIds] = useState(new Set());
            const [hygieneSelectedIds, setHygieneSelectedIds] = useState(new Set());
            const [disciplineDate, setDisciplineDate] = useState("");
            const [disciplineActiveTab, setDisciplineActiveTabState] = useState("noise");
            const [disciplineSelectedIds, setDisciplineSelectedIds] = useState(new Set());

            const settleOperationConfirmation = (confirmed) => {
                const resolver = operationConfirmResolverRef.current;
                operationConfirmResolverRef.current = null;
                setOperationConfirm(null);
                resolver?.(confirmed);
            };

            const requestOperationConfirmation = (options) => new Promise(resolve => {
                operationConfirmResolverRef.current?.(false);
                operationConfirmResolverRef.current = resolve;
                setOperationConfirm({
                    title: options?.title || '确认操作',
                    message: options?.message || '',
                    confirmText: options?.confirmText || '确认',
                    type: options?.type || 'info'
                });
            });

            useEffect(() => () => {
                operationConfirmResolverRef.current?.(false);
                operationConfirmResolverRef.current = null;
            }, []);
            const setDisciplineActiveTab = (tab) => {
                setDisciplineActiveTabState(tab);
                setDisciplineSelectedIds(new Set());
            };

            const setSelectedIds = (next) => {
                setSelectedIdsState(prev => {
                    const resolved = typeof next === 'function' ? next(prev) : next;
                    const nextSet = resolved instanceof Set
                        ? new Set(resolved)
                        : new Set(Array.isArray(resolved) ? resolved : []);
                    if (setsAreEqual(prev, nextSet)) return prev;
                    writeUiState({ selectedIds: Array.from(nextSet) });
                    return nextSet;
                });
            };

            const setFilterGroup = (next) => {
                setFilterGroupState(prev => {
                    const value = typeof next === 'function' ? next(prev) : next;
                    const safeValue = value || DEFAULT_UI_STATE.filterGroup;
                    if (safeValue === prev) return prev;
                    writeUiState({ filterGroup: safeValue });
                    return safeValue;
                });
            };

            const setFilterDorm = (next) => {
                setFilterDormState(prev => {
                    const value = typeof next === 'function' ? next(prev) : next;
                    const safeValue = value || DEFAULT_UI_STATE.filterDorm;
                    if (safeValue === prev) return prev;
                    writeUiState({ filterDorm: safeValue });
                    return safeValue;
                });
            };

            const setOpTab = (next) => {
                setOpTabState(prev => {
                    const value = typeof next === 'function' ? next(prev) : next;
                    const safeValue = value === 'penalty' ? 'penalty' : 'bonus';
                    if (safeValue === prev) return prev;
                    writeUiState({ opTab: safeValue });
                    return safeValue;
                });
            };

            const groupsConfig = getGroupsConfig(config);
            const dormsConfig = getDormsConfig(config);
            const systemConfig = getSystemConfig(config);
            const reasons = getReasonsByType(getReasonsPreset(config), opTabState);
            const subjectsConfig = getSubjectsConfig(config);
            const homeworkSubjects = getHomeworkSubjects(subjectsConfig);
            const studentMap = buildStudentMap(students);
            const historyList = Array.isArray(history) ? history : [];
            const homeworkDates = getHomeworkDates({ getNow, getDateString });

            const computeHygieneSession = () => {
                const schedule = (systemConfig.attendance && systemConfig.attendance.schedule) || [];
                const now = getNow();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                for (const session of schedule) {
                    if (!session.lateTime || !session.end) continue;
                    const [lh, lm] = session.lateTime.split(':').map(Number);
                    const [eh, em] = session.end.split(':').map(Number);
                    const startMin = lh * 60 + lm;
                    const endMin = eh * 60 + em + 20;
                    if (currentMinutes >= startMin && currentMinutes <= endMin) {
                        return session;
                    }
                }
                return null;
            };
            const hygieneSession = computeHygieneSession();

            const getDayKey = (date) => {
                const day = date.getDay();
                const map = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };
                return map[day] || null;
            };
            const todayKey = getDayKey(getNow());
            const resolveStudentsFromRefs = (refs) => {
                const safeStudents = Array.isArray(students) ? students : [];
                const uniqueStudents = [];
                const seen = new Set();
                (Array.isArray(refs) ? refs : []).forEach((ref) => {
                    const text = String(ref || '').trim();
                    if (!text) return;
                    const matchedStudent = safeStudents.find(student => (
                        String(student?.id) === text || String(student?.name || '').trim() === text
                    ));
                    if (!matchedStudent) return;
                    const studentKey = String(matchedStudent.id);
                    if (seen.has(studentKey)) return;
                    seen.add(studentKey);
                    uniqueStudents.push(matchedStudent);
                });
                return uniqueStudents;
            };

            const dutyList = todayKey && config && config.duty ? config.duty[todayKey] : [];
            const hygieneInspectors = resolveStudentsFromRefs(dutyList);
            const hygieneInspectorStudentIds = hygieneInspectors.map(student => student.id);
            const hygieneInspectorNames = hygieneInspectors.map(student => student.name);

            const pointsConfig = systemConfig.points || {};
            const hygieneAreaPenalty = pointsConfig.hygieneRegister?.areaPenalty ?? 1;
            const hygieneInspectorBonus = pointsConfig.hygieneRegister?.inspectorBonus ?? 1;

            const disciplineConfig = pointsConfig.disciplineRegister || {};
            const commissionerRolesList = (systemConfig.organization && Array.isArray(systemConfig.organization.commissionerRoles))
                ? systemConfig.organization.commissionerRoles
                : [];
            const commissionerStudentIdMap = {};
            const disciplineCommissionerNamesMap = {};
            commissionerRolesList.forEach(role => {
                if (role && role.id) {
                    const studentId = role.studentId != null && role.studentId !== '' ? String(role.studentId) : '';
                    if (!studentId) return;
                    const student = studentMap.get(studentId);
                    if (!student) return;
                    if (!Array.isArray(commissionerStudentIdMap[role.id])) commissionerStudentIdMap[role.id] = [];
                    if (!Array.isArray(disciplineCommissionerNamesMap[role.id])) disciplineCommissionerNamesMap[role.id] = [];
                    if (!commissionerStudentIdMap[role.id].includes(student.id)) {
                        commissionerStudentIdMap[role.id].push(student.id);
                    }
                    if (!disciplineCommissionerNamesMap[role.id].includes(student.name)) {
                        disciplineCommissionerNamesMap[role.id].push(student.name);
                    }
                }
            });
            const disciplineCommissionerMap = {
                noise: commissionerStudentIdMap.noise || [],
                desk: commissionerStudentIdMap.desk || [],
                tablet: commissionerStudentIdMap.tablet || [],
                outdoor: commissionerStudentIdMap.outdoor || []
            };
            const disciplineTabLabels = {
                noise: '学习时间讲话',
                desk: '桌面杂乱',
                tablet: '平板未归',
                outdoor: '晚自习外出'
            };

            const toggleSettingsPanel = async () => {
                if (settingsOpen) {
                    setSettingsOpen(false);
                    return;
                }
                if (!await requireAdminAuth("请输入维护密码以打开积分操作区设置：")) return;
                setSettingsOpen(true);
            };
            const handleExportScoreExcel = () => operationAdminTools.exportScoreExcel({
                students,
                groupsConfig,
                dormsConfig
            });
            const handleWageClick = async () => {
                if (operationPendingRef.current) return;
                const wageGroups = Array.isArray(systemConfig.points?.dailyWageGroups)
                    ? systemConfig.points.dailyWageGroups
                    : [];
                const wageTargets = (Array.isArray(students) ? students : []).filter(student => wageGroups.includes(student.group));
                const paidRoles = (Array.isArray(systemConfig.organization?.customRoles) ? systemConfig.organization.customRoles : [])
                    .filter(role => role && role.studentId != null && Number(role.dailyWage) !== 0);
                const expectedRecords = wageTargets.length + paidRoles.length;
                if (expectedRecords === 0) {
                    setOperationFeedback({
                        type: 'warning',
                        message: '没有找到可发放工资或津贴的对象，请检查工资小组和班级职务配置。'
                    });
                    return;
                }
                const baseWage = Number(systemConfig.points?.dailyWageAmount);
                const dailyWage = Number.isFinite(baseWage) ? baseWage : 5;
                const confirmed = await requestOperationConfirmation({
                    title: '确认发放一键工资',
                    message: `将按当前配置生成 ${expectedRecords} 条工资积分记录。\n工资小组 ${wageTargets.length} 人，每人 ${dailyWage} 分（组长加 1 分）；班级职务津贴 ${paidRoles.length} 条。\n每天只能发放一次，请核对后继续。`,
                    confirmText: '确认发放'
                });
                if (!confirmed) return;
                operationPendingRef.current = true;
                setOperationPending(true);
                setOperationFeedback({ type: 'pending', message: '正在保存工资积分…' });
                try {
                    let wageFeedback = null;
                    const count = await Promise.resolve(handleWage({
                        onFeedback: feedback => { wageFeedback = feedback; }
                    }));
                    if (Number(count) > 0) {
                        setOperationFeedback({ type: 'success', message: `工资积分已保存，共 ${count} 条记录。` });
                    } else {
                        setOperationFeedback(wageFeedback || {
                            type: 'warning',
                            message: '本次没有生成工资积分记录，请检查今日是否已发放或工资配置是否完整。'
                        });
                    }
                } catch (error) {
                    setOperationFeedback({ type: 'error', message: `工资积分保存失败：${error?.message || '请检查网络后重试'}。` });
                } finally {
                    operationPendingRef.current = false;
                    setOperationPending(false);
                }
            };
            const handleFixScore = async () => {
                if (operationPendingRef.current) return;
                operationPendingRef.current = true;
                setOperationPending(true);
                setOperationFeedback(null);
                try {
                    const result = await Promise.resolve(operationAdminTools.fixScore({
                        students,
                        applyStudents: onApplyFixedStudents
                    }));
                    if (result?.ok) setOperationFeedback({ type: 'success', message: '手动修正积分已保存。' });
                } catch (error) {
                    setOperationFeedback({ type: 'error', message: `手动修正保存失败：${error?.message || '请检查网络后重试'}。` });
                } finally {
                    operationPendingRef.current = false;
                    setOperationPending(false);
                }
            };

            useEffect(() => {
                setSelectedIds(prev => {
                    const next = sanitizeIdSetByStudents(prev, students);
                    return setsAreEqual(prev, next) ? prev : next;
                });
                setHwSelectedIds(prev => {
                    const next = sanitizeIdSetByStudents(prev, students);
                    return setsAreEqual(prev, next) ? prev : next;
                });
                setRunSelectedAbsentIds(prev => {
                    const next = sanitizeIdSetByStudents(prev, students);
                    return setsAreEqual(prev, next) ? prev : next;
                });
                setHygieneSelectedIds(prev => {
                    const next = sanitizeIdSetByStudents(prev, students);
                    return setsAreEqual(prev, next) ? prev : next;
                });
                setDisciplineSelectedIds(prev => {
                    const next = sanitizeIdSetByStudents(prev, students);
                    return setsAreEqual(prev, next) ? prev : next;
                });
                if (filterGroupState !== DEFAULT_UI_STATE.filterGroup && !Object.prototype.hasOwnProperty.call(groupsConfig, filterGroupState)) {
                    setFilterGroup(DEFAULT_UI_STATE.filterGroup);
                }
                if (filterDormState !== DEFAULT_UI_STATE.filterDorm && !Object.prototype.hasOwnProperty.call(dormsConfig, filterDormState)) {
                    setFilterDorm(DEFAULT_UI_STATE.filterDorm);
                }
            }, [students, config, filterGroupState, filterDormState]);

            const filteredStudents = getFilteredStudents({
                students,
                filterGroup: filterGroupState,
                filterDorm: filterDormState,
                defaultFilter: DEFAULT_UI_STATE.filterGroup
            });
            const filteredSelectedCount = getFilteredSelectedCount(filteredStudents, selectedIdsState);
            const allFilteredSelected = filteredStudents.length > 0 && filteredSelectedCount === filteredStudents.length;
            const recentHistory = getRecentHistory(historyList, 50);

            const {
                toggleSelection,
                toggleSelectAll,
                handleReasonClick,
                handleCustomReason,
                updateStudentBatchValue,
                updateAllBatchValues,
                handleBatchConfirm,
                toggleHomeworkSelection,
                handleHomeworkSubmit,
                toggleRunningExerciseSelection,
                handleRunningExerciseSubmit,
                toggleHygieneSelection,
                handleHygieneSubmit,
                toggleDisciplineSelection,
                handleDisciplineSubmit
            } = createOperationHandlers({
                selectedIdsState,
                setSelectedIds,
                allFilteredSelected,
                filteredStudents,
                buildModalStudents,
                studentMap,
                opTabState,
                setBatchAdjustModal,
                normalizePointScene,
                normalizePointCategory,
                parseNumericInput,
                batchAdjustModal,
                buildBatchUpdates,
                batchUpdatePoints,
                hwSubject,
                hwDate,
                homeworkDates,
                historyList,
                subjectsConfig,
                hwSelectedIds,
                buildHomeworkUpdates,
                buildHomeworkConfirmMessage,
                setHwSelectedIds,
                setHwSubject,
                students,
                runDate,
                runSelectedAbsentIds,
                buildRunningExerciseUpdates,
                buildRunningExerciseConfirmMessage,
                setRunSelectedAbsentIds,
                runningExerciseAbsentPenalty: (systemConfig.points || {}).runningExerciseAbsentPenalty,
                runningExercisePresentBonus: (systemConfig.points || {}).runningExercisePresentBonus,
                runningExerciseCommissionerStudentId: (systemConfig.points || {}).runningExerciseCommissionerStudentId,
                runningExerciseCommissionerBonus: (systemConfig.points || {}).runningExerciseCommissionerBonus,
                buildHygieneUpdates,
                buildHygieneConfirmMessage,
                buildDisciplineUpdates,
                buildDisciplineConfirmMessage,
                getTodayStr,
                hygieneSession,
                hygieneSelectedIds,
                hygieneInspectorStudentIds,
                hygieneInspectorNames,
                hygieneAreaPenalty,
                hygieneInspectorBonus,
                setHygieneSelectedIds,
                disciplineDate: disciplineDate || homeworkDates[1] || homeworkDates[0],
                disciplineActiveTab,
                disciplineSelectedIds,
                disciplineConfig,
                disciplineCommissionerMap,
                disciplineCommissionerNamesMap,
                setDisciplineSelectedIds,
                operationPendingRef,
                setOperationPending,
                setOperationFeedback,
                requestOperationConfirmation
            });

            const registerModes = [
                { id: 'homework', label: '作业', icon: 'book', count: hwSelectedIds.size, enabled: true },
                { id: 'running', label: '跑操', icon: 'tasks', count: runSelectedAbsentIds.size, enabled: true },
                { id: 'hygiene', label: '卫生', icon: 'droplet', count: hygieneSelectedIds.size, enabled: !!systemConfig.enabledFeatures?.hygieneRegister },
                { id: 'discipline', label: '纪律', icon: 'shield', count: disciplineSelectedIds.size, enabled: !!systemConfig.enabledFeatures?.disciplineRegister }
            ].filter(item => item.enabled);
            const activeRegisterMode = registerModes.some(item => item.id === registerMode) ? registerMode : 'homework';

            return h("div", { className: "space-y-6 animate-fade-in" },
                h("div", { className: "bg-white rounded-xl border border-gray-200 p-2 flex flex-wrap gap-2", role: 'tablist', 'aria-label': '积分工作区' }, [
                    { id: 'quick', label: '快速积分', icon: 'star' },
                    { id: 'registers', label: '日常登记', icon: 'tasks' },
                    { id: 'history', label: '积分历史', icon: 'history' },
                    { id: 'settings', label: '设置', icon: 'settings' }
                ].map(item => h("button", {
                    key: item.id,
                    id: `operations-tab-${item.id}`,
                    role: 'tab',
                    'aria-selected': workspaceSection === item.id,
                    'aria-controls': `operations-panel-${item.id}`,
                    onClick: () => setWorkspaceSection(item.id),
                    className: `min-h-11 px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition ${workspaceSection === item.id ? 'bg-blue-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`
                }, h(Icon, { name: item.icon, size: 16 }), item.label))),
                operationFeedback && h("div", {
                    role: operationFeedback.type === 'error' ? 'alert' : 'status',
                    'aria-live': operationFeedback.type === 'error' ? 'assertive' : 'polite',
                    className: `rounded-lg border px-4 py-3 flex items-center justify-between gap-3 text-sm ${operationFeedback.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : operationFeedback.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : operationFeedback.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-blue-50 border-blue-200 text-blue-800'}`
                },
                    h("span", null, operationFeedback.message),
                    operationFeedback.type !== 'pending' && h("button", {
                        type: 'button',
                        onClick: () => setOperationFeedback(null),
                        className: "min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg hover:bg-black/5",
                        'aria-label': '关闭积分操作提示'
                    }, h(Icon, { name: 'x', size: 16 }))
                ),
                workspaceSection === 'quick' && h("section", { id: 'operations-panel-quick', role: 'tabpanel', 'aria-labelledby': 'operations-tab-quick', className: "space-y-6" },
                    h(SelectionPanel, {
                        filterGroup: filterGroupState,
                        setFilterGroup,
                        filterDorm: filterDormState,
                        setFilterDorm,
                        groupsConfig,
                        dormsConfig,
                        filteredStudents,
                        allFilteredSelected,
                        onToggleSelectAll: toggleSelectAll,
                        onHandleWage: handleWageClick,
                        wagePending: operationPending
                    }),
                    h(StudentSelectionGrid, {
                        filteredStudents,
                        selectedIds: selectedIdsState,
                        groupsConfig,
                        onToggleSelection: toggleSelection
                    }),
                    h(ReasonToolbar, {
                        selectedCount: selectedIdsState.size,
                        opTab: opTabState,
                        setOpTab,
                        onClearSelection: () => setSelectedIds(new Set()),
                        reasons,
                        onReasonClick: handleReasonClick,
                        onCustomReason: handleCustomReason
                    })
                ),
                workspaceSection === 'settings' && h("div", { id: 'operations-panel-settings', role: 'tabpanel', 'aria-labelledby': 'operations-tab-settings', className: "bg-white rounded-xl shadow-sm border p-4 space-y-4" },
                    h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                        h("div", { className: "space-y-1" },
                            h("div", { className: "flex items-center gap-2 text-gray-800" },
                                h(Icon, { name: "settings", size: 18 }),
                                h("h3", { className: "font-bold text-sm" }, "积分操作区设置")
                            ),
                            h("p", { className: "text-xs text-gray-500" }, "统一管理积分导出、手动修正、历史核对、积分理由、跑操分值、课代表和记录属性维护。")
                        ),
                        h("button", {
                            onClick: toggleSettingsPanel,
                            className: `min-h-11 px-3 py-2 rounded-lg text-sm font-medium ${settingsOpen ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                        }, settingsOpen ? "收起设置" : "打开设置")
                    ),
                    h("div", { className: settingsOpen ? "space-y-4 border-t pt-4" : "hidden" },
                        h("div", { className: "bg-gray-50 border rounded-lg p-4 space-y-3" },
                            h("div", null,
                                h("div", { className: "font-bold text-sm text-gray-800" }, "积分导出与修正"),
                                h("p", { className: "text-xs text-gray-500 mt-1" }, "这里只保留积分导出、手动修正和历史核对；积分导入与从历史恢复已移除。")
                            ),
                            h("div", { className: "flex flex-wrap gap-2" },
                                h("button", {
                                    onClick: handleExportScoreExcel,
                                    className: "min-h-11 px-3 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 text-sm"
                                }, "导出积分 Excel"),
                                h("button", {
                                    onClick: handleFixScore,
                                    disabled: operationPending,
                                    'aria-busy': operationPending ? 'true' : undefined,
                                    className: "min-h-11 px-3 py-2 border border-amber-500 text-amber-600 rounded hover:bg-amber-50 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                                }, operationPending ? "正在保存…" : "手动修正积分")
                            )
                        ),
                        h(ReasonsConfigSection, {
                            config,
                            setConfig,
                            embedded: true
                        }),
                        h(PenaltyDecaySection, {
                            config,
                            setConfig,
                            embedded: true
                        }),
                        h(RunningExerciseSettingsSection, {
                            students,
                            config,
                            setConfig,
                            embedded: true
                        }),
                        h(HygieneRegisterSettingsSection, {
                            config,
                            setConfig,
                            embedded: true
                        }),
                        h(DisciplineRegisterSettingsSection, {
                            config,
                            setConfig,
                            embedded: true
                        }),
                        h(SubjectConfigSection, {
                            students,
                            config,
                            setConfig,
                            embedded: true
                        }),
                        h(RecordAttributesSection, {
                            history,
                            setHistory,
                            config,
                            setConfig,
                            embedded: true
                        })
                    )
                ),
                workspaceSection === 'registers' && h("section", { id: 'operations-panel-registers', role: 'tabpanel', 'aria-labelledby': 'operations-tab-registers', className: "space-y-4" },
                    h("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" },
                        h("div", null,
                            h("h2", { className: "text-lg font-bold text-gray-900" }, "日常登记"),
                            h("p", { className: "mt-1 text-sm text-gray-600" }, "先选择登记类型，再筛选学生。切换类型不会清空各自的已选名单。")
                        ),
                        h("div", { className: "flex flex-wrap gap-2", role: 'tablist', 'aria-label': '日常登记类型' },
                            registerModes.map(item => h("button", {
                                key: item.id,
                                id: `register-mode-tab-${item.id}`,
                                role: 'tab',
                                'aria-selected': activeRegisterMode === item.id,
                                'aria-controls': 'register-workbench-panel',
                                onClick: () => setRegisterMode(item.id),
                                className: `min-h-11 rounded-lg border px-4 py-2 text-sm font-medium inline-flex items-center gap-2 ${activeRegisterMode === item.id ? 'border-blue-700 bg-blue-700 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-blue-400'}`
                            }, h(Icon, { name: item.icon, size: 16 }), item.label, item.count > 0 && h("span", { className: `rounded-full px-2 py-1 text-xs ${activeRegisterMode === item.id ? 'bg-white text-blue-800' : 'bg-red-50 text-red-700'}` }, item.count)))
                        )
                    ),
                    h("div", { id: 'register-workbench-panel', role: 'tabpanel', 'aria-labelledby': `register-mode-tab-${activeRegisterMode}` },
                        activeRegisterMode === 'homework' && h(HomeworkPanel, {
                            students: Array.isArray(students) ? students : [], groupsConfig, homeworkSubjects, hwSubject, setHwSubject,
                            homeworkDates, hwDate, setHwDate, hwSelectedIds, setHwSelectedIds,
                            onToggleHomeworkSelection: toggleHomeworkSelection, onSubmit: handleHomeworkSubmit
                        }),
                        activeRegisterMode === 'running' && h(RunningExercisePanel, {
                            students: Array.isArray(students) ? students : [], groupsConfig, runningExerciseDates: homeworkDates,
                            runDate, setRunDate, runSelectedAbsentIds, setRunSelectedAbsentIds,
                            runningExerciseAbsentPenalty: (systemConfig.points || {}).runningExerciseAbsentPenalty,
                            runningExercisePresentBonus: (systemConfig.points || {}).runningExercisePresentBonus,
                            onToggleRunningExerciseSelection: toggleRunningExerciseSelection, onSubmit: handleRunningExerciseSubmit
                        }),
                        activeRegisterMode === 'hygiene' && h(HygienePanel, {
                            students: Array.isArray(students) ? students : [], groupsConfig,
                            sessionName: hygieneSession ? hygieneSession.name : null, date: getTodayStr(),
                            inspectorNames: hygieneInspectorNames, inspectorBonus: hygieneInspectorBonus, areaPenalty: hygieneAreaPenalty,
                            selectedIds: hygieneSelectedIds, setSelectedIds: setHygieneSelectedIds,
                            onToggleSelection: toggleHygieneSelection, onSubmit: handleHygieneSubmit,
                            disabled: !hygieneSession,
                            disabledReason: hygieneSession ? null : "当前非卫生登记时段。请在早读、午练或放学时段登记。"
                        }),
                        activeRegisterMode === 'discipline' && h(DisciplinePanel, {
                            students: Array.isArray(students) ? students : [], groupsConfig, dates: homeworkDates,
                            date: disciplineDate || homeworkDates[1] || homeworkDates[0], setDate: setDisciplineDate,
                            activeTab: disciplineActiveTab, setActiveTab: setDisciplineActiveTab,
                            selectedIds: disciplineSelectedIds, setSelectedIds: setDisciplineSelectedIds,
                            commissionerNames: disciplineCommissionerNamesMap[disciplineActiveTab] || [],
                            commissionerBonus: disciplineConfig[disciplineActiveTab]?.commissionerBonus ?? 1,
                            penalty: disciplineConfig[disciplineActiveTab]?.penalty ?? 1,
                            onToggleSelection: toggleDisciplineSelection, onSubmit: handleDisciplineSubmit, disabled: false
                        })
                    )
                ),
                workspaceSection === 'history' && h("section", { id: 'operations-panel-history', role: 'tabpanel', 'aria-labelledby': 'operations-tab-history' },
                    h(OperationHistorySection, {
                        students,
                        history,
                        onUndo: handleUndo,
                        embedded: true
                    })
                ),
                h(BatchAdjustModalView, {
                    batchAdjustModal,
                    setBatchAdjustModal,
                    onConfirm: handleBatchConfirm,
                    onUpdateAllValues: updateAllBatchValues,
                    onUpdateStudentValue: updateStudentBatchValue,
                    isPending: operationPending,
                    errorMessage: batchAdjustModal.open && ['error', 'warning'].includes(operationFeedback?.type) ? operationFeedback.message : ''
                }),
                h(Modal, {
                    isOpen: !!operationConfirm,
                    title: operationConfirm?.title || '确认操作',
                    onClose: () => settleOperationConfirmation(false),
                    onConfirm: () => settleOperationConfirmation(true),
                    confirmText: operationConfirm?.confirmText || '确认',
                    type: operationConfirm?.type || 'info'
                },
                    h("p", { className: "whitespace-pre-line text-sm leading-6 text-gray-700" }, operationConfirm?.message || '')
                )
            );
        };
    };
})();
