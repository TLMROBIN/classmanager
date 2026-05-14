(function() {
    window.TreasureLiquidation = {};

    const roundToHalf = (value) => {
        if (!Number.isFinite(value) || value <= 0) return 0;
        return Math.floor(value * 2) / 2;
    };

    const buildLiquidatedRedeemState = ({ studentId, itemId, students, liquidatedTreasures, storage, history, logs, getNow }) => {
        const student = (Array.isArray(students) ? students : []).find(s => s.id == studentId);
        const item = (Array.isArray(liquidatedTreasures) ? liquidatedTreasures : []).find(t => t.id == itemId);
        if (!student || !item) return { ok: false, message: '未找到学生或物品' };
        if (item.stock <= 0) return { ok: false, message: '库存不足' };
        if (student.balance < item.price) return { ok: false, message: '余额不足' };
        const storageItemId = item.originalTreasureId || item.id;

        const newLiquidatedTreasures = (Array.isArray(liquidatedTreasures) ? liquidatedTreasures : []).map(t => (
            t.id == itemId ? { ...t, stock: t.stock - 1 } : t
        ));

        const newStudents = (Array.isArray(students) ? students : []).map(s => (
            s.id == studentId ? { ...s, balance: s.balance - item.price } : s
        ));

        const newStorage = { ...(storage || {}) };
        const studentStore = { ...(newStorage[studentId] || {}) };
        studentStore[storageItemId] = (studentStore[storageItemId] || 0) + 1;
        newStorage[studentId] = studentStore;

        const ts = typeof getNow === 'function' ? getNow().getTime() : Date.now();
        const snapshot = {
            zizai: student.zizai,
            balance: student.balance,
            penalty: student.penalty
        };
        const newHistory = [{
            id: ts + Math.random(),
            ts,
            studentId: student.id,
            studentName: student.name,
            val: -item.price,
            reason: `兑换(清算): ${item.name}`,
            snapshot,
            type: 'spending',
            scene: '班级',
            category: '兑奖',
            liquidationBatchId: item.liquidationBatchId,
            liquidatedItemId: item.id,
            sourceHistoryId: item.sourceHistoryId
        }, ...(Array.isArray(history) ? history : [])];

        const newLogs = [{
            id: ts + Math.random(),
            ts,
            studentName: student.name,
            action: '清算',
            itemName: item.name,
            rarity: item.rarity || 'N',
            cost: item.price,
            note: '清算专区',
            liquidationBatchId: item.liquidationBatchId,
            liquidatedItemId: item.id,
            sourceHistoryId: item.sourceHistoryId,
            ownerStudentId: item.ownerStudentId,
            ownerStudentName: item.ownerStudentName
        }, ...(Array.isArray(logs) ? logs : [])];

        return {
            ok: true,
            newStudents,
            newHistory,
            newStorage,
            newLiquidatedTreasures,
            newLogs
        };
    };

    const sameId = (left, right) => String(left) === String(right);
    const toNumber = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    };
    const incrementStorage = (storage, studentId, itemId, delta) => {
        if (!studentId || !itemId || !Number.isFinite(Number(delta)) || Number(delta) === 0) return storage;
        const nextStorage = { ...(storage || {}) };
        const studentStore = { ...(nextStorage[studentId] || {}) };
        const nextCount = toNumber(studentStore[itemId]) + Number(delta);
        if (nextCount <= 0) delete studentStore[itemId];
        else studentStore[itemId] = nextCount;
        if (Object.keys(studentStore).length === 0) delete nextStorage[studentId];
        else nextStorage[studentId] = studentStore;
        return nextStorage;
    };
    const adjustStudentBalance = (students, studentId, delta) => (
        (Array.isArray(students) ? students : []).map(student => (
            sameId(student.id, studentId)
                ? { ...student, balance: toNumber(student.balance) + delta }
                : student
        ))
    );

    const rollbackLiquidationForUndo = ({ sourceHistoryId, students, storage, liquidatedTreasures, history, logs }) => {
        if (sourceHistoryId == null || sourceHistoryId === '') {
            return {
                changed: false,
                students,
                storage,
                liquidatedTreasures,
                history,
                logs
            };
        }

        const sourceId = String(sourceHistoryId);
        const sourceItems = (Array.isArray(liquidatedTreasures) ? liquidatedTreasures : []).filter(item => (
            String(item?.sourceHistoryId || '') === sourceId
        ));
        if (sourceItems.length === 0) {
            return {
                changed: false,
                students,
                storage,
                liquidatedTreasures,
                history,
                logs
            };
        }

        const liquidatedIds = new Set(sourceItems.map(item => String(item.id)));
        let nextStudents = (Array.isArray(students) ? students : []).map(student => ({ ...student }));
        let nextStorage = storage && typeof storage === 'object' ? JSON.parse(JSON.stringify(storage)) : {};
        const sourceHistory = Array.isArray(history) ? history : [];
        const refundEntries = sourceHistory.filter(entry => (
            String(entry?.sourceHistoryId || '') === sourceId
            && String(entry?.reason || '').startsWith('清算退回:')
        ));
        const purchaseEntries = sourceHistory.filter(entry => (
            liquidatedIds.has(String(entry?.liquidatedItemId || ''))
            && String(entry?.reason || '').startsWith('兑换(清算):')
        ));

        sourceItems.forEach(item => {
            const ownerId = item.ownerStudentId;
            const originalItemId = item.originalTreasureId || item.id;
            if (ownerId && originalItemId) {
                nextStorage = incrementStorage(nextStorage, ownerId, originalItemId, 1);
            }
        });

        refundEntries.forEach(entry => {
            nextStudents = adjustStudentBalance(nextStudents, entry.studentId, -toNumber(entry.val));
        });

        purchaseEntries.forEach(entry => {
            const item = sourceItems.find(sourceItem => sameId(sourceItem.id, entry.liquidatedItemId));
            const itemId = item?.originalTreasureId || item?.id;
            if (itemId) {
                nextStorage = incrementStorage(nextStorage, entry.studentId, itemId, -1);
            }
            nextStudents = adjustStudentBalance(nextStudents, entry.studentId, Math.abs(toNumber(entry.val)));
        });

        const nextLiquidatedTreasures = (Array.isArray(liquidatedTreasures) ? liquidatedTreasures : []).filter(item => !liquidatedIds.has(String(item?.id)));
        const removeHistoryIds = new Set([
            ...refundEntries.map(entry => String(entry.id)),
            ...purchaseEntries.map(entry => String(entry.id))
        ]);
        const nextHistory = sourceHistory.filter(entry => !removeHistoryIds.has(String(entry?.id)));
        const nextLogs = (Array.isArray(logs) ? logs : []).filter(entry => (
            String(entry?.sourceHistoryId || '') !== sourceId
            && !liquidatedIds.has(String(entry?.liquidatedItemId || ''))
        ));

        return {
            changed: true,
            students: nextStudents,
            storage: nextStorage,
            liquidatedTreasures: nextLiquidatedTreasures,
            history: nextHistory,
            logs: nextLogs
        };
    };

    window.TreasureLiquidation.buildLiquidatedRedeemState = buildLiquidatedRedeemState;
    window.TreasureLiquidation.rollbackLiquidationForUndo = rollbackLiquidationForUndo;
    window.TreasureLiquidation.roundToHalf = roundToHalf;
})();
