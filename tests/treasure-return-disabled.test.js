const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

const readPublicFile = (relativePath) => fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');

test('treasure return flow is not exposed in the browser bundle', () => {
    const treasureView = readPublicFile('public/treasure/module.js');
    const treasureActions = readPublicFile('public/treasure/actions.js');
    const treasurePoints = readPublicFile('public/treasure/points.js');
    const script = readPublicFile('public/script.js');

    assert.equal(treasureView.includes('退回'), false);
    assert.equal(treasureView.includes('onReturnItem'), false);
    assert.equal(treasureActions.includes('buildTreasureReturnAction'), false);
    assert.equal(treasurePoints.includes('buildTreasureReturnState'), false);
    assert.equal(script.includes('handleReturnItem'), false);
});
