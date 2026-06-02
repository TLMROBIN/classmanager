const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

test('treasure liquidation toggle requires maintenance auth and rolls back failed saves', () => {
    const script = fs.readFileSync(path.join(ROOT_DIR, 'public/script.js'), 'utf8');
    const toggleStart = script.indexOf('const handleToggleLiquidation = async (enabled) => {');
    assert.notEqual(toggleStart, -1);

    const toggleEnd = script.indexOf('const handleApplyFixedStudents', toggleStart);
    assert.notEqual(toggleEnd, -1);

    const toggleBody = script.slice(toggleStart, toggleEnd);
    assert.match(toggleBody, /requireAdminAuth\(/);
    assert.match(toggleBody, /await persistManagedPatch\(\{ config: nextConfig \}\)/);
    assert.match(toggleBody, /catch \(error\)/);
    assert.match(toggleBody, /setConfig\(previousConfig\)/);
});
