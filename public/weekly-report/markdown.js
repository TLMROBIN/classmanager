(function() {
    const formatSignedNumber = (value) => {
        const numericValue = Number(value) || 0;
        if (numericValue > 0) return `+${numericValue}`;
        if (numericValue < 0) return `${numericValue}`;
        return '0';
    };

    const formatGeneratedAt = (value) => {
        const date = new Date(Number(value) || Date.now());
        if (Number.isNaN(date.getTime())) return '';
        const pad2 = (part) => String(part).padStart(2, '0');
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    };

    const renderAttendanceSection = (attendance) => {
        if (!attendance || !Array.isArray(attendance.items) || attendance.items.length === 0) {
            return [];
        }
        const lines = [
            '### 考勤',
            `- 汇总：正常 ${attendance.summary?.ok || 0} 次，迟到 ${attendance.summary?.late || 0} 次，缺勤 ${attendance.summary?.absent || 0} 次`
        ];

        attendance.items.forEach((item) => {
            const detail = item.checkTime ? `（${item.checkTime}）` : '';
            const derived = item.isDerived ? ' [派生]' : '';
            lines.push(`- ${item.date} ${item.sessionId}：${item.status || 'unknown'}${detail}${derived}`);
        });

        return lines;
    };

    const renderCategorySection = (categories) => {
        const safeCategories = Array.isArray(categories) ? categories.filter((item) => Array.isArray(item?.items) && item.items.length > 0) : [];
        if (safeCategories.length === 0) return [];

        const lines = ['### 分类明细'];
        safeCategories.forEach((group) => {
            lines.push(`#### ${group.title}（${formatSignedNumber(group.total)}）`);
            group.items.forEach((item) => {
                lines.push(`- ${item.date} ${item.reason}（${formatSignedNumber(item.points)}）`);
            });
        });
        return lines;
    };

    const renderTaskSection = (tasks) => {
        const safeTasks = Array.isArray(tasks) ? tasks : [];
        if (safeTasks.length === 0) return [];
        const lines = ['### 任务'];
        safeTasks.forEach((task) => {
            const metaSuffix = task.meta?.desc ? ` —— ${task.meta.desc}` : '';
            lines.push(`- ${task.date} ${task.title}（${formatSignedNumber(task.points)}）${metaSuffix}`);
        });
        return lines;
    };

    const renderNetPointsSection = (netPoints, includeNetPoints) => {
        if (!includeNetPoints) return [];
        return [
            '### 净积分',
            `- ${formatSignedNumber(netPoints)}`
        ];
    };

    const renderWeeklyReportMarkdown = (report, options = {}) => {
        const safeReport = report && typeof report === 'object' ? report : {};
        const students = Array.isArray(safeReport.students) ? safeReport.students : [];
        const includeNetPoints = options.includeNetPoints !== false && safeReport.includeNetPoints !== false;
        const lines = [
            `# ${String(safeReport.title || '学生行为周报').trim() || '学生行为周报'}`,
            '',
            `- 时间范围：${safeReport.range?.start || ''} 至 ${safeReport.range?.end || ''}`,
            `- 学生数：${Number(safeReport.studentCount) || students.length}`,
            `- 生成时间：${formatGeneratedAt(safeReport.generatedAt)}`
        ];

        students.forEach((student, index) => {
            const sections = [
                renderAttendanceSection(student.attendance),
                renderCategorySection(student.categories),
                renderTaskSection(student.tasks),
                renderNetPointsSection(student.netPoints, includeNetPoints)
            ].filter((section) => section.length > 0);

            lines.push('');
            if (index > 0) {
                lines.push('---');
                lines.push('');
            }
            lines.push(`## ${student.studentName || '未命名学生'}`);

            sections.forEach((section) => {
                lines.push('');
                section.forEach((line) => lines.push(line));
            });
        });

        return lines.join('\n').trimEnd() + '\n';
    };

    const api = {
        formatSignedNumber,
        renderWeeklyReportMarkdown
    };

    if (typeof window !== 'undefined') {
        window.WeeklyReportMarkdown = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();
