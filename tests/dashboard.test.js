const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/dashboard/module.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const { sanValue, sanLevel, futureValue } = context.window.dashboardScoreUtils;
const { normalizeDashboardLayout, adjustDashboardWidget } = context.window.dashboardLayoutUtils;

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

test('future expectation rewards early points and approaches 750 slowly', () => {
    assert.equal(futureValue(0), 0);
    assert.ok(futureValue(10) > 12 && futureValue(10) < 13);
    assert.ok(futureValue(800) > 552 && futureValue(800) < 553);
    assert.ok(futureValue(1000) > 608 && futureValue(1000) < 609);
    assert.ok(futureValue(1200) < 650);
    assert.ok(futureValue(1500) > 688 && futureValue(1500) < 689);
    assert.ok(futureValue(2000) > 723 && futureValue(2000) < 724);
    assert.ok(futureValue(100000) < 750);
    assert.equal(futureValue(-20), 0);
});

test('pointer geometry resizes edges and corners without moving other modules', () => {
    const items = normalizeDashboardLayout([{ id: 'bonus', width: 4 }, { id: 'dorm', width: 4 }], ['bonus', 'dorm']);
    const neighbor = { ...items[1] };
    const right = adjustDashboardWidget(items[0], 'e', 5, 0);
    assert.ok(right.w > items[0].w);
    assert.equal(right.h, items[0].h);
    const corner = adjustDashboardWidget(items[0], 'se', 5, 30);
    assert.ok(corner.w > items[0].w);
    assert.equal(corner.h, items[0].h + 30);
    const restored = normalizeDashboardLayout([corner, items[1]], ['bonus', 'dorm']);
    assert.equal(restored[0].w, corner.w);
    assert.equal(restored[0].h, corner.h);
    assert.equal(JSON.stringify(restored[1]), JSON.stringify(neighbor));
    const moved = adjustDashboardWidget(items[0], 'move', 4, 25);
    assert.equal(moved.y, items[0].y + 25);
    assert.equal(JSON.stringify(items[1]), JSON.stringify(neighbor));
    assert.ok(adjustDashboardWidget(items[0], 'w', -100, 0).x >= 0);
    assert.ok(adjustDashboardWidget(items[0], 's', 0, -1000).h >= 160);
});

test('SAN shows the ten lowest values first while future expectation stays descending', () => {
    const h = (type, props, ...children) => ({ type, props: { ...(props || {}), children } });
    const view = context.window.createDashboardView({
        h, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
        useMemo: callback => callback(), useRef: initial => ({ current: initial }), Icon: () => null,
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
    const rankRows = widget => widget.props.children[1].props.children[0].props.children[1].props.children[0];
    assert.equal(rankRows(san).length, 10);
    assert.equal(rankRows(future).length, 10);
    const rankValues = widget => Array.from(rankRows(widget), row => row.props.children[2].props.children[0]);
    assert.deepEqual(rankValues(san), [45, 50, 55, 60, 65, 70, 75, 80, 85, 90]);
    assert.deepEqual(rankValues(future), students.slice(2).reverse().map(student => futureValue(student.zizai).toFixed(2)));
    assert.equal(widgets(render({ san: false, future: false })).some(node => ['san', 'future'].includes(node.props.key)), false);
});
