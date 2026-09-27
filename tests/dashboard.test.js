const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/dashboard/module.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const { sanValue, sanLevel, futureValue } = context.window.dashboardScoreUtils;

test('SAN clamps deductions and assigns all threshold labels', () => {
    assert.equal(sanValue(0), 100);
    assert.equal(sanValue(120), 0);
    assert.equal(sanLevel(80), '稳定');
    assert.equal(sanLevel(79.99), '临时错乱');
    assert.equal(sanLevel(59), '感到不适');
    assert.equal(sanLevel(39), '需要救助');
    assert.equal(sanLevel(19), '危险');
    assert.equal(sanLevel(0), '彻底疯狂');
});

test('future expectation starts near one to one and approaches 750 slowly', () => {
    assert.equal(futureValue(0), 0);
    assert.ok(futureValue(10) > 9.9 && futureValue(10) < 10);
    assert.ok(futureValue(1500) > 648 && futureValue(1500) < 649);
    assert.ok(futureValue(2000) > 697 && futureValue(2000) < 699);
    assert.ok(futureValue(3000) > 736 && futureValue(3000) < 737);
    assert.ok(futureValue(100000) < 750);
    assert.equal(futureValue(-20), 0);
});

test('enabled scoreboards render ten descending entries and stay off when disabled', () => {
    const h = (type, props, ...children) => ({ type, props: { ...(props || {}), children } });
    const view = context.window.createDashboardView({
        h, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
        useMemo: callback => callback(), Icon: () => null,
        requireAdminAuth: async () => true, getNow: () => new Date('2026-09-27'),
        getDateString: date => date.toISOString().slice(0, 10),
        getStartOfDay: date => date, DAY_MS: 86400000,
        getSystemConfig: config => ({ organization: { dorms: [], groups: [] }, points: {}, dashboardBoards: config.systemConfig?.dashboardBoards || {}, scoreNames: { bonus: '加分', penalty: '扣分' } }),
        getCustomRoles: () => [], getCommissionerRoles: () => [], getGroupsConfig: () => ({}),
        normalizePointScene: value => value, normalizePointCategory: value => value,
        getProfileAvatarUI: () => ({ renderAvatarImage: () => null })
    });
    const students = Array.from({ length: 12 }, (_, id) => ({ id, name: `学生${id}`, zizai: id * 10, penalty: id * 5 }));
    const render = dashboardBoards => view({ students, studentProfiles: {}, history: [], config: { systemConfig: { dashboardBoards } }, setConfig: () => {}, handleUndo: () => {} });
    const widgets = tree => tree.props.children[2].props.children[0];
    const enabled = widgets(render({ san: true, future: true }));
    const san = enabled.find(node => node.props.key === 'san');
    const future = enabled.find(node => node.props.key === 'future');
    assert.equal(san.props.children[1].props.children[1].props.children[0].length, 10);
    assert.equal(future.props.children[1].props.children[1].props.children[0].length, 10);
    assert.equal(widgets(render({ san: false, future: false })).some(node => ['san', 'future'].includes(node.props.key)), false);
});
