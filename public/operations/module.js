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
            buildRunningExerciseConfirmMessage
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
            RecentHistoryPanel,
            BatchAdjustModalView
        } = createOperationViews({
            h,
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
            const [settingsOpen, setSettingsOpen] = useState(false);
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
                handleRunningExerciseSubmit
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
                runningExercisePresentBonus: (systemConfig.points || {}).runningExercisePresentBonus
            });

            return h("div", { className: "space-y-6 animate-fade-in" },
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
                    onHandleWage: handleWage
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
                }),
                h("div", { className: "bg-white rounded-xl shadow-sm border p-4 space-y-4" },
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
                            className: `px-3 py-2 rounded-lg text-sm font-medium ${settingsOpen ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
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
                                    className: "px-3 py-2 border border-blue-500 text-blue-600 rounded hover:bg-blue-50 text-sm"
                                }, "导出积分 Excel"),
                                h("button", {
                                    onClick: () => operationAdminTools.fixScore({
                                        students,
                                        applyStudents: onApplyFixedStudents
                                    }),
                                    className: "px-3 py-2 border border-amber-500 text-amber-600 rounded hover:bg-amber-50 text-sm"
                                }, "手动修正积分")
                            )
                        ),
                        h(OperationHistorySection, {
                            students,
                            history,
                            onUndo: handleUndo,
                            embedded: true
                        }),
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
                h(HomeworkPanel, {
                    students: Array.isArray(students) ? students : [],
                    homeworkSubjects,
                    hwSubject,
                    setHwSubject,
                    homeworkDates,
                    hwDate,
                    setHwDate,
                    hwSelectedIds,
                    setHwSelectedIds,
                    onToggleHomeworkSelection: toggleHomeworkSelection,
                    onSubmit: handleHomeworkSubmit
                }),
                h(RunningExercisePanel, {
                    students: Array.isArray(students) ? students : [],
                    runningExerciseDates: homeworkDates,
                    runDate,
                    setRunDate,
                    runSelectedAbsentIds,
                    setRunSelectedAbsentIds,
                    runningExerciseAbsentPenalty: (systemConfig.points || {}).runningExerciseAbsentPenalty,
                    runningExercisePresentBonus: (systemConfig.points || {}).runningExercisePresentBonus,
                    onToggleRunningExerciseSelection: toggleRunningExerciseSelection,
                    onSubmit: handleRunningExerciseSubmit
                }),
                h(RecentHistoryPanel, {
                    recentHistory,
                    onUndo: handleUndo
                }),
                h(BatchAdjustModalView, {
                    batchAdjustModal,
                    setBatchAdjustModal,
                    onConfirm: handleBatchConfirm,
                    onUpdateAllValues: updateAllBatchValues,
                    onUpdateStudentValue: updateStudentBatchValue
                })
            );
        };
    };
})();
