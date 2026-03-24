(function() {
    const batchUpdatePoints = ({
        updates,
        POINT_SCENES,
        POINT_CATEGORIES,
        getNow,
        setStudents,
        setHistory,
        GUEST_ROSTER,
        normalizePointScene,
        normalizePointCategory
    }) => {
        if (!Array.isArray(updates) || updates.length === 0) return 0;
        const invalid = updates.find(update => (
            !update.scene ||
            !update.category ||
            !POINT_SCENES.includes(update.scene) ||
            !POINT_CATEGORIES.includes(update.category)
        ));
        if (invalid) {
            alert("请先选择场景与类别");
            return 0;
        }

        const ts = getNow().getTime();

        setStudents(prevStudents => {
            const sourceStudents = (Array.isArray(prevStudents) && prevStudents.length > 0) ? prevStudents : GUEST_ROSTER;
            const nextStudents = sourceStudents.map(student => ({ ...student }));
            const nextHistoryRecords = [];

            updates.forEach(update => {
                const idx = nextStudents.findIndex(student => student.id === update.id);
                if (idx === -1) return;

                const student = nextStudents[idx];
                student.zizai = Number.isFinite(Number(student.zizai)) ? Number(student.zizai) : 0;
                student.balance = Number.isFinite(Number(student.balance)) ? Number(student.balance) : 0;
                student.penalty = Number.isFinite(Number(student.penalty)) ? Number(student.penalty) : 0;

                const snapshot = {
                    zizai: student.zizai,
                    balance: student.balance,
                    penalty: student.penalty
                };
                const parsedVal = Number(update.val);
                const val = Number.isFinite(parsedVal) ? parsedVal : 0;

                if (val > 0) student.zizai += val;
                student.balance += val;
                if (val < 0 && update.type === 'penalty') {
                    student.penalty += Math.abs(val);
                    student.lastPenaltyAt = ts;
                }

                nextHistoryRecords.push({
                    id: ts + Math.random(),
                    ts,
                    studentId: student.id,
                    studentName: student.name,
                    val,
                    reason: update.reason,
                    snapshot,
                    type: update.type,
                    scene: normalizePointScene(update.scene),
                    category: normalizePointCategory(update.category)
                });
            });

            setHistory(prevHistory => {
                const sourceHistory = Array.isArray(prevHistory) ? prevHistory : [];
                return [...nextHistoryRecords, ...sourceHistory];
            });

            return nextStudents;
        });

        return updates.length;
    };

    const updatePoints = ({
        ids,
        val,
        reason,
        type = 'bonus',
        scene,
        category,
        POINT_SCENES,
        POINT_CATEGORIES,
        batchUpdatePoints
    }) => {
        if (!scene || !category || !POINT_SCENES.includes(scene) || !POINT_CATEGORIES.includes(category)) {
            alert("请先选择场景与类别");
            return 0;
        }
        const updates = Array.from(ids).map(id => ({ id, val, reason, type, scene, category }));
        return batchUpdatePoints(updates);
    };

    const handleUndo = ({
        recordId,
        history,
        students,
        setStudents,
        setHistory,
        normalizePointScene,
        normalizePointCategory
    }) => {
        const record = (Array.isArray(history) ? history : []).find(item => item.id === recordId);
        if (!record || record.isUndoLog) return;

        const nextStudents = [...(Array.isArray(students) ? students : [])];
        const idx = nextStudents.findIndex(student => student.id === record.studentId);
        let undoSnapshot = null;

        if (idx !== -1) {
            const student = nextStudents[idx];
            const val = record.val || 0;

            undoSnapshot = {
                zizai: student.zizai,
                balance: student.balance,
                penalty: student.penalty
            };

            if (val > 0) {
                student.zizai = (student.zizai || 0) - val;
            }
            student.balance = (student.balance || 0) - val;
            if (val < 0 && record.type === 'penalty') {
                student.penalty = Math.max(0, (student.penalty || 0) + val);
            }

            if (record.type === 'penalty') {
                const filteredPenalties = history.filter(item => (
                    item.id !== recordId &&
                    String(item.studentId) === String(record.studentId) &&
                    item.type === 'penalty' &&
                    !item.isUndoLog
                ));
                if (filteredPenalties.length > 0) {
                    const lastPenalty = filteredPenalties.reduce((latest, item) => item.ts > latest.ts ? item : latest, filteredPenalties[0]);
                    student.lastPenaltyAt = lastPenalty.ts;
                } else {
                    student.lastPenaltyAt = 0;
                }
            }
        }

        const filteredHistory = history.filter(item => item.id !== recordId);
        const ts = Date.now();
        const undoEntry = {
            id: ts + Math.random(),
            ts,
            studentId: record.studentId,
            studentName: record.studentName,
            val: -record.val,
            reason: "撤销扣分: " + (record.reason || ""),
            snapshot: undoSnapshot || { zizai: 0, balance: 0, penalty: 0 },
            type: "bonus",
            isUndoLog: true,
            scene: normalizePointScene(record.scene),
            category: normalizePointCategory(record.category)
        };

        setStudents(nextStudents);
        setHistory([undoEntry, ...filteredHistory]);
    };

    const handleUndoByReasons = ({
        studentId,
        reasons,
        history,
        handleUndo
    }) => {
        const reasonList = Array.isArray(reasons) ? reasons.filter(Boolean) : [reasons].filter(Boolean);
        if (reasonList.length === 0) return;
        const record = (Array.isArray(history) ? history : []).find(item => (
            String(item.studentId) === String(studentId) &&
            !item.isUndoLog &&
            reasonList.includes(item.reason)
        ));
        if (!record) return alert("未找到对应的加扣分记录");
        handleUndo(record.id);
    };

    const handleWage = ({
        config,
        students,
        getTodayStr,
        getSystemConfig,
        getCustomRoles,
        batchUpdatePoints,
        setConfig
    }) => {
        const today = getTodayStr();
        if (config.lastWageDate === today) {
            if (!confirm("今日工资似乎已发放，确定要再次发放吗？")) return;
        }

        const systemConfig = getSystemConfig(config);
        const baseWage = Number(systemConfig.points?.dailyWageAmount);
        const dailyWageAmount = Number.isFinite(baseWage) ? baseWage : 5;
        const wageGroups = Array.isArray(systemConfig.points?.dailyWageGroups)
            ? systemConfig.points.dailyWageGroups
            : ['discipline', 'hygiene'];
        const targets = (Array.isArray(students) ? students : []).filter(student => wageGroups.includes(student.group));
        const psychologyCommitteeIds = config.psychologyCommittee || [null, null, null, null];
        const validPsychologyIds = psychologyCommitteeIds.filter(id => id != null);
        const customRoles = getCustomRoles(config);
        const paidCustomRoles = customRoles.filter(role => role && role.studentId != null && Number(role.dailyWage) !== 0);

        if (targets.length === 0 && validPsychologyIds.length === 0 && paidCustomRoles.length === 0) {
            return alert("没有找到可发放工资或津贴的对象");
        }

        const updates = targets.map(target => ({
            id: target.id,
            val: target.role === 'leader' ? dailyWageAmount + 1 : dailyWageAmount,
            reason: "每日工资",
            type: 'bonus',
            scene: "班级",
            category: "班务"
        }));

        validPsychologyIds.forEach(psychologyId => {
            updates.push({
                id: psychologyId,
                val: 1,
                reason: "心理委员津贴",
                type: 'bonus',
                scene: "班级",
                category: "班务"
            });
        });

        paidCustomRoles.forEach(role => {
            updates.push({
                id: role.studentId,
                val: Number(role.dailyWage) || 0,
                reason: `班级职务津贴${role.name ? `: ${role.name}` : ''}`,
                type: 'bonus',
                scene: "班级",
                category: "班务"
            });
        });

        batchUpdatePoints(updates);
        setConfig({ ...config, lastWageDate: today });

        const extraNotes = [];
        if (validPsychologyIds.length > 0) extraNotes.push(`${validPsychologyIds.length}位心理委员津贴`);
        if (paidCustomRoles.length > 0) extraNotes.push(`${paidCustomRoles.length}个班级职务津贴`);
        alert(`发放完成${extraNotes.length > 0 ? `（含${extraNotes.join("，")}）` : ''}`);
    };

    window.PointsController = {
        batchUpdatePoints,
        updatePoints,
        handleUndo,
        handleUndoByReasons,
        handleWage
    };
})();
