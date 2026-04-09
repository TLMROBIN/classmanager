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

        const newLiquidatedTreasures = (Array.isArray(liquidatedTreasures) ? liquidatedTreasures : []).map(t => (
            t.id == itemId ? { ...t, stock: t.stock - 1 } : t
        ));

        const newStudents = (Array.isArray(students) ? students : []).map(s => (
            s.id == studentId ? { ...s, balance: s.balance - item.price } : s
        ));

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
            category: '兑奖'
        }, ...(Array.isArray(history) ? history : [])];

        const newLogs = [{
            id: ts + Math.random(),
            ts,
            studentName: student.name,
            action: '兑换',
            itemName: item.name,
            rarity: item.rarity || 'N',
            cost: item.price,
            note: '清算专区'
        }, ...(Array.isArray(logs) ? logs : [])];

        return {
            ok: true,
            newStudents,
            newHistory,
            newLiquidatedTreasures,
            newLogs
        };
    };

    window.TreasureLiquidation.buildLiquidatedRedeemState = buildLiquidatedRedeemState;
    window.TreasureLiquidation.roundToHalf = roundToHalf;
})();
