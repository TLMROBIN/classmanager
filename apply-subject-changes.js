/**
 * 学科配置和作业登记功能改造脚本
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'script.js');
let content = fs.readFileSync(filePath, 'utf8');

// ============================================
// 修改 1: DEFAULT_SYSTEM_CONFIG 添加 subjects 和 psychologicalCommissioner
// ============================================
content = content.replace(
    /commissionerRoles:\s*\[[\s\S]*?\{[^}]*id:\s*'homework'[^}]*name:\s*'作业专员'[^}]*\}\s*\]\s*\}/,
    `commissionerRoles: [
            { id: 'noise', name: '噪音专员' },
            { id: 'desk', name: '书桌专员' },
            { id: 'tablet', name: '平板专员' },
            { id: 'outdoor', name: '外出专员' },
            { id: 'attend', name: '考勤专员' },
            { id: 'homework', name: '作业专员' }
        ],
        subjects: [
            { id: 'chinese', name: '语文', representatives: [] },
            { id: 'math', name: '数学', representatives: [] },
            { id: 'english', name: '英语', representatives: [] },
            { id: 'physics', name: '物理', representatives: [] },
            { id: 'chemistry', name: '化学', representatives: [] },
            { id: 'biology', name: '生物', representatives: [] },
            { id: 'geography', name: '地理', representatives: [] },
            { id: 'politics', name: '政治', representatives: [] },
            { id: 'history', name: '历史', representatives: [] }
        ],
        psychologicalCommissioner: null
    }`
);

// ============================================
// 修改 2: getSystemConfig 添加合并逻辑
// ============================================
content = content.replace(
    /if \(userConfig\.organization\.commissionerRoles\)\s*merged\.organization\.commissionerRoles\s*=\s*userConfig\.organization\.commissionerRoles;\s*\}/,
    `if (userConfig.organization.commissionerRoles) merged.organization.commissionerRoles = userConfig.organization.commissionerRoles;
        if (userConfig.organization.subjects) merged.organization.subjects = userConfig.organization.subjects;
        if (userConfig.organization.psychologicalCommissioner !== undefined) merged.organization.psychologicalCommissioner = userConfig.organization.psychologicalCommissioner;
    }`
);

// ============================================
// 修改 3: homeworkSubjects 从配置读取
// ============================================
content = content.replace(
    /const homeworkSubjects\s*=\s*\["语文",\s*"数学",\s*"英语",\s*"物理",\s*"化学",\s*"生物",\s*"地理"\];/,
    `const systemConfig = getSystemConfig(config);
        const homeworkSubjects = (systemConfig.organization.subjects || []).map(s => s.name);
        const todayStr = getTodayStr();
        const homeworkDoneToday = config.homeworkRecords?.[todayStr] || {};`
);

// ============================================
// 修改 4: handleHomeworkSubmit 函数重写
// ============================================
content = content.replace(
    /const handleHomeworkSubmit\s*=\s*\(\)\s*=>\s*\{[\s\S]*?setHwSelectedIds\(new Set\(\)\);\s*\};/,
    `const handleHomeworkSubmit = (noMissing = false) => {
            if (!hwSubject) return alert("请选择学科");
            const dateVal = hwDate || homeworkDates[0];
            if (!dateVal) return alert("请选择日期");
            
            // 检查该学科今天是否已登记
            if (homeworkDoneToday[hwSubject]) {
                return alert("该学科今日已完成作业登记");
            }
            
            // 处理未交学生扣分
            if (!noMissing && hwSelectedIds.size > 0) {
                const updates = Array.from(hwSelectedIds).map(id => ({
                    id,
                    val: -1,
                    reason: hwSubject + '作业未交 ' + dateVal,
                    type: 'penalty',
                    scene: "班级",
                    category: "学业"
                }));
                batchUpdatePoints(updates);
            }
            
            // 给课代表加分
            const subject = systemConfig.organization.subjects?.find(s => s.name === hwSubject);
            if (subject?.representatives?.length > 0) {
                const repUpdates = subject.representatives.filter(id => id).map(id => ({
                    id,
                    val: 1,
                    reason: subject.name + '作业登记',
                    type: 'bonus',
                    scene: '班级',
                    category: '班务'
                }));
                if (repUpdates.length > 0) {
                    batchUpdatePoints(repUpdates);
                }
            }
            
            // 记录当天已登记
            setConfig(prev => ({
                ...prev,
                homeworkRecords: {
                    ...prev.homeworkRecords,
                    [todayStr]: {
                        ...prev.homeworkRecords?.[todayStr],
                        [hwSubject]: true
                    }
                }
            }));
            
            setHwSelectedIds(new Set());
            alert('作业登记完成！');
        };`
);

// ============================================
// 修改 5: 作业登记UI - 学科按钮显示已登记状态
// ============================================
content = content.replace(
    /homeworkSubjects\.map\(sub\s*=>\s*h\("button",\s*\{[\s\S]*?className:\s*`px-3\s*py-1\s*rounded-full[\s\S]*?\}\s*,\s*sub\)\)/,
    `homeworkSubjects.map(sub => {
                        const isDone = homeworkDoneToday[sub];
                        return h("button", {
                            key: sub,
                            onClick: () => setHwSubject(sub),
                            disabled: isDone,
                            className: \`px-3 py-1 rounded-full text-xs font-bold border \${hwSubject === sub ? 'bg-blue-600 text-white border-blue-600' : isDone ? 'bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-gray-50 text-gray-700 border-gray-200'}\`
                        }, isDone ? sub + '✓' : sub);
                    })`
);

// ============================================
// 修改 6: 作业登记UI - 添加"无"按钮
// ============================================
content = content.replace(
    /h\("div",\s*\{\s*className:\s*"flex\s*justify-between\s*items-center\s*mb-2"\s*\},\s*h\("div",\s*\{\s*className:\s*"text-sm\s*text-gray-600"\s*\},\s*"选择未交学生"\)/,
    `h("div", { className: "flex justify-between items-center mb-2" },
                    h("div", { className: "text-sm text-gray-600" }, "选择未交学生"),
                    h("button", {
                        onClick: () => handleHomeworkSubmit(true),
                        disabled: !hwSubject || homeworkDoneToday[hwSubject],
                        className: \`px-3 py-1 rounded text-sm \${!hwSubject || homeworkDoneToday[hwSubject] ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600'}\`
                    }, "无未交作业-课代表加分")`
);

console.log('✅ 学科配置和作业登记功能改造完成');
console.log('修改内容:');
console.log('1. DEFAULT_SYSTEM_CONFIG 添加 subjects, psychologicalCommissioner');
console.log('2. getSystemConfig 添加合并逻辑');
console.log('3. homeworkSubjects 从配置读取');
console.log('4. handleHomeworkSubmit 支持课代表加分和每日限制');
console.log('5. 学科按钮显示已登记状态');
console.log('6. 添加"无未交作业"按钮');

fs.writeFileSync(filePath, content);