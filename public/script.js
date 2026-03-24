// --- 1. 静态数据配置（保留作为默认值，用于向后兼容） ---
window.DEFAULT_ADMIN_PASSWORD = "K9x4B2m7Q5w8Z1v3"; // 全局管理员密码（默认值）

window.SCHEDULE_CONFIG = [
  { id: 'morning', name: '早读', start: '06:00', end: '07:20', lateTime: '07:00' },
  { id: 'noon', name: '午练', start: '14:00', end: '14:40', lateTime: '14:20' },
  { id: 'evening', name: '晚自习', start: '18:00', end: '19:00', lateTime: '18:30' }
];

// 默认励志语录
window.DEFAULT_QUOTES = [
    "乾坤未定，你我皆是黑马。",
    "拼两个春夏秋冬，博高考无怨无悔。",
    "每一分钟的努力，都是为了遇见更好的自己。",
    "将来的你，一定会感谢现在拼命的自己。",
    "不苦不累，高三无味；不拼不搏，等于白活。",
    "含泪播种的人一定能含笑收获。",
    "有志者自有千计万计，无志者只感千难万难。",
    "耐得住寂寞，守得住繁华。",
    "行百里者半九十。",
    "天道酬勤，厚德载物。",
    "星光不问赶路人，时光不负有心人。",
    "没有白走的路，每一步都算数。"
];

// --- 默认系统配置（用于新班级初始化） ---
const DEFAULT_SYSTEM_CONFIG = {
// 基础配置
    className: "班级自在管理系统",
    adminPassword: window.DEFAULT_ADMIN_PASSWORD,
    quotes: [...window.DEFAULT_QUOTES],
    recordCategoryPendingMigrated: false,
    
    // 功能开关配置
    enabledFeatures: {
        battle: true  // 双子星对战系统
    },
    
    // 考勤配置
    attendance: {
        schedule: [...window.SCHEDULE_CONFIG],
        weekendRules: {
            monday: [0, 1, 2],      // 周一：全部时段
            tuesday: [0, 1, 2],     // 周二：全部时段
            wednesday: [0, 1, 2],   // 周三：全部时段
            thursday: [0, 1, 2],    // 周四：全部时段
            friday: [0, 1],         // 周五：早读、午练
            saturday: [],           // 周六：不考勤
            sunday: [2]             // 周日：仅晚自习
        },
        sundaySpecialLateTime: {    // 周日特殊迟到时间
            'evening': '19:00'
        },
        penaltyRules: {
            late: -1,               // 迟到扣分
            absent: -5,             // 缺勤扣分
            perfectAttendance: 10   // 全勤奖
        }
    },
    
    // 组织架构配置
    organization: {
        groups: [
            { id: 'publicity', name: '🎨 宣传组', color: 'bg-pink-100 text-pink-800 border-pink-200' },
            { id: 'hygiene', name: '🧹 卫生组', color: 'bg-green-100 text-green-800 border-green-200' },
            { id: 'discipline', name: '📏 纪律组', color: 'bg-blue-100 text-blue-800 border-blue-200' },
            { id: 'life', name: '🌻 生活组', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
        ],
        dorms: [
            { id: 'boy_715', name: '👦 715' },
            { id: 'boy_716', name: '👦 716' },
            { id: 'girl_713', name: '👧 713' },
            { id: 'girl_714', name: '👧 714' },
            { id: 'girl_715', name: '👧 715' }
        ],
        commissionerRoles: [
            { id: 'noise', name: '噪音专员' },
            { id: 'desk', name: '书桌专员' },
            { id: 'tablet', name: '平板专员' },
            { id: 'outdoor', name: '外出专员' },
            { id: 'attend', name: '考勤专员' },
            { id: 'homework', name: '作业专员' }
        ],
        customRoles: []
    },
    
    // 积分系统配置
    points: {
        dailyWageAmount: 5,
        dailyWageGroups: ['discipline', 'hygiene'],
        reasons: [
            { name: "每日工资", val: 5, type: 'bonus', note: "组长+6", scene: "班级", category: "班务" },
            { name: "宣传组装饰", val: 100, type: 'bonus', note: "组长+120", scene: "班级", category: "纪律" },
            { name: "组织活动", val: 20, type: 'bonus', note: "组长+24", scene: "班级", category: "纪律" },
            { name: "周全勤奖", val: 10, type: 'bonus', scene: "班级", category: "纪律" },
            { name: "大考优秀", val: 20, type: 'bonus', scene: "班级", category: "纪律" },
            { name: "学习复盘", val: 5, type: 'bonus', editable: true, scene: "班级", category: "纪律" },
            { name: "错题抽查", val: 5, type: 'bonus', editable: true, scene: "班级", category: "纪律" },
            { name: "思维导图", val: 5, type: 'bonus', editable: true, scene: "班级", category: "纪律" },
            { name: "宿舍加分", val: 1, type: 'bonus', isMulti: true, factor: 10, note: "输入值×10", scene: "宿舍", category: "纪律" },
            { name: "噪音/喧哗", val: -5, type: 'penalty', scene: "班级", category: "纪律" },
            { name: "桌面杂乱", val: -5, type: 'penalty', scene: "班级", category: "纪律" },
            { name: "平板未归位", val: -5, type: 'penalty', scene: "班级", category: "纪律" },
            { name: "任意走动", val: -0.5, type: 'penalty', scene: "班级", category: "纪律" },
            { name: "擅自外出", val: -1, type: 'penalty', scene: "班级", category: "纪律" },
            { name: "失联(严重)", val: -100, type: 'penalty', scene: "班级", category: "纪律" },
            { name: "迟到", val: -1, type: 'penalty', scene: "班级", category: "纪律" },
            { name: "缺勤", val: -5, type: 'penalty', scene: "班级", category: "出勤" },
            { name: "缺交作业", val: -1, type: 'penalty', scene: "班级", category: "学业" },
            { name: "卫生扣分", val: -1, type: 'penalty', isMulti: true, factor: 5, note: "仅卫生组×5", scene: "宿舍", category: "卫生" }
        ]
    },
    
    // 藏宝阁配置
    treasures: [
        { id: 1, name: "免做卡", rarity: "SSR", price: 200, stock: 3, desc: "免除一次作业", ladderPrices: [], dailyLimit: 0 },
        { id: 2, name: "奶茶券", rarity: "SR", price: 50, stock: 10, desc: "兑换一杯奶茶", ladderPrices: [50, 60, 70], dailyLimit: 2 },
        { id: 3, name: "自选座位", rarity: "SR", price: 60, stock: 5, desc: "优先选择座位一次", ladderPrices: [], dailyLimit: 0 },
        { id: 4, name: "免值日卡", rarity: "R", price: 30, stock: 20, desc: "免除一次值日", ladderPrices: [], dailyLimit: 0 },
        { id: 5, name: "零食包", rarity: "R", price: 20, stock: 50, desc: "随机小零食", ladderPrices: [], dailyLimit: 0 },
        { id: 6, name: "铅笔", rarity: "N", price: 5, stock: 100, desc: "普通铅笔一支", ladderPrices: [], dailyLimit: 0 },
        { id: 7, name: "橡皮擦", rarity: "N", price: 5, stock: 100, desc: "普通橡皮一块", ladderPrices: [], dailyLimit: 0 },
        { id: 8, name: "棒棒糖", rarity: "N", price: 2, stock: 200, desc: "甜蜜一下", ladderPrices: [], dailyLimit: 0 },
        { id: 9, name: "测试宝物", rarity: "N", price: 0, stock: 1000, desc: "仅供测试使用", ladderPrices: [], dailyLimit: 0 }
    ],
    
    // 学科配置
    subjects: [
        { id: 'chinese', name: '语文', representatives: [] },
        { id: 'math', name: '数学', representatives: [] },
        { id: 'english', name: '英语', representatives: [] },
        { id: 'physics', name: '物理', representatives: [] },
        { id: 'chemistry', name: '化学', representatives: [] },
        { id: 'biology', name: '生物', representatives: [] },
        { id: 'politics', name: '政治', representatives: [] },
        { id: 'history', name: '历史', representatives: [] },
        { id: 'geography', name: '地理', representatives: [] }
    ]
};

const POINT_SCENES = ["宿舍", "班级", "校级", "其他"];
const POINT_CATEGORIES = ["待定", "学业", "纪律", "卫生", "兑奖", "出勤", "班务"];
const DEFAULT_POINT_SCENE = "班级";
const DEFAULT_POINT_CATEGORY = "纪律";

const normalizePointScene = (scene) => POINT_SCENES.includes(scene) ? scene : DEFAULT_POINT_SCENE;
const normalizePointCategory = (category) => POINT_CATEGORIES.includes(category) ? category : DEFAULT_POINT_CATEGORY;
const normalizeCustomRoles = (roles, fallbackDailyWage = 0) => (
    Array.isArray(roles) ? roles : []
).map((role, idx) => ({
    id: role?.id || `custom_role_${idx + 1}`,
    name: role?.name || "",
    studentId: role?.studentId != null && role.studentId !== "" ? Number(role.studentId) : null,
    dailyWage: Number.isFinite(Number(role?.dailyWage)) ? Number(role.dailyWage) : fallbackDailyWage
}));
const normalizeExamArchives = (examArchives, fallbackBattle = null) => {
    const source = examArchives || {};
    const fallbackExams = Array.isArray(fallbackBattle?.exams) ? fallbackBattle.exams : [];
    const exams = Array.isArray(source.exams) && source.exams.length > 0
        ? source.exams
        : fallbackExams;
    return {
        version: Number(source.version) || 1,
        exams,
        latestExamId: source.latestExamId || exams[0]?.id || '',
        defaultBattleBaseExamId: source.defaultBattleBaseExamId || '',
        defaultBattleSettleExamId: source.defaultBattleSettleExamId || ''
    };
};
const normalizeBattleSnapshots = (battleSnapshots) => {
    const transfer = window.BattleTransfer || {};
    if (typeof transfer.normalizeBattleSnapshots === 'function') {
        return transfer.normalizeBattleSnapshots(battleSnapshots);
    }
    return Array.isArray(battleSnapshots) ? battleSnapshots : [];
};
const profileUtils = window.ProfileUtils || {};
const {
    normalizeStudentProfiles,
    getStudentProfile,
    remapStudentProfilesToStudentsByName
} = profileUtils;
if (!normalizeStudentProfiles || !getStudentProfile || !remapStudentProfilesToStudentsByName) {
    throw new Error('Profile utils failed to load');
}
const profilePersistence = window.ProfilePersistence || {};
const {
    hasStudentProfilesInData,
    buildNormalizedStudentProfiles,
    restoreStudentProfilesFromData,
    mergeStudentProfilesForData
} = profilePersistence;
if (!hasStudentProfilesInData || !buildNormalizedStudentProfiles || !restoreStudentProfilesFromData || !mergeStudentProfilesForData) {
    throw new Error('Profile persistence failed to load');
}
const getLatestExamArchiveRank = (examArchives, studentId) => {
    const archives = normalizeExamArchives(examArchives);
    const latestExamId = archives.latestExamId || archives.exams[0]?.id || '';
    if (!latestExamId) return null;
    const exam = archives.exams.find(item => item.id === latestExamId) || archives.exams[0];
    if (!exam || !exam.ranks) return null;
    const rank = exam.ranks[studentId];
    if (!rank) return null;
    const c = Number(rank.c);
    const g = Number(rank.g);
    return {
        c: Number.isFinite(c) ? c : null,
        g: Number.isFinite(g) ? g : null
    };
};

// --- 配置管理函数 ---
// 获取系统配置（从config.systemConfig读取，如果没有则使用默认值）
const getSystemConfig = (config) => {
    if (!config || !config.systemConfig) {
        return DEFAULT_SYSTEM_CONFIG;
    }
    // 深度合并默认配置和用户配置
    const merged = JSON.parse(JSON.stringify(DEFAULT_SYSTEM_CONFIG));
    const userConfig = config.systemConfig;
    
    // 合并基础配置
    if (userConfig.className !== undefined) merged.className = userConfig.className;
    if (userConfig.adminPassword !== undefined) merged.adminPassword = userConfig.adminPassword;
    if (userConfig.quotes !== undefined) merged.quotes = userConfig.quotes;
    if (userConfig.recordCategoryPendingMigrated !== undefined) merged.recordCategoryPendingMigrated = userConfig.recordCategoryPendingMigrated;
    
    if (userConfig.enabledFeatures) {
        merged.enabledFeatures = { ...merged.enabledFeatures, ...userConfig.enabledFeatures };
    }
    
    if (userConfig.attendance) {
        if (userConfig.attendance.schedule) merged.attendance.schedule = userConfig.attendance.schedule;
        if (userConfig.attendance.weekendRules) merged.attendance.weekendRules = { ...merged.attendance.weekendRules, ...userConfig.attendance.weekendRules };
        if (userConfig.attendance.sundaySpecialLateTime) merged.attendance.sundaySpecialLateTime = { ...merged.attendance.sundaySpecialLateTime, ...userConfig.attendance.sundaySpecialLateTime };
        if (userConfig.attendance.penaltyRules) merged.attendance.penaltyRules = { ...merged.attendance.penaltyRules, ...userConfig.attendance.penaltyRules };
    }
    
    // 合并组织架构配置
    if (userConfig.organization) {
        if (userConfig.organization.groups) merged.organization.groups = userConfig.organization.groups;
        if (userConfig.organization.dorms) merged.organization.dorms = userConfig.organization.dorms;
        if (userConfig.organization.commissionerRoles) merged.organization.commissionerRoles = userConfig.organization.commissionerRoles;
        if (Array.isArray(userConfig.organization.customRoles)) {
            merged.organization.customRoles = normalizeCustomRoles(userConfig.organization.customRoles);
        } else if (Array.isArray(userConfig.organization.studentCouncilRoles)) {
            merged.organization.customRoles = normalizeCustomRoles(userConfig.organization.studentCouncilRoles, 2);
        }
    }
    
    // 合并积分系统配置
    if (userConfig.points) {
        if (userConfig.points.dailyWageAmount !== undefined) {
            merged.points.dailyWageAmount = Number(userConfig.points.dailyWageAmount);
        }
        if (Array.isArray(userConfig.points.dailyWageGroups)) {
            merged.points.dailyWageGroups = userConfig.points.dailyWageGroups;
        }
        if (userConfig.points.reasons) {
            merged.points.reasons = userConfig.points.reasons;
        }
    }
    
    // 合并学科配置
    if (userConfig.subjects) {
        merged.subjects = userConfig.subjects;
    }
    
    // 合并藏宝阁配置
    if (userConfig.treasures) {
        merged.treasures = userConfig.treasures;
    }
    
    return merged;
};

// 获取考勤时段配置
const getScheduleConfig = (config) => {
    const systemConfig = getSystemConfig(config);
    return systemConfig.attendance.schedule;
};

// 获取周末规则
const getWeekendRules = (config) => {
    const systemConfig = getSystemConfig(config);
    return systemConfig.attendance.weekendRules;
};

// 获取扣分规则
const getPenaltyRules = (config) => {
    const systemConfig = getSystemConfig(config);
    return systemConfig.attendance.penaltyRules;
};

// 获取小组配置（转换为对象格式，兼容旧代码）
const getGroupsConfig = (config) => {
    const systemConfig = getSystemConfig(config);
    const groupsObj = {};
    systemConfig.organization.groups.forEach(g => {
        groupsObj[g.id] = { name: g.name, color: g.color };
    });
    return groupsObj;
};

// 获取宿舍配置（转换为对象格式，兼容旧代码）
const getDormsConfig = (config) => {
    const systemConfig = getSystemConfig(config);
    const dormsObj = {};
    systemConfig.organization.dorms.forEach(d => {
        dormsObj[d.id] = d.name;
    });
    return dormsObj;
};

// 获取专员角色配置
const getCommissionerRoles = (config) => {
    const systemConfig = getSystemConfig(config);
    return systemConfig.organization.commissionerRoles;
};

const getCustomRoles = (config) => {
    const systemConfig = getSystemConfig(config);
    return normalizeCustomRoles(systemConfig.organization.customRoles || []);
};

// 获取积分理由预设
const getReasonsPreset = (config) => {
    const systemConfig = getSystemConfig(config);
    return systemConfig.points.reasons;
};

// 获取藏宝阁商品配置
const getTreasuresConfig = (config) => {
    const systemConfig = getSystemConfig(config);
    return systemConfig.treasures;
};

// 获取学科配置
const getSubjectsConfig = (config) => {
    const systemConfig = getSystemConfig(config);
    return systemConfig.subjects || DEFAULT_SYSTEM_CONFIG.subjects;
};

const getDefaultCommissioners = (config) => {
    const roles = getCommissionerRoles(config);
    return roles.reduce((acc, role) => {
        acc[role.id] = null;
        return acc;
    }, {});
};

const mergeAttendanceRecords = (localRecords, remoteRecords) => {
    const merged = { ...(localRecords || {}) };
    const remote = remoteRecords || {};
    // 状态优先级：ok/late（已到场）永远优先于 absent（系统自动补录）
    const statusPriority = (rec) => {
        if (!rec) return -1;
        if (rec.status === 'ok' || rec.status === 'late') return 2;
        if (rec.status === 'absent') return 1;
        return 0;
    };
    Object.keys(remote).forEach(date => {
        if (!merged[date]) merged[date] = {};
        Object.keys(remote[date] || {}).forEach(name => {
            if (!merged[date][name]) merged[date][name] = {};
            Object.keys(remote[date][name] || {}).forEach(sessionId => {
                const localRec = merged[date][name][sessionId];
                const remoteRec = remote[date][name][sessionId];
                if (!localRec) { merged[date][name][sessionId] = remoteRec; return; }
                if (!remoteRec) return;
                const localPriority = statusPriority(localRec);
                const remotePriority = statusPriority(remoteRec);
                // 优先级高的胜出；优先级相同时取时间戳更新的
                if (remotePriority > localPriority) {
                    merged[date][name][sessionId] = remoteRec;
                } else if (remotePriority === localPriority) {
                    const localTs = typeof localRec.timestamp === 'number' ? localRec.timestamp : 0;
                    const remoteTs = typeof remoteRec.timestamp === 'number' ? remoteRec.timestamp : 0;
                    if (remoteTs >= localTs) merged[date][name][sessionId] = remoteRec;
                }
                // remotePriority < localPriority：保留本地记录，不覆盖
            });
        });
    });
    return merged;
};

const normalizeArray = (arr) => Array.isArray(arr) ? arr : [];
const getMergeKey = (item, fallback) => {
    if (!item || typeof item !== 'object') return fallback;
    if (item.id != null) return `id:${item.id}`;
    if (item.ts != null) return `ts:${item.ts}`;
    if (item.name != null) return `name:${item.name}`;
    return fallback;
};
const mergeArrayByKey = (a, b) => {
    const map = new Map();
    normalizeArray(a).forEach((item, idx) => {
        map.set(getMergeKey(item, `a:${idx}`), item);
    });
    normalizeArray(b).forEach((item, idx) => {
        map.set(getMergeKey(item, `b:${idx}`), item);
    });
    return Array.from(map.values());
};

const GUEST_ROSTER = [
    { id: 'g1', name: "张三", gender: "M", group: "publicity", role: "member", dorm: "boy_715", zizai: 0, balance: 0, penalty: 0 },
    { id: 'g2', name: "李四", gender: "M", group: "hygiene", role: "member", dorm: "boy_716", zizai: 0, balance: 0, penalty: 0 },
    { id: 'g3', name: "王五", gender: "F", group: "discipline", role: "member", dorm: "girl_713", zizai: 0, balance: 0, penalty: 0 }
];

const INITIAL_ROSTER = [
    { name: "代韧康", gender: "M", group: "publicity", role: "leader", dorm: "boy_715" },
    { name: "陈妍", gender: "F", group: "publicity", role: "member", dorm: "girl_713" },
    { name: "徐青阳", gender: "F", group: "publicity", role: "member", dorm: "girl_714" },
    { name: "龙弈衡", gender: "F", group: "publicity", role: "member", dorm: "girl_714" },
    { name: "郝栋", gender: "M", group: "publicity", role: "member", dorm: "boy_716" },
    { name: "鄢宸泽", gender: "M", group: "publicity", role: "member", dorm: "boy_715" },
    { name: "倪浩瀚", gender: "M", group: "publicity", role: "member", dorm: "boy_715" },
    { name: "谢浩然", gender: "M", group: "hygiene", role: "leader", dorm: "boy_716" },
    { name: "谢宇欣", gender: "F", group: "hygiene", role: "member", dorm: "girl_715" },
    { name: "刘梦颖", gender: "F", group: "hygiene", role: "member", dorm: "girl_715" },
    { name: "陈可欣", gender: "F", group: "hygiene", role: "member", dorm: "girl_715" },
    { name: "陈正岳", gender: "M", group: "hygiene", role: "member", dorm: "boy_716" },
    { name: "庄锐生", gender: "M", group: "hygiene", role: "member", dorm: "boy_715" },
    { name: "胡诺翔", gender: "M", group: "hygiene", role: "member", dorm: "boy_715" },
    { name: "周放", gender: "M", group: "discipline", role: "leader", dorm: "boy_716" },
    { name: "曾伊静", gender: "F", group: "discipline", role: "member", dorm: "girl_714" },
    { name: "黄籽璇", gender: "F", group: "discipline", role: "member", dorm: "girl_713" },
    { name: "吴思怡", gender: "F", group: "discipline", role: "member", dorm: "girl_714" },
    { name: "周俊栋", gender: "M", group: "discipline", role: "member", dorm: "boy_716" },
    { name: "邹佳颖", gender: "F", group: "discipline", role: "member", dorm: "girl_715" },
    { name: "郜盈盈", gender: "F", group: "discipline", role: "member", dorm: "girl_715" },
    { name: "刘语涵", gender: "F", group: "life", role: "leader", dorm: "girl_713" },
    { name: "曾敏豪", gender: "M", group: "life", role: "member", dorm: "boy_715" },
    { name: "朱黄盛", gender: "M", group: "life", role: "member", dorm: "boy_715" },
    { name: "李岩泽", gender: "M", group: "life", role: "member", dorm: "boy_716" },
    { name: "师澜歌", gender: "F", group: "life", role: "member", dorm: "girl_714" },
    { name: "张艾妮", gender: "F", group: "life", role: "member", dorm: "girl_714" },
    { name: "祝瑞融", gender: "F", group: "life", role: "member", dorm: "girl_715" }
];

const GROUPS = {
    publicity: { name: "🎨 宣传组", color: "bg-pink-100 text-pink-800 border-pink-200" },
    hygiene: { name: "🧹 卫生组", color: "bg-green-100 text-green-800 border-green-200" },
    discipline: { name: "📏 纪律组", color: "bg-blue-100 text-blue-800 border-blue-200" },
    life: { name: "🌻 生活组", color: "bg-yellow-100 text-yellow-800 border-yellow-200" }
};

const DORMS = {
    boy_715: "👦 715", boy_716: "👦 716",
    girl_713: "👧 713", girl_714: "👧 714", girl_715: "👧 715"
};

const REASONS_PRESET = [
    { name: "每日工资", val: 5, type: 'bonus', note: "组长+6", scene: "班级", category: "班务" },
    { name: "宣传组装饰", val: 100, type: 'bonus', note: "组长+120", scene: "班级", category: "纪律" },
    { name: "组织活动", val: 20, type: 'bonus', note: "组长+24", scene: "班级", category: "纪律" },
    { name: "周全勤奖", val: 10, type: 'bonus', scene: "班级", category: "纪律" },
    { name: "大考优秀", val: 20, type: 'bonus', scene: "班级", category: "纪律" },
    { name: "学习复盘", val: 5, type: 'bonus', editable: true, scene: "班级", category: "纪律" },
    { name: "错题抽查", val: 5, type: 'bonus', editable: true, scene: "班级", category: "纪律" },
    { name: "思维导图", val: 5, type: 'bonus', editable: true, scene: "班级", category: "纪律" },
    { name: "宿舍加分", val: 1, type: 'bonus', isMulti: true, factor: 10, note: "输入值×10", scene: "宿舍", category: "纪律" },
    { name: "噪音/喧哗", val: -5, type: 'penalty', scene: "班级", category: "纪律" },
    { name: "桌面杂乱", val: -5, type: 'penalty', scene: "班级", category: "纪律" },
    { name: "平板未归位", val: -5, type: 'penalty', scene: "班级", category: "纪律" },
    { name: "任意走动", val: -0.5, type: 'penalty', scene: "班级", category: "纪律" },
    { name: "擅自外出", val: -1, type: 'penalty', scene: "班级", category: "纪律" },
    { name: "失联(严重)", val: -100, type: 'penalty', scene: "班级", category: "纪律" },
    { name: "迟到", val: -1, type: 'penalty', scene: "班级", category: "纪律" },
    { name: "缺勤", val: -5, type: 'penalty', scene: "班级", category: "出勤" },
    { name: "缺交作业", val: -1, type: 'penalty', scene: "班级", category: "学业" },
    { name: "卫生扣分", val: -1, type: 'penalty', isMulti: true, factor: 5, note: "仅卫生组×5", scene: "宿舍", category: "卫生" }
];

const DEFAULT_COMMISSIONERS = { noise: null, desk: null, tablet: null, outdoor: null, attend: null, homework: null };
const COMMISSIONER_ROLES = [
    { id: 'noise', name: '噪音专员' }, { id: 'desk', name: '书桌专员' }, 
    { id: 'tablet', name: '平板专员' }, { id: 'outdoor', name: '外出专员' },
    { id: 'attend', name: '考勤专员' }, { id: 'homework', name: '作业专员' }
];
    
const INITIAL_TREASURES = [
    { id: 1, name: "免做卡", rarity: "SSR", price: 200, stock: 3, desc: "免除一次作业", ladderPrices: [], dailyLimit: 0 },
    { id: 2, name: "奶茶券", rarity: "SR", price: 50, stock: 10, desc: "兑换一杯奶茶", ladderPrices: [50, 60, 70], dailyLimit: 2 },
    { id: 3, name: "自选座位", rarity: "SR", price: 60, stock: 5, desc: "优先选择座位一次", ladderPrices: [], dailyLimit: 0 },
    { id: 4, name: "免值日卡", rarity: "R", price: 30, stock: 20, desc: "免除一次值日", ladderPrices: [], dailyLimit: 0 },
    { id: 5, name: "零食包", rarity: "R", price: 20, stock: 50, desc: "随机小零食", ladderPrices: [], dailyLimit: 0 },
    { id: 6, name: "铅笔", rarity: "N", price: 5, stock: 100, desc: "普通铅笔一支", ladderPrices: [], dailyLimit: 0 },
    { id: 7, name: "橡皮擦", rarity: "N", price: 5, stock: 100, desc: "普通橡皮一块", ladderPrices: [], dailyLimit: 0 },
    { id: 8, name: "棒棒糖", rarity: "N", price: 2, stock: 200, desc: "甜蜜一下", ladderPrices: [], dailyLimit: 0 },
    { id: 9, name: "测试宝物", rarity: "N", price: 0, stock: 1000, desc: "仅供测试使用", ladderPrices: [], dailyLimit: 0 }
];

(function() {
    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useMemo = React.useMemo;
    var useCallback = React.useCallback;
    var useRef = React.useRef;
        
    // --- Helper Functions ---
    const getNow = () => {
        if (window.__CM_TEST_MODE__) {
            const t = Number(window.__CM_TEST_TIME__);
            if (Number.isFinite(t)) {
                const d = new Date(t);
                if (!isNaN(d.getTime())) return d;
            }
            return new Date();
        }
        return new Date();
    };
    const getTodayStr = (now = getNow()) => {
        const d = new Date(now);
        if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
        return d.toISOString().split('T')[0];
    };
    const timeToMinutes = (timeStr) => {
        const parts = timeStr.split(':');
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    };
    const getDateString = (date) => {
        var pad = (n) => String(n).padStart(2, '0');
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    };
    const DAY_MS = 24 * 60 * 60 * 1000;
    const getStartOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = (from, to) => Math.floor((to - from) / DAY_MS);
        
    const getApiUrl = () => {
        if (window.location.protocol.startsWith('http')) {
            return "/api/data";
        }
        return null; 
    };
    const loadScriptOnce = (src) => {
        if (!window.__cmScriptPromises) window.__cmScriptPromises = {};
        if (window.__cmScriptPromises[src]) return window.__cmScriptPromises[src];
        window.__cmScriptPromises[src] = new Promise((resolve, reject) => {
            const handleError = () => {
                delete window.__cmScriptPromises[src];
                reject(new Error(`Failed to load ${src}`));
            };
            const existing = document.querySelector(`script[data-src="${src}"]`);
            if (existing) {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', handleError, { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.dataset.src = src;
            script.onload = resolve;
            script.onerror = handleError;
            document.body.appendChild(script);
        });
        return window.__cmScriptPromises[src];
    };

    const deepClone = (data) => JSON.parse(JSON.stringify(data));
    const getStorageItem = (key) => {
        try {
            if (window.__CM_TEST_MODE__) {
                const store = window.__CM_TEST_STORAGE__ || {};
                return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
            }
            return localStorage.getItem(key);
        } catch (_) {
            return null;
        }
    };
    const setStorageItem = (key, value) => {
        try {
            if (window.__CM_TEST_MODE__) {
                const store = window.__CM_TEST_STORAGE__ || {};
                store[key] = value;
                window.__CM_TEST_STORAGE__ = store;
                return;
            }
            localStorage.setItem(key, value);
        } catch (_) {}
    };
    const clearStorage = () => {
        try {
            if (window.__CM_TEST_MODE__) {
                window.__CM_TEST_STORAGE__ = {};
                return;
            }
            localStorage.clear();
        } catch (_) {}
    };
    const snapshotStorage = () => {
        const store = {};
        try {
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                if (key) store[key] = localStorage.getItem(key);
            }
        } catch (_) {}
        return store;
    };

    const ADMIN_AUTH_KEY = 'admin_auth_until';
    const ADMIN_AUTH_TTL_MS = 5 * 60 * 1000; // 5 minutes

    const getAdminAuthUntil = () => {
        try {
            const raw = getStorageItem(ADMIN_AUTH_KEY);
            return raw ? Number(raw) : 0;
        } catch (_) {
            return 0;
        }
    };

    const setAdminAuthUntil = (until) => {
        try {
            setStorageItem(ADMIN_AUTH_KEY, String(until));
        } catch (_) {}
    };

    const clearAdminAuth = () => setAdminAuthUntil(0);

    const isAdminAuthed = () => {
        const until = getAdminAuthUntil();
        return until && getNow().getTime() < until;
    };

    const requireAdminAuth = (promptText = "请输入管理员密码：", adminPassword = window.DEFAULT_ADMIN_PASSWORD) => {
        if (isAdminAuthed()) return true;
        const input = prompt(promptText);
        if (input === adminPassword) {
            setAdminAuthUntil(getNow().getTime() + ADMIN_AUTH_TTL_MS);
            return true;
        }
        alert("密码错误");
        return false;
    };

    const verifyAdmin = () => requireAdminAuth();

    // --- Icon Component ---
    var Icon = ({ name, size = 20, className = "" }) => {
        const paths = {
            menu: h("path", { d: "M3 12h18M3 6h18M3 18h18" }),
            x: h("path", { d: "M18 6 6 18M6 6l12 12" }),
            check: h("polyline", { points: "20 6 9 17 4 12" }),
            users: h("g", null, h("path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }), h("circle", { cx: "9", cy: "7", r: "4" }), h("path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }), h("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })),
            chart: h("g", null, h("line", { x1: "18", y1: "20", x2: "18", y2: "10" }), h("line", { x1: "12", y1: "20", x2: "12", y2: "4" }), h("line", { x1: "6", y1: "20", x2: "6", y2: "14" })),
            star: h("polygon", { points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" }),
            alert: h("g", null, h("circle", { cx: "12", cy: "12", r: "10" }), h("line", { x1: "12", y1: "8", x2: "12", y2: "12" }), h("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })),
            history: h("g", null, h("path", { d: "M3 3v5h5" }), h("path", { d: "M3.05 13A9 9 0 1 0 6 5.3L3 8" }), h("path", { d: "M12 7v5l4 2" })),
            filter: h("polygon", { points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" }),
            download: h("g", null, h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), h("polyline", { points: "7 10 12 15 17 10" }), h("line", { x1: "12", y1: "15", x2: "12", y2: "3" })),
            upload: h("g", null, h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), h("polyline", { points: "17 8 12 3 7 8" }), h("line", { x1: "12", y1: "3", x2: "12", y2: "15" })),
            trash: h("g", null, h("polyline", { points: "3 6 5 6 21 6" }), h("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })),
            undo: h("g", null, h("path", { d: "M3 7v6h6" }), h("path", { d: "M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" })),
            money: h("g", null, h("rect", { x: "2", y: "6", width: "20", height: "12", rx: "2" }), h("circle", { cx: "12", cy: "12", r: "2" }), h("path", { d: "M6 12h.01M18 12h.01" })),
            smile: h("g", null, h("circle", { cx: "12", cy: "12", r: "10" }), h("path", { d: "M8 14s1.5 2 4 2 4-2 4-2" }), h("line", { x1: "9", y1: "9", x2: "9.01", y2: "9" }), h("line", { x1: "15", y1: "9", x2: "15.01", y2: "9" })),
            frown: h("g", null, h("circle", { cx: "12", cy: "12", r: "10" }), h("path", { d: "M16 16s-1.5-2-4-2-4 2-4 2" }), h("line", { x1: "9", y1: "9", x2: "9.01", y2: "9" }), h("line", { x1: "15", y1: "9", x2: "15.01", y2: "9" })),
            clock: h("g", null, h("circle", { cx: "12", cy: "12", r: "10" }), h("polyline", { points: "12 6 12 12 16 14" })),
            clipboard: h("g", null, h("rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1" }), h("path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" }), h("path", { d: "m9 14 2 2 4-4" })),
            flame: h("g", null, h("path", { d: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-2.072-4.143-3-6 1.955 0 3.555 1.158 4.8 3.6 2.486-1.89 3.2-3.6 3.2-3.6 1.618 3.86 1.284 7 1 9-.5 4-4 6-8 4.5-.31-.118-.635-.306-.922-.538" }), h("path", { d: "M8.59 13.51l.06.06" })),
            coffee: h("g", null, h("path", { d: "M18 8h1a4 4 0 0 1 0 8h-1" }), h("path", { d: "M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" }), h("line", { x1: "6", y1: "1", x2: "6", y2: "4" }), h("line", { x1: "10", y1: "1", x2: "10", y2: "4" }), h("line", { x1: "14", y1: "1", x2: "14", y2: "4" })),
            shield: h("g", null, h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }), h("path", { d: "m9 12 2 2 4-4" })),
            lightning: h("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" }),
            swords: h("g", null, h("path", { d: "M14.5 17.5L3 6V3h3l11.5 11.5" }), h("path", { d: "M13 19l6-6" }), h("path", { d: "M16 16l4 4" }), h("path", { d: "M19 21l2-2" })),
            excel: h("g", null, h("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), h("polyline", { points: "14 2 14 8 20 8" }), h("line", { x1: "8", y1: "13", x2: "16", y2: "13" }), h("line", { x1: "8", y1: "17", x2: "16", y2: "17" }), h("line", { x1: "10", y1: "9", x2: "8", y2: "9" })),
            gift: h("g", null, h("polyline", { points: "20 12 20 22 4 22 4 12" }), h("rect", { width: "20", height: "5", x: "2", y: "7" }), h("line", { x1: "12", y1: "22", x2: "12", y2: "7" }), h("path", { d: "M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" }), h("path", { d: "M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" })),
            lock: h("g", null, h("rect", { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" }), h("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" })),
            cloud: h("g", null, h("path", { d: "M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" })),
            wifi: h("g", null, h("path", { d: "M5 12.55a11 11 0 0 1 14.08 0" }), h("path", { d: "M1.42 9a16 16 0 0 1 21.16 0" }), h("path", { d: "M8.53 16.11a6 6 0 0 1 6.95 0" }), h("line", { x1: "12", y1: "20", x2: "12.01", y2: "20" })),
            wifiOff: h("g", null, h("line", { x1: "1", y1: "1", x2: "23", y2: "23" }), h("path", { d: "M16.72 11.06A10.94 10.94 0 0 1 19 12.55" }), h("path", { d: "M5 12.55a10.94 10.94 0 0 1 5.17-2.39" }), h("path", { d: "M10.71 5.05A16 16 0 0 1 22.58 9" }), h("path", { d: "M1.42 9a15.91 15.91 0 0 1 4.7-2.88" }), h("path", { d: "M8.53 16.11a6 6 0 0 1 6.95 0" }), h("line", { x1: "12", y1: "20", x2: "12.01", y2: "20" })),
            refresh: h("g", null, h("polyline", { points: "23 4 23 10 17 10" }), h("polyline", { points: "1 20 1 14 7 14" }), h("path", { d: "M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" })),
            info: h("g", null, h("circle", { cx: "12", cy: "12", r: "10" }), h("line", { x1: "12", y1: "16", x2: "12", y2: "12" }), h("line", { x1: "12", y1: "8", x2: "12.01", y2: "8" })),
            list: h("g", null, h("line", { x1: "8", y1: "6", x2: "21", y2: "6" }), h("line", { x1: "8", y1: "12", x2: "21", y2: "12" }), h("line", { x1: "8", y1: "18", x2: "21", y2: "18" }), h("line", { x1: "3", y1: "6", x2: "3.01", y2: "6" }), h("line", { x1: "3", y1: "12", x2: "3.01", y2: "12" }), h("line", { x1: "3", y1: "18", x2: "3.01", y2: "18" })),
            fileText: h("g", null, h("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), h("polyline", { points: "14 2 14 8 20 8" }), h("line", { x1: "16", y1: "13", x2: "8", y2: "13" }), h("line", { x1: "16", y1: "17", x2: "8", y2: "17" }), h("line", { x1: "10", y1: "9", x2: "8", y2: "9" })),
            message: h("g", null, h("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" })),
            tasks: h("g", null, h("path", { d: "M8 2v4" }), h("path", { d: "M16 2v4" }), h("rect", { width: "18", height: "18", x: "3", y: "4", rx: "2" }), h("path", { d: "M3 10h18" }), h("path", { d: "M9 16l2 2 4-4" }))
        };
            
        if (name === 'plus') return h("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className }, h("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), h("line", { x1: "5", y1: "12", x2: "19", y2: "12" }));
        if (name === 'minus') return h("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className }, h("line", { x1: "5", y1: "12", x2: "19", y2: "12" }));

        return h("svg", {
            xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24",
            fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round",
            className: className
        }, paths[name] || null);
    };

    // --- Modal Component ---
    var Modal = ({ isOpen, title, children, onClose, onConfirm, confirmText = "确定", type = "info" }) => {
        if (!isOpen) return null;
        const colorClass = type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700';
        return h("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" },
            h("div", { className: "bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-bounce-in flex flex-col max-h-[90vh]" },
                h("div", { className: "p-4 border-b flex justify-between items-center flex-shrink-0" },
                    h("h3", { className: "font-bold text-lg" }, title),
                    h("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600" }, h(Icon, { name: "x" }))
                ),
                h("div", { className: "p-6 overflow-y-auto flex-1" }, children),
                h("div", { className: "p-4 bg-gray-50 flex justify-end gap-3 flex-shrink-0" },
                    h("button", { onClick: onClose, className: "px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg" }, "取消"),
                    onConfirm && h("button", { onClick: onConfirm, className: `px-4 py-2 text-white rounded-lg shadow-sm transition ${colorClass}` }, confirmText)
                )
            )
        );
    };

    // --- Gacha Crystal ---
    const GachaCrystal = ({ className = "" }) => h("svg", {
        viewBox: "0 0 100 100", className: `w-full h-full ${className}`, style: { filter: "drop-shadow(0 0 15px rgba(124, 58, 237, 0.8))" }
    },
        h("path", { d: "M50 5 L65 35 L95 50 L65 65 L50 95 L35 65 L5 50 L35 35 Z", fill: "url(#crystalGradient)", stroke: "#C4B5FD", strokeWidth: "2" }),
        h("defs", null,
            h("linearGradient", { id: "crystalGradient", x1: "0%", y1: "0%", x2: "100%", y2: "100%" },
                h("stop", { offset: "0%", stopColor: "#A78BFA" }),
                h("stop", { offset: "50%", stopColor: "#7C3AED" }),
                h("stop", { offset: "100%", stopColor: "#4C1D95" })
            )
        )
    );

    // --- Nav Component ---
    const Nav = ({ activeTab, setActiveTab, syncStatus, onRefresh, config }) => {
        const systemConfig = getSystemConfig(config);
        const battleEnabled = systemConfig.enabledFeatures?.battle ?? true;
        const getSyncIcon = () => {
            if (syncStatus === 'success' || syncStatus === 'saved') return h(Icon, { name: "cloud", className: "text-green-500", size: 16 });
            if (syncStatus === 'unsaved' || syncStatus === 'error') return h(Icon, { name: "wifiOff", className: "text-red-500", size: 16 });
            return h(Icon, { name: "wifi", className: "text-gray-400", size: 16 });
        };

        return h("nav", { className: "bg-white border-b sticky top-0 z-30 px-4" },
            h("div", { className: "max-w-6xl mx-auto flex justify-between items-center" },
                h("div", { className: "flex gap-6 overflow-x-auto scrollbar-hide flex-1" },
                    [
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
        }).map(item => 
                        h("button", { key: item.id, onClick: () => setActiveTab(item.id), className: `flex items-center gap-2 py-4 px-2 border-b-2 font-medium transition whitespace-nowrap ${activeTab === item.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}` }, h(Icon, { name: item.icon }), item.label)
                    )
                ),
                h("div", { className: "ml-4 flex items-center gap-3 text-xs" },
                    h("button", { 
                        onClick: onRefresh, 
                        className: "flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition",
                        title: "立即从服务器获取最新数据"
                    }, h(Icon, { name: "refresh", size: 14 }), "刷新"),
                    h("div", { className: `flex items-center gap-2`, title: "数据同步状态" },
                        getSyncIcon(),
                        h("span", { className: syncStatus === 'error' || syncStatus === 'unsaved' ? 'text-red-500' : 'text-gray-500' }, 
                            syncStatus === 'success' ? '已同步' : 
                            syncStatus === 'saved' ? '已保存' : 
                            syncStatus === 'unsaved' ? '未同步' : '离线'
                        )
                    ),
                    window.__getCurrentUser__() && h("div", { className: "flex items-center gap-2 border-l pl-3 ml-1" },
                        h("span", { className: "font-medium text-gray-700" }, 
                            window.__getCurrentUser__().username
                        ),
                        window.__getCurrentUser__().role === 'admin' && h("a", {
                            href: "/admin",
                            className: "px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-xs font-medium transition"
                        }, "管理后台"),
                        h("button", {
                            onClick: () => window.__logout__(),
                            className: "px-2 py-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                        }, "退出")
                    )
                )
            )
        );
    };

    const getTasksView = () => {
        if (window.__TasksViewComponent__) return window.__TasksViewComponent__;
        if (typeof window.createTasksView !== 'function') return null;
        window.__TasksViewComponent__ = window.createTasksView({
            h,
            useState,
            Modal,
            Icon,
            requireAdminAuth
        });
        return window.__TasksViewComponent__;
    };

    const getDashboardView = () => {
        if (window.__DashboardViewComponent__) return window.__DashboardViewComponent__;
        if (typeof window.createDashboardView !== 'function') return null;
        window.__DashboardViewComponent__ = window.createDashboardView({
            h,
            useState,
            useMemo,
            Icon,
            getNow,
            getDateString,
            getStartOfDay,
            diffDays,
            DAY_MS,
            getSystemConfig,
            getCustomRoles,
            getCommissionerRoles,
            getGroupsConfig,
            normalizePointScene,
            normalizePointCategory,
            getProfileAvatarUI
        });
        return window.__DashboardViewComponent__;
    };

    const getProfileView = () => {
        if (window.__ProfileViewComponent__) return window.__ProfileViewComponent__;
        if (typeof window.createProfileView !== 'function') return null;
        window.__ProfileViewComponent__ = window.createProfileView({
            h,
            useState,
            Modal,
            Icon,
            requireAdminAuth
        });
        return window.__ProfileViewComponent__;
    };

    const getProfileAvatarUI = () => {
        if (window.__ProfileAvatarUI__) return window.__ProfileAvatarUI__;
        if (typeof window.createProfileAvatarUI !== 'function') return null;
        window.__ProfileAvatarUI__ = window.createProfileAvatarUI({ h });
        return window.__ProfileAvatarUI__;
    };

    const getExamArchivesView = () => {
        if (window.__ExamArchivesViewComponent__) return window.__ExamArchivesViewComponent__;
        if (typeof window.createExamArchivesView !== 'function') return null;
        window.__ExamArchivesViewComponent__ = window.createExamArchivesView({
            h,
            useState,
            useEffect,
            Icon,
            requireAdminAuth,
            getTodayStr,
            getNow,
            battleParseRank,
            battleNormalize,
            normalizeExamArchives
        });
        return window.__ExamArchivesViewComponent__;
    };

    const getBattleView = () => {
        if (window.__BattleViewComponent__) return window.__BattleViewComponent__;
        if (typeof window.createBattleView !== 'function') return null;
        const stateFactory = typeof window.createBattleState === 'function'
            ? window.createBattleState({
                battleNormalize,
                battleInitTeams,
                battleInitSquads,
                BATTLE_INITIAL_POINTS
            })
            : null;
        const simulatorFactory = typeof window.createBattleSimulator === 'function'
            ? window.createBattleSimulator({
                getLatestExamArchiveRank,
                battleGetSafeThreshold,
                battleGetTier
            })
            : null;
        window.__BattleViewComponent__ = window.createBattleView({
            h,
            useState,
            useEffect,
            useMemo,
            Modal,
            Icon,
            requireAdminAuth,
            getTodayStr,
            getNow,
            battleState: stateFactory,
            battleSimulator: simulatorFactory,
            battleNormalize,
            normalizeExamArchives,
            normalizeBattleSnapshots,
            battleBuildSettlementPointUpdates,
            BATTLE_INITIAL_POINTS,
            BATTLE_MAX_STAKE
        });
        return window.__BattleViewComponent__;
    };

    // --- Attendance Module ---
    const AttendanceModule = ({ students, updatePoints, config, adminPassword, quotes, teacherMessages, setTeacherMessages, studentMessages, setStudentMessages, logs, attendanceRecords, handleUndoByReasons, onCheckInSuccess }) => {
        const isFrozen = !!(config && config.frozen);
        const getThisWeekRange = () => {
            const now = getNow();
            const currentDay = now.getDay(); 
            const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
            const monday = new Date(now);
            monday.setDate(now.getDate() - distanceToMonday);
            const friday = new Date(monday);
            friday.setDate(monday.getDate() + 4);
            return { start: getDateString(monday), end: getDateString(friday) };
        };

        const [records, setRecords] = useState({});
        const [currentTime, setCurrentTime] = useState(getNow());
        const [view, setView] = useState('checkin'); 
        const [checkInEffect, setCheckInEffect] = useState(null);
        const [startDate, setStartDate] = useState(() => getThisWeekRange().start);
        const [endDate, setEndDate] = useState(() => getThisWeekRange().end);
        const [selectedIssues, setSelectedIssues] = useState([]);
        const [filterSession, setFilterSession] = useState('all');
        const [filterDate, setFilterDate] = useState('');
        const [filterType, setFilterType] = useState('all');
        const [newTeacherMsg, setNewTeacherMsg] = useState("");
        const [newStudentMsg, setNewStudentMsg] = useState("");
        const [queryStudentName, setQueryStudentName] = useState("");

        useEffect(() => {
            const saved = getStorageItem('attendance_records');
            if (saved) setRecords(JSON.parse(saved));
        }, []);
        
        useEffect(() => {
            if (attendanceRecords && Object.keys(attendanceRecords).length > 0) {
                setRecords(attendanceRecords);
            }
        }, [attendanceRecords]);

        useEffect(() => {
            const timer = setInterval(() => {
                setCurrentTime(getNow());
            }, 1000);
            return () => clearInterval(timer);
        }, []);

        useEffect(() => {
            if (isFrozen || !students || students.length === 0) return;
            // 只在分钟变化时才检查缺勤，避免每秒都触发
            const now = getNow();
            
            // 使用函数式更新，确保使用最新的 records 值
            setRecords(currentRecords => {
                // 重要：从 localStorage 读取最新数据，确保不丢失刚打卡的记录
                let latestRecords = currentRecords;
                try {
                    const saved = getStorageItem('attendance_records');
                    if (saved) {
                        latestRecords = JSON.parse(saved);
                    }
                } catch (e) {
                    console.error('读取 localStorage 失败:', e);
                }
                
                const { newRecords, added } = settleAbsences(latestRecords, now);
                if (added) {
                    setStorageItem('attendance_records', JSON.stringify(newRecords));
                    return newRecords;
                }
                return latestRecords; // 返回最新读取的记录
            });
        }, [currentTime.getHours(), currentTime.getMinutes(), students, isFrozen]);

        const getRulesForDate = (dateObj) => {
            const scheduleConfig = getScheduleConfig(config);
            const weekendRules = getWeekendRules(config);
            const sundaySpecialLateTime = getSystemConfig(config).attendance.sundaySpecialLateTime || {};
            const day = dateObj.getDay();
            
            // 根据星期几获取对应的时段索引
            let periodIndices = [];
            if (day === 1) periodIndices = weekendRules.monday || [];
            else if (day === 2) periodIndices = weekendRules.tuesday || [];
            else if (day === 3) periodIndices = weekendRules.wednesday || [];
            else if (day === 4) periodIndices = weekendRules.thursday || [];
            else if (day === 5) periodIndices = weekendRules.friday || [];
            else if (day === 6) periodIndices = weekendRules.saturday || [];
            else if (day === 0) periodIndices = weekendRules.sunday || [];
            
            // 根据索引获取对应的时段配置
            const periods = periodIndices.map(idx => {
                if (idx >= 0 && idx < scheduleConfig.length) {
                    const period = { ...scheduleConfig[idx] };
                    // 如果是周日，检查是否有特殊迟到时间配置
                    if (day === 0 && sundaySpecialLateTime[period.id]) {
                        period.lateTime = sundaySpecialLateTime[period.id];
                    }
                    return period;
                }
                return null;
            }).filter(p => p !== null);
            
            return periods;
        };

        const isPeriodEnded = (dateObj, rule, now) => {
            const parts = rule.end.split(':');
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) || 0;
            const periodEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), h, m, 0, 0);
            // 缺勤检测推迟2分钟，给打卡数据留出上传到服务器并同步的窗口期
            const ABSENT_GRACE_MS = 2 * 60 * 1000;
            return now > new Date(periodEnd.getTime() + ABSENT_GRACE_MS);
        };

        const settleAbsences = (recs, now) => {
            const out = JSON.parse(JSON.stringify(recs));
            let added = false;
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            for (let i = 0; i < 60; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const dateStr = getDateString(d);
                const rules = getRulesForDate(d);
                for (const rule of rules) {
                    if (!isPeriodEnded(d, rule, now)) continue;
                    for (const s of students) {
                        // 检查是否已有记录（任何状态：ok, late, absent）
                        const existingRecord = out[dateStr]?.[s.name]?.[rule.id];
                        if (existingRecord) {
                            // 如果已有记录，不要覆盖！无论是什么状态
                            continue;
                        }
                        // 只有完全没有记录时才标记为缺勤
                        if (!out[dateStr]) out[dateStr] = {};
                        if (!out[dateStr][s.name]) out[dateStr][s.name] = {};
                        out[dateStr][s.name][rule.id] = { status: 'absent', checkTime: '缺勤', timestamp: getNow().getTime() };
                        added = true;
                    }
                }
            }
            return { newRecords: out, added };
        };

        const todayRules = useMemo(() => getRulesForDate(currentTime), [currentTime.getDate()]);
            
        const todayQuote = useMemo(() => {
           const start = new Date(currentTime.getFullYear(), 0, 0);
           const diff = currentTime - start;
           const oneDay = 1000 * 60 * 60 * 24;
           const dayOfYear = Math.floor(diff / oneDay);
           return quotes[dayOfYear % quotes.length];
        }, [currentTime, quotes]);

        const currentSession = useMemo(() => {
            const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
            for (let session of todayRules) {
                const start = timeToMinutes(session.start);
                const end = timeToMinutes(session.end);
                if (nowMinutes >= start && nowMinutes <= end) {
                    return { ...session, isLateNow: nowMinutes > timeToMinutes(session.lateTime) };
                }
            }
            return null;
        }, [currentTime, todayRules]);

        const usedMorningLateCardYesterday = (name) => {
            const logList = logs || [];
            const yesterday = new Date(currentTime);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getDateString(yesterday);
            return logList.some(l => {
                if (l.action !== '使用' || !l.itemName || l.studentName !== name) return false;
                if (String(l.itemName).trim() !== '早读迟到卡') return false;
                return getDateString(new Date(l.ts)) === yesterdayStr;
            });
        };

        const handleCheckIn = (studentName) => {
            if (!currentSession) return alert("当前不在打卡时段！");
            const dateKey = getDateString(currentTime);
            let result = null;
            
            setRecords(currentRecords => {
                let latestRecords = currentRecords;
                try {
                    const saved = getStorageItem('attendance_records');
                    if (saved) {
                        latestRecords = JSON.parse(saved);
                    }
                } catch (e) {
                    console.error('读取 localStorage 失败:', e);
                }
                
                if (latestRecords[dateKey]?.[studentName]?.[currentSession.id]) {
                    result = { status: 'exists' };
                    return latestRecords;
                }

                const isLate = currentSession.isLateNow;
                const usedLateCardYesterday = currentSession.id === 'morning' && usedMorningLateCardYesterday(studentName);
                
                const newRecord = {
                    status: isLate ? 'late' : 'ok',
                    checkTime: currentTime.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                    timestamp: getNow().getTime()
                };

                const newRecords = {
                    ...latestRecords,
                    [dateKey]: {
                        ...(latestRecords[dateKey] || {}),
                        [studentName]: {
                            ...(latestRecords[dateKey]?.[studentName] || {}),
                            [currentSession.id]: newRecord
                        }
                    }
                };

                setStorageItem('attendance_records', JSON.stringify(newRecords));
                result = { status: isLate ? 'late' : 'ok', newRecord, newRecords, usedLateCardYesterday };
                return newRecords;
            });

            if (!result) return;
            if (result.status === 'exists') return alert("已打卡！");

            const s = students.find(stu => stu.name === studentName);
            if (result.status === 'late' && s && !result.usedLateCardYesterday && !isFrozen) {
                const penaltyRules = getPenaltyRules(config);
                const latePenalty = penaltyRules.late || -1;
                updatePoints(new Set([s.id]), latePenalty, `考勤迟到: ${currentSession.name}`, "penalty", "班级", "出勤");
            }

            const streak = calculateStreak(studentName, result.newRecords, currentTime);
            setCheckInEffect({ show: true, student: studentName, streak, usedMorningLateCard: result.status === 'late' && result.usedLateCardYesterday });
            setTimeout(() => setCheckInEffect(null), 3000);
            // 打卡成功后立即通知根层上传，防止缺勤检测在数据同步前触发
            if (onCheckInSuccess) onCheckInSuccess(result.newRecords);
        };

        const handlePostTeacherMsg = () => {
            if(!newTeacherMsg.trim()) return;
                
            const msg = {
                id: getNow().getTime(),
                content: newTeacherMsg,
                time: getNow().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'}),
                date: getTodayStr()
            };
            const updatedMessages = [msg, ...(teacherMessages || [])].slice(0, 5); // Keep last 5
            setTeacherMessages(updatedMessages);
            setNewTeacherMsg("");
        };
            
        const handleDeleteTeacherMsg = (id) => {
            const updated = teacherMessages.filter(m => m.id !== id);
            setTeacherMessages(updated);
        };

        const handlePostStudentMsg = () => {
            if(!newStudentMsg.trim()) return;
            const msg = {
                id: Date.now(),
                content: newStudentMsg,
                time: new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'}),
                date: getTodayStr()
            };
            const updatedMessages = [msg, ...(studentMessages || [])].slice(0, 20); // Keep last 20
            setStudentMessages(updatedMessages);
            setNewStudentMsg("");
        };
            
        const handleDeleteStudentMsg = (id) => {
            const updated = studentMessages.filter(m => m.id !== id);
            setStudentMessages(updated);
        };

        const calculateStreak = (name, data, endDate) => {
            let streak = 0;
            let d = new Date(endDate);
            d.setDate(d.getDate() - 1); 
            for (let i = 0; i < 365; i++) {
                const dateStr = getDateString(d);
                const rules = getRulesForDate(d);
                if (rules.length === 0) { d.setDate(d.getDate() - 1); continue; }
                let perfect = true;
                const dayRec = data[dateStr]?.[name];
                if (!dayRec) { perfect = false; }
                else {
                    for (let r of rules) {
                        if (!dayRec[r.id] || dayRec[r.id].status !== 'ok') { perfect = false; break; }
                    }
                }
                if (perfect) streak++; else break;
                d.setDate(d.getDate() - 1);
            }
            return streak;
        };

        const statsData = useMemo(() => {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const list = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) list.push(new Date(d));
            const stats = {};
            students.forEach(s => stats[s.name] = { late: 0, absent: 0, perfect: true, streak: calculateStreak(s.name, records, getNow()) });
            const now = getNow();
            list.forEach(dateObj => {
                const dateStr = getDateString(dateObj);
                const rules = getRulesForDate(dateObj);
                rules.forEach(rule => {
                    if (!isPeriodEnded(dateObj, rule, now)) return;
                    students.forEach(s => {
                        const rec = records[dateStr]?.[s.name]?.[rule.id];
                        if (rec) {
                            if (rec.status === 'late') { stats[s.name].late++; stats[s.name].perfect = false; }
                            else if (rec.status === 'absent') { stats[s.name].absent++; stats[s.name].perfect = false; }
                            else if (rec.status === 'ok') { }
                            else { stats[s.name].perfect = false; }
                        } else {
                            stats[s.name].perfect = false;
                        }
                    });
                });
            });
            const bestStreaks = students.map(s => ({ name: s.name, val: stats[s.name].streak })).filter(i => i.val > 0).sort((a,b) => b.val - a.val);
            const mostLates = students.map(s => ({ name: s.name, val: stats[s.name].late })).filter(i => i.val > 0).sort((a,b) => b.val - a.val);
            const mostAbsents = students.map(s => ({ name: s.name, val: stats[s.name].absent })).filter(i => i.val > 0).sort((a,b) => b.val - a.val);
            const perfects = students.filter(s => stats[s.name].perfect).map(s => s.name);
            return { stats, bestStreaks, mostLates, mostAbsents, perfects, dates: list };
        }, [records, students, startDate, endDate, currentTime]);

        const handleRevokeAuth = () => {
            const systemConfig = getSystemConfig(config);
            if (requireAdminAuth("请输入管理员密码：", systemConfig.adminPassword)) setView('revoke');
        };

        const abnormalRecords = useMemo(() => {
            if (view !== 'revoke') return [];
            const list = [];
            const now = getNow();
            statsData.dates.forEach(dateObj => {
                const dateStr = getDateString(dateObj);
                if (filterDate && dateStr !== filterDate) return;
                const rules = getRulesForDate(dateObj);
                rules.forEach(rule => {
                    if (!isPeriodEnded(dateObj, rule, now)) return;
                    if (filterSession !== 'all' && rule.id !== filterSession) return;
                    students.forEach(s => {
                        const rec = records[dateStr]?.[s.name]?.[rule.id];
                        if (rec && rec.status === 'late') {
                            if (filterType !== 'all' && filterType !== 'late') return;
                            list.push({ id: `${dateStr}-${s.name}-${rule.id}`, date: dateStr, name: s.name, session: rule.name, type: 'late', desc: `迟到 ${rec.checkTime}` });
                        } else if (rec && rec.status === 'absent') {
                            if (filterType !== 'all' && filterType !== 'absent') return;
                            list.push({ id: `${dateStr}-${s.name}-${rule.id}`, date: dateStr, name: s.name, session: rule.name, type: 'absent', desc: '缺勤' });
                        }
                    });
                });
            });
            return list;
        }, [view, statsData, filterSession, filterDate, filterType, records, students]);

        const toggleSelectAll = () => {
            if (selectedIssues.length === abnormalRecords.length && abnormalRecords.length > 0) {
                setSelectedIssues([]);
            } else {
                setSelectedIssues(abnormalRecords.map(r => r.id));
            }
        };

        const isAllSelected = abnormalRecords.length > 0 && selectedIssues.length === abnormalRecords.length;

        const handleBatchCorrect = () => {
            if (selectedIssues.length === 0) return;
            if (!confirm(`确定将选中的 ${selectedIssues.length} 条记录修正为“正常”吗？\n迟到：返还扣分\n缺勤：补录为正常`)) return;
            const newRec = { ...records };
            selectedIssues.forEach(id => {
                const item = abnormalRecords.find(i => i.id === id);
                if (!item) return;
                const s = students.find(stu => stu.name === item.name);
                if (!s) return;
                if (!newRec[item.date]) newRec[item.date] = {};
                if (!newRec[item.date][item.name]) newRec[item.date][item.name] = {};
                const ruleId = item.id.split('-').pop(); 
                if (item.type === 'late') {
                    newRec[item.date][item.name][ruleId] = { status: 'ok', checkTime: item.desc.replace('迟到 ', '') + ' (已撤销)', timestamp: getNow().getTime() };
                    handleUndoByReasons(s.id, [`考勤迟到: ${item.date} ${item.session}`, `考勤迟到: ${item.session}`]);
                } else if (item.type === 'absent') {
                    newRec[item.date][item.name][ruleId] = { status: 'ok', checkTime: '管理员补卡', timestamp: getNow().getTime() };
                }
            });
            setRecords(newRec);
            setStorageItem('attendance_records', JSON.stringify(newRec));
            setSelectedIssues([]);
            alert("修正成功");
        };

        const handleBatchAbsent = () => {
            const absentItems = selectedIssues.map(id => abnormalRecords.find(i => i.id === id)).filter(i => i && i.type === 'absent');
            if (isFrozen) return alert("假期封存中，无法结算缺勤。请先在维护页面解除封存。");
            if (absentItems.length === 0) return alert("请至少选择一条缺勤记录");
            const penaltyRules = getPenaltyRules(config);
            const absentPenalty = penaltyRules.absent || -5;
            if (!confirm(`确定将选中的 ${absentItems.length} 条缺勤记录进行结算扣分吗？\n每条扣除 ${Math.abs(absentPenalty)} 分。`)) return;
            const newRec = { ...records };
            absentItems.forEach(item => {
                const s = students.find(stu => stu.name === item.name);
                if (!s) return;
                if (!newRec[item.date]) newRec[item.date] = {};
                if (!newRec[item.date][item.name]) newRec[item.date][item.name] = {};
                const ruleId = item.id.split('-').pop(); 
                newRec[item.date][item.name][ruleId] = { status: 'absent', checkTime: '已扣分', timestamp: getNow().getTime() };
                updatePoints(new Set([s.id]), absentPenalty, `缺勤扣分: ${item.date} ${item.session}`, "penalty", "班级", "出勤");
            });
            setRecords(newRec);
            setStorageItem('attendance_records', JSON.stringify(newRec));
            setSelectedIssues([]);
            alert("结算成功");
        };

        const handleSettleAllAbsent = () => {
            if (isFrozen) return alert("假期封存中，无法结算缺勤。请先在维护页面解除封存。");
            const allAbsentItems = abnormalRecords.filter(i => i.type === 'absent');
            if (allAbsentItems.length === 0) return alert("当前没有待结算的缺勤记录");
            const penaltyRules = getPenaltyRules(config);
            const absentPenalty = penaltyRules.absent || -5;
            if (!confirm(`确定要一键结算当前列表中的 ${allAbsentItems.length} 条缺勤记录吗？\n每条扣除 ${Math.abs(absentPenalty)} 分。`)) return;
            const newRec = { ...records };
            allAbsentItems.forEach(item => {
                const s = students.find(stu => stu.name === item.name);
                if (!s) return;
                if (!newRec[item.date]) newRec[item.date] = {};
                if (!newRec[item.date][item.name]) newRec[item.date][item.name] = {};
                const ruleId = item.id.split('-').pop(); 
                newRec[item.date][item.name][ruleId] = { status: 'absent', checkTime: '已扣分', timestamp: getNow().getTime() };
                updatePoints(new Set([s.id]), absentPenalty, `缺勤扣分: ${item.date} ${item.session}`, "penalty", "班级", "出勤");
            });
            setRecords(newRec);
            setStorageItem('attendance_records', JSON.stringify(newRec));
            const settledIds = new Set(allAbsentItems.map(i => i.id));
            setSelectedIssues(selectedIssues.filter(id => !settledIds.has(id)));
            alert("批量结算成功");
        };

        const handlePerfectBonus = () => {
            if (isFrozen) return alert("假期封存中，无法发放全勤奖。请先在维护页面解除封存。");
            if (statsData.perfects.length === 0) return alert("当前名单无全勤学生");
            const penaltyRules = getPenaltyRules(config);
            const perfectAttendanceBonus = penaltyRules.perfectAttendance || 10;
            if (!confirm(`确定为当前全勤名单中的 ${statsData.perfects.length} 人发放 +${perfectAttendanceBonus} 分"周全勤奖"吗？`)) return;

            const targetIds = new Set();
            statsData.perfects.forEach(name => {
                const s = students.find(stu => stu.name === name);
                if (s) targetIds.add(s.id);
            });
                
            updatePoints(targetIds, perfectAttendanceBonus, "周全勤奖", "bonus", "班级", "出勤");
            alert("发放成功！");
        };

        return h("div", { className: "bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden relative" },
            checkInEffect && h("div", { className: "fixed inset-0 z-50 flex items-center justify-center pointer-events-none" },
                h("div", { className: "absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in" }),
                h("div", { className: "bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-pop relative z-10 border-4 border-orange-200" },
                    h("div", { className: "text-orange-500 animate-firework rounded-full mb-4" }, h(Icon, { name: "flame", size: 64 })),
                    h("h2", { className: "text-2xl font-bold text-gray-800 mb-2" }, "🎉 打卡成功！"),
                    h("div", { className: "text-lg text-gray-600 mb-4" }, checkInEffect.student),
                    checkInEffect.usedMorningLateCard ? h("div", { className: "bg-amber-100 text-amber-800 px-4 py-2 rounded-full font-bold" }, "早读迟到卡已抵扣，记录迟到但不扣分") : checkInEffect.streak > 0 ? h("div", { className: "bg-orange-100 text-orange-700 px-4 py-2 rounded-full font-bold animate-pulse" }, `🔥 已连续全勤 ${checkInEffect.streak} 天！`) : h("div", { className: "text-blue-600 font-medium" }, "好的开始，继续保持！")
                )
            ),
            h("div", { className: "bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center" },
                h("div", { className: "flex items-center gap-3" }, h(Icon, { name: "clock", size: 24 }), 
                    h("div", null, 
                        h("div", { className: "text-xl font-bold" }, currentTime.toLocaleTimeString('zh-CN', { hour12: false })),
                        h("div", { className: "text-xs opacity-80" }, getDateString(currentTime))
                    )
                ),
                // Quotes Section
                h("div", { className: "hidden md:flex flex-1 justify-center px-4 attendance-quote-shell" },
                    h("div", { className: "attendance-quote-banner" },
                        h("div", { className: "attendance-quote-text" }, `“${todayQuote}”`)
                    )
                ),
                h("div", { className: "flex items-center gap-2" }, h("div", { className: `px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${currentSession ? (currentSession.isLateNow ? 'bg-red-500' : 'bg-green-500') : 'bg-gray-500'}` }, h("span", { className: "w-2 h-2 rounded-full bg-white animate-pulse" }), currentSession ? `${currentSession.name} ${currentSession.isLateNow ? '迟到' : '进行中'}` : '非时段'))
            ),
            h("div", { className: "md:hidden attendance-quote-mobile" },
                h("div", { className: "attendance-quote-text" }, `“${todayQuote}”`)
            ),
            isFrozen && h("div", { className: "bg-amber-100 border-b border-amber-200 text-amber-800 text-sm py-2 px-4 text-center font-medium" }, "❄️ 假期封存中：缺勤不记录、迟到不扣分、结算与全勤奖已暂停"),
            h("div", { className: "flex border-b bg-gray-50" }, [{ id: 'checkin', label: '打卡', icon: 'check' }, { id: 'stats', label: '统计', icon: 'chart' }, { id: 'revoke', label: '修正', icon: 'clipboard' }].map(item => h("button", { key: item.id, onClick: () => item.id === 'revoke' ? handleRevokeAuth() : setView(item.id), className: `flex-1 py-3 flex justify-center items-center gap-2 text-sm font-medium transition ${view === item.id ? 'bg-white text-blue-600 border-t-2 border-blue-500' : 'text-gray-500 hover:bg-gray-100'}` }, h(Icon, { name: item.icon, size: 16 }), item.label))),
            h("div", { className: "p-4 min-h-[400px]" },
                view === 'checkin' && h("div", { className: "animate-fade-in space-y-4" },
                        
                    // 1. Teacher Message Board (Top)
                    h("div", { className: "bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-2" },
                        h("div", { className: "flex items-center gap-2 mb-2 border-b border-yellow-100 pb-1" },
                            h(Icon, { name: "message", className: "text-yellow-600", size: 16 }),
                            h("h3", { className: "font-bold text-yellow-800 text-sm" }, "📢 班主任通知")
                        ),
                        h("div", { className: "space-y-2 mb-2" },
                            (!teacherMessages || teacherMessages.length === 0) 
                                ? h("div", { className: "text-gray-400 text-xs italic" }, "暂无通知") 
                                : teacherMessages.map(msg => 
                                    h("div", { key: msg.id, className: "bg-white p-2 rounded border border-yellow-100 text-sm shadow-sm relative group" },
                                        h("div", { className: "text-gray-800 font-medium pr-6" }, msg.content),
                                        h("div", { className: "text-gray-400 text-xs text-right mt-1" }, `${msg.date} ${msg.time}`),
                                        h("button", {
                                            onClick: () => handleDeleteTeacherMsg(msg.id),
                                            className: "absolute top-1 right-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                                        }, h(Icon, { name: "trash", size: 14 }))
                                    )
                                )
                        ),
                        h("div", { className: "flex gap-2" },
                            h("input", { 
                                type: "text", 
                                className: "flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-500",
                                placeholder: "发布新通知...",
                                value: newTeacherMsg,
                                onChange: (e) => setNewTeacherMsg(e.target.value),
                                onKeyPress: (e) => e.key === 'Enter' && handlePostTeacherMsg()
                            }),
                            h("button", { 
                                onClick: handlePostTeacherMsg,
                                className: "bg-yellow-500 text-white px-3 py-1 rounded text-xs hover:bg-yellow-600 transition"
                            }, "发布")
                        )
                    ),

                    h("div", { className: "mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-between" }, h("div", { className: "font-bold text-blue-800 flex items-center gap-2" }, h(Icon, { name: "coffee" }), "今日规则"), todayRules.length === 0 ? h("span", { className: "text-xs text-gray-500" }, "休息日") : h("div", { className: "flex gap-2" }, todayRules.map(r => h("span", { key: r.id, className: "text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-600" }, `${r.start}-${r.end} (${r.lateTime}后迟到)`)))),
                    h("div", { className: "grid grid-cols-4 sm:grid-cols-5 gap-2" }, students.map(s => {
                        const todayKey = getDateString(currentTime);
                        const isDone = currentSession && records[todayKey]?.[s.name]?.[currentSession.id];
                        const status = isDone?.status;
                        return h("button", { key: s.id, disabled: !currentSession || !!isDone, onClick: () => handleCheckIn(s.name), className: `p-2 rounded border text-sm font-medium transition relative overflow-hidden h-14 flex flex-col items-center justify-center ${isDone ? (status === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700') : (currentSession ? 'bg-white border-gray-200 hover:border-blue-400 hover:shadow' : 'bg-gray-50 border-transparent text-gray-300')}` }, h("span", { className: "z-10" }, s.name), isDone && h("span", { className: "text-[10px] opacity-80 mt-1" }, `${status === 'ok' ? '已到' : '迟到'} ${isDone.checkTime}`))
                    })),
                        
                    // 2. Student Message Board (Bottom)
                    h("div", { className: "mt-6 pt-4 border-t border-gray-200" },
                        h("div", { className: "flex items-center gap-2 mb-3" },
                            h(Icon, { name: "message", className: "text-blue-500" }),
                            h("h3", { className: "font-bold text-gray-700" }, "💬 同学留言板")
                        ),
                        h("div", { className: "flex gap-2 mb-4" },
                            h("input", { 
                                type: "text", 
                                className: "flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                                placeholder: "说点什么...",
                                value: newStudentMsg,
                                onChange: (e) => setNewStudentMsg(e.target.value),
                                onKeyPress: (e) => e.key === 'Enter' && handlePostStudentMsg()
                            }),
                            h("button", { 
                                onClick: handlePostStudentMsg,
                                className: "bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition"
                            }, "发送")
                        ),
                        h("div", { className: "space-y-2 max-h-40 overflow-y-auto" },
                            (!studentMessages || studentMessages.length === 0) 
                                ? h("div", { className: "text-gray-400 text-sm text-center py-2" }, "暂无留言") 
                                : studentMessages.map(msg => 
                                    h("div", { key: msg.id, className: "bg-gray-50 p-2 rounded text-sm flex justify-between items-start border border-gray-100 relative group" },
                                        h("div", { className: "flex-1 pr-6" },
                                            h("span", { className: "text-gray-800 break-all" }, msg.content)
                                        ),
                                        h("div", { className: "flex flex-col items-end gap-1" },
                                            h("span", { className: "text-gray-400 text-xs whitespace-nowrap" }, `${msg.date} ${msg.time}`),
                                            h("button", {
                                                onClick: () => handleDeleteStudentMsg(msg.id),
                                                className: "text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            }, h(Icon, { name: "trash", size: 12 }))
                                        )
                                    )
                                )
                        )
                    )
                ),
                view === 'stats' && h("div", { className: "animate-fade-in space-y-6" },
                    h("div", { className: "flex items-center gap-2 text-sm bg-gray-50 p-2 rounded flex-wrap" },
                        h("span", { className: "text-gray-500" }, "范围:"),
                        h("input", { type: "date", value: startDate, onChange: e => setStartDate(e.target.value), className: "border rounded px-1" }),
                        h("span", null, "-"),
                        h("input", { type: "date", value: endDate, onChange: e => setEndDate(e.target.value), className: "border rounded px-1" }),
                        h("span", { className: "text-gray-500 ml-2" }, "查询学生:"),
                        h("input", {
                            type: "text",
                            value: queryStudentName,
                            onChange: e => setQueryStudentName(e.target.value),
                            placeholder: "输入学生姓名",
                            className: "border rounded px-2 py-1 flex-1 min-w-[120px]"
                        })
                    ),
                    queryStudentName ? (() => {
                        const student = students.find(s => s.name.trim() === queryStudentName.trim());
                        if (!student) {
                            return h("div", { className: "bg-yellow-50 border border-yellow-200 p-4 rounded text-center text-yellow-700" }, "未找到该学生");
                        }
                        const studentRecords = [];
                        const now = getNow();
                        statsData.dates.forEach(dateObj => {
                            const dateStr = getDateString(dateObj);
                            const rules = getRulesForDate(dateObj);
                            rules.forEach(rule => {
                                if (!isPeriodEnded(dateObj, rule, now)) return;
                                const rec = records[dateStr]?.[student.name]?.[rule.id];
                                studentRecords.push({
                                    date: dateStr,
                                    session: rule.name,
                                    status: rec ? rec.status : null,
                                    checkTime: rec ? rec.checkTime : '—'
                                });
                            });
                        });
                        return h("div", { className: "bg-white border rounded-lg p-4" },
                            h("h4", { className: "font-bold mb-3 text-lg" }, `${student.name} 的详细出勤情况`),
                            h("div", { className: "max-h-96 overflow-y-auto border rounded" },
                                h("table", { className: "w-full text-sm text-left" },
                                    h("thead", { className: "bg-gray-50 sticky top-0" },
                                        h("tr", null,
                                            h("th", { className: "p-2 border-b" }, "日期"),
                                            h("th", { className: "p-2 border-b" }, "时段"),
                                            h("th", { className: "p-2 border-b" }, "状态"),
                                            h("th", { className: "p-2 border-b" }, "打卡时间")
                                        )
                                    ),
                                    h("tbody", null,
                                        studentRecords.length === 0
                                            ? h("tr", null, h("td", { colSpan: 4, className: "p-4 text-center text-gray-400" }, "暂无记录"))
                                            : studentRecords.map((rec, idx) => {
                                                const statusText = rec.status === 'ok' ? '正常' : rec.status === 'late' ? '迟到' : rec.status === 'absent' ? '缺勤' : '无记录';
                                                const statusClass = rec.status === 'ok' ? 'text-green-600' : rec.status === 'late' ? 'text-red-600' : rec.status === 'absent' ? 'text-gray-600' : 'text-gray-400';
                                                return h("tr", { key: idx, className: "border-b hover:bg-gray-50" },
                                                    h("td", { className: "p-2" }, rec.date),
                                                    h("td", { className: "p-2" }, rec.session),
                                                    h("td", { className: `p-2 font-bold ${statusClass}` }, statusText),
                                                    h("td", { className: "p-2 text-gray-500" }, rec.checkTime)
                                                );
                                            })
                                    )
                                )
                            )
                        );
                    })() : null,
                    h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
                        h("div", { className: "bg-white border rounded-lg p-3 relative" }, 
                            h("div", { className: "flex justify-between items-center mb-2" },
                                h("h4", { className: "font-bold text-green-600 flex items-center gap-2 text-sm" }, h(Icon, { name: "shield" }), "区间全勤"),
                                (() => {
                                    const penaltyRules = getPenaltyRules(config);
                                    const perfectAttendanceBonus = penaltyRules.perfectAttendance || 10;
                                    return h("button", { onClick: handlePerfectBonus, className: "text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 shadow-sm" }, `🏆 全勤奖 +${perfectAttendanceBonus}`);
                                })()
                            ),
                            h("div", { className: "flex flex-wrap gap-1" }, statsData.perfects.length > 0 ? statsData.perfects.map(n => h("span", { key: n, className: "text-xs bg-green-50 text-green-700 px-2 py-1 rounded" }, n)) : h("span", { className: "text-xs text-gray-400" }, "无"))
                        ),
                        h("div", { className: "bg-white border rounded-lg p-3" }, h("h4", { className: "font-bold text-orange-500 flex items-center gap-2 text-sm mb-2" }, h(Icon, { name: "flame" }), "连胜榜"), h("div", { className: "space-y-1 max-h-32 overflow-y-auto" }, statsData.bestStreaks.map((i, idx) => h("div", { key: i.name, className: "flex justify-between text-xs" }, h("span", null, `${idx+1}. ${i.name}`), h("span", { className: "font-bold text-orange-600" }, `${i.val} 天`))))),
                        h("div", { className: "bg-white border rounded-lg p-3" }, h("h4", { className: "font-bold text-red-500 flex items-center gap-2 text-sm mb-2" }, h(Icon, { name: "alert" }), "迟到预警"), h("div", { className: "space-y-1 max-h-32 overflow-y-auto" }, statsData.mostLates.map((i, idx) => h("div", { key: i.name, className: "flex justify-between text-xs" }, h("span", null, i.name), h("span", { className: "font-bold text-red-600" }, `${i.val} 次`))))),
                        h("div", { className: "bg-white border rounded-lg p-3" }, h("h4", { className: "font-bold text-gray-600 flex items-center gap-2 text-sm mb-2" }, h(Icon, { name: "users" }), "缺勤统计"), h("div", { className: "space-y-1 max-h-32 overflow-y-auto" }, statsData.mostAbsents.map((i, idx) => h("div", { key: i.name, className: "flex justify-between text-xs" }, h("span", null, i.name), h("span", { className: "font-bold text-gray-700" }, `${i.val} 次`)))))
                    )
                ),
                view === 'revoke' && h("div", { className: "animate-fade-in" },
                    h("div", { className: "bg-orange-50 border border-orange-200 text-orange-800 p-3 rounded mb-4 text-xs" }, "管理员模式：勾选异常记录进行修正。"),
                    h("div", { className: "flex flex-wrap gap-2 justify-between mb-2 items-center" }, 
                        h("div", { className: "flex flex-wrap gap-3 items-center" },
                            h("span", { className: "text-sm font-bold" }, `发现 ${abnormalRecords.length} 条异常`),
                            h("label", { className: "flex items-center text-xs font-bold text-blue-600 cursor-pointer" },
                                h("input", { type: "checkbox", checked: isAllSelected, onChange: toggleSelectAll, className: "mr-1" }),
                                "全选当前"
                            ),
                            h("div", { className: "flex items-center gap-1" },
                                h("span", { className: "text-xs text-gray-500" }, "日期:"),
                                h("input", { type: "date", value: filterDate, onChange: e => setFilterDate(e.target.value), className: "border rounded text-xs p-1" })
                            ),
                            h("select", { value: filterSession, onChange: e => setFilterSession(e.target.value), className: "border rounded text-xs p-1" },
                                h("option", { value: "all" }, "全部时段"),
                                getScheduleConfig(config).map(s => h("option", { key: s.id, value: s.id }, s.name))
                            ),
                            h("select", { value: filterType, onChange: e => setFilterType(e.target.value), className: "border rounded text-xs p-1" },
                                h("option", { value: "all" }, "全部类型"),
                                h("option", { value: "late" }, "迟到"),
                                h("option", { value: "absent" }, "缺勤")
                            )
                        ),
                        h("div", { className: "flex gap-2" }, 
                            h("button", { onClick: handleBatchCorrect, disabled: selectedIssues.length === 0, className: "bg-green-600 text-white text-xs px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50" }, `修正/补卡`), 
                            (() => {
                                const penaltyRules = getPenaltyRules(config);
                                const absentPenalty = penaltyRules.absent || -5;
                                return h("button", { onClick: handleBatchAbsent, disabled: selectedIssues.length === 0, className: "bg-red-500 text-white text-xs px-3 py-1 rounded hover:bg-red-600 disabled:opacity-50" }, `结算缺勤 (${absentPenalty})`);
                            })(), 
                            h("button", { onClick: handleSettleAllAbsent, className: "bg-gray-800 text-white text-xs px-3 py-1 rounded hover:bg-gray-700 flex items-center gap-1" }, h(Icon, { name: "lightning", size: 12 }), `一键结算所有`)
                        )
                    ),
                    h("div", { className: "border rounded bg-white max-h-80 overflow-y-auto" }, abnormalRecords.map(item => h("div", { key: item.id, className: "flex items-center p-2 border-b last:border-0 hover:bg-gray-50 text-xs cursor-pointer", onClick: () => { const set = new Set(selectedIssues); if (set.has(item.id)) set.delete(item.id); else set.add(item.id); setSelectedIssues(Array.from(set)); } }, h("input", { type: "checkbox", checked: selectedIssues.includes(item.id), readOnly: true, className: "mr-2" }), h("div", { className: "flex-1 grid grid-cols-4 gap-1" }, h("span", null, item.date), h("span", { className: "font-bold" }, item.name), h("span", { className: "text-gray-500" }, item.session), h("span", { className: item.type === 'late' ? 'text-red-500' : 'text-gray-500' }, item.desc)))))
                )
            )
        );
    };

    // --- Operation View ---
    const OperationView = ({ students, selectedIds, setSelectedIds, filterGroup, setFilterGroup, filterDorm, setFilterDorm, opTab, setOpTab, updatePoints, handleWage, adjustModal, setAdjustModal, history, handleUndo, batchUpdatePoints, config }) => {
        const filteredStudents = students.filter(s => {
            if (filterGroup !== 'all' && s.group !== filterGroup) return false;
            if (filterDorm !== 'all' && s.dorm !== filterDorm) return false;
            return true;
        });
        const toggleSelection = (id) => {
            const newSet = new Set(selectedIds);
            if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
            setSelectedIds(newSet);
        };
        const selectAll = () => {
            if (selectedIds.size === filteredStudents.length) setSelectedIds(new Set());
            else setSelectedIds(new Set(filteredStudents.map(s => s.id)));
        };
        const handleReasonClick = (reason) => {
            if (selectedIds.size === 0) return alert("请先选择学生");
            setBatchAdjustModal({
                open: true,
                reason: reason,
                students: Array.from(selectedIds).map(id => {
                    const s = students.find(stu => stu.id === id);
                    let initVal = Math.abs(reason.val);
                    return { id: s.id, name: s.name, val: reason.isMulti ? 1 : initVal };
                }),
                type: opTab,
                isMulti: reason.isMulti || false,
                factor: reason.factor || 1,
                isCustom: false,
                customReasonName: "",
                scene: normalizePointScene(reason.scene),
                category: normalizePointCategory(reason.category)
            });
        };

        const handleCustomReason = () => {
            if (selectedIds.size === 0) return alert("请先选择学生");
            setBatchAdjustModal({
                open: true,
                reason: { name: "", custom: true },
                students: Array.from(selectedIds).map(id => {
                    const s = students.find(stu => stu.id === id);
                    return { id: s.id, name: s.name, val: 0 };
                }),
                type: opTab,
                isMulti: false,
                factor: 1,
                isCustom: true,
                customReasonName: "",
                scene: "班级",
                category: "兑奖"
            });
        };
            
        const [batchAdjustModal, setBatchAdjustModal] = useState({ open: false, reason: null, students: [], type: 'bonus', isMulti: false, factor: 1, isCustom: false, customReasonName: "", scene: DEFAULT_POINT_SCENE, category: DEFAULT_POINT_CATEGORY });
        const [hwSubject, setHwSubject] = useState("");
        const [hwDate, setHwDate] = useState("");
        const [hwSelectedIds, setHwSelectedIds] = useState(new Set());
        const subjectsConfig = getSubjectsConfig(config);
        const homeworkSubjects = subjectsConfig.map(s => s.name);
        const homeworkDates = (() => {
            const now = getNow();
            const day = now.getDay();
            const daysToFriday = (5 - day + 7) % 7;
            const friday = new Date(now);
            friday.setDate(now.getDate() + daysToFriday);
            const sunday = new Date(friday);
            sunday.setDate(friday.getDate() - 5);
            const list = [];
            for (let i = 0; i < 6; i++) {
                const d = new Date(sunday);
                d.setDate(sunday.getDate() + i);
                list.push(getDateString(d));
            }
            return list;
        })();
        const toggleHomeworkSelection = (id) => {
            const next = new Set(hwSelectedIds);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setHwSelectedIds(next);
        };

        const handleBatchConfirm = () => {
            if (batchAdjustModal.isCustom && !batchAdjustModal.customReasonName) return alert("请输入理由");
            if (!batchAdjustModal.scene || !batchAdjustModal.category) return alert("请先选择场景与类别");
            const reasonName = batchAdjustModal.isCustom ? batchAdjustModal.customReasonName : batchAdjustModal.reason.name;
            const updates = batchAdjustModal.students.map(s => {
                let finalVal = s.val;
                let finalReason = reasonName;
                if (batchAdjustModal.isMulti) {
                     finalVal = s.val * batchAdjustModal.factor; 
                     if (reasonName.includes("卫生")) {
                         finalReason = `${reasonName} x${s.val}`;
                     } else {
                         finalReason = `${reasonName} (值:${s.val})`;
                     }
                }
                if (batchAdjustModal.type === 'penalty') finalVal = -Math.abs(finalVal);
                else finalVal = Math.abs(finalVal);
                return { id: s.id, val: finalVal, reason: finalReason, type: batchAdjustModal.type, scene: batchAdjustModal.scene, category: batchAdjustModal.category };
            });
            batchUpdatePoints(updates);
            setBatchAdjustModal({ ...batchAdjustModal, open: false });
            setSelectedIds(new Set());
        };
            
        const updateStudentBatchValue = (id, newVal) => {
            setBatchAdjustModal(prev => ({
                ...prev,
                students: prev.students.map(s => s.id === id ? { ...s, val: parseFloat(newVal) } : s)
            }));
        };
            
        const updateAllBatchValues = (newVal) => {
            setBatchAdjustModal(prev => ({
                ...prev,
                students: prev.students.map(s => ({ ...s, val: parseFloat(newVal) }))
            }));
        };

        const handleHomeworkSubmit = () => {
            if (!hwSubject) return alert("请选择学科");
            const dateVal = hwDate || homeworkDates[0];
            if (!dateVal) return alert("请选择日期");
            
            const checkKey = `${hwSubject}_${dateVal}`;
            const alreadySubmitted = history.some(h => 
                h.reason && h.reason.includes(`${hwSubject}作业`) && h.reason.includes(dateVal)
            );
            if (alreadySubmitted) {
                return alert(`${hwSubject} ${dateVal} 已完成登记，每科每天只能登记一次`);
            }
            
            const subjectConfig = subjectsConfig.find(s => s.name === hwSubject);
            const representatives = subjectConfig?.representatives || [];
            
            console.log('学科配置:', hwSubject, subjectConfig);
            console.log('课代表IDs:', representatives);
            
            const updates = [];
            
            if (hwSelectedIds.size > 0) {
                Array.from(hwSelectedIds).forEach(id => {
                    updates.push({
                        id,
                        val: -1,
                        reason: `${hwSubject}作业未交 ${dateVal}`,
                        type: 'penalty',
                        scene: "班级",
                        category: "学业"
                    });
                });
            }
            
            if (representatives.length > 0) {
                representatives.forEach(repId => {
                    if (repId) {
                        console.log('为课代表加分:', repId);
                        updates.push({
                            id: repId,
                            val: 1,
                            reason: `${hwSubject}作业登记 ${dateVal}`,
                            type: 'bonus',
                            scene: "班级",
                            category: "班务"
                        });
                    }
                });
            }
            
            console.log('所有更新:', updates);
            
            if (updates.length === 0) {
                return alert("没有需要登记的记录。请确保已设置课代表。");
            }
            
            const repNames = representatives.map(repId => {
                const student = students.find(s => s.id === repId);
                return student ? student.name : '';
            }).filter(n => n).join('、');
            
            let confirmMsg = `确认提交 ${hwSubject} ${dateVal} 的作业登记？\n\n`;
            confirmMsg += `⚠️ 提醒：每科每天只能登记一次，请确保无误再提交！\n\n`;
            
            if (hwSelectedIds.size > 0) {
                const unsubmittedStudents = Array.from(hwSelectedIds).map(id => {
                    const s = students.find(stu => stu.id === id);
                    return s ? s.name : '';
                }).filter(n => n).join('、');
                confirmMsg += `未交作业学生 (${hwSelectedIds.size}人)：\n${unsubmittedStudents}\n\n`;
            } else {
                confirmMsg += `✅ 无学生未交作业\n\n`;
            }
            
            if (repNames) {
                confirmMsg += `课代表加分：${repNames} (+1分)`;
            }
            
            if (!confirm(confirmMsg)) return;
            
            batchUpdatePoints(updates);
            setHwSelectedIds(new Set());
            setHwSubject("");
        };

        const recentHistory = history.slice(0, 50);

        return h("div", { className: "space-y-6 animate-fade-in" },
            h("div", { className: "bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-center justify-between" },
                h("div", { className: "flex gap-2 items-center" },
                    h(Icon, { name: "filter", className: "text-gray-400" }),
                    h("select", { className: "border rounded p-2 text-sm", value: filterGroup, onChange: e => setFilterGroup(e.target.value) },
                        h("option", { value: "all" }, "所有小组"),
                        (() => {
                            const groupsConfig = getGroupsConfig(config);
                            return Object.entries(groupsConfig).map(([k, v]) => h("option", { key: k, value: k }, v.name));
                        })()
                    ),
                    h("select", { className: "border rounded p-2 text-sm", value: filterDorm, onChange: e => setFilterDorm(e.target.value) },
                        h("option", { value: "all" }, "所有宿舍"),
                        (() => {
                            const dormsConfig = getDormsConfig(config);
                            return Object.entries(dormsConfig).map(([k, v]) => h("option", { key: k, value: k }, v));
                        })()
                    )
                ),
                h("div", { className: "flex gap-2" },
                    h("button", { onClick: selectAll, className: "text-blue-600 text-sm font-bold" }, 
                        selectedIds.size === filteredStudents.length && filteredStudents.length > 0 ? "取消全选" : "全选当前"
                    ),
                    h("button", { onClick: handleWage, className: "bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1" }, h(Icon, { name: "money", size: 16 }), "一键工资")
                )
            ),
            h("div", { className: "grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3" },
                filteredStudents.map(s => {
                    const isSelected = selectedIds.has(s.id);
                    return h("div", { key: s.id, onClick: () => toggleSelection(s.id), className: `cursor-pointer p-3 rounded-lg border-2 transition relative overflow-hidden ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-white hover:shadow-md'}` },
                        isSelected && h("div", { className: "absolute top-1 right-1 text-blue-500" }, h(Icon, { name: "check", size: 16 })),
                        h("div", { className: "text-center" },
                            h("div", { className: "font-bold text-gray-800" }, s.name),
                            h("div", { className: "text-xs text-gray-400 mt-1" }, (() => {
                                const groupsConfig = getGroupsConfig(config);
                                const groupName = groupsConfig[s.group]?.name || s.group;
                                return groupName.split(' ')[1] || groupName;
                            })())
                        )
                    );
                })
            ),

            h("div", { className: "bg-white p-4 rounded-xl shadow-sm" },
                h("div", { className: "flex flex-wrap items-center justify-between gap-3 mb-4" },
                    h("div", { className: "flex items-center gap-3" },
                        h("span", { className: "font-bold text-gray-700" }, `已选 ${selectedIds.size} 人`),
                        selectedIds.size === 0 && h("span", { className: "text-xs text-gray-400" }, "请选择学生后操作")
                    ),
                    h("div", { className: "flex items-center gap-2" },
                        h("div", { className: "flex bg-gray-100 p-1 rounded-lg" },
                            h("button", { 
                                onClick: () => setOpTab('bonus'),
                                className: `px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-1 ${opTab === 'bonus' ? 'bg-white text-green-600 shadow ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`
                            }, h(Icon, { name: "plus", size: 14 }), "奖励"),
                            h("button", { 
                                onClick: () => setOpTab('penalty'),
                                className: `px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-1 ${opTab === 'penalty' ? 'bg-white text-red-600 shadow ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`
                            }, h(Icon, { name: "minus", size: 14 }), "扣分")
                        ),
                        h("button", { onClick: () => setSelectedIds(new Set()), className: "text-gray-400 hover:text-gray-600 px-2" }, "清空")
                    )
                ),
                h("div", { className: "flex gap-2 overflow-x-auto scrollbar-hide pb-2" },
                    (() => {
                        const reasonsPreset = getReasonsPreset(config);
                        return reasonsPreset.filter(r => r.type === opTab);
                    })().map((r, idx) => 
                        h("button", { 
                            key: idx, 
                            onClick: () => handleReasonClick(r),
                            className: `flex-shrink-0 px-4 py-3 rounded-xl border text-sm font-medium whitespace-nowrap transition flex flex-col items-center min-w-[100px] ${r.type === 'bonus' ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'}`
                        }, 
                            h("span", { className: "font-bold" }, r.name),
                            h("span", { className: "text-xs opacity-70 mt-1" }, r.val > 0 ? `+${r.val}` : r.val)
                        )
                    ),
                    h("button", {
                        onClick: handleCustomReason,
                        className: `flex-shrink-0 px-4 py-3 rounded-xl border-2 border-dashed text-sm font-bold whitespace-nowrap transition flex flex-col items-center min-w-[100px] hover:bg-gray-50 ${opTab === 'bonus' ? 'border-green-300 text-green-600' : 'border-red-300 text-red-600'}`
                    },
                        h("span", null, "自定义"),
                        h("span", { className: "text-xs opacity-70 mt-1" }, "输入理由")
                    )
                )
            ),

            h("div", { className: "bg-white p-4 rounded-xl shadow-sm" },
                h("h3", { className: "font-bold text-gray-700 mb-4 flex items-center gap-2" }, h(Icon, { name: "book" }), "作业登记"),
                h("div", { className: "flex flex-wrap gap-2 mb-3" },
                    homeworkSubjects.map(sub => h("button", {
                        key: sub,
                        onClick: () => setHwSubject(sub),
                        className: `px-3 py-1 rounded-full text-xs font-bold border ${hwSubject === sub ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`
                    }, sub))
                ),
                h("div", { className: "flex flex-wrap gap-2 mb-3" },
                    homeworkDates.map(d => h("button", {
                        key: d,
                        onClick: () => setHwDate(d),
                        className: `px-3 py-1 rounded-full text-xs font-bold border ${((hwDate || homeworkDates[0]) === d) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`
                    }, d))
                ),
                h("div", { className: "flex justify-between items-center mb-2" },
                    h("div", { className: "text-sm text-gray-600" }, "选择未交学生"),
                    h("div", { className: "flex gap-2" },
                        h("button", { onClick: () => setHwSelectedIds(new Set()), className: "text-xs text-gray-500" }, "清空"),
                        h("button", { onClick: () => setHwSelectedIds(new Set(students.map(s => s.id))), className: "text-xs text-blue-600" }, "全选")
                    )
                ),
                h("div", { className: "grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-56 overflow-y-auto border rounded p-2" },
                    students.map(s => {
                        const chosen = hwSelectedIds.has(s.id);
                        return h("button", {
                            key: s.id,
                            onClick: () => toggleHomeworkSelection(s.id),
                            className: `px-2 py-1 rounded text-xs border ${chosen ? 'bg-red-50 border-red-400 text-red-700' : 'bg-white border-gray-200 text-gray-700'}`
                        }, s.name);
                    })
                ),
                h("div", { className: "pt-3 flex justify-end gap-2" },
                    h("button", { 
                        onClick: handleHomeworkSubmit, 
                        className: "px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700" 
                    }, hwSelectedIds.size === 0 ? "提交（无人未交）" : `提交未交记录 (${hwSelectedIds.size}人)` )
                )
            ),
                
            h("div", { className: "bg-white p-4 rounded-xl shadow-sm mt-6" },
                h("h3", { className: "font-bold text-gray-700 mb-4 flex items-center gap-2" }, h(Icon, { name: "history" }), "积分变动记录 (最近50条)"),
                h("div", { className: "max-h-60 overflow-y-auto border rounded-lg" },
                    h("table", { className: "w-full text-sm text-left" },
                        h("thead", { className: "bg-gray-50 sticky top-0" },
                            h("tr", null,
                                h("th", { className: "p-2 font-medium text-gray-500" }, "时间"),
                                h("th", { className: "p-2 font-medium text-gray-500" }, "学生"),
                                h("th", { className: "p-2 font-medium text-gray-500" }, "事项"),
                                h("th", { className: "p-2 font-medium text-gray-500" }, "场景"),
                                h("th", { className: "p-2 font-medium text-gray-500" }, "类别"),
                                h("th", { className: "p-2 font-medium text-gray-500" }, "变动"),
                                h("th", { className: "p-2 font-medium text-gray-500" }, "操作")
                            )
                        ),
                        h("tbody", { className: "divide-y" },
                            recentHistory.length === 0 ? h("tr", null, h("td", { colSpan: 7, className: "p-4 text-center text-gray-400" }, "暂无记录")) :
                            recentHistory.map(item => 
                                h("tr", { key: item.id, className: "hover:bg-gray-50" },
                                    h("td", { className: "p-2 text-xs text-gray-400" }, new Date(item.ts).toLocaleString()),
                                    h("td", { className: "p-2 font-medium" }, item.studentName),
                                    h("td", { className: "p-2 text-gray-600" }, item.reason),
                                    h("td", { className: "p-2 text-xs text-gray-500" }, normalizePointScene(item.scene)),
                                    h("td", { className: "p-2 text-xs text-gray-500" }, normalizePointCategory(item.category)),
                                    h("td", { className: `p-2 font-bold ${item.val > 0 ? 'text-green-600' : 'text-red-500'}` }, item.val > 0 ? `+${item.val}` : item.val),
                                    h("td", { className: "p-2" },
                                        item.isUndoLog ? null : h("button", { onClick: () => handleUndo(item.id), className: "text-blue-500 hover:underline text-xs" }, "撤销")
                                    )
                                )
                            )
                        )
                    )
                )
            ),
                
            h(Modal, {
                isOpen: batchAdjustModal.open,
                title: batchAdjustModal.isCustom ? "自定义批量操作" : `批量调整: ${batchAdjustModal.reason?.name}`,
                onClose: () => setBatchAdjustModal({ ...batchAdjustModal, open: false }),
                onConfirm: handleBatchConfirm,
                confirmText: "确认应用",
                type: batchAdjustModal.type === 'penalty' ? 'danger' : 'info'
            }, 
                h("div", { className: "space-y-4" },
                    batchAdjustModal.isCustom && h("div", null,
                        h("label", { className: "block text-sm font-bold text-gray-700 mb-1" }, "理由名称"),
                        h("input", { 
                            type: "text", 
                            className: "w-full border rounded p-2", 
                            placeholder: "例如: 好人好事",
                            value: batchAdjustModal.customReasonName,
                            onChange: e => setBatchAdjustModal({ ...batchAdjustModal, customReasonName: e.target.value })
                        })
                    ),

                    h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
                        h("div", null,
                            h("label", { className: "block text-sm font-bold text-gray-700 mb-1" }, "场景"),
                            h("select", { className: "w-full border rounded p-2", value: batchAdjustModal.scene || DEFAULT_POINT_SCENE, onChange: e => setBatchAdjustModal({ ...batchAdjustModal, scene: e.target.value }) },
                                POINT_SCENES.map(s => h("option", { key: s, value: s }, s))
                            )
                        ),
                        h("div", null,
                            h("label", { className: "block text-sm font-bold text-gray-700 mb-1" }, "类别"),
                            h("select", { className: "w-full border rounded p-2", value: batchAdjustModal.category || DEFAULT_POINT_CATEGORY, onChange: e => setBatchAdjustModal({ ...batchAdjustModal, category: e.target.value }) },
                                POINT_CATEGORIES.map(c => h("option", { key: c, value: c }, c))
                            )
                        )
                    ),
                        
                    h("div", { className: "bg-gray-50 p-3 rounded-lg" },
                        h("label", { className: "block text-sm font-bold text-gray-700 mb-2" }, 
                            `统一调整 (${batchAdjustModal.isMulti ? '次数' : '分值'})`
                        ),
                        h("div", { className: "flex items-center gap-4" },
                            h("input", { 
                                type: "range", 
                                min: "0", 
                                max: batchAdjustModal.isMulti ? "20" : "50", 
                                step: batchAdjustModal.isMulti ? "1" : "0.5",
                                defaultValue: batchAdjustModal.students[0]?.val || 0,
                                onChange: e => updateAllBatchValues(e.target.value)
                            }),
                            h("span", { className: "text-xs text-gray-500" }, "拖动以统一设置")
                        )
                    ),

                    h("div", { className: "max-h-60 overflow-y-auto border rounded-lg" },
                        h("table", { className: "w-full text-sm" },
                            h("thead", { className: "bg-gray-50 sticky top-0" },
                                h("tr", null,
                                    h("th", { className: "p-2 text-left" }, "学生"),
                                    h("th", { className: "p-2 text-center" }, batchAdjustModal.isMulti ? `次数 (x${batchAdjustModal.factor})` : "分值")
                                )
                            ),
                            h("tbody", null,
                                batchAdjustModal.students.map(s => 
                                    h("tr", { key: s.id, className: "border-t" },
                                        h("td", { className: "p-2 font-bold" }, s.name),
                                        h("td", { className: "p-2 flex items-center justify-center gap-2" },
                                            h("input", { 
                                                type: "number", 
                                                className: "w-16 border rounded p-1 text-center font-mono font-bold",
                                                value: s.val,
                                                onChange: e => updateStudentBatchValue(s.id, e.target.value)
                                            })
                                        )
                                    )
                                )
                            )
                        )
                    ),
                        
                    h("div", { className: "p-2 rounded text-center text-xs font-bold " + (batchAdjustModal.type === 'bonus' ? 'text-green-600' : 'text-red-600') },
                        batchAdjustModal.type === 'bonus' ? '即将增加积分' : '即将扣除积分'
                    )
                )
            )
        );
    };

    const TreasureView = ({ students, updatePoints, adminPassword, treasures, setTreasures, storage, setStorage, logs, setLogs, redemptionHistory = {}, setRedemptionHistory, dailyUsageCounts = {}, setDailyUsageCounts, onReturnItem, onRedeemTreasure, onUseItem }) => {
        const [tab, setTab] = useState('shop');
        const [selectedStudent, setSelectedStudent] = useState("");
        const [gachaResult, setGachaResult] = useState(null);
        const [isGachaAnimating, setIsGachaAnimating] = useState(false);
        const [addModalOpen, setAddModalOpen] = useState(false);
        const [editMode, setEditMode] = useState(false); 
        const [newItemData, setNewItemData] = useState({ id: null, name: '', rarity: 'N', price: 10, stock: 10, desc: '', ladderPrices: '', dailyLimit: 0 });

        const handleTabChange = (t) => {
            if (t === 'admin') {
                if (!requireAdminAuth("请输入管理员密码以进入管理模式：", adminPassword)) return;
            }
            setTab(t);
        };

        const addLog = (studentName, action, item, cost, note = '') => {
            const log = { id: Date.now() + Math.random(), ts: Date.now(), studentName, action, itemName: item.name, rarity: item.rarity, cost, note };
            setLogs(prev => [log, ...prev]);
        };

        const addToStorage = (studentId, item, count = 1) => {
            setStorage(prev => {
                const sStore = { ...(prev[studentId] || {}) };
                sStore[item.id] = (sStore[item.id] || 0) + count;
                return { ...prev, [studentId]: sStore };
            });
        };

        const deductStock = (item, count = 1) => {
            setTreasures(prev => prev.map(t => t.id === item.id ? { ...t, stock: t.stock - count } : t));
        };

        // Helper: Get dynamic price based on user history
        const getPrice = (studentId, item) => {
            if (!item.ladderPrices || item.ladderPrices.length === 0) return item.price;
            const history = redemptionHistory[studentId] || {};
            const count = history[item.id] || 0; // 0 for 1st time
            const index = Math.min(count, item.ladderPrices.length - 1);
            return item.ladderPrices[index];
        };

        // Helper: Get next price hint
        const getNextPriceHint = (studentId, item) => {
            if (!item.ladderPrices || item.ladderPrices.length === 0) return null;
            const history = redemptionHistory[studentId] || {};
            const count = history[item.id] || 0;
            if (count + 1 < item.ladderPrices.length) {
                 return `(下次: ${item.ladderPrices[count + 1]})`;
            }
            return null;
        };

        // Helper: 退宝物时退还的金额（按最近一次兑换时的价格）
        const getRefundPrice = (studentId, item) => {
            if (!item.ladderPrices || !Array.isArray(item.ladderPrices) || item.ladderPrices.length === 0) return item.price;
            const history = redemptionHistory[studentId] || {};
            const count = history[item.id] || 0;
            if (count <= 0) return item.price;
            const index = Math.min(count - 1, item.ladderPrices.length - 1);
            return item.ladderPrices[index];
        };

        // Helper: Check global daily USAGE limit
        const checkDailyUsageLimit = (itemId) => {
            const item = treasures.find(t => t.id == itemId);
            if (!item || !item.dailyLimit || item.dailyLimit <= 0) return true; // No limit
            const today = getTodayStr();
            const currentCount = dailyUsageCounts[today]?.[itemId] || 0;
            if (currentCount >= item.dailyLimit) {
                alert(`该物品今日全班已使用 ${currentCount}/${item.dailyLimit} 次，达到上限。`);
                return false;
            }
            return true;
        };

        const handleBuy = (item) => {
            if (!selectedStudent) return alert("请先选择一名学生");
            const student = students.find(s => s.id == selectedStudent);
            if (!student) return;
                
            if (item.stock <= 0) return alert("库存不足");

            const currentPrice = getPrice(student.id, item);
            
            // 负价格宝物的特殊检查
            if (item.price < 0) {
                if (student.balance >= 0) {
                    return alert("负价格宝物只能在余额小于0时兑换");
                }
                if (student.balance - currentPrice > 0) {
                    return alert("兑换后余额不能大于0");
                }
            } else {
                if (student.balance < currentPrice) return alert("余额不足");
            }
                
            if (!confirm(`确定为 ${student.name} 兑换 ${item.name} 吗？\n消耗: ${currentPrice} 积分`)) return;
            
            // 使用 App 组件提供的立即保存函数
            if (onRedeemTreasure && onRedeemTreasure(student.id, item.id)) {
                alert("兑换成功！");
            } else {
                alert("兑换失败，请重试");
            }
        };

        const handleUseItem = (itemId) => {
            if (!selectedStudent) return alert("请先选择学生");
            const student = students.find(s => s.id == selectedStudent);
            if (!student) return;
            const count = storage[student.id]?.[itemId] || 0;
            if (count <= 0) return alert("该物品数量不足");
            const item = treasures.find(t => t.id == itemId) || { name: "未知物品", rarity: "N" };
            if (!checkDailyUsageLimit(itemId)) return;
            if (!confirm(`确定要使用 ${item.name} 吗？`)) return;

            if (typeof onUseItem === 'function' && onUseItem(student.id, itemId)) {
                alert("使用成功！");
            } else {
                alert("使用失败，请重试");
            }
        };

        const handleReturnItem = (itemId) => {
            if (!selectedStudent) return alert("请先选择学生");
            const student = students.find(s => s.id == selectedStudent);
            if (!student) return;
            const count = storage[student.id]?.[itemId] || 0;
            if (count <= 0) return;
            const item = treasures.find(t => t.id == itemId);
            if (!item) return;

            if (!requireAdminAuth("请输入管理员密码以退回宝物：", adminPassword || window.DEFAULT_ADMIN_PASSWORD)) return;
            if (typeof onReturnItem !== 'function') return;
            onReturnItem(student.id, itemId);
            alert("退回成功！");
        };

        const performGacha = (times) => {
            if (!selectedStudent) return alert("请先选择祈愿对象");
            const student = students.find(s => s.id == selectedStudent);
            const cost = times === 1 ? 15 : 120;
            if (student.balance < cost) return alert("积分不足");
            setIsGachaAnimating(true);
                
            setTimeout(() => {
                const results = [];
                const availableTreasures = treasures.filter(t => t.stock > 0);
                if (availableTreasures.length === 0) { setIsGachaAnimating(false); return alert("藏宝阁已被搬空！"); }
                const pick = (list) => list[Math.floor(Math.random() * list.length)];

                for (let i = 0; i < times; i++) {
                    const roll = Math.random() * 100;
                    let targetRarity = 'N';
                    if (roll < 0.05) targetRarity = 'SSR';
                    else if (roll < 5) targetRarity = 'SR';
                    else if (roll < 30) targetRarity = 'R';

                    let pool = availableTreasures.filter(t => t.rarity === targetRarity && t.stock > 0);
                    if (pool.length === 0 && targetRarity === 'SSR') { targetRarity = 'SR'; pool = availableTreasures.filter(t => t.rarity === 'SR' && t.stock > 0); }
                    if (pool.length === 0 && targetRarity === 'SR') { targetRarity = 'R'; pool = availableTreasures.filter(t => t.rarity === 'R' && t.stock > 0); }
                    if (pool.length === 0 && targetRarity === 'R') { targetRarity = 'N'; pool = availableTreasures.filter(t => t.rarity === 'N' && t.stock > 0); }
                    if (pool.length === 0) { targetRarity = 'N'; pool = availableTreasures.filter(t => t.stock > 0); }

                    if (pool.length > 0) {
                        const item = pick(pool);
                        results.push(item);
                    }
                }

                // Batch update for gacha logic (simplified)
                const newTreasures = [...treasures];
                const newStorage = { ...storage };
                const sStore = { ...(newStorage[student.id] || {}) };

                results.forEach(item => {
                    const tIndex = newTreasures.findIndex(t => t.id === item.id);
                    if (tIndex > -1) newTreasures[tIndex].stock--;
                    sStore[item.id] = (sStore[item.id] || 0) + 1;
                });

                setTreasures(newTreasures);
                setStorage({ ...newStorage, [student.id]: sStore });
                updatePoints(new Set([student.id]), -cost, `祈愿 x${times}`, 'spending', "班级", "兑奖");
                addLog(student.name, "祈愿", { name: `${times}连抽`, rarity: 'MIX' }, cost);
                setGachaResult(results);
                setIsGachaAnimating(false);
            }, 2500);
        };
            
        const handleSaveItem = () => {
            if(!newItemData.name) return alert("名称不能为空");
                
            const ladderPrices = newItemData.ladderPrices.toString().split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
            const newItem = {
                id: editMode ? newItemData.id : Date.now(),
                name: newItemData.name,
                rarity: newItemData.rarity,
                price: parseFloat(newItemData.price),
                stock: parseInt(newItemData.stock),
                desc: newItemData.desc,
                ladderPrices: ladderPrices,
                dailyLimit: parseInt(newItemData.dailyLimit)
            };
                
            if (editMode) {
                setTreasures(prev => prev.map(t => t.id === newItem.id ? newItem : t));
                addLog("系统", "管理", newItem, 0, `更新了 ${newItem.name} (库存:${newItem.stock}, 价格:${newItem.price})`);
            } else {
                setTreasures(prev => [...prev, newItem]);
                addLog("系统", "管理", newItem, 0, `添加了 ${newItem.name}`);
            }
                
            setAddModalOpen(false);
            setNewItemData({ name: '', rarity: 'N', price: 10, stock: 10, desc: '', ladderPrices: '', dailyLimit: 0 });
        };

        const openEditModal = (item) => {
            setEditMode(true);
            setNewItemData({
                ...item,
                ladderPrices: item.ladderPrices ? item.ladderPrices.join(',') : '',
                dailyLimit: item.dailyLimit || 0
            });
            setAddModalOpen(true);
        };

        const handleDeleteItem = (item) => {
            if (!item) return;
            if (!confirm(`确定要删除宝物“${item.name}”吗？\n这会同时清理储物箱和统计中的对应记录。`)) return;

            setTreasures(prev => prev.filter(t => t.id !== item.id));

            setStorage(prev => {
                const next = {};
                Object.entries(prev || {}).forEach(([studentId, studentStore]) => {
                    const store = { ...(studentStore || {}) };
                    delete store[item.id];
                    next[studentId] = store;
                });
                return next;
            });

            setRedemptionHistory(prev => {
                const next = {};
                Object.entries(prev || {}).forEach(([studentId, studentHistory]) => {
                    const history = { ...(studentHistory || {}) };
                    delete history[item.id];
                    next[studentId] = history;
                });
                return next;
            });

            setDailyUsageCounts(prev => {
                const next = {};
                Object.entries(prev || {}).forEach(([date, usageMap]) => {
                    const usage = { ...(usageMap || {}) };
                    delete usage[item.id];
                    next[date] = usage;
                });
                return next;
            });

            if (editMode && newItemData.id === item.id) {
                setAddModalOpen(false);
                setEditMode(false);
                setNewItemData({ id: null, name: '', rarity: 'N', price: 10, stock: 10, desc: '', ladderPrices: '', dailyLimit: 0 });
            }

            addLog("系统", "管理", item, 0, `删除了 ${item.name}`);
        };

        const rarityColor = (r) => {
            switch(r) {
                case 'SSR': return 'text-yellow-500 border-yellow-500 bg-yellow-50 glow-ssr';
                case 'SR': return 'text-purple-500 border-purple-500 bg-purple-50 glow-sr';
                case 'R': return 'text-blue-500 border-blue-500 bg-blue-50 glow-r';
                default: return 'text-gray-500 border-gray-400 bg-gray-50 glow-n';
            }
        };
            
        const sortedTreasures = [...treasures].sort((a, b) => {
            const rank = { 'SSR': 4, 'SR': 3, 'R': 2, 'N': 1 };
            return rank[b.rarity] - rank[a.rarity];
        });

        return h("div", { className: "bg-white rounded-xl shadow-lg border border-purple-100 overflow-hidden min-h-[600px] flex flex-col" },
            h("div", { className: "bg-gradient-to-r from-purple-900 to-indigo-900 p-4 text-white flex justify-between items-center" },
                h("div", { className: "flex items-center gap-2" }, h(Icon, { name: "gift", size: 24 }), h("span", { className: "text-xl font-bold" }, "藏宝阁")),
                h("div", { className: "flex gap-2" },
                    ['shop', 'gacha', 'storage', 'admin'].map(t => 
                        h("button", { key: t, onClick: () => handleTabChange(t), className: `px-3 py-1 rounded text-sm font-bold transition ${tab === t ? 'bg-yellow-400 text-purple-900' : 'bg-white/10 hover:bg-white/20'}` }, { shop: '兑换', gacha: '祈愿', storage: '储物箱', admin: '管理' }[t])
                    )
                )
            ),
            h("div", { className: "p-4 border-b bg-gray-50 flex items-center justify-between" },
                h("div", { className: "flex items-center gap-2" },
                    h("span", { className: "text-sm font-bold text-gray-600" }, "当前学生:"),
                    h("select", { className: "border rounded p-1 text-sm w-40", value: selectedStudent, onChange: e => setSelectedStudent(e.target.value) },
                        h("option", { value: "" }, "请选择..."),
                        students.map(s => h("option", { key: s.id, value: s.id }, s.name))
                    )
                ),
                selectedStudent && h("div", { className: "text-sm" },
                    h("span", { className: "text-gray-500" }, "余额: "),
                    h("span", { className: "font-mono font-bold text-green-600 text-lg" }, students.find(s=>s.id==selectedStudent).balance)
                )
            ),
            h("div", { className: "flex-1 p-4 bg-gray-100 overflow-y-auto relative" },
                tab === 'shop' && h("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4" },
                    sortedTreasures.map(item => {
                        const finalPrice = selectedStudent ? getPrice(selectedStudent, item) : item.price;
                        const nextPriceHint = selectedStudent ? getNextPriceHint(selectedStudent, item) : null;
                            
                        return h("div", { key: item.id, className: `bg-white rounded-lg shadow border-2 p-3 flex flex-col relative ${rarityColor(item.rarity).split(' ')[1]} ${item.stock === 0 ? 'opacity-50 grayscale' : ''}` },
                            h("div", { className: `absolute top-2 right-2 text-xs font-bold px-1 rounded border ${rarityColor(item.rarity)}` }, item.rarity),
                            h("div", { className: "font-bold text-gray-800" }, item.name),
                            h("div", { className: "text-xs text-gray-500 mb-2 h-8 overflow-hidden" }, item.desc),
                            item.ladderPrices && item.ladderPrices.length > 0 && h("div", { className: "text-xs text-purple-600 mb-1" }, "阶梯价生效中"),
                            h("div", { className: "mt-auto flex justify-between items-center" },
                                h("div", { className: "text-sm text-gray-500" }, `库存: ${item.stock}`),
                                h("div", { className: "text-right" },
                                     h("button", { onClick: () => handleBuy(item), disabled: item.stock === 0, className: "bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 disabled:bg-gray-400" }, `${finalPrice} 积分`),
                                     nextPriceHint && h("div", { className: "text-[10px] text-gray-400" }, nextPriceHint)
                                )
                            )
                        );
                    })
                ),
                tab === 'gacha' && h("div", { className: "h-full flex flex-col items-center justify-center relative overflow-hidden rounded-xl bg-space" },
                    // Gacha Entry Screen
                    h("div", { className: "absolute inset-0 bg-black/20" }),
                    h("div", { className: "z-10 flex flex-col gap-8 items-center animate-float" },
                        h("div", { className: "w-40 h-40 animate-pulse-glow" }, h(GachaCrystal)),
                        h("h2", { className: "text-4xl font-bold text-white tracking-widest text-center" }, "星辰祈愿"),
                        h("div", { className: "flex gap-6" },
                            h("button", { 
                                onClick: () => performGacha(1),
                                className: "group relative px-8 py-4 bg-blue-600/80 hover:bg-blue-600 text-white rounded-xl backdrop-blur border border-blue-400 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                            }, 
                                h("div", { className: "text-xl font-bold" }, "祈愿 1 次"),
                                h("div", { className: "text-sm text-blue-200" }, "15 积分")
                            ),
                            h("button", { 
                                onClick: () => performGacha(10),
                                className: "group relative px-8 py-4 bg-purple-600/80 hover:bg-purple-600 text-white rounded-xl backdrop-blur border border-purple-400 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(147,51,234,0.5)]"
                            }, 
                                h("div", { className: "text-xl font-bold" }, "祈愿 10 次"),
                                h("div", { className: "text-sm text-purple-200" }, "120 积分 (优惠)")
                            )
                        )
                    ),
                    h("div", { className: "mt-12 text-gray-400 text-xs z-10" }, "概率公示: SSR 0.05% | SR 4.95% | R 25% | N 70%")
                ),

                // Gacha Animation Overlay
                isGachaAnimating && h("div", { className: "fixed inset-0 z-50 bg-space flex flex-col items-center justify-center overflow-hidden" },
                    // Removed dark overlay to show beautiful space bg
                    // Stars
                    Array.from({ length: 50 }).map((_, i) => 
                        h("div", { key: i, className: "star", style: { top: `${Math.random()*100}%`, left: `${Math.random()*100}%`, width: `${Math.random()*3}px`, height: `${Math.random()*3}px`, animationDelay: `${Math.random()*3}s` } })
                    ),
                    h("div", { className: "meteor-shower", style: { top: "10%", left: "80%" } }),
                    h("div", { className: "meteor-shower", style: { top: "20%", left: "40%", animationDelay: "1.5s" } }),
                    h("div", { className: "z-50 text-center animate-pulse-glow" },
                        h("div", { className: "w-32 h-32 mx-auto mb-8 animate-spin-slow" }, h(GachaCrystal)),
                        h("h2", { className: "text-3xl font-bold text-white tracking-widest" }, "祈愿中...")
                    )
                ),

                // Gacha Result Overlay
                gachaResult && h("div", { className: "fixed inset-0 z-50 bg-space flex flex-col items-center justify-center overflow-hidden p-4" },
                     h("div", { className: "absolute inset-0 bg-black/80" }),
                     h("div", { className: "z-50 w-full max-w-6xl flex flex-col items-center h-full justify-center" },
                        h("h2", { className: "text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500 mb-8 animate-slide-up" }, "⭐ 祈愿结果 ⭐"),
                        h("div", { className: "flex flex-wrap gap-6 justify-center max-h-[60vh] overflow-y-auto p-4" },
                            gachaResult.map((item, idx) => 
                                h("div", { 
                                    key: idx, 
                                    className: `w-40 h-56 rounded-xl border-4 flex flex-col items-center justify-between p-4 bg-gray-900 shadow-2xl card-enter relative overflow-hidden group hover:scale-105 transition-transform duration-300`,
                                    style: { 
                                        animationDelay: `${idx * 150}ms`,
                                        borderColor: item.rarity === 'SSR' ? '#fbbf24' : item.rarity === 'SR' ? '#a855f7' : item.rarity === 'R' ? '#3b82f6' : '#9ca3af'
                                    }
                                },
                                    item.rarity === 'SSR' && h("div", { className: "absolute inset-0 bg-yellow-500/20 animate-pulse" }),
                                    h("div", { className: `text-2xl font-black italic ${item.rarity === 'SSR' ? 'text-yellow-400' : 'text-white'}` }, item.rarity),
                                    h("div", { className: "text-4xl" }, "🎁"),
                                    h("div", { className: "text-center" },
                                        h("div", { className: "text-sm font-bold text-white leading-tight" }, item.name),
                                        h("div", { className: "text-[10px] text-gray-400 mt-1" }, "获得 x1")
                                    )
                                )
                            )
                        ),
                        h("div", { className: "mt-8 flex gap-4" },
                            h("button", { onClick: () => { setGachaResult(null); performGacha(1); }, className: "px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold shadow-lg transition transform hover:-translate-y-1" }, "再抽一次 (15)"),
                            h("button", { onClick: () => { setGachaResult(null); performGacha(10); }, className: "px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold shadow-lg transition transform hover:-translate-y-1" }, "再抽十次 (120)"),
                            h("button", { onClick: () => setGachaResult(null), className: "px-8 py-3 border-2 border-white text-white rounded-full font-bold hover:bg-white/10 transition" }, "返回藏宝阁")
                        )
                    )
                ),

                tab === 'storage' && h("div", { className: "space-y-4" },
                    !selectedStudent ? h("div", { className: "space-y-4" },
                        h("div", { className: "text-center text-gray-500" }, "请先在上方选择学生查看储物箱"),
                        h("div", { className: "bg-white p-4 rounded shadow" },
                            h("h4", { className: "font-bold mb-3" }, "物品兑换记录 / 使用记录"),
                            (logs || []).filter(l => l.action === "兑换" || l.action === "使用").length === 0
                                ? h("div", { className: "text-center text-gray-400 py-6 text-sm" }, "暂无记录")
                                : h("div", { className: "max-h-64 overflow-y-auto border rounded" },
                                    h("table", { className: "w-full text-sm text-left" },
                                        h("thead", { className: "bg-gray-50 sticky top-0" },
                                            h("tr", null,
                                                h("th", { className: "p-2" }, "时间"),
                                                h("th", { className: "p-2" }, "学生"),
                                                h("th", { className: "p-2" }, "动作"),
                                                h("th", { className: "p-2" }, "物品"),
                                                h("th", { className: "p-2" }, "消耗/备注")
                                            )
                                        ),
                                        h("tbody", null,
                                            (logs || []).filter(l => l.action === "兑换" || l.action === "使用").map(l =>
                                                h("tr", { key: l.id, className: "border-t" },
                                                    h("td", { className: "p-2 text-xs text-gray-500" }, new Date(l.ts).toLocaleString()),
                                                    h("td", { className: "p-2" }, l.studentName),
                                                    h("td", { className: "p-2" }, l.action),
                                                    h("td", { className: "p-2" }, l.itemName),
                                                    h("td", { className: "p-2 font-mono" }, l.note != null && l.note !== "" ? l.note : l.cost)
                                                )
                                            )
                                        )
                                    )
                                )
                        )
                    ) : Object.keys(storage[selectedStudent] || {}).length === 0 ? h("div", { className: "text-center text-gray-500 mt-10" }, "空空如也") : h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
                        Object.keys(storage[selectedStudent]).map(tid => {
                            const item = treasures.find(t => t.id == tid);
                            const count = storage[selectedStudent][tid];
                            if (!item) return null;
                                
                            const todayCount = dailyUsageCounts[getTodayStr()]?.[item.id] || 0;
                            const dailyLimitText = item.dailyLimit > 0 ? `(今日全班可用: ${Math.max(0, item.dailyLimit - todayCount)}/${item.dailyLimit})` : "";
                                
                            return h("div", { key: tid, className: "bg-white p-3 rounded shadow flex justify-between items-center" },
                                h("div", null, 
                                    h("div", { className: "font-bold" }, item.name), 
                                    h("div", { className: `text-xs font-bold inline-block px-1 rounded border ${rarityColor(item.rarity)}` }, item.rarity),
                                    h("div", { className: "text-[10px] text-gray-500 mt-1" }, dailyLimitText)
                                ),
                                h("div", { className: "flex items-center gap-2" },
                                    h("span", { className: "text-gray-500" }, `x${count}`),
                                    h("button", { onClick: () => handleUseItem(tid), className: "bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600" }, "使用"),
                                    h("button", { onClick: () => handleReturnItem(tid), className: "bg-amber-500 text-white px-3 py-1 rounded text-xs hover:bg-amber-600" }, "退回")
                                )
                            );
                        })
                    )
                ),
                tab === 'admin' && h("div", { className: "space-y-6" },
                    h("div", { className: "bg-white p-4 rounded shadow" },
                        h("h4", { className: "font-bold mb-4" }, "库存管理 (仅管理员)"),
                        h("div", { className: "flex gap-2 mb-4" },
                            h("button", { onClick: () => { setEditMode(false); setNewItemData({ name: '', rarity: 'N', price: 10, stock: 10, desc: '', ladderPrices: '', dailyLimit: 0 }); setAddModalOpen(true); }, className: "px-3 py-1 border border-green-500 text-green-600 rounded hover:bg-green-50 text-sm flex items-center gap-1" }, h(Icon, { name: "plus", size: 14 }), "手动添加")
                        ),
                        h("div", { className: "max-h-60 overflow-y-auto border rounded" },
                            h("table", { className: "w-full text-sm text-left" },
                                h("thead", { className: "bg-gray-50 sticky top-0" }, h("tr", null, h("th", { className: "p-2" }, "ID"), h("th", { className: "p-2" }, "名称"), h("th", { className: "p-2" }, "库存"), h("th", { className: "p-2" }, "操作"))),
                                h("tbody", null, treasures.map(t => h("tr", { key: t.id, className: "border-t" },
                                    h("td", { className: "p-2" }, t.id),
                                    h("td", { className: "p-2 font-bold" }, t.name),
                                    h("td", { className: "p-2" }, t.stock),
                                    h("td", { className: "p-2" },
                                        h("div", { className: "flex items-center gap-3" },
                                            h("button", { className: "text-blue-500 hover:underline", onClick: () => openEditModal(t) }, "编辑"),
                                            h("button", { className: "text-red-500 hover:underline", onClick: () => handleDeleteItem(t) }, "删除")
                                        )
                                    )
                                )))
                            )
                        )
                    ),
                    h("div", { className: "bg-white p-4 rounded shadow" },
                        h("h4", { className: "font-bold mb-4" }, "操作日志"),
                        h("div", { className: "max-h-60 overflow-y-auto border rounded" },
                            h("table", { className: "w-full text-sm text-left" },
                                h("thead", { className: "bg-gray-50 sticky top-0" }, h("tr", null, h("th", { className: "p-2" }, "时间"), h("th", { className: "p-2" }, "学生"), h("th", { className: "p-2" }, "动作"), h("th", { className: "p-2" }, "物品"), h("th", { className: "p-2" }, "消耗/备注"))),
                                h("tbody", null, logs.map(l => h("tr", { key: l.id, className: "border-t" }, h("td", { className: "p-2 text-xs text-gray-500" }, new Date(l.ts).toLocaleString()), h("td", { className: "p-2" }, l.studentName), h("td", { className: "p-2" }, l.action), h("td", { className: "p-2" }, l.itemName), h("td", { className: "p-2 font-mono" }, l.note || l.cost))))
                            )
                        )
                    )
                ),
                h(Modal, {
                    isOpen: addModalOpen,
                    title: editMode ? "编辑宝物" : "添加新宝物",
                    onClose: () => setAddModalOpen(false),
                    onConfirm: handleSaveItem,
                    confirmText: editMode ? "保存修改" : "添加"
                }, 
                    h("div", { className: "space-y-3 text-sm" },
                        h("div", null, 
                            h("label", { className: "block font-bold mb-1" }, "名称"),
                            h("input", { className: "border w-full p-2 rounded", value: newItemData.name, onChange: e => setNewItemData({...newItemData, name: e.target.value}) })
                        ),
                        h("div", { className: "grid grid-cols-2 gap-3" },
                            h("div", null,
                                h("label", { className: "block font-bold mb-1" }, "稀有度"),
                                h("select", { className: "border w-full p-2 rounded", value: newItemData.rarity, onChange: e => setNewItemData({...newItemData, rarity: e.target.value}) },
                                    ['N', 'R', 'SR', 'SSR'].map(r => h("option", { key: r, value: r }, r))
                                )
                            ),
                            h("div", null,
                                h("label", { className: "block font-bold mb-1" }, "基础价格"),
                                h("input", { type: "number", className: "border w-full p-2 rounded", value: newItemData.price, onChange: e => setNewItemData({...newItemData, price: e.target.value}) })
                            )
                        ),
                        h("div", { className: "grid grid-cols-2 gap-3" },
                             h("div", null, 
                                h("label", { className: "block font-bold mb-1" }, "库存"),
                                h("input", { type: "number", className: "border w-full p-2 rounded", value: newItemData.stock, onChange: e => setNewItemData({...newItemData, stock: e.target.value}) })
                            ),
                             h("div", null, 
                                h("label", { className: "block font-bold mb-1" }, "单日全班使用上限 (0为不限)"),
                                h("input", { type: "number", className: "border w-full p-2 rounded", value: newItemData.dailyLimit, onChange: e => setNewItemData({...newItemData, dailyLimit: e.target.value}) })
                            )
                        ),
                        h("div", null, 
                            h("label", { className: "block font-bold mb-1" }, "阶梯价格 (逗号分隔，如: 10,20,30)"),
                            h("input", { className: "border w-full p-2 rounded", value: newItemData.ladderPrices, onChange: e => setNewItemData({...newItemData, ladderPrices: e.target.value}), placeholder: "留空则使用基础价格" })
                        ),
                        h("div", null, 
                            h("label", { className: "block font-bold mb-1" }, "描述"),
                            h("input", { className: "border w-full p-2 rounded", value: newItemData.desc, onChange: e => setNewItemData({...newItemData, desc: e.target.value}) })
                        )
                    )
                )
            )
        );
    };

    const SettingsView = ({ students, studentProfiles, setStudentProfiles, history, config, setStudents, setHistory, setConfig, attendanceRecords, setAttendanceRecords, treasures, setTreasures, storage, setStorage, logs, setLogs, quotes, setQuotes, persistData, persistDataPatch, tasks, setTasks, messages, setMessages, teacherMessages, setTeacherMessages, redemptionHistory, setRedemptionHistory, dailyRedemptionCounts, setDailyRedemptionCounts, dailyUsageCounts, setDailyUsageCounts, battle, setBattle, examArchives, setExamArchives, battleSnapshots, setBattleSnapshots, isDirtyRef, createSnapshot, testMode, enterTestMode, exitTestMode, simTime, setSimTime, timeSpeed, setTimeSpeed }) => {
        const [isAuthenticated, setIsAuthenticated] = useState(isAdminAuthed());
        const [pwd, setPwd] = useState('');
        const [selectedSnapshotId, setSelectedSnapshotId] = useState(null);
        const [desktopConfig, setDesktopConfig] = useState(null);
        const [desktopStatus, setDesktopStatus] = useState(null);
        const [desktopPing, setDesktopPing] = useState(null);
        const [desktopBusy, setDesktopBusy] = useState(false);
        const getReportRange = (days) => {
            const end = getTodayStr();
            const start = new Date(getNow());
            start.setDate(start.getDate() - (days - 1));
            return { start: getDateString(start), end };
        };
        const [reportStart, setReportStart] = useState(() => getReportRange(7).start);
        const [reportEnd, setReportEnd] = useState(() => getReportRange(7).end);
        const [countdownName, setCountdownName] = useState("");
        const [countdownDate, setCountdownDate] = useState("");
        const [recordSearch, setRecordSearch] = useState("");
        const [recordSelection, setRecordSelection] = useState(new Set());
        const [recordScene, setRecordScene] = useState(DEFAULT_POINT_SCENE);
        const [recordCategory, setRecordCategory] = useState(DEFAULT_POINT_CATEGORY);
        const [showPendingOnly, setShowPendingOnly] = useState(false);
        const [showExamArchivesManager, setShowExamArchivesManager] = useState(false);
        const [examArchivesModuleStatus, setExamArchivesModuleStatus] = useState(typeof window.createExamArchivesView === 'function' ? 'ready' : 'idle');
        const systemConfig = getSystemConfig(config);
        const ExamArchivesView = examArchivesModuleStatus === 'ready' ? getExamArchivesView() : null;
        const formatDateTimeLocal = (ts) => {
            const d = new Date(ts);
            if (isNaN(d.getTime())) return "";
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        const applySystemConfig = (next) => {
            const newConfig = { ...config, systemConfig: next };
            setConfig(newConfig);
            if (Array.isArray(next.quotes)) setQuotes(next.quotes);
        };

        const updateSystemConfig = (updater) => {
            const next = updater(getSystemConfig(config));
            applySystemConfig(next);
        };

        const addCountdownEvent = () => {
            const name = (countdownName || "").trim();
            if (!name || !countdownDate) return alert("请填写事件名称和日期");
            const list = Array.isArray(config.countdownEvents) ? [...config.countdownEvents] : [];
            list.push({ id: Date.now(), name, date: countdownDate });
            setConfig({ ...config, countdownEvents: list });
            setCountdownName("");
            setCountdownDate("");
        };
        const removeCountdownEvent = (id) => {
            const list = Array.isArray(config.countdownEvents) ? config.countdownEvents.filter(e => e.id !== id) : [];
            setConfig({ ...config, countdownEvents: list });
        };
        const handleGenerateBrief = () => {
            const start = new Date(reportStart);
            const end = new Date(reportEnd);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return alert("日期范围无效");
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            const list = (history || []).filter(h => h && h.ts >= start.getTime() && h.ts <= end.getTime());
            const byStudent = new Map();
            list.forEach(h => {
                const arr = byStudent.get(h.studentId) || [];
                arr.push(h);
                byStudent.set(h.studentId, arr);
            });
            const lines = [];
            lines.push(`简报 ${reportStart} ~ ${reportEnd}`);
            (students || []).forEach(s => {
                lines.push("");
                lines.push(s.name);
                const items = (byStudent.get(s.id) || []).sort((a, b) => a.ts - b.ts);
                if (items.length === 0) {
                    lines.push("  无记录");
                } else {
                    items.forEach(it => {
                        const val = Number(it.val) || 0;
                        const signVal = val > 0 ? `+${val}` : `${val}`;
                        lines.push(`  ${new Date(it.ts).toLocaleString('zh-CN', { hour12: false })} ${it.reason} ${signVal}`);
                    });
                }
            });
            const blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `简报_${reportStart}_${reportEnd}.txt`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        };

        const historySource = Array.isArray(history) ? history : [];
        useEffect(() => {
            if (historySource.length === 0) return;
            if (systemConfig && systemConfig.recordCategoryPendingMigrated) return;
            const nextHistory = historySource.map(item => ({ ...item, category: "待定" }));
            setHistory(nextHistory);
            updateSystemConfig(sc => ({ ...sc, recordCategoryPendingMigrated: true }));
        }, [historySource.length, systemConfig && systemConfig.recordCategoryPendingMigrated]);
        const normalizedRecordSearch = (recordSearch || "").trim().toLowerCase();
        const recordSearchTerms = normalizedRecordSearch ? normalizedRecordSearch.split(/\s+/) : [];
        const filteredHistoryRecords = historySource.filter(item => {
            if (showPendingOnly && normalizePointCategory(item.category) !== "待定") return false;
            if (!recordSearchTerms.length) return true;
            const haystack = `${item.studentName || ""} ${item.reason || ""} ${normalizePointScene(item.scene)} ${normalizePointCategory(item.category)}`.toLowerCase();
            return recordSearchTerms.every(term => haystack.includes(term));
        });
        const visibleHistoryRecords = filteredHistoryRecords.slice(0, 200);
        const toggleRecordSelection = (id) => {
            setRecordSelection(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
            });
        };
        const selectFilteredRecords = () => {
            setRecordSelection(new Set(filteredHistoryRecords.map(item => item.id)));
        };
        const clearRecordSelection = () => {
            setRecordSelection(new Set());
        };
        const applyRecordAttributes = () => {
            if (recordSelection.size === 0) return alert("请先选择记录");
            const nextHistory = historySource.map(item => recordSelection.has(item.id) ? { ...item, scene: normalizePointScene(recordScene), category: normalizePointCategory(recordCategory) } : item);
            setHistory(nextHistory);
            setRecordSelection(new Set());
        };
        const deleteSelectedRecords = () => {
            if (recordSelection.size === 0) return alert("请先选择记录");
            if (!confirm(`确定删除选中的 ${recordSelection.size} 条记录？\n注意：此操作仅删除记录，不会影响学生积分数据。`)) return;
            const nextHistory = historySource.filter(item => !recordSelection.has(item.id));
            setHistory(nextHistory);
            setRecordSelection(new Set());
        };

        useEffect(() => {
            if (!window.desktopApi) return;
            window.desktopApi.getConfig().then(cfg => setDesktopConfig(cfg || { serverUrl: "", preferredMode: "auto" }));
            window.desktopApi.getStatus().then(setDesktopStatus);
        }, []);

        const modeLabel = (mode) => ({ online: '在线', offline: '离线', auto: '自动' }[mode] || '未知');

        const handleDesktopSave = async () => {
            if (!window.desktopApi || !desktopConfig) return;
            setDesktopBusy(true);
            const next = { ...desktopConfig, serverUrl: (desktopConfig.serverUrl || "").trim() };
            try {
                const saved = await window.desktopApi.setConfig(next);
                setDesktopConfig(saved);
                const status = await window.desktopApi.getStatus();
                setDesktopStatus(status);
            } finally {
                setDesktopBusy(false);
            }
        };

        const handleDesktopPing = async () => {
            if (!window.desktopApi || !desktopConfig) return;
            const url = (desktopConfig.serverUrl || "").trim();
            if (!url) {
                setDesktopPing({ ok: false, text: "请先填写服务器地址" });
                return;
            }
            setDesktopBusy(true);
            setDesktopPing(null);
            const ok = await window.desktopApi.pingServer(url);
            setDesktopPing({ ok, text: ok ? "连接正常" : "连接失败" });
            setDesktopBusy(false);
        };

        const saveOfflineSnapshot = async () => {
            const nowTs = getNow().getTime();
            const normalizedStudentProfiles = buildNormalizedStudentProfiles(studentProfiles, students);
            let att = {};
            try {
                const raw = getStorageItem('attendance_records');
                if (raw) att = JSON.parse(raw);
            } catch (_) {}
            const fullData = {
                students,
                history,
                config,
                attendanceRecords: att,
                treasures,
                storage,
                logs,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts,
                tasks,
                battle,
                examArchives,
                battleSnapshots,
                studentProfiles: normalizedStudentProfiles
            };
            const payload = { ts: nowTs, data: fullData };
            if (window.desktopApi && typeof window.desktopApi.setOfflineSnapshot === 'function') {
                await window.desktopApi.setOfflineSnapshot(payload);
            } else {
                setStorageItem('cm_offline_snapshot', JSON.stringify(payload));
            }
        };

        const handleDesktopMode = async (mode) => {
            if (!window.desktopApi) return;
            if (mode === 'online') {
                const url = (desktopConfig?.serverUrl || "").trim();
                if (!url) {
                    alert("请先填写服务器地址");
                    return;
                }
            }
            if (mode === 'offline') {
                await saveOfflineSnapshot();
            }
            setDesktopBusy(true);
            const status = await window.desktopApi.setMode(mode);
            setDesktopStatus(status);
            setDesktopBusy(false);
        };

        const handleExportStudentsExcel = () => {
            const groupsConfig = getGroupsConfig(config);
            const dormsConfig = getDormsConfig(config);
            const data = (students || []).map(s => ({
                "姓名": s.name || "",
                "性别": s.gender === 'M' ? '男' : s.gender === 'F' ? '女' : '',
                "小组": groupsConfig[s.group]?.name || s.group || "",
                "职位": s.role === 'leader' ? '组长' : s.role === 'member' ? '组员' : '',
                "宿舍": dormsConfig[s.dorm] || s.dorm || ""
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "学生名单");
            XLSX.writeFile(wb, `学生名单_${getTodayStr()}.xlsx`);
        };
        
        const handleImportStudentsExcel = (e, mode = 'overwrite') => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const wb = XLSX.read(evt.target.result, { type: 'array' });
                const sheetName = wb.SheetNames[0];
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
                if (!Array.isArray(rows)) { alert("解析失败"); return; }
                const groupsList = getSystemConfig(config).organization.groups || [];
                const dormsList = getSystemConfig(config).organization.dorms || [];
                const toGroupId = (val) => {
                    if (!val) return "";
                    const g = groupsList.find(x => x.name === val || x.id === val);
                    return g ? g.id : String(val);
                };
                const toDormId = (val) => {
                    if (!val) return "";
                    const d = dormsList.find(x => x.name === val || x.id === val);
                    return d ? d.id : String(val);
                };
                const toRoleId = (val) => {
                    if (!val) return "";
                    if (val === '组长' || String(val).toLowerCase() === 'leader') return 'leader';
                    if (val === '组员' || String(val).toLowerCase() === 'member') return 'member';
                    return String(val);
                };
                const toGender = (val) => {
                    if (!val) return "";
                    if (val === '男' || String(val).toUpperCase() === 'M') return 'M';
                    if (val === '女' || String(val).toUpperCase() === 'F') return 'F';
                    return "";
                };
                const normalizeName = (val) => String(val || "").trim();
                const parseRow = (r) => ({
                    name: normalizeName(r["姓名"] || r["name"]),
                    gender: toGender(r["性别"] || r["gender"]),
                    group: toGroupId(r["小组"] || r["group"]),
                    role: toRoleId(r["职位"] || r["role"]),
                    dorm: toDormId(r["宿舍"] || r["dorm"])
                });
                if (mode === 'merge') {
                    if (!confirm(`解析到 ${rows.length} 条学生记录，确定【增量导入】吗？将更新同名学生并新增不存在学生。`)) return;
                    const incoming = rows.map(parseRow).filter(s => s.name);
                    setStudents(prev => {
                        const list = Array.isArray(prev) ? prev : [];
                        const byName = new Map(list.map(s => [normalizeName(s.name), s]));
                        const updates = new Map(incoming.map(s => [normalizeName(s.name), s]));
                        const updated = list.map(s => {
                            const key = normalizeName(s.name);
                            const patch = updates.get(key);
                            if (!patch) return s;
                            return { ...s, ...patch };
                        });
                        const now = Date.now();
                        const additions = incoming
                            .filter(s => !byName.has(normalizeName(s.name)))
                            .map((s, idx) => ({ id: now + idx, ...s, zizai: 0, balance: 0, penalty: 0 }));
                        return [...updated, ...additions];
                    });
                    alert("学生名单已增量导入");
                } else {
                    if (!confirm(`解析到 ${rows.length} 条学生记录，确定覆盖现有名单吗？`)) return;
                    const now = Date.now();
                    const newStudents = rows.map((r, idx) => {
                        const parsed = parseRow(r);
                        return {
                            id: now + idx,
                            ...parsed,
                            zizai: 0,
                            balance: 0,
                            penalty: 0
                        };
                    }).filter(s => s.name);
                    setStudents(newStudents);
                    setStudentProfiles(remapStudentProfilesToStudentsByName(students, newStudents, studentProfiles));
                    alert("学生名单已更新");
                }
            };
            reader.readAsArrayBuffer(file);
            e.target.value = '';
        };
        const updateStudent = (id, patch) => {
            setStudents(prev => (Array.isArray(prev) ? prev : []).map(s => s.id === id ? { ...s, ...patch } : s));
        };
        const removeStudent = (id) => {
            setStudents(prev => (Array.isArray(prev) ? prev : []).filter(s => s.id !== id));
            setStudentProfiles(prev => {
                const normalized = buildNormalizedStudentProfiles(prev, students);
                const nextEntries = { ...(normalized.entries || {}) };
                delete nextEntries[String(id)];
                return { ...normalized, entries: nextEntries };
            });
        };
        const addStudent = () => {
            const now = Date.now();
            const newStudent = { id: now, name: "", gender: "", group: "", role: "member", dorm: "", zizai: 0, balance: 0, penalty: 0 };
            setStudents([...(Array.isArray(students) ? students : []), newStudent]);
        };
        // 锁屏界面逻辑
        if (!isAuthenticated) {
            return h("div", { className: "min-h-[500px] flex items-center justify-center animate-fade-in" },
                h("div", { className: "bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center" },
                    h("div", { className: "mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-blue-600" }, h(Icon, { name: "lock", size: 32 })),
                    h("h2", { className: "text-2xl font-bold text-gray-800 mb-2" }, "管理员验证"),
                    h("p", { className: "text-gray-500 mb-4 text-sm" }, "进入维护中心需要验证权限"),
                    h("div", { className: "bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-left" },
                        h("p", { className: "text-xs text-amber-600 mb-1" }, "默认管理密码："),
                        h("p", { className: "text-sm font-mono text-amber-800 font-semibold" }, "K9x4B2m7Q5w8Z1v3"),
                        h("p", { className: "text-xs text-amber-500 mt-1" }, "登录后可在「系统配置」中修改密码")
                    ),
                    h("input", { 
                        type: "password", 
                        value: pwd,
                        onChange: e => setPwd(e.target.value),
                        onKeyDown: e => {
                            if (e.key === 'Enter') {
                                const systemConfig = getSystemConfig(config);
                                if (pwd === systemConfig.adminPassword) {
                                    setAdminAuthUntil(getNow().getTime() + ADMIN_AUTH_TTL_MS);
                                    setIsAuthenticated(true);
                                    setPwd('');
                                } else {
                                    alert("密码错误");
                                    setPwd('');
                                }
                            }
                        },
                        placeholder: "请输入管理员密码",
                        className: "w-full border rounded-lg p-3 mb-4 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    }),
                    h("button", {
                        onClick: () => {
                            const systemConfig = getSystemConfig(config);
                            if (pwd === systemConfig.adminPassword) {
                                setAdminAuthUntil(getNow().getTime() + ADMIN_AUTH_TTL_MS);
                                setIsAuthenticated(true);
                                setPwd('');
                            } else {
                                alert("密码错误");
                                setPwd('');
                            }
                        },
                        className: "w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition"
                    }, "解锁进入")
                )
            );
        }

        // 验证通过后的功能逻辑
        const downloadBackup = () => {
            const normalizedStudentProfiles = buildNormalizedStudentProfiles(studentProfiles, students);
            let latestAttendance = attendanceRecords;
            try {
                const saved = getStorageItem('attendance_records');
                if (saved) latestAttendance = JSON.parse(saved);
            } catch (_) {}
            const fullData = { 
                students, history, config, 
                attendance_records: latestAttendance || {},
                class_treasure_data: { treasures, storage, logs },
                quotes: quotes,
                battle: battle,
                examArchives: examArchives,
                battleSnapshots: battleSnapshots,
                studentProfiles: normalizedStudentProfiles
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullData));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "class_full_backup_" + getTodayStr() + ".json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        };

        const handleImportJSON = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (confirm("确定要恢复全量备份吗？当前数据将被覆盖！")) {
                        if (data.students) setStudents(data.students);
                        if (hasStudentProfilesInData(data)) setStudentProfiles(restoreStudentProfilesFromData(data, studentProfiles, students));
                        if (data.history) setHistory(data.history);
                        if (data.config) {
                            const merged = getSystemConfig({ systemConfig: data.config.systemConfig || {} });
                            setConfig({ ...data.config, systemConfig: merged });
                            if (Array.isArray(merged.quotes)) setQuotes(merged.quotes);
                        }
                        if (data.attendance_records) {
                            setAttendanceRecords(data.attendance_records);
                            setStorageItem('attendance_records', JSON.stringify(data.attendance_records));
                        }
                        if (data.class_treasure_data) {
                            setTreasures(data.class_treasure_data.treasures || []);
                            setStorage(data.class_treasure_data.storage || {});
                            setLogs(data.class_treasure_data.logs || []);
                        }
                        if (data.quotes) setQuotes(data.quotes);
                        if (data.battle) setBattle(battleNormalize(data.battle));
                        if (data.examArchives) setExamArchives(normalizeExamArchives(data.examArchives, data.battle || battle));
                        if (data.battleSnapshots) setBattleSnapshots(normalizeBattleSnapshots(data.battleSnapshots));
                        alert("恢复成功！");
                    }
                } catch (err) { alert("文件格式错误"); }
            };
            reader.readAsText(file);
            e.target.value = '';
        };

        const getSnapshots = () => {
            try {
                const s = getStorageItem('class_manager_snapshots');
                return s ? JSON.parse(s) : [];
            } catch (_) { return []; }
        };

        const handleRestoreSnapshot = () => {
            const list = getSnapshots();
            const snap = list.find(x => x.id === selectedSnapshotId);
            if (!snap) {
                alert("请先选择一个快照");
                return;
            }
            if (!confirm(`确定将系统数据恢复为快照「${snap.label}」吗？当前数据将被覆盖！`)) return;
            const d = snap.data;
            const nextStudentProfiles = restoreStudentProfilesFromData(d, studentProfiles, students);
            if (d.students) setStudents(d.students);
            if (hasStudentProfilesInData(d)) setStudentProfiles(nextStudentProfiles);
            if (d.history) setHistory(d.history);
            if (d.config) setConfig(d.config);
            if (d.attendanceRecords) setAttendanceRecords(d.attendanceRecords);
            if (d.treasures) setTreasures(d.treasures || []);
            if (d.storage) setStorage(d.storage || {});
            if (d.logs) setLogs(d.logs || []);
            if (d.quotes) setQuotes(d.quotes || []);
            if (d.messages) setMessages(d.messages || []);
            if (d.teacherMessages) setTeacherMessages(d.teacherMessages || []);
            if (d.redemptionHistory) setRedemptionHistory(d.redemptionHistory || {});
            if (d.dailyRedemptionCounts) setDailyRedemptionCounts(d.dailyRedemptionCounts || {});
            if (d.dailyUsageCounts) setDailyUsageCounts(d.dailyUsageCounts || {});
            if (d.tasks) setTasks(d.tasks || []);
            if (d.battle) setBattle(battleNormalize(d.battle));
            if (d.examArchives) setExamArchives(normalizeExamArchives(d.examArchives, d.battle || battle));
            if (d.battleSnapshots) setBattleSnapshots(normalizeBattleSnapshots(d.battleSnapshots));
            if (typeof persistData === 'function') persistData({ ...d, studentProfiles: nextStudentProfiles });
            setSelectedSnapshotId(null);
            alert("已恢复为选中快照！");
        };

        const handleManualSnapshot = () => {
            if (!confirm("确定立即生成一个手动快照吗？")) return;
            const ok = typeof createSnapshot === 'function' ? createSnapshot({ note: '(手动)' }) : false;
            if (ok) alert("已生成快照！");
            else alert("生成快照失败，请稍后重试");
        };

        const handleExportScoreExcel = () => {
            const data = students.map(s => ({
                "姓名": s.name, 
                "小组": (() => {
                    const groupsConfig = getGroupsConfig(config);
                    return groupsConfig[s.group]?.name || s.group;
                })(), 
                "职位": s.role === 'leader' ? '组长' : '组员',
                "宿舍": (() => {
                    const dormsConfig = getDormsConfig(config);
                    return dormsConfig[s.dorm] || s.dorm;
                })(), 
                "自在值": s.zizai, "余额": s.balance, "不自在值": s.penalty
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "积分表");
            XLSX.writeFile(wb, `积分表_${getTodayStr()}.xlsx`);
        };

        const handleImportScoreExcel = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                if (confirm(`解析到 ${json.length} 条数据，确定更新积分吗？`)) {
                    const newStudents = [...students];
                    json.forEach(row => {
                        const t = newStudents.find(s => s.name === row["姓名"]);
                        if (t) {
                            if (row["自在值"] !== undefined) t.zizai = Number(row["自在值"]);
                            if (row["余额"] !== undefined) t.balance = Number(row["余额"]);
                            if (row["不自在值"] !== undefined) t.penalty = Number(row["不自在值"]);
                        }
                    });
                    setStudents(newStudents);
                    alert("积分更新成功");
                }
            };
            reader.readAsArrayBuffer(file);
            e.target.value = '';
        };

        const handleRecoverFromHistory = () => {
            const name = prompt("输入要恢复积分的学生姓名（如：陈正岳）：");
            if (!name || !name.trim()) return;
            const s = students.find(st => st.name.trim() === name.trim());
            if (!s) {
                alert("未找到该学生");
                return;
            }
            const myHistory = (history || []).filter(h => h.studentId === s.id && h.snapshot);
            if (myHistory.length === 0) {
                alert(`未找到 ${s.name} 的历史记录，无法恢复。`);
                return;
            }
            let best = { zizai: 0, balance: 0, penalty: 0 };
            let bestRecord = null;
            myHistory.forEach(h => {
                if (!h.snapshot) return;
                const z = Number(h.snapshot.zizai);
                if (isNaN(z)) return;
                if (z > (best.zizai ?? 0)) {
                    best = { zizai: h.snapshot.zizai, balance: h.snapshot.balance, penalty: h.snapshot.penalty };
                    bestRecord = h;
                }
            });
            const snap = bestRecord;
            const when = snap ? new Date(snap.ts).toLocaleString() : "";
            if (!confirm(`将 ${s.name} 的积分恢复为：\n自在值 ${best.zizai}，余额 ${best.balance}，不自在值 ${best.penalty}\n（来自历史记录${when ? " " + when : ""}）\n\n确定恢复？`)) return;
            const newStudents = students.map(st => {
                if (st.id !== s.id) return st;
                return {
                    ...st,
                    zizai: best.zizai != null ? Number(best.zizai) : st.zizai,
                    balance: best.balance != null ? Number(best.balance) : st.balance,
                    penalty: best.penalty != null ? Number(best.penalty) : st.penalty
                };
            });
            setStudents(newStudents);

            let att = {};
            try { const r = getStorageItem('attendance_records'); if (r) att = JSON.parse(r); } catch (_) {}
            const fullData = {
                students: newStudents,
                studentProfiles,
                history,
                config,
                attendanceRecords: att,
                treasures,
                storage,
                logs,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts,
                tasks,
                battle,
                battleSnapshots
            };
            if (typeof persistData === 'function') persistData(fullData);

            alert("已恢复");
        };

        const handleFixScore = () => {
            const name = prompt("输入要修正积分的学生姓名（如：陈正岳）：");
            if (!name || !name.trim()) return;
            const s = students.find(st => st.name.trim() === name.trim());
            if (!s) {
                alert("未找到该学生");
                return;
            }
            const zizaiStr = prompt("自在值（直接回车则不修改）", String(s.zizai ?? 0));
            const balanceStr = prompt("余额（直接回车则不修改）", String(s.balance ?? 0));
            const penaltyStr = prompt("不自在值（直接回车则不修改）", String(s.penalty ?? 0));
            const newZizai = zizaiStr === "" || zizaiStr === null ? s.zizai : Number(zizaiStr);
            const newBalance = balanceStr === "" || balanceStr === null ? s.balance : Number(balanceStr);
            const newPenalty = penaltyStr === "" || penaltyStr === null ? s.penalty : Number(penaltyStr);
            if (isNaN(newZizai) || isNaN(newBalance) || isNaN(newPenalty)) {
                alert("请输入有效数字");
                return;
            }
            const newStudents = students.map(st => {
                if (st.id !== s.id) return st;
                return { ...st, zizai: newZizai, balance: newBalance, penalty: newPenalty };
            });
            setStudents(newStudents);

            let att = {};
            try { const r = getStorageItem('attendance_records'); if (r) att = JSON.parse(r); } catch (_) {}
            const fullData = {
                students: newStudents,
                studentProfiles,
                history,
                config,
                attendanceRecords: att,
                treasures,
                storage,
                logs,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts,
                tasks,
                battle,
                battleSnapshots
            };
            if (typeof persistData === 'function') persistData(fullData);

            alert("已修正");
        };

        const handleExportTreasureExcel = () => {
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(treasures), "宝物库存");
            const storageRows = [];
            Object.keys(storage).forEach(sid => {
                const sName = students.find(s => s.id == sid)?.name || sid;
                Object.keys(storage[sid]).forEach(tid => {
                    const tName = treasures.find(t => t.id == tid)?.name || tid;
                    storageRows.push({ "学生": sName, "物品": tName, "数量": storage[sid][tid] });
                });
            });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(storageRows), "学生储物箱");
            XLSX.writeFile(wb, `藏宝阁数据_${getTodayStr()}.xlsx`);
        };

        const handleImportTreasureExcel = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const wb = XLSX.read(evt.target.result, { type: 'array' });
                let msg = "";
                if (wb.SheetNames.includes("宝物库存")) {
                    const data = XLSX.utils.sheet_to_json(wb.Sheets["宝物库存"]);
                    const formatted = data.map((item, idx) => ({
                        ...item, id: item.id || (Date.now()+idx), stock: item.stock || item['库存'], price: item.price||item['价格'], name: item.name||item['名称'], rarity: item.rarity||item['稀有度']
                    }));
                    setTreasures(formatted);
                    msg += "库存已更新 ";
                }
                if (wb.SheetNames.includes("学生储物箱")) {
                    const raw = XLSX.utils.sheet_to_json(wb.Sheets["学生储物箱"]);
                    const newStorage = {};
                    raw.forEach(r => {
                        const s = students.find(x => x.name === r["学生"]);
                        const t = treasures.find(x => x.name === r["物品"]); 
                        if (s && t) {
                            if (!newStorage[s.id]) newStorage[s.id] = {};
                            newStorage[s.id][t.id] = r["数量"];
                        }
                    });
                    setStorage(newStorage);
                    msg += "储物箱已更新";
                }
                alert(msg || "未识别有效Sheet");
            };
            reader.readAsArrayBuffer(file);
            e.target.value = '';
        };

        const handleExportAttendanceExcel = () => {
            const rows = [];
            Object.keys(attendanceRecords).forEach(date => {
                Object.keys(attendanceRecords[date]).forEach(name => {
                    const sessions = attendanceRecords[date][name];
                    const row = { "日期": date, "姓名": name };
                    const scheduleConfig = getScheduleConfig(config);
                    scheduleConfig.forEach(s => {
                        const sid = s.id;
                        const sessName = s.name;
                        const rec = sessions[sid];
                        row[sessName] = rec ? `${rec.status === 'ok' ? '✅' : '❌'}${rec.status==='late'?'(迟)':''} ${rec.checkTime}` : '-';
                    });
                    rows.push(row);
                });
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "考勤记录");
            XLSX.writeFile(wb, `考勤记录_${getTodayStr()}.xlsx`);
        };

        const handleImportAttendanceExcel = (e) => {
             const file = e.target.files[0];
             if (!file) return;
             const reader = new FileReader();
             reader.onload = (evt) => {
                 const wb = XLSX.read(evt.target.result, { type: 'array' });
                 const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                 if(confirm(`解析到 ${json.length} 条考勤记录，确定要【合并】到现有记录吗？`)) {
                     const newRecs = { ...attendanceRecords };
                     json.forEach(row => {
                         const date = row["日期"];
                         const name = row["姓名"];
                         if (!newRecs[date]) newRecs[date] = {};
                         if (!newRecs[date][name]) newRecs[date][name] = {};
                        const scheduleConfig = getScheduleConfig(config);
                        scheduleConfig.forEach(s => {
                            const cName = s.name;
                            const cell = row[cName];
                            if (cell && cell !== '-') {
                                const sid = s.id;
                                 let status = 'ok';
                                 if (cell.includes('❌') || cell.includes('迟')) status = 'late';
                                 newRecs[date][name][sid] = {
                                     status: status,
                                     checkTime: cell.replace(/[✅❌(迟)]/g, '').trim() || '导入记录',
                                     timestamp: Date.now()
                                 };
                             }
                         });
                     });
                     setAttendanceRecords(newRecs);
                     alert("考勤记录已合并导入");
                 }
             };
             reader.readAsArrayBuffer(file);
             e.target.value = '';
        };

        const handleExportQuotesExcel = () => {
            const data = quotes.map(q => ({ "内容": q }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "励志语录");
            XLSX.writeFile(wb, `励志语录_${getTodayStr()}.xlsx`);
        };

        const handleImportQuotesExcel = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const wb = XLSX.read(evt.target.result, { type: 'array' });
                const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                const newQuotes = json.map(row => row["内容"]).filter(q => q);
                if (newQuotes.length > 0 && confirm(`解析到 ${newQuotes.length} 条语录，确定覆盖现有语录吗？`)) {
                    setQuotes(newQuotes);
                    updateSystemConfig(sc => ({ ...sc, quotes: newQuotes }));
                    alert("语录更新成功");
                }
            };
            reader.readAsArrayBuffer(file);
            e.target.value = '';
        };

        const handleExportSystemConfig = () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(systemConfig));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "system_config_" + getTodayStr() + ".json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        };

        const handleImportSystemConfig = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = JSON.parse(evt.target.result);
                    const merged = getSystemConfig({ systemConfig: data || {} });
                    applySystemConfig(merged);
                    if (Array.isArray(merged.treasures)) setTreasures(merged.treasures);
                    alert("系统配置已导入");
                } catch (err) {
                    alert("配置文件格式错误");
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        };

        const handleResetSystemConfig = () => {
            if (!confirm("确定要将系统配置恢复为默认值吗？")) return;
            applySystemConfig(JSON.parse(JSON.stringify(DEFAULT_SYSTEM_CONFIG)));
            setTreasures(DEFAULT_SYSTEM_CONFIG.treasures || []);
            alert("系统配置已重置");
        };

        const handleReset = () => {
            if (confirm("危险操作：确定要清空所有数据吗？此操作不可逆！")) { 
                clearStorage(); 
                location.reload(); 
            }
        };

        const ensureExamArchivesModule = () => {
            if (examArchivesModuleStatus === 'ready' || examArchivesModuleStatus === 'loading') return;
            setExamArchivesModuleStatus('loading');
            loadScriptOnce('exam-archives-module.js')
                .then(() => {
                    if (typeof window.createExamArchivesView === 'function') {
                        getExamArchivesView();
                        setExamArchivesModuleStatus('ready');
                    } else {
                        setExamArchivesModuleStatus('error');
                    }
                })
                .catch(err => {
                    console.error('加载考试档案模块失败:', err);
                    setExamArchivesModuleStatus('error');
                });
        };

        const openExamArchivesManager = () => {
            setShowExamArchivesManager(prev => !prev);
            ensureExamArchivesModule();
        };
        const handleDutyChange = (day, idx, name) => {
            const newDuty = { ...(config.duty || {}) };
            const row = Array.isArray(newDuty[day]) ? [...newDuty[day]] : [];
            row[idx] = name;
            newDuty[day] = row;
            setConfig({ ...config, duty: newDuty });
        };
        const handleCommissionerChange = (roleId, studentId) => {
            setConfig({ ...config, commissioners: { ...(config.commissioners || {}), [roleId]: studentId ? parseInt(studentId) : null } });
        };
        const handlePsychologyCommitteeChange = (index, studentId) => {
            const newPsychology = [...(config.psychologyCommittee || [null, null, null, null])];
            newPsychology[index] = studentId ? parseInt(studentId) : null;
            setConfig({ ...config, psychologyCommittee: newPsychology });
        };

        const persistExamArchiveChanges = ({ battle: nextBattle, examArchives: nextExamArchives, successMessage, failureMessage }) => {
            if (isDirtyRef) isDirtyRef.current = true;
            if (typeof persistDataPatch !== 'function') {
                if (isDirtyRef) isDirtyRef.current = false;
                if (successMessage) alert(successMessage);
                return Promise.resolve();
            }
            return persistDataPatch({
                battle: nextBattle,
                examArchives: nextExamArchives
            }).then(() => {
                if (isDirtyRef) isDirtyRef.current = false;
                if (successMessage) alert(successMessage);
            }).catch(err => {
                if (isDirtyRef) isDirtyRef.current = false;
                console.error('考试档案保存失败:', err);
                alert(failureMessage || "考试档案已更新，但保存失败，请手动刷新确认");
            });
        };

        return h("div", { className: "bg-white p-8 rounded-xl shadow-lg animate-fade-in max-w-4xl mx-auto space-y-8" },
            h("div", { className: "border-b pb-4 flex justify-between items-center" }, 
                h("div", null,
                    h("h2", { className: "text-2xl font-bold text-gray-800" }, "🔧 系统维护中心"), 
                    h("p", { className: "text-gray-500 text-sm mt-1" }, "已获取管理员权限")
                ),
                h("button", { 
                    onClick: () => { clearAdminAuth(); setIsAuthenticated(false); }, 
                    className: "text-sm text-red-500 hover:underline" 
                }, "退出登录")
            ),
            h("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },
                h("div", { className: "border rounded-xl p-4 bg-blue-50 border-blue-100" }, h("h3", { className: "font-bold text-blue-800 mb-3 flex items-center gap-2" }, h(Icon, { name: "star" }), "积分数据"), h("div", { className: "space-y-2" }, h("button", { onClick: handleExportScoreExcel, className: "w-full py-2 bg-white border border-blue-200 text-blue-600 rounded hover:bg-blue-100 text-sm font-medium" }, "导出 Excel"), h("div", { className: "relative w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium text-center cursor-pointer" }, "导入 Excel", h("input", { type: "file", className: "absolute inset-0 opacity-0 cursor-pointer", accept: ".xlsx", onChange: handleImportScoreExcel })), h("button", { onClick: handleRecoverFromHistory, className: "w-full py-2 bg-white border border-blue-200 text-blue-600 rounded hover:bg-blue-100 text-sm font-medium" }, "从历史恢复"), h("button", { onClick: handleFixScore, className: "w-full py-2 bg-white border border-blue-200 text-blue-600 rounded hover:bg-blue-100 text-sm font-medium" }, "手动修正积分"))),
                h("div", { className: "border rounded-xl p-4 bg-green-50 border-green-100" }, h("h3", { className: "font-bold text-green-800 mb-3 flex items-center gap-2" }, h(Icon, { name: "clock" }), "考勤数据"), h("div", { className: "space-y-2" }, h("button", { onClick: handleExportAttendanceExcel, className: "w-full py-2 bg-white border border-green-200 text-green-600 rounded hover:bg-green-100 text-sm font-medium" }, "导出 Excel"), h("div", { className: "relative w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium text-center cursor-pointer" }, "导入 Excel", h("input", { type: "file", className: "absolute inset-0 opacity-0 cursor-pointer", accept: ".xlsx", onChange: handleImportAttendanceExcel })))),
                h("div", { className: "border rounded-xl p-4 bg-purple-50 border-purple-100" }, h("h3", { className: "font-bold text-purple-800 mb-3 flex items-center gap-2" }, h(Icon, { name: "gift" }), "藏宝阁数据"), h("div", { className: "space-y-2" }, h("button", { onClick: handleExportTreasureExcel, className: "w-full py-2 bg-white border border-purple-200 text-purple-600 rounded hover:bg-purple-100 text-sm font-medium" }, "导出 Excel"), h("div", { className: "relative w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm font-medium text-center cursor-pointer" }, "导入 Excel", h("input", { type: "file", className: "absolute inset-0 opacity-0 cursor-pointer", accept: ".xlsx", onChange: handleImportTreasureExcel })))),
                h("div", { className: "border rounded-xl p-4 bg-yellow-50 border-yellow-100" }, h("h3", { className: "font-bold text-yellow-800 mb-3 flex items-center gap-2" }, h(Icon, { name: "flame" }), "励志语录"), h("div", { className: "space-y-2" }, h("button", { onClick: handleExportQuotesExcel, className: "w-full py-2 bg-white border border-yellow-200 text-yellow-600 rounded hover:bg-yellow-100 text-sm font-medium" }, "导出 Excel"), h("div", { className: "relative w-full py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm font-medium text-center cursor-pointer" }, "导入 Excel", h("input", { type: "file", className: "absolute inset-0 opacity-0 cursor-pointer", accept: ".xlsx", onChange: handleImportQuotesExcel }))))
            ),
            h("div", { className: "border-t pt-6 space-y-4" },
                h("div", { className: "border rounded-xl p-4 bg-indigo-50 border-indigo-100" },
                    h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                        h("div", null,
                            h("h3", { className: "font-bold text-indigo-800 mb-1 flex items-center gap-2" }, h(Icon, { name: "fileText" }), "考试档案"),
                            h("p", { className: "text-sm text-indigo-700/80" }, "考试导入、删除和档案查看已从双子星移到这里。模块默认不加载，点开后才按需加载。")
                        ),
                        h("button", {
                            onClick: openExamArchivesManager,
                            className: "px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium"
                        }, showExamArchivesManager ? "收起考试档案" : "打开考试档案")
                    )
                ),
                showExamArchivesManager && (
                    examArchivesModuleStatus === 'ready' && ExamArchivesView
                        ? h(ExamArchivesView, {
                            students,
                            battle,
                            examArchives,
                            setBattle,
                            setExamArchives,
                            persistExamArchives: persistExamArchiveChanges,
                            adminPassword: window.DEFAULT_ADMIN_PASSWORD
                        })
                        : h("div", { className: "border rounded-xl p-6 bg-gray-50 text-center space-y-2" },
                            h("div", { className: "font-bold text-gray-800" }, examArchivesModuleStatus === 'error' ? "考试档案模块加载失败" : "考试档案模块加载中"),
                            h("div", { className: "text-sm text-gray-500" }, examArchivesModuleStatus === 'error' ? "请重试加载考试档案模块。" : "首次打开维护页中的考试档案时会按需加载。"),
                            examArchivesModuleStatus === 'error' && h("button", {
                                onClick: () => {
                                    setExamArchivesModuleStatus('idle');
                                    setTimeout(ensureExamArchivesModule, 0);
                                },
                                className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            }, "重试")
                        )
                )
            ),
            h("div", { className: "border-t pt-6" },
                h("h3", { className: "font-bold text-gray-700 mb-3" }, "岗位与值日维护"),
                h("div", { className: "bg-gray-50 border rounded-lg p-6 space-y-6" },
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm flex items-center gap-2" }, h(Icon, { name: "users" }), "卫生值日设置"),
                        h("div", { className: "space-y-2 text-sm" },
                            Object.keys(config.duty || {}).map(day => h("div", { key: day, className: "flex items-center" },
                                h("span", { className: "w-12 text-gray-500" }, { mon: "周一", tue: "周二", wed: "周三", thu: "周四", fri: "周五" }[day]),
                                (config.duty?.[day] || []).map((val, idx) => h("select", { key: idx, value: val, onChange: e => handleDutyChange(day, idx, e.target.value), className: "ml-2 border rounded p-1 flex-1 bg-white" }, h("option", { value: "" }, "-"), students.filter(s => s.group === 'hygiene').map(s => h("option", { key: s.id, value: s.name }, s.name))))
                            ))
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm flex items-center gap-2" }, h(Icon, { name: "star" }), "纪律专员设置"),
                        h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
                            getCommissionerRoles(config).map(role => h("div", { key: role.id },
                                h("div", { className: "text-xs text-gray-500 mb-1" }, role.name),
                                h("select", { value: config.commissioners?.[role.id] || "", onChange: e => handleCommissionerChange(role.id, e.target.value), className: "w-full border rounded p-2 text-sm bg-white" }, h("option", { value: "" }, "未设置"), students.filter(s => s.group === 'discipline').map(s => h("option", { key: s.id, value: s.id }, s.name)))
                            ))
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm flex items-center gap-2" }, h(Icon, { name: "smile" }), "心理委员设置"),
                        h("div", { className: "space-y-2" },
                            [0, 1, 2, 3].map(idx =>
                                h("div", { key: idx, className: "flex items-center gap-2" },
                                    h("span", { className: "text-xs text-gray-500 w-16" }, `心理委员${idx + 1}`),
                                    h("select", {
                                        value: (config.psychologyCommittee && config.psychologyCommittee[idx]) || "",
                                        onChange: e => handlePsychologyCommitteeChange(idx, e.target.value),
                                        className: "flex-1 border rounded p-2 text-sm bg-white"
                                    },
                                        h("option", { value: "" }, "未设置"),
                                        students.map(s => h("option", { key: s.id, value: s.id }, s.name))
                                    )
                                )
                            ),
                            h("div", { className: "text-xs text-gray-400 mt-2" }, "心理委员每次发工资时额外获得 +1 分")
                        )
                    )
                )
            ),
            h("div", { className: "border-t pt-6" },
                h("h3", { className: "font-bold text-gray-700 mb-3" }, "学生名单维护"),
                h("div", { className: "flex flex-wrap gap-2 mb-4" },
                    h("button", { onClick: handleExportStudentsExcel, className: "px-3 py-2 border border-blue-500 text-blue-600 rounded hover:bg-blue-50 text-sm" }, "导出学生名单"),
                    h("label", { className: "px-3 py-2 border border-emerald-500 text-emerald-600 rounded hover:bg-emerald-50 text-sm cursor-pointer" },
                        "增量导入",
                        h("input", { type: "file", accept: ".xlsx,.xls", onChange: e => handleImportStudentsExcel(e, 'merge'), style: { display: 'none' } })
                    ),
                    h("label", { className: "px-3 py-2 border border-amber-500 text-amber-600 rounded hover:bg-amber-50 text-sm cursor-pointer" },
                        "覆盖导入",
                        h("input", { type: "file", accept: ".xlsx,.xls", onChange: e => handleImportStudentsExcel(e, 'overwrite'), style: { display: 'none' } })
                    ),
                    h("button", { onClick: addStudent, className: "px-3 py-2 border border-green-500 text-green-600 rounded hover:bg-green-50 text-sm" }, "新增学生")
                ),
                h("div", { className: "max-h-96 overflow-y-auto border rounded" },
                    h("table", { className: "w-full text-sm text-left" },
                        h("thead", null,
                            h("tr", { className: "bg-gray-50" },
                                h("th", { className: "p-2" }, "姓名"),
                                h("th", { className: "p-2" }, "性别"),
                                h("th", { className: "p-2" }, "小组"),
                                h("th", { className: "p-2" }, "职位"),
                                h("th", { className: "p-2" }, "宿舍"),
                                h("th", { className: "p-2" }, "操作")
                            )
                        ),
                        h("tbody", null,
                            (Array.isArray(students) ? students : []).map(s => h("tr", { key: s.id, className: "border-t" },
                                h("td", { className: "p-2" }, h("input", { className: "w-full border rounded p-1", value: s.name || "", onChange: e => updateStudent(s.id, { name: e.target.value }) })),
                                h("td", { className: "p-2" }, h("select", { className: "w-full border rounded p-1", value: s.gender || "", onChange: e => updateStudent(s.id, { gender: e.target.value }) }, h("option", { value: "" }, "-"), h("option", { value: "M" }, "男"), h("option", { value: "F" }, "女"))),
                                h("td", { className: "p-2" }, (() => {
                                    const groups = systemConfig.organization.groups || [];
                                    return h("select", { className: "w-full border rounded p-1", value: s.group || "", onChange: e => updateStudent(s.id, { group: e.target.value }) },
                                        h("option", { value: "" }, "-"),
                                        groups.map(g => h("option", { key: g.id, value: g.id }, g.name))
                                    );
                                })()),
                                h("td", { className: "p-2" }, h("select", { className: "w-full border rounded p-1", value: s.role || "member", onChange: e => updateStudent(s.id, { role: e.target.value }) }, h("option", { value: "leader" }, "组长"), h("option", { value: "member" }, "组员"))),
                                h("td", { className: "p-2" }, (() => {
                                    const dorms = systemConfig.organization.dorms || [];
                                    return h("select", { className: "w-full border rounded p-1", value: s.dorm || "", onChange: e => updateStudent(s.id, { dorm: e.target.value }) },
                                        h("option", { value: "" }, "-"),
                                        dorms.map(d => h("option", { key: d.id, value: d.id }, d.name))
                                    );
                                })()),
                                h("td", { className: "p-2" }, h("button", { onClick: () => removeStudent(s.id), className: "px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600" }, "删除"))
                            ))
                        )
                    )
                )
            ),
            window.desktopApi && h("div", { className: "border-t pt-6" },
                h("h3", { className: "font-bold text-gray-700 mb-2" }, "🖥️ 桌面端连接"),
                !desktopConfig ? h("div", { className: "text-gray-400 text-sm" }, "正在加载桌面端配置...") : h("div", { className: "bg-gray-50 border rounded-lg p-4 space-y-4" },
                    h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
                        h("div", null,
                            h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "服务器地址"),
                            h("input", {
                                type: "text",
                                className: "w-full border rounded-lg p-2 text-sm",
                                value: desktopConfig.serverUrl || "",
                                onChange: e => setDesktopConfig({ ...desktopConfig, serverUrl: e.target.value }),
                                placeholder: "http://127.0.0.1:3000"
                            })
                        ),
                        h("div", null,
                            h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "连接偏好"),
                            h("select", {
                                className: "w-full border rounded-lg p-2 text-sm",
                                value: desktopConfig.preferredMode || "auto",
                                onChange: e => setDesktopConfig({ ...desktopConfig, preferredMode: e.target.value })
                            }, [
                                h("option", { value: "auto" }, "自动"),
                                h("option", { value: "online" }, "强制在线"),
                                h("option", { value: "offline" }, "强制离线")
                            ])
                        )
                    ),
                    h("div", { className: "flex flex-wrap gap-2" },
                        h("button", { onClick: handleDesktopPing, disabled: desktopBusy, className: "px-3 py-2 bg-white border rounded text-xs hover:bg-gray-100 disabled:opacity-50" }, "测试连接"),
                        h("button", { onClick: handleDesktopSave, disabled: desktopBusy, className: "px-3 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50" }, "保存并应用"),
                        h("button", { onClick: () => handleDesktopMode('online'), disabled: desktopBusy, className: "px-3 py-2 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50" }, "切换在线"),
                        h("button", { onClick: () => handleDesktopMode('offline'), disabled: desktopBusy, className: "px-3 py-2 bg-gray-700 text-white rounded text-xs hover:bg-gray-800 disabled:opacity-50" }, "切换离线")
                    ),
                    h("div", { className: "text-xs text-gray-500 flex flex-wrap gap-4" },
                        h("span", null, `当前模式：${modeLabel(desktopStatus?.mode)}`),
                        h("span", null, `连接偏好：${modeLabel(desktopConfig.preferredMode)}`),
                        h("span", null, `服务器：${desktopConfig.serverUrl || "未设置"}`)
                    ),
                    desktopPing && h("div", { className: `text-xs font-medium ${desktopPing.ok ? "text-green-600" : "text-red-600"}` }, desktopPing.text)
                )
            ),
            h("div", { className: "border-t pt-6" },
                h("h3", { className: "font-bold text-gray-700 mb-2" }, "❄️ 假期封存"),
                h("p", { className: "text-gray-500 text-sm mb-3" }, "开启后暂停缺勤记录、迟到扣分、缺勤结算、全勤奖等所有自动机制，适用于假期。"),
                h("button", {
                    onClick: () => {
                        const newFrozen = !config.frozen;
                        setConfig(c => ({ ...c, frozen: newFrozen }));
                        
                        if (!newFrozen) {
                            const now = Date.now();
                            const newStudents = students.map(s => ({
                                ...s,
                                lastPenaltyAt: now
                            }));
                            setStudents(newStudents);
                            alert("系统已解封，所有学生的未扣分天数已重置为0天");
                        }
                    },
                    className: `w-full max-w-xs py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${config.frozen ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`
                }, config.frozen ? "✓ 已封存（点击解除）" : "未封存（点击开启）")
            ),
            h("div", { className: "border-t pt-6" },
                h("h3", { className: "font-bold text-gray-700 mb-2" }, "🧪 测试模式"),
                h("p", { className: "text-gray-500 text-sm mb-3" }, "进入后所有操作仅在测试隔离环境中生效，退出后自动还原。"),
                h("div", { className: "flex flex-wrap gap-3 items-center mb-4" },
                    h("button", {
                        onClick: () => testMode ? exitTestMode() : enterTestMode(),
                        className: `px-4 py-2 rounded-lg font-bold text-sm ${testMode ? "bg-red-500 text-white hover:bg-red-600" : "bg-blue-600 text-white hover:bg-blue-700"}`
                    }, testMode ? "退出测试模式" : "进入测试模式"),
                    h("span", { className: `text-xs font-medium ${testMode ? "text-green-600" : "text-gray-400"}` }, testMode ? "已启用" : "未启用")
                ),
                testMode && h("div", { className: "bg-gray-50 border rounded-lg p-4 space-y-4" },
                    h("div", { className: "text-sm text-gray-700" }, `当前模拟时间：${new Date(simTime).toLocaleString()}`),
                    h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
                        h("div", null,
                            h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "设置模拟时间"),
                            h("input", {
                                type: "datetime-local",
                                className: "w-full border rounded-lg p-2 text-sm",
                                value: formatDateTimeLocal(simTime),
                                onChange: (e) => {
                                    const v = e.target.value;
                                    if (!v) return;
                                    const t = new Date(v);
                                    if (!isNaN(t.getTime())) setSimTime(t.getTime());
                                }
                            })
                        ),
                        h("div", null,
                            h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "时间流速"),
                            h("div", { className: "flex gap-2 flex-wrap" },
                                [1, 2, 5, 10, 30, 60].map(s => h("button", {
                                    key: s,
                                    onClick: () => setTimeSpeed(s),
                                    className: `px-3 py-2 rounded-lg text-xs font-bold ${timeSpeed === s ? "bg-blue-600 text-white" : "bg-white border text-gray-700 hover:bg-gray-100"}`
                                }, `${s}x`))
                            )
                        )
                    ),
                    h("div", { className: "flex flex-wrap gap-2" },
                        h("button", { onClick: () => setSimTime(t => t - 60 * 60 * 1000), className: "px-3 py-2 bg-white border rounded text-xs hover:bg-gray-100" }, "后退 1 小时"),
                        h("button", { onClick: () => setSimTime(t => t + 60 * 60 * 1000), className: "px-3 py-2 bg-white border rounded text-xs hover:bg-gray-100" }, "前进 1 小时"),
                        h("button", { onClick: () => setSimTime(t => t - 24 * 60 * 60 * 1000), className: "px-3 py-2 bg-white border rounded text-xs hover:bg-gray-100" }, "后退 1 天"),
                        h("button", { onClick: () => setSimTime(t => t + 24 * 60 * 60 * 1000), className: "px-3 py-2 bg-white border rounded text-xs hover:bg-gray-100" }, "前进 1 天"),
                        h("button", { onClick: () => setSimTime(getNow().getTime()), className: "px-3 py-2 bg-gray-200 rounded text-xs hover:bg-gray-300" }, "重置为当前时间")
                    )
                )
            ),
            h("div", { className: "border-t pt-6" }, h("h3", { className: "font-bold text-gray-700 mb-4" }, "📦 系统全量备份 (JSON)"), h("div", { className: "flex gap-4" }, h("button", { onClick: downloadBackup, className: "flex-1 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 font-bold flex items-center justify-center gap-2" }, h(Icon, { name: "download" }), "下载全量备份"), h("div", { className: "flex-1 relative py-3 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 font-bold flex items-center justify-center gap-2 cursor-pointer" }, h(Icon, { name: "upload" }), "恢复全量备份", h("input", { type: "file", className: "absolute inset-0 opacity-0 cursor-pointer", accept: ".json", onChange: handleImportJSON })))),
            h("div", { className: "border-t pt-6" },
                h("h3", { className: "font-bold text-gray-700 mb-2" }, "🕐 数据快照 (自动 + 手动，最多 10 个)"),
                h("p", { className: "text-gray-500 text-sm mb-3" }, "系统每天 22:30 后自动保存快照；若错过会在下次打开时补生成。也可手动生成。"),
                h("button", { onClick: handleManualSnapshot, className: "mb-3 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-sm font-medium flex items-center gap-2" }, h(Icon, { name: "plus", size: 16 }), "立即生成快照"),
                (() => {
                    const list = getSnapshots().slice().sort((a, b) => b.ts - a.ts);
                    if (list.length === 0) return h("div", { className: "text-gray-400 text-sm py-4" }, "暂无快照");
                    return h("div", { className: "space-y-2" },
                        h("div", { className: "max-h-48 overflow-y-auto border rounded-lg bg-gray-50 p-2 space-y-1" },
                            list.map(s => h("label", { key: s.id, className: "flex items-center gap-2 p-2 rounded hover:bg-white cursor-pointer" },
                                h("input", { type: "radio", name: "snapshot", checked: selectedSnapshotId === s.id, onChange: () => setSelectedSnapshotId(s.id) }),
                                h("span", { className: "text-sm font-medium" }, s.label),
                                h("span", { className: "text-gray-400 text-xs" }, new Date(s.ts).toLocaleString())
                            ))
                        ),
                        h("button", { onClick: handleRestoreSnapshot, disabled: selectedSnapshotId == null, className: "mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium" }, "恢复为选中快照")
                    );
                })()
            ),
            h("div", { className: "border-t pt-6" },
                h("h3", { className: "font-bold text-gray-700 mb-4 flex items-center gap-2" }, h(Icon, { name: "settings" }), "⚙️ 系统配置"),
                h("div", { className: "bg-gray-50 border rounded-lg p-6 space-y-8" },
                    h("div", { className: "flex flex-wrap gap-2" },
                        h("button", { onClick: handleExportSystemConfig, className: "px-3 py-2 bg-white border rounded hover:bg-gray-100 text-sm" }, "导出配置 JSON"),
                        h("div", { className: "relative px-3 py-2 bg-white border rounded hover:bg-gray-100 text-sm cursor-pointer" }, "导入配置 JSON", h("input", { type: "file", className: "absolute inset-0 opacity-0 cursor-pointer", accept: ".json", onChange: handleImportSystemConfig })),
                        h("button", { onClick: handleResetSystemConfig, className: "px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded hover:bg-red-100 text-sm" }, "恢复默认配置")
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "基础设置"),
                        h("div", { className: "space-y-4" },
                            h("div", null,
                                h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "班级名称"),
                                h("input", {
                                    type: "text",
                                    className: "w-full border rounded-lg p-2 text-sm",
                                    value: systemConfig.className || "",
                                    onChange: (e) => updateSystemConfig(sc => ({ ...sc, className: e.target.value })),
                                    placeholder: "请输入班级名称"
                                })
                            ),
                            h("div", null,
                                h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "管理员密码"),
                                h("div", { className: "flex gap-2" },
                                    h("button", {
                                        onClick: () => {
                                            const oldPassInput = prompt("请输入旧密码以验证：");
                                            if (oldPassInput === null) return;
                                            
                                            const currentPass = systemConfig.adminPassword || DEFAULT_SYSTEM_CONFIG.adminPassword;
                                            if (oldPassInput !== currentPass) {
                                                return alert("旧密码验证失败！");
                                            }
                                            
                                            const newPassInput = prompt("验证成功！请输入新密码：");
                                            if (newPassInput === null) return;
                                            if (!newPassInput.trim()) return alert("新密码不能为空！");
                                            
                                            updateSystemConfig(sc => ({ ...sc, adminPassword: newPassInput.trim() }));
                                            alert("密码修改成功，请牢记新密码。");
                                        },
                                        className: "px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm"
                                    }, "🔐 修改管理员密码"),
                                    h("button", {
                                         onClick: () => {
                                             if (confirm(`确定要重置为默认密码吗？（默认密码：${DEFAULT_SYSTEM_CONFIG.adminPassword}）`)) {
                                                 updateSystemConfig(sc => ({ ...sc, adminPassword: DEFAULT_SYSTEM_CONFIG.adminPassword }));
                                                 alert(`已重置为默认密码：${DEFAULT_SYSTEM_CONFIG.adminPassword}`);
                                             }
                                         },
                                         className: "px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                                     }, "重置默认")
                                ),
                                h("p", { className: "text-xs text-gray-500 mt-2" }, "修改密码后，所有受限操作（如修改设置、修正积分等）将使用新密码验证。")
                            ),
                            h("div", null,
                                h("label", { className: "block text-sm font-medium text-gray-700 mb-2" }, "功能开关"),
                                h("div", { className: "space-y-2 bg-gray-50 p-3 rounded-lg" },
                                    h("label", { className: "flex items-center gap-3 cursor-pointer" },
                                        h("input", {
                                            type: "checkbox",
                                            checked: systemConfig.enabledFeatures?.battle ?? true,
                                            onChange: (e) => updateSystemConfig(sc => ({
                                                ...sc,
                                                enabledFeatures: {
                                                    ...(sc.enabledFeatures || {}),
                                                    battle: e.target.checked
                                                }
                                            })),
                                            className: "w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        }),
                                        h("span", { className: "text-sm text-gray-700" }, "启用双子星对战系统"),
                                        h("span", { className: "text-xs text-gray-500" }, "（关闭后导航栏将隐藏此功能）")
                                    )
                                )
                            ),
                            h("div", null,
                                h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "励志语录"),
                                h("div", { className: "space-y-2" },
                                    (systemConfig.quotes || []).map((q, idx) => h("div", { key: idx, className: "flex gap-2" },
                                        h("input", {
                                            className: "flex-1 border rounded-lg p-2 text-sm",
                                            value: q,
                                            onChange: (e) => updateSystemConfig(sc => {
                                                const list = [...(sc.quotes || [])];
                                                list[idx] = e.target.value;
                                                return { ...sc, quotes: list };
                                            })
                                        }),
                                        h("button", { onClick: () => updateSystemConfig(sc => {
                                            const list = [...(sc.quotes || [])];
                                            list.splice(idx, 1);
                                            return { ...sc, quotes: list };
                                        }), className: "px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-xs" }, "删除")
                                    )),
                                    h("button", { onClick: () => updateSystemConfig(sc => ({ ...sc, quotes: [...(sc.quotes || []), ""] })), className: "px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-xs" }, "新增语录")
                                )
                            )
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "考勤设置"),
                        h("div", { className: "space-y-6" },
                            h("div", null,
                                h("div", { className: "flex justify-between items-center mb-2" },
                                    h("span", { className: "text-sm font-medium text-gray-700" }, "时段配置"),
                                    h("button", { onClick: () => updateSystemConfig(sc => {
                                        const list = [...(sc.attendance.schedule || [])];
                                        list.push({ id: `period_${Date.now()}`, name: "新时段", start: "00:00", end: "00:00", lateTime: "00:00" });
                                        return { ...sc, attendance: { ...sc.attendance, schedule: list } };
                                    }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增时段")
                                ),
                                h("div", { className: "space-y-3" },
                                    (systemConfig.attendance.schedule || []).map((p, idx) => h("div", { key: p.id || idx, className: "grid grid-cols-1 md:grid-cols-6 gap-2 bg-white p-3 rounded border" },
                                        h("input", { className: "border rounded p-2 text-sm md:col-span-1", value: p.id || "", onChange: e => updateSystemConfig(sc => {
                                            const list = [...sc.attendance.schedule];
                                            list[idx] = { ...list[idx], id: e.target.value };
                                            return { ...sc, attendance: { ...sc.attendance, schedule: list } };
                                        }), placeholder: "id" }),
                                        h("input", { className: "border rounded p-2 text-sm md:col-span-1", value: p.name || "", onChange: e => updateSystemConfig(sc => {
                                            const list = [...sc.attendance.schedule];
                                            list[idx] = { ...list[idx], name: e.target.value };
                                            return { ...sc, attendance: { ...sc.attendance, schedule: list } };
                                        }), placeholder: "名称" }),
                                        h("input", { type: "time", className: "border rounded p-2 text-sm", value: p.start || "", onChange: e => updateSystemConfig(sc => {
                                            const list = [...sc.attendance.schedule];
                                            list[idx] = { ...list[idx], start: e.target.value };
                                            return { ...sc, attendance: { ...sc.attendance, schedule: list } };
                                        }) }),
                                        h("input", { type: "time", className: "border rounded p-2 text-sm", value: p.end || "", onChange: e => updateSystemConfig(sc => {
                                            const list = [...sc.attendance.schedule];
                                            list[idx] = { ...list[idx], end: e.target.value };
                                            return { ...sc, attendance: { ...sc.attendance, schedule: list } };
                                        }) }),
                                        h("input", { type: "time", className: "border rounded p-2 text-sm", value: p.lateTime || "", onChange: e => updateSystemConfig(sc => {
                                            const list = [...sc.attendance.schedule];
                                            list[idx] = { ...list[idx], lateTime: e.target.value };
                                            return { ...sc, attendance: { ...sc.attendance, schedule: list } };
                                        }) }),
                                        h("button", { onClick: () => updateSystemConfig(sc => {
                                            const list = [...sc.attendance.schedule];
                                            list.splice(idx, 1);
                                            return { ...sc, attendance: { ...sc.attendance, schedule: list } };
                                        }), className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs" }, "删除")
                                    ))
                                )
                            ),
                            h("div", null,
                                h("div", { className: "text-sm font-medium text-gray-700 mb-2" }, "周末规则"),
                                h("div", { className: "space-y-3" },
                                    ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(day => h("div", { key: day, className: "bg-white p-3 rounded border" },
                                        h("div", { className: "text-xs text-gray-500 mb-2" }, { monday:"周一", tuesday:"周二", wednesday:"周三", thursday:"周四", friday:"周五", saturday:"周六", sunday:"周日" }[day]),
                                        h("div", { className: "flex flex-wrap gap-3" },
                                            (systemConfig.attendance.schedule || []).map((p, idx) => {
                                                const rules = systemConfig.attendance.weekendRules[day] || [];
                                                const checked = rules.includes(idx);
                                                return h("label", { key: p.id || idx, className: "flex items-center gap-1 text-xs" },
                                                    h("input", { type: "checkbox", checked, onChange: e => updateSystemConfig(sc => {
                                                        const nextRules = { ...sc.attendance.weekendRules };
                                                        const list = nextRules[day] ? [...nextRules[day]] : [];
                                                        const exists = list.includes(idx);
                                                        if (e.target.checked && !exists) list.push(idx);
                                                        if (!e.target.checked && exists) list.splice(list.indexOf(idx), 1);
                                                        nextRules[day] = list.sort((a, b) => a - b);
                                                        return { ...sc, attendance: { ...sc.attendance, weekendRules: nextRules } };
                                                    }) }),
                                                    h("span", null, p.name || p.id || idx)
                                                );
                                            })
                                        )
                                    ))
                                )
                            ),
                            h("div", null,
                                h("div", { className: "text-sm font-medium text-gray-700 mb-2" }, "周日特殊迟到时间"),
                                h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
                                    (systemConfig.attendance.schedule || []).map((p, idx) => h("div", { key: p.id || idx, className: "flex items-center gap-2 bg-white p-3 rounded border" },
                                        h("span", { className: "text-xs text-gray-500 w-24" }, p.name || p.id || idx),
                                        h("input", { type: "time", className: "border rounded p-2 text-sm flex-1", value: (systemConfig.attendance.sundaySpecialLateTime || {})[p.id] || "", onChange: e => updateSystemConfig(sc => {
                                            const next = { ...(sc.attendance.sundaySpecialLateTime || {}) };
                                            if (e.target.value) next[p.id] = e.target.value;
                                            else delete next[p.id];
                                            return { ...sc, attendance: { ...sc.attendance, sundaySpecialLateTime: next } };
                                        }) }),
                                        h("button", { onClick: () => updateSystemConfig(sc => {
                                            const next = { ...(sc.attendance.sundaySpecialLateTime || {}) };
                                            delete next[p.id];
                                            return { ...sc, attendance: { ...sc.attendance, sundaySpecialLateTime: next } };
                                        }), className: "px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs" }, "清除")
                                    ))
                                )
                            ),
                            h("div", null,
                                h("div", { className: "text-sm font-medium text-gray-700 mb-2" }, "扣分规则"),
                                h("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3" },
                                    h("div", null,
                                        h("label", { className: "block text-xs text-gray-500 mb-1" }, "迟到扣分"),
                                        h("input", { type: "number", className: "w-full border rounded p-2 text-sm", value: systemConfig.attendance.penaltyRules.late, onChange: e => updateSystemConfig(sc => ({ ...sc, attendance: { ...sc.attendance, penaltyRules: { ...sc.attendance.penaltyRules, late: Number(e.target.value) } } })) })
                                    ),
                                    h("div", null,
                                        h("label", { className: "block text-xs text-gray-500 mb-1" }, "缺勤扣分"),
                                        h("input", { type: "number", className: "w-full border rounded p-2 text-sm", value: systemConfig.attendance.penaltyRules.absent, onChange: e => updateSystemConfig(sc => ({ ...sc, attendance: { ...sc.attendance, penaltyRules: { ...sc.attendance.penaltyRules, absent: Number(e.target.value) } } })) })
                                    ),
                                    h("div", null,
                                        h("label", { className: "block text-xs text-gray-500 mb-1" }, "全勤奖"),
                                        h("input", { type: "number", className: "w-full border rounded p-2 text-sm", value: systemConfig.attendance.penaltyRules.perfectAttendance, onChange: e => updateSystemConfig(sc => ({ ...sc, attendance: { ...sc.attendance, penaltyRules: { ...sc.attendance.penaltyRules, perfectAttendance: Number(e.target.value) } } })) })
                                    )
                                )
                            )
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "组织架构"),
                        h("div", { className: "space-y-6" },
                            h("div", null,
                                h("div", { className: "flex justify-between items-center mb-2" },
                                    h("span", { className: "text-sm font-medium text-gray-700" }, "小组管理"),
                                    h("button", { onClick: () => updateSystemConfig(sc => {
                                        const list = [...(sc.organization.groups || [])];
                                        list.push({ id: `group_${Date.now()}`, name: "新小组", color: "bg-gray-100 text-gray-700 border-gray-200" });
                                        return { ...sc, organization: { ...sc.organization, groups: list } };
                                    }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增小组")
                                ),
                                h("div", { className: "space-y-3" },
                                    (systemConfig.organization.groups || []).map((g, idx) => h("div", { key: g.id || idx, className: "grid grid-cols-1 md:grid-cols-4 gap-2 bg-white p-3 rounded border" },
                                        h("input", { className: "border rounded p-2 text-sm", value: g.id || "", onChange: e => updateSystemConfig(sc => {
                                            const list = [...sc.organization.groups];
                                            list[idx] = { ...list[idx], id: e.target.value };
                                            return { ...sc, organization: { ...sc.organization, groups: list } };
                                        }), placeholder: "id" }),
                                        h("input", { className: "border rounded p-2 text-sm", value: g.name || "", onChange: e => updateSystemConfig(sc => {
                                            const list = [...sc.organization.groups];
                                            list[idx] = { ...list[idx], name: e.target.value };
                                            return { ...sc, organization: { ...sc.organization, groups: list } };
                                        }), placeholder: "名称" }),
                                        h("input", { className: "border rounded p-2 text-sm", value: g.color || "", onChange: e => updateSystemConfig(sc => {
                                            const list = [...sc.organization.groups];
                                            list[idx] = { ...list[idx], color: e.target.value };
                                            return { ...sc, organization: { ...sc.organization, groups: list } };
                                        }), placeholder: "颜色样式" }),
                                        h("button", { onClick: () => updateSystemConfig(sc => {
                                            const list = [...sc.organization.groups];
                                            list.splice(idx, 1);
                                            return { ...sc, organization: { ...sc.organization, groups: list } };
                                        }), className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs" }, "删除")
                                    ))
                                )
                            ),
                            h("div", null,
                                h("div", { className: "flex justify-between items-center mb-2" },
                                    h("span", { className: "text-sm font-medium text-gray-700" }, "宿舍管理"),
                                    h("button", { onClick: () => updateSystemConfig(sc => {
                                        const list = [...(sc.organization.dorms || [])];
                                        list.push({ id: `dorm_${Date.now()}`, name: "新宿舍" });
                                        return { ...sc, organization: { ...sc.organization, dorms: list } };
                                    }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增宿舍")
                                ),
                                h("div", { className: "space-y-3" },
                                    (systemConfig.organization.dorms || []).map((d, idx) => h("div", { key: d.id || idx, className: "grid grid-cols-1 md:grid-cols-3 gap-2 bg-white p-3 rounded border" },
                                        h("input", { className: "border rounded p-2 text-sm", value: d.id || "", onChange: e => updateSystemConfig(sc => {
                                            const list = [...sc.organization.dorms];
                                            list[idx] = { ...list[idx], id: e.target.value };
                                            return { ...sc, organization: { ...sc.organization, dorms: list } };
                                        }), placeholder: "id" }),
                                        h("input", { className: "border rounded p-2 text-sm", value: d.name || "", onChange: e => updateSystemConfig(sc => {
                                            const list = [...sc.organization.dorms];
                                            list[idx] = { ...list[idx], name: e.target.value };
                                            return { ...sc, organization: { ...sc.organization, dorms: list } };
                                        }), placeholder: "名称" }),
                                        h("button", { onClick: () => updateSystemConfig(sc => {
                                            const list = [...sc.organization.dorms];
                                            list.splice(idx, 1);
                                            return { ...sc, organization: { ...sc.organization, dorms: list } };
                                        }), className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs" }, "删除")
                                    ))
                                )
                            ),
                            h("div", null,
                                h("div", { className: "flex justify-between items-center mb-2" },
                                    h("span", { className: "text-sm font-medium text-gray-700" }, "专员角色"),
                                    h("button", { onClick: () => updateSystemConfig(sc => {
                                        const list = [...(sc.organization.commissionerRoles || [])];
                                        list.push({ id: `role_${Date.now()}`, name: "新角色" });
                                        return { ...sc, organization: { ...sc.organization, commissionerRoles: list } };
                                    }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增角色")
                                ),
                                h("div", { className: "space-y-3" },
                                    (systemConfig.organization.commissionerRoles || []).map((r, idx) => h("div", { key: r.id || idx, className: "grid grid-cols-1 md:grid-cols-3 gap-2 bg-white p-3 rounded border" },
                                        h("input", { className: "border rounded p-2 text-sm", value: r.id || "", onChange: e => updateSystemConfig(sc => {
                                            const list = [...sc.organization.commissionerRoles];
                                            list[idx] = { ...list[idx], id: e.target.value };
                                            return { ...sc, organization: { ...sc.organization, commissionerRoles: list } };
                                        }), placeholder: "id" }),
                                        h("input", { className: "border rounded p-2 text-sm", value: r.name || "", onChange: e => updateSystemConfig(sc => {
                                            const list = [...sc.organization.commissionerRoles];
                                            list[idx] = { ...list[idx], name: e.target.value };
                                            return { ...sc, organization: { ...sc.organization, commissionerRoles: list } };
                                        }), placeholder: "名称" }),
                                        h("button", { onClick: () => updateSystemConfig(sc => {
                                            const list = [...sc.organization.commissionerRoles];
                                            list.splice(idx, 1);
                                            return { ...sc, organization: { ...sc.organization, commissionerRoles: list } };
                                        }), className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs" }, "删除")
                                    ))
                                )
                            ),
                            h("div", null,
                                h("div", { className: "flex justify-between items-center mb-2" },
                                    h("span", { className: "text-sm font-medium text-gray-700" }, "班级自定义角色"),
                                    h("button", { onClick: () => updateSystemConfig(sc => {
                                        const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                        list.push({ id: `custom_role_${Date.now()}`, name: "新职务", dailyWage: 2, studentId: null });
                                        return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                    }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增职务")
                                ),
                                h("p", { className: "text-xs text-gray-500 mb-3" }, "可自由设置班级职务名称、每日工资，并为每个职务指定任职学生。支持从旧的学生会专员职位自动兼容迁移。"),
                                h("div", { className: "space-y-3" },
                                    getCustomRoles(config).length === 0
                                        ? h("div", { className: "bg-white p-3 rounded border text-sm text-gray-400" }, "暂无班级自定义角色")
                                        : getCustomRoles(config).map((role, idx) => h("div", { key: role.id || idx, className: "grid grid-cols-1 md:grid-cols-5 gap-2 bg-white p-3 rounded border" },
                                            h("input", { className: "border rounded p-2 text-sm", value: role.id || "", onChange: e => updateSystemConfig(sc => {
                                                const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                list[idx] = { ...list[idx], id: e.target.value };
                                                return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                            }), placeholder: "id" }),
                                            h("input", { className: "border rounded p-2 text-sm", value: role.name || "", onChange: e => updateSystemConfig(sc => {
                                                const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                list[idx] = { ...list[idx], name: e.target.value };
                                                return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                            }), placeholder: "职务名称" }),
                                            h("input", { type: "number", className: "border rounded p-2 text-sm", value: role.dailyWage ?? 0, onChange: e => updateSystemConfig(sc => {
                                                const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                list[idx] = { ...list[idx], dailyWage: Number(e.target.value) };
                                                return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                            }), placeholder: "每日工资" }),
                                            h("select", { className: "border rounded p-2 text-sm", value: role.studentId || "", onChange: e => updateSystemConfig(sc => {
                                                const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                list[idx] = { ...list[idx], studentId: e.target.value ? Number(e.target.value) : null };
                                                return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                            }) },
                                                h("option", { value: "" }, "未设置"),
                                                (students || []).map(student => h("option", { key: student.id, value: student.id }, student.name))
                                            ),
                                            h("button", { onClick: () => updateSystemConfig(sc => {
                                                const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                list.splice(idx, 1);
                                                return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                            }), className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs" }, "删除")
                                        ))
                                )
                            )
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "学科配置"),
                        h("p", { className: "text-xs text-gray-500 mb-3" }, "配置班级开设的学科，用于作业登记功能。每个学科可设置1-2名课代表。"),
                        h("div", { className: "flex justify-between items-center mb-2" },
                            h("span", { className: "text-sm font-medium text-gray-700" }, "学科列表"),
                            h("button", { onClick: () => updateSystemConfig(sc => {
                                const list = [...(sc.subjects || [])];
                                list.push({ id: `subject_${Date.now()}`, name: "新学科", representatives: [] });
                                return { ...sc, subjects: list };
                            }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增学科")
                        ),
                        h("div", { className: "space-y-3" },
                            (systemConfig.subjects || []).map((s, idx) => h("div", { key: s.id || idx, className: "bg-white p-3 rounded border space-y-2" },
                                h("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2" },
                                    h("input", { className: "border rounded p-2 text-sm", value: s.id || "", onChange: e => updateSystemConfig(sc => {
                                        const list = [...sc.subjects];
                                        list[idx] = { ...list[idx], id: e.target.value };
                                        return { ...sc, subjects: list };
                                    }), placeholder: "id" }),
                                    h("input", { className: "border rounded p-2 text-sm", value: s.name || "", onChange: e => updateSystemConfig(sc => {
                                        const list = [...sc.subjects];
                                        list[idx] = { ...list[idx], name: e.target.value };
                                        return { ...sc, subjects: list };
                                    }), placeholder: "学科名称" }),
                                    h("button", { onClick: () => updateSystemConfig(sc => {
                                        const list = [...sc.subjects];
                                        list.splice(idx, 1);
                                        return { ...sc, subjects: list };
                                    }), className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs" }, "删除学科")
                                ),
                                h("div", { className: "border-t pt-2" },
                                    h("div", { className: "text-xs font-medium text-gray-600 mb-2" }, "课代表"),
                                    h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-2" },
                                        [0, 1].map(pos => {
                                            const currentRepId = (s.representatives || [])[pos];
                                            const currentStudent = (students || []).find(stu => stu.id === currentRepId);
                                            return h("div", { key: pos, className: "flex items-center gap-2" },
                                                h("span", { className: "text-xs text-gray-500 w-16" }, `课代表${pos + 1}`),
                                                h("select", {
                                                    className: "flex-1 border rounded p-2 text-sm",
                                                    value: currentRepId || "",
                                                    onChange: e => updateSystemConfig(sc => {
                                                        const list = [...sc.subjects];
                                                        const reps = [...(list[idx].representatives || [])];
                                                        const selectedId = e.target.value ? (students.find(stu => String(stu.id) === String(e.target.value))?.id || e.target.value) : null;
                                                        reps[pos] = selectedId;
                                                        list[idx] = { ...list[idx], representatives: reps.filter(r => r) };
                                                        return { ...sc, subjects: list };
                                                    })
                                                },
                                                    h("option", { value: "" }, "- 不设置 -"),
                                                    (students || []).map(student => h("option", { 
                                                        key: student.id, 
                                                        value: student.id,
                                                        disabled: pos === 0 ? (s.representatives || [])[1] === student.id : (s.representatives || [])[0] === student.id
                                                    }, student.name))
                                                )
                                            );
                                        })
                                    )
                                )
                            ))
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "积分设置"),
                        h("div", { className: "bg-white border rounded-lg p-4 mb-4 space-y-4" },
                            h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
                                h("div", null,
                                    h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "每日工资基础分"),
                                    h("input", {
                                        type: "number",
                                        className: "w-full border rounded-lg p-2 text-sm",
                                        value: systemConfig.points.dailyWageAmount ?? 5,
                                        onChange: e => updateSystemConfig(sc => ({
                                            ...sc,
                                            points: {
                                                ...sc.points,
                                                dailyWageAmount: Number(e.target.value)
                                            }
                                        }))
                                    }),
                                    h("p", { className: "text-xs text-gray-500 mt-1" }, "普通成员按此分值发放，组长固定额外 +1 分。")
                                ),
                                h("div", null,
                                    h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "发放工资的小组"),
                                    h("div", { className: "space-y-2 border rounded-lg p-3 bg-gray-50" },
                                        (systemConfig.organization.groups || []).map(group => {
                                            const selectedGroups = Array.isArray(systemConfig.points.dailyWageGroups) ? systemConfig.points.dailyWageGroups : [];
                                            const checked = selectedGroups.includes(group.id);
                                            return h("label", { key: group.id, className: "flex items-center gap-2 text-sm text-gray-700" },
                                                h("input", {
                                                    type: "checkbox",
                                                    checked,
                                                    onChange: e => updateSystemConfig(sc => {
                                                        const current = Array.isArray(sc.points.dailyWageGroups) ? sc.points.dailyWageGroups : [];
                                                        const next = e.target.checked
                                                            ? [...new Set([...current, group.id])]
                                                            : current.filter(id => id !== group.id);
                                                        return {
                                                            ...sc,
                                                            points: {
                                                                ...sc.points,
                                                                dailyWageGroups: next
                                                            }
                                                        };
                                                    })
                                                }),
                                                h("span", null, group.name || group.id)
                                            );
                                        })
                                    ),
                                    h("p", { className: "text-xs text-gray-500 mt-1" }, "“一键工资”只会给这里勾选的小组成员发放工资。")
                                )
                            )
                        ),
                        h("div", { className: "flex justify-between items-center mb-2" },
                            h("span", { className: "text-sm font-medium text-gray-700" }, "积分理由预设"),
                            h("button", { onClick: () => updateSystemConfig(sc => {
                                const list = [...(sc.points.reasons || [])];
                                list.push({ name: "新理由", val: 0, type: "bonus", scene: DEFAULT_POINT_SCENE, category: DEFAULT_POINT_CATEGORY });
                                return { ...sc, points: { ...sc.points, reasons: list } };
                            }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增理由")
                        ),
                        h("div", { className: "space-y-3" },
                            (systemConfig.points.reasons || []).map((r, idx) => h("div", { key: idx, className: "grid grid-cols-1 md:grid-cols-8 gap-2 bg-white p-3 rounded border" },
                                h("input", { className: "border rounded p-2 text-sm md:col-span-2", value: r.name || "", onChange: e => updateSystemConfig(sc => {
                                    const list = [...sc.points.reasons];
                                    list[idx] = { ...list[idx], name: e.target.value };
                                    return { ...sc, points: { ...sc.points, reasons: list } };
                                }), placeholder: "名称" }),
                                h("input", { type: "number", className: "border rounded p-2 text-sm", value: r.val ?? 0, onChange: e => updateSystemConfig(sc => {
                                    const list = [...sc.points.reasons];
                                    list[idx] = { ...list[idx], val: Number(e.target.value) };
                                    return { ...sc, points: { ...sc.points, reasons: list } };
                                }) }),
                                h("select", { className: "border rounded p-2 text-sm", value: r.type || "bonus", onChange: e => updateSystemConfig(sc => {
                                    const list = [...sc.points.reasons];
                                    list[idx] = { ...list[idx], type: e.target.value };
                                    return { ...sc, points: { ...sc.points, reasons: list } };
                                }) }, h("option", { value: "bonus" }, "奖励"), h("option", { value: "penalty" }, "惩罚"), h("option", { value: "spending" }, "消费")),
                                h("select", { className: "border rounded p-2 text-sm", value: normalizePointScene(r.scene), onChange: e => updateSystemConfig(sc => {
                                    const list = [...sc.points.reasons];
                                    list[idx] = { ...list[idx], scene: e.target.value };
                                    return { ...sc, points: { ...sc.points, reasons: list } };
                                }) }, POINT_SCENES.map(s => h("option", { key: s, value: s }, s))),
                                h("select", { className: "border rounded p-2 text-sm", value: normalizePointCategory(r.category), onChange: e => updateSystemConfig(sc => {
                                    const list = [...sc.points.reasons];
                                    list[idx] = { ...list[idx], category: e.target.value };
                                    return { ...sc, points: { ...sc.points, reasons: list } };
                                }) }, POINT_CATEGORIES.map(c => h("option", { key: c, value: c }, c))),
                                h("input", { className: "border rounded p-2 text-sm", value: r.note || "", onChange: e => updateSystemConfig(sc => {
                                    const list = [...sc.points.reasons];
                                    list[idx] = { ...list[idx], note: e.target.value };
                                    return { ...sc, points: { ...sc.points, reasons: list } };
                                }), placeholder: "备注" }),
                                h("div", { className: "flex items-center gap-2 text-xs" },
                                    h("label", { className: "flex items-center gap-1" }, h("input", { type: "checkbox", checked: !!r.editable, onChange: e => updateSystemConfig(sc => {
                                        const list = [...sc.points.reasons];
                                        list[idx] = { ...list[idx], editable: e.target.checked };
                                        return { ...sc, points: { ...sc.points, reasons: list } };
                                    }) }), "可编辑"),
                                    h("label", { className: "flex items-center gap-1" }, h("input", { type: "checkbox", checked: !!r.isMulti, onChange: e => updateSystemConfig(sc => {
                                        const list = [...sc.points.reasons];
                                        list[idx] = { ...list[idx], isMulti: e.target.checked };
                                        return { ...sc, points: { ...sc.points, reasons: list } };
                                    }) }), "倍率")
                                ),
                                h("div", { className: "flex gap-2 items-center" },
                                    h("input", { type: "number", className: "border rounded p-2 text-sm w-24", value: r.factor ?? 1, onChange: e => updateSystemConfig(sc => {
                                        const list = [...sc.points.reasons];
                                        list[idx] = { ...list[idx], factor: Number(e.target.value) };
                                        return { ...sc, points: { ...sc.points, reasons: list } };
                                    }) }),
                                    h("button", { onClick: () => updateSystemConfig(sc => {
                                        const list = [...sc.points.reasons];
                                        list.splice(idx, 1);
                                        return { ...sc, points: { ...sc.points, reasons: list } };
                                    }), className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs" }, "删除")
                                )
                            ))
                        )
                    ),
                    h("div", { className: "bg-gray-50 border rounded-lg p-4 mt-4 space-y-3" },
                        h("div", { className: "flex flex-wrap items-center justify-between gap-3" },
                            h("div", null,
                                h("div", { className: "font-bold text-gray-700 text-sm" }, "积分记录属性维护"),
                                h("div", { className: "text-xs text-gray-500 mt-1" }, `共 ${filteredHistoryRecords.length} 条，当前展示 ${visibleHistoryRecords.length} 条`)
                            ),
                            h("div", { className: "flex flex-wrap gap-2" },
                                h("button", { onClick: selectFilteredRecords, className: "px-3 py-1 bg-white border rounded text-xs hover:bg-gray-100" }, "全选筛选"),
                                h("button", { onClick: clearRecordSelection, className: "px-3 py-1 bg-white border rounded text-xs hover:bg-gray-100" }, "清空选择"),
                                h("button", { onClick: () => setShowPendingOnly(v => !v), className: `px-3 py-1 border rounded text-xs ${showPendingOnly ? 'bg-amber-500 text-white border-amber-500' : 'bg-white hover:bg-gray-100'}` }, "仅显示待定类别记录"),
                                h("button", { onClick: applyRecordAttributes, className: "px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700" }, "应用到已选"),
                                h("button", { onClick: deleteSelectedRecords, className: "px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600" }, "删除已选")
                            )
                        ),
                        h("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2" },
                            h("input", { className: "border rounded p-2 text-sm", value: recordSearch, onChange: e => setRecordSearch(e.target.value), placeholder: "检索学生/理由/场景/类别" }),
                            h("select", { className: "border rounded p-2 text-sm", value: recordScene, onChange: e => setRecordScene(e.target.value) },
                                POINT_SCENES.map(s => h("option", { key: s, value: s }, s))
                            ),
                            h("select", { className: "border rounded p-2 text-sm", value: recordCategory, onChange: e => setRecordCategory(e.target.value) },
                                POINT_CATEGORIES.map(c => h("option", { key: c, value: c }, c))
                            )
                        ),
                        h("div", { className: "max-h-80 overflow-y-auto border rounded bg-white" },
                            h("table", { className: "w-full text-xs text-left" },
                                h("thead", { className: "bg-gray-50 sticky top-0" },
                                    h("tr", null,
                                        h("th", { className: "p-2 w-10" }, ""),
                                        h("th", { className: "p-2" }, "时间"),
                                        h("th", { className: "p-2" }, "学生"),
                                        h("th", { className: "p-2" }, "事项"),
                                        h("th", { className: "p-2" }, "场景"),
                                        h("th", { className: "p-2" }, "类别"),
                                        h("th", { className: "p-2 text-right" }, "变动")
                                    )
                                ),
                                h("tbody", { className: "divide-y" },
                                    visibleHistoryRecords.length === 0 ? h("tr", null, h("td", { colSpan: 7, className: "p-4 text-center text-gray-400" }, "暂无匹配记录")) :
                                    visibleHistoryRecords.map(item => h("tr", { key: item.id, className: "hover:bg-gray-50" },
                                        h("td", { className: "p-2" },
                                            h("input", { type: "checkbox", checked: recordSelection.has(item.id), onChange: () => toggleRecordSelection(item.id) })
                                        ),
                                        h("td", { className: "p-2 text-gray-400" }, new Date(item.ts).toLocaleString()),
                                        h("td", { className: "p-2 font-medium" }, item.studentName),
                                        h("td", { className: "p-2 text-gray-600" }, item.reason),
                                        h("td", { className: "p-2" }, normalizePointScene(item.scene)),
                                        h("td", { className: "p-2" }, normalizePointCategory(item.category)),
                                        h("td", { className: `p-2 text-right font-bold ${item.val > 0 ? 'text-green-600' : 'text-red-500'}` }, item.val > 0 ? `+${item.val}` : item.val)
                                    ))
                                )
                            )
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "藏宝阁设置"),
                        h("div", { className: "flex justify-between items-center mb-2" },
                            h("span", { className: "text-sm font-medium text-gray-700" }, "商品管理"),
                            h("button", { onClick: () => {
                                const list = [...(systemConfig.treasures || [])];
                                list.push({ id: Date.now(), name: "新宝物", rarity: "N", price: 0, stock: 0, desc: "", ladderPrices: [], dailyLimit: 0 });
                                updateSystemConfig(sc => ({ ...sc, treasures: list }));
                                setTreasures(list);
                            }, className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增商品")
                        ),
                        h("div", { className: "space-y-3" },
                            (systemConfig.treasures || []).map((t, idx) => h("div", { key: t.id || idx, className: "grid grid-cols-1 md:grid-cols-6 gap-2 bg-white p-3 rounded border" },
                                h("input", { className: "border rounded p-2 text-sm", value: t.name || "", onChange: e => {
                                    const list = [...systemConfig.treasures];
                                    list[idx] = { ...list[idx], name: e.target.value };
                                    updateSystemConfig(sc => ({ ...sc, treasures: list }));
                                    setTreasures(list);
                                }, placeholder: "名称" }),
                                h("input", { className: "border rounded p-2 text-sm", value: t.rarity || "", onChange: e => {
                                    const list = [...systemConfig.treasures];
                                    list[idx] = { ...list[idx], rarity: e.target.value };
                                    updateSystemConfig(sc => ({ ...sc, treasures: list }));
                                    setTreasures(list);
                                }, placeholder: "稀有度" }),
                                h("input", { type: "number", className: "border rounded p-2 text-sm", value: t.price ?? 0, onChange: e => {
                                    const list = [...systemConfig.treasures];
                                    list[idx] = { ...list[idx], price: Number(e.target.value) };
                                    updateSystemConfig(sc => ({ ...sc, treasures: list }));
                                    setTreasures(list);
                                } }),
                                h("input", { type: "number", className: "border rounded p-2 text-sm", value: t.stock ?? 0, onChange: e => {
                                    const list = [...systemConfig.treasures];
                                    list[idx] = { ...list[idx], stock: Number(e.target.value) };
                                    updateSystemConfig(sc => ({ ...sc, treasures: list }));
                                    setTreasures(list);
                                } }),
                                h("input", { className: "border rounded p-2 text-sm", value: t.desc || "", onChange: e => {
                                    const list = [...systemConfig.treasures];
                                    list[idx] = { ...list[idx], desc: e.target.value };
                                    updateSystemConfig(sc => ({ ...sc, treasures: list }));
                                    setTreasures(list);
                                }, placeholder: "描述" }),
                                h("button", { onClick: () => {
                                    const list = [...systemConfig.treasures];
                                    list.splice(idx, 1);
                                    updateSystemConfig(sc => ({ ...sc, treasures: list }));
                                    setTreasures(list);
                                }, className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs" }, "删除"),
                                h("input", { className: "border rounded p-2 text-sm md:col-span-3", value: (t.ladderPrices || []).join(','), onChange: e => {
                                    const list = [...systemConfig.treasures];
                                    const vals = e.target.value.split(',').map(v => v.trim()).filter(v => v !== "").map(Number).filter(v => !isNaN(v));
                                    list[idx] = { ...list[idx], ladderPrices: vals };
                                    updateSystemConfig(sc => ({ ...sc, treasures: list }));
                                    setTreasures(list);
                                }, placeholder: "阶梯价格(逗号分隔)" }),
                                h("input", { type: "number", className: "border rounded p-2 text-sm", value: t.dailyLimit ?? 0, onChange: e => {
                                    const list = [...systemConfig.treasures];
                                    list[idx] = { ...list[idx], dailyLimit: Number(e.target.value) };
                                    updateSystemConfig(sc => ({ ...sc, treasures: list }));
                                    setTreasures(list);
                                }, placeholder: "每日限额" })
                            ))
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "倒数日设置"),
                        h("div", { className: "flex flex-col md:flex-row gap-2 mb-3" },
                            h("input", { className: "border rounded p-2 text-sm flex-1", value: countdownName, onChange: e => setCountdownName(e.target.value), placeholder: "事件名称" }),
                            h("input", { type: "date", className: "border rounded p-2 text-sm", value: countdownDate, onChange: e => setCountdownDate(e.target.value) }),
                            h("button", { onClick: addCountdownEvent, className: "px-3 py-2 bg-blue-600 text-white rounded text-sm" }, "新增")
                        ),
                        h("div", { className: "space-y-2" },
                            (Array.isArray(config.countdownEvents) ? config.countdownEvents : []).map(e => h("div", { key: e.id || `${e.name}-${e.date}`, className: "flex items-center gap-2 bg-white p-2 rounded border text-sm" },
                                h("div", { className: "flex-1" }, `${e.name} · ${e.date}`),
                                h("button", { onClick: () => removeCountdownEvent(e.id), className: "px-2 py-1 text-xs bg-red-50 text-red-600 rounded" }, "删除")
                            ))
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "简报生成"),
                        h("div", { className: "flex flex-wrap gap-2 mb-3" },
                            h("button", { onClick: () => { const r = getReportRange(7); setReportStart(r.start); setReportEnd(r.end); }, className: "px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded" }, "近7天"),
                            h("button", { onClick: () => { const r = getReportRange(30); setReportStart(r.start); setReportEnd(r.end); }, className: "px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded" }, "近30天")
                        ),
                        h("div", { className: "flex flex-col md:flex-row gap-2" },
                            h("input", { type: "date", className: "border rounded p-2 text-sm", value: reportStart, onChange: e => setReportStart(e.target.value) }),
                            h("input", { type: "date", className: "border rounded p-2 text-sm", value: reportEnd, onChange: e => setReportEnd(e.target.value) }),
                            h("button", { onClick: handleGenerateBrief, className: "px-3 py-2 bg-emerald-600 text-white rounded text-sm" }, "生成简报")
                        )
                    ),
                    h("div", { className: "border-t pt-4" },
                        h("button", {
                            onClick: () => {
                                const fullData = {
                                    students,
                                    history,
                                    config,
                                    attendanceRecords,
                                    treasures,
                                    storage,
                                    logs,
                                    quotes,
                                    messages,
                                    teacherMessages,
                                    redemptionHistory,
                                    dailyRedemptionCounts,
                                    dailyUsageCounts,
                                    tasks,
                                    battle
                                };
                                if (typeof persistData === 'function') persistData(fullData);
                                alert("配置已保存！");
                            },
                            className: "w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                        }, "💾 保存配置")
                    )
                )
            ),
            h("div", { className: "border-t pt-6 text-center" }, h("button", { onClick: handleReset, className: "text-red-500 text-sm hover:underline hover:bg-red-50 px-4 py-2 rounded" }, "危险区域：清空重置所有数据"))
        );
    };

    const BATTLE_INITIAL_POINTS = 50;
    const BATTLE_MAX_STAKE = 50;

    const battleGetTier = (rank) => {
        if (rank <= 8) return { k: 1.0, label: "T1" };
        if (rank <= 22) return { k: 1.2, label: "T2" };
        return { k: 1.5, label: "T3" };
    };

    const battleGetSafeThreshold = (gradeRank) => {
        if (gradeRank <= 50) return 1;
        if (gradeRank <= 150) return 10;
        if (gradeRank <= 400) return 30;
        if (gradeRank <= 600) return 60;
        return 100;
    };

    const battleCalcCP = (oldClassRank, oldGradeRank, newClassR, newGradeR, totalStudents) => {
        const baseClassRank = Number(oldClassRank) || totalStudents;
        const abs = (totalStudents + 1 - newClassR) * 1.5;
        let delta = baseClassRank - newClassR;
        if (newClassR <= 5 && delta >= 0) {
            if (newClassR === 1) delta = Math.max(delta, 5);
            else if (newClassR <= 3) delta = Math.max(delta, 3);
            else delta = Math.max(delta, 2);
        }
        const prog = delta * 5;
        const total = Math.max(10, abs + prog);
        const baseGradeRank = Number(oldGradeRank) || newGradeR;
        const gradeImp = baseGradeRank - newGradeR;
        const safe = gradeImp >= battleGetSafeThreshold(baseGradeRank);
        return { total, safe, gradeImp };
    };

    const battleParseRank = (val) => {
        if (val === undefined || val === null || val === '') return NaN;
        if (typeof val === 'number') return val;
        const match = String(val).match(/(\d+)/);
        return match ? parseInt(match[0]) : NaN;
    };

    const battleNormalize = (battle) => {
        const b = battle || {};
        return {
            version: Number(b.version) || 1,
            teams: Array.isArray(b.teams) ? b.teams : [],
            squads: Array.isArray(b.squads) ? b.squads : [],
            battles: Array.isArray(b.battles) ? b.battles : [],
            logs: Array.isArray(b.logs) ? b.logs : [],
            history: Array.isArray(b.history) ? b.history : [],
            settlements: Array.isArray(b.settlements) ? b.settlements : [],
            season: Number(b.season) || 1,
            rules: b.rules || {},
            teamBaseExamId: b.teamBaseExamId || '',
            settleExamId: b.settleExamId || ''
        };
    };

    const battleInitTeams = (students) => {
        const list = Array.isArray(students) ? students : [];
        const teamCount = Math.max(1, Math.ceil(list.length / 2));
        return new Array(teamCount).fill(0).map((_, idx) => {
            const s1 = list[idx * 2];
            const s2 = list[idx * 2 + 1];
            return {
                id: `t${idx + 1}`,
                name: `双子星第${idx + 1}组`,
                points: BATTLE_INITIAL_POINTS,
                memberIds: [s1 ? s1.id : '', s2 ? s2.id : '']
            };
        });
    };

    const battleInitSquads = (teams) => {
        const list = Array.isArray(teams) ? teams : [];
        const squadCount = Math.ceil(list.length / 2);
        return new Array(squadCount).fill(0).map((_, idx) => {
            const t1 = list[idx * 2];
            const t2 = list[idx * 2 + 1];
            return {
                id: `sq${idx + 1}`,
                name: `共鸣${idx + 1}`,
                teamIds: [t1 ? t1.id : '', t2 ? t2.id : '']
            };
        });
    };

    const battleBuildSettlementPointUpdates = (teams, results) => {
        if (!Array.isArray(teams) || !results || !Array.isArray(results.tRes)) return [];
        const updates = [];
        results.tRes.forEach(r => {
            const t = teams.find(tm => tm.id === r.id);
            if (!t) return;
            const members = (t.memberIds || []).filter(Boolean);
            if (members.length === 0) return;
            const delta = Number(r.newPts) - Number(r.currentPts);
            if (Math.abs(delta) < 0.01) return;
            const per = delta / members.length;
            members.forEach(id => updates.push({
                id,
                val: per,
                reason: `双子星结算-${t.name}`,
                type: per >= 0 ? 'bonus' : 'penalty',
                scene: "班级",
                category: "学业"
            }));
        });
        return updates;
    };

    // --- 核心 App ---
    var App = function() {
        // ... (Existing state from previous version)
        const [activeTab, setActiveTab] = useState('dashboard');
        const [students, setStudents] = useState([]);
        const [studentProfiles, setStudentProfiles] = useState(() => buildNormalizedStudentProfiles());
        const [history, setHistory] = useState([]);
        const [attendanceRecords, setAttendanceRecords] = useState({});
        const [treasures, setTreasures] = useState([]);
        const [storage, setStorage] = useState({});
        const [logs, setLogs] = useState([]);
        const [battle, setBattle] = useState({ version: 1, teams: [], squads: [], battles: [], logs: [], history: [], settlements: [], season: 1, rules: {}, teamBaseExamId: '', settleExamId: '' });
        const [examArchives, setExamArchives] = useState(() => normalizeExamArchives());
        const [battleSnapshots, setBattleSnapshots] = useState(() => normalizeBattleSnapshots());
        // NEW: Quotes state
        const [quotes, setQuotes] = useState([]);
        const [messages, setMessages] = useState([]); // Add messages state
        const [teacherMessages, setTeacherMessages] = useState([]); // Add teacher messages state
        // NEW: Treasure advanced states
        const [redemptionHistory, setRedemptionHistory] = useState({});
        const [dailyRedemptionCounts, setDailyRedemptionCounts] = useState({});
        const [dailyUsageCounts, setDailyUsageCounts] = useState({});
        // NEW: Tasks state
        const [tasks, setTasks] = useState([]);
        const [profileModuleStatus, setProfileModuleStatus] = useState(typeof window.createProfileView === 'function' ? 'ready' : 'idle');
        const [tasksModuleStatus, setTasksModuleStatus] = useState(typeof window.createTasksView === 'function' ? 'ready' : 'idle');
        const [battleModuleStatus, setBattleModuleStatus] = useState(typeof window.createBattleView === 'function' ? 'ready' : 'idle');

        const displayStudents = (Array.isArray(students) && students.length > 0) ? students : GUEST_ROSTER;

        const [testMode, setTestMode] = useState(false);
        const [simTime, setSimTime] = useState(Date.now());
        const [timeSpeed, setTimeSpeed] = useState(1);
        const testSnapshotRef = useRef(null);

        // NEW: Auto-refresh state
        const [autoRefresh, setAutoRefresh] = useState(false);
        const [syncStatus, setSyncStatus] = useState('idle'); // idle, success, error, saved, unsaved
            
        const [config, setConfig] = useState({
            duty: { mon: ["", ""], tue: [""], wed: [""], thu: [""], fri: [""] },
            commissioners: getDefaultCommissioners(),
            psychologyCommittee: [null, null, null, null],
            lastWageDate: "",
            frozen: false,
            scheduleNotes: {},
            countdownEvents: []
        });
        const prevFrozenRef = useRef(!!(config && config.frozen));
            
        // Moved state from OperationView to App to persist across tabs
        const [selectedIds, setSelectedIds] = useState(new Set());
        const [filterGroup, setFilterGroup] = useState('all');
        const [filterDorm, setFilterDorm] = useState('all');
        const [opTab, setOpTab] = useState('bonus');
        const [adjustModal, setAdjustModal] = useState({ open: false, reason: null, val: 0, count: 1, isMulti: false, isCustom: false, customName: "" });
            
        const [modal, setModal] = useState({ open: false, title: "", content: null, onConfirm: null, type: 'info' });
        const DashboardView = getDashboardView();
        const ProfileView = profileModuleStatus === 'ready' ? getProfileView() : null;
        const TasksView = tasksModuleStatus === 'ready' ? getTasksView() : null;
        const BattleView = battleModuleStatus === 'ready' ? getBattleView() : null;

        useEffect(() => {
            if (activeTab !== 'profile' || profileModuleStatus === 'ready' || profileModuleStatus === 'loading') return;
            setProfileModuleStatus('loading');
            loadScriptOnce('profile/module.js')
                .then(() => {
                    if (typeof window.createProfileView === 'function') {
                        getProfileView();
                        setProfileModuleStatus('ready');
                    } else {
                        setProfileModuleStatus('error');
                    }
                })
                .catch(err => {
                    console.error('加载头像模块失败:', err);
                    setProfileModuleStatus('error');
                });
        }, [activeTab, profileModuleStatus]);

        useEffect(() => {
            if (activeTab !== 'tasks' || tasksModuleStatus === 'ready' || tasksModuleStatus === 'loading') return;
            setTasksModuleStatus('loading');
            loadScriptOnce('tasks-module.js')
                .then(() => {
                    if (typeof window.createTasksView === 'function') {
                        getTasksView();
                        setTasksModuleStatus('ready');
                    } else {
                        setTasksModuleStatus('error');
                    }
                })
                .catch(err => {
                    console.error('加载任务模块失败:', err);
                    setTasksModuleStatus('error');
                });
        }, [activeTab, tasksModuleStatus]);

        useEffect(() => {
            if (activeTab !== 'battle' || battleModuleStatus === 'ready' || battleModuleStatus === 'loading') return;
            setBattleModuleStatus('loading');
            loadScriptOnce('battle/transfer.js')
                .then(() => loadScriptOnce('battle/state.js'))
                .then(() => loadScriptOnce('battle/simulator.js'))
                .then(() => loadScriptOnce('battle/module.js'))
                .then(() => {
                    if (typeof window.createBattleView === 'function') {
                        getBattleView();
                        setBattleModuleStatus('ready');
                    } else {
                        setBattleModuleStatus('error');
                    }
                })
                .catch(err => {
                    console.error('加载双子星模块失败:', err);
                    setBattleModuleStatus('error');
                });
        }, [activeTab, battleModuleStatus]);

        useEffect(() => {
            if (testMode) {
                window.__CM_TEST_MODE__ = true;
                window.__CM_TEST_TIME__ = simTime;
            } else {
                window.__CM_TEST_MODE__ = false;
                window.__CM_TEST_TIME__ = null;
            }
        }, [testMode, simTime]);

        useEffect(() => {
            if (!testMode) return;
            const timer = setInterval(() => {
                setSimTime(prev => prev + 1000 * timeSpeed);
            }, 1000);
            return () => clearInterval(timer);
        }, [testMode, timeSpeed]);

        // --- 局域网同步逻辑（防覆盖升级）---
        // isSavingRef：正在执行 persist 时置位，避免自动刷新覆盖。
        // isDirtyRef：自「安排防抖保存」到「保存完成」期间置位，同样阻止自动刷新。
        // 自动刷新（定时/切屏）仅当 !isSaving && !isDirty 时才拉取并覆盖；手动刷新不受限。
        const isSavingRef = useRef(false);
        const isDirtyRef = useRef(false);
        const offlineHandledRef = useRef(false);
        const retryTimerRef = useRef(null);
        const serverMetaRef = useRef({ updatedAt: 0 });
        const initialServerSyncDoneRef = useRef(!getApiUrl());
        const OFFLINE_SNAPSHOT_KEY = 'cm_offline_snapshot';
        const RETRY_CONNECT_MS = 10 * 60 * 1000;

        const getDeviceId = () => {
            const key = 'cm_device_id';
            let id = getStorageItem(key);
            if (!id) {
                id = `${getNow().getTime()}_${Math.random().toString(36).slice(2, 10)}`;
                setStorageItem(key, id);
            }
            return id;
        };

        const readOfflineSnapshot = async () => {
            if (window.desktopApi && typeof window.desktopApi.getOfflineSnapshot === 'function') {
                const snap = await window.desktopApi.getOfflineSnapshot();
                return snap && Object.keys(snap).length ? snap : null;
            }
            const raw = getStorageItem(OFFLINE_SNAPSHOT_KEY);
            if (!raw) return null;
            try {
                const parsed = JSON.parse(raw);
                return parsed && Object.keys(parsed).length ? parsed : null;
            } catch (_) {
                return null;
            }
        };

        const writeOfflineSnapshot = (payload) => {
            if (window.desktopApi && typeof window.desktopApi.setOfflineSnapshot === 'function') {
                window.desktopApi.setOfflineSnapshot(payload);
                return;
            }
            setStorageItem(OFFLINE_SNAPSHOT_KEY, JSON.stringify(payload || {}));
        };

        const clearOfflineSnapshot = () => {
            if (window.desktopApi && typeof window.desktopApi.clearOfflineSnapshot === 'function') {
                window.desktopApi.clearOfflineSnapshot();
                return;
            }
            setStorageItem(OFFLINE_SNAPSHOT_KEY, "");
        };

        const markServerMeta = (updatedAt) => {
            const ts = Number(updatedAt) || 0;
            if (ts > 0) {
                serverMetaRef.current = { updatedAt: ts };
            }
            initialServerSyncDoneRef.current = true;
        };

        const normalizeFullData = (data) => {
            const safe = data || {};
            return {
                students: safe.students,
                studentProfiles: buildNormalizedStudentProfiles(safe.studentProfiles, safe.students),
                history: safe.history,
                config: safe.config,
                attendanceRecords: safe.attendanceRecords || safe.attendance_records,
                treasures: safe.treasures,
                storage: safe.storage,
                logs: safe.logs,
                quotes: safe.quotes,
                messages: safe.messages,
                teacherMessages: safe.teacherMessages,
                redemptionHistory: safe.redemptionHistory,
                dailyRedemptionCounts: safe.dailyRedemptionCounts,
                dailyUsageCounts: safe.dailyUsageCounts,
                tasks: safe.tasks,
                battle: safe.battle,
                examArchives: normalizeExamArchives(safe.examArchives, safe.battle),
                battleSnapshots: normalizeBattleSnapshots(safe.battleSnapshots),
                __meta: safe.__meta || {},
                flags: {
                    students: Object.prototype.hasOwnProperty.call(safe, 'students'),
                    studentProfiles: hasStudentProfilesInData(safe),
                    history: Object.prototype.hasOwnProperty.call(safe, 'history'),
                    config: Object.prototype.hasOwnProperty.call(safe, 'config'),
                    attendanceRecords: Object.prototype.hasOwnProperty.call(safe, 'attendanceRecords') || Object.prototype.hasOwnProperty.call(safe, 'attendance_records'),
                    treasures: Object.prototype.hasOwnProperty.call(safe, 'treasures'),
                    storage: Object.prototype.hasOwnProperty.call(safe, 'storage'),
                    logs: Object.prototype.hasOwnProperty.call(safe, 'logs'),
                    quotes: Object.prototype.hasOwnProperty.call(safe, 'quotes'),
                    messages: Object.prototype.hasOwnProperty.call(safe, 'messages'),
                    teacherMessages: Object.prototype.hasOwnProperty.call(safe, 'teacherMessages'),
                    redemptionHistory: Object.prototype.hasOwnProperty.call(safe, 'redemptionHistory'),
                    dailyRedemptionCounts: Object.prototype.hasOwnProperty.call(safe, 'dailyRedemptionCounts'),
                    dailyUsageCounts: Object.prototype.hasOwnProperty.call(safe, 'dailyUsageCounts'),
                    tasks: Object.prototype.hasOwnProperty.call(safe, 'tasks'),
                    battle: Object.prototype.hasOwnProperty.call(safe, 'battle'),
                    examArchives: Object.prototype.hasOwnProperty.call(safe, 'examArchives') || !!(safe.battle && Array.isArray(safe.battle.exams)),
                    battleSnapshots: Object.prototype.hasOwnProperty.call(safe, 'battleSnapshots')
                }
            };
        };

        const applyFullData = (data, options = {}) => {
            const normalized = normalizeFullData(data);
            const use = (flag) => options.force || flag;

            if (use(normalized.flags.students)) setStudents(normalized.students || []);
            if (use(normalized.flags.studentProfiles)) setStudentProfiles(restoreStudentProfilesFromData(normalized, studentProfiles, students));
            if (use(normalized.flags.history)) {
                const incomingHistory = normalized.history || [];
                const hasLocalHistory = Array.isArray(history) && history.length > 0;
                const hasIncomingHistory = Array.isArray(incomingHistory) && incomingHistory.length > 0;
                const keepLocal = !options.force && hasLocalHistory && !hasIncomingHistory;
                if (!keepLocal) setHistory(incomingHistory);
            }
            if (use(normalized.flags.config)) setConfig(normalized.config || {});

            if (use(normalized.flags.attendanceRecords)) {
                let att = normalized.attendanceRecords || {};
                if (options.mergeAttendance) {
                    try {
                        const saved = getStorageItem('attendance_records');
                        if (saved) att = mergeAttendanceRecords(JSON.parse(saved), att);
                    } catch (_) {}
                }
                setAttendanceRecords(att);
                setStorageItem('attendance_records', JSON.stringify(att));
            }

            if (use(normalized.flags.treasures)) setTreasures(normalized.treasures || []);
            if (use(normalized.flags.storage)) setStorage(normalized.storage || {});
            if (use(normalized.flags.logs)) setLogs(normalized.logs || []);
            if (use(normalized.flags.quotes)) setQuotes(normalized.quotes && normalized.quotes.length > 0 ? normalized.quotes : window.DEFAULT_QUOTES);
            if (use(normalized.flags.messages)) setMessages(normalized.messages || []);
            if (use(normalized.flags.teacherMessages)) setTeacherMessages(normalized.teacherMessages || []);
            if (use(normalized.flags.redemptionHistory)) setRedemptionHistory(normalized.redemptionHistory || {});
            if (use(normalized.flags.dailyRedemptionCounts)) setDailyRedemptionCounts(normalized.dailyRedemptionCounts || {});
            if (use(normalized.flags.dailyUsageCounts)) setDailyUsageCounts(normalized.dailyUsageCounts || {});
            if (use(normalized.flags.tasks)) setTasks(normalized.tasks || []);
            if (use(normalized.flags.battle)) setBattle(battleNormalize(normalized.battle || {}));
            if (use(normalized.flags.examArchives)) setExamArchives(normalizeExamArchives(normalized.examArchives, normalized.battle));
            if (use(normalized.flags.battleSnapshots)) setBattleSnapshots(normalizeBattleSnapshots(normalized.battleSnapshots));
        };

        const mergeFullData = (remoteData, localData) => {
            const remote = normalizeFullData(remoteData);
            const local = normalizeFullData(localData);
            const remoteTs = Number(remote.__meta.updatedAt) || 0;
            const localTs = Number(local.__meta.updatedAt) || 0;
            const mergedStudents = mergeArrayByKey(remote.students, local.students);
            const mergedStudentProfiles = mergeStudentProfilesForData(remote, local, mergedStudents);
            return {
                students: mergedStudents,
                studentProfiles: mergedStudentProfiles,
                history: mergeArrayByKey(remote.history, local.history),
                config: { ...(remote.config || {}), ...(local.config || {}) },
                attendanceRecords: mergeAttendanceRecords(remote.attendanceRecords || {}, local.attendanceRecords || {}),
                treasures: mergeArrayByKey(remote.treasures, local.treasures),
                storage: { ...(remote.storage || {}), ...(local.storage || {}) },
                logs: mergeArrayByKey(remote.logs, local.logs),
                quotes: (local.quotes && local.quotes.length > 0) ? local.quotes : remote.quotes,
                messages: mergeArrayByKey(remote.messages, local.messages),
                teacherMessages: mergeArrayByKey(remote.teacherMessages, local.teacherMessages),
                redemptionHistory: { ...(remote.redemptionHistory || {}), ...(local.redemptionHistory || {}) },
                dailyRedemptionCounts: { ...(remote.dailyRedemptionCounts || {}), ...(local.dailyRedemptionCounts || {}) },
                dailyUsageCounts: { ...(remote.dailyUsageCounts || {}), ...(local.dailyUsageCounts || {}) },
                tasks: mergeArrayByKey(remote.tasks, local.tasks),
                battle: local.battle || remote.battle,
                examArchives: normalizeExamArchives(
                    (local.examArchives && Array.isArray(local.examArchives.exams) && local.examArchives.exams.length > 0)
                        ? local.examArchives
                        : remote.examArchives,
                    local.battle?.exams?.length ? local.battle : remote.battle
                ),
                battleSnapshots: mergeArrayByKey(remote.battleSnapshots, local.battleSnapshots)
                    .sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0))
                    .slice(0, 20),
                __meta: { updatedAt: Math.max(remoteTs, localTs), deviceId: local.__meta.deviceId || remote.__meta.deviceId }
            };
        };

        const enterTestMode = useCallback(() => {
            if (testMode) return;
            testSnapshotRef.current = {
                students: deepClone(students),
                studentProfiles: deepClone(buildNormalizedStudentProfiles(studentProfiles, students)),
                history: deepClone(history),
                config: deepClone(config),
                attendanceRecords: deepClone(attendanceRecords),
                treasures: deepClone(treasures),
                storage: deepClone(storage),
                logs: deepClone(logs),
                quotes: deepClone(quotes),
                messages: deepClone(messages),
                teacherMessages: deepClone(teacherMessages),
                redemptionHistory: deepClone(redemptionHistory),
                dailyRedemptionCounts: deepClone(dailyRedemptionCounts),
                dailyUsageCounts: deepClone(dailyUsageCounts),
                tasks: deepClone(tasks),
                battle: deepClone(battle),
                examArchives: deepClone(examArchives),
                battleSnapshots: deepClone(battleSnapshots),
                selectedIds: Array.from(selectedIds),
                filterGroup,
                filterDorm,
                opTab,
                activeTab
            };
            window.__CM_TEST_STORAGE__ = snapshotStorage();
            setTestMode(true);
            setSimTime(getNow().getTime());
            setTimeSpeed(1);
            setSyncStatus('saved');
        }, [testMode, students, studentProfiles, history, config, attendanceRecords, treasures, storage, logs, quotes, messages, teacherMessages, redemptionHistory, dailyRedemptionCounts, dailyUsageCounts, tasks, battle, examArchives, battleSnapshots, selectedIds, filterGroup, filterDorm, opTab, activeTab]);

        const exitTestMode = useCallback(() => {
            if (!testMode) return;
            const snap = testSnapshotRef.current;
            if (snap) {
                setStudents(snap.students || []);
                setStudentProfiles(restoreStudentProfilesFromData(snap, studentProfiles, students));
                setHistory(snap.history || []);
                setConfig(snap.config || {});
                setAttendanceRecords(snap.attendanceRecords || {});
                setTreasures(snap.treasures || []);
                setStorage(snap.storage || {});
                setLogs(snap.logs || []);
                setQuotes(snap.quotes || []);
                setMessages(snap.messages || []);
                setTeacherMessages(snap.teacherMessages || []);
                setRedemptionHistory(snap.redemptionHistory || {});
                setDailyRedemptionCounts(snap.dailyRedemptionCounts || {});
                setDailyUsageCounts(snap.dailyUsageCounts || {});
                setTasks(snap.tasks || []);
                setBattle(battleNormalize(snap.battle || {}));
                setExamArchives(snap.examArchives || normalizeExamArchives(undefined, snap.battle));
                setBattleSnapshots(normalizeBattleSnapshots(snap.battleSnapshots));
                setSelectedIds(new Set(snap.selectedIds || []));
                setFilterGroup(snap.filterGroup || 'all');
                setFilterDorm(snap.filterDorm || 'all');
                setOpTab(snap.opTab || 'bonus');
                if (snap.activeTab) setActiveTab(snap.activeTab);
            }
            window.__CM_TEST_STORAGE__ = null;
            setTestMode(false);
            setSimTime(Date.now());
            setTimeSpeed(1);
            setSyncStatus('saved');
        }, [testMode]);

        const buildCurrentFullData = useCallback((overrides = {}) => {
            let att = attendanceRecords || {};
            try {
                const raw = getStorageItem('attendance_records');
                if (raw) att = JSON.parse(raw);
            } catch (_) {}
            const nextStudents = Object.prototype.hasOwnProperty.call(overrides, 'students') ? overrides.students : students;
            const nextStudentProfiles = restoreStudentProfilesFromData(overrides, studentProfiles, nextStudents);
            return {
                history,
                config,
                attendanceRecords: att,
                treasures,
                storage,
                logs,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts,
                tasks,
                battle,
                examArchives,
                battleSnapshots,
                ...overrides,
                students: nextStudents,
                studentProfiles: nextStudentProfiles
            };
        }, [attendanceRecords, students, studentProfiles, history, config, treasures, storage, logs, quotes, messages, teacherMessages, redemptionHistory, dailyRedemptionCounts, dailyUsageCounts, tasks, battle, examArchives, battleSnapshots]);

        const writeLocalCaches = useCallback((fullDataWithMeta) => {
            const {
                students,
                studentProfiles,
                history,
                config,
                attendanceRecords,
                treasures,
                storage,
                logs,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts,
                tasks,
                battle,
                examArchives,
                battleSnapshots,
                __meta
            } = fullDataWithMeta;
            setStorageItem('class_manager_data', JSON.stringify({
                students,
                studentProfiles,
                history,
                config,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts,
                tasks,
                battle,
                examArchives,
                battleSnapshots,
                __meta
            }));
            setStorageItem('attendance_records', JSON.stringify(attendanceRecords || {}));
            setStorageItem('class_treasure_data', JSON.stringify({ treasures, storage, logs }));
        }, []);

        const savePayloadToServer = useCallback((payload, fullDataWithMeta, nowTs) => {
            if (window.__CM_TEST_MODE__) {
                setSyncStatus('saved');
                isSavingRef.current = false;
                return Promise.resolve({ success: true, updatedAt: nowTs });
            }
            const apiUrl = getApiUrl();
            if (!apiUrl) {
                setSyncStatus('unsaved');
                writeOfflineSnapshot({ ts: nowTs, data: fullDataWithMeta });
                isSavingRef.current = false;
                return Promise.resolve({ success: true, offline: true, updatedAt: nowTs });
            }
            return fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...window.__getAuthHeaders__()
                },
                body: JSON.stringify(payload)
            })
                .then(async (res) => {
                    if (window.__handleAuthError__(res)) return null;
                    const data = await res.json().catch(() => ({}));
                    if (res.status === 409) {
                        const serverUpdatedAt = Number(data?.serverUpdatedAt) || 0;
                        if (serverUpdatedAt > 0) serverMetaRef.current = { updatedAt: serverUpdatedAt };
                        setSyncStatus('error');
                        isSavingRef.current = false;
                        alert('检测到其他浏览器或标签页已更新服务器数据，请先刷新后再保存。');
                        throw new Error('DATA_CONFLICT');
                    }
                    if (!res.ok) {
                        throw new Error(data?.error || '保存失败');
                    }
                    const savedUpdatedAt = Number(data?.updatedAt) || nowTs;
                    markServerMeta(savedUpdatedAt);
                    setSyncStatus('saved');
                    clearOfflineSnapshot();
                    isSavingRef.current = false;
                    return { success: true, updatedAt: savedUpdatedAt };
                })
                .catch((err) => {
                    if (err?.message === 'DATA_CONFLICT') throw err;
                    setSyncStatus('unsaved');
                    writeOfflineSnapshot({ ts: nowTs, data: fullDataWithMeta });
                    isSavingRef.current = false;
                    throw err;
                });
        }, [writeLocalCaches]);

        const persistDataPatch = useCallback((partialData) => {
            isSavingRef.current = true;
            const nowTs = getNow().getTime();
            const fullData = buildCurrentFullData(partialData || {});
            const normalizedInput = normalizeFullData(fullData);
            const nextStudentProfiles = restoreStudentProfilesFromData(fullData, studentProfiles, fullData?.students || students);
            const incomingExamArchives = normalizeExamArchives(fullData?.examArchives || examArchives, normalizedInput.battle || battle);
            const currentExamArchives = normalizeExamArchives(examArchives, battle);
            const protectedExamArchives = (
                Array.isArray(incomingExamArchives.exams) &&
                incomingExamArchives.exams.length === 0 &&
                Array.isArray(currentExamArchives.exams) &&
                currentExamArchives.exams.length > 0
            ) ? currentExamArchives : incomingExamArchives;
            const nextBattleSnapshots = normalizeBattleSnapshots(fullData?.battleSnapshots || battleSnapshots);
            const fullDataWithMeta = {
                ...fullData,
                studentProfiles: nextStudentProfiles,
                battle: normalizedInput.battle,
                examArchives: protectedExamArchives,
                battleSnapshots: nextBattleSnapshots,
                __meta: {
                    updatedAt: nowTs,
                    baseUpdatedAt: Number(serverMetaRef.current.updatedAt) || 0,
                    deviceId: getDeviceId()
                }
            };
            writeLocalCaches(fullDataWithMeta);
            const payload = { ...partialData, __meta: fullDataWithMeta.__meta };
            return savePayloadToServer(payload, fullDataWithMeta, nowTs);
        }, [buildCurrentFullData, students, studentProfiles, battle, examArchives, battleSnapshots, savePayloadToServer, writeLocalCaches]);

        /** 统一持久化：写 localStorage 并可选 POST。所有需立即落盘的操作均经此函数，避免分散写入导致覆盖。 */
        const persistData = useCallback((fullData) => {
            isSavingRef.current = true;
            const nowTs = getNow().getTime();
            const normalizedInput = normalizeFullData(fullData);
            const nextStudentProfiles = restoreStudentProfilesFromData(fullData, studentProfiles, fullData?.students || students);
            const incomingExamArchives = normalizeExamArchives(fullData?.examArchives || examArchives, normalizedInput.battle || battle);
            const currentExamArchives = normalizeExamArchives(examArchives, battle);
            const protectedExamArchives = (
                Array.isArray(incomingExamArchives.exams) &&
                incomingExamArchives.exams.length === 0 &&
                Array.isArray(currentExamArchives.exams) &&
                currentExamArchives.exams.length > 0
            ) ? currentExamArchives : incomingExamArchives;
            const nextBattleSnapshots = normalizeBattleSnapshots(fullData?.battleSnapshots || battleSnapshots);
            const fullDataWithMeta = {
                ...fullData,
                studentProfiles: nextStudentProfiles,
                battle: normalizedInput.battle,
                examArchives: protectedExamArchives,
                battleSnapshots: nextBattleSnapshots,
                __meta: {
                    updatedAt: nowTs,
                    baseUpdatedAt: Number(serverMetaRef.current.updatedAt) || 0,
                    deviceId: getDeviceId()
                }
            };
            writeLocalCaches(fullDataWithMeta);
            return savePayloadToServer(fullDataWithMeta, fullDataWithMeta, nowTs);
        }, [students, studentProfiles, battle, examArchives, battleSnapshots, savePayloadToServer, writeLocalCaches]);

        const fetchFromServer = useCallback((isAuto = false) => {
            if (window.__CM_TEST_MODE__) {
                if (!isAuto) alert("测试模式中已禁止同步。");
                return;
            }
            const apiUrl = getApiUrl();
            if (!apiUrl) {
                if (!isAuto) {
                    console.warn("Manual refresh ignored: Non-HTTP environment.");
                    alert("当前为本地模式（非HTTP环境），无法连接服务器。");
                }
                return;
            }
            // 自动刷新时：若有未保存更改或正在保存，一律跳过，避免同步覆盖
            if (isAuto && (isSavingRef.current || isDirtyRef.current)) {
                console.log('[自动刷新] 跳过：存在未保存更改或正在保存');
                return;
            }
            if (!isAuto && (isSavingRef.current || isDirtyRef.current)) {
                alert("当前存在未保存更改，已阻止同步覆盖，请稍后再刷新。");
                return;
            }

            if(!isAuto) setSyncStatus('unsaved');
                
            fetch(apiUrl, {
                headers: window.__getAuthHeaders__()
            })
                .then(res => {
                    if (window.__handleAuthError__(res)) return;
                    return res.json();
                })
                .then(async data => {
                    if (!data) return;
                    if (data && Object.keys(data).length > 0) {
                        const offlineSnap = await readOfflineSnapshot();
                        const normalized = normalizeFullData(data);
                        const remoteTs = Number(normalized.__meta.updatedAt) || 0;
                        markServerMeta(remoteTs);
                        const offlineTs = Number(offlineSnap?.ts) || 0;
                        
                        if (offlineSnap && !offlineHandledRef.current && offlineTs > remoteTs) {
                            offlineHandledRef.current = true;
                            setModal({
                                open: true,
                                title: "检测到离线数据",
                                type: "info",
                                onConfirm: null,
                                content: h("div", { className: "space-y-4 text-sm text-gray-600" },
                                    h("div", null, `离线时间：${new Date(offlineTs).toLocaleString()}`),
                                    h("div", null, `服务器时间：${remoteTs ? new Date(remoteTs).toLocaleString() : "未知"}`),
                                    h("div", { className: "flex flex-col gap-2" },
                                        h("button", {
                                            onClick: () => {
                                                applyFullData(offlineSnap.data, { force: true, mergeAttendance: false });
                                                persistData(offlineSnap.data).then(() => clearOfflineSnapshot());
                                                setModal(m => ({ ...m, open: false }));
                                            },
                                            className: "px-3 py-2 bg-blue-600 text-white rounded"
                                        }, "使用本地覆盖服务器"),
                                        h("button", {
                                            onClick: () => {
                                                applyFullData(data, { force: true, mergeAttendance: true });
                                                clearOfflineSnapshot();
                                                setModal(m => ({ ...m, open: false }));
                                            },
                                            className: "px-3 py-2 bg-gray-200 text-gray-700 rounded"
                                        }, "使用服务器覆盖本地"),
                                        h("button", {
                                            onClick: () => {
                                                const merged = mergeFullData(data, offlineSnap.data);
                                                applyFullData(merged, { force: true, mergeAttendance: false });
                                                persistData(merged).then(() => clearOfflineSnapshot());
                                                setModal(m => ({ ...m, open: false }));
                                            },
                                            className: "px-3 py-2 bg-green-600 text-white rounded"
                                        }, "合并并同步")
                                    )
                                )
                            });
                        } else {
                            applyFullData(data, { mergeAttendance: true });
                            clearOfflineSnapshot();
                        }
                        setSyncStatus('success');
                        if(!isAuto) alert("数据已从服务器刷新！");
                        console.log(`[${getNow().toLocaleTimeString()}] 数据同步完成`);
                        if (retryTimerRef.current) {
                            clearTimeout(retryTimerRef.current);
                            retryTimerRef.current = null;
                        }
                    } else {
                        initialServerSyncDoneRef.current = true;
                        const offlineSnap = await readOfflineSnapshot();
                        if (offlineSnap && !offlineHandledRef.current) {
                            offlineHandledRef.current = true;
                            setModal({
                                open: true,
                                title: "服务器无数据",
                                type: "info",
                                onConfirm: null,
                                content: h("div", { className: "space-y-4 text-sm text-gray-600" },
                                    h("div", null, "检测到本地离线数据，是否上传到服务器？"),
                                    h("div", { className: "flex flex-col gap-2" },
                                        h("button", {
                                            onClick: () => {
                                                applyFullData(offlineSnap.data, { force: true, mergeAttendance: false });
                                                persistData(offlineSnap.data).then(() => clearOfflineSnapshot());
                                                setModal(m => ({ ...m, open: false }));
                                            },
                                            className: "px-3 py-2 bg-blue-600 text-white rounded"
                                        }, "上传本地数据"),
                                        h("button", {
                                            onClick: () => {
                                                clearOfflineSnapshot();
                                                setModal(m => ({ ...m, open: false }));
                                            },
                                            className: "px-3 py-2 bg-gray-200 text-gray-700 rounded"
                                        }, "放弃本地数据")
                                    )
                                )
                            });
                            return;
                        }
                        if(!isAuto) alert("服务器无数据或数据为空。");
                    }
                })
                .catch(err => {
                    console.error("Server fetch failed", err);
                    setSyncStatus('error');
                    if(!isAuto) alert("刷新失败，无法连接到服务器。");
                    if (!retryTimerRef.current) {
                        retryTimerRef.current = setTimeout(() => {
                            retryTimerRef.current = null;
                            fetchFromServer(true);
                        }, RETRY_CONNECT_MS);
                    }
                });
        }, []);
            
        const loadFromLocal = () => {
            const savedData = getStorageItem('class_manager_data');
            if (savedData) {
                const data = JSON.parse(savedData);
                setStudents(data.students || []);
                setStudentProfiles(restoreStudentProfilesFromData(data, studentProfiles, students));
                setHistory(data.history || []);
                const savedConfig = data.config || {};
                setConfig({
                    duty: { mon: ["", ""], tue: [""], wed: [""], thu: [""], fri: [""] },
                    commissioners: getDefaultCommissioners({ systemConfig: savedConfig.systemConfig }),
                    lastWageDate: "",
                    frozen: false,
                    systemConfig: savedConfig.systemConfig || undefined,
                    ...savedConfig
                });
                setQuotes(data.quotes && data.quotes.length > 0 ? data.quotes : window.DEFAULT_QUOTES);
                if(data.messages) setMessages(data.messages);
                if(data.teacherMessages) setTeacherMessages(data.teacherMessages);
                if(data.redemptionHistory) setRedemptionHistory(data.redemptionHistory);
                if(data.dailyRedemptionCounts) setDailyRedemptionCounts(data.dailyRedemptionCounts);
                if(data.dailyUsageCounts) setDailyUsageCounts(data.dailyUsageCounts);
                if(data.tasks) setTasks(data.tasks);
                if(data.battle) setBattle(battleNormalize(data.battle));
                setExamArchives(normalizeExamArchives(data.examArchives, data.battle));
                setBattleSnapshots(normalizeBattleSnapshots(data.battleSnapshots));
            } else {
                 // Initialize defaults
                setStudents([]);
                setStudentProfiles(buildNormalizedStudentProfiles());
                setQuotes(window.DEFAULT_QUOTES);
                setExamArchives(normalizeExamArchives());
                setBattleSnapshots(normalizeBattleSnapshots());
            }
                
            const savedAtt = getStorageItem('attendance_records');
            if (savedAtt) setAttendanceRecords(JSON.parse(savedAtt));
                
            const savedTreasures = getStorageItem('class_treasure_data');
            if (savedTreasures) {
                const data = JSON.parse(savedTreasures);
                // 优先使用配置中的treasures，如果没有则使用保存的，最后使用默认值
                const systemConfig = getSystemConfig(config);
                setTreasures(data.treasures || systemConfig.treasures || INITIAL_TREASURES);
                setStorage(data.storage || {});
                setLogs(data.logs || []);
            } else {
                // 如果没有保存的treasures，从配置读取
                const systemConfig = getSystemConfig(config);
                setTreasures(systemConfig.treasures || INITIAL_TREASURES);
            }
        };

        useEffect(() => {
            // 1. Initial Load
            loadFromLocal(); 
            fetchFromServer(true); // Initial server fetch (silent)

            // 2. Auto Refresh every 10 minutes
            const interval = setInterval(() => {
                fetchFromServer(true);
            }, 10 * 60 * 1000);
                
            // 3. Sync on window focus
            const onFocus = () => fetchFromServer(true);
            window.addEventListener('focus', onFocus);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') onFocus();
            });

            return () => {
                clearInterval(interval);
                window.removeEventListener('focus', onFocus);
                document.removeEventListener('visibilitychange', onFocus);
            };
        }, [fetchFromServer]);

        useEffect(() => {
            if (battleSnapshots.length > 0) return;
            const transfer = window.BattleTransfer || {};
            if (typeof transfer.readLegacySnapshots !== 'function') return;
            const legacy = normalizeBattleSnapshots(transfer.readLegacySnapshots());
            if (legacy.length === 0) return;
            setBattleSnapshots(legacy);
        }, [battleSnapshots.length]);

        // 4. 每日自动快照（22:30后触发，或错过22:30时补生成）
        useEffect(() => {
            const runAutoSnapshot = () => {
                const now = getNow();
                const hour = now.getHours();
                const minute = now.getMinutes();
                const today = getTodayStr();
                const lastKey = 'class_manager_snapshot_last_date';
                const lastDate = getStorageItem(lastKey);

                // 已经为今天生成过快照，跳过
                if (lastDate === today) return;

                // 判断是否在快照时间窗口内（22:30后），或者是否需要补生成
                const isInWindow = (hour === 22 && minute >= 30) || hour >= 23;
                const shouldCatchUp = lastDate && lastDate < today; // 错过了昨天或更早的快照

                if (!isInWindow && !shouldCatchUp) return;

                // 检查是否有数据
                const hasData = (students && students.length > 0) || (history && history.length > 0);
                if (!hasData) return;

                // 收集快照数据
                let att = {};
                try {
                    const raw = getStorageItem('attendance_records');
                    if (raw) att = JSON.parse(raw);
                } catch (_) {}

                const fullData = {
                    students: students || [],
                    studentProfiles: buildNormalizedStudentProfiles(studentProfiles, students),
                    history: history || [],
                    config: config || {},
                    quotes: quotes || [],
                    messages: messages || [],
                    teacherMessages: teacherMessages || [],
                    redemptionHistory: redemptionHistory || {},
                    dailyRedemptionCounts: dailyRedemptionCounts || {},
                    dailyUsageCounts: dailyUsageCounts || {},
                    tasks: tasks || [],
                    attendanceRecords: att,
                    treasures: treasures || [],
                    storage: storage || {},
                    logs: logs || [],
                    battle: battle || {},
                    examArchives: examArchives || normalizeExamArchives(undefined, battle),
                    battleSnapshots: battleSnapshots || []
                };

                const snapKey = 'class_manager_snapshots';
                let list = [];
                try {
                    const s = getStorageItem(snapKey);
                    if (s) list = JSON.parse(s);
                } catch (_) {}

                const id = getNow().getTime();
                const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                const label = shouldCatchUp && !isInWindow 
                    ? `${today} ${timeStr} (补生成)` 
                    : `${today} ${timeStr}`;
                list.push({ id, ts: id, label, data: fullData });
                if (list.length > 10) list = list.slice(-10);
                setStorageItem(snapKey, JSON.stringify(list));
                setStorageItem(lastKey, today);
                console.log(`[自动快照] 已生成: ${label}`);
            };

            const t = setInterval(runAutoSnapshot, 60 * 1000);
            // 延迟1秒执行，确保数据已加载
            const initTimer = setTimeout(runAutoSnapshot, 1000);
            const onVisible = () => runAutoSnapshot();
            document.addEventListener('visibilitychange', onVisible);
            window.addEventListener('focus', onVisible);
            return () => {
                clearInterval(t);
                clearTimeout(initTimer);
                document.removeEventListener('visibilitychange', onVisible);
                window.removeEventListener('focus', onVisible);
            };
        }, [students, studentProfiles, history, config, quotes, messages, teacherMessages, redemptionHistory, dailyRedemptionCounts, dailyUsageCounts, tasks, battle, examArchives, battleSnapshots, treasures, storage, logs]);

        // Update handleRefreshData to use new function
        const handleRefreshData = () => fetchFromServer(false);

        // 动态更新页面标题
        useEffect(() => {
            const systemConfig = getSystemConfig(config);
            const className = systemConfig.className || "班级自在管理系统";
            document.title = className + " (局域网版)";
        }, [config]);

        const applyPenaltyDecay = useCallback(() => {
            if (config && config.frozen) return;
            if (!Array.isArray(students) || students.length === 0) return;
            const now = getNow();
            const todayKey = getDateString(now);
            const lastRun = getStorageItem('penalty_decay_last_run');
            if (lastRun === todayKey) return;
            const lastMap = new Map();
            (history || []).forEach(h => {
                if (!h || h.studentId == null) return;
                if (h.type !== 'penalty' && !(Number(h.val) < 0)) return;
                const prev = lastMap.get(h.studentId) || 0;
                if (h.ts > prev) lastMap.set(h.studentId, h.ts);
            });
            let changed = false;
            const nextStudents = students.map(s => {
                const lastFromHistory = lastMap.get(s.id) || 0;
                const lastPenaltyAt = Math.max(Number(s.lastPenaltyAt) || 0, lastFromHistory || 0);
                const penaltyVal = Number(s.penalty) || 0;
                if (!lastPenaltyAt || penaltyVal <= 0) return s;
                const weeks = Math.floor((now.getTime() - lastPenaltyAt) / (7 * DAY_MS));
                if (weeks <= 0) return s;
                const reduce = 10 * weeks;
                const nextPenalty = Math.max(0, penaltyVal - reduce);
                const nextLast = lastPenaltyAt + weeks * 7 * DAY_MS;
                if (nextPenalty === penaltyVal && nextLast === lastPenaltyAt) return s;
                changed = true;
                return { ...s, penalty: nextPenalty, lastPenaltyAt: nextLast };
            });
            if (changed) setStudents(nextStudents);
            setStorageItem('penalty_decay_last_run', todayKey);
        }, [students, history, config]);

        useEffect(() => {
            const wasFrozen = prevFrozenRef.current;
            const isFrozen = !!(config && config.frozen);
            if (wasFrozen && !isFrozen) {
                const nowTs = getNow().getTime();
                setStudents(prev => (prev || []).map(s => ({ ...s, lastPenaltyAt: nowTs })));
            }
            prevFrozenRef.current = isFrozen;
        }, [config]);

        useEffect(() => {
            applyPenaltyDecay();
        }, [applyPenaltyDecay]);

        // 手动/自动快照生成函数
        const createSnapshot = useCallback((options = {}) => {
            try {
                const now = getNow();
                const today = getTodayStr();
                const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                const note = options.note || '';
                const label = `${today} ${timeStr}${note}`;

                // 收集当前内存态数据
                let att = {};
                try {
                    const raw = getStorageItem('attendance_records');
                    if (raw) att = JSON.parse(raw);
                } catch (_) {}

                const fullData = {
                    students: students || [],
                    studentProfiles: buildNormalizedStudentProfiles(studentProfiles, students),
                    history: history || [],
                    config: config || {},
                    quotes: quotes || [],
                    messages: messages || [],
                    teacherMessages: teacherMessages || [],
                    redemptionHistory: redemptionHistory || {},
                    dailyRedemptionCounts: dailyRedemptionCounts || {},
                    dailyUsageCounts: dailyUsageCounts || {},
                    tasks: tasks || [],
                    attendanceRecords: att,
                    treasures: treasures || [],
                    storage: storage || {},
                    logs: logs || [],
                    battle: battle || {},
                    examArchives: examArchives || normalizeExamArchives(undefined, battle),
                    battleSnapshots: battleSnapshots || []
                };

                const snapKey = 'class_manager_snapshots';
                let list = [];
                try {
                    const s = getStorageItem(snapKey);
                    if (s) list = JSON.parse(s);
                } catch (_) {}

                const id = getNow().getTime();
                list.push({ id, ts: id, label, data: fullData });
                if (list.length > 10) list = list.slice(-10);
                setStorageItem(snapKey, JSON.stringify(list));
                console.log(`[快照] 已生成: ${label}`);
                return true;
            } catch (e) {
                console.error('生成快照失败:', e);
                return false;
            }
        }, [students, studentProfiles, history, config, quotes, messages, teacherMessages, redemptionHistory, dailyRedemptionCounts, dailyUsageCounts, tasks, treasures, storage, logs, battle, examArchives, battleSnapshots]);


        // --- 自动保存逻辑 (Debounced) ---
        useEffect(() => {
            isDirtyRef.current = true;

            if (!window.__CM_TEST_MODE__ && getApiUrl() && !initialServerSyncDoneRef.current) {
                const previewData = buildCurrentFullData();
                const nowTs = getNow().getTime();
                writeLocalCaches({
                    ...previewData,
                    __meta: {
                        updatedAt: nowTs,
                        baseUpdatedAt: Number(serverMetaRef.current.updatedAt) || 0,
                        deviceId: getDeviceId()
                    }
                });
                return undefined;
            }

            const saveData = () => {
                const fullData = buildCurrentFullData();
                persistData(fullData).then(() => { 
                    isDirtyRef.current = false; 
                }).catch(() => { 
                    isDirtyRef.current = false; 
                });
            };

            const timer = setTimeout(saveData, 1500);
            return () => clearTimeout(timer);
        }, [students, studentProfiles, history, config, attendanceRecords, treasures, storage, logs, quotes, messages, teacherMessages, redemptionHistory, dailyRedemptionCounts, dailyUsageCounts, tasks, persistData, buildCurrentFullData, writeLocalCaches]);

        useEffect(() => {
            isDirtyRef.current = true;

            if (!window.__CM_TEST_MODE__ && getApiUrl() && !initialServerSyncDoneRef.current) {
                const previewData = buildCurrentFullData();
                const nowTs = getNow().getTime();
                writeLocalCaches({
                    ...previewData,
                    __meta: {
                        updatedAt: nowTs,
                        baseUpdatedAt: Number(serverMetaRef.current.updatedAt) || 0,
                        deviceId: getDeviceId()
                    }
                });
                return undefined;
            }

            const saveBattleDomain = () => {
                persistDataPatch({
                    battle,
                    examArchives,
                    battleSnapshots
                }).then(() => {
                    isDirtyRef.current = false;
                }).catch(() => {
                    isDirtyRef.current = false;
                });
            };

            const timer = setTimeout(saveBattleDomain, 1200);
            return () => clearTimeout(timer);
        }, [battle, examArchives, battleSnapshots, persistDataPatch, buildCurrentFullData, writeLocalCaches]);


        // NEW Batch Update Function
        const batchUpdatePoints = useCallback((updates) => {
            if (!Array.isArray(updates) || updates.length === 0) return 0;
            const invalid = updates.find(u => !u.scene || !u.category || !POINT_SCENES.includes(u.scene) || !POINT_CATEGORIES.includes(u.category));
            if (invalid) {
                alert("请先选择场景与类别");
                return 0;
            }
            const ts = getNow().getTime();
            
            setStudents(prevStudents => {
                const sourceStudents = (Array.isArray(prevStudents) && prevStudents.length > 0) ? prevStudents : GUEST_ROSTER;
                const newStudents = sourceStudents.map(s => ({ ...s }));
                
                const newHistoryRecords = [];
                
                updates.forEach(update => {
                    const idx = newStudents.findIndex(s => s.id === update.id);
                    if (idx !== -1) {
                        const s = newStudents[idx];
                        s.zizai = Number.isFinite(Number(s.zizai)) ? Number(s.zizai) : 0;
                        s.balance = Number.isFinite(Number(s.balance)) ? Number(s.balance) : 0;
                        s.penalty = Number.isFinite(Number(s.penalty)) ? Number(s.penalty) : 0;
                        const snapshot = { zizai: s.zizai, balance: s.balance, penalty: s.penalty };
                        const valNum = Number(update.val);
                        const val = Number.isFinite(valNum) ? valNum : 0;

                        if (val > 0) s.zizai += val;
                        s.balance += val;
                        if (val < 0 && update.type === 'penalty') {
                            s.penalty += Math.abs(val);
                            s.lastPenaltyAt = ts;
                        }
                        
                        const scene = normalizePointScene(update.scene);
                        const category = normalizePointCategory(update.category);
                        
                        newHistoryRecords.push({ 
                            id: ts + Math.random(), 
                            ts, 
                            studentId: s.id, 
                            studentName: s.name, 
                            val, 
                            reason: update.reason, 
                            snapshot,
                            type: update.type,
                            scene,
                            category
                        });
                    }
                });
                
                setHistory(prevHistory => {
                    const sourceHistory = Array.isArray(prevHistory) ? prevHistory : [];
                    return [...newHistoryRecords, ...sourceHistory];
                });
                
                return newStudents;
            });
            
            return updates.length;
        }, []);

        const updatePoints = (ids, val, reason, type = 'bonus', scene, category) => {
            if (!scene || !category || !POINT_SCENES.includes(scene) || !POINT_CATEGORIES.includes(category)) {
                alert("请先选择场景与类别");
                return 0;
            }
            const updates = Array.from(ids).map(id => ({ id, val, reason, type, scene, category }));
            return batchUpdatePoints(updates);
        };

        const applyBattleSettlementToMainRecords = ({ updates, summaryText }) => {
            if (!Array.isArray(updates) || updates.length === 0) {
                return { applied: false, count: 0, skipped: true };
            }
            const shouldApply = confirm(summaryText || `本次双子星结算将生成 ${updates.length} 条主积分记录，是否同步入账？`);
            if (!shouldApply) {
                return { applied: false, count: updates.length, skipped: true };
            }
            const count = batchUpdatePoints(updates);
            return { applied: true, count };
        };

        const handleUndo = (recordId) => {
            const record = history.find(h => h.id === recordId);
            if (!record || record.isUndoLog) return;
            const newStudents = [...students];
            const idx = newStudents.findIndex(s => s.id === record.studentId);
            let undoSnapshot = null;
            if (idx !== -1) {
                const s = newStudents[idx];
                const val = record.val || 0;
                
                // 记录撤销前的状态
                undoSnapshot = { zizai: s.zizai, balance: s.balance, penalty: s.penalty };
                
                // 撤销操作：反向加减，而不是恢复到 snapshot
                if (val > 0) {
                    s.zizai = (s.zizai || 0) - val;
                }
                s.balance = (s.balance || 0) - val;
                if (val < 0 && record.type === 'penalty') {
                    s.penalty = Math.max(0, (s.penalty || 0) + val);
                }
                
                // 如果撤销的是扣分记录，重新计算 lastPenaltyAt
                if (record.type === 'penalty') {
                    const filtered = history.filter(h => h.id !== recordId && String(h.studentId) === String(record.studentId) && h.type === 'penalty' && !h.isUndoLog);
                    if (filtered.length > 0) {
                        const lastPenalty = filtered.reduce((max, h) => h.ts > max.ts ? h : max, filtered[0]);
                        s.lastPenaltyAt = lastPenalty.ts;
                    } else {
                        s.lastPenaltyAt = 0;
                    }
                }
            }
            const filtered = history.filter(h => h.id !== recordId);
            const ts = Date.now();
            const undoEntry = {
                id: ts + Math.random(),
                ts,
                studentId: record.studentId,
                studentName: record.studentName,
                val: -record.val,
                reason: "撤销扣分: " + (record.reason || ""),
                snapshot: undoSnapshot || { zizai: 0, balance: 0, penalty: 0 },
                type: "bonus",
                isUndoLog: true,
                scene: normalizePointScene(record.scene),
                category: normalizePointCategory(record.category)
            };
            setStudents(newStudents);
            setHistory([undoEntry, ...filtered]);
        };
        
        const handleUndoByReasons = (studentId, reasons) => {
            const reasonList = Array.isArray(reasons) ? reasons.filter(Boolean) : [reasons].filter(Boolean);
            if (reasonList.length === 0) return;
            const record = history.find(h => String(h.studentId) === String(studentId) && !h.isUndoLog && reasonList.includes(h.reason));
            if (!record) return alert("未找到对应的加扣分记录");
            handleUndo(record.id);
        };

        const handleWage = () => {
            const today = getTodayStr();
            if (config.lastWageDate === today) { if (!confirm("今日工资似乎已发放，确定要再次发放吗？")) return; }
            const systemConfig = getSystemConfig(config);
            const baseWage = Number(systemConfig.points?.dailyWageAmount);
            const dailyWageAmount = Number.isFinite(baseWage) ? baseWage : 5;
            const wageGroups = Array.isArray(systemConfig.points?.dailyWageGroups)
                ? systemConfig.points.dailyWageGroups
                : ['discipline', 'hygiene'];
            const targets = students.filter(s => wageGroups.includes(s.group));
            const psychologyCommitteeIds = config.psychologyCommittee || [null, null, null, null];
            const validPsychologyIds = psychologyCommitteeIds.filter(id => id != null);
            const customRoles = getCustomRoles(config);
            const paidCustomRoles = customRoles.filter(role => role && role.studentId != null && Number(role.dailyWage) !== 0);
            if (targets.length === 0 && validPsychologyIds.length === 0 && paidCustomRoles.length === 0) {
                return alert("没有找到可发放工资或津贴的对象");
            }
                
            const updates = targets.map(t => ({
                id: t.id,
                val: t.role === 'leader' ? dailyWageAmount + 1 : dailyWageAmount,
                reason: "每日工资",
                type: 'bonus',
                scene: "班级",
                category: "班务"
            }));
            
            validPsychologyIds.forEach(psychologyId => {
                updates.push({
                    id: psychologyId,
                    val: 1,
                    reason: "心理委员津贴",
                    type: 'bonus',
                    scene: "班级",
                    category: "班务"
                });
            });

            paidCustomRoles.forEach(role => {
                updates.push({
                    id: role.studentId,
                    val: Number(role.dailyWage) || 0,
                    reason: `班级职务津贴${role.name ? `: ${role.name}` : ''}`,
                    type: 'bonus',
                    scene: "班级",
                    category: "班务"
                });
            });
                
            batchUpdatePoints(updates);
            setConfig({ ...config, lastWageDate: today });
            const extraNotes = [];
            if (validPsychologyIds.length > 0) extraNotes.push(`${validPsychologyIds.length}位心理委员津贴`);
            if (paidCustomRoles.length > 0) extraNotes.push(`${paidCustomRoles.length}个班级职务津贴`);
            alert(`发放完成${extraNotes.length > 0 ? `（含${extraNotes.join("，")}）` : ''}`);
        };

        const handleRedeemTreasure = (studentId, itemId) => {
            const student = students.find(s => s.id === studentId);
            const item = treasures.find(t => t.id == itemId);
            if (!student || !item) return false;
            if (item.stock <= 0) {
                alert("库存不足");
                return false;
            }

            // 计算价格（考虑阶梯价格）
            let currentPrice = item.price;
            if (item.ladderPrices && Array.isArray(item.ladderPrices) && item.ladderPrices.length > 0) {
                const hist = redemptionHistory[studentId] || {};
                const count = hist[item.id] || 0;
                const index = Math.min(count, item.ladderPrices.length - 1);
                currentPrice = item.ladderPrices[index];
            }

            // 检查余额（负价格宝物的特殊逻辑）
            if (item.price < 0) {
                // 负价格宝物：余额必须小于0才能兑换，且兑换后余额不能大于0
                if (student.balance >= 0) {
                    alert("负价格宝物只能在余额小于0时兑换");
                    return false;
                }
                if (student.balance - currentPrice > 0) {
                    alert("兑换后余额不能大于0");
                    return false;
                }
            } else {
                // 正常价格：检查余额是否足够
                if (student.balance < currentPrice) {
                    alert("余额不足");
                    return false;
                }
            }

            // 更新库存
            const newTreasures = treasures.map(t => t.id === item.id ? { ...t, stock: t.stock - 1 } : t);

            // 更新储物箱
            const newStorage = { ...storage };
            const sStore = { ...(newStorage[studentId] || {}) };
            sStore[itemId] = (sStore[itemId] || 0) + 1;
            newStorage[studentId] = sStore;

            // 更新兑换历史
            const newRedemptionHistory = { ...redemptionHistory };
            const sHist = { ...(newRedemptionHistory[studentId] || {}) };
            sHist[item.id] = (sHist[item.id] || 0) + 1;
            newRedemptionHistory[studentId] = sHist;

            // 更新学生余额（使用 batchUpdatePoints 的逻辑）
            const ts = Date.now();
            const newStudents = students.map(s => {
                if (s.id !== studentId) return s;
                const newBalance = s.balance - currentPrice;
                return { ...s, balance: newBalance };
            });

            // 更新历史记录
            const snapshot = { 
                zizai: student.zizai, 
                balance: student.balance, 
                penalty: student.penalty 
            };
            const newHistory = [{
                id: ts + Math.random(),
                ts,
                studentId: student.id,
                studentName: student.name,
                val: -currentPrice,
                reason: `兑换: ${item.name}`,
                snapshot,
                type: 'spending',
                scene: "班级",
                category: "兑奖"
            }, ...history];

            // 添加日志
            const newLog = { 
                id: ts + Math.random(), 
                ts, 
                studentName: student.name, 
                action: "兑换", 
                itemName: item.name, 
                rarity: item.rarity, 
                cost: currentPrice, 
                note: "" 
            };
            const newLogs = [newLog, ...logs];

            setStorage(newStorage);
            setTreasures(newTreasures);
            setRedemptionHistory(newRedemptionHistory);
            setStudents(newStudents);
            setHistory(newHistory);
            setLogs(newLogs);

            let att = {};
            try { const r = getStorageItem('attendance_records'); if (r) att = JSON.parse(r); } catch (_) {}
            const fullData = {
                students: newStudents,
                history: newHistory,
                config,
                attendanceRecords: att,
                treasures: newTreasures,
                storage: newStorage,
                logs: newLogs,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory: newRedemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts,
                tasks,
                battle
            };
            persistData(fullData);
            return true;
        };

        const handleReturnItem = (studentId, itemId) => {
            const student = students.find(s => s.id === studentId);
            const item = treasures.find(t => t.id == itemId);
            if (!student || !item) return;
            const count = storage[studentId]?.[itemId] || 0;
            if (count <= 0) return;

            const hist = redemptionHistory[studentId] || {};
            const histCount = hist[item.id] || 0;
            let refund = item.price;
            if (item.ladderPrices && Array.isArray(item.ladderPrices) && item.ladderPrices.length > 0 && histCount > 0) {
                const idx = Math.min(histCount - 1, item.ladderPrices.length - 1);
                refund = item.ladderPrices[idx];
            }

            const newStorage = { ...storage };
            const sStore = { ...(newStorage[studentId] || {}) };
            sStore[itemId] = (sStore[itemId] || 0) - 1;
            if (sStore[itemId] <= 0) delete sStore[itemId];
            if (Object.keys(sStore).length === 0) delete newStorage[studentId]; else newStorage[studentId] = sStore;

            const newTreasures = treasures.map(t => t.id === item.id ? { ...t, stock: t.stock + 1 } : t);

            const newRedemptionHistory = { ...redemptionHistory };
            const sHist = { ...(newRedemptionHistory[studentId] || {}) };
            const c = (sHist[item.id] || 0) - 1;
            if (c <= 0) delete sHist[item.id]; else sHist[item.id] = c;
            if (Object.keys(sHist).length === 0) delete newRedemptionHistory[studentId]; else newRedemptionHistory[studentId] = sHist;

            const newStudents = students.map(s => {
                if (s.id !== studentId) return s;
                return { ...s, balance: s.balance + refund };
            });
            const ts = getNow().getTime();
            const newHistory = [{
                id: ts + Math.random(),
                ts,
                studentId: student.id,
                studentName: student.name,
                val: refund,
                reason: `退宝物: ${item.name}`,
                snapshot: { zizai: student.zizai, balance: student.balance, penalty: student.penalty },
                type: 'bonus',
                scene: "班级",
                category: "学业"
            }, ...history];

            const newLog = { id: ts + Math.random(), ts, studentName: student.name, action: "退宝物", itemName: item.name, rarity: item.rarity, cost: refund, note: "" };
            const newLogs = [newLog, ...logs];

            setStorage(newStorage);
            setTreasures(newTreasures);
            setRedemptionHistory(newRedemptionHistory);
            setStudents(newStudents);
            setHistory(newHistory);
            setLogs(newLogs);

            let att = {};
            try { const r = getStorageItem('attendance_records'); if (r) att = JSON.parse(r); } catch (_) {}
            const fullData = {
                students: newStudents,
                history: newHistory,
                config,
                attendanceRecords: att,
                treasures: newTreasures,
                storage: newStorage,
                logs: newLogs,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory: newRedemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts,
                tasks,
                battle
            };
            persistData(fullData);
        };

        const handleUseItem = (studentId, itemId) => {
            const student = students.find(s => s.id === studentId);
            const item = treasures.find(t => t.id == itemId);
            if (!student || !item) return false;
            const count = storage[studentId]?.[itemId] || 0;
            if (count <= 0) return false;

            const today = getTodayStr();
            if (item.dailyLimit > 0) {
                const currentCount = dailyUsageCounts[today]?.[itemId] || 0;
                if (currentCount >= item.dailyLimit) return false;
            }

            const newStorage = { ...storage };
            const sStore = { ...(newStorage[studentId] || {}) };
            sStore[itemId] = (sStore[itemId] || 0) - 1;
            if (sStore[itemId] <= 0) delete sStore[itemId];
            if (Object.keys(sStore).length === 0) delete newStorage[studentId]; else newStorage[studentId] = sStore;

            const newDailyUsageCounts = { ...dailyUsageCounts };
            const dayCounts = { ...(newDailyUsageCounts[today] || {}) };
            dayCounts[itemId] = (dayCounts[itemId] || 0) + 1;
            newDailyUsageCounts[today] = dayCounts;

            const ts = Date.now();
            const newLog = { id: ts + Math.random(), ts, studentName: student.name, action: "使用", itemName: item.name, rarity: item.rarity || "N", cost: 0, note: "" };
            const newLogs = [newLog, ...logs];

            setStorage(newStorage);
            setDailyUsageCounts(newDailyUsageCounts);
            setLogs(newLogs);

            let att = {};
            try { const r = getStorageItem('attendance_records'); if (r) att = JSON.parse(r); } catch (_) {}
            const fullData = {
                students,
                history,
                config,
                attendanceRecords: att,
                treasures,
                storage: newStorage,
                logs: newLogs,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts: newDailyUsageCounts,
                tasks,
                battle
            };
            persistData(fullData);
            return true;
        };

        const handleClaimTask = (taskId, studentId) => {
            if (!studentId) return false;
            const taskList = Array.isArray(tasks) ? tasks : [];
            const taskIndex = taskList.findIndex(t => t.id === taskId);
            if (taskIndex === -1) return false;
            const task = taskList[taskIndex];

            const now = getNow();
            const start = new Date(task.startTime || 0);
            const end = new Date(task.endTime || 0);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
            if (now < start) return false;
            if (now > end) return false;

            const claimed = task.claimedBy || [];
            if (claimed.length > 0) return false;

            const student = students.find(s => String(s.id) === String(studentId));
            if (!student) return false;

            const pts = parseFloat(task.points) || 0;
            const ts = getNow().getTime();
            const sid = student.id;
            const newTasks = taskList.map((t, i) =>
                i === taskIndex ? { ...t, claimedBy: [sid] } : t
            );
            const newStudents = students.map(s => {
                if (s.id !== sid) return s;
                return {
                    ...s,
                    zizai: (s.zizai || 0) + pts,
                    balance: (s.balance || 0) + pts
                };
            });
            const snapshot = {
                zizai: student.zizai,
                balance: student.balance,
                penalty: student.penalty
            };
            const newHistory = [{
                id: ts + Math.random(),
                ts,
                studentId: student.id,
                studentName: student.name,
                val: pts,
                reason: `完成任务: ${task.title}`,
                snapshot,
                type: 'bonus',
                scene: "班级",
                category: "学业"
            }, ...history];

            setTasks(newTasks);
            setStudents(newStudents);
            setHistory(newHistory);

            let att = {};
            try {
                const raw = getStorageItem('attendance_records');
                if (raw) att = JSON.parse(raw);
            } catch (_) {}
            const fullData = {
                students: newStudents,
                history: newHistory,
                config,
                attendanceRecords: att,
                treasures,
                storage,
                logs,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts,
                tasks: newTasks,
                battle
            };
            persistData(fullData);
            return true;
        };

        return h("div", { className: "min-h-screen pb-20" },
            h(Nav, { activeTab, setActiveTab, syncStatus, onRefresh: handleRefreshData, autoRefresh, setAutoRefresh, config }),
            h("main", { className: "max-w-6xl mx-auto p-4 mt-4" },
                activeTab === 'dashboard' && h(DashboardView, { students: displayStudents, studentProfiles, history, config, setConfig, updatePoints, handleUndo }),
                activeTab === 'operations' && h(OperationView, { students: displayStudents, selectedIds, setSelectedIds, filterGroup, setFilterGroup, filterDorm, setFilterDorm, opTab, setOpTab, updatePoints, handleWage, adjustModal, setAdjustModal, history, handleUndo, batchUpdatePoints, config }),
                activeTab === 'attendance' && h(AttendanceModule, { students: displayStudents, updatePoints, config, adminPassword: window.DEFAULT_ADMIN_PASSWORD, quotes, messages, setMessages, teacherMessages, setTeacherMessages, studentMessages: messages, setStudentMessages: setMessages, logs, attendanceRecords, handleUndoByReasons, onCheckInSuccess: (newAttRec) => { setAttendanceRecords(newAttRec); persistData({ students, history, config, attendanceRecords: newAttRec, treasures, storage, logs, quotes, messages: messages, teacherMessages, redemptionHistory, dailyRedemptionCounts, dailyUsageCounts, tasks, battle }); } }),
                activeTab === 'tasks' && (
                    tasksModuleStatus === 'ready' && TasksView
                        ? h(TasksView, { students: displayStudents, tasks, setTasks, onClaimTask: handleClaimTask, adminPassword: window.DEFAULT_ADMIN_PASSWORD })
                        : h("div", { className: "bg-white rounded-xl shadow-sm p-8 text-center space-y-3" },
                            h("div", { className: "text-lg font-bold text-gray-800" },
                                tasksModuleStatus === 'error' ? "任务模块加载失败" : "任务模块加载中"
                            ),
                            h("div", { className: "text-sm text-gray-500" },
                                tasksModuleStatus === 'error' ? "请重试加载任务模块。" : "首次打开任务页时会按需加载模块。"
                            ),
                            tasksModuleStatus === 'error' && h("button", {
                                onClick: () => setTasksModuleStatus('idle'),
                                className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            }, "重试")
                        )
                ),
                activeTab === 'battle' && (
                    battleModuleStatus === 'ready' && BattleView
                        ? h(BattleView, { students: displayStudents, battle, examArchives, battleSnapshots, setBattleSnapshots, setExamArchives, setBattle, onApplySettlementPoints: applyBattleSettlementToMainRecords, onPersistBattleSnapshots: (nextSnapshots) => persistDataPatch({ battleSnapshots: nextSnapshots }), isDirtyRef })
                        : h("div", { className: "bg-white rounded-xl shadow-sm p-8 text-center space-y-3" },
                            h("div", { className: "text-lg font-bold text-gray-800" },
                                battleModuleStatus === 'error' ? "双子星模块加载失败" : "双子星模块加载中"
                            ),
                            h("div", { className: "text-sm text-gray-500" },
                                battleModuleStatus === 'error' ? "请重试加载双子星模块。" : "首次打开双子星页时会按需加载模块。"
                            ),
                            battleModuleStatus === 'error' && h("button", {
                                onClick: () => setBattleModuleStatus('idle'),
                                className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            }, "重试")
                        )
                ),
                activeTab === 'treasure' && h(TreasureView, { 
                    students: displayStudents, updatePoints, adminPassword: window.DEFAULT_ADMIN_PASSWORD, 
                    treasures, setTreasures, storage, setStorage, logs, setLogs,
                    redemptionHistory, setRedemptionHistory, dailyRedemptionCounts, setDailyRedemptionCounts,
                    dailyUsageCounts, setDailyUsageCounts,
                    onReturnItem: handleReturnItem,
                    onRedeemTreasure: handleRedeemTreasure,
                    onUseItem: handleUseItem
                }),
                activeTab === 'profile' && (
                    profileModuleStatus === 'ready' && ProfileView
                        ? h(ProfileView, { students: displayStudents, studentProfiles, setStudentProfiles, history, adminPassword: window.DEFAULT_ADMIN_PASSWORD })
                        : h("div", { className: "bg-white rounded-xl shadow-sm p-8 text-center space-y-3" },
                            h("div", { className: "text-lg font-bold text-gray-800" },
                                profileModuleStatus === 'error' ? "头像模块加载失败" : "头像模块加载中"
                            ),
                            h("div", { className: "text-sm text-gray-500" },
                                profileModuleStatus === 'error' ? "请重试加载头像模块。" : "首次打开头像页时会按需加载模块。"
                            ),
                            profileModuleStatus === 'error' && h("button", {
                                onClick: () => setProfileModuleStatus('idle'),
                                className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            }, "重试")
                        )
                ),
                activeTab === 'settings' && h(SettingsView, { 
                    students: displayStudents, studentProfiles, history, config,
                    attendanceRecords, treasures, storage, logs,
                    setStudents, setStudentProfiles, setHistory, setConfig,
                    setAttendanceRecords, setTreasures, setStorage, setLogs,
                    quotes, setQuotes,
                    persistData,
                    persistDataPatch,
                    tasks, setTasks, messages, setMessages, teacherMessages, setTeacherMessages,
                    redemptionHistory, setRedemptionHistory, dailyRedemptionCounts, setDailyRedemptionCounts, dailyUsageCounts, setDailyUsageCounts,
                    battle, setBattle, examArchives, setExamArchives, battleSnapshots, setBattleSnapshots, isDirtyRef,
                    createSnapshot,
                    testMode, enterTestMode, exitTestMode,
                    simTime, setSimTime, timeSpeed, setTimeSpeed
                })
            ),
            h(Modal, { isOpen: modal.open, title: modal.title, onClose: () => setModal({ ...modal, open: false }), onConfirm: modal.onConfirm, type: modal.type }, modal.content)
        );
    };

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(h(App));
})();
