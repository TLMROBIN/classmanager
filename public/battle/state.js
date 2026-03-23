(function() {
    window.createBattleState = function(deps) {
        const {
            battleNormalize,
            battleInitTeams,
            battleInitSquads,
            BATTLE_INITIAL_POINTS
        } = deps;

        const applyBattlePatch = (battle, patch) => ({
            ...battleNormalize(battle),
            ...(patch || {})
        });

        const updateTeam = (battle, id, patch) => {
            const current = battleNormalize(battle);
            return { ...current, teams: current.teams.map(team => team.id === id ? { ...team, ...patch } : team) };
        };

        const updateSquad = (battle, id, patch) => {
            const current = battleNormalize(battle);
            return { ...current, squads: current.squads.map(squad => squad.id === id ? { ...squad, ...patch } : squad) };
        };

        const updateBattle = (battle, id, patch) => {
            const current = battleNormalize(battle);
            return { ...current, battles: current.battles.map(item => item.id === id ? { ...item, ...patch } : item) };
        };

        const addTeam = (battle) => {
            const current = battleNormalize(battle);
            const idx = current.teams.length + 1;
            return {
                ...current,
                teams: [...current.teams, { id: `t${idx}`, name: `双子星第${idx}组`, points: BATTLE_INITIAL_POINTS, memberIds: ['', ''] }]
            };
        };

        const addSquad = (battle) => {
            const current = battleNormalize(battle);
            const idx = current.squads.length + 1;
            return {
                ...current,
                squads: [...current.squads, { id: `sq${idx}`, name: `共鸣${idx}`, teamIds: ['', ''] }]
            };
        };

        const removeTeam = (battle, id) => {
            const current = battleNormalize(battle);
            return {
                ...current,
                teams: current.teams.filter(team => team.id !== id),
                squads: current.squads.map(squad => ({ ...squad, teamIds: (squad.teamIds || []).map(teamId => teamId === id ? '' : teamId) })),
                battles: current.battles.filter(item => item.teamAId !== id && item.teamBId !== id)
            };
        };

        const removeSquad = (battle, id) => {
            const current = battleNormalize(battle);
            return { ...current, squads: current.squads.filter(squad => squad.id !== id) };
        };

        const removeBattle = (battle, id) => {
            const current = battleNormalize(battle);
            return { ...current, battles: current.battles.filter(item => item.id !== id) };
        };

        const initializeBattle = (battle, students) => {
            const current = battleNormalize(battle);
            const teams = battleInitTeams(students);
            const squads = battleInitSquads(teams);
            return { ...current, teams, squads, battles: [] };
        };

        const resetPoints = (battle) => {
            const current = battleNormalize(battle);
            return { ...current, teams: current.teams.map(team => ({ ...team, points: BATTLE_INITIAL_POINTS })) };
        };

        const addChallenge = (battle, battleItem) => {
            const current = battleNormalize(battle);
            return { ...current, battles: [...current.battles, battleItem] };
        };

        const addBattles = (battle, newBattles) => {
            const current = battleNormalize(battle);
            return { ...current, battles: [...current.battles, ...(Array.isArray(newBattles) ? newBattles : [])] };
        };

        const refuseBattle = (battle, battleId, stakeVal, message) => {
            const current = battleNormalize(battle);
            const target = current.battles.find(item => item.id === battleId);
            if (!target) return current;
            const teams = current.teams.map(team => {
                if (team.id !== target.teamBId) return team;
                return { ...team, points: (Number(team.points) || 0) - (Number(stakeVal) || 0) };
            });
            return {
                ...current,
                teams,
                battles: current.battles.filter(item => item.id !== battleId),
                logs: [{ time: message.time, msg: message.msg }, ...current.logs]
            };
        };

        const applyTransferPatch = (battle, patch) => ({
            ...battleNormalize(battle),
            ...(patch || {})
        });

        const applySettlement = (battle, newTeams, logMessage, settlementRecord) => {
            const current = battleNormalize(battle);
            return {
                ...current,
                teams: Array.isArray(newTeams) ? newTeams : current.teams,
                battles: [],
                logs: [{ time: logMessage.time, msg: logMessage.msg }, ...current.logs],
                settlements: [settlementRecord, ...current.settlements]
            };
        };

        const startNewSeason = (battle, seasonRecord) => {
            const current = battleNormalize(battle);
            return {
                ...current,
                teams: current.teams.map(team => ({ ...team, points: BATTLE_INITIAL_POINTS })),
                battles: [],
                logs: [],
                history: [seasonRecord, ...current.history],
                season: current.season + 1
            };
        };

        return {
            applyBattlePatch,
            updateTeam,
            updateSquad,
            updateBattle,
            addTeam,
            addSquad,
            removeTeam,
            removeSquad,
            removeBattle,
            initializeBattle,
            resetPoints,
            addChallenge,
            addBattles,
            refuseBattle,
            applyTransferPatch,
            applySettlement,
            startNewSeason
        };
    };
})();
