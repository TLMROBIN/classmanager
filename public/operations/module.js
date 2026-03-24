(function() {
    window.createOperationView = function createOperationView(deps) {
        const {
            h,
            useState,
            useEffect,
            Modal,
            Icon,
            requireAdminAuth,
            getNow,
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
            buildHomeworkConfirmMessage
        } = builders;
        const createOperationHandlers = window.createOperationHandlers;
        const createOperationViews = window.createOperationViews;
        const createOperationSettingsSections = window.createOperationSettingsSections;

        if (
            !h ||
            !useState ||
            !useEffect ||
            !Modal ||
            !Icon ||
            !requireAdminAuth ||
            !getNow ||
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
            !createOperationHandlers ||
            !createOperationViews ||
            !createOperationSettingsSections
        ) {
            throw new Error('OperationView dependencies are missing');
        }

        const {
            SelectionPanel,
            StudentSelectionGrid,
            ReasonToolbar,
            HomeworkPanel,
            RecentHistoryPanel,
            BatchAdjustModalView
        } = createOperationViews({
            h,
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

        return function OperationView({
            students,
            handleWage,
            history,
            handleUndo,
            batchUpdatePoints,
            config,
            setConfig,
            setHistory
        }) {
            const initialUiState = readUiState();
            const [selectedIdsState, setSelectedIdsState] = useState(() => new Set(initialUiState.selectedIds));
            const [filterGroupState, setFilterGroupState] = useState(() => initialUiState.filterGroup);
            const [filterDormState, setFilterDormState] = useState(() => initialUiState.filterDorm);
            const [opTabState, setOpTabState] = useState(() => initialUiState.opTab);
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
            const reasons = getReasonsByType(getReasonsPreset(config), opTabState);
            const subjectsConfig = getSubjectsConfig(config);
            const homeworkSubjects = getHomeworkSubjects(subjectsConfig);
            const studentMap = buildStudentMap(students);
            const historyList = Array.isArray(history) ? history : [];
            const homeworkDates = getHomeworkDates({ getNow, getDateString });

            useEffect(() => {
                setSelectedIds(prev => {
                    const next = sanitizeIdSetByStudents(prev, students);
                    return setsAreEqual(prev, next) ? prev : next;
                });
                setHwSelectedIds(prev => {
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
                handleHomeworkSubmit
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
                setHwSubject
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
                h(ReasonsConfigSection, {
                    config,
                    setConfig
                }),
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
                h(SubjectConfigSection, {
                    students,
                    config,
                    setConfig
                }),
                h(RecentHistoryPanel, {
                    recentHistory,
                    onUndo: handleUndo
                }),
                h(RecordAttributesSection, {
                    history,
                    setHistory,
                    config,
                    setConfig
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
