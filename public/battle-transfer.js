(function() {
    const SNAPSHOT_KEY = 'cm_battle_snapshots_v1';
    const MAX_SNAPSHOTS = 20;

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
            const result = mapExamRanks(exam.ranks || {}, oldIdToName, nameToId);
            result.missingNames.forEach(name => examWarnings.add(name));
            return { ...exam, ranks: result.mapped };
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

    const normalizeBattleSnapshots = (list) => {
        if (!Array.isArray(list)) return [];
        return list
            .filter(item => item && typeof item === 'object' && item.payload)
            .map((item, idx) => ({
                id: item.id || `battle_snap_${item.ts || Date.now()}_${idx}`,
                reason: item.reason || '手动快照',
                ts: Number(item.ts) || Date.now(),
                payload: item.payload
            }))
            .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
            .slice(0, MAX_SNAPSHOTS);
    };

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

    const readLegacySnapshots = () => {
        try {
            const raw = localStorage.getItem(SNAPSHOT_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return normalizeBattleSnapshots(list);
        } catch (_) {
            return [];
        }
    };

    const writeLegacySnapshots = (list) => {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(list));
    };

    const buildBattleSnapshotEntry = ({ reason, battle, examArchives, students, now }) => ({
            id: `battle_snap_${now}`,
            reason: reason || '手动快照',
            ts: now,
            payload: buildBattleBackup({
                battle,
                examArchives,
                students,
                now,
                getTodayStr: () => new Date(now).toISOString().slice(0, 10)
            }).payload
        });

    const createBattleSnapshot = ({ reason, battle, examArchives, students, now }) => {
        const list = readLegacySnapshots();
        const entry = buildBattleSnapshotEntry({ reason, battle, examArchives, students, now });
        list.unshift(entry);
        writeLegacySnapshots(normalizeBattleSnapshots(list));
        return entry;
    };

    const listBattleSnapshots = () => readLegacySnapshots();

    const getBattleSnapshotById = (id) => readLegacySnapshots().find(item => item.id === id) || null;

    const clearLegacyBattleSnapshots = () => {
        try {
            localStorage.removeItem(SNAPSHOT_KEY);
        } catch (_) {}
    };

    window.BattleTransfer = {
        buildBattleBackup,
        buildBattleSnapshotEntry,
        parseBattleBackupText,
        validateBattleBackupPayload,
        normalizeBattleSnapshots,
        createBattleSnapshot,
        listBattleSnapshots,
        getBattleSnapshotById,
        readLegacySnapshots,
        clearLegacyBattleSnapshots,
        summarizeBattlePayload
    };
})();
