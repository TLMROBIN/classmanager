const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const schema = require('../public/core/schema');

const loadPointsController = () => {
    const source = fs.readFileSync(path.join(__dirname, '../public/points/controller.js'), 'utf8');
    const alerts = [];
    const context = {
        window: {},
        alert: (message) => alerts.push(message),
        Math,
        Date
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    return { controller: context.window.PointsController, alerts };
};

test('handleWage pays custom role wage when role student id is a string and student id is numeric', () => {
    const { controller, alerts } = loadPointsController();
    const students = [
        { id: 101, name: '学生甲', group: 'life', role: 'member', zizai: 0, balance: 0, penalty: 0 }
    ];
    const config = {
        systemConfig: {
            organization: {
                customRoles: [
                    { id: 'custom_role_1', name: '班长', studentId: '101', dailyWage: 2 }
                ]
            },
            points: {
                dailyWageAmount: 5,
                dailyWageGroups: []
            }
        }
    };

    let nextStudents = null;
    let nextHistory = null;
    let nextConfig = 'not-called';
    let persistedPatch = null;

    const count = controller.handleWage({
        config,
        students,
        history: [],
        getNow: () => new Date('2026-04-30T08:00:00+08:00'),
        getSystemConfig: schema.getSystemConfig,
        getCustomRoles: schema.getCustomRoles,
        setStudents: value => { nextStudents = value; },
        setHistory: value => { nextHistory = value; },
        setConfig: value => { nextConfig = value; },
        GUEST_ROSTER: [],
        normalizePointScene: value => value,
        normalizePointCategory: value => value,
        onPersist: value => { persistedPatch = value; }
    });

    assert.equal(count, 1);
    assert.equal(nextStudents[0].zizai, 2);
    assert.equal(nextStudents[0].balance, 2);
    assert.equal(nextHistory[0].studentId, 101);
    assert.equal(nextHistory[0].reason, '班级职务津贴: 班长');
    assert.equal(nextConfig, 'not-called');
    assert.ok(!Object.prototype.hasOwnProperty.call(persistedPatch, 'nextConfig'));
    assert.deepEqual(alerts, ['发放完成（含1个班级职务津贴）']);
});

test('handleWage pays wages when stale lastWageDate exists but no wage history exists today', () => {
    const { controller, alerts } = loadPointsController();
    const students = [
        { id: 's1', name: '学生甲', group: 'hygiene', role: 'member', zizai: 0, balance: 0, penalty: 0 },
        { id: 's2', name: '学生乙', group: 'discipline', role: 'leader', zizai: 1, balance: 1, penalty: 0 }
    ];
    const config = {
        lastWageDate: '2026-04-30',
        systemConfig: {
            organization: {
                customRoles: []
            },
            points: {
                dailyWageAmount: 5,
                dailyWageGroups: ['hygiene', 'discipline']
            }
        }
    };

    let nextStudents = null;
    let nextHistory = null;
    let nextConfig = 'not-called';
    let persistedPatch = null;

    const count = controller.handleWage({
        config,
        students,
        history: [],
        getNow: () => new Date('2026-04-30T08:00:00+08:00'),
        getSystemConfig: schema.getSystemConfig,
        getCustomRoles: schema.getCustomRoles,
        setStudents: value => { nextStudents = value; },
        setHistory: value => { nextHistory = value; },
        setConfig: value => { nextConfig = value; },
        GUEST_ROSTER: [],
        normalizePointScene: value => value,
        normalizePointCategory: value => value,
        onPersist: value => { persistedPatch = value; }
    });

    assert.equal(count, 2);
    assert.equal(nextStudents[0].zizai, 5);
    assert.equal(nextStudents[0].balance, 5);
    assert.equal(nextStudents[1].zizai, 7);
    assert.equal(nextStudents[1].balance, 7);
    assert.equal(nextHistory.length, 2);
    assert.equal(nextHistory[0].reason, '每日工资');
    assert.equal(nextHistory[1].reason, '每日工资');
    assert.equal(nextConfig, 'not-called');
    assert.ok(!Object.prototype.hasOwnProperty.call(persistedPatch, 'nextConfig'));
    assert.deepEqual(alerts, ['发放完成']);
});

test('handleUndo persists related domain rollback when provided by caller', () => {
    const { controller } = loadPointsController();
    const students = [
        { id: 'stu-1', name: '学生甲', zizai: 0, balance: -3, penalty: 3 }
    ];
    const history = [
        { id: 'penalty-1', ts: 1000, studentId: 'stu-1', studentName: '学生甲', val: -3, reason: '违纪', type: 'penalty', scene: '班级', category: '纪律' }
    ];

    let nextStudents = null;
    let nextHistory = null;
    let persistedPatch = null;

    const ok = controller.handleUndo({
        recordId: 'penalty-1',
        history,
        students,
        setStudents: value => { nextStudents = value; },
        setHistory: value => { nextHistory = value; },
        normalizePointScene: value => value,
        normalizePointCategory: value => value,
        applyRelatedUndo: ({ record, students: undoStudents, history: undoHistory }) => ({
            changed: true,
            students: undoStudents,
            history: undoHistory,
            storage: { 'stu-1': { 'treasure-1': 1 } },
            liquidatedTreasures: [],
            logs: []
        }),
        onPersist: value => { persistedPatch = value; }
    });

    assert.equal(ok, true);
    assert.deepEqual(persistedPatch.storage, { 'stu-1': { 'treasure-1': 1 } });
    assert.deepEqual(persistedPatch.liquidatedTreasures, []);
    assert.deepEqual(persistedPatch.logs, []);
    assert.equal(nextStudents[0].balance, 0);
    assert.equal(nextHistory[0].isUndoLog, true);
});
