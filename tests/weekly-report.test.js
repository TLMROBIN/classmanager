const test = require('node:test');
const assert = require('node:assert/strict');

const WeeklyReportUtils = require('../public/weekly-report/utils');
const WeeklyReportBuilder = require('../public/weekly-report/builder');
const WeeklyReportMarkdown = require('../public/weekly-report/markdown');

const buildLocalTimestamp = (year, monthIndex, day, hours = 12, minutes = 0) => (
    new Date(year, monthIndex, day, hours, minutes, 0, 0).getTime()
);

test('weekly-report helpers export directly in Node', () => {
    assert.equal(typeof WeeklyReportUtils.getThisWeekRange, 'function');
    assert.equal(typeof WeeklyReportBuilder.buildWeeklyReport, 'function');
    assert.equal(typeof WeeklyReportMarkdown.renderWeeklyReportMarkdown, 'function');
});

test('weekly-report range helpers compute this week, last week and preserve custom ranges', () => {
    const anchor = new Date(2026, 3, 17, 9, 30, 0, 0);

    assert.deepEqual(WeeklyReportUtils.getThisWeekRange(anchor), {
        start: '2026-04-13',
        end: '2026-04-19'
    });
    assert.deepEqual(WeeklyReportUtils.getLastWeekRange(anchor), {
        start: '2026-04-06',
        end: '2026-04-12'
    });

    const custom = WeeklyReportUtils.normalizeRange({
        start: '2026-04-02',
        end: '2026-04-05'
    });
    assert.equal(custom.start, '2026-04-02');
    assert.equal(custom.end, '2026-04-05');
    assert.equal(
        WeeklyReportUtils.buildWeeklyReportFilename({ start: '2026-04-02', end: '2026-04-05' }),
        '2026-04-02~2026-04-05学生行为周报.md'
    );
});

test('weekly-report categorization prefers explicit metadata before keyword fallback', () => {
    assert.equal(WeeklyReportUtils.categorizeHistoryItem({
        category: '兑奖',
        scene: '班级',
        type: 'bonus',
        reason: '作业补偿'
    }), 'redemption');

    assert.equal(WeeklyReportUtils.categorizeHistoryItem({
        scene: '宿舍',
        type: 'bonus',
        reason: '跑操优秀'
    }), 'dormitory');

    assert.equal(WeeklyReportUtils.categorizeHistoryItem({
        category: '出勤',
        type: 'bonus',
        reason: '跑操表现突出',
        val: 2
    }), 'runningExercise');

    assert.equal(WeeklyReportUtils.categorizeHistoryItem({
        reason: '2026-04-16 跑操出勤',
        val: 2,
        type: 'bonus'
    }), 'runningExercise');

    assert.equal(WeeklyReportUtils.categorizeHistoryItem({
        reason: '数学作业未交 2026-04-16',
        val: -1,
        type: 'penalty'
    }), 'homework');

    assert.equal(WeeklyReportUtils.categorizeHistoryItem({
        reason: '考勤迟到: 早读',
        val: -2,
        type: 'penalty'
    }), 'attendance');

    assert.equal(WeeklyReportUtils.categorizeHistoryItem({
        category: '学业',
        reason: '课堂小测通过',
        val: 1,
        type: 'bonus'
    }), 'otherRewards');

    assert.equal(WeeklyReportUtils.categorizeHistoryItem({
        reason: '课堂积极发言',
        val: 3,
        type: 'bonus'
    }), 'otherRewards');

    assert.equal(WeeklyReportUtils.categorizeHistoryItem({
        reason: '课堂讲话',
        val: -2,
        type: 'penalty'
    }), 'otherPenalties');
});

test('weekly-report task extraction comes from history and can enrich with optional task metadata', () => {
    const history = [
        {
            id: 1,
            ts: buildLocalTimestamp(2026, 3, 14),
            reason: '完成任务: 值日',
            val: 2,
            studentId: 'stu-1',
            studentName: '张三'
        },
        {
            id: 2,
            ts: buildLocalTimestamp(2026, 3, 15),
            reason: '完成任务：背诵',
            val: 3,
            studentId: 'stu-1',
            studentName: '张三'
        },
        {
            id: 3,
            ts: buildLocalTimestamp(2026, 3, 16),
            reason: '普通加分',
            val: 1,
            studentId: 'stu-1',
            studentName: '张三'
        }
    ];

    const tasks = WeeklyReportUtils.extractTaskCompletions(history, {
        tasks: [
            { title: '值日', desc: '教室卫生' },
            { title: '不存在', desc: '不会被使用' }
        ]
    });

    assert.equal(tasks.length, 2);
    assert.deepEqual(tasks.map((item) => item.title), ['值日', '背诵']);
    assert.equal(tasks[0].meta.desc, '教室卫生');
    assert.equal(tasks[1].meta, null);
});

test('weekly-report builder filters by range, groups categories, summarizes attendance and computes net points', () => {
    const students = [
        { id: 'stu-1', name: '张三' },
        { id: 'stu-2', name: '李四' }
    ];
    const history = [
        {
            id: 'h1',
            ts: buildLocalTimestamp(2026, 3, 14, 8, 0),
            studentId: 'stu-1',
            studentName: '张三',
            val: 2,
            reason: '2026-04-14 跑操出勤',
            type: 'bonus'
        },
        {
            id: 'h2',
            ts: buildLocalTimestamp(2026, 3, 15, 9, 0),
            studentId: 'stu-1',
            studentName: '张三',
            val: -1,
            reason: '数学作业未交 2026-04-15',
            type: 'penalty'
        },
        {
            id: 'h3',
            ts: buildLocalTimestamp(2026, 3, 16, 10, 0),
            studentId: 'stu-1',
            studentName: '张三',
            val: 3,
            reason: '完成任务: 值日',
            type: 'bonus',
            category: '班务',
            scene: '班级'
        },
        {
            id: 'h4',
            ts: buildLocalTimestamp(2026, 3, 13, 7, 0),
            studentId: 'stu-1',
            studentName: '张三',
            val: 99,
            reason: '范围外奖励',
            type: 'bonus'
        }
    ];
    const attendanceRecords = {
        '2026-04-14': {
            '张三': {
                morning: { status: 'ok', checkTime: '07:08', timestamp: buildLocalTimestamp(2026, 3, 14, 7, 8) }
            }
        },
        '2026-04-15': {
            '张三': {
                morning: { status: 'late', checkTime: '07:25', timestamp: buildLocalTimestamp(2026, 3, 15, 7, 25) }
            }
        },
        '2026-04-16': {
            '张三': {
                morning: { status: 'absent', checkTime: '缺勤', timestamp: 0, isDerived: true }
            }
        },
        '2026-04-18': {
            '李四': {
                morning: { status: 'ok', checkTime: '07:05', timestamp: buildLocalTimestamp(2026, 3, 18, 7, 5) }
            }
        }
    };

    const report = WeeklyReportBuilder.buildWeeklyReport({
        students,
        history,
        attendanceRecords,
        range: { start: '2026-04-14', end: '2026-04-16' },
        tasks: [{ title: '值日', desc: '教室卫生' }],
        generatedAt: buildLocalTimestamp(2026, 3, 17, 18, 30)
    });

    assert.equal(report.studentCount, 2);
    const studentReport = report.students.find((item) => item.studentName === '张三');
    assert.ok(studentReport);
    assert.equal(studentReport.netPoints, 4);
    assert.equal(studentReport.historyCount, 3);
    assert.deepEqual(studentReport.attendance.summary, { ok: 1, late: 1, absent: 1, other: 0 });
    assert.deepEqual(studentReport.categories.map((group) => group.title), ['跑操', '作业', '班务']);
    assert.equal(studentReport.tasks.length, 1);
    assert.equal(studentReport.tasks[0].meta.desc, '教室卫生');

    const secondStudent = report.students.find((item) => item.studentName === '李四');
    assert.ok(secondStudent);
    assert.equal(secondStudent.netPoints, 0);
    assert.equal(secondStudent.categories.length, 0);
});

test('weekly-report markdown suppresses empty sections and renders multi-student structure', () => {
    const report = {
        title: '学生行为周报',
        generatedAt: buildLocalTimestamp(2026, 3, 17, 18, 30),
        range: { start: '2026-04-14', end: '2026-04-16' },
        studentCount: 2,
        includeNetPoints: true,
        students: [
            {
                studentName: '张三',
                attendance: {
                    summary: { ok: 1, late: 0, absent: 0 },
                    items: [
                        { date: '2026-04-14', sessionId: 'morning', status: 'ok', checkTime: '07:08', isDerived: false }
                    ]
                },
                categories: [
                    {
                        title: '班务',
                        total: 2,
                        items: [
                            { date: '2026-04-15', reason: '完成任务: 值日', points: 2 }
                        ]
                    }
                ],
                tasks: [
                    { date: '2026-04-15', title: '值日', points: 2, meta: null }
                ],
                netPoints: 2
            },
            {
                studentName: '李四',
                attendance: null,
                categories: [],
                tasks: [],
                netPoints: 0
            }
        ]
    };

    const markdown = WeeklyReportMarkdown.renderWeeklyReportMarkdown(report);

    assert.match(markdown, /^# 学生行为周报/m);
    assert.match(markdown, /^## 张三/m);
    assert.match(markdown, /^## 李四/m);
    assert.match(markdown, /^### 考勤/m);
    assert.match(markdown, /^### 分类明细/m);
    assert.match(markdown, /^### 任务/m);
    assert.match(markdown, /^### 净积分/m);
    assert.match(markdown, /^---$/m);
    assert.match(markdown, /- 时间范围：2026-04-14 至 2026-04-16/);
    assert.match(markdown, /- 学生数：2/);

    const secondStudentBlock = markdown.split('## 李四')[1];
    assert.ok(secondStudentBlock);
    assert.doesNotMatch(secondStudentBlock, /### 考勤/);
    assert.doesNotMatch(secondStudentBlock, /### 分类明细/);
    assert.doesNotMatch(secondStudentBlock, /### 任务/);
    assert.match(secondStudentBlock, /### 净积分/);
});

test('weekly-report markdown can disable net points section', () => {
    const report = {
        title: '学生行为周报',
        generatedAt: buildLocalTimestamp(2026, 3, 17, 18, 30),
        range: { start: '2026-04-14', end: '2026-04-16' },
        studentCount: 1,
        includeNetPoints: false,
        students: [
            {
                studentName: '张三',
                attendance: null,
                categories: [],
                tasks: [],
                netPoints: 2
            }
        ]
    };

    const markdown = WeeklyReportMarkdown.renderWeeklyReportMarkdown(report);
    assert.doesNotMatch(markdown, /### 净积分/);
});
