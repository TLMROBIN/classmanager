const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
        { id: 'liq-1', name: '清算宝物', rarity: 'R', price: 8, stock: 2 }
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
            'liq-1': 1
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
            'liq-1': 1
        }
    });
    assert.equal(result.nextState.students[0].balance, 12);
    assert.equal(result.nextState.liquidatedTreasures[0].stock, 1);
});
