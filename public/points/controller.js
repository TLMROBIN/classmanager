(function() {
    const isSameStudentId = (left, right) => {
        if (left == null || right == null) return left === right;
        return String(left) === String(right);
    };

    const persistThenCommit = ({ onPersist, payload, commit }) => {
        const verifyAndCommit = (saved) => {
            if (saved?.skipped || saved?.success === false) {
                throw new Error('服务端未确认保存，请恢复会话后重试');
            }
            return commit();
        };
        if (typeof onPersist !== 'function') return commit();
        const persistenceResult = onPersist(payload);
        if (persistenceResult && typeof persistenceResult.then === 'function') {
            return Promise.resolve(persistenceResult).then(verifyAndCommit);
        }
        return verifyAndCommit(persistenceResult);
    };

    const buildBatchPointState = ({
        updates,
        students,
        history,
        GUEST_ROSTER,
        ts,
        normalizePointScene,
        normalizePointCategory
    }) => {
        const sourceStudents = (Array.isArray(students) && students.length > 0) ? students : GUEST_ROSTER;
        const sourceHistory = Array.isArray(history) ? history : [];
        const nextStudents = sourceStudents.map(student => ({ ...student }));
        const nextHistoryRecords = [];

        (Array.isArray(updates) ? updates : []).forEach(update => {
            const idx = nextStudents.findIndex(student => isSameStudentId(student.id, update.id));
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

        return {
            count: nextHistoryRecords.length,
            nextStudents,
            nextHistory: [...nextHistoryRecords, ...sourceHistory]
        };
    };

    const batchUpdatePoints = ({
        updates,
        students,
        history,
        POINT_SCENES,
        POINT_CATEGORIES,
        getNow,
        setStudents,
        setHistory,
        GUEST_ROSTER,
        normalizePointScene,
        normalizePointCategory,
        onPersist
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
        const result = buildBatchPointState({
            updates,
            students,
            history,
            GUEST_ROSTER,
            ts,
            normalizePointScene,
            normalizePointCategory
        });

        if (result.count === 0) return 0;

        const commitLocalState = () => {
            if (typeof setStudents === 'function') {
                setStudents(result.nextStudents);
            }
            if (typeof setHistory === 'function') {
                setHistory(result.nextHistory);
            }
            return result.count;
        };

        return persistThenCommit({
            onPersist,
            payload: result,
            commit: commitLocalState
        });
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

    const getLocalDateKey = (date) => {
        const target = new Date(date);
        if (isNaN(target.getTime())) return "";
        const year = target.getFullYear();
        const month = String(target.getMonth() + 1).padStart(2, '0');
        const day = String(target.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const isWageHistoryRecord = (item) => {
        const reason = typeof item?.reason === 'string' ? item.reason : "";
        return reason === "每日工资" || reason.startsWith("班级职务津贴");
    };

    const handleUndo = ({
        recordId,
        history,
        students,
        setStudents,
        setHistory,
        normalizePointScene,
        normalizePointCategory,
        applyRelatedUndo,
        onPersist,
        onCommitRelated
    }) => {
        const record = (Array.isArray(history) ? history : []).find(item => item.id === recordId);
        if (!record || record.isUndoLog) return false;

        const nextStudents = (Array.isArray(students) ? students : []).map(student => ({ ...student }));
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

        let finalStudents = nextStudents;
        let finalHistory = [undoEntry, ...filteredHistory];
        let relatedPatch = {};
        if (typeof applyRelatedUndo === 'function') {
            const relatedResult = applyRelatedUndo({
                record,
                students: finalStudents,
                history: finalHistory
            });
            if (relatedResult && relatedResult.changed) {
                if (Array.isArray(relatedResult.students)) finalStudents = relatedResult.students;
                if (Array.isArray(relatedResult.history)) finalHistory = relatedResult.history;
                ['storage', 'liquidatedTreasures', 'logs'].forEach(key => {
                    if (Object.prototype.hasOwnProperty.call(relatedResult, key)) {
                        relatedPatch[key] = relatedResult[key];
                    }
                });
            }
        }

        const persistencePayload = {
            nextStudents: finalStudents,
            nextHistory: finalHistory,
            ...relatedPatch
        };
        return persistThenCommit({
            onPersist,
            payload: persistencePayload,
            commit: () => {
                setStudents(finalStudents);
                setHistory(finalHistory);
                if (typeof onCommitRelated === 'function') onCommitRelated(relatedPatch);
                return true;
            }
        });
    };

    const handleWage = ({
        config,
        students,
        history,
        getNow,
        getSystemConfig,
        getCustomRoles,
        setStudents,
        setHistory,
        setConfig,
        GUEST_ROSTER,
        normalizePointScene,
        normalizePointCategory,
        onPersist,
        onFeedback
    }) => {
        const notify = (type, message) => {
            if (typeof onFeedback === 'function') onFeedback({ type, message });
        };
        const now = typeof getNow === 'function' ? getNow() : new Date();
        const today = getLocalDateKey(now);
        const alreadyIssuedToday = (Array.isArray(history) ? history : []).some(item => (
            item &&
            !item.isUndoLog &&
            isWageHistoryRecord(item) &&
            getLocalDateKey(item.ts) === today
        ));
        if (alreadyIssuedToday) {
            notify('warning', "今日一键工资已发放，每天只能发一次。");
            return 0;
        }

        const systemConfig = getSystemConfig(config);
        const baseWage = Number(systemConfig.points?.dailyWageAmount);
        const dailyWageAmount = Number.isFinite(baseWage) ? baseWage : 5;
        const wageGroups = Array.isArray(systemConfig.points?.dailyWageGroups)
            ? systemConfig.points.dailyWageGroups
            : ['discipline', 'hygiene'];
        const targets = (Array.isArray(students) ? students : []).filter(student => wageGroups.includes(student.group));
        const customRoles = getCustomRoles(config);
        const paidCustomRoles = customRoles.filter(role => role && role.studentId != null && Number(role.dailyWage) !== 0);

        if (targets.length === 0 && paidCustomRoles.length === 0) {
            notify('warning', "没有找到可发放工资或津贴的对象，请检查工资小组和班级职务配置。");
            return 0;
        }

        const updates = targets.map(target => ({
            id: target.id,
            val: target.role === 'leader' ? dailyWageAmount + 1 : dailyWageAmount,
            reason: "每日工资",
            type: 'bonus',
            scene: "班级",
            category: "班务"
        }));

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

        const result = buildBatchPointState({
            updates,
            students,
            history,
            GUEST_ROSTER,
            ts: now.getTime(),
            normalizePointScene,
            normalizePointCategory
        });

        const persistencePayload = {
                nextStudents: result.nextStudents,
                nextHistory: result.nextHistory
        };
        return persistThenCommit({
            onPersist,
            payload: persistencePayload,
            commit: () => {
                if (typeof setStudents === 'function') setStudents(result.nextStudents);
                if (typeof setHistory === 'function') setHistory(result.nextHistory);
                return result.count;
            }
        });
    };

    window.PointsController = {
        batchUpdatePoints,
        updatePoints,
        handleUndo,
        handleWage
    };
})();
