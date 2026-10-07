const test = require('node:test');
const assert = require('node:assert/strict');

const schema = require('../public/core/schema');
const builders = require('../public/operations/builders');

test('normalizeCommissionerRoles preserves string student ids', () => {
    const roles = schema.normalizeCommissionerRoles([
        { id: 'noise', name: '噪音专员', studentId: 'g3' },
        { id: 'noise', name: '噪音专员', studentId: 12 }
    ]);

    assert.deepEqual(roles, [
        { id: 'noise', name: '噪音专员', studentId: 'g3' },
        { id: 'noise', name: '噪音专员', studentId: '12' }
    ]);
});

test('buildHygieneUpdates writes current date into reasons and rewards all inspectors once', () => {
    const updates = builders.buildHygieneUpdates({
        date: '2026-04-24',
        sessionName: '早读',
        inspectorStudentIds: ['g2', 'g2', 'stu-9'],
        selectedIds: new Set(['stu-1']),
        areaPenalty: 2,
        inspectorBonus: 1
    });

    assert.deepEqual(updates, [
        {
            id: 'stu-1',
            val: -2,
            reason: '2026-04-24 早读 卫生不达标',
            type: 'penalty',
            scene: '班级',
            category: '班务'
        },
        {
            id: 'g2',
            val: 1,
            reason: '2026-04-24 早读 卫生登记',
            type: 'bonus',
            scene: '班级',
            category: '班务'
        },
        {
            id: 'stu-9',
            val: 1,
            reason: '2026-04-24 早读 卫生登记',
            type: 'bonus',
            scene: '班级',
            category: '班务'
        }
    ]);
});

test('buildDisciplineUpdates rewards all matched commissioners once', () => {
    const updates = builders.buildDisciplineUpdates({
        date: '2026-04-24',
        reasonKey: 'noise',
        reasonLabel: '学习时间讲话',
        commissionerStudentIds: ['g3', 'g3', 'stu-8'],
        selectedIds: new Set(['stu-1', 'stu-2']),
        penalty: 1.5,
        commissionerBonus: 2
    });

    assert.deepEqual(updates, [
        {
            id: 'stu-1',
            val: -1.5,
            reason: '2026-04-24 学习时间讲话',
            type: 'penalty',
            scene: '班级',
            category: '纪律'
        },
        {
            id: 'stu-2',
            val: -1.5,
            reason: '2026-04-24 学习时间讲话',
            type: 'penalty',
            scene: '班级',
            category: '纪律'
        },
        {
            id: 'g3',
            val: 2,
            reason: '2026-04-24 学习时间讲话 登记',
            type: 'bonus',
            scene: '班级',
            category: '纪律'
        },
        {
            id: 'stu-8',
            val: 2,
            reason: '2026-04-24 学习时间讲话 登记',
            type: 'bonus',
            scene: '班级',
            category: '纪律'
        }
    ]);
});

test('buildDisciplineUpdates rewards the registrar with discipline work points once', () => {
    const updates = builders.buildDisciplineUpdates({
        date: '2026-10-07',
        reasonKey: 'noise',
        reasonLabel: '学习时间讲话',
        commissionerStudentIds: [],
        selectedIds: new Set(['stu-1']),
        penalty: 1,
        commissionerBonus: 1,
        registrarId: 'g3',
        registrarBonus: 0.5
    });

    const registrarUpdates = updates.filter(item => item.id === 'g3');
    assert.equal(registrarUpdates.length, 1);
    assert.deepEqual(registrarUpdates[0], {
        id: 'g3',
        val: 0.5,
        reason: '2026-10-07 学习时间讲话 纪律工作',
        type: 'bonus',
        scene: '班级',
        category: '班务'
    });
});

test('buildDisciplineUpdates grants registrar work points even when nobody violated', () => {
    const updates = builders.buildDisciplineUpdates({
        date: '2026-10-07',
        reasonKey: 'desk',
        reasonLabel: '桌面杂乱',
        commissionerStudentIds: [],
        selectedIds: new Set(),
        penalty: 1,
        commissionerBonus: 1,
        registrarId: 'stu-9',
        registrarBonus: 2
    });

    assert.deepEqual(updates, [
        {
            id: 'stu-9',
            val: 2,
            reason: '2026-10-07 桌面杂乱 纪律工作',
            type: 'bonus',
            scene: '班级',
            category: '班务'
        }
    ]);
});

test('buildDisciplineUpdates skips registrar reward when unset or zero bonus', () => {
    const noRegistrar = builders.buildDisciplineUpdates({
        date: '2026-10-07',
        reasonKey: 'desk',
        reasonLabel: '桌面杂乱',
        commissionerStudentIds: [],
        selectedIds: new Set(),
        penalty: 1,
        commissionerBonus: 1,
        registrarId: '',
        registrarBonus: 2
    });
    assert.deepEqual(noRegistrar, []);

    const zeroBonus = builders.buildDisciplineUpdates({
        date: '2026-10-07',
        reasonKey: 'desk',
        reasonLabel: '桌面杂乱',
        commissionerStudentIds: [],
        selectedIds: new Set(),
        penalty: 1,
        commissionerBonus: 1,
        registrarId: 'stu-9',
        registrarBonus: 0
    });
    assert.deepEqual(zeroBonus, []);
});

test('buildDisciplineConfirmMessage mentions the registrar work bonus', () => {
    const msg = builders.buildDisciplineConfirmMessage({
        date: '2026-10-07',
        reasonLabel: '学习时间讲话',
        commissionerNames: [],
        selectedIds: new Set(['stu-1']),
        studentMap: new Map([['g3', { id: 'g3', name: '王五' }]]),
        penalty: 1,
        commissionerBonus: 1,
        registrarId: 'g3',
        registrarBonus: 0.5
    });

    assert.match(msg, /登记人 王五 纪律工作分：\+0\.5 分/);
    assert.ok(!msg.includes('undefined'));
});

test('getSystemConfig preserves discipline registrar bonus when merging stored config', () => {
    const merged = schema.getSystemConfig({
        systemConfig: {
            points: {
                disciplineRegister: {
                    registrarBonus: 25,
                    noise: { penalty: 2 }
                }
            }
        }
    });

    assert.equal(merged.points.disciplineRegister.registrarBonus, 25);
    assert.equal(merged.points.disciplineRegister.noise.penalty, 2);
    assert.equal(merged.points.disciplineRegister.noise.commissionerBonus, 1);
    assert.equal(merged.points.disciplineRegister.desk.penalty, 1);
});

test('getSystemConfig falls back to default registrar bonus when absent or invalid', () => {
    const absent = schema.getSystemConfig({
        systemConfig: { points: { disciplineRegister: { noise: { penalty: 2 } } } }
    });
    assert.equal(absent.points.disciplineRegister.registrarBonus, 1);

    const invalid = schema.getSystemConfig({
        systemConfig: { points: { disciplineRegister: { registrarBonus: -3 } } }
    });
    assert.equal(invalid.points.disciplineRegister.registrarBonus, 1);
});
