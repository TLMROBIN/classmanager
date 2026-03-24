(function() {
    const DEFAULT_UI_STATE = {
        selectedIds: [],
        filterGroup: 'all',
        filterDorm: 'all',
        opTab: 'bonus'
    };

    const getUiStore = () => {
        if (!window.__CM_OPERATIONS_UI_STATE__ || typeof window.__CM_OPERATIONS_UI_STATE__ !== 'object') {
            window.__CM_OPERATIONS_UI_STATE__ = { ...DEFAULT_UI_STATE };
        }
        return window.__CM_OPERATIONS_UI_STATE__;
    };

    const readUiState = () => {
        const store = getUiStore();
        return {
            selectedIds: Array.isArray(store.selectedIds) ? store.selectedIds : DEFAULT_UI_STATE.selectedIds,
            filterGroup: typeof store.filterGroup === 'string' && store.filterGroup ? store.filterGroup : DEFAULT_UI_STATE.filterGroup,
            filterDorm: typeof store.filterDorm === 'string' && store.filterDorm ? store.filterDorm : DEFAULT_UI_STATE.filterDorm,
            opTab: store.opTab === 'penalty' ? 'penalty' : DEFAULT_UI_STATE.opTab
        };
    };

    const writeUiState = (patch) => {
        window.__CM_OPERATIONS_UI_STATE__ = {
            ...readUiState(),
            ...(patch || {})
        };
    };

    const setsAreEqual = (left, right) => {
        if (left.size !== right.size) return false;
        for (const value of left) {
            if (!right.has(value)) return false;
        }
        return true;
    };

    const buildStudentMap = (students) => {
        const map = new Map();
        (Array.isArray(students) ? students : []).forEach(student => {
            map.set(String(student.id), student);
        });
        return map;
    };

    const parseNumericInput = (value) => {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    window.createOperationView = function createOperationView(deps) {
        const {
            h,
            useState,
            useEffect,
            Modal,
            Icon,
            getNow,
            getDateString,
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

        if (
            !h ||
            !useState ||
            !useEffect ||
            !Modal ||
            !Icon ||
            !getNow ||
            !getDateString ||
            !getGroupsConfig ||
            !getDormsConfig ||
            !getReasonsPreset ||
            !getSubjectsConfig ||
            !normalizePointScene ||
            !normalizePointCategory ||
            !POINT_SCENES ||
            !POINT_CATEGORIES ||
            !DEFAULT_POINT_SCENE ||
            !DEFAULT_POINT_CATEGORY
        ) {
            throw new Error('OperationView dependencies are missing');
        }

        const SelectionPanel = ({
            filterGroup,
            setFilterGroup,
            filterDorm,
            setFilterDorm,
            groupsConfig,
            dormsConfig,
            filteredStudents,
            allFilteredSelected,
            onToggleSelectAll,
            onHandleWage
        }) => h("div", { className: "bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-center justify-between" },
            h("div", { className: "flex gap-2 items-center" },
                h(Icon, { name: "filter", className: "text-gray-400" }),
                h("select", {
                    className: "border rounded p-2 text-sm",
                    value: filterGroup,
                    onChange: e => setFilterGroup(e.target.value)
                },
                    h("option", { value: "all" }, "所有小组"),
                    Object.entries(groupsConfig).map(([key, value]) => h("option", { key, value: key }, value.name))
                ),
                h("select", {
                    className: "border rounded p-2 text-sm",
                    value: filterDorm,
                    onChange: e => setFilterDorm(e.target.value)
                },
                    h("option", { value: "all" }, "所有宿舍"),
                    Object.entries(dormsConfig).map(([key, value]) => h("option", { key, value: key }, value))
                )
            ),
            h("div", { className: "flex gap-2" },
                h("button", { onClick: onToggleSelectAll, className: "text-blue-600 text-sm font-bold" },
                    allFilteredSelected && filteredStudents.length > 0 ? "取消全选" : "全选当前"
                ),
                h("button", {
                    onClick: onHandleWage,
                    className: "bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                }, h(Icon, { name: "money", size: 16 }), "一键工资")
            )
        );

        const StudentSelectionGrid = ({ filteredStudents, selectedIds, groupsConfig, onToggleSelection }) => h("div", {
            className: "grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3"
        },
            filteredStudents.map(student => {
                const isSelected = selectedIds.has(student.id);
                const groupName = groupsConfig[student.group]?.name || student.group;
                return h("div", {
                    key: student.id,
                    onClick: () => onToggleSelection(student.id),
                    className: `cursor-pointer p-3 rounded-lg border-2 transition relative overflow-hidden ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-white hover:shadow-md'}`
                },
                    isSelected && h("div", { className: "absolute top-1 right-1 text-blue-500" }, h(Icon, { name: "check", size: 16 })),
                    h("div", { className: "text-center" },
                        h("div", { className: "font-bold text-gray-800" }, student.name),
                        h("div", { className: "text-xs text-gray-400 mt-1" }, groupName.split(' ')[1] || groupName)
                    )
                );
            })
        );

        const ReasonToolbar = ({
            selectedCount,
            opTab,
            setOpTab,
            onClearSelection,
            reasons,
            onReasonClick,
            onCustomReason
        }) => h("div", { className: "bg-white p-4 rounded-xl shadow-sm" },
            h("div", { className: "flex flex-wrap items-center justify-between gap-3 mb-4" },
                h("div", { className: "flex items-center gap-3" },
                    h("span", { className: "font-bold text-gray-700" }, `已选 ${selectedCount} 人`),
                    selectedCount === 0 && h("span", { className: "text-xs text-gray-400" }, "请选择学生后操作")
                ),
                h("div", { className: "flex items-center gap-2" },
                    h("div", { className: "flex bg-gray-100 p-1 rounded-lg" },
                        h("button", {
                            onClick: () => setOpTab('bonus'),
                            className: `px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-1 ${opTab === 'bonus' ? 'bg-white text-green-600 shadow ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`
                        }, h(Icon, { name: "plus", size: 14 }), "奖励"),
                        h("button", {
                            onClick: () => setOpTab('penalty'),
                            className: `px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-1 ${opTab === 'penalty' ? 'bg-white text-red-600 shadow ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`
                        }, h(Icon, { name: "minus", size: 14 }), "扣分")
                    ),
                    h("button", { onClick: onClearSelection, className: "text-gray-400 hover:text-gray-600 px-2" }, "清空")
                )
            ),
            h("div", { className: "flex gap-2 overflow-x-auto scrollbar-hide pb-2" },
                reasons.map((reason, idx) => h("button", {
                    key: idx,
                    onClick: () => onReasonClick(reason),
                    className: `flex-shrink-0 px-4 py-3 rounded-xl border text-sm font-medium whitespace-nowrap transition flex flex-col items-center min-w-[100px] ${reason.type === 'bonus' ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'}`
                },
                    h("span", { className: "font-bold" }, reason.name),
                    h("span", { className: "text-xs opacity-70 mt-1" }, reason.val > 0 ? `+${reason.val}` : reason.val)
                )),
                h("button", {
                    onClick: onCustomReason,
                    className: `flex-shrink-0 px-4 py-3 rounded-xl border-2 border-dashed text-sm font-bold whitespace-nowrap transition flex flex-col items-center min-w-[100px] hover:bg-gray-50 ${opTab === 'bonus' ? 'border-green-300 text-green-600' : 'border-red-300 text-red-600'}`
                },
                    h("span", null, "自定义"),
                    h("span", { className: "text-xs opacity-70 mt-1" }, "输入理由")
                )
            )
        );

        const HomeworkPanel = ({
            students,
            homeworkSubjects,
            hwSubject,
            setHwSubject,
            homeworkDates,
            hwDate,
            setHwDate,
            hwSelectedIds,
            setHwSelectedIds,
            onToggleHomeworkSelection,
            onSubmit
        }) => h("div", { className: "bg-white p-4 rounded-xl shadow-sm" },
            h("h3", { className: "font-bold text-gray-700 mb-4 flex items-center gap-2" }, h(Icon, { name: "book" }), "作业登记"),
            h("div", { className: "flex flex-wrap gap-2 mb-3" },
                homeworkSubjects.map(subject => h("button", {
                    key: subject,
                    onClick: () => setHwSubject(subject),
                    className: `px-3 py-1 rounded-full text-xs font-bold border ${hwSubject === subject ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`
                }, subject))
            ),
            h("div", { className: "flex flex-wrap gap-2 mb-3" },
                homeworkDates.map(date => h("button", {
                    key: date,
                    onClick: () => setHwDate(date),
                    className: `px-3 py-1 rounded-full text-xs font-bold border ${((hwDate || homeworkDates[0]) === date) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`
                }, date))
            ),
            h("div", { className: "flex justify-between items-center mb-2" },
                h("div", { className: "text-sm text-gray-600" }, "选择未交学生"),
                h("div", { className: "flex gap-2" },
                    h("button", { onClick: () => setHwSelectedIds(new Set()), className: "text-xs text-gray-500" }, "清空"),
                    h("button", {
                        onClick: () => setHwSelectedIds(new Set(students.map(student => student.id))),
                        className: "text-xs text-blue-600"
                    }, "全选")
                )
            ),
            h("div", { className: "grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-56 overflow-y-auto border rounded p-2" },
                students.map(student => {
                    const chosen = hwSelectedIds.has(student.id);
                    return h("button", {
                        key: student.id,
                        onClick: () => onToggleHomeworkSelection(student.id),
                        className: `px-2 py-1 rounded text-xs border ${chosen ? 'bg-red-50 border-red-400 text-red-700' : 'bg-white border-gray-200 text-gray-700'}`
                    }, student.name);
                })
            ),
            h("div", { className: "pt-3 flex justify-end gap-2" },
                h("button", {
                    onClick: onSubmit,
                    className: "px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700"
                }, hwSelectedIds.size === 0 ? "提交（无人未交）" : `提交未交记录 (${hwSelectedIds.size}人)`)
            )
        );

        const RecentHistoryPanel = ({ recentHistory, onUndo }) => h("div", {
            className: "bg-white p-4 rounded-xl shadow-sm mt-6"
        },
            h("h3", { className: "font-bold text-gray-700 mb-4 flex items-center gap-2" }, h(Icon, { name: "history" }), "积分变动记录 (最近50条)"),
            h("div", { className: "max-h-60 overflow-y-auto border rounded-lg" },
                h("table", { className: "w-full text-sm text-left" },
                    h("thead", { className: "bg-gray-50 sticky top-0" },
                        h("tr", null,
                            h("th", { className: "p-2 font-medium text-gray-500" }, "时间"),
                            h("th", { className: "p-2 font-medium text-gray-500" }, "学生"),
                            h("th", { className: "p-2 font-medium text-gray-500" }, "事项"),
                            h("th", { className: "p-2 font-medium text-gray-500" }, "场景"),
                            h("th", { className: "p-2 font-medium text-gray-500" }, "类别"),
                            h("th", { className: "p-2 font-medium text-gray-500" }, "变动"),
                            h("th", { className: "p-2 font-medium text-gray-500" }, "操作")
                        )
                    ),
                    h("tbody", { className: "divide-y" },
                        recentHistory.length === 0
                            ? h("tr", null, h("td", { colSpan: 7, className: "p-4 text-center text-gray-400" }, "暂无记录"))
                            : recentHistory.map(item => h("tr", { key: item.id, className: "hover:bg-gray-50" },
                                h("td", { className: "p-2 text-xs text-gray-400" }, new Date(item.ts).toLocaleString()),
                                h("td", { className: "p-2 font-medium" }, item.studentName),
                                h("td", { className: "p-2 text-gray-600" }, item.reason),
                                h("td", { className: "p-2 text-xs text-gray-500" }, normalizePointScene(item.scene)),
                                h("td", { className: "p-2 text-xs text-gray-500" }, normalizePointCategory(item.category)),
                                h("td", { className: `p-2 font-bold ${item.val > 0 ? 'text-green-600' : 'text-red-500'}` }, item.val > 0 ? `+${item.val}` : item.val),
                                h("td", { className: "p-2" },
                                    item.isUndoLog ? null : h("button", {
                                        onClick: () => onUndo(item.id),
                                        className: "text-blue-500 hover:underline text-xs"
                                    }, "撤销")
                                )
                            ))
                    )
                )
            )
        );

        const BatchAdjustModalView = ({
            batchAdjustModal,
            setBatchAdjustModal,
            onConfirm,
            onUpdateAllValues,
            onUpdateStudentValue
        }) => h(Modal, {
            isOpen: batchAdjustModal.open,
            title: batchAdjustModal.isCustom ? "自定义批量操作" : `批量调整: ${batchAdjustModal.reason?.name}`,
            onClose: () => setBatchAdjustModal(prev => ({ ...prev, open: false })),
            onConfirm,
            confirmText: "确认应用",
            type: batchAdjustModal.type === 'penalty' ? 'danger' : 'info'
        },
            h("div", { className: "space-y-4" },
                batchAdjustModal.isCustom && h("div", null,
                    h("label", { className: "block text-sm font-bold text-gray-700 mb-1" }, "理由名称"),
                    h("input", {
                        type: "text",
                        className: "w-full border rounded p-2",
                        placeholder: "例如: 好人好事",
                        value: batchAdjustModal.customReasonName,
                        onChange: e => setBatchAdjustModal(prev => ({ ...prev, customReasonName: e.target.value }))
                    })
                ),
                h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
                    h("div", null,
                        h("label", { className: "block text-sm font-bold text-gray-700 mb-1" }, "场景"),
                        h("select", {
                            className: "w-full border rounded p-2",
                            value: batchAdjustModal.scene || DEFAULT_POINT_SCENE,
                            onChange: e => setBatchAdjustModal(prev => ({ ...prev, scene: e.target.value }))
                        }, POINT_SCENES.map(scene => h("option", { key: scene, value: scene }, scene)))
                    ),
                    h("div", null,
                        h("label", { className: "block text-sm font-bold text-gray-700 mb-1" }, "类别"),
                        h("select", {
                            className: "w-full border rounded p-2",
                            value: batchAdjustModal.category || DEFAULT_POINT_CATEGORY,
                            onChange: e => setBatchAdjustModal(prev => ({ ...prev, category: e.target.value }))
                        }, POINT_CATEGORIES.map(category => h("option", { key: category, value: category }, category)))
                    )
                ),
                h("div", { className: "bg-gray-50 p-3 rounded-lg" },
                    h("label", { className: "block text-sm font-bold text-gray-700 mb-2" },
                        `统一调整 (${batchAdjustModal.isMulti ? '次数' : '分值'})`
                    ),
                    h("div", { className: "flex items-center gap-4" },
                        h("input", {
                            type: "range",
                            min: "0",
                            max: batchAdjustModal.isMulti ? "20" : "50",
                            step: batchAdjustModal.isMulti ? "1" : "0.5",
                            defaultValue: batchAdjustModal.students[0]?.val || 0,
                            onChange: e => onUpdateAllValues(e.target.value)
                        }),
                        h("span", { className: "text-xs text-gray-500" }, "拖动以统一设置")
                    )
                ),
                h("div", { className: "max-h-60 overflow-y-auto border rounded-lg" },
                    h("table", { className: "w-full text-sm" },
                        h("thead", { className: "bg-gray-50 sticky top-0" },
                            h("tr", null,
                                h("th", { className: "p-2 text-left" }, "学生"),
                                h("th", { className: "p-2 text-center" }, batchAdjustModal.isMulti ? `次数 (x${batchAdjustModal.factor})` : "分值")
                            )
                        ),
                        h("tbody", null,
                            batchAdjustModal.students.map(student => h("tr", { key: student.id, className: "border-t" },
                                h("td", { className: "p-2 font-bold" }, student.name),
                                h("td", { className: "p-2 flex items-center justify-center gap-2" },
                                    h("input", {
                                        type: "number",
                                        className: "w-16 border rounded p-1 text-center font-mono font-bold",
                                        value: student.val,
                                        onChange: e => onUpdateStudentValue(student.id, e.target.value)
                                    })
                                )
                            ))
                        )
                    )
                ),
                h("div", { className: `p-2 rounded text-center text-xs font-bold ${batchAdjustModal.type === 'bonus' ? 'text-green-600' : 'text-red-600'}` },
                    batchAdjustModal.type === 'bonus' ? '即将增加积分' : '即将扣除积分'
                )
            )
        );

        return function OperationView({
            students,
            handleWage,
            history,
            handleUndo,
            batchUpdatePoints,
            config
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
            const reasons = getReasonsPreset(config).filter(reason => reason.type === opTabState);
            const subjectsConfig = getSubjectsConfig(config);
            const homeworkSubjects = subjectsConfig.map(subject => subject.name);
            const studentMap = buildStudentMap(students);
            const historyList = Array.isArray(history) ? history : [];
            const homeworkDates = (() => {
                const now = getNow();
                const day = now.getDay();
                const daysToFriday = (5 - day + 7) % 7;
                const friday = new Date(now);
                friday.setDate(now.getDate() + daysToFriday);
                const sunday = new Date(friday);
                sunday.setDate(friday.getDate() - 5);
                const list = [];
                for (let i = 0; i < 6; i++) {
                    const date = new Date(sunday);
                    date.setDate(sunday.getDate() + i);
                    list.push(getDateString(date));
                }
                return list;
            })();

            useEffect(() => {
                const validIdKeys = new Set((Array.isArray(students) ? students : []).map(student => String(student.id)));
                setSelectedIds(prev => {
                    const next = new Set(Array.from(prev).filter(id => validIdKeys.has(String(id))));
                    return setsAreEqual(prev, next) ? prev : next;
                });
                setHwSelectedIds(prev => {
                    const next = new Set(Array.from(prev).filter(id => validIdKeys.has(String(id))));
                    return setsAreEqual(prev, next) ? prev : next;
                });
                if (filterGroupState !== DEFAULT_UI_STATE.filterGroup && !Object.prototype.hasOwnProperty.call(groupsConfig, filterGroupState)) {
                    setFilterGroup(DEFAULT_UI_STATE.filterGroup);
                }
                if (filterDormState !== DEFAULT_UI_STATE.filterDorm && !Object.prototype.hasOwnProperty.call(dormsConfig, filterDormState)) {
                    setFilterDorm(DEFAULT_UI_STATE.filterDorm);
                }
            }, [students, config, filterGroupState, filterDormState]);

            const filteredStudents = (Array.isArray(students) ? students : []).filter(student => {
                if (filterGroupState !== DEFAULT_UI_STATE.filterGroup && student.group !== filterGroupState) return false;
                if (filterDormState !== DEFAULT_UI_STATE.filterDorm && student.dorm !== filterDormState) return false;
                return true;
            });
            const filteredSelectedCount = filteredStudents.reduce((count, student) => (
                selectedIdsState.has(student.id) ? count + 1 : count
            ), 0);
            const allFilteredSelected = filteredStudents.length > 0 && filteredSelectedCount === filteredStudents.length;
            const recentHistory = historyList.slice(0, 50);

            const toggleSelection = (id) => {
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                });
            };

            const toggleSelectAll = () => {
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    if (allFilteredSelected) {
                        filteredStudents.forEach(student => next.delete(student.id));
                    } else {
                        filteredStudents.forEach(student => next.add(student.id));
                    }
                    return next;
                });
            };

            const buildModalStudents = (selectedIds, getInitialValue) => (
                Array.from(selectedIds)
                    .map(id => studentMap.get(String(id)))
                    .filter(Boolean)
                    .map(student => ({
                        id: student.id,
                        name: student.name,
                        val: getInitialValue(student)
                    }))
            );

            const handleReasonClick = (reason) => {
                if (selectedIdsState.size === 0) return alert("请先选择学生");
                const modalStudents = buildModalStudents(selectedIdsState, () => (reason.isMulti ? 1 : Math.abs(reason.val)));
                if (modalStudents.length === 0) return alert("未找到有效的学生选择");
                setBatchAdjustModal({
                    open: true,
                    reason,
                    students: modalStudents,
                    type: opTabState,
                    isMulti: reason.isMulti || false,
                    factor: reason.factor || 1,
                    isCustom: false,
                    customReasonName: "",
                    scene: normalizePointScene(reason.scene),
                    category: normalizePointCategory(reason.category)
                });
            };

            const handleCustomReason = () => {
                if (selectedIdsState.size === 0) return alert("请先选择学生");
                const modalStudents = buildModalStudents(selectedIdsState, () => 0);
                if (modalStudents.length === 0) return alert("未找到有效的学生选择");
                setBatchAdjustModal({
                    open: true,
                    reason: { name: "", custom: true },
                    students: modalStudents,
                    type: opTabState,
                    isMulti: false,
                    factor: 1,
                    isCustom: true,
                    customReasonName: "",
                    scene: "班级",
                    category: "兑奖"
                });
            };

            const updateStudentBatchValue = (id, newVal) => {
                setBatchAdjustModal(prev => ({
                    ...prev,
                    students: prev.students.map(student => (
                        student.id === id ? { ...student, val: parseNumericInput(newVal) } : student
                    ))
                }));
            };

            const updateAllBatchValues = (newVal) => {
                const numericValue = parseNumericInput(newVal);
                setBatchAdjustModal(prev => ({
                    ...prev,
                    students: prev.students.map(student => ({ ...student, val: numericValue }))
                }));
            };

            const handleBatchConfirm = () => {
                if (batchAdjustModal.isCustom && !batchAdjustModal.customReasonName) return alert("请输入理由");
                if (!batchAdjustModal.scene || !batchAdjustModal.category) return alert("请先选择场景与类别");

                const reasonName = batchAdjustModal.isCustom ? batchAdjustModal.customReasonName : batchAdjustModal.reason.name;
                const updates = batchAdjustModal.students.map(student => {
                    let finalVal = Number.isFinite(Number(student.val)) ? Number(student.val) : 0;
                    let finalReason = reasonName;
                    if (batchAdjustModal.isMulti) {
                        finalVal = finalVal * batchAdjustModal.factor;
                        finalReason = reasonName.includes("卫生")
                            ? `${reasonName} x${student.val}`
                            : `${reasonName} (值:${student.val})`;
                    }
                    if (batchAdjustModal.type === 'penalty') finalVal = -Math.abs(finalVal);
                    else finalVal = Math.abs(finalVal);
                    return {
                        id: student.id,
                        val: finalVal,
                        reason: finalReason,
                        type: batchAdjustModal.type,
                        scene: batchAdjustModal.scene,
                        category: batchAdjustModal.category
                    };
                });

                batchUpdatePoints(updates);
                setBatchAdjustModal(prev => ({ ...prev, open: false }));
                setSelectedIds(new Set());
            };

            const toggleHomeworkSelection = (id) => {
                setHwSelectedIds(prev => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                });
            };

            const handleHomeworkSubmit = () => {
                if (!hwSubject) return alert("请选择学科");
                const dateVal = hwDate || homeworkDates[0];
                if (!dateVal) return alert("请选择日期");

                const alreadySubmitted = historyList.some(item => (
                    item.reason && item.reason.includes(`${hwSubject}作业`) && item.reason.includes(dateVal)
                ));
                if (alreadySubmitted) {
                    return alert(`${hwSubject} ${dateVal} 已完成登记，每科每天只能登记一次`);
                }

                const subjectConfig = subjectsConfig.find(subject => subject.name === hwSubject);
                const representatives = subjectConfig?.representatives || [];
                const updates = [];

                if (hwSelectedIds.size > 0) {
                    Array.from(hwSelectedIds).forEach(id => {
                        updates.push({
                            id,
                            val: -1,
                            reason: `${hwSubject}作业未交 ${dateVal}`,
                            type: 'penalty',
                            scene: "班级",
                            category: "学业"
                        });
                    });
                }

                representatives.forEach(repId => {
                    if (!repId || !studentMap.has(String(repId))) return;
                    updates.push({
                        id: repId,
                        val: 1,
                        reason: `${hwSubject}作业登记 ${dateVal}`,
                        type: 'bonus',
                        scene: "班级",
                        category: "班务"
                    });
                });

                if (updates.length === 0) {
                    return alert("没有需要登记的记录。请确保已设置课代表。");
                }

                const repNames = representatives
                    .map(repId => studentMap.get(String(repId))?.name || '')
                    .filter(Boolean)
                    .join('、');

                let confirmMsg = `确认提交 ${hwSubject} ${dateVal} 的作业登记？\n\n`;
                confirmMsg += "⚠️ 提醒：每科每天只能登记一次，请确保无误再提交！\n\n";

                if (hwSelectedIds.size > 0) {
                    const unsubmittedStudents = Array.from(hwSelectedIds)
                        .map(id => studentMap.get(String(id))?.name || '')
                        .filter(Boolean)
                        .join('、');
                    confirmMsg += `未交作业学生 (${hwSelectedIds.size}人)：\n${unsubmittedStudents}\n\n`;
                } else {
                    confirmMsg += "✅ 无学生未交作业\n\n";
                }

                if (repNames) {
                    confirmMsg += `课代表加分：${repNames} (+1分)`;
                }

                if (!confirm(confirmMsg)) return;

                batchUpdatePoints(updates);
                setHwSelectedIds(new Set());
                setHwSubject("");
            };

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
