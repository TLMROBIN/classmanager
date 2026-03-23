(function() {
    window.createBattleView = function(deps) {
        const {
            h,
            useState,
            useEffect,
            useMemo,
            Modal,
            Icon,
            requireAdminAuth,
            getTodayStr,
            getNow,
            battleState,
            battleSimulator,
            battleNormalize,
            normalizeExamArchives,
            normalizeBattleSnapshots,
            battleBuildSettlementPointUpdates,
            BATTLE_INITIAL_POINTS,
            BATTLE_MAX_STAKE
        } = deps;

        return function BattleView({ students, battle, examArchives, battleSnapshots, setBattleSnapshots, setExamArchives, setBattle, onApplySettlementPoints, onPersistBattleSnapshots, isDirtyRef }) {
            const [results, setResults] = useState(null);
            const [examUnlocked, setExamUnlocked] = useState(false);
            const [challengeForm, setChallengeForm] = useState({ from: '', to: '', stake: 0 });
            const [transferPreview, setTransferPreview] = useState({ open: false, title: '', summary: null, missingStudents: [], onConfirm: null, confirmText: '确认' });
            const data = battleNormalize(battle);
            const archiveData = normalizeExamArchives(examArchives, battle);
            const battleTransfer = window.BattleTransfer || {};
            const teams = data.teams;
            const squads = data.squads;
            const battles = data.battles;
            const logs = data.logs;
            const history = data.history;
            const settlements = data.settlements;
            const season = data.season;
            const exams = archiveData.exams;
            const teamBaseExamId = data.teamBaseExamId;
            const settleExamId = data.settleExamId;
            const totalStudents = Math.max(Array.isArray(students) ? students.length : 0, 1);
            const [selectedSettlementId, setSelectedSettlementId] = useState('');
            const [selectedTeamId, setSelectedTeamId] = useState('');
            const snapshotList = useMemo(() => normalizeBattleSnapshots(battleSnapshots), [battleSnapshots]);
            const state = battleState || {};
            const simulator = battleSimulator || {};

            const setBattlePatch = (patch) => {
                setBattle(prev => (
                    typeof state.applyBattlePatch === 'function'
                        ? state.applyBattlePatch(prev, patch)
                        : { ...battleNormalize(prev), ...(patch || {}) }
                ));
            };

            const createBattleSnapshotEntry = (reason) => {
                if (typeof battleTransfer.buildBattleSnapshotEntry !== 'function' || typeof setBattleSnapshots !== 'function') return null;
                const snap = battleTransfer.buildBattleSnapshotEntry({
                    reason,
                    battle: data,
                    examArchives: archiveData,
                    students,
                    now: Date.now()
                });
                const nextSnapshots = normalizeBattleSnapshots([snap, ...(Array.isArray(battleSnapshots) ? battleSnapshots : [])]);
                setBattleSnapshots(nextSnapshots);
                if (typeof onPersistBattleSnapshots === 'function') {
                    onPersistBattleSnapshots(nextSnapshots).catch(err => {
                        console.error('双子星快照保存失败:', err);
                    });
                }
                return snap;
            };

            const applyBattleTransferPatch = (parsed, successMessage) => {
                const nextBattle = typeof state.applyTransferPatch === 'function'
                    ? state.applyTransferPatch(data, parsed.battlePatch)
                    : { ...battleNormalize(data), ...(parsed.battlePatch || {}) };
                setBattle(nextBattle);
                setExamArchives(normalizeExamArchives(parsed.examArchivesPatch, nextBattle));
                if (successMessage) alert(successMessage);
            };

            useEffect(() => {
                if (exams.length === 0) return;
                if (!teamBaseExamId || !settleExamId) {
                    setBattlePatch({ teamBaseExamId: teamBaseExamId || exams[0].id, settleExamId: settleExamId || exams[0].id });
                }
            }, [exams.length, teamBaseExamId, settleExamId]);

            const getRankFromExam = (examId, studentId) => (
                typeof simulator.getRankFromExam === 'function'
                    ? simulator.getRankFromExam({ exams, examId, studentId })
                    : null
            );

            const getBaseRank = (student) => (
                typeof simulator.getBaseRank === 'function'
                    ? simulator.getBaseRank({ student, exams, teamBaseExamId, examArchives, totalStudents })
                    : { c: totalStudents, g: totalStudents * 10 }
            );

            const getSettleRank = (student) => (
                typeof simulator.getSettleRank === 'function'
                    ? simulator.getSettleRank({
                        student,
                        exams,
                        settleExamId,
                        examArchives,
                        totalStudents,
                        baseRank: getBaseRank(student)
                    })
                    : getBaseRank(student)
            );

            const getTierLabel = (student) => (
                typeof simulator.getTierLabel === 'function'
                    ? simulator.getTierLabel({ student, exams, teamBaseExamId, examArchives, totalStudents })
                    : 'T3'
            );

            const getMemberTierText = (memberId) => {
                if (!memberId) return "未选择";
                const s = (Array.isArray(students) ? students : []).find(stu => String(stu.id) === String(memberId));
                if (!s) return "未知成员";
                return `${s.name} ${getTierLabel(s)}`;
            };

            const formatRank = (val) => {
                if (!examUnlocked) return '****';
                return Number.isFinite(val) ? String(val) : '-';
            };
            const formatNum = (val) => Number.isFinite(val) ? Number(val).toFixed(1) : '-';

            const calcMemberDetail = (student) => (
                typeof simulator.calcMemberDetail === 'function'
                    ? simulator.calcMemberDetail({ student, exams, teamBaseExamId, settleExamId, examArchives, totalStudents })
                    : { id: '', name: '-', base: null, settle: null, abs: 0, delta: 0, prog: 0, total: 0, gradeImp: 0, safe: false, tierLabel: '-', tierK: 1 }
            );

            const buildTeamDetail = (team) => (
                typeof simulator.buildTeamDetail === 'function'
                    ? simulator.buildTeamDetail({ team, students, exams, teamBaseExamId, settleExamId, examArchives, totalStudents })
                    : { members: ['-', '-'], memberDetails: [], k: 1, cp: 0 }
            );

            const getSettlementTeamName = (settlement, teamId) => {
                if (!settlement || !teamId) return '';
                const match = (settlement.battles || []).find(b => b.teamAId === teamId || b.teamBId === teamId);
                if (!match) return teamId;
                return match.teamAId === teamId ? (match.teamA?.name || teamId) : (match.teamB?.name || teamId);
            };

            const teamRankSum = (team) => (
                typeof simulator.teamRankSum === 'function'
                    ? simulator.teamRankSum({ team, students, exams, teamBaseExamId, examArchives, totalStudents })
                    : totalStudents * 2
            );

            const sortedTeams = [...teams].sort((a, b) => teamRankSum(a) - teamRankSum(b));
            const teamRankIndex = new Map(sortedTeams.map((t, idx) => [t.id, idx + 1]));
            const activeTeamIds = new Set(battles.flatMap(b => [b.teamAId, b.teamBId]).filter(Boolean));
            const currentSettlement = settlements.find(s => s.id === selectedSettlementId) || settlements[0];
            const currentSettlementTeams = currentSettlement ? Array.from(new Set((currentSettlement.battles || []).flatMap(b => [b.teamAId, b.teamBId]).filter(Boolean))) : [];
            const detailBattles = currentSettlement ? (currentSettlement.battles || []).filter(b => b.teamAId === selectedTeamId || b.teamBId === selectedTeamId) : [];

            useEffect(() => {
                if (settlements.length === 0) return;
                setSelectedSettlementId(prev => prev && settlements.some(s => s.id === prev) ? prev : settlements[0].id);
            }, [settlements.length]);

            useEffect(() => {
                if (!currentSettlement || currentSettlementTeams.length === 0) return;
                setSelectedTeamId(prev => prev && currentSettlementTeams.includes(prev) ? prev : currentSettlementTeams[0]);
            }, [selectedSettlementId, currentSettlementTeams.length]);

            const updateTeam = (id, patch) => {
                setBattle(prev => typeof state.updateTeam === 'function' ? state.updateTeam(prev, id, patch) : prev);
            };

            const updateSquad = (id, patch) => {
                setBattle(prev => typeof state.updateSquad === 'function' ? state.updateSquad(prev, id, patch) : prev);
            };

            const updateBattle = (id, patch) => {
                setBattle(prev => typeof state.updateBattle === 'function' ? state.updateBattle(prev, id, patch) : prev);
            };

            const addTeam = () => {
                setBattle(prev => typeof state.addTeam === 'function' ? state.addTeam(prev) : prev);
            };

            const addSquad = () => {
                setBattle(prev => typeof state.addSquad === 'function' ? state.addSquad(prev) : prev);
            };

            const removeTeam = (id) => {
                setBattle(prev => typeof state.removeTeam === 'function' ? state.removeTeam(prev, id) : prev);
            };

            const removeSquad = (id) => {
                setBattle(prev => typeof state.removeSquad === 'function' ? state.removeSquad(prev, id) : prev);
            };

            const removeBattle = (id) => {
                setBattle(prev => typeof state.removeBattle === 'function' ? state.removeBattle(prev, id) : prev);
            };

            const handleInit = () => {
                if (!confirm("将按当前学生初始化队伍与共鸣，现有配置会被覆盖，继续吗？")) return;
                setBattle(prev => typeof state.initializeBattle === 'function' ? state.initializeBattle(prev, students) : prev);
                setResults(null);
            };

            const handleResetPoints = () => {
                if (!confirm("确定将所有战队积分重置为50分？")) return;
                setBattle(prev => typeof state.resetPoints === 'function' ? state.resetPoints(prev) : prev);
            };

            const handleExport = () => {
                if (typeof battleTransfer.buildBattleBackup !== 'function') {
                    alert("对战备份工具未加载");
                    return;
                }
                const exported = battleTransfer.buildBattleBackup({
                    battle: data,
                    examArchives: archiveData,
                    students,
                    now: Date.now(),
                    getTodayStr
                });
                const payload = exported.payload;
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", exported.filename);
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
            };

            const handleImport = (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        if (typeof battleTransfer.parseBattleBackupText !== 'function') throw new Error("对战备份工具未加载");
                        const parsed = battleTransfer.parseBattleBackupText({
                            text: evt.target.result,
                            students
                        });
                        setTransferPreview({
                            open: true,
                            title: "导入对战备份",
                            summary: parsed.summary,
                            missingStudents: parsed.missingStudents || [],
                            confirmText: "确认导入",
                            onConfirm: () => {
                                createBattleSnapshotEntry('导入对战备份前');
                                applyBattleTransferPatch(parsed, "对战数据已导入");
                                setTransferPreview({ open: false, title: '', summary: null, missingStudents: [], onConfirm: null, confirmText: '确认' });
                            }
                        });
                    } catch (err) {
                        alert("导入失败：" + err.message);
                    }
                };
                reader.readAsText(file);
                e.target.value = '';
            };

            const handleRestoreBattleSnapshot = (snapshotId) => {
                if (!snapshotId) return;
                const snap = snapshotList.find(item => item.id === snapshotId);
                if (!snap?.payload) return alert("未找到该快照");
                try {
                    const parsed = battleTransfer.parseBattleBackupText({
                        text: JSON.stringify(snap.payload),
                        students
                    });
                    setTransferPreview({
                        open: true,
                        title: `恢复战况快照：${snap.reason || ''}`,
                        summary: parsed.summary,
                        missingStudents: parsed.missingStudents || [],
                        confirmText: "确认恢复",
                        onConfirm: () => {
                            createBattleSnapshotEntry(`恢复快照前-${snap.reason || '未命名'}`);
                            applyBattleTransferPatch(parsed, "双子星快照已恢复");
                            setTransferPreview({ open: false, title: '', summary: null, missingStudents: [], onConfirm: null, confirmText: '确认' });
                        }
                    });
                } catch (err) {
                    alert("快照恢复失败：" + err.message);
                }
            };

            const handleDeleteBattleSnapshot = (snapshotId) => {
                if (!snapshotId) return;
                const target = snapshotList.find(item => item.id === snapshotId);
                if (!target) return alert("未找到该快照");
                if (!requireAdminAuth("删除双子星快照需要管理员密码：")) return;
                if (!confirm(`确定删除快照「${target.reason || '未命名快照'}」吗？`)) return;
                const nextSnapshots = snapshotList.filter(item => item.id !== snapshotId);
                setBattleSnapshots(nextSnapshots);
                if (typeof onPersistBattleSnapshots === 'function') {
                    onPersistBattleSnapshots(nextSnapshots).catch(err => {
                        console.error('删除双子星快照失败:', err);
                        setBattleSnapshots(snapshotList);
                        alert("删除失败，请刷新后重试");
                    });
                }
            };

            const handleAddChallenge = () => {
                const from = challengeForm.from;
                const to = challengeForm.to;
                const stakeVal = Math.max(0, Math.min(BATTLE_MAX_STAKE, Number(challengeForm.stake) || 0));
                if (!from || !to) return alert("请选择双方队伍");
                if (from === to) return alert("不可选择同一队伍");
                if (activeTeamIds.has(from) || activeTeamIds.has(to)) return alert("选择的队伍已有对战");
                const rankA = teamRankIndex.get(from) || 1;
                const rankB = teamRankIndex.get(to) || 1;
                const isUnderdog = (rankA - rankB) >= 5;
                const battleItem = { id: `b${Date.now()}`, teamAId: from, teamBId: to, stake: stakeVal, isUnderdog, time: getNow().toLocaleString(), status: 'pending' };
                setBattle(prev => typeof state.addChallenge === 'function' ? state.addChallenge(prev, battleItem) : prev);
                setChallengeForm({ from: '', to: '', stake: 0 });
            };

            const handleRefuse = (battleId) => {
                const target = battles.find(b => b.id === battleId);
                if (!target) return;
                const stakeVal = Number(target.stake) || 0;
                setBattle(prev => typeof state.refuseBattle === 'function'
                    ? state.refuseBattle(prev, battleId, stakeVal, {
                        time: getNow().toLocaleTimeString(),
                        msg: `${teams.find(t => t.id === target.teamBId)?.name || '应战方'} 拒绝挑战 -${stakeVal}`
                    })
                    : prev);
            };

            const handleAutoMatch = () => {
                const available = sortedTeams.filter(t => !activeTeamIds.has(t.id));
                if (available.length < 2) return alert("没有可匹配队伍");
                const pairs = [];
                for (let i = 0; i < available.length - 1; i += 2) {
                    pairs.push([available[i], available[i + 1]]);
                }
                const newBattles = pairs.map(pair => {
                    const a = pair[0];
                    const b = pair[1];
                    const rankA = teamRankIndex.get(a.id) || 1;
                    const rankB = teamRankIndex.get(b.id) || 1;
                    return { id: `b${Date.now()}_${a.id}`, teamAId: a.id, teamBId: b.id, stake: 0, isUnderdog: (rankA - rankB) >= 5, time: getNow().toLocaleString(), status: 'pending' };
                });
                setBattle(prev => typeof state.addBattles === 'function' ? state.addBattles(prev, newBattles) : prev);
            };

            const simulate = () => {
                if (!teamBaseExamId || !settleExamId) return alert("请先选择组队基准与结算考试");
                if (typeof simulator.simulateBattle !== 'function') return alert("双子星模拟器未加载");
                const simulation = simulator.simulateBattle({
                    teams,
                    squads,
                    battles,
                    students,
                    exams,
                    teamBaseExamId,
                    settleExamId,
                    examArchives,
                    totalStudents,
                    battleMaxStake: BATTLE_MAX_STAKE
                });
                setResults(simulation.results);
            };

            const confirmSettlement = () => {
                if (!results) return alert("请先进行结算模拟");
                if (!confirm("确定生效？")) return;
                createBattleSnapshotEntry('确认结算前');
                const settlementTs = Date.now();
                const newTeams = teams.map(t => {
                    const r = results.tRes.find(x => x.id === t.id);
                    return r ? { ...t, points: r.newPts } : t;
                });
                const updates = battleBuildSettlementPointUpdates(teams, results);
                let applyResult = { applied: false, count: 0, skipped: true };
                if (updates.length > 0 && typeof onApplySettlementPoints === 'function') {
                    applyResult = onApplySettlementPoints({
                        updates,
                        source: 'battle',
                        settlementExamId: settleExamId,
                        teamBaseExamId,
                        summaryText: `本次双子星结算将向主积分系统写入 ${updates.length} 条记录，是否现在同步入账？`
                    });
                }
                const logTxt = results.pBattles.map(b => {
                    const A = teams.find(t => t.id === b.teamAId);
                    const B = teams.find(t => t.id === b.teamBId);
                    if (!A || !B) return "无效对战";
                    const win = b.winId === A.id ? A.name : (b.winId === B.id ? B.name : "平局");
                    return `${win} ${b.outcomeTag || ''}`;
                });
                const settlementRecord = {
                    id: `st${settlementTs}`,
                    ts: settlementTs,
                    teamBaseExamId,
                    settleExamId,
                    teamBaseExamName: getExam(teamBaseExamId)?.name || '',
                    settleExamName: getExam(settleExamId)?.name || '',
                    mainPointUpdates: updates.map(item => ({ ...item })),
                    mainPointsApplied: !!applyResult.applied,
                    mainPointsAppliedCount: Number(applyResult.count) || 0,
                    battles: results.pBattles.map(b => ({
                        id: b.id,
                        teamAId: b.teamAId,
                        teamBId: b.teamBId,
                        stake: Number(b.stake) || 0,
                        isUnderdog: !!b.isUnderdog,
                        outcomeTag: b.outcomeTag,
                        winId: b.winId,
                        teamA: b.detail?.teamA || null,
                        teamB: b.detail?.teamB || null
                    }))
                };
                setBattle(prev => typeof state.applySettlement === 'function'
                    ? state.applySettlement(prev, newTeams, { time: getNow().toLocaleTimeString(), msg: logTxt.join(' / ') }, settlementRecord)
                    : prev);
                setResults(null);
                alert(applyResult.applied ? "结算完成，并已同步入账主积分" : "结算完成，主积分未入账");
            };

            const startNewSeason = () => {
                if (!results) return alert("请先进行结算模拟");
                if (!confirm("确定归档并开启新赛季吗？")) return;
                createBattleSnapshotEntry('开启新赛季前');
                const seasonRecord = {
                    id: history.length + 1,
                    date: new Date().toLocaleDateString(),
                    results: results.tRes.map(r => ({ name: r.name, finalPts: r.newPts })),
                    battles: results.pBattles
                };
                setBattle(prev => typeof state.startNewSeason === 'function' ? state.startNewSeason(prev, seasonRecord) : prev);
                setResults(null);
                alert("新赛季已开启");
            };

            return h("div", { className: "rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 p-4 md:p-6 shadow-[0_0_40px_rgba(59,130,246,0.15)] space-y-6" },
                h("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4" },
                    h("div", { className: "flex items-center gap-3" },
                        h("div", { className: "p-2 rounded-2xl bg-slate-800/60 border border-slate-700/60" }, h(Icon, { name: "swords", size: 22 })),
                        h("div", null,
                            h("div", { className: "text-lg font-bold tracking-wide" }, "双子星对战系统"),
                            h("div", { className: "text-xs text-slate-400" }, `第 ${season} 赛季`)
                        )
                    ),
                    h("div", { className: "flex flex-wrap gap-2" },
                        h("button", { onClick: handleInit, className: "px-3 py-2 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs" }, "按当前学生初始化"),
                        h("button", { onClick: handleResetPoints, className: "px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs" }, "重置战队积分"),
                        h("button", { onClick: handleExport, className: "px-3 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs flex items-center gap-1" }, h(Icon, { name: "download", size: 14 }), "导出对战备份"),
                        h("label", { className: "px-3 py-2 rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 text-xs cursor-pointer flex items-center gap-1" }, h(Icon, { name: "upload", size: 14 }), "导入对战备份", h("input", { type: "file", className: "hidden", accept: ".json", onChange: handleImport })),
                        h("button", { onClick: () => { createBattleSnapshotEntry('手动快照'); alert('已生成双子星快照'); }, className: "px-3 py-2 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs" }, "保存战况快照"),
                        !examUnlocked && h("button", { onClick: () => { if (requireAdminAuth("请输入管理员密码：")) setExamUnlocked(true); }, className: "px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs" }, "解锁排名"),
                        examUnlocked && h("button", { onClick: () => setExamUnlocked(false), className: "px-3 py-2 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs" }, "锁定排名")
                    )
                ),
                h("div", { className: "bg-slate-900/70 border border-slate-700/60 rounded-2xl p-4 space-y-3" },
                    h("div", { className: "flex flex-wrap items-center justify-between gap-2" },
                        h("div", { className: "font-bold text-slate-100" }, "战况快照"),
                        h("div", { className: "text-xs text-slate-400" }, "自动记录导入备份、确认结算、开启新赛季前的双子星状态")
                    ),
                    snapshotList.length === 0
                        ? h("div", { className: "text-xs text-slate-500" }, "暂无双子星快照")
                        : h("div", { className: "space-y-2 max-h-44 overflow-y-auto" },
                            snapshotList.slice(0, 8).map(item => h("div", { key: item.id, className: "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/60 bg-slate-950/40 px-3 py-2 text-xs" },
                                h("div", null,
                                    h("div", { className: "text-slate-100 font-medium" }, item.reason || '未命名快照'),
                                    h("div", { className: "text-slate-400 mt-1" }, new Date(item.ts || Date.now()).toLocaleString('zh-CN', { hour12: false }))
                                ),
                                h("div", { className: "flex items-center gap-2" },
                                    h("button", { onClick: () => handleRestoreBattleSnapshot(item.id), className: "px-3 py-1 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-100" }, "预览恢复"),
                                    h("button", { onClick: () => handleDeleteBattleSnapshot(item.id), className: "px-3 py-1 rounded bg-rose-500/20 border border-rose-400/40 text-rose-100" }, "删除")
                                )
                            ))
                        )
                ),
                h("div", { className: "bg-slate-900/70 border border-slate-700/60 rounded-2xl p-4 space-y-3" },
                    h("div", { className: "flex flex-wrap items-center justify-between gap-2" },
                        h("div", { className: "font-bold text-slate-100" }, "考试档案选择"),
                        h("div", { className: "text-xs text-slate-400" }, "导入和删除请到维护页的考试档案模块")
                    ),
                    h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
                        h("div", { className: "bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 space-y-2" },
                            h("div", { className: "text-xs text-slate-400" }, "考试设置"),
                            h("div", { className: "flex flex-wrap gap-2" },
                                h("label", { className: "text-xs text-slate-400" }, "组队基准"),
                                h("select", { className: "bg-slate-900/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs", value: teamBaseExamId || '', onChange: e => setBattlePatch({ teamBaseExamId: e.target.value }) },
                                    h("option", { value: "" }, "请选择"),
                                    exams.map(ex => h("option", { key: ex.id, value: ex.id }, ex.name))
                                ),
                                h("label", { className: "text-xs text-slate-400 ml-2" }, "结算考试"),
                                h("select", { className: "bg-slate-900/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs", value: settleExamId || '', onChange: e => setBattlePatch({ settleExamId: e.target.value }) },
                                    h("option", { value: "" }, "请选择"),
                                    exams.map(ex => h("option", { key: ex.id, value: ex.id }, ex.name))
                                )
                            ),
                            h("div", { className: "space-y-2 max-h-40 overflow-y-auto" },
                                exams.length === 0
                                    ? h("div", { className: "text-xs text-slate-500" }, "暂无考试档案")
                                    : exams.map(ex => h("div", {
                                        key: ex.id,
                                        className: `flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${teamBaseExamId === ex.id ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-100' : 'bg-slate-900/60 border-slate-800/60 text-slate-300'}`
                                    },
                                        h("button", { onClick: () => setBattlePatch({ teamBaseExamId: ex.id }), className: "flex-1 text-left" }, `${ex.name} · ${Object.keys(ex.ranks || {}).length}人`),
                                        settleExamId === ex.id && h("span", { className: "ml-2 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 text-[10px]" }, "结算")
                                    ))
                            )
                        ),
                        h("div", { className: "bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 space-y-2" },
                            h("div", { className: "text-xs text-slate-400" }, "基准档案预览"),
                            h("div", { className: "max-h-40 overflow-y-auto border border-slate-800/60 rounded-lg" },
                                h("table", { className: "w-full text-xs text-left" },
                                    h("thead", { className: "bg-slate-900/80 text-slate-400 sticky top-0" },
                                        h("tr", null,
                                            h("th", { className: "p-2" }, "姓名"),
                                            h("th", { className: "p-2 text-center" }, "班排"),
                                            h("th", { className: "p-2 text-center" }, "级排"),
                                            h("th", { className: "p-2 text-center" }, "层级")
                                        )
                                    ),
                                    h("tbody", null,
                                        (Array.isArray(students) ? students : []).map(s => {
                                            const r = getRankFromExam(teamBaseExamId, s.id) || {};
                                            return h("tr", { key: s.id, className: "border-t border-slate-800/60" },
                                                h("td", { className: "p-2" }, s.name),
                                                h("td", { className: "p-2 text-center font-mono" }, formatRank(Number(r.c))),
                                                h("td", { className: "p-2 text-center font-mono" }, formatRank(Number(r.g))),
                                                h("td", { className: "p-2 text-center font-mono" }, getTierLabel(s))
                                            );
                                        })
                                    )
                                )
                            )
                        )
                    )
                ),
                h("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6" },
                    h("div", { className: "bg-slate-900/70 border border-slate-700/60 rounded-2xl p-4 space-y-3" },
                        h("div", { className: "font-bold text-slate-100" }, "组队区"),
                        h("div", { className: "text-xs text-slate-400" }, "基准考试将学生划分为 T1/T2/T3；考试档案导入和删除请到维护页。"),
                        h("div", { className: "space-y-2 max-h-72 overflow-y-auto" },
                            teams.map(t => h("div", { key: t.id, className: "bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 text-xs space-y-2" },
                                h("div", { className: "grid grid-cols-1 md:grid-cols-5 gap-2 items-center" },
                                    h("input", { className: "bg-slate-900/60 border border-slate-700/60 rounded px-2 py-1 text-xs md:col-span-2", value: t.name || '', onChange: e => updateTeam(t.id, { name: e.target.value }) }),
                                    h("select", { className: "bg-slate-900/60 border border-slate-700/60 rounded px-2 py-1 text-xs w-full", value: t.memberIds?.[0] || '', onChange: e => updateTeam(t.id, { memberIds: [e.target.value, t.memberIds?.[1] || ''] }) },
                                        h("option", { value: "" }, "成员A"),
                                        (Array.isArray(students) ? students : []).map(s => h("option", { key: s.id, value: s.id }, `${s.name} (${getTierLabel(s)})`))
                                    ),
                                    h("select", { className: "bg-slate-900/60 border border-slate-700/60 rounded px-2 py-1 text-xs w-full", value: t.memberIds?.[1] || '', onChange: e => updateTeam(t.id, { memberIds: [t.memberIds?.[0] || '', e.target.value] }) },
                                        h("option", { value: "" }, "成员B"),
                                        (Array.isArray(students) ? students : []).map(s => h("option", { key: s.id, value: s.id }, `${s.name} (${getTierLabel(s)})`))
                                    ),
                                    h("button", { onClick: () => removeTeam(t.id), className: "px-2 py-1 text-xs bg-rose-500/20 border border-rose-400/40 text-rose-200 rounded" }, "删除")
                                ),
                                h("div", { className: "text-[10px] text-slate-400" }, `成员层级: ${getMemberTierText(t.memberIds?.[0])} / ${getMemberTierText(t.memberIds?.[1])}`)
                            ))
                        ),
                        h("button", { onClick: addTeam, className: "w-full py-2 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs" }, "新增战队")
                    ),
                    h("div", { className: "bg-slate-900/70 border border-slate-700/60 rounded-2xl p-4 space-y-3" },
                        h("div", { className: "font-bold text-slate-100" }, "结盟区"),
                        h("div", { className: "space-y-2 max-h-72 overflow-y-auto" },
                            squads.map(sq => h("div", { key: sq.id, className: "bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 text-xs" },
                                h("div", { className: "grid grid-cols-1 md:grid-cols-5 gap-2 items-center" },
                                    h("input", { className: "bg-slate-900/60 border border-slate-700/60 rounded px-2 py-1 text-xs md:col-span-2", value: sq.name || '', onChange: e => updateSquad(sq.id, { name: e.target.value }) }),
                                    h("select", { className: "bg-slate-900/60 border border-slate-700/60 rounded px-2 py-1 text-xs w-full", value: sq.teamIds?.[0] || '', onChange: e => updateSquad(sq.id, { teamIds: [e.target.value, sq.teamIds?.[1] || ''] }) },
                                        h("option", { value: "" }, "队伍A"),
                                        teams.map(t => h("option", { key: t.id, value: t.id }, t.name))
                                    ),
                                    h("select", { className: "bg-slate-900/60 border border-slate-700/60 rounded px-2 py-1 text-xs w-full", value: sq.teamIds?.[1] || '', onChange: e => updateSquad(sq.id, { teamIds: [sq.teamIds?.[0] || '', e.target.value] }) },
                                        h("option", { value: "" }, "队伍B"),
                                        teams.map(t => h("option", { key: t.id, value: t.id }, t.name))
                                    ),
                                    h("button", { onClick: () => removeSquad(sq.id), className: "px-2 py-1 text-xs bg-rose-500/20 border border-rose-400/40 text-rose-200 rounded" }, "删除")
                                )
                            ))
                        ),
                        h("button", { onClick: addSquad, className: "w-full py-2 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs" }, "新增共鸣")
                    )
                ),
                h("div", { className: "bg-slate-900/70 border border-slate-700/60 rounded-2xl p-4" },
                    h("div", { className: "font-bold text-slate-100 mb-2" }, "战队排名"),
                    h("div", { className: "text-xs text-slate-400 mb-3" }, "按队伍成员班排之和排序"),
                    h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-2" },
                        sortedTeams.map((t, idx) => h("div", { key: t.id, className: "flex items-center justify-between bg-slate-950/40 border border-slate-800/60 rounded-xl px-3 py-2 text-xs" },
                            h("div", { className: "flex items-center gap-2" },
                                h("span", { className: "text-cyan-300 font-mono" }, `#${idx + 1}`),
                                h("span", null, t.name)
                            ),
                            h("div", { className: "text-slate-300" }, `积分 ${Number(t.points) || 0}`)
                        ))
                    )
                ),
                h("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6" },
                    h("div", { className: "bg-slate-900/70 border border-slate-700/60 rounded-2xl p-4 space-y-3" },
                        h("div", { className: "font-bold text-slate-100" }, "宣战区"),
                        h("div", { className: "text-xs text-slate-400" }, "按队伍成员班排之和排序"),
                        h("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2" },
                            h("select", { className: "bg-slate-900/60 border border-slate-700/60 rounded px-2 py-2 text-xs", value: challengeForm.from, onChange: e => setChallengeForm({ ...challengeForm, from: e.target.value }) },
                                h("option", { value: "" }, "挑战方"),
                                sortedTeams.map(t => h("option", { key: t.id, value: t.id, disabled: activeTeamIds.has(t.id) }, `${t.name}`))
                            ),
                            h("select", { className: "bg-slate-900/60 border border-slate-700/60 rounded px-2 py-2 text-xs", value: challengeForm.to, onChange: e => setChallengeForm({ ...challengeForm, to: e.target.value }) },
                                h("option", { value: "" }, "应战方"),
                                sortedTeams.map(t => h("option", { key: t.id, value: t.id, disabled: activeTeamIds.has(t.id) }, `${t.name}`))
                            ),
                            h("input", { type: "number", min: 0, max: BATTLE_MAX_STAKE, className: "bg-slate-900/60 border border-slate-700/60 rounded px-2 py-2 text-xs", value: challengeForm.stake, onChange: e => setChallengeForm({ ...challengeForm, stake: e.target.value }) })
                        ),
                        h("div", { className: "flex flex-wrap gap-2" },
                            h("button", { onClick: handleAddChallenge, className: "px-3 py-2 rounded-xl bg-cyan-500/30 border border-cyan-400/40 text-cyan-100 text-xs" }, "发起挑战"),
                            h("button", { onClick: handleAutoMatch, className: "px-3 py-2 rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-100 text-xs" }, "自动匹配")
                        ),
                        h("div", { className: "space-y-2 max-h-64 overflow-y-auto" },
                            battles.length === 0 ? h("div", { className: "text-xs text-slate-500" }, "暂无挑战") :
                            battles.map(b => {
                                const A = teams.find(t => t.id === b.teamAId);
                                const B = teams.find(t => t.id === b.teamBId);
                                return h("div", { key: b.id, className: "grid grid-cols-1 md:grid-cols-6 gap-2 items-center bg-slate-950/40 border border-slate-800/60 rounded-xl p-2 text-xs" },
                                    h("div", { className: "md:col-span-2" }, A?.name || "未知队伍"),
                                    h("div", { className: "text-center text-amber-200" }, `${b.stake || 0} 分`),
                                    h("div", { className: "md:col-span-2 text-right" }, B?.name || "未知队伍"),
                                    h("div", { className: "text-[10px] text-yellow-300" }, b.isUnderdog ? "下克上" : "常规"),
                                    h("div", { className: "flex gap-2 justify-end" },
                                        h("button", { onClick: () => handleRefuse(b.id), className: "px-2 py-1 text-[10px] bg-rose-500/20 border border-rose-400/40 text-rose-200 rounded" }, "拒绝"),
                                        h("button", { onClick: () => removeBattle(b.id), className: "px-2 py-1 text-[10px] bg-slate-800/80 border border-slate-700/60 rounded" }, "移除")
                                    )
                                );
                            })
                        )
                    ),
                    h("div", { className: "bg-slate-900/70 border border-slate-700/60 rounded-2xl p-4 space-y-3" },
                        h("div", { className: "font-bold text-slate-100" }, "结算区"),
                        h("div", { className: "text-xs text-slate-400" }, "选择结算考试与组队基准考试对比"),
                        h("div", { className: "flex flex-wrap gap-2" },
                            h("select", { className: "bg-slate-900/60 border border-slate-700/60 rounded px-2 py-2 text-xs", value: teamBaseExamId || '', onChange: e => setBattlePatch({ teamBaseExamId: e.target.value }) },
                                h("option", { value: "" }, "组队基准"),
                                exams.map(ex => h("option", { key: ex.id, value: ex.id }, ex.name))
                            ),
                            h("select", { className: "bg-slate-900/60 border border-slate-700/60 rounded px-2 py-2 text-xs", value: settleExamId || '', onChange: e => setBattlePatch({ settleExamId: e.target.value }) },
                                h("option", { value: "" }, "结算考试"),
                                exams.map(ex => h("option", { key: ex.id, value: ex.id }, ex.name))
                            )
                        ),
                        !results ? h("div", { className: "flex items-center justify-center py-6" },
                            h("button", { onClick: simulate, className: "px-4 py-2 rounded-xl bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-sm", disabled: battles.length === 0 }, "开始模拟结算")
                        ) : h("div", { className: "space-y-3" },
                            h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto" },
                                results.tRes.map(r => h("div", { key: r.id, className: "border border-slate-800/60 rounded-xl p-2 text-xs" },
                                    h("div", { className: "flex justify-between font-bold" },
                                        h("span", null, r.name),
                                        h("span", { className: (r.newPts - r.currentPts) >= 0 ? 'text-emerald-300' : 'text-rose-300' }, `${(r.newPts - r.currentPts) >= 0 ? '+' : ''}${(r.newPts - r.currentPts).toFixed(1)}`)
                                    ),
                                    h("div", { className: "text-[10px] text-slate-400 mt-1 flex justify-between" },
                                        h("span", null, `成员得分: ${r.newPts.toFixed(1)}`),
                                        h("span", null, r.msgs.join('、'))
                                    )
                                ))
                            ),
                            h("div", { className: "flex gap-2" },
                                h("button", { onClick: () => setResults(null), className: "px-3 py-2 rounded-xl bg-slate-500/30 border border-slate-400/40 text-slate-100 text-xs" }, "重新模拟"),
                                h("button", { onClick: confirmSettlement, className: "flex-1 px-3 py-2 rounded-xl bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-xs" }, "确认结算"),
                                h("button", { onClick: startNewSeason, className: "flex-1 px-3 py-2 rounded-xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 text-xs" }, "归档并开启新赛季")
                            )
                        )
                    )
                ),
                h("div", { className: "bg-slate-900/70 border border-slate-700/60 rounded-2xl p-4 space-y-3" },
                    h("div", { className: "font-bold text-slate-100" }, "对战明细"),
                    settlements.length === 0 ? h("div", { className: "text-xs text-slate-500" }, "暂无结算记录") : h("div", { className: "space-y-3" },
                        h("div", { className: "flex flex-wrap gap-2" },
                            h("select", { className: "bg-slate-900/60 border border-slate-700/60 rounded px-2 py-2 text-xs", value: selectedSettlementId || '', onChange: e => setSelectedSettlementId(e.target.value) },
                                settlements.map(s => h("option", { key: s.id, value: s.id }, `${s.teamBaseExamName || '基准'} → ${s.settleExamName || '结算'} · ${new Date(s.ts || Date.now()).toLocaleDateString()}`))
                            ),
                            h("select", { className: "bg-slate-900/60 border border-slate-700/60 rounded px-2 py-2 text-xs", value: selectedTeamId || '', onChange: e => setSelectedTeamId(e.target.value) },
                                currentSettlementTeams.map(id => h("option", { key: id, value: id }, getSettlementTeamName(currentSettlement, id) || id))
                            )
                        ),
                        detailBattles.length === 0 ? h("div", { className: "text-xs text-slate-500" }, "暂无对战明细") :
                        h("div", { className: "space-y-2" },
                            detailBattles.map(b => {
                                const isA = b.teamAId === selectedTeamId;
                                const self = isA ? b.teamA : b.teamB;
                                const opp = isA ? b.teamB : b.teamA;
                                if (!self || !opp) return h("div", { key: b.id, className: "text-xs text-slate-500" }, "对战数据缺失");
                                const outcome = b.winId ? (b.winId === self.id ? '胜' : '负') : '平局';
                                const tags = [b.outcomeTag, b.isUnderdog ? '下克上' : '常规'].filter(Boolean).join(' · ');
                                return h("div", { key: b.id, className: "border border-slate-800/60 rounded-xl p-3 text-xs space-y-2 bg-slate-950/40" },
                                    h("div", { className: "flex flex-wrap items-center justify-between gap-2" },
                                        h("div", { className: "font-bold text-slate-100" }, `${self.name} vs ${opp.name}`),
                                        h("div", { className: outcome === '胜' ? "text-emerald-300" : (outcome === '负' ? "text-rose-300" : "text-slate-300") }, outcome)
                                    ),
                                    h("div", { className: "text-[10px] text-slate-400" }, tags),
                                    h("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] text-slate-300" },
                                        h("div", null, `CP: ${formatNum(self.cp)} | K: ${formatNum(self.k)}`),
                                        h("div", null, `公式: ${self.formula}`),
                                        h("div", null, `积分变化: ${formatNum(self.delta)} (${formatNum(self.currentPts)} → ${formatNum(self.newPts)})`)
                                    ),
                                    self.msgs && self.msgs.length > 0 && h("div", { className: "text-[10px] text-cyan-200" }, self.msgs.join('、')),
                                    h("div", { className: "space-y-1 text-[10px] text-slate-400" },
                                        (self.memberDetails || []).map((m, idx) => h("div", { key: `${b.id}_${idx}` },
                                            `成员${idx + 1} ${m.name} | 基准 ${formatRank(Number(m.base?.c))}/${formatRank(Number(m.base?.g))} | 结算 ${formatRank(Number(m.settle?.c))}/${formatRank(Number(m.settle?.g))} | 绝对值 ${formatNum(m.abs)} | 进步差 ${formatNum(m.delta)} | 进步分 ${formatNum(m.prog)} | 总分 ${formatNum(m.total)} | 年级进步 ${formatNum(m.gradeImp)} | 保护 ${m.safe ? '是' : '否'} | ${m.tierLabel} ${formatNum(m.tierK)}`
                                        ))
                                    )
                                );
                            })
                        )
                    )
                ),
                h(Modal, {
                    isOpen: transferPreview.open,
                    title: transferPreview.title || "双子星导入预览",
                    onClose: () => setTransferPreview({ open: false, title: '', summary: null, missingStudents: [], onConfirm: null, confirmText: '确认' }),
                    onConfirm: transferPreview.onConfirm,
                    confirmText: transferPreview.confirmText || "确认"
                },
                    h("div", { className: "space-y-3 text-sm text-gray-700" },
                        transferPreview.summary && h("div", { className: "grid grid-cols-2 gap-2 text-xs" },
                            h("div", { className: "rounded bg-gray-50 p-2" }, `战队 ${transferPreview.summary.teams}`),
                            h("div", { className: "rounded bg-gray-50 p-2" }, `共鸣 ${transferPreview.summary.squads}`),
                            h("div", { className: "rounded bg-gray-50 p-2" }, `对战 ${transferPreview.summary.battles}`),
                            h("div", { className: "rounded bg-gray-50 p-2" }, `结算 ${transferPreview.summary.settlements}`),
                            h("div", { className: "rounded bg-gray-50 p-2 col-span-2" }, `考试 ${transferPreview.summary.exams}`)
                        ),
                        transferPreview.missingStudents && transferPreview.missingStudents.length > 0
                            ? h("div", { className: "rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700" },
                                h("div", { className: "font-bold mb-1" }, "以下学生未能映射到当前名单"),
                                h("div", null, transferPreview.missingStudents.join('、'))
                            )
                            : h("div", { className: "rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700" }, "学生映射检查通过，可安全导入或恢复。")
                    )
                )
            );
        };
    };
})();
