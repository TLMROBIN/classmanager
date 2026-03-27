(function() {
    window.createOperationHistorySection = function createOperationHistorySection(deps) {
        const {
            h,
            useState,
            Icon,
            requireAdminAuth,
            normalizePointScene,
            normalizePointCategory
        } = deps || {};

        if (
            !h ||
            !useState ||
            !Icon ||
            !requireAdminAuth ||
            !normalizePointScene ||
            !normalizePointCategory
        ) {
            throw new Error('Operation history section dependencies are missing');
        }

        const TYPE_LABELS = {
            bonus: '奖励',
            penalty: '扣分',
            spending: '消费'
        };

        const formatDateKey = (ts) => {
            const target = new Date(ts);
            if (isNaN(target.getTime())) return '';
            const year = target.getFullYear();
            const month = String(target.getMonth() + 1).padStart(2, '0');
            const day = String(target.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const formatDateTime = (ts) => {
            const target = new Date(ts);
            return isNaN(target.getTime()) ? '-' : target.toLocaleString();
        };

        const getRecordTypeLabel = (item) => {
            if (item?.isUndoLog) return '撤销';
            return TYPE_LABELS[item?.type] || (Number(item?.val) < 0 ? '扣减' : '增加');
        };

        const getRecordTypeClassName = (item) => {
            if (item?.isUndoLog) return 'bg-gray-100 text-gray-600';
            if (item?.type === 'penalty') return 'bg-red-50 text-red-600';
            if (item?.type === 'spending') return 'bg-amber-50 text-amber-700';
            return 'bg-green-50 text-green-600';
        };

        const buildStudentOptions = (students, historyList) => {
            const nameMap = new Map();
            (Array.isArray(students) ? students : []).forEach(student => {
                const name = typeof student?.name === 'string' ? student.name.trim() : '';
                if (name) nameMap.set(name, name);
            });
            (Array.isArray(historyList) ? historyList : []).forEach(item => {
                const name = typeof item?.studentName === 'string' ? item.studentName.trim() : '';
                if (name) nameMap.set(name, name);
            });
            return Array.from(nameMap.values()).sort((a, b) => a.localeCompare(b, 'zh-CN'));
        };

        return function OperationHistorySection({
            students,
            history,
            onUndo,
            embedded = false
        }) {
            const [isOpen, setIsOpen] = useState(false);
            const [startDate, setStartDate] = useState('');
            const [endDate, setEndDate] = useState('');
            const [studentName, setStudentName] = useState('');
            const [showUndoLogs, setShowUndoLogs] = useState(false);

            const historyList = Array.isArray(history) ? history : [];
            const isVisible = isOpen;
            const hasInvalidDateRange = !!(startDate && endDate && startDate > endDate);
            const studentOptions = isVisible ? buildStudentOptions(students, historyList) : [];
            const filteredHistoryRecords = !isVisible || hasInvalidDateRange
                ? []
                : historyList.filter(item => {
                    if (!item) return false;
                    if (!showUndoLogs && item.isUndoLog) return false;
                    if (studentName && item.studentName !== studentName) return false;
                    const dateKey = formatDateKey(item.ts);
                    if (startDate && (!dateKey || dateKey < startDate)) return false;
                    if (endDate && (!dateKey || dateKey > endDate)) return false;
                    return true;
                });
            const visibleHistoryRecords = filteredHistoryRecords.slice(0, 300);

            const toggleSection = async () => {
                if (isOpen) {
                    setIsOpen(false);
                    return;
                }
                if (embedded) {
                    setIsOpen(true);
                    return;
                }
                if (!await requireAdminAuth('请输入维护密码以打开积分变动历史：')) return;
                setIsOpen(true);
            };

            const resetFilters = () => {
                setStartDate('');
                setEndDate('');
                setStudentName('');
                setShowUndoLogs(false);
            };

            return h('div', { className: 'bg-white p-4 rounded-xl shadow-sm border space-y-4' },
                h('div', { className: 'flex flex-col gap-3 md:flex-row md:items-center md:justify-between' },
                    h('div', { className: 'space-y-1' },
                        h('div', { className: 'flex items-center gap-2 text-gray-800' },
                            h(Icon, { name: 'history', size: 18 }),
                            h('h3', { className: 'font-bold text-sm' }, '积分变动历史')
                        ),
                        h('p', { className: 'text-xs text-gray-500' }, '按日期和学生筛选积分记录，并直接在这里撤销错误变动。')
                    ),
                    h('button', {
                        onClick: toggleSection,
                        className: `px-3 py-2 rounded-lg text-sm font-medium ${isOpen ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                    }, isOpen ? '收起积分变动历史' : '打开积分变动历史')
                ),
                isVisible && h('div', { className: 'bg-gray-50 border rounded-lg p-4 space-y-3 border-t pt-4' },
                    h('div', { className: 'flex flex-wrap items-center justify-between gap-3' },
                        h('div', null,
                            h('div', { className: 'font-bold text-gray-700 text-sm' }, '积分变动历史'),
                            h('div', { className: 'text-xs text-gray-500 mt-1' }, `共 ${filteredHistoryRecords.length} 条，当前展示 ${visibleHistoryRecords.length} 条`)
                        ),
                        h('div', { className: 'flex flex-wrap gap-2' },
                            h('label', { className: 'flex items-center gap-2 px-3 py-1 bg-white border rounded text-xs text-gray-600' },
                                h('input', {
                                    type: 'checkbox',
                                    checked: showUndoLogs,
                                    onChange: e => setShowUndoLogs(e.target.checked)
                                }),
                                '显示撤销日志'
                            ),
                            h('button', {
                                onClick: resetFilters,
                                className: 'px-3 py-1 bg-white border rounded text-xs hover:bg-gray-100'
                            }, '清空筛选')
                        )
                    ),
                    h('div', { className: 'grid grid-cols-1 md:grid-cols-4 gap-2' },
                        h('label', { className: 'space-y-1' },
                            h('span', { className: 'block text-xs text-gray-500' }, '开始日期'),
                            h('input', {
                                type: 'date',
                                className: 'w-full border rounded p-2 text-sm',
                                value: startDate,
                                onChange: e => setStartDate(e.target.value)
                            })
                        ),
                        h('label', { className: 'space-y-1' },
                            h('span', { className: 'block text-xs text-gray-500' }, '结束日期'),
                            h('input', {
                                type: 'date',
                                className: 'w-full border rounded p-2 text-sm',
                                value: endDate,
                                onChange: e => setEndDate(e.target.value)
                            })
                        ),
                        h('label', { className: 'space-y-1 md:col-span-2' },
                            h('span', { className: 'block text-xs text-gray-500' }, '学生'),
                            h('select', {
                                className: 'w-full border rounded p-2 text-sm',
                                value: studentName,
                                onChange: e => setStudentName(e.target.value)
                            },
                                h('option', { value: '' }, '全部学生'),
                                studentOptions.map(name => h('option', {
                                    key: name,
                                    value: name
                                }, name))
                            )
                        )
                    ),
                    hasInvalidDateRange && h('div', { className: 'rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700' }, '结束日期不能早于开始日期。'),
                    h('div', { className: 'max-h-96 overflow-y-auto border rounded bg-white' },
                        h('table', { className: 'w-full text-xs text-left' },
                            h('thead', { className: 'bg-gray-50 sticky top-0' },
                                h('tr', null,
                                    h('th', { className: 'p-2' }, '时间'),
                                    h('th', { className: 'p-2' }, '学生'),
                                    h('th', { className: 'p-2' }, '事项'),
                                    h('th', { className: 'p-2' }, '类型'),
                                    h('th', { className: 'p-2' }, '场景'),
                                    h('th', { className: 'p-2' }, '类别'),
                                    h('th', { className: 'p-2 text-right' }, '变动'),
                                    h('th', { className: 'p-2 text-center' }, '操作')
                                )
                            ),
                            h('tbody', { className: 'divide-y' },
                                visibleHistoryRecords.length === 0
                                    ? h('tr', null, h('td', { colSpan: 8, className: 'p-4 text-center text-gray-400' }, hasInvalidDateRange ? '日期范围无效' : '暂无匹配记录'))
                                    : visibleHistoryRecords.map(item => h('tr', {
                                        key: item.id,
                                        className: 'hover:bg-gray-50'
                                    },
                                    h('td', { className: 'p-2 text-gray-400 whitespace-nowrap' }, formatDateTime(item.ts)),
                                    h('td', { className: 'p-2 font-medium whitespace-nowrap' }, item.studentName || '-'),
                                    h('td', { className: 'p-2 text-gray-600 min-w-[180px]' }, item.reason || '-'),
                                    h('td', { className: 'p-2' },
                                        h('span', {
                                            className: `inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${getRecordTypeClassName(item)}`
                                        }, getRecordTypeLabel(item))
                                    ),
                                    h('td', { className: 'p-2 text-gray-500 whitespace-nowrap' }, normalizePointScene(item.scene)),
                                    h('td', { className: 'p-2 text-gray-500 whitespace-nowrap' }, normalizePointCategory(item.category)),
                                    h('td', { className: `p-2 text-right font-bold whitespace-nowrap ${item.val > 0 ? 'text-green-600' : 'text-red-500'}` }, item.val > 0 ? `+${item.val}` : item.val),
                                    h('td', { className: 'p-2 text-center' },
                                        item.isUndoLog
                                            ? h('span', { className: 'text-gray-300' }, '-')
                                            : h('button', {
                                                onClick: () => typeof onUndo === 'function' && onUndo(item.id),
                                                className: 'text-blue-500 hover:underline'
                                            }, '撤销')
                                    )
                                ))
                            )
                        )
                    ),
                    filteredHistoryRecords.length > visibleHistoryRecords.length && h('div', { className: 'text-xs text-gray-400' }, `结果过多，仅显示最新 ${visibleHistoryRecords.length} 条，请继续缩小筛选范围。`)
                )
            );
        };
    };
})();
