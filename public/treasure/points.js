(function() {
    const getTreasurePrice = ({ studentId, item, redemptionHistory }) => {
        if (!item || !Array.isArray(item.ladderPrices) || item.ladderPrices.length === 0) return item?.price;
        const history = redemptionHistory?.[studentId] || {};
        const count = history[item.id] || 0;
        const index = Math.min(count, item.ladderPrices.length - 1);
        return item.ladderPrices[index];
    };

    const getNextTreasurePriceHint = ({ studentId, item, redemptionHistory }) => {
        if (!item || !Array.isArray(item.ladderPrices) || item.ladderPrices.length === 0) return null;
        const history = redemptionHistory?.[studentId] || {};
        const count = history[item.id] || 0;
        if (count + 1 >= item.ladderPrices.length) return null;
        return `(下次: ${item.ladderPrices[count + 1]})`;
    };

    const getTreasureRefundPrice = ({ studentId, item, redemptionHistory }) => {
        if (!item || !Array.isArray(item.ladderPrices) || item.ladderPrices.length === 0) return item?.price;
        const history = redemptionHistory?.[studentId] || {};
        const count = history[item.id] || 0;
        if (count <= 0) return item.price;
        const index = Math.min(count - 1, item.ladderPrices.length - 1);
        return item.ladderPrices[index];
    };

    const buildTreasureRedeemState = ({ studentId, itemId, students, treasures, storage, history, logs, redemptionHistory, getNow }) => {
        const student = (Array.isArray(students) ? students : []).find(item => item.id === studentId);
        const treasure = (Array.isArray(treasures) ? treasures : []).find(item => item.id == itemId);
        if (!student || !treasure) return { ok: false };
        if (treasure.stock <= 0) return { ok: false, message: "库存不足" };

        const currentPrice = getTreasurePrice({ studentId, item: treasure, redemptionHistory });
        if (treasure.price < 0) {
            if (student.balance >= 0) return { ok: false, message: "负价格宝物只能在余额小于0时兑换" };
            if (student.balance - currentPrice > 0) return { ok: false, message: "兑换后余额不能大于0" };
        } else if (student.balance < currentPrice) {
            return { ok: false, message: "余额不足" };
        }

        const newTreasures = (Array.isArray(treasures) ? treasures : []).map(item => (
            item.id === treasure.id ? { ...item, stock: item.stock - 1 } : item
        ));
        const newStorage = { ...(storage || {}) };
        const studentStore = { ...(newStorage[studentId] || {}) };
        studentStore[itemId] = (studentStore[itemId] || 0) + 1;
        newStorage[studentId] = studentStore;

        const newRedemptionHistory = { ...(redemptionHistory || {}) };
        const studentHistory = { ...(newRedemptionHistory[studentId] || {}) };
        studentHistory[treasure.id] = (studentHistory[treasure.id] || 0) + 1;
        newRedemptionHistory[studentId] = studentHistory;

        const ts = typeof getNow === 'function' ? getNow().getTime() : Date.now();
        const newStudents = (Array.isArray(students) ? students : []).map(item => (
            item.id === studentId ? { ...item, balance: item.balance - currentPrice } : item
        ));
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
            val: -currentPrice,
            reason: `兑换: ${treasure.name}`,
            snapshot,
            type: 'spending',
            scene: "班级",
            category: "兑奖"
        }, ...(Array.isArray(history) ? history : [])];
        const newLogs = [{
            id: ts + Math.random(),
            ts,
            studentName: student.name,
            action: "兑换",
            itemName: treasure.name,
            rarity: treasure.rarity,
            cost: currentPrice,
            note: ""
        }, ...(Array.isArray(logs) ? logs : [])];

        return {
            ok: true,
            newStudents,
            newHistory,
            newTreasures,
            newStorage,
            newLogs,
            newRedemptionHistory
        };
    };

    const buildTreasureReturnState = ({ studentId, itemId, students, treasures, storage, history, logs, redemptionHistory, getNow }) => {
        const student = (Array.isArray(students) ? students : []).find(item => item.id === studentId);
        const treasure = (Array.isArray(treasures) ? treasures : []).find(item => item.id == itemId);
        if (!student || !treasure) return { ok: false };
        const count = storage?.[studentId]?.[itemId] || 0;
        if (count <= 0) return { ok: false };

        const refund = getTreasureRefundPrice({ studentId, item: treasure, redemptionHistory });

        const newStorage = { ...(storage || {}) };
        const studentStore = { ...(newStorage[studentId] || {}) };
        studentStore[itemId] = (studentStore[itemId] || 0) - 1;
        if (studentStore[itemId] <= 0) delete studentStore[itemId];
        if (Object.keys(studentStore).length === 0) delete newStorage[studentId];
        else newStorage[studentId] = studentStore;

        const newTreasures = (Array.isArray(treasures) ? treasures : []).map(item => (
            item.id === treasure.id ? { ...item, stock: item.stock + 1 } : item
        ));

        const newRedemptionHistory = { ...(redemptionHistory || {}) };
        const studentHistory = { ...(newRedemptionHistory[studentId] || {}) };
        const nextCount = (studentHistory[treasure.id] || 0) - 1;
        if (nextCount <= 0) delete studentHistory[treasure.id];
        else studentHistory[treasure.id] = nextCount;
        if (Object.keys(studentHistory).length === 0) delete newRedemptionHistory[studentId];
        else newRedemptionHistory[studentId] = studentHistory;

        const newStudents = (Array.isArray(students) ? students : []).map(item => (
            item.id === studentId ? { ...item, balance: item.balance + refund } : item
        ));
        const ts = typeof getNow === 'function' ? getNow().getTime() : Date.now();
        const newHistory = [{
            id: ts + Math.random(),
            ts,
            studentId: student.id,
            studentName: student.name,
            val: refund,
            reason: `退宝物: ${treasure.name}`,
            snapshot: { zizai: student.zizai, balance: student.balance, penalty: student.penalty },
            type: 'bonus',
            scene: "班级",
            category: "学业"
        }, ...(Array.isArray(history) ? history : [])];
        const newLogs = [{
            id: ts + Math.random(),
            ts,
            studentName: student.name,
            action: "退宝物",
            itemName: treasure.name,
            rarity: treasure.rarity,
            cost: refund,
            note: ""
        }, ...(Array.isArray(logs) ? logs : [])];

        return {
            ok: true,
            newStudents,
            newHistory,
            newTreasures,
            newStorage,
            newLogs,
            newRedemptionHistory
        };
    };

    const buildTreasureUseState = ({ studentId, itemId, students, treasures, storage, logs, dailyUsageCounts, getTodayStr, getNow }) => {
        const student = (Array.isArray(students) ? students : []).find(item => item.id === studentId);
        const treasure = (Array.isArray(treasures) ? treasures : []).find(item => item.id == itemId);
        if (!student) return { ok: false, message: "未找到学生" };
        if (!treasure) return { ok: false, message: "未找到物品" };
        const count = storage?.[studentId]?.[itemId] || 0;
        if (count <= 0) return { ok: false, message: "该物品数量不足" };

        const today = typeof getTodayStr === 'function' ? getTodayStr() : new Date().toISOString().slice(0, 10);
        if (treasure.dailyLimit > 0) {
            const currentCount = dailyUsageCounts?.[today]?.[itemId] || 0;
            if (currentCount >= treasure.dailyLimit) {
                return { ok: false, message: `该物品今日全班已使用 ${currentCount}/${treasure.dailyLimit} 次，达到上限。` };
            }
        }

        const newStorage = { ...(storage || {}) };
        const studentStore = { ...(newStorage[studentId] || {}) };
        studentStore[itemId] = (studentStore[itemId] || 0) - 1;
        if (studentStore[itemId] <= 0) delete studentStore[itemId];
        if (Object.keys(studentStore).length === 0) delete newStorage[studentId];
        else newStorage[studentId] = studentStore;

        const newDailyUsageCounts = { ...(dailyUsageCounts || {}) };
        const dayCounts = { ...(newDailyUsageCounts[today] || {}) };
        dayCounts[itemId] = (dayCounts[itemId] || 0) + 1;
        newDailyUsageCounts[today] = dayCounts;

        const ts = typeof getNow === 'function' ? getNow().getTime() : Date.now();
        const newLogs = [{
            id: ts + Math.random(),
            ts,
            studentName: student.name,
            action: "使用",
            itemName: treasure.name,
            rarity: treasure.rarity || "N",
            cost: 0,
            note: ""
        }, ...(Array.isArray(logs) ? logs : [])];

        return {
            ok: true,
            newStorage,
            newDailyUsageCounts,
            newLogs
        };
    };

    window.TreasurePoints = {
        getTreasurePrice,
        getNextTreasurePriceHint,
        getTreasureRefundPrice,
        buildTreasureRedeemState,
        buildTreasureReturnState,
        buildTreasureUseState
    };
})();
