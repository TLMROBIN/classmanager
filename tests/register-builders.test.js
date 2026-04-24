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
