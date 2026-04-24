(function() {
    const utils = (() => {
        if (typeof module !== 'undefined' && module.exports) {
            return require('./utils');
        }
        if (typeof window !== 'undefined') {
            return window.WeeklyReportUtils;
        }
        return null;
    })();

    if (!utils) {
        throw new Error('WeeklyReportUtils is required');
    }

    const formatHistoryItem = (item) => ({
        id: item?.id ?? null,
        ts: Number(item?.ts) || 0,
        date: utils.getDateKey(item?.ts),
        reason: String(item?.reason || '').trim(),
        category: String(item?.category || '').trim(),
        scene: String(item?.scene || '').trim(),
        type: String(item?.type || '').trim(),
        points: Number(item?.val) || 0
    });

    const buildStudentWeeklyReport = ({
        student,
        history,
        attendanceRecords,
        range,
        tasks
    }) => {
        const normalizedRange = utils.normalizeRange(range);
        const sourceStudent = student && typeof student === 'object' ? student : {};
        const studentName = String(sourceStudent.name || '').trim();
        const studentHistory = utils.getStudentHistoryInRange(history, sourceStudent, normalizedRange);
        const categorizedGroups = utils.groupHistoryByCategory(studentHistory).map((group) => ({
            ...group,
            items: group.items.map(formatHistoryItem)
        }));
        const attendance = utils.summarizeAttendance(attendanceRecords, studentName, normalizedRange);
        const taskCompletions = utils.extractTaskCompletions(studentHistory, { tasks });
        const netPoints = utils.computeNetPoints(studentHistory);

        return {
            studentId: sourceStudent.id ?? null,
            studentName,
            range: {
                start: normalizedRange.start,
                end: normalizedRange.end
            },
            attendance: attendance.items.length > 0 ? attendance : null,
            categories: categorizedGroups,
            tasks: taskCompletions,
            netPoints,
            historyCount: studentHistory.length
        };
    };

    const buildWeeklyReport = ({
        students,
        history,
        attendanceRecords,
        range,
        tasks,
        title,
        generatedAt,
        selectedStudentIds,
        includeNetPoints = true
    }) => {
        const normalizedRange = utils.normalizeRange(range);
        const safeStudents = Array.isArray(students) ? students : [];
        const selectedIds = Array.isArray(selectedStudentIds) && selectedStudentIds.length > 0
            ? new Set(selectedStudentIds.map((value) => String(value)))
            : null;
        const filteredStudents = selectedIds
            ? safeStudents.filter((student) => selectedIds.has(String(student?.id ?? '')))
            : safeStudents;

        return {
            title: String(title || '学生行为周报').trim() || '学生行为周报',
            generatedAt: Number(generatedAt) || Date.now(),
            range: {
                start: normalizedRange.start,
                end: normalizedRange.end
            },
            studentCount: filteredStudents.length,
            includeNetPoints: includeNetPoints !== false,
            students: filteredStudents
                .map((student) => buildStudentWeeklyReport({
                    student,
                    history,
                    attendanceRecords,
                    range: normalizedRange,
                    tasks
                }))
                .filter((studentReport) => studentReport.studentName)
        };
    };

    const api = {
        buildStudentWeeklyReport,
        buildWeeklyReport
    };

    if (typeof window !== 'undefined') {
        window.WeeklyReportBuilder = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();
