(function() {
    const safeJsonParse = (text) => {
        try {
            return JSON.parse(text);
        } catch (err) {
            throw new Error('JSON 格式错误');
        }
    };

    const clone = (value) => JSON.parse(JSON.stringify(value));

    const normalizeBattlePayload = (payload) => ({
        version: Number(payload?.version) || 1,
        teams: Array.isArray(payload?.teams) ? payload.teams : [],
        squads: Array.isArray(payload?.squads) ? payload.squads : [],
        battles: Array.isArray(payload?.battles) ? payload.battles : [],
        logs: Array.isArray(payload?.logs) ? payload.logs : [],
        history: Array.isArray(payload?.history) ? payload.history : [],
        settlements: Array.isArray(payload?.settlements) ? payload.settlements : [],
        season: Number(payload?.season) || 1,
        rules: payload?.rules || {},
        teamBaseExamId: payload?.teamBaseExamId || '',
        settleExamId: payload?.settleExamId || ''
    });

    const buildStudentMaps = (students) => {
        const list = Array.isArray(students) ? students : [];
        return {
            nameToId: new Map(list.map(s => [String(s.name || '').trim(), s.id])),
            idToName: new Map(list.map(s => [s.id, String(s.name || '').trim()]))
        };
    };

    const mapExamRanks = (ranks, oldIdToName, nameToId) => {
        const mapped = {};
        const missingNames = [];
        Object.keys(ranks || {}).forEach(oldId => {
            const name = oldIdToName.get(oldId);
            if (!name) return;
            const newId = nameToId.get(name);
            if (!newId) {
                missingNames.push(name);
                return;
            }
            mapped[newId] = ranks[oldId];
        });
        return { mapped, missingNames };
    };

    const mapExamRecords = (records, oldIdToName, nameToId) => {
        const mapped = {};
        const missingNames = [];
        Object.keys(records || {}).forEach(oldId => {
            const name = oldIdToName.get(oldId);
            if (!name) return;
            const newId = nameToId.get(name);
            if (!newId) {
                missingNames.push(name);
                return;
            }
            mapped[newId] = records[oldId];
        });
        return { mapped, missingNames };
    };

    const mapBattleBackupToCurrentStudents = (payload, students) => {
        const importStudents = Array.isArray(payload?.students) ? payload.students : [];
        const { nameToId } = buildStudentMaps(students);
        const oldIdToName = new Map(importStudents.map(s => [s.id, String(s.name || '').trim()]));
        const missingStudents = new Set();

        const mapMember = (oldId) => {
            const name = oldIdToName.get(oldId);
            if (!name) return '';
            const nextId = nameToId.get(name);
            if (!nextId) {
                missingStudents.add(name);
                return '';
            }
            return nextId;
        };

        const teams = (payload?.teams || []).map(team => ({
            ...team,
            memberIds: (team.memberIds || []).map(mapMember)
        }));

        const examWarnings = new Set();
        const exams = (payload?.exams || []).map(exam => {
            const rankResult = mapExamRanks(exam.ranks || {}, oldIdToName, nameToId);
            const recordResult = mapExamRecords(exam.records || {}, oldIdToName, nameToId);
            rankResult.missingNames.forEach(name => examWarnings.add(name));
            recordResult.missingNames.forEach(name => examWarnings.add(name));
            return {
                ...exam,
                ranks: rankResult.mapped,
                records: recordResult.mapped
            };
        });

        return {
            battlePatch: normalizeBattlePayload({
                ...payload,
                teams
            }),
            examArchivesPatch: {
                version: 1,
                exams,
                latestExamId: exams[0]?.id || '',
                defaultBattleBaseExamId: '',
                defaultBattleSettleExamId: ''
            },
            missingStudents: Array.from(new Set([...missingStudents, ...examWarnings])).sort()
        };
    };

    const validateBattleBackupPayload = (payload) => {
        const issues = [];
        if (!payload || typeof payload !== 'object') issues.push('备份内容不是有效对象');
        if (!Array.isArray(payload?.teams)) issues.push('缺少战队数据');
        if (!Array.isArray(payload?.squads)) issues.push('缺少共鸣数据');
        if (!Array.isArray(payload?.settlements)) issues.push('缺少结算记录数组');
        if (payload?.exams && !Array.isArray(payload.exams)) issues.push('考试档案格式无效');
        return {
            ok: issues.length === 0,
            issues
        };
    };

    const buildBattleBackup = ({ battle, examArchives, students, now, getTodayStr }) => {
        const battleData = normalizeBattlePayload(battle);
        const exams = Array.isArray(examArchives?.exams) ? examArchives.exams : [];
        const payload = {
            version: 2,
            exportedAt: now,
            students: (Array.isArray(students) ? students : []).map(s => ({ id: s.id, name: s.name })),
            teams: clone(battleData.teams),
            squads: clone(battleData.squads),
            battles: clone(battleData.battles),
            logs: clone(battleData.logs),
            history: clone(battleData.history),
            settlements: clone(battleData.settlements),
            season: battleData.season,
            rules: clone(battleData.rules),
            exams: clone(exams),
            teamBaseExamId: battleData.teamBaseExamId,
            settleExamId: battleData.settleExamId
        };
        return {
            payload,
            filename: `battle_backup_${getTodayStr()}.json`
        };
    };

    const summarizeBattlePayload = (payload, missingStudents) => ({
        teams: Array.isArray(payload?.teams) ? payload.teams.length : 0,
        squads: Array.isArray(payload?.squads) ? payload.squads.length : 0,
        battles: Array.isArray(payload?.battles) ? payload.battles.length : 0,
        settlements: Array.isArray(payload?.settlements) ? payload.settlements.length : 0,
        exams: Array.isArray(payload?.exams) ? payload.exams.length : 0,
        missingStudents: Array.isArray(missingStudents) ? missingStudents : []
    });

    const parseBattleBackupText = ({ text, students }) => {
        const raw = safeJsonParse(text);
        const payload = raw.battle ? { ...raw.battle, students: raw.students || raw.battle.students, exams: raw.exams || raw.battle.exams } : raw;
        const validation = validateBattleBackupPayload(payload);
        if (!validation.ok) {
            throw new Error(validation.issues.join('；'));
        }
        const mapped = mapBattleBackupToCurrentStudents(payload, students);
        return {
            ...mapped,
            summary: summarizeBattlePayload(payload, mapped.missingStudents)
        };
    };

    const applySettlementPoints = ({ updates, summaryText, batchUpdatePoints }) => {
        if (!Array.isArray(updates) || updates.length === 0) {
            return { applied: false, count: 0, skipped: true };
        }
        if (typeof batchUpdatePoints !== 'function') {
            throw new Error('主积分入账函数缺失');
        }
        const shouldApply = confirm(summaryText || `本次双子星结算将生成 ${updates.length} 条主积分记录，是否同步入账？`);
        if (!shouldApply) {
            return { applied: false, count: updates.length, skipped: true };
        }
        const count = batchUpdatePoints(updates);
        const verifyCount = (savedCount) => {
            const numericCount = Number(savedCount);
            if (!Number.isFinite(numericCount) || numericCount !== updates.length) {
                throw new Error('主积分入账条数不完整，双子星结算未生效');
            }
            return { applied: true, count: numericCount };
        };
        if (count && typeof count.then === 'function') {
            return Promise.resolve(count).then(verifyCount);
        }
        return verifyCount(count);
    };

    window.BattleTransfer = {
        buildBattleBackup,
        applySettlementPoints,
        parseBattleBackupText,
        validateBattleBackupPayload,
        summarizeBattlePayload
    };
})();
