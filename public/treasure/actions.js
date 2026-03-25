(function() {
    const getTreasurePoints = () => window.TreasurePoints || {};
    const sameId = (left, right) => String(left) === String(right);
    const DEFAULT_GACHA_RATES = Object.freeze({
        SSR: 0.05,
        SR: 4.95,
        R: 25,
        N: 70
    });
    const DEFAULT_GACHA_COSTS = Object.freeze({
        single: 15,
        ten: 120
    });

    const normalizeGachaRates = (gachaConfig) => {
        const source = gachaConfig && typeof gachaConfig === 'object' ? gachaConfig : {};
        const sourceRates = source.rates && typeof source.rates === 'object' ? source.rates : source;
        const sourceCosts = source.costs && typeof source.costs === 'object' ? source.costs : source;
        const rates = {
            SSR: Number(sourceRates.SSR),
            SR: Number(sourceRates.SR),
            R: Number(sourceRates.R),
            N: Number(sourceRates.N)
        };
        const isValid = ['SSR', 'SR', 'R', 'N'].every((rarity) => Number.isFinite(rates[rarity]) && rates[rarity] >= 0);
        const total = rates.SSR + rates.SR + rates.R + rates.N;
        const costs = {
            single: Number.isFinite(Number(sourceCosts.single)) && Number(sourceCosts.single) >= 0 ? Number(sourceCosts.single) : DEFAULT_GACHA_COSTS.single,
            ten: Number.isFinite(Number(sourceCosts.ten)) && Number(sourceCosts.ten) >= 0 ? Number(sourceCosts.ten) : DEFAULT_GACHA_COSTS.ten
        };
        if (!isValid || Math.abs(total - 100) > 0.01) {
            return {
                rates: { ...DEFAULT_GACHA_RATES },
                costs
            };
        }
        return {
            rates,
            costs
        };
    };

    const prependLog = ({ logs, ts, studentName, action, itemName, rarity, cost, note = "" }) => ([{
        id: ts + Math.random(),
        ts,
        studentName,
        action,
        itemName,
        rarity,
        cost,
        note
    }, ...(Array.isArray(logs) ? logs : [])]);

    const parseTreasureDraft = ({ draft, editMode }) => {
        const source = draft || {};
        const ladderPrices = String(source.ladderPrices ?? "")
            .split(',')
            .map(item => parseFloat(String(item).trim()))
            .filter(item => !Number.isNaN(item));
        const parsedPrice = parseFloat(source.price);
        const parsedStock = parseInt(source.stock, 10);
        const parsedDailyLimit = parseInt(source.dailyLimit, 10);

        return {
            id: editMode ? source.id : Date.now(),
            name: String(source.name || "").trim(),
            rarity: source.rarity || 'N',
            price: Number.isNaN(parsedPrice) ? 0 : parsedPrice,
            stock: Number.isNaN(parsedStock) ? 0 : parsedStock,
            desc: source.desc || "",
            ladderPrices,
            dailyLimit: Number.isNaN(parsedDailyLimit) ? 0 : parsedDailyLimit
        };
    };

    const buildTreasureRedeemAction = (params) => {
        const treasurePoints = getTreasurePoints();
        if (typeof treasurePoints.buildTreasureRedeemState !== 'function') {
            return { ok: false, message: "藏宝阁规则未加载" };
        }
        const result = treasurePoints.buildTreasureRedeemState(params);
        if (!result?.ok) return result || { ok: false, message: "兑换失败" };
        return {
            ok: true,
            nextState: {
                students: result.newStudents,
                history: result.newHistory,
                treasures: result.newTreasures,
                storage: result.newStorage,
                logs: result.newLogs,
                redemptionHistory: result.newRedemptionHistory
            }
        };
    };

    const buildTreasureReturnAction = (params) => {
        const treasurePoints = getTreasurePoints();
        if (typeof treasurePoints.buildTreasureReturnState !== 'function') {
            return { ok: false, message: "藏宝阁规则未加载" };
        }
        const result = treasurePoints.buildTreasureReturnState(params);
        if (!result?.ok) return result || { ok: false, message: "退回失败" };
        return {
            ok: true,
            nextState: {
                students: result.newStudents,
                history: result.newHistory,
                treasures: result.newTreasures,
                storage: result.newStorage,
                logs: result.newLogs,
                redemptionHistory: result.newRedemptionHistory
            }
        };
    };

    const buildTreasureUseAction = (params) => {
        const treasurePoints = getTreasurePoints();
        if (typeof treasurePoints.buildTreasureUseState !== 'function') {
            return { ok: false, message: "藏宝阁规则未加载" };
        }
        const result = treasurePoints.buildTreasureUseState(params);
        if (!result?.ok) return result || { ok: false, message: "使用失败" };
        return {
            ok: true,
            nextState: {
                storage: result.newStorage,
                logs: result.newLogs,
                dailyUsageCounts: result.newDailyUsageCounts
            }
        };
    };

    const buildTreasureGachaAction = ({ studentId, times, students, treasures, storage, history, logs, gachaConfig, getNow }) => {
        const sourceStudents = Array.isArray(students) ? students : [];
        const sourceTreasures = Array.isArray(treasures) ? treasures : [];
        const sourceStorage = storage && typeof storage === 'object' ? storage : {};
        const sourceHistory = Array.isArray(history) ? history : [];
        const sourceLogs = Array.isArray(logs) ? logs : [];
        const normalizedGachaConfig = normalizeGachaRates(gachaConfig);
        const gachaRates = normalizedGachaConfig.rates;
        const gachaCosts = normalizedGachaConfig.costs;
        const drawTimes = Number(times) === 10 ? 10 : 1;
        const student = sourceStudents.find(item => sameId(item.id, studentId));
        if (!student) return { ok: false, message: "未找到祈愿对象" };

        const cost = drawTimes === 1 ? gachaCosts.single : gachaCosts.ten;
        if (Number(student.balance) < cost) {
            return { ok: false, message: "积分不足" };
        }

        const availableTreasures = sourceTreasures.filter(item => Number(item.stock) > 0);
        if (availableTreasures.length === 0) {
            return { ok: false, message: "藏宝阁已被搬空！" };
        }

        const pick = (list) => list[Math.floor(Math.random() * list.length)];
        const results = [];
        for (let i = 0; i < drawTimes; i += 1) {
            const roll = Math.random() * 100;
            let targetRarity = 'N';
            let threshold = gachaRates.SSR;
            if (roll < threshold) targetRarity = 'SSR';
            else {
                threshold += gachaRates.SR;
                if (roll < threshold) targetRarity = 'SR';
                else {
                    threshold += gachaRates.R;
                    if (roll < threshold) targetRarity = 'R';
                }
            }

            let pool = availableTreasures.filter(item => item.rarity === targetRarity && Number(item.stock) > 0);
            if (pool.length === 0 && targetRarity === 'SSR') {
                targetRarity = 'SR';
                pool = availableTreasures.filter(item => item.rarity === 'SR' && Number(item.stock) > 0);
            }
            if (pool.length === 0 && targetRarity === 'SR') {
                targetRarity = 'R';
                pool = availableTreasures.filter(item => item.rarity === 'R' && Number(item.stock) > 0);
            }
            if (pool.length === 0 && targetRarity === 'R') {
                targetRarity = 'N';
                pool = availableTreasures.filter(item => item.rarity === 'N' && Number(item.stock) > 0);
            }
            if (pool.length === 0) {
                pool = availableTreasures.filter(item => Number(item.stock) > 0);
            }
            if (pool.length > 0) {
                results.push(pick(pool));
            }
        }

        const nextTreasures = sourceTreasures.map(item => ({ ...item }));
        const nextStorage = { ...sourceStorage };
        const studentStorage = { ...(nextStorage[student.id] || {}) };
        results.forEach(item => {
            const index = nextTreasures.findIndex(treasure => sameId(treasure.id, item.id));
            if (index >= 0) nextTreasures[index].stock -= 1;
            studentStorage[item.id] = (studentStorage[item.id] || 0) + 1;
        });
        nextStorage[student.id] = studentStorage;

        const ts = typeof getNow === 'function' ? getNow().getTime() : Date.now();
        const snapshot = {
            zizai: student.zizai,
            balance: student.balance,
            penalty: student.penalty
        };
        const nextStudents = sourceStudents.map(item => (
            sameId(item.id, student.id) ? { ...item, balance: Number(item.balance) - cost } : item
        ));
        const nextHistory = [{
            id: ts + Math.random(),
            ts,
            studentId: student.id,
            studentName: student.name,
            val: -cost,
            reason: `祈愿 x${drawTimes}`,
            snapshot,
            type: 'spending',
            scene: "班级",
            category: "兑奖"
        }, ...sourceHistory];
        const nextLogs = prependLog({
            logs: sourceLogs,
            ts,
            studentName: student.name,
            action: "祈愿",
            itemName: `${drawTimes}连抽`,
            rarity: 'MIX',
            cost
        });

        return {
            ok: true,
            nextState: {
                students: nextStudents,
                history: nextHistory,
                treasures: nextTreasures,
                storage: nextStorage,
                logs: nextLogs
            },
            ui: {
                gachaResults: results
            }
        };
    };

    const buildTreasureSaveItemAction = ({ draft, editMode, treasures, logs, getNow }) => {
        const nextItem = parseTreasureDraft({ draft, editMode });
        if (!nextItem.name) {
            return { ok: false, message: "名称不能为空" };
        }

        const sourceTreasures = Array.isArray(treasures) ? treasures : [];
        const sourceLogs = Array.isArray(logs) ? logs : [];
        const nextTreasures = editMode
            ? sourceTreasures.map(item => (sameId(item.id, nextItem.id) ? nextItem : item))
            : [...sourceTreasures, nextItem];
        const ts = typeof getNow === 'function' ? getNow().getTime() : Date.now();
        const nextLogs = prependLog({
            logs: sourceLogs,
            ts,
            studentName: "系统",
            action: "管理",
            itemName: nextItem.name,
            rarity: nextItem.rarity,
            cost: 0,
            note: editMode
                ? `更新了 ${nextItem.name} (库存:${nextItem.stock}, 价格:${nextItem.price})`
                : `添加了 ${nextItem.name}`
        });

        return {
            ok: true,
            nextState: {
                treasures: nextTreasures,
                logs: nextLogs
            },
            ui: {
                item: nextItem
            }
        };
    };

    const buildTreasureDeleteItemAction = ({ itemId, treasures, storage, logs, redemptionHistory, dailyUsageCounts, getNow }) => {
        const sourceTreasures = Array.isArray(treasures) ? treasures : [];
        const targetItem = sourceTreasures.find(item => sameId(item.id, itemId));
        if (!targetItem) {
            return { ok: false, message: "未找到对应宝物" };
        }

        const nextTreasures = sourceTreasures.filter(item => !sameId(item.id, itemId));

        const nextStorage = {};
        Object.entries(storage || {}).forEach(([studentId, studentStorage]) => {
            const nextStudentStorage = { ...(studentStorage || {}) };
            delete nextStudentStorage[itemId];
            nextStorage[studentId] = nextStudentStorage;
        });

        const nextRedemptionHistory = {};
        Object.entries(redemptionHistory || {}).forEach(([studentId, studentHistory]) => {
            const nextStudentHistory = { ...(studentHistory || {}) };
            delete nextStudentHistory[itemId];
            nextRedemptionHistory[studentId] = nextStudentHistory;
        });

        const nextDailyUsageCounts = {};
        Object.entries(dailyUsageCounts || {}).forEach(([date, usageMap]) => {
            const nextUsageMap = { ...(usageMap || {}) };
            delete nextUsageMap[itemId];
            nextDailyUsageCounts[date] = nextUsageMap;
        });

        const ts = typeof getNow === 'function' ? getNow().getTime() : Date.now();
        const nextLogs = prependLog({
            logs,
            ts,
            studentName: "系统",
            action: "管理",
            itemName: targetItem.name,
            rarity: targetItem.rarity,
            cost: 0,
            note: `删除了 ${targetItem.name}`
        });

        return {
            ok: true,
            nextState: {
                treasures: nextTreasures,
                storage: nextStorage,
                logs: nextLogs,
                redemptionHistory: nextRedemptionHistory,
                dailyUsageCounts: nextDailyUsageCounts
            },
            ui: {
                item: targetItem
            }
        };
    };

    window.TreasureActions = {
        buildTreasureRedeemAction,
        buildTreasureReturnAction,
        buildTreasureUseAction,
        buildTreasureGachaAction,
        buildTreasureSaveItemAction,
        buildTreasureDeleteItemAction
    };
})();
