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

test('batchUpdatePoints waits for persistence before committing local state', async () => {
    const { controller } = loadPointsController();
    const students = [
        { id: 'stu-1', name: '学生甲', zizai: 1, balance: 1, penalty: 0 }
    ];
    let resolvePersistence;
    const persistence = new Promise(resolve => { resolvePersistence = resolve; });
    let nextStudents = null;
    let nextHistory = null;

    const resultPromise = controller.batchUpdatePoints({
        updates: [{ id: 'stu-1', val: 2, reason: '课堂表现', type: 'bonus', scene: '课堂', category: '学习' }],
        students,
        history: [],
        POINT_SCENES: ['课堂'],
        POINT_CATEGORIES: ['学习'],
        getNow: () => new Date('2026-07-17T08:00:00+08:00'),
        setStudents: value => { nextStudents = value; },
        setHistory: value => { nextHistory = value; },
        GUEST_ROSTER: [],
        normalizePointScene: value => value,
        normalizePointCategory: value => value,
        onPersist: () => persistence
    });

    assert.equal(typeof resultPromise.then, 'function');
    assert.equal(nextStudents, null);
    assert.equal(nextHistory, null);

    resolvePersistence({ success: true });
    const count = await resultPromise;
    assert.equal(count, 1);
    assert.equal(nextStudents[0].balance, 3);
    assert.equal(nextHistory.length, 1);
});

test('batchUpdatePoints preserves local state when persistence fails', async () => {
    const { controller } = loadPointsController();
    let localCommitCount = 0;

    const resultPromise = controller.batchUpdatePoints({
        updates: [{ id: 'stu-1', val: -1, reason: '违纪', type: 'penalty', scene: '班级', category: '纪律' }],
        students: [{ id: 'stu-1', name: '学生甲', zizai: 1, balance: 1, penalty: 0 }],
        history: [],
        POINT_SCENES: ['班级'],
        POINT_CATEGORIES: ['纪律'],
        getNow: () => new Date('2026-07-17T08:00:00+08:00'),
        setStudents: () => { localCommitCount += 1; },
        setHistory: () => { localCommitCount += 1; },
        GUEST_ROSTER: [],
        normalizePointScene: value => value,
        normalizePointCategory: value => value,
        onPersist: () => Promise.reject(new Error('network unavailable'))
    });

    await assert.rejects(resultPromise, /network unavailable/);
    assert.equal(localCommitCount, 0);
});

test('batchUpdatePoints treats a skipped server save as a failure', async () => {
    const { controller } = loadPointsController();
    let localCommitCount = 0;

    const resultPromise = controller.batchUpdatePoints({
        updates: [{ id: 'stu-1', val: 1, reason: '课堂表现', type: 'bonus', scene: '课堂', category: '学习' }],
        students: [{ id: 'stu-1', name: '学生甲', zizai: 0, balance: 0, penalty: 0 }],
        history: [],
        POINT_SCENES: ['课堂'],
        POINT_CATEGORIES: ['学习'],
        getNow: () => new Date('2026-07-17T08:00:00+08:00'),
        setStudents: () => { localCommitCount += 1; },
        setHistory: () => { localCommitCount += 1; },
        GUEST_ROSTER: [],
        normalizePointScene: value => value,
        normalizePointCategory: value => value,
        onPersist: () => Promise.resolve({ skipped: true, reason: 'test-session-invalid' })
    });

    await assert.rejects(resultPromise, /服务端未确认保存/);
    assert.equal(localCommitCount, 0);
});

test('handleWage does not commit or announce success when persistence fails', async () => {
    const { controller, alerts } = loadPointsController();
    let localCommitCount = 0;
    const resultPromise = controller.handleWage({
        config: { systemConfig: { organization: { customRoles: [] }, points: { dailyWageAmount: 5, dailyWageGroups: ['hygiene'] } } },
        students: [{ id: 'stu-1', name: '学生甲', group: 'hygiene', role: 'member', zizai: 0, balance: 0, penalty: 0 }],
        history: [],
        getNow: () => new Date('2026-07-17T08:00:00+08:00'),
        getSystemConfig: schema.getSystemConfig,
        getCustomRoles: schema.getCustomRoles,
        setStudents: () => { localCommitCount += 1; },
        setHistory: () => { localCommitCount += 1; },
        GUEST_ROSTER: [],
        normalizePointScene: value => value,
        normalizePointCategory: value => value,
        onPersist: () => Promise.reject(new Error('wage save failed'))
    });

    await assert.rejects(resultPromise, /wage save failed/);
    assert.equal(localCommitCount, 0);
    assert.deepEqual(alerts, []);
});

test('handleUndo keeps the original record and related state when persistence fails', async () => {
    const { controller } = loadPointsController();
    const students = [{ id: 'stu-1', name: '学生甲', zizai: 3, balance: 3, penalty: 0 }];
    const history = [{ id: 'record-1', ts: 1000, studentId: 'stu-1', studentName: '学生甲', val: 3, reason: '课堂表现', type: 'bonus', scene: '课堂', category: '学习' }];
    let localCommitCount = 0;
    let relatedCommitCount = 0;

    const resultPromise = controller.handleUndo({
        recordId: 'record-1',
        history,
        students,
        setStudents: () => { localCommitCount += 1; },
        setHistory: () => { localCommitCount += 1; },
        normalizePointScene: value => value,
        normalizePointCategory: value => value,
        applyRelatedUndo: () => ({ changed: true, storage: { 'stu-1': {} } }),
        onCommitRelated: () => { relatedCommitCount += 1; },
        onPersist: () => Promise.reject(new Error('undo save failed'))
    });

    await assert.rejects(resultPromise, /undo save failed/);
    assert.equal(localCommitCount, 0);
    assert.equal(relatedCommitCount, 0);
    assert.equal(students[0].balance, 3);
    assert.equal(history[0].id, 'record-1');
});
