(function() {
    window.createBattleSimulator = function(deps) {
        const {
            getLatestExamArchiveRank,
            battleGetSafeThreshold,
            battleGetTier
        } = deps;

        const getExamById = (exams, examId) => (Array.isArray(exams) ? exams : []).find(item => item.id === examId);

        const getRankFromExam = ({ exams, examId, studentId }) => {
            const exam = getExamById(exams, examId);
            if (!exam) return null;
            const record = exam.records?.[studentId] || exam.records?.[String(studentId)] || null;
            const rank = exam.ranks?.[studentId] || exam.ranks?.[String(studentId)] || null;
            const rawC = record?.totalClassRank != null ? record.totalClassRank : rank?.c;
            const rawG = record?.totalGradeRank != null ? record.totalGradeRank : rank?.g;
            const c = Number.isFinite(Number(rawC)) ? Number(rawC) : null;
            const g = Number.isFinite(Number(rawG)) ? Number(rawG) : null;
            if (c == null && g == null) return null;
            return { c, g };
        };

        const getBaseRank = ({ student, exams, teamBaseExamId, examArchives, totalStudents }) => {
            const rank = getRankFromExam({ exams, examId: teamBaseExamId, studentId: student.id });
            const latestRank = getLatestExamArchiveRank(examArchives, student.id);
            if (rank && Number.isFinite(rank.c)) {
                return {
                    c: rank.c,
                    g: Number.isFinite(rank.g) ? rank.g : (latestRank?.g || Number(student.lastGradeRank) || totalStudents * 10)
                };
            }
            return {
                c: latestRank?.c || Number(student.lastClassRank) || totalStudents,
                g: latestRank?.g || Number(student.lastGradeRank) || totalStudents * 10
            };
        };

        const getSettleRank = ({ student, exams, settleExamId, examArchives, totalStudents, baseRank }) => {
            const rank = getRankFromExam({ exams, examId: settleExamId, studentId: student.id });
            const latestRank = getLatestExamArchiveRank(examArchives, student.id);
            if (rank && Number.isFinite(rank.c)) {
                return {
                    c: rank.c,
                    g: Number.isFinite(rank.g) ? rank.g : (latestRank?.g || Number(student.lastGradeRank) || totalStudents * 10)
                };
            }
            return { c: baseRank.c, g: baseRank.g };
        };

        const getTierLabel = ({ student, exams, teamBaseExamId, examArchives, totalStudents }) => {
            const base = getBaseRank({ student, exams, teamBaseExamId, examArchives, totalStudents });
            const c = Number(base.c) || totalStudents;
            if (c <= 8) return 'T1';
            if (c <= 22) return 'T2';
            return 'T3';
        };

        const calcMemberDetail = ({ student, exams, teamBaseExamId, settleExamId, examArchives, totalStudents }) => {
            if (!student) return { id: '', name: '-', base: null, settle: null, abs: 0, delta: 0, prog: 0, total: 0, gradeImp: 0, safe: false, tierLabel: '-', tierK: 1 };
            const base = getBaseRank({ student, exams, teamBaseExamId, examArchives, totalStudents });
            const settle = getSettleRank({ student, exams, settleExamId, examArchives, totalStudents, baseRank: base });
            const baseClassRank = Number(base.c) || totalStudents;
            const newClassR = Number(settle.c) || totalStudents;
            const abs = (totalStudents + 1 - newClassR) * 1.5;
            let delta = baseClassRank - newClassR;
            if (newClassR <= 5 && delta >= 0) {
                if (newClassR === 1) delta = Math.max(delta, 5);
                else if (newClassR <= 3) delta = Math.max(delta, 3);
                else delta = Math.max(delta, 2);
            }
            const prog = delta * 5;
            const total = Math.max(10, abs + prog);
            const baseGradeRank = Number(base.g) || Number(settle.g) || totalStudents * 10;
            const newGradeR = Number(settle.g) || baseGradeRank;
            const gradeImp = baseGradeRank - newGradeR;
            const safe = gradeImp >= battleGetSafeThreshold(baseGradeRank);
            const tier = battleGetTier(Number(base.c) || totalStudents);
            return { id: student.id, name: student.name, base, settle, abs, delta, prog, total, gradeImp, safe, tierLabel: tier.label, tierK: tier.k };
        };

        const buildTeamDetail = ({ team, students, exams, teamBaseExamId, settleExamId, examArchives, totalStudents }) => {
            const studentList = Array.isArray(students) ? students : [];
            const m1 = studentList.find(s => s.id === team.memberIds?.[0]);
            const m2 = studentList.find(s => s.id === team.memberIds?.[1]);
            const d1 = calcMemberDetail({ student: m1, exams, teamBaseExamId, settleExamId, examArchives, totalStudents });
            const d2 = calcMemberDetail({ student: m2, exams, teamBaseExamId, settleExamId, examArchives, totalStudents });
            const k = (Number(d1.tierK) + Number(d2.tierK)) / 2;
            const cp = (Number(d1.total) + Number(d2.total)) * k;
            return { members: [m1 ? m1.name : '-', m2 ? m2.name : '-'], memberDetails: [d1, d2], k, cp };
        };

        const teamRankSum = ({ team, students, exams, teamBaseExamId, examArchives, totalStudents }) => {
            const memberIds = Array.isArray(team.memberIds) ? team.memberIds : [];
            if (memberIds.length === 0) return totalStudents * 2;
            const studentList = Array.isArray(students) ? students : [];
            return memberIds.reduce((acc, id) => {
                const student = studentList.find(stu => stu.id === id);
                if (!student) return acc + totalStudents;
                const rank = getBaseRank({ student, exams, teamBaseExamId, examArchives, totalStudents });
                return acc + (Number(rank.c) || totalStudents);
            }, 0);
        };

        const simulateBattle = ({ teams, squads, battles, students, exams, teamBaseExamId, settleExamId, examArchives, totalStudents, battleMaxStake }) => {
            const safeTotalStudents = Math.max(Number(totalStudents) || 0, 1);
            const sortedTeams = [...(Array.isArray(teams) ? teams : [])].sort((a, b) => {
                const rankA = teamRankSum({ team: a, students, exams, teamBaseExamId, examArchives, totalStudents: safeTotalStudents });
                const rankB = teamRankSum({ team: b, students, exams, teamBaseExamId, examArchives, totalStudents: safeTotalStudents });
                return rankA - rankB;
            });
            const teamRankIndex = new Map(sortedTeams.map((team, idx) => [team.id, idx + 1]));
            const tRes = (Array.isArray(teams) ? teams : []).map(team => {
                const detail = buildTeamDetail({
                    team,
                    students,
                    exams,
                    teamBaseExamId,
                    settleExamId,
                    examArchives,
                    totalStudents: safeTotalStudents
                });
                const currentPts = Number(team.points) || 0;
                return {
                    id: team.id,
                    name: team.name,
                    currentPts,
                    cp: detail.cp,
                    k: detail.k,
                    newPts: currentPts,
                    msgs: [],
                    won: false,
                    isSafe: detail.memberDetails.some(item => item.safe),
                    members: detail.members,
                    memberDetails: detail.memberDetails
                };
            });

            const pBattles = (Array.isArray(battles) ? battles : []).map(battle => {
                const A = tRes.find(item => item.id === battle.teamAId);
                const B = tRes.find(item => item.id === battle.teamBId);
                if (!A || !B) return { ...battle, winId: null, outcomeTag: "无效对战", detail: null };
                let winner = A.cp > B.cp ? 'A' : (B.cp > A.cp ? 'B' : null);
                let outcomeTag = "";
                let formulaA = "不变";
                let formulaB = "不变";
                const stake = Math.max(0, Math.min(Number(battleMaxStake) || 0, Number(battle.stake) || 0));
                if (winner === 'A') {
                    A.won = true;
                    if (battle.isUnderdog) {
                        A.newPts = A.currentPts * 2 + stake;
                        B.newPts = B.currentPts - stake;
                        A.msgs.push("下克上翻倍");
                        outcomeTag = "下克上成立";
                        formulaA = `当前积分×2 + 赌注(${stake})`;
                        formulaB = `当前积分 - 赌注(${stake})`;
                    } else {
                        A.newPts = A.currentPts * 2 + stake;
                        B.newPts = -20 - stake;
                        outcomeTag = "常规胜";
                        formulaA = `当前积分×2 + 赌注(${stake})`;
                        formulaB = `-20 - 赌注(${stake})`;
                    }
                } else if (winner === 'B') {
                    B.won = true;
                    if (battle.isUnderdog) {
                        A.newPts = A.currentPts * 0.5 - stake;
                        B.newPts = B.currentPts * 2 + stake;
                        A.msgs.push("下克上抚恤");
                        outcomeTag = "下克上失败";
                        formulaA = `当前积分×0.5 - 赌注(${stake})`;
                        formulaB = `当前积分×2 + 赌注(${stake})`;
                    } else if (A.isSafe) {
                        A.newPts = A.currentPts * 0.5 - stake;
                        B.newPts = B.currentPts * 2 + stake;
                        A.msgs.push("外战保护");
                        outcomeTag = "外战保护";
                        formulaA = `当前积分×0.5 - 赌注(${stake})`;
                        formulaB = `当前积分×2 + 赌注(${stake})`;
                    } else {
                        A.newPts = -20 - stake;
                        B.newPts = B.currentPts * 2 + stake;
                        outcomeTag = "常规胜";
                        formulaA = `-20 - 赌注(${stake})`;
                        formulaB = `当前积分×2 + 赌注(${stake})`;
                    }
                } else {
                    outcomeTag = "平局";
                }
                return {
                    ...battle,
                    winId: winner === 'A' ? A.id : (winner === 'B' ? B.id : null),
                    outcomeTag,
                    detail: {
                        teamA: { id: A.id, name: A.name, currentPts: A.currentPts, newPts: A.newPts, delta: A.newPts - A.currentPts, cp: A.cp, k: A.k, isSafe: A.isSafe, members: A.members, memberDetails: A.memberDetails, formula: formulaA, msgs: [...A.msgs] },
                        teamB: { id: B.id, name: B.name, currentPts: B.currentPts, newPts: B.newPts, delta: B.newPts - B.currentPts, cp: B.cp, k: B.k, isSafe: B.isSafe, members: B.members, memberDetails: B.memberDetails, formula: formulaB, msgs: [...B.msgs] }
                    }
                };
            });

            const squadBonuses = (Array.isArray(squads) ? squads : []).map(squad => {
                const t1 = tRes.find(item => item.id === squad.teamIds?.[0]);
                const t2 = tRes.find(item => item.id === squad.teamIds?.[1]);
                if (t1?.won && t2?.won) {
                    t1.newPts = Math.round(t1.newPts * 1.2);
                    t2.newPts = Math.round(t2.newPts * 1.2);
                    t1.msgs.push("共鸣 +20%");
                    t2.msgs.push("共鸣 +20%");
                    return squad.name;
                }
                return null;
            }).filter(Boolean);

            const finalBattles = pBattles.map(battle => {
                if (!battle.detail) return battle;
                const A = tRes.find(item => item.id === battle.teamAId);
                const B = tRes.find(item => item.id === battle.teamBId);
                if (!A || !B) return battle;
                return {
                    ...battle,
                    detail: {
                        teamA: { ...battle.detail.teamA, newPts: A.newPts, delta: A.newPts - A.currentPts, msgs: [...A.msgs] },
                        teamB: { ...battle.detail.teamB, newPts: B.newPts, delta: B.newPts - B.currentPts, msgs: [...B.msgs] }
                    }
                };
            });

            return {
                results: { tRes, pBattles: finalBattles, squadBonuses },
                sortedTeams,
                teamRankIndex
            };
        };

        return {
            getRankFromExam,
            getBaseRank,
            getSettleRank,
            getTierLabel,
            calcMemberDetail,
            buildTeamDetail,
            teamRankSum,
            simulateBattle
        };
    };
})();
