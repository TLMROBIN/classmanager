(function() {
    window.createOperationViews = function createOperationViews(deps) {
        const {
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
        } = deps || {};

        if (
            !h ||
            !useState ||
            !useEffect ||
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
            onHandleWage,
            wagePending = false
        }) => h("div", { className: "bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap gap-4 items-center justify-between" },
            h("div", { className: "flex gap-2 items-center" },
                h(Icon, { name: "filter", className: "text-gray-400" }),
                h("select", {
                    className: "min-h-11 border rounded-lg px-3 py-2 text-sm",
                    'aria-label': '按小组筛选学生',
                    value: filterGroup,
                    onChange: e => setFilterGroup(e.target.value)
                },
                    h("option", { value: "all" }, "所有小组"),
                    Object.entries(groupsConfig).map(([key, value]) => h("option", { key, value: key }, value.name))
                ),
                h("select", {
                    className: "min-h-11 border rounded-lg px-3 py-2 text-sm",
                    'aria-label': '按宿舍筛选学生',
                    value: filterDorm,
                    onChange: e => setFilterDorm(e.target.value)
                },
                    h("option", { value: "all" }, "所有宿舍"),
                    Object.entries(dormsConfig).map(([key, value]) => h("option", { key, value: key }, value))
                )
            ),
            h("div", { className: "flex gap-2" },
                h("button", { onClick: onToggleSelectAll, className: "min-h-11 px-3 text-blue-700 text-sm font-bold" },
                    allFilteredSelected && filteredStudents.length > 0 ? "取消全选" : "全选当前"
                ),
                h("button", {
                    onClick: onHandleWage,
                    disabled: wagePending,
                    'aria-busy': wagePending ? 'true' : undefined,
                    className: "min-h-11 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-60"
                }, h(Icon, { name: "money", size: 16 }), wagePending ? "正在保存…" : "一键工资")
            )
        );

        const StudentSelectionGrid = ({ filteredStudents, selectedIds, groupsConfig, onToggleSelection }) => h("div", {
            className: "grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3"
        },
            filteredStudents.map(student => {
                const isSelected = selectedIds.has(student.id);
                const groupName = groupsConfig[student.group]?.name || student.group;
                return h("button", {
                    key: student.id,
                    onClick: () => onToggleSelection(student.id),
                    'aria-pressed': isSelected,
                    'aria-label': `${student.name}，${groupName}，${isSelected ? '已选择' : '未选择'}`,
                    className: `min-h-[56px] w-full p-3 rounded-lg border-2 transition relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-400'}`
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
            const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });
            const dragStateRef = useRef({
                active: false,
                startX: 0,
                startScrollLeft: 0,
                moved: false,
                suppressClick: false
            });

            const updateScrollState = () => {
                const el = scrollRef.current;
                if (!el) return;
                const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
                const nextState = {
                    canScrollLeft: el.scrollLeft > 2,
                    canScrollRight: el.scrollLeft < maxScrollLeft - 2
                };
                setScrollState(current => (
                    current.canScrollLeft === nextState.canScrollLeft && current.canScrollRight === nextState.canScrollRight
                        ? current
                        : nextState
                ));
            };

            useEffect(() => {
                const el = scrollRef.current;
                if (!el) return undefined;
                updateScrollState();
                el.addEventListener('scroll', updateScrollState, { passive: true });
                const resizeObserver = typeof ResizeObserver === 'function'
                    ? new ResizeObserver(updateScrollState)
                    : null;
                resizeObserver?.observe(el);
                window.addEventListener('resize', updateScrollState);
                return () => {
                    el.removeEventListener('scroll', updateScrollState);
                    resizeObserver?.disconnect();
                    window.removeEventListener('resize', updateScrollState);
                };
            }, [reasons.length]);

            const scrollReasons = (direction) => {
                const el = scrollRef.current;
                if (!el) return;
                el.scrollBy({ left: direction * Math.max(220, el.clientWidth * 0.7), behavior: 'smooth' });
            };

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

            return h("div", { className: "bg-white p-4 rounded-xl border border-gray-200" },
                h("div", { className: "flex flex-wrap items-center justify-between gap-3 mb-4" },
                    h("div", { className: "flex items-center gap-3" },
                        h("span", { className: "font-bold text-gray-700" }, `已选 ${selectedCount} 人`),
                        selectedCount === 0 && h("span", { className: "text-xs text-gray-400" }, "请选择学生后操作")
                    ),
                    h("div", { className: "flex items-center gap-2" },
                        h("div", { className: "flex bg-gray-100 p-1 rounded-lg" },
                            h("button", {
                                onClick: () => setOpTab('bonus'),
                                'aria-pressed': opTab === 'bonus',
                                className: `min-h-11 px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-1 ${opTab === 'bonus' ? 'bg-white text-green-700 shadow-sm ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-800'}`
                            }, h(Icon, { name: "plus", size: 14 }), "奖励"),
                            h("button", {
                                onClick: () => setOpTab('penalty'),
                                'aria-pressed': opTab === 'penalty',
                                className: `min-h-11 px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-1 ${opTab === 'penalty' ? 'bg-white text-red-700 shadow-sm ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-800'}`
                            }, h(Icon, { name: "minus", size: 14 }), "扣分")
                        ),
                        h("button", { onClick: onClearSelection, className: "min-h-11 text-gray-600 hover:text-gray-800 px-3" }, "清空")
                    )
                ),
                (scrollState.canScrollLeft || scrollState.canScrollRight) && h("div", {
                    className: "mb-2 flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-xs text-blue-800"
                },
                    h("span", { className: "px-1" }, "左右浏览更多积分理由"),
                    h("div", { className: "flex gap-1", role: "group", 'aria-label': "浏览积分理由" },
                        h("button", {
                            type: "button",
                            onClick: () => scrollReasons(-1),
                            disabled: !scrollState.canScrollLeft,
                            className: "min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-35",
                            'aria-label': "向左浏览更多积分理由"
                        }, h(Icon, { name: "arrowLeft", size: 18 })),
                        h("button", {
                            type: "button",
                            onClick: () => scrollReasons(1),
                            disabled: !scrollState.canScrollRight,
                            className: "min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-35",
                            'aria-label': "向右浏览更多积分理由"
                        }, h(Icon, { name: "arrowRight", size: 18 }))
                    )
                ),
                h("div", {
                    ref: scrollRef,
                    className: "overflow-x-auto pb-2 reason-scroll cursor-grab active:cursor-grabbing",
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
                            className: `flex-shrink-0 min-h-[56px] px-4 py-3 rounded-xl border text-sm font-medium whitespace-nowrap transition flex flex-col items-center min-w-[100px] ${reason.type === 'bonus' ? 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100' : 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'}`
                        },
                            h("span", { className: "font-bold" }, reason.name),
                            h("span", { className: "text-xs opacity-70 mt-1" }, reason.val > 0 ? `+${reason.val}` : reason.val)
                        )),
                        h("button", {
                            onClick: () => runReasonAction(onCustomReason),
                            className: `flex-shrink-0 min-h-[56px] px-4 py-3 rounded-xl border-2 border-dashed text-sm font-bold whitespace-nowrap transition flex flex-col items-center min-w-[100px] hover:bg-gray-50 ${opTab === 'bonus' ? 'border-green-300 text-green-700' : 'border-red-300 text-red-700'}`
                        },
                            h("span", null, "自定义"),
                            h("span", { className: "text-xs opacity-70 mt-1" }, "输入理由")
                        )
                    )
                )
            );
        };

        const RegisterStudentPicker = ({
            students,
            groupsConfig,
            selectedIds,
            setSelectedIds,
            onToggleSelection,
            selectionLabel,
            selectAllLabel,
            submitTargetId,
            disabled = false
        }) => {
            const INITIAL_VISIBLE_STUDENT_COUNT = 24;
            const [query, setQuery] = useState('');
            const [groupFilter, setGroupFilter] = useState('all');
            const [showSelectedOnly, setShowSelectedOnly] = useState(false);
            const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE_STUDENT_COUNT);
            const safeStudents = Array.isArray(students) ? students : [];
            const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
            const groupIds = Array.from(new Set(safeStudents.map(student => student.group).filter(Boolean)));
            const selectedStudents = safeStudents.filter(student => selectedIds.has(student.id));
            const visibleStudents = safeStudents.filter(student => {
                const matchesQuery = !normalizedQuery || String(student?.name || '').toLocaleLowerCase('zh-CN').includes(normalizedQuery);
                const matchesGroup = groupFilter === 'all' || String(student?.group || '') === groupFilter;
                const matchesSelected = !showSelectedOnly || selectedIds.has(student.id);
                return matchesQuery && matchesGroup && matchesSelected;
            });
            const displayedStudents = visibleStudents.slice(0, visibleLimit);
            const remainingStudentCount = Math.max(0, visibleStudents.length - displayedStudents.length);
            const allVisibleSelected = visibleStudents.length > 0 && visibleStudents.every(student => selectedIds.has(student.id));
            const selectedOnlyButtonClass = showSelectedOnly
                ? 'border-blue-700 bg-blue-700 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50';
            const selectedSummary = selectedStudents.length <= 6
                ? selectedStudents.map(student => student.name).join('、')
                : `${selectedStudents.slice(0, 6).map(student => student.name).join('、')} 等 ${selectedStudents.length} 人`;

            useEffect(() => {
                setVisibleLimit(INITIAL_VISIBLE_STUDENT_COUNT);
            }, [normalizedQuery, groupFilter, showSelectedOnly]);

            const selectVisible = () => {
                setSelectedIds(previous => {
                    const next = new Set(previous);
                    visibleStudents.forEach(student => {
                        if (allVisibleSelected) next.delete(student.id);
                        else next.add(student.id);
                    });
                    return next;
                });
            };
            const jumpToSubmit = () => {
                if (!submitTargetId || typeof document === 'undefined') return;
                const submitButton = document.getElementById(submitTargetId);
                submitButton?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                submitButton?.focus({ preventScroll: true });
            };

            return h("div", { className: "space-y-3" },
                h("div", { className: "flex flex-col gap-2 sm:flex-row" },
                    h("label", { className: "flex-1 text-sm font-medium text-gray-700" },
                        "查找学生",
                        h("input", {
                            type: 'search',
                            value: query,
                            onChange: event => setQuery(event.target.value),
                            placeholder: '输入姓名中的任意文字',
                            disabled,
                            className: "mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        })
                    ),
                    h("label", { className: "text-sm font-medium text-gray-700 sm:w-40" },
                        "按小组筛选",
                        h("select", {
                            value: groupFilter,
                            onChange: event => setGroupFilter(event.target.value),
                            disabled,
                            className: "mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        },
                            h("option", { value: 'all' }, "全部小组"),
                            groupIds.map(groupId => h("option", { key: groupId, value: groupId }, groupsConfig?.[groupId]?.name || groupId))
                        )
                    ),
                    h("button", {
                        type: 'button',
                        onClick: () => setShowSelectedOnly(previous => !previous),
                        disabled,
                        'aria-pressed': showSelectedOnly,
                        className: `min-h-11 self-end rounded-lg border px-3 py-2 text-sm font-medium ${selectedOnlyButtonClass}`
                    }, `仅看已选 (${selectedIds.size})`)
                ),
                selectedStudents.length > 0 && h("div", {
                    className: "flex flex-col gap-2 rounded-lg bg-gray-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between",
                    role: 'status',
                    'aria-live': 'polite'
                },
                    h("div", { className: "min-w-0 text-sm text-gray-700" },
                        h("span", { className: "font-medium text-gray-900" }, "已选："),
                        h("span", null, selectedSummary)
                    ),
                    submitTargetId && h("button", {
                        type: 'button',
                        onClick: jumpToSubmit,
                        className: "min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                    }, "前往提交")
                ),
                h("div", { className: "flex flex-wrap items-center justify-between gap-2" },
                    h("div", { className: "text-sm font-medium text-gray-700", role: 'status', 'aria-live': 'polite' },
                        `${selectionLabel} · 已选 ${selectedIds.size} 人 · 匹配 ${visibleStudents.length} 人 · 已显示 ${displayedStudents.length} 人`
                    ),
                    h("div", { className: "flex gap-2" },
                        h("button", {
                            type: 'button',
                            onClick: () => setSelectedIds(new Set()),
                            disabled: disabled || selectedIds.size === 0,
                            className: "min-h-11 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        }, "清空已选"),
                        h("button", {
                            type: 'button',
                            onClick: selectVisible,
                            disabled: disabled || visibleStudents.length === 0,
                            className: "min-h-11 rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                        }, allVisibleSelected ? "取消当前范围" : `${selectAllLabel} (${visibleStudents.length})`)
                    )
                ),
                visibleStudents.length === 0
                    ? h("div", { className: "rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700" },
                        showSelectedOnly && selectedIds.size === 0
                            ? "还没有选择学生。关闭“仅看已选”后可继续选择。"
                            : "当前筛选没有匹配学生，请调整姓名或小组。"
                    )
                    : h("div", { className: "register-student-grid grid max-h-64 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-2 md:grid-cols-5 lg:grid-cols-6" },
                        displayedStudents.map(student => {
                            const chosen = selectedIds.has(student.id);
                            const studentButtonStateClass = chosen
                                ? 'border-red-500 bg-red-50 font-medium text-red-800'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-400';
                            return h("button", {
                                key: student.id,
                                type: 'button',
                                onClick: () => !disabled && onToggleSelection(student.id),
                                disabled,
                                'aria-pressed': chosen,
                                'aria-label': `${student.name}，${chosen ? '已选择' : '未选择'}`,
                                className: `min-h-11 rounded-lg border px-2 py-2 text-sm ${studentButtonStateClass}`
                            }, student.name);
                        }),
                        remainingStudentCount > 0 && h("button", {
                            type: 'button',
                            onClick: () => setVisibleLimit(previous => previous + INITIAL_VISIBLE_STUDENT_COUNT),
                            className: "col-span-full min-h-11 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-blue-700 hover:border-blue-400 hover:bg-blue-50"
                        }, `继续显示 (${remainingStudentCount} 人)`),
                        visibleLimit > INITIAL_VISIBLE_STUDENT_COUNT && remainingStudentCount === 0 && h("button", {
                            type: 'button',
                            onClick: () => setVisibleLimit(INITIAL_VISIBLE_STUDENT_COUNT),
                            className: "col-span-full min-h-11 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        }, "收起名单")
                    )
            );
        };

        const ContextOptionButton = ({ active, onClick, children }) => {
            const stateClassName = active
                ? 'border-blue-700 bg-blue-700 text-white'
                : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-blue-400';
            return h("button", {
                type: 'button',
                onClick,
                'aria-pressed': active,
                className: `min-h-11 rounded-lg border px-3 py-2 text-sm font-medium ${stateClassName}`
            }, children);
        };

        const HomeworkPanel = ({
            students, groupsConfig, homeworkSubjects, hwSubject, setHwSubject, homeworkDates, hwDate, setHwDate,
            hwSelectedIds, setHwSelectedIds, onToggleHomeworkSelection, onSubmit
        }) => h("div", { className: "space-y-4 rounded-xl border border-gray-200 bg-white p-4" },
            h("div", null,
                h("h3", { className: "flex items-center gap-2 text-base font-bold text-gray-900" }, h(Icon, { name: "book" }), "作业登记"),
                h("p", { className: "mt-1 text-sm text-gray-600" }, "选择学科和日期，再标记未交作业的学生。未选任何人表示全员已交。")
            ),
            h("div", { className: "space-y-3" },
                h("div", null,
                    h("div", { className: "mb-2 text-sm font-medium text-gray-700" }, "学科"),
                    h("div", { className: "flex flex-wrap gap-2" }, homeworkSubjects.map(subject => h(ContextOptionButton, { key: subject, active: hwSubject === subject, onClick: () => setHwSubject(subject) }, subject)))
                ),
                h("div", null,
                    h("div", { className: "mb-2 text-sm font-medium text-gray-700" }, "登记日期"),
                    h("div", { className: "flex flex-wrap gap-2" }, homeworkDates.map(date => h(ContextOptionButton, { key: date, active: (hwDate || homeworkDates[0]) === date, onClick: () => setHwDate(date) }, date)))
                )
            ),
            h(RegisterStudentPicker, {
                students, groupsConfig, selectedIds: hwSelectedIds, setSelectedIds: setHwSelectedIds,
                onToggleSelection: onToggleHomeworkSelection, selectionLabel: "未交学生", selectAllLabel: "全选当前范围",
                submitTargetId: 'homework-register-submit'
            }),
            h("div", { className: "flex justify-end border-t border-gray-200 pt-4" },
                h("button", { id: 'homework-register-submit', onClick: onSubmit, className: "min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800" },
                    hwSelectedIds.size === 0 ? "提交作业登记（全员已交）" : `提交未交记录 (${hwSelectedIds.size} 人)`
                )
            )
        );

        const RunningExercisePanel = ({
            students, groupsConfig, runningExerciseDates, runDate, setRunDate, runSelectedAbsentIds, setRunSelectedAbsentIds,
            runningExerciseAbsentPenalty, runningExercisePresentBonus, onToggleRunningExerciseSelection, onSubmit
        }) => h("div", { className: "space-y-4 rounded-xl border border-gray-200 bg-white p-4" },
            h("div", null,
                h("h3", { className: "flex items-center gap-2 text-base font-bold text-gray-900" }, h(Icon, { name: "tasks" }), "跑操考勤登记"),
                h("p", { className: "mt-1 text-sm text-gray-600" }, "只选择缺勤学生；未选任何人表示全员正常出勤。")
            ),
            h("div", null,
                h("div", { className: "mb-2 text-sm font-medium text-gray-700" }, "登记日期"),
                h("div", { className: "flex flex-wrap gap-2" }, runningExerciseDates.map(date => h(ContextOptionButton, { key: date, active: (runDate || runningExerciseDates[0]) === date, onClick: () => setRunDate(date) }, date)))
            ),
            h("div", { className: "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900" },
                `提交后，缺勤学生每人扣 ${Math.abs(Number(runningExerciseAbsentPenalty) || 0)} 分；其余学生每人加 ${Math.abs(Number(runningExercisePresentBonus) || 0)} 分。`
            ),
            h(RegisterStudentPicker, {
                students, groupsConfig, selectedIds: runSelectedAbsentIds, setSelectedIds: setRunSelectedAbsentIds,
                onToggleSelection: onToggleRunningExerciseSelection, selectionLabel: "缺勤学生", selectAllLabel: "全选当前范围",
                submitTargetId: 'running-register-submit'
            }),
            h("div", { className: "flex justify-end border-t border-gray-200 pt-4" },
                h("button", { id: 'running-register-submit', onClick: onSubmit, className: "min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800" },
                    runSelectedAbsentIds.size === 0 ? "提交跑操登记（全员出勤）" : `提交跑操登记 (${runSelectedAbsentIds.size} 人缺勤)`
                )
            )
        );

        const HygienePanel = ({
            students, groupsConfig, date, sessionName, inspectorNames, inspectorBonus, areaPenalty,
            selectedIds, setSelectedIds, onToggleSelection, onSubmit, disabled, disabledReason
        }) => {
            const inspectorList = Array.isArray(inspectorNames) ? inspectorNames.filter(Boolean) : [];
            const inspectorText = inspectorList.length > 0
                ? `当日卫生专员 ${inspectorList.join('、')} 每人加 ${inspectorBonus ?? 1} 分。`
                : "尚未设置当日卫生专员，本次不会发放专员奖励。";
            return h("div", { className: `space-y-4 rounded-xl border border-gray-200 bg-white p-4 ${disabled ? 'opacity-70' : ''}` },
                h("div", null,
                    h("h3", { className: "flex items-center gap-2 text-base font-bold text-gray-900" }, h(Icon, { name: "droplet" }), "卫生登记"),
                    h("p", { className: "mt-1 text-sm text-gray-600" }, "选择卫生不合格学生；未选任何人表示本时段无问题。")
                ),
                h("div", { className: "rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm leading-6 text-blue-900" },
                    h("div", { className: "font-medium" }, [date, sessionName || "时段判定中"].filter(Boolean).join(' · ')),
                    h("div", null, `提交后，所选学生每人扣 ${Math.abs(Number(areaPenalty) || 0)} 分。${inspectorText}`)
                ),
                disabled && disabledReason && h("div", { className: "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" }, disabledReason),
                h(RegisterStudentPicker, {
                    students, groupsConfig, selectedIds, setSelectedIds, onToggleSelection,
                    selectionLabel: "卫生不合格学生", selectAllLabel: "全选当前范围",
                    submitTargetId: 'hygiene-register-submit', disabled
                }),
                h("div", { className: "flex justify-end border-t border-gray-200 pt-4" },
                    h("button", {
                        id: 'hygiene-register-submit',
                        onClick: onSubmit,
                        disabled,
                        className: "min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                    }, selectedIds.size === 0 ? "提交卫生登记（本时段无问题）" : `提交卫生登记 (${selectedIds.size} 人不合格)`)
                )
            );
        };

        const DisciplinePanel = ({
            students, groupsConfig, dates, date, setDate, activeTab, setActiveTab, selectedIds, setSelectedIds,
            commissionerNames, commissionerBonus, penalty, onToggleSelection, onSubmit, disabled
        }) => {
            const tabs = [
                { key: 'noise', label: '讲话', fullLabel: '学习时间讲话', commissionerRole: '噪音专员' },
                { key: 'desk', label: '桌面', fullLabel: '桌面杂乱', commissionerRole: '书桌专员' },
                { key: 'tablet', label: '平板', fullLabel: '平板未归', commissionerRole: '平板专员' },
                { key: 'outdoor', label: '外出', fullLabel: '晚自习外出', commissionerRole: '外出专员' }
            ];
            const currentTab = tabs.find(tab => tab.key === activeTab) || tabs[0];
            const commissionerList = Array.isArray(commissionerNames) ? commissionerNames.filter(Boolean) : [];
            const commissionerText = commissionerList.length > 0
                ? `${currentTab.commissionerRole} ${commissionerList.join('、')} 每人加 ${commissionerBonus ?? 1} 分。`
                : `尚未设置${currentTab.commissionerRole}，本次不会发放专员奖励。`;
            return h("div", { className: `space-y-4 rounded-xl border border-gray-200 bg-white p-4 ${disabled ? 'opacity-70' : ''}` },
                h("div", null,
                    h("h3", { className: "flex items-center gap-2 text-base font-bold text-gray-900" }, h(Icon, { name: "shield" }), "纪律登记"),
                    h("p", { className: "mt-1 text-sm text-gray-600" }, "选择违反当前纪律项的学生；切换纪律项会保留其他登记草稿。")
                ),
                h("div", { className: "space-y-3" },
                    h("div", null,
                        h("div", { className: "mb-2 text-sm font-medium text-gray-700" }, "登记日期"),
                        h("div", { className: "flex flex-wrap gap-2" }, dates.map(itemDate => h(ContextOptionButton, { key: itemDate, active: (date || dates[0]) === itemDate, onClick: () => setDate(itemDate) }, itemDate)))
                    ),
                    h("div", null,
                        h("div", { className: "mb-2 text-sm font-medium text-gray-700" }, "纪律项"),
                        h("div", { className: "flex flex-wrap gap-2" }, tabs.map(tab => h(ContextOptionButton, { key: tab.key, active: activeTab === tab.key, onClick: () => setActiveTab(tab.key) }, tab.label)))
                    )
                ),
                h("div", { className: "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900" },
                    `提交“${currentTab.fullLabel}”后，所选学生每人扣 ${Math.abs(Number(penalty) || 0)} 分；${commissionerText}`
                ),
                h(RegisterStudentPicker, {
                    students, groupsConfig, selectedIds, setSelectedIds, onToggleSelection,
                    selectionLabel: `${currentTab.fullLabel}学生`, selectAllLabel: "全选当前范围",
                    submitTargetId: 'discipline-register-submit', disabled
                }),
                h("div", { className: "flex justify-end border-t border-gray-200 pt-4" },
                    h("button", {
                        id: 'discipline-register-submit',
                        onClick: onSubmit,
                        disabled,
                        className: "min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                    }, selectedIds.size === 0 ? `提交${currentTab.fullLabel}登记（无人违规）` : `提交${currentTab.fullLabel}登记 (${selectedIds.size} 人)`)
                )
            );
        };

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
            onUpdateStudentValue,
            isPending = false,
            errorMessage = ''
        }) => h(Modal, {
            isOpen: batchAdjustModal.open,
            title: batchAdjustModal.isCustom ? "自定义批量操作" : `批量调整: ${batchAdjustModal.reason?.name}`,
            onClose: () => setBatchAdjustModal(prev => ({ ...prev, open: false })),
            onConfirm,
            confirmText: isPending ? "正在保存…" : "确认应用",
            confirmDisabled: isPending,
            confirmBusy: isPending,
            dismissDisabled: isPending,
            type: batchAdjustModal.type === 'penalty' ? 'danger' : 'info'
        },
            h("div", { className: "space-y-4" },
                errorMessage && h("div", {
                    role: 'alert',
                    className: "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                }, errorMessage),
                batchAdjustModal.isCustom && h("div", null,
                    h("label", { className: "block text-sm font-bold text-gray-700 mb-1", htmlFor: 'batch-adjust-reason' }, "理由名称"),
                    h("input", {
                        id: 'batch-adjust-reason',
                        type: "text",
                        className: "w-full border rounded p-2",
                        placeholder: "例如: 好人好事",
                        value: batchAdjustModal.customReasonName,
                        onChange: e => setBatchAdjustModal(prev => ({ ...prev, customReasonName: e.target.value }))
                    })
                ),
                h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
                    h("div", null,
                        h("label", { className: "block text-sm font-bold text-gray-700 mb-1", htmlFor: 'batch-adjust-scene' }, "场景"),
                        h("select", {
                            id: 'batch-adjust-scene',
                            'aria-describedby': 'batch-adjust-scene-help',
                            className: "min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2",
                            value: batchAdjustModal.scene || DEFAULT_POINT_SCENE,
                            onChange: e => setBatchAdjustModal(prev => ({ ...prev, scene: e.target.value }))
                        }, POINT_SCENES.map(scene => h("option", { key: scene, value: scene }, scene))),
                        h("p", { id: 'batch-adjust-scene-help', className: "mt-1 text-sm text-gray-600" }, "记录事情发生在哪里，例如课堂、班级或宿舍。")
                    ),
                    h("div", null,
                        h("label", { className: "block text-sm font-bold text-gray-700 mb-1", htmlFor: 'batch-adjust-category' }, "类别"),
                        h("select", {
                            id: 'batch-adjust-category',
                            'aria-describedby': 'batch-adjust-category-help',
                            className: "min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2",
                            value: batchAdjustModal.category || DEFAULT_POINT_CATEGORY,
                            onChange: e => setBatchAdjustModal(prev => ({ ...prev, category: e.target.value }))
                        }, POINT_CATEGORIES.map(category => h("option", { key: category, value: category }, category))),
                        h("p", { id: 'batch-adjust-category-help', className: "mt-1 text-sm text-gray-600" }, "用于历史筛选和统计，例如学习、纪律或班务。")
                    )
                ),
                h("div", { className: "bg-gray-50 p-3 rounded-lg" },
                    h("label", { className: "block text-sm font-bold text-gray-700 mb-2", htmlFor: 'batch-adjust-all-values' },
                        `统一调整 (${batchAdjustModal.isMulti ? '次数' : '分值'})`
                    ),
                    h("div", { className: "flex items-center gap-4" },
                        h("input", {
                            id: 'batch-adjust-all-values',
                            type: "range",
                            min: "0",
                            max: batchAdjustModal.isMulti ? "20" : "50",
                            step: batchAdjustModal.isMulti ? "1" : "0.5",
                            className: "w-full min-h-11 accent-blue-600",
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
                                        'aria-label': `${student.name} 的${batchAdjustModal.isMulti ? '次数' : '分值'}`,
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
            HygienePanel,
            DisciplinePanel,
            RecentHistoryPanel,
            BatchAdjustModalView
        };
    };
})();
