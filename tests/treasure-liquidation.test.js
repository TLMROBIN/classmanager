const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { applyBankruptcyLiquidation } = require('../utils/liquidation');

const loadTreasureModules = () => {
    const context = {
        window: {},
        Math,
        Date
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/treasure/liquidation.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/treasure/actions.js'), 'utf8'), context);
    return context.window;
};

const makeLiquidationParams = () => ({
    studentId: 'stu-1',
    itemId: 'liq-1',
    students: [
        { id: 'stu-1', name: '学生甲', zizai: 20, balance: 20, penalty: 0 }
    ],
    liquidatedTreasures: [
        { id: 'liq-1', originalTreasureId: 'treasure-1', name: '清算宝物', rarity: 'R', price: 8, stock: 2 }
    ],
    storage: {},
    history: [],
    logs: [],
    getNow: () => new Date('2026-05-14T08:00:00+08:00')
});

const plain = (value) => JSON.parse(JSON.stringify(value));

test('buildLiquidatedRedeemState adds redeemed liquidation item to student storage', () => {
    const { TreasureLiquidation } = loadTreasureModules();

    const result = TreasureLiquidation.buildLiquidatedRedeemState(makeLiquidationParams());

    assert.equal(result.ok, true);
    assert.deepEqual(plain(result.newStorage), {
        'stu-1': {
            'treasure-1': 1
        }
    });
    assert.equal(result.newStudents[0].balance, 12);
    assert.equal(result.newLiquidatedTreasures[0].stock, 1);
    assert.equal(result.newLogs[0].action, '清算');
});

test('buildLiquidatedRedeemAction persists storage with liquidation purchase state', () => {
    const { TreasureActions } = loadTreasureModules();

    const result = TreasureActions.buildLiquidatedRedeemAction(makeLiquidationParams());

    assert.equal(result.ok, true);
    assert.deepEqual(plain(result.nextState.storage), {
        'stu-1': {
            'treasure-1': 1
        }
    });
    assert.equal(result.nextState.students[0].balance, 12);
    assert.equal(result.nextState.liquidatedTreasures[0].stock, 1);
});

test('applyBankruptcyLiquidation records source metadata for rollback and display', () => {
    const result = applyBankruptcyLiquidation({
        students: [
            { id: 'owner-1', name: '原持有人', zizai: 0, balance: -5, penalty: 5 }
        ],
        storage: {
            'owner-1': {
                'treasure-1': 1
            }
        },
        treasures: [
            { id: 'treasure-1', name: '羽毛笔', rarity: 'R', price: 10, stock: 0 }
        ],
        liquidatedTreasures: [],
        history: [
            { id: 'penalty-1', ts: 1000, studentId: 'owner-1', studentName: '原持有人', val: -5, reason: '纪律扣分', type: 'penalty' }
        ],
        logs: [],
        config: { systemConfig: { treasureLiquidation: { enabled: true } } },
        now: new Date('2026-05-14T08:00:00+08:00')
    });

    assert.equal(result.changed, true);
    assert.equal(result.liquidatedTreasures.length, 1);
    assert.equal(result.liquidatedTreasures[0].sourceHistoryId, 'penalty-1');
    assert.equal(result.liquidatedTreasures[0].ownerStudentId, 'owner-1');
    assert.equal(result.liquidatedTreasures[0].ownerStudentName, '原持有人');
    assert.equal(result.history[0].sourceHistoryId, 'penalty-1');
    assert.equal(result.logs[0].sourceHistoryId, 'penalty-1');
});

test('rollbackLiquidationForUndo restores owner item, removes listing, and refunds buyer purchase', () => {
    const { TreasureLiquidation } = loadTreasureModules();
    const result = TreasureLiquidation.rollbackLiquidationForUndo({
        sourceHistoryId: 'penalty-1',
        students: [
            { id: 'owner-1', name: '原持有人', zizai: 0, balance: 7, penalty: 0 },
            { id: 'buyer-1', name: '购买者', zizai: 20, balance: 12, penalty: 0 }
        ],
        storage: {
            'buyer-1': {
                'treasure-1': 1
            }
        },
        liquidatedTreasures: [
            {
                id: 'liq-1',
                originalTreasureId: 'treasure-1',
                name: '羽毛笔',
                price: 8,
                stock: 0,
                sourceHistoryId: 'penalty-1',
                ownerStudentId: 'owner-1',
                ownerStudentName: '原持有人'
            }
        ],
        history: [
            { id: 'undo-1', studentId: 'owner-1', val: 5, reason: '撤销扣分: 纪律扣分', isUndoLog: true },
            { id: 'purchase-1', studentId: 'buyer-1', val: -8, reason: '兑换(清算): 羽毛笔', type: 'spending', liquidatedItemId: 'liq-1', sourceHistoryId: 'penalty-1' },
            { id: 'refund-1', studentId: 'owner-1', val: 7, reason: '清算退回: 羽毛笔', type: 'bonus', sourceHistoryId: 'penalty-1' }
        ],
        logs: [
            { id: 'purchase-log-1', action: '清算', itemName: '羽毛笔', liquidatedItemId: 'liq-1' },
            { id: 'refund-log-1', action: '清算', itemName: '羽毛笔', sourceHistoryId: 'penalty-1' }
        ]
    });

    assert.equal(result.changed, true);
    assert.deepEqual(plain(result.storage), {
        'owner-1': {
            'treasure-1': 1
        }
    });
    assert.deepEqual(plain(result.liquidatedTreasures), []);
    assert.equal(result.students.find(item => item.id === 'owner-1').balance, 0);
    assert.equal(result.students.find(item => item.id === 'buyer-1').balance, 20);
    assert.deepEqual(plain(result.history).map(item => item.id), ['undo-1']);
    assert.deepEqual(plain(result.logs), []);
});
