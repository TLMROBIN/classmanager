/**
 * 双子星可选功能改造脚本
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'script.js');
let content = fs.readFileSync(filePath, 'utf8');

console.log('开始添加双子星可选功能...');

// 修改1: 在DEFAULT_SYSTEM_CONFIG中添加enabledFeatures配置
if (!content.includes('enabledFeatures:')) {
    content = content.replace(
        /recordCategoryPendingMigrated: false,\s*\n\s*\/\/ 考勤配置/,
        `recordCategoryPendingMigrated: false,
    
    // 功能开关配置
    enabledFeatures: {
        battle: true  // 双子星对战系统
    },
    
    // 考勤配置`
    );
    console.log('✅ 1. 添加enabledFeatures配置');
}

// 修改2: 在getSystemConfig中添加合并逻辑
if (!content.includes('enabledFeatures')) {
    content = content.replace(
        /if \(userConfig\.recordCategoryPendingMigrated !== undefined\)/,
        `if (userConfig.enabledFeatures) {
        merged.enabledFeatures = { ...merged.enabledFeatures, ...userConfig.enabledFeatures };
    }
    if (userConfig.recordCategoryPendingMigrated !== undefined)`
    );
    console.log('✅ 2. 添加getSystemConfig合并逻辑');
}

// 修改3: 在Nav组件中根据配置动态显示Tab
content = content.replace(
    /const Nav = \({ activeTab, setActiveTab, syncStatus, onRefresh }\) => {/,
    `const Nav = ({ activeTab, setActiveTab, syncStatus, onRefresh, config }) => {
        const systemConfig = getSystemConfig(config);
        const battleEnabled = systemConfig.enabledFeatures?.battle ?? true;`
);
console.log('✅ 3. Nav组件添加config参数');

// 修改4: Nav组件的Tab列表根据配置过滤
content = content.replace(
    /\[{ id: 'dashboard', label: '仪表盘'.*?id: 'settings', label: '维护', icon: 'menu' }\]/,
    `[
            { id: 'dashboard', label: '仪表盘', icon: 'chart' },
            { id: 'operations', label: '积分', icon: 'star' },
            { id: 'attendance', label: '考勤', icon: 'clock' },
            { id: 'tasks', label: '任务', icon: 'tasks' },
            { id: 'battle', label: '双子星', icon: 'swords', requiresFeature: 'battle' },
            { id: 'treasure', label: '藏宝阁', icon: 'gift' },
            { id: 'profile', label: '头像', icon: 'smile' },
            { id: 'settings', label: '维护', icon: 'menu' }
        ].filter(item => {
            if (item.requiresFeature === 'battle') return battleEnabled;
            return true;
        })`
);
console.log('✅ 4. Nav组件Tab列表添加过滤逻辑');

// 修改5: Nav组件调用添加config参数
content = content.replace(
    /h\(Nav, { activeTab, setActiveTab, syncStatus, onRefresh: handleRefreshData }\)/,
    'h(Nav, { activeTab, setActiveTab, syncStatus, onRefresh: handleRefreshData, config })'
);
console.log('✅ 5. Nav组件调用添加config参数');

fs.writeFileSync(filePath, content);
console.log('\n✅ 双子星可选功能添加完成！');