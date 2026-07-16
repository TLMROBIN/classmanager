const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('attendance check-in keeps a recoverable, truthful receipt', () => {
    const source = read('public/attendance/module.js');

    assert.match(source, /checkInReceipt/);
    assert.match(source, /'aria-live': 'polite'/);
    assert.match(source, /classmanager:pending-attendance/);
    assert.match(source, /迟到卡已生效，本次不扣分/);
    assert.doesNotMatch(source, /pointer-events-none/);
    assert.doesNotMatch(source, /animate-firework/);
});

test('attendance and points expose focused task areas with keyboard semantics', () => {
    const attendance = read('public/attendance/module.js');
    const operations = read('public/operations/module.js');
    const operationViews = read('public/operations/views.js');

    assert.match(attendance, /教师工具/);
    assert.match(attendance, /'aria-pressed': view === item\.id/);
    assert.match(operations, /快速积分/);
    assert.match(operations, /日常登记/);
    assert.match(operations, /积分历史/);
    assert.match(operationViews, /return h\("button"/);
    assert.match(operationViews, /'aria-pressed': isSelected/);
});

test('shared modal traps focus and reduced-motion support is present', () => {
    const modal = read('public/ui/modal.js');
    const styles = read('public/styles.css');

    assert.match(modal, /role: 'dialog'/);
    assert.match(modal, /'aria-modal': 'true'/);
    assert.match(modal, /event\.key === 'Escape'/);
    assert.match(modal, /event\.key !== 'Tab'/);
    assert.match(styles, /prefers-reduced-motion: reduce/);
});

test('points persistence keeps the editing context until the server confirms', () => {
    const controller = read('public/points/controller.js');
    const actions = read('public/operations/actions.js');
    const modal = read('public/ui/modal.js');

    assert.match(controller, /Promise\.resolve\(persistenceResult\)\.then\(verifyAndCommit\)/);
    assert.match(actions, /await Promise\.resolve\(batchUpdatePoints\(updates\)\)/);
    assert.match(actions, /操作内容已保留/);
    assert.match(modal, /confirmDisabled/);
    assert.match(modal, /'aria-busy'/);
});

test('repeated points settings controls have programmatic names', () => {
    const settings = read('public/operations/settings.js');

    assert.match(settings, /第 \$\{idx \+ 1\} 个学科的名称/);
    assert.match(settings, /第 \$\{idx \+ 1\} 个积分理由.*的分值/);
    assert.match(settings, /按积分场景筛选记录/);
    assert.match(settings, /按积分类别筛选记录/);
    assert.match(settings, /允许编辑分值/);
    assert.match(settings, /启用倍率/);
    assert.match(settings, /删除学科：/);
    assert.match(settings, /删除积分理由：/);
    assert.match(settings, /选择 \$\{item\.studentName \|\| '未知学生'\}/);
    assert.match(settings, /\$\{item\.label\}扣分/);
    assert.match(settings, /\$\{item\.label\}专员加分/);
});
