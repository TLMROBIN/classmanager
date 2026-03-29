(function() {
    window.createOperationViews = function createOperationViews(deps) {
        const {
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
        } = deps || {};

        if (
            !h ||
            !useRef ||
            !Modal ||
            !Icon ||
            !normalizePointScene ||
            !normalizePointCategory ||
            !POINT_SCENES ||
            !POINT_CATEGORIES ||
            !DEFAULT_POINT_SCENE ||
            !DEFAULT_POINT_CATEGORY
        ) {
            throw new Error('Operation views dependencies are missing');
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
        }) => {
            const scrollRef = useRef(null);
            const dragStateRef = useRef({
                active: false,
                startX: 0,
                startScrollLeft: 0,
                moved: false,
                suppressClick: false
            });

            const beginDrag = (clientX) => {
                const el = scrollRef.current;
                if (!el) return;
                dragStateRef.current.active = true;
                dragStateRef.current.startX = clientX;
                dragStateRef.current.startScrollLeft = el.scrollLeft;
                dragStateRef.current.moved = false;
            };

            const moveDrag = (clientX) => {
                const el = scrollRef.current;
                const state = dragStateRef.current;
                if (!el || !state.active) return false;
                const deltaX = clientX - state.startX;
                if (Math.abs(deltaX) > 6) {
                    state.moved = true;
                    state.suppressClick = true;
                }
                el.scrollLeft = state.startScrollLeft - deltaX;
                return state.moved;
            };

            const endDrag = () => {
                dragStateRef.current.active = false;
                if (!dragStateRef.current.moved) {
                    dragStateRef.current.suppressClick = false;
                    return;
                }
                setTimeout(() => {
                    dragStateRef.current.suppressClick = false;
                }, 0);
            };

            const handleTouchStart = (event) => {
                const touch = event.touches && event.touches[0];
                if (!touch) return;
                beginDrag(touch.clientX);
            };

            const handleTouchMove = (event) => {
                const touch = event.touches && event.touches[0];
                if (!touch) return;
                if (moveDrag(touch.clientX)) {
                    event.preventDefault();
                }
            };

            const handleTouchEnd = () => {
                endDrag();
            };

            const handleMouseDown = (event) => {
                if (event.button !== 0) return;
                beginDrag(event.clientX);
            };

            const handleMouseMove = (event) => {
                if (!dragStateRef.current.active) return;
                if (moveDrag(event.clientX)) {
                    event.preventDefault();
                }
            };

            const handleMouseUp = () => {
                endDrag();
            };

            const runReasonAction = (callback) => {
                if (dragStateRef.current.suppressClick) return;
                callback();
            };

            return h("div", { className: "bg-white p-4 rounded-xl shadow-sm" },
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
                h("div", {
                    ref: scrollRef,
                    className: "overflow-x-auto scrollbar-hide pb-2 reason-scroll cursor-grab active:cursor-grabbing",
                    onMouseDown: handleMouseDown,
                    onMouseMove: handleMouseMove,
                    onMouseUp: handleMouseUp,
                    onMouseLeave: handleMouseUp,
                    onTouchStart: handleTouchStart,
                    onTouchMove: handleTouchMove,
                    onTouchEnd: handleTouchEnd,
                    onTouchCancel: handleTouchEnd
                },
                    h("div", { className: "flex gap-2 min-w-max" },
                        reasons.map((reason, idx) => h("button", {
                            key: idx,
                            onClick: () => runReasonAction(() => onReasonClick(reason)),
                            className: `flex-shrink-0 px-4 py-3 rounded-xl border text-sm font-medium whitespace-nowrap transition flex flex-col items-center min-w-[100px] ${reason.type === 'bonus' ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'}`
                        },
                            h("span", { className: "font-bold" }, reason.name),
                            h("span", { className: "text-xs opacity-70 mt-1" }, reason.val > 0 ? `+${reason.val}` : reason.val)
                        )),
                        h("button", {
                            onClick: () => runReasonAction(onCustomReason),
                            className: `flex-shrink-0 px-4 py-3 rounded-xl border-2 border-dashed text-sm font-bold whitespace-nowrap transition flex flex-col items-center min-w-[100px] hover:bg-gray-50 ${opTab === 'bonus' ? 'border-green-300 text-green-600' : 'border-red-300 text-red-600'}`
                        },
                            h("span", null, "自定义"),
                            h("span", { className: "text-xs opacity-70 mt-1" }, "输入理由")
                        )
                    )
                )
            );
        };

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

        const RunningExercisePanel = ({
            students,
            runningExerciseDates,
            runDate,
            setRunDate,
            runSelectedAbsentIds,
            setRunSelectedAbsentIds,
            runningExerciseAbsentPenalty,
            runningExercisePresentBonus,
            onToggleRunningExerciseSelection,
            onSubmit
        }) => h("div", { className: "bg-white p-4 rounded-xl shadow-sm" },
            h("h3", { className: "font-bold text-gray-700 mb-4 flex items-center gap-2" }, h(Icon, { name: "tasks" }), "跑操考勤登记"),
            h("div", { className: "flex flex-wrap gap-2 mb-3" },
                runningExerciseDates.map(date => h("button", {
                    key: date,
                    onClick: () => setRunDate(date),
                    className: `px-3 py-1 rounded-full text-xs font-bold border ${((runDate || runningExerciseDates[0]) === date) ? 'bg-orange-600 text-white border-orange-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`
                }, date))
            ),
            h("div", { className: "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 mb-3 leading-5" },
                `缺勤扣分 ${Math.abs(Number(runningExerciseAbsentPenalty) || 0)} 分，正常出勤加分 ${Math.abs(Number(runningExercisePresentBonus) || 0)} 分。填 0 的一侧将不会记分。`
            ),
            h("div", { className: "flex justify-between items-center mb-2" },
                h("div", { className: "text-sm text-gray-600" }, "选择缺勤学生"),
                h("div", { className: "flex gap-2" },
                    h("button", { onClick: () => setRunSelectedAbsentIds(new Set()), className: "text-xs text-gray-500" }, "清空"),
                    h("button", {
                        onClick: () => setRunSelectedAbsentIds(new Set(students.map(student => student.id))),
                        className: "text-xs text-blue-600"
                    }, "全选缺勤")
                )
            ),
            h("div", { className: "grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-56 overflow-y-auto border rounded p-2" },
                students.map(student => {
                    const chosen = runSelectedAbsentIds.has(student.id);
                    return h("button", {
                        key: student.id,
                        onClick: () => onToggleRunningExerciseSelection(student.id),
                        className: `px-2 py-1 rounded text-xs border ${chosen ? 'bg-red-50 border-red-400 text-red-700' : 'bg-white border-gray-200 text-gray-700'}`
                    }, student.name);
                })
            ),
            h("div", { className: "pt-3 flex justify-end gap-2" },
                h("button", {
                    onClick: onSubmit,
                    className: "px-4 py-2 rounded bg-orange-600 text-white text-sm hover:bg-orange-700"
                }, runSelectedAbsentIds.size === 0 ? "提交跑操登记（全员出勤）" : `提交跑操登记 (${runSelectedAbsentIds.size}人缺勤)`)
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

        return {
            SelectionPanel,
            StudentSelectionGrid,
            ReasonToolbar,
            HomeworkPanel,
            RunningExercisePanel,
            RecentHistoryPanel,
            BatchAdjustModalView
        };
    };
})();
