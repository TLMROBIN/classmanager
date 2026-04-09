'use strict';

const REFUND_RATE = 0.7;
const SALE_RATE = 0.85;

const roundToHalf = (value) => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.floor(value * 2) / 2;
};

const getLiquidationConfig = (config) => {
    const systemConfig = config && typeof config === 'object' && config.systemConfig
        ? config.systemConfig
        : config;
    if (!systemConfig || typeof systemConfig !== 'object') return { enabled: false };
    const liq = systemConfig.treasureLiquidation;
    return liq && typeof liq === 'object' ? liq : { enabled: false };
};

const getTreasurePriceForLiquidation = (item) => {
    if (!item || typeof item !== 'object') return 0;
    if (Array.isArray(item.ladderPrices) && item.ladderPrices.length > 0) {
        return item.ladderPrices[0];
    }
    const price = Number(item.price);
    return Number.isFinite(price) ? price : 0;
};

const liquidateStudent = ({ student, storage, treasures, liquidatedTreasures, history, logs, now }) => {
    const studentId = String(student.id);
    const studentStorage = storage && typeof storage === 'object' ? storage[studentId] : null;
    if (!studentStorage || typeof studentStorage !== 'object' || Object.keys(studentStorage).length === 0) {
        return { changed: false };
    }

    let balance = Number(student.balance);
    if (!Number.isFinite(balance)) balance = 0;
    if (balance >= 0) return { changed: false };

    const items = [];
    for (const [itemId, count] of Object.entries(studentStorage)) {
        const numCount = Number(count);
        if (!Number.isFinite(numCount) || numCount <= 0) continue;
        const treasure = (Array.isArray(treasures) ? treasures : []).find(t => String(t.id) === String(itemId));
        if (!treasure) continue;
        const price = getTreasurePriceForLiquidation(treasure);
        if (price <= 0) continue;
        items.push({ itemId, treasure, price, count: numCount });
    }

    if (items.length === 0) return { changed: false };

    items.sort((a, b) => a.price - b.price);

    const nextStorage = { ...(storage && typeof storage === 'object' ? storage : {}) };
    const nextStudentStorage = { ...(nextStorage[studentId] || {}) };
    let nextBalance = balance;
    const nextLiquidatedTreasures = Array.isArray(liquidatedTreasures) ? [...liquidatedTreasures] : [];
    const newHistoryEntries = [];
    const newLogEntries = [];
    const nowTs = typeof now === 'object' && now !== null ? now.getTime() : Date.now();

    for (const item of items) {
        for (let i = 0; i < item.count; i++) {
            if (nextBalance >= 0) break;

            const itemCount = nextStudentStorage[item.itemId] || 0;
            if (itemCount <= 0) break;

            const refund = roundToHalf(item.price * REFUND_RATE);
            const salePrice = roundToHalf(item.price * SALE_RATE);

            nextStudentStorage[item.itemId] = itemCount - 1;
            if (nextStudentStorage[item.itemId] <= 0) {
                delete nextStudentStorage[item.itemId];
            }
            nextBalance += refund;

        const liquidatedId = `liq_${item.treasure.id}_${nowTs}_${Math.random().toString(36).slice(2, 8)}`;
        nextLiquidatedTreasures.push({
            id: liquidatedId,
            originalTreasureId: item.treasure.id,
            name: item.treasure.name,
            rarity: item.treasure.rarity || 'N',
            price: salePrice,
            originalPrice: item.price,
            stock: 1,
            desc: `清算物品（原价 ${item.price}）`,
            dailyLimit: 0,
            ladderPrices: [],
            liquidation: true
        });

        const snapshot = {
            zizai: Number(student.zizai) || 0,
            balance: balance,
            penalty: Number(student.penalty) || 0
        };

        newHistoryEntries.push({
            id: nowTs + Math.random(),
            ts: nowTs,
            studentId: student.id,
            studentName: student.name,
            val: refund,
            reason: `清算退回: ${item.treasure.name}`,
            snapshot,
            type: 'bonus',
            scene: '班级',
            category: '清算'
        });

        newLogEntries.push({
            id: nowTs + Math.random(),
            ts: nowTs,
            studentName: student.name,
            action: '清算',
            itemName: item.treasure.name,
            rarity: item.treasure.rarity || 'N',
            cost: refund,
            note: `返还${refund}，上架${salePrice}`
        });

        balance = nextBalance;
        }
    }

    if (Object.keys(nextStudentStorage).length === 0) {
        delete nextStorage[studentId];
    } else {
        nextStorage[studentId] = nextStudentStorage;
    }

    return {
        changed: true,
        balance: nextBalance,
        storage: nextStorage,
        liquidatedTreasures: nextLiquidatedTreasures,
        history: newHistoryEntries,
        logs: newLogEntries
    };
};

const applyBankruptcyLiquidation = ({ students, storage, treasures, liquidatedTreasures, history, logs, config, now }) => {
    const liqConfig = getLiquidationConfig(config);
    if (!liqConfig.enabled) {
        return { changed: false };
    }

    const studentList = Array.isArray(students) ? students : [];
    const negativeStudents = studentList.filter(s => {
        const balance = Number(s?.balance);
        return Number.isFinite(balance) && balance < 0;
    });

    if (negativeStudents.length === 0) {
        return { changed: false };
    }

    let currentStorage = storage && typeof storage === 'object' ? JSON.parse(JSON.stringify(storage)) : {};
    let currentLiquidated = Array.isArray(liquidatedTreasures) ? [...liquidatedTreasures] : [];
    let currentHistory = Array.isArray(history) ? [...history] : [];
    let currentLogs = Array.isArray(logs) ? [...logs] : [];
    let anyChanged = false;

    const nextStudents = studentList.map(student => {
        const result = liquidateStudent({
            student,
            storage: currentStorage,
            treasures,
            liquidatedTreasures: currentLiquidated,
            history: currentHistory,
            logs: currentLogs,
            now
        });

        if (!result.changed) return student;

        anyChanged = true;
        currentStorage = result.storage;
        currentLiquidated = result.liquidatedTreasures;
        currentHistory = [...result.history, ...currentHistory];
        currentLogs = [...result.logs, ...currentLogs];

        return { ...student, balance: result.balance };
    });

    if (!anyChanged) {
        return { changed: false };
    }

    return {
        changed: true,
        students: nextStudents,
        storage: currentStorage,
        liquidatedTreasures: currentLiquidated,
        history: currentHistory,
        logs: currentLogs
    };
};

module.exports = {
    roundToHalf,
    getLiquidationConfig,
    getTreasurePriceForLiquidation,
    liquidateStudent,
    applyBankruptcyLiquidation
};
