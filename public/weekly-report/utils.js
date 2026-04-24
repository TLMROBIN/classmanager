(function() {
    const CATEGORY_DEFINITIONS = [
        { key: 'runningExercise', title: '跑操' },
        { key: 'homework', title: '作业' },
        { key: 'dormitory', title: '宿舍' },
        { key: 'classAffairs', title: '班务' },
        { key: 'attendance', title: '考勤' },
        { key: 'redemption', title: '消费/兑奖' },
        { key: 'otherRewards', title: '其他奖励' },
        { key: 'otherPenalties', title: '其他扣分' }
    ];

    const CATEGORY_TITLES = CATEGORY_DEFINITIONS.reduce((acc, item) => {
        acc[item.key] = item.title;
        return acc;
    }, {});

    const pad2 = (value) => String(value).padStart(2, '0');

    const toDate = (value) => {
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
        }
        if (typeof value === 'number') {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? null : date;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return null;
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                const parts = trimmed.split('-').map((part) => Number(part));
                const date = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                return Number.isNaN(date.getTime()) ? null : date;
            }
            const date = new Date(trimmed);
            return Number.isNaN(date.getTime()) ? null : date;
        }
        return null;
    };

    const getDateKey = (value) => {
        const date = toDate(value);
        if (!date) return '';
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    };

    const getWeekRange = (baseDate, offsetWeeks = 0) => {
        const anchor = toDate(baseDate) || new Date();
        const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 0, 0, 0, 0);
        const day = start.getDay();
        const distanceToMonday = day === 0 ? 6 : day - 1;
        start.setDate(start.getDate() - distanceToMonday + (offsetWeeks * 7));
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        return {
            start: getDateKey(start),
            end: getDateKey(end)
        };
    };

    const getThisWeekRange = (baseDate) => getWeekRange(baseDate, 0);
    const getLastWeekRange = (baseDate) => getWeekRange(baseDate, -1);

    const normalizeRange = (range) => {
        const safeRange = range && typeof range === 'object' ? range : {};
        const startDate = toDate(safeRange.start);
        const endDate = toDate(safeRange.end);
        if (!startDate || !endDate) {
            throw new Error('Invalid weekly report range');
        }

        const normalizedStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
        const normalizedEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);
        const reversed = normalizedStart.getTime() > normalizedEnd.getTime();
        const finalStart = reversed ? new Date(normalizedEnd.getFullYear(), normalizedEnd.getMonth(), normalizedEnd.getDate(), 0, 0, 0, 0) : normalizedStart;
        const finalEnd = reversed ? new Date(normalizedStart.getFullYear(), normalizedStart.getMonth(), normalizedStart.getDate(), 23, 59, 59, 999) : normalizedEnd;

        return {
            start: getDateKey(finalStart),
            end: getDateKey(finalEnd),
            startDate: finalStart,
            endDate: finalEnd
        };
    };

    const isTimestampInRange = (timestamp, range) => {
        const normalizedRange = normalizeRange(range);
        const numericTimestamp = Number(timestamp);
        if (!Number.isFinite(numericTimestamp)) return false;
        return numericTimestamp >= normalizedRange.startDate.getTime() && numericTimestamp <= normalizedRange.endDate.getTime();
    };

    const isDateKeyInRange = (dateKey, range) => {
        const normalizedRange = normalizeRange(range);
        return String(dateKey || '') >= normalizedRange.start && String(dateKey || '') <= normalizedRange.end;
    };

    const toStudentIdentitySet = (student) => {
        const identifiers = new Set();
        if (student && typeof student === 'object') {
            if (student.id !== undefined && student.id !== null && student.id !== '') {
                identifiers.add(String(student.id));
            }
            if (student.name) {
                identifiers.add(String(student.name));
            }
        } else if (student !== undefined && student !== null && student !== '') {
            identifiers.add(String(student));
        }
        return identifiers;
    };

    const matchesStudent = (record, student) => {
        const identifiers = toStudentIdentitySet(student);
        if (identifiers.size === 0) return false;
        return identifiers.has(String(record?.studentId ?? '')) || identifiers.has(String(record?.studentName ?? ''));
    };

    const compareByTimestamp = (left, right) => {
        const leftTs = Number(left?.ts ?? left?.timestamp ?? 0) || 0;
        const rightTs = Number(right?.ts ?? right?.timestamp ?? 0) || 0;
        return leftTs - rightTs;
    };

    const filterHistoryByRange = (history, range) => {
        const list = Array.isArray(history) ? history : [];
        return list.filter((item) => isTimestampInRange(item?.ts, range));
    };

    const getStudentHistoryInRange = (history, student, range) => {
        return filterHistoryByRange(history, range)
            .filter((item) => matchesStudent(item, student))
            .slice()
            .sort(compareByTimestamp);
    };

    const normalizeText = (value) => String(value || '').trim();
    const normalizeLowerText = (value) => normalizeText(value).toLowerCase();

    const includesAny = (text, keywords) => keywords.some((keyword) => text.includes(keyword));

    const categorizeHistoryItem = (item) => {
        const category = normalizeText(item?.category);
        const scene = normalizeText(item?.scene);
        const reason = normalizeText(item?.reason);
        const type = normalizeLowerText(item?.type);
        const combined = [category, scene, reason, type].join(' ').toLowerCase();
        const numericValue = Number(item?.val) || 0;

        if (category === '兑奖') return 'redemption';
        if (type === 'spending') return 'redemption';
        if (category === '班务') return 'classAffairs';
        if (category === '学业' && includesAny(combined, ['作业'])) return 'homework';

        if (scene === '宿舍') return 'dormitory';
        if (scene === '班级' && includesAny(combined, ['值日', '班务', '每日工资', '课代表', '委员'])) return 'classAffairs';

        if (category === '出勤') {
            return includesAny(combined, ['跑操']) ? 'runningExercise' : 'attendance';
        }

        if (includesAny(combined, ['跑操'])) return 'runningExercise';
        if (includesAny(combined, ['作业'])) return 'homework';
        if (includesAny(combined, ['宿舍'])) return 'dormitory';
        if (includesAny(combined, ['考勤', '迟到', '缺勤', '准点', '全勤'])) return 'attendance';
        if (includesAny(combined, ['兑奖', '兑换', '消费', '宝物', '商城'])) return 'redemption';
        if (includesAny(combined, ['值日', '班务', '每日工资', '课代表', '委员'])) return 'classAffairs';

        if (numericValue < 0 || type === 'penalty') return 'otherPenalties';
        return 'otherRewards';
    };

    const groupHistoryByCategory = (history) => {
        const list = Array.isArray(history) ? history : [];
        const grouped = CATEGORY_DEFINITIONS.reduce((acc, definition) => {
            acc[definition.key] = [];
            return acc;
        }, {});

        list.forEach((item) => {
            const key = categorizeHistoryItem(item);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });

        return CATEGORY_DEFINITIONS
            .map((definition) => {
                const items = (grouped[definition.key] || []).slice().sort(compareByTimestamp);
                if (items.length === 0) return null;
                return {
                    key: definition.key,
                    title: definition.title,
                    total: items.reduce((sum, item) => sum + (Number(item?.val) || 0), 0),
                    items
                };
            })
            .filter(Boolean);
    };

    const extractTaskCompletions = (history, options = {}) => {
        const list = Array.isArray(history) ? history : [];
        const taskList = Array.isArray(options?.tasks) ? options.tasks : [];
        return list
            .map((item) => {
                const reason = normalizeText(item?.reason);
                const match = reason.match(/^完成任务[:：]\s*(.+)$/);
                if (!match) return null;
                const title = normalizeText(match[1]);
                const meta = taskList.find((task) => normalizeText(task?.title) === title) || null;
                return {
                    id: item?.id ?? `${item?.ts || ''}-${title}`,
                    title,
                    ts: Number(item?.ts) || 0,
                    date: getDateKey(item?.ts),
                    points: Number(item?.val) || 0,
                    historyId: item?.id ?? null,
                    meta: meta ? { ...meta } : null
                };
            })
            .filter(Boolean)
            .sort(compareByTimestamp);
    };

    const computeNetPoints = (history) => {
        const list = Array.isArray(history) ? history : [];
        return list.reduce((sum, item) => sum + (Number(item?.val) || 0), 0);
    };

    const summarizeAttendance = (attendanceRecords, studentName, range) => {
        const normalizedRange = normalizeRange(range);
        const safeRecords = attendanceRecords && typeof attendanceRecords === 'object' ? attendanceRecords : {};
        const items = [];

        Object.entries(safeRecords).forEach(([dateKey, studentMap]) => {
            if (!isDateKeyInRange(dateKey, normalizedRange)) return;
            const sessionMap = studentMap?.[studentName];
            if (!sessionMap || typeof sessionMap !== 'object') return;
            Object.entries(sessionMap).forEach(([sessionId, record]) => {
                if (!record || typeof record !== 'object') return;
                items.push({
                    date: dateKey,
                    sessionId,
                    status: normalizeText(record.status),
                    checkTime: normalizeText(record.checkTime),
                    timestamp: Number(record.timestamp) || 0,
                    isDerived: !!record.isDerived,
                    source: normalizeText(record.source)
                });
            });
        });

        items.sort((left, right) => {
            if (left.date !== right.date) return left.date.localeCompare(right.date);
            if (left.timestamp !== right.timestamp) return left.timestamp - right.timestamp;
            return String(left.sessionId).localeCompare(String(right.sessionId));
        });

        const summary = items.reduce((acc, item) => {
            const status = item.status || 'other';
            if (!Object.prototype.hasOwnProperty.call(acc, status)) {
                acc[status] = 0;
            }
            acc[status] += 1;
            return acc;
        }, { ok: 0, late: 0, absent: 0, other: 0 });

        return {
            items,
            summary
        };
    };

    const buildWeeklyReportFilename = (range) => {
        const normalizedRange = normalizeRange(range);
        return `${normalizedRange.start}~${normalizedRange.end}学生行为周报.md`;
    };

    const downloadMarkdown = (filename, content) => {
        if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
            return false;
        }
        const blob = new Blob([String(content || '')], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = String(filename || '学生行为周报.md');
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        return true;
    };

    const api = {
        CATEGORY_DEFINITIONS,
        CATEGORY_TITLES,
        getDateKey,
        getWeekRange,
        getThisWeekRange,
        getLastWeekRange,
        normalizeRange,
        isTimestampInRange,
        isDateKeyInRange,
        matchesStudent,
        compareByTimestamp,
        filterHistoryByRange,
        getStudentHistoryInRange,
        categorizeHistoryItem,
        groupHistoryByCategory,
        extractTaskCompletions,
        computeNetPoints,
        summarizeAttendance,
        buildWeeklyReportFilename,
        downloadMarkdown
    };

    if (typeof window !== 'undefined') {
        window.WeeklyReportUtils = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();
