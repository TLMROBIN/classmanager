(function() {
    window.createSettingsBehaviorAlertSection = function createSettingsBehaviorAlertSection(deps) {
        const {
            h,
            useState,
            useEffect,
            useMemo,
            Icon,
            normalizePointScene,
            normalizePointCategory,
            POINT_SCENES,
            POINT_CATEGORIES,
            getNow,
            getDateString
        } = deps || {};

        if (
            !h || !useState || !useEffect || !useMemo || !Icon ||
            !normalizePointScene || !normalizePointCategory ||
            !POINT_SCENES || !POINT_CATEGORIES || !getNow || !getDateString
        ) {
            throw new Error('BehaviorAlertSection dependencies are missing');
        }

        const SCENE_OPTIONS = POINT_SCENES;
        const CATEGORY_OPTIONS = POINT_CATEGORIES.filter(c => c !== '待定');
        const WEEK_TOP_N = 5;
        const MONTH_TOP_N = 10;

        const formatNumber = (n) => Number.isFinite(n) ? n.toFixed(n % 1 === 0 ? 0 : 1) : '0';
        const formatDateTime = (ts) => {
            const d = new Date(ts);
            return isNaN(d.getTime()) ? '-' : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };

        const getWeekRange = (now) => {
            const d = new Date(now);
            const day = d.getDay();
            const distToMon = day === 0 ? 6 : day - 1;
            const start = new Date(d);
            start.setDate(d.getDate() - distToMon);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        };

        const getMonthRange = (now) => {
            const d = new Date(now);
            const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            return { start, end };
        };

        const getPreviousMonthRange = (now) => {
            const d = new Date(now);
            const start = new Date(d.getFullYear(), d.getMonth() - 1, 1, 0, 0, 0, 0);
            const end = new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999);
            return { start, end };
        };

        const isInRange = (ts, range) => ts >= range.start.getTime() && ts <= range.end.getTime();

        const buildDailyTrendData = (records, range) => {
            const days = [];
            const cur = new Date(range.start);
            while (cur <= range.end) {
                days.push(getDateString(new Date(cur)));
                cur.setDate(cur.getDate() + 1);
            }
            const map = new Map();
            records.forEach(r => {
                const dk = getDateString(new Date(r.ts));
                map.set(dk, (map.get(dk) || 0) + 1);
            });
            return days.map(d => ({ date: d, count: map.get(d) || 0 }));
        };

        const TrendChart = ({ data, maxCount }) => {
            if (!data || data.length === 0) return null;
            const width = 600;
            const height = 180;
            const padding = { top: 10, right: 10, bottom: 30, left: 30 };
            const chartW = width - padding.left - padding.right;
            const chartH = height - padding.top - padding.bottom;
            const maxVal = Math.max(1, maxCount, ...data.map(d => d.count));

            const xFor = (i) => padding.left + (i / Math.max(1, data.length - 1)) * chartW;
            const yFor = (v) => padding.top + chartH - (v / maxVal) * chartH;

            const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(d.count)}`).join(' ');
            const areaD = `${pathD} L ${xFor(data.length - 1)} ${yFor(0)} L ${xFor(0)} ${yFor(0)} Z`;

            const labelIndices = [];
            const step = Math.ceil(data.length / 6);
            for (let i = 0; i < data.length; i += step) labelIndices.push(i);
            if (labelIndices[labelIndices.length - 1] !== data.length - 1) labelIndices.push(data.length - 1);

            return h('div', { className: 'w-full overflow-x-auto' },
                h('svg', { viewBox: `0 0 ${width} ${height}`, className: 'w-full', style: { minWidth: '320px' } },
                    h('defs', null,
                        h('linearGradient', { id: 'trendArea', x1: '0', y1: '0', x2: '0', y2: '1' },
                            h('stop', { offset: '0%', stopColor: '#ef4444', stopOpacity: 0.2 }),
                            h('stop', { offset: '100%', stopColor: '#ef4444', stopOpacity: 0 })
                        )
                    ),
                    [0, 0.25, 0.5, 0.75, 1].map(t =>
                        h('line', {
                            key: `grid-${t}`,
                            x1: padding.left,
                            y1: yFor(maxVal * (1 - t)),
                            x2: width - padding.right,
                            y2: yFor(maxVal * (1 - t)),
                            stroke: '#e5e7eb',
                            strokeWidth: 1
                        })
                    ),
                    h('path', { d: areaD, fill: 'url(#trendArea)' }),
                    h('path', {
                        d: pathD,
                        fill: 'none',
                        stroke: '#ef4444',
                        strokeWidth: 2,
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round'
                    }),
                    data.map((d, i) =>
                        h('circle', {
                            key: `pt-${i}`,
                            cx: xFor(i),
                            cy: yFor(d.count),
                            r: d.count > 0 ? 3 : 2,
                            fill: d.count > 0 ? '#ef4444' : '#d1d5db'
                        })
                    ),
                    labelIndices.map(i =>
                        h('text', {
                            key: `xl-${i}`,
                            x: xFor(i),
                            y: height - 6,
                            textAnchor: 'middle',
                            fontSize: 10,
                            fill: '#6b7280'
                        }, data[i].date.slice(5))
                    ),
                    [0, maxVal].map((v, i) =>
                        h('text', {
                            key: `yl-${i}`,
                            x: padding.left - 6,
                            y: yFor(v) + 4,
                            textAnchor: 'end',
                            fontSize: 10,
                            fill: '#6b7280'
                        }, String(Math.round(v)))
                    )
                )
            );
        };

        const DetailPanel = ({ records, studentName, onClose }) => {
            if (!records || records.length === 0) return null;
            const sorted = [...records].sort((a, b) => b.ts - a.ts);
            return h('div', { className: 'border rounded-lg p-4 bg-white space-y-3' },
                h('div', { className: 'flex items-center justify-between' },
                    h('div', { className: 'text-sm font-medium text-gray-700' }, `「${studentName}」扣分明细（${records.length}条）`),
                    h('button', {
                        onClick: onClose,
                        className: 'text-xs text-gray-400 hover:text-gray-600'
                    }, '关闭')
                ),
                h('div', { className: 'overflow-x-auto' },
                    h('table', { className: 'w-full text-xs border-collapse' },
                        h('thead', null,
                            h('tr', { className: 'text-left text-gray-500 border-b' },
                                h('th', { className: 'py-1.5 px-2 font-medium' }, '时间'),
                                h('th', { className: 'py-1.5 px-2 font-medium' }, '原因'),
                                h('th', { className: 'py-1.5 px-2 font-medium text-right' }, '分值'),
                                h('th', { className: 'py-1.5 px-2 font-medium' }, '场景'),
                                h('th', { className: 'py-1.5 px-2 font-medium' }, '类别')
                            )
                        ),
                        h('tbody', null,
                            sorted.map((item, idx) =>
                                h('tr', {
                                    key: `${item.id || idx}-${item.ts}`,
                                    className: 'border-b last:border-b-0 hover:bg-gray-50'
                                },
                                    h('td', { className: 'py-1.5 px-2 text-gray-500 whitespace-nowrap' }, formatDateTime(item.ts)),
                                    h('td', { className: 'py-1.5 px-2 text-gray-700' }, item.reason || '-'),
                                    h('td', { className: 'py-1.5 px-2 text-right font-medium text-red-600' }, String(item.val)),
                                    h('td', { className: 'py-1.5 px-2 text-gray-500' }, normalizePointScene(item.scene)),
                                    h('td', { className: 'py-1.5 px-2 text-gray-500' }, normalizePointCategory(item.category))
                                )
                            )
                        )
                    )
                )
            );
        };

        return function renderBehaviorAlertSection(props) {
            const { students, history } = props || {};
            const [isOpen, setIsOpen] = useState(false);
            const [activeTab, setActiveTab] = useState('week');
            const [selectedScenes, setSelectedScenes] = useState(new Set(SCENE_OPTIONS));
            const [selectedCategories, setSelectedCategories] = useState(new Set(CATEGORY_OPTIONS));
            const [trendStudentId, setTrendStudentId] = useState(null);
            const [detailStudentId, setDetailStudentId] = useState(null);

            const historyList = useMemo(() => (Array.isArray(history) ? history : []), [history]);
            const studentMap = useMemo(() => {
                const map = new Map();
                (Array.isArray(students) ? students : []).forEach(s => map.set(String(s.id), s));
                return map;
            }, [students]);

            const penaltyRecords = useMemo(() => {
                return historyList.filter(item => {
                    if (!item) return false;
                    if (item.isUndoLog) return false;
                    if (item.type !== 'penalty') return false;
                    const val = Number(item.val);
                    if (!Number.isFinite(val) || val >= 0) return false;
                    const scene = normalizePointScene(item.scene);
                    const category = normalizePointCategory(item.category);
                    return selectedScenes.has(scene) && selectedCategories.has(category);
                });
            }, [historyList, selectedScenes, selectedCategories]);

            const now = getNow();
            const weekRange = useMemo(() => getWeekRange(now), [now]);
            const monthRange = useMemo(() => getMonthRange(now), [now]);
            const previousMonthRange = useMemo(() => getPreviousMonthRange(now), [now]);

            const weekRecords = useMemo(() => penaltyRecords.filter(r => isInRange(r.ts, weekRange)), [penaltyRecords, weekRange]);
            const monthRecords = useMemo(() => penaltyRecords.filter(r => isInRange(r.ts, monthRange)), [penaltyRecords, monthRange]);

            const buildRanking = (records) => {
                const byStudent = new Map();
                records.forEach(r => {
                    const sid = String(r.studentId);
                    const entry = byStudent.get(sid) || { studentId: sid, studentName: r.studentName || '未知', count: 0, total: 0 };
                    entry.count += 1;
                    entry.total += Math.abs(Number(r.val) || 0);
                    byStudent.set(sid, entry);
                });
                return Array.from(byStudent.values())
                    .sort((a, b) => b.total - a.total || b.count - a.count);
            };

            const weekRankingFull = useMemo(() => buildRanking(weekRecords), [weekRecords]);
            const monthRankingFull = useMemo(() => buildRanking(monthRecords), [monthRecords]);
            const weekRanking = useMemo(() => weekRankingFull.slice(0, WEEK_TOP_N), [weekRankingFull]);
            const monthRanking = useMemo(() => monthRankingFull.slice(0, MONTH_TOP_N), [monthRankingFull]);

            const currentRanking = activeTab === 'week' ? weekRanking : monthRanking;
            const currentRecords = activeTab === 'week' ? weekRecords : monthRecords;
            const currentRange = activeTab === 'week' ? weekRange : monthRange;

            const detailRecords = useMemo(() => {
                if (!detailStudentId) return [];
                return currentRecords.filter(r => String(r.studentId) === String(detailStudentId));
            }, [detailStudentId, currentRecords]);

            const detailStudentName = detailStudentId
                ? (studentMap.get(String(detailStudentId))?.name || currentRanking.find(r => String(r.studentId) === String(detailStudentId))?.studentName || '未知')
                : '';

            const trendData = useMemo(() => {
                if (!trendStudentId || activeTab !== 'month') return null;
                const recs = penaltyRecords.filter(r => String(r.studentId) === String(trendStudentId) && isInRange(r.ts, previousMonthRange));
                return buildDailyTrendData(recs, previousMonthRange);
            }, [trendStudentId, activeTab, penaltyRecords, previousMonthRange]);

            const trendStudentName = trendStudentId
                ? (studentMap.get(String(trendStudentId))?.name || monthRankingFull.find(r => String(r.studentId) === String(trendStudentId))?.studentName || '未知')
                : '';
            const trendMaxCount = useMemo(() => {
                if (!trendData || trendData.length === 0) return 0;
                return Math.max(...trendData.map(d => d.count));
            }, [trendData]);

            const toggleScene = (scene) => {
                setSelectedScenes(prev => {
                    const next = new Set(prev);
                    if (next.has(scene)) {
                        if (next.size > 1) next.delete(scene);
                    } else {
                        next.add(scene);
                    }
                    return next;
                });
            };

            const toggleCategory = (category) => {
                setSelectedCategories(prev => {
                    const next = new Set(prev);
                    if (next.has(category)) {
                        if (next.size > 1) next.delete(category);
                    } else {
                        next.add(category);
                    }
                    return next;
                });
            };

            const handleTabChange = (tab) => {
                setActiveTab(tab);
                setTrendStudentId(null);
                setDetailStudentId(null);
            };

            return h('div', { className: 'bg-white p-4 rounded-xl shadow-sm border space-y-4' },
                h('div', { className: 'flex flex-col gap-3 md:flex-row md:items-center md:justify-between' },
                    h('div', { className: 'space-y-1' },
                        h('div', { className: 'flex items-center gap-2 text-gray-800' },
                            h(Icon, { name: 'alert', size: 18 }),
                            h('h3', { className: 'font-bold text-sm' }, '异常行为预警')
                        ),
                        h('p', { className: 'text-xs text-gray-500' }, '统计扣分行为较多的同学，支持按场景和类别筛选。')
                    ),
                    h('button', {
                        onClick: () => setIsOpen(prev => !prev),
                        className: `px-3 py-2 rounded-lg text-sm font-medium ${isOpen ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                    }, isOpen ? '收起异常行为预警' : '打开异常行为预警')
                ),
                isOpen && h('div', { className: 'bg-gray-50 border rounded-lg p-4 space-y-4 border-t pt-4' },
                    // Filters
                    h('div', { className: 'space-y-3' },
                        h('div', { className: 'flex flex-wrap items-center gap-2' },
                            h('span', { className: 'text-xs font-medium text-gray-600' }, '场景：'),
                            SCENE_OPTIONS.map(scene =>
                                h('button', {
                                    key: scene,
                                    onClick: () => toggleScene(scene),
                                    className: `px-2 py-1 rounded text-xs border transition ${selectedScenes.has(scene) ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`
                                }, scene)
                            )
                        ),
                        h('div', { className: 'flex flex-wrap items-center gap-2' },
                            h('span', { className: 'text-xs font-medium text-gray-600' }, '类别：'),
                            CATEGORY_OPTIONS.map(category =>
                                h('button', {
                                    key: category,
                                    onClick: () => toggleCategory(category),
                                    className: `px-2 py-1 rounded text-xs border transition ${selectedCategories.has(category) ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`
                                }, category)
                            )
                        )
                    ),
                    // Tabs
                    h('div', { className: 'flex gap-2' },
                        h('button', {
                            onClick: () => handleTabChange('week'),
                            className: `px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'week' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`
                        }, `周榜 TOP${WEEK_TOP_N}`),
                        h('button', {
                            onClick: () => handleTabChange('month'),
                            className: `px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'month' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`
                        }, `月榜 TOP${MONTH_TOP_N}`)
                    ),
                    // Summary
                    h('div', { className: 'text-xs text-gray-500' },
                        activeTab === 'week'
                            ? `本周共 ${weekRecords.length} 条扣分记录，涉及 ${weekRankingFull.length} 位同学，展示前 ${WEEK_TOP_N} 名。`
                            : `本月共 ${monthRecords.length} 条扣分记录，涉及 ${monthRankingFull.length} 位同学，展示前 ${MONTH_TOP_N} 名。`
                    ),
                    // Ranking table
                    currentRanking.length === 0
                        ? h('div', { className: 'text-sm text-gray-400 text-center py-6' }, '暂无符合条件的扣分记录')
                        : h('div', { className: 'overflow-x-auto' },
                            h('table', { className: 'w-full text-sm border-collapse' },
                                h('thead', null,
                                    h('tr', { className: 'text-left text-xs text-gray-500 border-b' },
                                        h('th', { className: 'py-2 px-3 font-medium' }, '排名'),
                                        h('th', { className: 'py-2 px-3 font-medium' }, '姓名'),
                                        h('th', { className: 'py-2 px-3 font-medium text-right' }, '扣分次数'),
                                        h('th', { className: 'py-2 px-3 font-medium text-right' }, '扣分总分'),
                                        h('th', { className: 'py-2 px-3 font-medium text-center' }, '操作')
                                    )
                                ),
                                h('tbody', null,
                                    currentRanking.map((item, idx) =>
                                        h('tr', {
                                            key: item.studentId,
                                            className: `border-b last:border-b-0 hover:bg-gray-50 ${idx < 3 ? 'bg-red-50/40' : ''}`
                                        },
                                            h('td', { className: 'py-2 px-3' },
                                                idx < 3
                                                    ? h('span', { className: 'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white', style: { background: idx === 0 ? '#ef4444' : idx === 1 ? '#f97316' : '#eab308' } }, String(idx + 1))
                                                    : h('span', { className: 'text-xs text-gray-500 ml-1' }, String(idx + 1))
                                            ),
                                            h('td', { className: 'py-2 px-3 font-medium text-gray-700' }, item.studentName),
                                            h('td', { className: 'py-2 px-3 text-right text-gray-600' }, item.count),
                                            h('td', { className: 'py-2 px-3 text-right font-medium text-red-600' }, formatNumber(item.total)),
                                            h('td', { className: 'py-2 px-3 text-center' },
                                                h('div', { className: 'flex items-center justify-center gap-2' },
                                                    h('button', {
                                                        onClick: () => setDetailStudentId(prev => prev === item.studentId ? null : item.studentId),
                                                        className: `text-xs px-2 py-1 rounded border transition ${detailStudentId === item.studentId ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`
                                                    }, detailStudentId === item.studentId ? '收起明细' : '明细'),
                                                    activeTab === 'month' && h('button', {
                                                        onClick: () => setTrendStudentId(prev => prev === item.studentId ? null : item.studentId),
                                                        className: `text-xs px-2 py-1 rounded border transition ${trendStudentId === item.studentId ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`
                                                    }, trendStudentId === item.studentId ? '隐藏趋势' : '趋势')
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        ),
                    // Detail panel
                    detailStudentId && detailRecords.length > 0 && h(DetailPanel, {
                        records: detailRecords,
                        studentName: detailStudentName,
                        onClose: () => setDetailStudentId(null)
                    }),
                    // Trend chart for month tab
                    activeTab === 'month' && trendStudentId && trendData && h('div', { className: 'border rounded-lg p-4 bg-white space-y-2' },
                        h('div', { className: 'flex items-center justify-between' },
                            h('div', { className: 'text-sm font-medium text-gray-700' }, `「${trendStudentName}」上月扣分趋势`),
                            h('button', {
                                onClick: () => setTrendStudentId(null),
                                className: 'text-xs text-gray-400 hover:text-gray-600'
                            }, '关闭')
                        ),
                        h('div', { className: 'text-xs text-gray-500' }, `统计周期：${getDateString(previousMonthRange.start)} ~ ${getDateString(previousMonthRange.end)}，共 ${trendData.reduce((s, d) => s + d.count, 0)} 次扣分`),
                        h(TrendChart, { data: trendData, maxCount: trendMaxCount })
                    )
                )
            );
        };
    };
})();
