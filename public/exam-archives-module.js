(function() {
    const EXAM_IMPORT_COLUMNS = [
        { header: '总分(赋分)', key: 'totalAssigned', kind: 'score' },
        { header: '总分(原始分)', key: 'totalRaw', kind: 'score' },
        { header: '总分(年级排名)', key: 'totalGradeRank', kind: 'rank' },
        { header: '总分(班级排名)', key: 'totalClassRank', kind: 'rank' },
        { header: '语文(得分)', key: 'chineseScore', kind: 'score' },
        { header: '语文(年级排名)', key: 'chineseGradeRank', kind: 'rank' },
        { header: '语文(班级排名)', key: 'chineseClassRank', kind: 'rank' },
        { header: '数学(得分)', key: 'mathScore', kind: 'score' },
        { header: '数学(年级排名)', key: 'mathGradeRank', kind: 'rank' },
        { header: '数学(班级排名)', key: 'mathClassRank', kind: 'rank' },
        { header: '英语(得分)', key: 'englishScore', kind: 'score' },
        { header: '英语(年级排名)', key: 'englishGradeRank', kind: 'rank' },
        { header: '英语(班级排名)', key: 'englishClassRank', kind: 'rank' },
        { header: '物理(得分)', key: 'physicsScore', kind: 'score' },
        { header: '物理(年级排名)', key: 'physicsGradeRank', kind: 'rank' },
        { header: '物理(班级排名)', key: 'physicsClassRank', kind: 'rank' },
        { header: '化学(赋分)', key: 'chemistryAssigned', kind: 'score' },
        { header: '化学(原始分)', key: 'chemistryRaw', kind: 'score' },
        { header: '化学(年级排名)', key: 'chemistryGradeRank', kind: 'rank' },
        { header: '化学(班级排名)', key: 'chemistryClassRank', kind: 'rank' },
        { header: '生物(赋分)', key: 'biologyAssigned', kind: 'score' },
        { header: '生物(原始分)', key: 'biologyRaw', kind: 'score' },
        { header: '生物(年级排名)', key: 'biologyGradeRank', kind: 'rank' },
        { header: '生物(班级排名)', key: 'biologyClassRank', kind: 'rank' },
        { header: '地理(赋分)', key: 'geographyAssigned', kind: 'score' },
        { header: '地理(原始分)', key: 'geographyRaw', kind: 'score' },
        { header: '地理(班级排名)', key: 'geographyClassRank', kind: 'rank' },
        { header: '地理(年级排名)', key: 'geographyGradeRank', kind: 'rank' }
    ];

    const EXAM_IMPORT_HEADERS = ['姓名', ...EXAM_IMPORT_COLUMNS.map(column => column.header)];

    const parseOptionalNumber = (value) => {
        if (value === undefined || value === null) return null;
        if (typeof value === 'string' && value.trim() === '') return null;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
    };

    const getExamRecord = (exam, studentId) => {
        if (!exam || !studentId) return null;
        const records = exam.records && typeof exam.records === 'object' ? exam.records : {};
        return records[studentId] || records[String(studentId)] || null;
    };

    const getLegacyRank = (exam, studentId) => {
        if (!exam || !studentId) return null;
        const ranks = exam.ranks && typeof exam.ranks === 'object' ? exam.ranks : {};
        return ranks[studentId] || ranks[String(studentId)] || null;
    };

    const getCellDisplayValue = (exam, studentId, column, rankVisible) => {
        const record = getExamRecord(exam, studentId) || {};
        if (column.kind === 'rank' && !rankVisible) return '****';
        let value = record[column.key];
        if ((value === undefined || value === null || value === '') && (column.key === 'totalClassRank' || column.key === 'totalGradeRank')) {
            const legacyRank = getLegacyRank(exam, studentId) || {};
            value = column.key === 'totalClassRank' ? legacyRank.c : legacyRank.g;
        }
        if (value === undefined || value === null || value === '') return '';
        return String(value);
    };

    const buildRecordFromRow = (row) => {
        const record = {};
        EXAM_IMPORT_COLUMNS.forEach(column => {
            record[column.key] = parseOptionalNumber(row[column.header]);
        });
        return record;
    };

    const buildImportTemplateWorkbook = (students, getTodayStr) => {
        const rows = [EXAM_IMPORT_HEADERS];
        (Array.isArray(students) ? students : []).forEach(student => {
            rows.push([student.name || '', ...EXAM_IMPORT_COLUMNS.map(() => '')]);
        });

        const templateSheet = XLSX.utils.aoa_to_sheet(rows);
        templateSheet['!cols'] = [
            { wch: 12 },
            ...EXAM_IMPORT_COLUMNS.map(column => ({ wch: Math.max(12, column.header.length + 2) }))
        ];

        const guideSheet = XLSX.utils.aoa_to_sheet([
            ['说明', '内容'],
            ['模板生成日期', getTodayStr()],
            ['填写规则', '第一列“姓名”请与系统学生姓名保持一致；其余列允许留空，留空代表缺考或暂无数据。'],
            ['排名规则', '系统会使用“总分(年级排名)”和“总分(班级排名)”作为总排名字段。'],
            ['支持格式', '仅支持 .xlsx / .xls，默认读取第一个工作表。']
        ]);
        guideSheet['!cols'] = [{ wch: 18 }, { wch: 72 }];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, templateSheet, '考试成绩模板');
        XLSX.utils.book_append_sheet(workbook, guideSheet, '填写说明');
        return workbook;
    };

    window.createExamArchivesView = function createExamArchivesView(deps) {
        const {
            h,
            useState,
            useEffect,
            Icon,
            getTodayStr,
            getNow,
            battleNormalize,
            normalizeExamArchives
        } = deps || {};

        if (!h || !useState || !useEffect || !Icon || !getTodayStr || !getNow || !battleNormalize || !normalizeExamArchives) {
            throw new Error('ExamArchivesView dependencies are missing');
        }

        return function ExamArchivesView({ students, battle, examArchives, setBattle, setExamArchives, persistExamArchives }) {
            const [examUnlocked, setExamUnlocked] = useState(true);
            const archiveData = normalizeExamArchives(examArchives, battle);
            const exams = Array.isArray(archiveData.exams) ? archiveData.exams : [];
            const [selectedExamId, setSelectedExamId] = useState(() => exams[0]?.id || '');

            useEffect(() => {
                if (exams.length === 0) {
                    if (selectedExamId) setSelectedExamId('');
                    return;
                }
                if (!selectedExamId || !exams.some(exam => exam.id === selectedExamId)) {
                    setSelectedExamId(exams[0].id);
                }
            }, [exams, selectedExamId]);

            const selectedExam = exams.find(exam => exam.id === selectedExamId) || exams[0] || null;
            const battleData = battleNormalize(battle);

            const persistChanges = ({ nextBattle, nextExamArchives, successMessage, failureMessage }) => {
                setBattle(nextBattle);
                setExamArchives(nextExamArchives);
                if (typeof persistExamArchives === 'function') {
                    persistExamArchives({
                        battle: nextBattle,
                        examArchives: nextExamArchives,
                        successMessage,
                        failureMessage
                    });
                } else if (successMessage) {
                    alert(successMessage);
                }
            };

            const buildNextExamState = (nextExams, preferredExamId) => {
                const nextBattle = {
                    ...battleData,
                    teamBaseExamId: battleData.teamBaseExamId || preferredExamId || nextExams[0]?.id || '',
                    settleExamId: battleData.settleExamId || preferredExamId || nextExams[0]?.id || ''
                };
                if (battleData.teamBaseExamId && !nextExams.some(exam => exam.id === battleData.teamBaseExamId)) {
                    nextBattle.teamBaseExamId = nextExams[0]?.id || '';
                }
                if (battleData.settleExamId && !nextExams.some(exam => exam.id === battleData.settleExamId)) {
                    nextBattle.settleExamId = nextExams[0]?.id || '';
                }
                const nextExamArchives = normalizeExamArchives({
                    ...archiveData,
                    exams: nextExams,
                    latestExamId: preferredExamId || nextExams[0]?.id || ''
                }, nextBattle);
                return { nextBattle, nextExamArchives };
            };

            const handleDownloadTemplate = () => {
                const workbook = buildImportTemplateWorkbook(students, getTodayStr);
                XLSX.writeFile(workbook, `考试成绩导入模板_${getTodayStr()}.xlsx`);
            };

            const handleImportExam = (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const importGuards = window.ClassManagerImportGuards;
                if (!importGuards?.readWorkbookFromFile || !importGuards?.getFirstWorksheet || !importGuards?.assertWorksheetRows) {
                    alert('导入组件未加载，请刷新后重试');
                    e.target.value = '';
                    return;
                }
                void importGuards.readWorkbookFromFile({
                    file,
                    xlsx: XLSX,
                    label: '导入考试成绩',
                    maxSheets: 3
                }).then((workbook) => {
                    const sheet = importGuards.getFirstWorksheet(workbook, '导入考试成绩');
                    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                    importGuards.assertWorksheetRows(rows, {
                        label: '导入考试成绩',
                        maxRows: 500,
                        emptyMessage: 'Excel为空'
                    });

                    const firstRow = rows[0] || {};
                    const missingHeaders = EXAM_IMPORT_HEADERS.filter(header => !Object.prototype.hasOwnProperty.call(firstRow, header));
                    if (missingHeaders.length > 0) {
                        alert(`表头不完整，缺少：${missingHeaders.join('、')}`);
                        return;
                    }

                    const records = {};
                    const ranks = {};
                    const missingNames = [];

                    rows.forEach(row => {
                        const studentName = String(row['姓名'] || '').trim();
                        if (!studentName) return;
                        const student = (Array.isArray(students) ? students : []).find(item => item.name === studentName);
                        if (!student) {
                            missingNames.push(studentName);
                            return;
                        }
                        const record = buildRecordFromRow(row);
                        records[student.id] = record;
                        ranks[student.id] = {
                            c: record.totalClassRank,
                            g: record.totalGradeRank
                        };
                    });

                    const importedCount = Object.keys(records).length;
                    if (importedCount === 0) {
                        alert('没有匹配到任何学生，请确认姓名列与系统学生名单一致。');
                        return;
                    }

                    const defaultName = file.name ? file.name.replace(/\.[^/.]+$/, '') : `考试${getTodayStr()}`;
                    const name = prompt('请输入考试名称', defaultName) || defaultName;
                    const examId = `ex${Date.now()}`;
                    const nextExam = {
                        id: examId,
                        name,
                        ts: getNow().getTime(),
                        records,
                        ranks
                    };
                    const nextExams = [nextExam, ...exams];
                    const { nextBattle, nextExamArchives } = buildNextExamState(nextExams, examId);
                    setSelectedExamId(examId);

                    const suffix = missingNames.length > 0
                        ? `\n未匹配学生：${Array.from(new Set(missingNames)).join('、')}`
                        : '';
                    persistChanges({
                        nextBattle,
                        nextExamArchives,
                        successMessage: `已导入 ${importedCount} 条成绩并保存成功${suffix}`,
                        failureMessage: `已导入 ${importedCount} 条成绩，但保存失败，请手动刷新确认${suffix}`
                    });
                }).catch((err) => {
                    console.error('导入考试成绩失败:', err);
                    alert(`导入失败：${err?.message || '文件格式错误'}`);
                }).finally(() => {
                    e.target.value = '';
                });
            };

            const handleDeleteExam = (examId) => {
                if (!confirm('确定删除该考试档案？')) return;
                const nextExams = exams.filter(exam => exam.id !== examId);
                const { nextBattle, nextExamArchives } = buildNextExamState(nextExams, nextExams[0]?.id || '');
                if (selectedExamId === examId) setSelectedExamId(nextExams[0]?.id || '');
                persistChanges({
                    nextBattle,
                    nextExamArchives,
                    successMessage: '考试档案已删除并保存',
                    failureMessage: '考试档案已删除，但保存失败，请手动刷新确认'
                });
            };

            return h('div', { className: 'w-full max-w-full border rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 p-4 md:p-5 shadow-[0_0_30px_rgba(79,70,229,0.18)] space-y-4 overflow-hidden' },
                h('div', { className: 'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between' },
                    h('div', null,
                        h('div', { className: 'text-lg font-bold tracking-wide flex items-center gap-2' }, h(Icon, { name: 'fileText', size: 18 }), '考试档案模块'),
                        h('div', { className: 'text-xs text-slate-400 mt-1' }, `当前共 ${exams.length} 场考试，可导入完整成绩并在此查看。`)
                    ),
                    h('div', { className: 'flex flex-wrap gap-2' },
                        h('button', {
                            onClick: handleDownloadTemplate,
                            className: 'px-3 py-2 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-200 text-xs flex items-center gap-1'
                        }, h(Icon, { name: 'download', size: 14 }), '下载导入模板'),
                        h('label', { className: 'px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs cursor-pointer flex items-center gap-1' },
                            h(Icon, { name: 'excel', size: 14 }),
                            '导入考试成绩',
                            h('input', { type: 'file', className: 'hidden', accept: '.xlsx,.xls', onChange: handleImportExam })
                        ),
                        h('button', {
                            onClick: () => setExamUnlocked(prev => !prev),
                            className: `px-3 py-2 rounded-xl text-xs ${examUnlocked ? 'bg-slate-800/80 border border-slate-700/60' : 'bg-rose-500/20 border border-rose-400/40 text-rose-200'}`
                        }, examUnlocked ? '锁定排名' : '解锁排名')
                    )
                ),
                h('div', { className: 'grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4' },
                    h('div', { className: 'bg-slate-950/40 border border-slate-800/60 rounded-2xl p-3 space-y-3 min-w-0' },
                        h('div', { className: 'text-xs text-slate-400' }, '考试列表'),
                        h('div', { className: 'space-y-2 max-h-80 overflow-y-auto' },
                            exams.length === 0
                                ? h('div', { className: 'text-xs text-slate-500 py-6 text-center' }, '暂无考试档案')
                                : exams.map(exam => h('div', {
                                    key: exam.id,
                                    className: `rounded-xl border px-3 py-3 text-xs ${selectedExam?.id === exam.id ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-100' : 'bg-slate-900/60 border-slate-800/60 text-slate-300'}`
                                },
                                    h('div', { className: 'flex items-start justify-between gap-2' },
                                        h('button', { onClick: () => setSelectedExamId(exam.id), className: 'flex-1 text-left' },
                                            h('div', { className: 'font-medium' }, exam.name || exam.id),
                                            h('div', { className: 'text-[11px] text-slate-400 mt-1' }, `${Object.keys((exam.records && Object.keys(exam.records).length > 0) ? exam.records : (exam.ranks || {})).length} 人 · ${new Date(exam.ts || Date.now()).toLocaleDateString('zh-CN')}`)
                                        ),
                                        h('button', { onClick: () => handleDeleteExam(exam.id), className: 'px-2 py-1 rounded bg-rose-500/20 border border-rose-400/40 text-rose-200 hover:bg-rose-500/30' }, '删除')
                                    )
                                ))
                        )
                    ),
                    h('div', { className: 'bg-slate-950/40 border border-slate-800/60 rounded-2xl p-3 space-y-3 min-w-0 overflow-hidden' },
                        h('div', { className: 'flex flex-col gap-2 md:flex-row md:items-center md:justify-between' },
                            h('div', null,
                                h('div', { className: 'font-bold text-slate-100' }, selectedExam ? selectedExam.name : '档案预览'),
                                h('div', { className: 'text-xs text-slate-400 mt-1' }, selectedExam ? `档案时间：${new Date(selectedExam.ts || Date.now()).toLocaleString('zh-CN', { hour12: false })}` : '选择一场考试查看完整成绩')
                            ),
                            h('div', { className: 'text-xs text-slate-400' }, '表格支持横向滚动查看全部科目与排名')
                        ),
                        !selectedExam
                            ? h('div', { className: 'text-sm text-slate-500 py-10 text-center' }, '暂无可预览档案')
                            : h('div', { className: 'w-full max-w-full max-h-[28rem] overflow-x-auto overflow-y-auto border border-slate-800/60 rounded-xl' },
                                h('table', { className: 'min-w-max text-xs text-left whitespace-nowrap' },
                                    h('thead', { className: 'bg-slate-900/80 text-slate-400 sticky top-0 z-10' },
                                        h('tr', null,
                                            h('th', { className: 'p-2 sticky left-0 bg-slate-900/95 z-20' }, '姓名'),
                                            EXAM_IMPORT_COLUMNS.map(column => h('th', { key: column.key, className: 'p-2 text-center' }, column.header))
                                        )
                                    ),
                                    h('tbody', null,
                                        (Array.isArray(students) ? students : []).map(student => h('tr', { key: student.id, className: 'border-t border-slate-800/60' },
                                            h('td', { className: 'p-2 sticky left-0 bg-slate-950/95 z-10' }, student.name),
                                            EXAM_IMPORT_COLUMNS.map(column => h('td', { key: `${student.id}_${column.key}`, className: 'p-2 text-center font-mono' }, getCellDisplayValue(selectedExam, student.id, column, examUnlocked)))
                                        ))
                                    )
                                )
                            )
                    )
                )
            );
        };
    };
})();
