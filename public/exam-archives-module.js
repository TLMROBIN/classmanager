(function() {
    window.createExamArchivesView = function createExamArchivesView(deps) {
        const {
            h,
            useState,
            useEffect,
            Icon,
            requireAdminAuth,
            getTodayStr,
            getNow,
            battleParseRank,
            battleNormalize,
            normalizeExamArchives
        } = deps || {};

        if (!h || !useState || !useEffect || !Icon || !requireAdminAuth || !getTodayStr || !getNow || !battleParseRank || !battleNormalize || !normalizeExamArchives) {
            throw new Error('ExamArchivesView dependencies are missing');
        }

        return function ExamArchivesView({ students, battle, examArchives, setBattle, setExamArchives, persistExamArchives, adminPassword }) {
            const [examUnlocked, setExamUnlocked] = useState(false);
            const archiveData = normalizeExamArchives(examArchives, battle);
            const exams = Array.isArray(archiveData.exams) ? archiveData.exams : [];
            const [selectedExamId, setSelectedExamId] = useState(() => exams[0]?.id || '');

            useEffect(() => {
                if (exams.length === 0) {
                    if (selectedExamId) setSelectedExamId('');
                    return;
                }
                if (!selectedExamId || !exams.some(ex => ex.id === selectedExamId)) {
                    setSelectedExamId(exams[0].id);
                }
            }, [exams.length, selectedExamId]);

            const selectedExam = exams.find(ex => ex.id === selectedExamId) || exams[0] || null;
            const battleData = battleNormalize(battle);

            const formatRank = (val) => {
                if (!examUnlocked) return '****';
                return Number.isFinite(val) ? String(val) : '-';
            };

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
                    exams: nextExams,
                    teamBaseExamId: battleData.teamBaseExamId || preferredExamId || nextExams[0]?.id || '',
                    settleExamId: battleData.settleExamId || preferredExamId || nextExams[0]?.id || ''
                };
                if (battleData.teamBaseExamId && !nextExams.some(ex => ex.id === battleData.teamBaseExamId)) {
                    nextBattle.teamBaseExamId = nextExams[0]?.id || '';
                }
                if (battleData.settleExamId && !nextExams.some(ex => ex.id === battleData.settleExamId)) {
                    nextBattle.settleExamId = nextExams[0]?.id || '';
                }
                const nextExamArchives = normalizeExamArchives({
                    ...archiveData,
                    exams: nextExams,
                    latestExamId: preferredExamId || nextExams[0]?.id || ''
                }, nextBattle);
                return { nextBattle, nextExamArchives };
            };

            const handleImportExam = (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const wb = XLSX.read(evt.target.result, { type: 'binary' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(ws);
                    if (rows.length === 0) return alert("Excel为空");
                    const headers = Object.keys(rows[0] || {});
                    const nameKey = headers.find(k => k.includes('姓名') || k.toLowerCase().includes('name'));
                    const classKey = headers.find(k => k.includes('班排'));
                    const gradeKey = headers.find(k => k.includes('级排'));
                    if (!nameKey) return alert("表头需包含“姓名”列");
                    const ranks = {};
                    rows.forEach((row, index) => {
                        const studentName = String(row[nameKey] || '').trim();
                        const student = (Array.isArray(students) ? students : []).find(stu => stu.name === studentName);
                        if (!student) return;
                        let c = battleParseRank(row[classKey]);
                        let g = battleParseRank(row[gradeKey]);
                        if (isNaN(c)) c = index + 1;
                        if (isNaN(g)) g = (index + 1) * 10;
                        ranks[student.id] = { c, g };
                    });
                    const defaultName = file.name ? file.name.replace(/\.[^/.]+$/, '') : `考试${getTodayStr()}`;
                    const name = prompt("请输入考试名称", defaultName) || defaultName;
                    const examId = `ex${Date.now()}`;
                    const nextExam = { id: examId, name, ts: getNow().getTime(), ranks };
                    const nextExams = [nextExam, ...exams];
                    const { nextBattle, nextExamArchives } = buildNextExamState(nextExams, examId);
                    setSelectedExamId(examId);
                    persistChanges({
                        nextBattle,
                        nextExamArchives,
                        successMessage: `已导入 ${Object.keys(ranks).length} 条成绩并保存成功`,
                        failureMessage: `已导入 ${Object.keys(ranks).length} 条成绩，但保存失败，请手动刷新确认`
                    });
                };
                reader.readAsBinaryString(file);
                e.target.value = '';
            };

            const handleDeleteExam = (examId) => {
                if (!confirm("确定删除该考试档案？")) return;
                const nextExams = exams.filter(ex => ex.id !== examId);
                const { nextBattle, nextExamArchives } = buildNextExamState(nextExams, nextExams[0]?.id || '');
                if (selectedExamId === examId) setSelectedExamId(nextExams[0]?.id || '');
                persistChanges({
                    nextBattle,
                    nextExamArchives,
                    successMessage: "考试档案已删除并保存",
                    failureMessage: "考试档案已删除，但保存失败，请手动刷新确认"
                });
            };

            return h("div", { className: "border rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 p-4 md:p-5 shadow-[0_0_30px_rgba(79,70,229,0.18)] space-y-4" },
                h("div", { className: "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" },
                    h("div", null,
                        h("div", { className: "text-lg font-bold tracking-wide flex items-center gap-2" }, h(Icon, { name: "fileText", size: 18 }), "考试档案模块"),
                        h("div", { className: "text-xs text-slate-400 mt-1" }, `当前共 ${exams.length} 场考试，双子星会直接读取这里的档案。`)
                    ),
                    h("div", { className: "flex flex-wrap gap-2" },
                        h("label", { className: "px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs cursor-pointer flex items-center gap-1" }, h(Icon, { name: "excel", size: 14 }), "导入考试成绩", h("input", { type: "file", className: "hidden", accept: ".xlsx,.xls", onChange: handleImportExam })),
                        !examUnlocked && h("button", { onClick: () => { if (requireAdminAuth("请输入管理员密码：", adminPassword)) setExamUnlocked(true); }, className: "px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs" }, "解锁查看排名"),
                        examUnlocked && h("button", { onClick: () => setExamUnlocked(false), className: "px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs" }, "锁定排名")
                    )
                ),
                h("div", { className: "grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4" },
                    h("div", { className: "bg-slate-950/40 border border-slate-800/60 rounded-2xl p-3 space-y-3" },
                        h("div", { className: "text-xs text-slate-400" }, "考试列表"),
                        h("div", { className: "space-y-2 max-h-80 overflow-y-auto" },
                            exams.length === 0
                                ? h("div", { className: "text-xs text-slate-500 py-6 text-center" }, "暂无考试档案")
                                : exams.map(ex => h("div", {
                                    key: ex.id,
                                    className: `rounded-xl border px-3 py-3 text-xs ${selectedExam?.id === ex.id ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-100' : 'bg-slate-900/60 border-slate-800/60 text-slate-300'}`
                                },
                                    h("div", { className: "flex items-start justify-between gap-2" },
                                        h("button", { onClick: () => setSelectedExamId(ex.id), className: "flex-1 text-left" },
                                            h("div", { className: "font-medium" }, ex.name || ex.id),
                                            h("div", { className: "text-[11px] text-slate-400 mt-1" }, `${Object.keys(ex.ranks || {}).length} 人 · ${new Date(ex.ts || Date.now()).toLocaleDateString('zh-CN')}`)
                                        ),
                                        h("button", { onClick: () => handleDeleteExam(ex.id), className: "px-2 py-1 rounded bg-rose-500/20 border border-rose-400/40 text-rose-200 hover:bg-rose-500/30" }, "删除")
                                    ),
                                    h("div", { className: "mt-2 flex flex-wrap gap-2 text-[10px]" },
                                        battleData.teamBaseExamId === ex.id && h("span", { className: "px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-100" }, "组队基准"),
                                        battleData.settleExamId === ex.id && h("span", { className: "px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-100" }, "结算考试")
                                    )
                                ))
                        )
                    ),
                    h("div", { className: "bg-slate-950/40 border border-slate-800/60 rounded-2xl p-3 space-y-3" },
                        h("div", { className: "flex flex-col gap-2 md:flex-row md:items-center md:justify-between" },
                            h("div", null,
                                h("div", { className: "font-bold text-slate-100" }, selectedExam ? selectedExam.name : "档案预览"),
                                h("div", { className: "text-xs text-slate-400 mt-1" }, selectedExam ? `档案时间：${new Date(selectedExam.ts || Date.now()).toLocaleString('zh-CN', { hour12: false })}` : "选择一场考试查看明细")
                            ),
                            h("div", { className: "text-xs text-slate-400" }, "双子星页面中只保留考试选择与读取")
                        ),
                        !selectedExam
                            ? h("div", { className: "text-sm text-slate-500 py-10 text-center" }, "暂无可预览档案")
                            : h("div", { className: "max-h-[28rem] overflow-y-auto border border-slate-800/60 rounded-xl" },
                                h("table", { className: "w-full text-xs text-left" },
                                    h("thead", { className: "bg-slate-900/80 text-slate-400 sticky top-0" },
                                        h("tr", null,
                                            h("th", { className: "p-2" }, "姓名"),
                                            h("th", { className: "p-2 text-center" }, "班排"),
                                            h("th", { className: "p-2 text-center" }, "级排")
                                        )
                                    ),
                                    h("tbody", null,
                                        (Array.isArray(students) ? students : []).map(student => {
                                            const rank = (selectedExam.ranks || {})[student.id] || {};
                                            return h("tr", { key: student.id, className: "border-t border-slate-800/60" },
                                                h("td", { className: "p-2" }, student.name),
                                                h("td", { className: "p-2 text-center font-mono" }, formatRank(Number(rank.c))),
                                                h("td", { className: "p-2 text-center font-mono" }, formatRank(Number(rank.g)))
                                            );
                                        })
                                    )
                                )
                            )
                    )
                )
            );
        };
    };
})();
