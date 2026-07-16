const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const loadBrowserModule = (relativePath, extras = {}) => {
    const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
    const context = { window: {}, Promise, Number, Set, Array, ...extras };
    vm.createContext(context);
    vm.runInContext(source, context);
    return context.window;
};

test('perfect attendance award resolves only after points persistence succeeds', async () => {
    const { AttendancePoints } = loadBrowserModule('public/attendance/points.js');
    let resolvePersistence;
    const persistence = new Promise(resolve => { resolvePersistence = resolve; });
    const resultPromise = AttendancePoints.awardPerfectAttendance({
        perfectNames: ['学生甲'],
        students: [{ id: 'stu-1', name: '学生甲' }],
        perfectAttendanceBonus: 10,
        updatePoints: () => persistence
    });

    assert.equal(typeof resultPromise.then, 'function');
    let settled = false;
    resultPromise.finally(() => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, false);

    resolvePersistence(1);
    assert.equal(await resultPromise, 1);
});

test('battle settlement waits for main points persistence and propagates failures', async () => {
    const { BattleTransfer } = loadBrowserModule('public/battle/transfer.js', {
        confirm: () => true,
        JSON
    });
    const updates = [{ id: 'stu-1', val: 2 }];

    const success = await BattleTransfer.applySettlementPoints({
        updates,
        batchUpdatePoints: () => Promise.resolve(1)
    });
    assert.equal(success.applied, true);
    assert.equal(success.count, 1);

    await assert.rejects(
        BattleTransfer.applySettlementPoints({
            updates,
            batchUpdatePoints: () => Promise.reject(new Error('save rejected'))
        }),
        /save rejected/
    );
});

test('manual score correction announces success only after persistence resolves', async () => {
    const prompts = ['学生甲', '2', '3', '0'];
    const alerts = [];
    const browser = loadBrowserModule('public/operations/admin-tools.js', {
        prompt: () => prompts.shift(),
        alert: message => alerts.push(message)
    });
    const tools = browser.createOperationAdminTools({ getTodayStr: () => '2026-07-17' });
    let resolvePersistence;
    const persistence = new Promise(resolve => { resolvePersistence = resolve; });

    const resultPromise = tools.fixScore({
        students: [{ id: 'stu-1', name: '学生甲', zizai: 1, balance: 1, penalty: 0 }],
        applyStudents: () => persistence
    });

    assert.equal(typeof resultPromise.then, 'function');
    assert.deepEqual(alerts, []);
    resolvePersistence({ success: true });
    assert.equal((await resultPromise).ok, true);
    assert.deepEqual(alerts, ['已修正并保存']);
});

test('attendance and battle reject incomplete point-save counts', async () => {
    const attendance = loadBrowserModule('public/attendance/points.js').AttendancePoints;
    assert.throws(() => attendance.awardPerfectAttendance({
        perfectNames: ['学生甲'],
        students: [{ id: 'stu-1', name: '学生甲' }],
        perfectAttendanceBonus: 10,
        updatePoints: () => 0
    }), /保存条数不完整/);

    const { BattleTransfer } = loadBrowserModule('public/battle/transfer.js', {
        confirm: () => true,
        JSON
    });
    await assert.rejects(
        BattleTransfer.applySettlementPoints({
            updates: [{ id: 'stu-1', val: 1 }, { id: 'stu-2', val: 1 }],
            batchUpdatePoints: () => Promise.resolve(1)
        }),
        /入账条数不完整/
    );
});
