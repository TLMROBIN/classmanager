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
    assert.match(attendance, /role: "tablist"/);
    assert.match(attendance, /'aria-selected': view === item\.id/);
    assert.match(operations, /快速积分/);
    assert.match(operations, /日常登记/);
    assert.match(operations, /积分历史/);
    assert.match(operations, /role: 'tablist'/);
    assert.match(operations, /'aria-selected': workspaceSection === item\.id/);
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

test('P2 check-in and focus states never expose stale or invisible feedback', () => {
    const attendance = read('public/attendance/module.js');
    const styles = read('public/styles.css');

    assert.match(attendance, /setPendingStudentName\(studentName\);\s*setCheckInReceipt\(null\);/);
    assert.match(attendance, /Number\.isFinite\(newBalance\)/);
    assert.match(styles, /input\[type=range\]:focus-visible/);
    assert.doesNotMatch(styles, /input\[type=range\]:focus\s*\{\s*outline:\s*none/);
});

test('P2 main flows use accessible confirmations and inline feedback', () => {
    const attendance = read('public/attendance/module.js');
    const actions = read('public/operations/actions.js');
    const operations = read('public/operations/module.js');
    const controller = read('public/points/controller.js');

    assert.doesNotMatch(attendance, /\balert\s*\(/);
    assert.doesNotMatch(attendance, /\bconfirm\s*\(/);
    assert.doesNotMatch(actions, /\balert\s*\(/);
    assert.doesNotMatch(actions, /\bconfirm\s*\(/);
    assert.match(attendance, /requestAttendanceConfirmation/);
    assert.match(attendance, /attendanceFeedback/);
    assert.match(actions, /requestOperationConfirmation/);
    assert.match(operations, /h\(Modal, \{/);
    assert.match(operations, /确认发放一键工资/);
    assert.match(operations, /本次没有生成工资积分记录/);
    assert.doesNotMatch(controller, /alert\("今日一键工资已发放/);
    assert.doesNotMatch(controller, /alert\("没有找到可发放工资/);
    assert.doesNotMatch(controller, /alert\(`发放完成/);
});

test('P2 points overflow and compact settings controls stay discoverable and touchable', () => {
    const views = read('public/operations/views.js');
    const settings = read('public/operations/settings.js');
    const script = read('public/script.js');

    assert.match(views, /左右浏览更多积分理由/);
    assert.match(views, /el\.scrollBy\(/);
    assert.match(views, /ResizeObserver/);
    assert.match(views, /向左浏览更多积分理由/);
    assert.match(views, /向右浏览更多积分理由/);
    assert.match(settings, /min-h-11 px-3 py-2 bg-gray-200[\s\S]{0,120}新增学科/);
    assert.match(views, /min-h-11 border rounded-lg px-3 py-2 text-sm/);
    assert.match(read('public/attendance/module.js'), /开始日期不能晚于结束日期/);
    assert.match(script, /min-h-screen w-full min-w-0 pb-20/);
    assert.match(script, /w-full min-w-0 max-w-6xl/);
    assert.doesNotMatch(settings, /h\("button"[^\n]+className: [^\n]*py-1/);
});

test('daily registers share one searchable student workbench without losing per-mode selections', () => {
    const operations = read('public/operations/module.js');
    const views = read('public/operations/views.js');

    assert.match(operations, /const \[registerMode, setRegisterMode\] = useState\('homework'\)/);
    assert.match(operations, /'aria-label': '日常登记类型'/);
    assert.match(operations, /切换类型不会清空各自的已选名单/);
    assert.match(operations, /activeRegisterMode === 'homework'/);
    assert.match(operations, /activeRegisterMode === 'running'/);
    assert.match(operations, /activeRegisterMode === 'hygiene'/);
    assert.match(operations, /activeRegisterMode === 'discipline'/);
    assert.match(views, /const RegisterStudentPicker/);
    assert.match(views, /输入姓名中的任意文字/);
    assert.match(views, /按小组筛选/);
    assert.match(views, /仅看已选/);
    assert.match(views, /匹配 \$\{visibleStudents\.length\} 人 · 已显示 \$\{displayedStudents\.length\} 人/);
    assert.match(views, /setSelectedIds\(previous =>/);
    assert.doesNotMatch(views, /gap-1\.5|py-0\.5|bg-indigo-700|bg-emerald-700|#ea580c/);
});

test('P3 daily register limits visual density and keeps selected context actionable', () => {
    const views = read('public/operations/views.js');
    const styles = read('public/styles.css');

    assert.match(views, /INITIAL_VISIBLE_STUDENT_COUNT = 24/);
    assert.match(views, /visibleStudents\.slice\(0, visibleLimit\)/);
    assert.match(views, /继续显示 \(\$\{remainingStudentCount\} 人\)/);
    assert.match(views, /收起名单/);
    assert.match(views, /已选：/);
    assert.match(views, /前往提交/);
    assert.match(views, /scrollIntoView\(\{ block: 'center', behavior: 'smooth' \}\)/);
    assert.match(styles, /\.register-student-grid \{[\s\S]*contain: layout paint style/);
});

test('P3 global decorative motion uses restrained static treatments', () => {
    const styles = read('public/styles.css');

    assert.doesNotMatch(styles, /animate-bounce-in|cubic-bezier\(0\.34, 1\.56, 0\.64, 1\)/);
    assert.doesNotMatch(styles, /@keyframes (twinkle|meteor|float|pulse-glow|gradient-x|shimmer)/);
    assert.match(styles, /\.meteor-shower \{\s*display: none/);
    assert.match(styles, /\.animate-float,[\s\S]*\.animate-pulse-glow \{ animation: none; \}/);
    assert.match(styles, /\.frame-diamond \{ border: 2px solid #3b82f6; box-shadow: none; \}/);
    assert.match(styles, /border-radius: 4px/);
});

test('attendance statistics prioritize action before recognition and explain empty states', () => {
    const attendance = read('public/attendance/module.js');
    const attentionIndex = attendance.indexOf('需要关注');
    const recognitionIndex = attendance.indexOf('表扬与参考');

    assert.ok(attentionIndex >= 0);
    assert.ok(recognitionIndex > attentionIndex);
    assert.match(attendance, /先查看区间内的迟到与缺勤，再进入修正处理/);
    assert.match(attendance, /进入考勤修正/);
    assert.match(attendance, /本区间无迟到记录/);
    assert.match(attendance, /本区间无缺勤记录/);
    assert.match(attendance, /本区间暂无全勤学生/);
    assert.match(attendance, /本区间暂无连续出勤排行/);
    assert.match(attendance, /发放全勤奖/);
});

test('points taxonomy and commissioner effects are explained in outcome language', () => {
    const settings = read('public/operations/settings.js');
    const views = read('public/operations/views.js');

    assert.match(settings, /场景回答“事情在哪里发生”，类别回答“属于哪类班级管理”/);
    assert.match(settings, /用于积分历史筛选和统计，不会改变分值/);
    assert.match(views, /记录事情发生在哪里，例如课堂、班级或宿舍/);
    assert.match(views, /用于历史筛选和统计，例如学习、纪律或班务/);
    assert.match(views, /本次不会发放专员奖励/);
    assert.match(views, /所选学生每人扣/);
});
