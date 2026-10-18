const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../public/onboarding/module.js'), 'utf8');
function load(storage = new Map()) {
    const localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
    const window = { localStorage };
    vm.runInNewContext(source, { window });
    return { api: window.ClassManagerOnboarding, factory: window.createOnboarding, localStorage };
}
const newUser = { id: 12, role: 'user' };

test('offer only follows real initial sync for an empty teacher account', () => {
    const { api } = load();
    const input = { ready: true, testMode: false, user: newUser, students: [], history: [], progress: null };
    assert.equal(api.shouldOffer(input), true);
    for (const patch of [{ ready: false }, { testMode: true }, { user: { role: 'admin' } }, { students: [{ name: '已有学生' }] }, { history: [{}] }, { progress: { status: 'paused' } }]) {
        assert.equal(api.shouldOffer({ ...input, ...patch }), false);
    }
});

test('progress is account-scoped, bounded, and resilient to corrupt or unavailable storage', () => {
    const { api, localStorage } = load();
    const key = api.storageKey(newUser);
    assert.notEqual(key, api.storageKey({ id: 13 }));
    assert.equal(api.writeProgress(localStorage, key, { tour: 'setup', index: 4, status: 'paused' }), true);
    assert.equal(api.readProgress(localStorage, key).index, 4);
    assert.equal(api.readProgress(localStorage, api.storageKey({ id: 13 })), null);
    localStorage.setItem(key, '{broken');
    assert.equal(api.readProgress(localStorage, key), null);
    localStorage.setItem(key, JSON.stringify({ version: 1, tour: 'setup', index: 3.9 }));
    assert.equal(api.readProgress(localStorage, key).index, 3);
    localStorage.setItem(key, JSON.stringify({ version: 1, tour: 'setup', index: 500 }));
    assert.equal(api.readProgress(localStorage, key).index, api.TOURS.setup.length - 1);
    assert.equal(api.readProgress(null, key), null);
    assert.equal(api.writeProgress(null, key, {}), false);
});

test('readiness rejects empty/example-free, duplicate, orphaned, and unsynced rosters without changing them', () => {
    const { api } = load();
    const systemConfig = { className: '高一一班', organization: { groups: [{ id: 'g1', name: '自定义组' }], dorms: [{ id: 'd1', name: '走读' }] } };
    const students = [{ id: '1', name: '测试学生', group: 'g1', dorm: '' }];
    const before = JSON.stringify({ students, systemConfig });
    const inspect = patch => api.inspectSetup({ systemConfig, students, syncStatus: 'saved', ...patch });
    assert.equal(inspect().every(x => x.ok), true);
    assert.equal(inspect({ students: [] })[2].ok, false);
    assert.equal(inspect({ students: [...students, { ...students[0], id: '2' }] })[2].ok, false);
    assert.equal(inspect({ students: [{ ...students[0], group: 'missing' }] })[2].ok, false);
    assert.equal(inspect({ syncStatus: 'error' })[3].ok, false);
    assert.equal(JSON.stringify({ students, systemConfig }), before);
});

function hookHarness(options = {}) {
    const { api, factory, localStorage } = load();
    const cells = [], dependencies = [];
    let cursor = 0, effects = [], guide, tab;
    const useState = initial => {
        const i = cursor++;
        if (!(i in cells)) cells[i] = typeof initial === 'function' ? initial() : initial;
        return [cells[i], next => { cells[i] = typeof next === 'function' ? next(cells[i]) : next; }];
    };
    const useRef = initial => { const i = cursor++; return cells[i] ?? (cells[i] = { current: initial }); };
    const useEffect = (effect, deps) => {
        const i = cursor++;
        if (!dependencies[i] || deps.some((x, n) => !Object.is(x, dependencies[i][n]))) {
            dependencies[i] = deps;
            effects.push(effect);
        }
    };
    const { useOnboarding } = factory({ h: () => {}, useState, useEffect, useRef });
    const input = { ready: true, testMode: false, user: newUser, students: [], history: [], systemConfig: {}, setActiveTab: next => { tab = next; }, ...options };
    const render = (patch = {}) => {
        Object.assign(input, patch); cursor = 0; effects = [];
        guide = useOnboarding(input);
        effects.forEach(fn => fn());
        return guide;
    };
    return { render, api, localStorage, tab: () => tab };
}

test('close persists current step, reload stays quiet, replay can resume, and disabled features do not enable themselves', () => {
    const harness = hookHarness();
    harness.render();
    let g = harness.render();
    assert.equal(g.state.screen, 'welcome');
    g.start('setup', 2); g = harness.render();
    assert.equal(harness.tab(), 'settings');
    g.close(); g = harness.render();
    assert.equal(g.state, null);
    assert.equal(g.progress.index, 2);
    assert.equal(g.progress.status, 'paused');
    g.open(); g = harness.render();
    g.start(g.progress.tour, g.progress.index); g = harness.render();
    assert.equal(g.step.id, 'organization');
    g.start('more', 4); g = harness.render();
    assert.equal(g.step.id, 'pet');
    assert.equal(g.disabledFeature, true);
    assert.equal(harness.tab(), 'settings');
});

test('save confirmation cannot carry over from earlier steps and completing tour does not change class data', () => {
    const students = [], history = [], systemConfig = {};
    const harness = hookHarness({ students, history, systemConfig });
    harness.render(); let g = harness.render();
    g.onConfigSaved(); g = harness.render();
    assert.equal(g.savedConfigCount, 1);
    g.start('setup', 4); harness.render(); g = harness.render();
    assert.equal(g.savedConfigCount, 0);
    g.onConfigSaved(); g = harness.render();
    assert.equal(g.savedConfigCount, 1);
    g.move(1); g = harness.render();
    g.move(1); g = harness.render();
    g.move(1); g = harness.render();
    assert.equal(g.state.screen, 'summary');
    assert.equal(students.length, 0);
    assert.equal(history.length, 0);
    assert.equal(Object.keys(systemConfig).length, 0);
});
