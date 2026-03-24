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

const normalizeCustomRoles = (roles, fallbackDailyWage = 0) => (
    Array.isArray(roles) ? roles : []
).map((role, idx) => ({
    id: role?.id || `custom_role_${idx + 1}`,
    name: role?.name || "",
    studentId: role?.studentId != null && role.studentId !== "" ? Number(role.studentId) : null,
    dailyWage: Number.isFinite(Number(role?.dailyWage)) ? Number(role.dailyWage) : fallbackDailyWage
}));
const normalizeCommissionerRoles = (roles, legacyAssignments = null) => {
    const roleList = Array.isArray(roles) ? roles : [];
    const legacyMap = legacyAssignments && typeof legacyAssignments === 'object' ? legacyAssignments : {};
    return roleList.map((role, idx) => {
        const ownStudentId = role?.studentId != null && role.studentId !== ""
            ? Number(role.studentId)
            : null;
        const legacyStudentId = role?.id && legacyMap[role.id] != null && legacyMap[role.id] !== ""
            ? Number(legacyMap[role.id])
            : null;
        return {
            id: role?.id || `commissioner_role_${idx + 1}`,
            name: role?.name || "",
            studentId: ownStudentId != null ? ownStudentId : legacyStudentId
        };
    });
};
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

const getLegacyTreasureList = (config) => {
    const treasures = config?.systemConfig?.treasures;
    return Array.isArray(treasures) ? treasures : null;
};

const stripSystemConfigTreasures = (systemConfig) => {
    if (!systemConfig || typeof systemConfig !== 'object') return systemConfig;
    if (!Object.prototype.hasOwnProperty.call(systemConfig, 'treasures')) return systemConfig;
    const { treasures, ...rest } = systemConfig;
    return rest;
};

const stripTreasureConfig = (config) => {
    if (!config || typeof config !== 'object') return config || {};
    if (!config.systemConfig || typeof config.systemConfig !== 'object') return config;
    const nextSystemConfig = stripSystemConfigTreasures(config.systemConfig);
    if (nextSystemConfig === config.systemConfig) return config;
    return { ...config, systemConfig: nextSystemConfig };
};

const stripLegacyPsychologyCommittee = (config) => {
    if (!config || typeof config !== 'object') return config || {};
    if (!Object.prototype.hasOwnProperty.call(config, 'psychologyCommittee')) return config;
    const { psychologyCommittee, ...rest } = config;
    return rest;
};

const sanitizeStoredConfig = (config) => stripLegacyPsychologyCommittee(stripTreasureConfig(config));

// --- 配置管理函数 ---
// 获取系统配置（从config.systemConfig读取，如果没有则使用默认值）
const getSystemConfig = (config) => {
    // 深度合并默认配置和用户配置
    const merged = JSON.parse(JSON.stringify(DEFAULT_SYSTEM_CONFIG));
    const userConfig = config?.systemConfig || {};
    
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
        if (userConfig.organization.commissionerRoles) {
            merged.organization.commissionerRoles = userConfig.organization.commissionerRoles;
        }
        if (Array.isArray(userConfig.organization.customRoles)) {
            merged.organization.customRoles = normalizeCustomRoles(userConfig.organization.customRoles);
        } else if (Array.isArray(userConfig.organization.studentCouncilRoles)) {
            merged.organization.customRoles = normalizeCustomRoles(userConfig.organization.studentCouncilRoles, 2);
        }
    }
    merged.organization.commissionerRoles = normalizeCommissionerRoles(merged.organization.commissionerRoles, config?.commissioners);
    
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
    if (Array.isArray(userConfig.treasures)) {
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

// 获取专员角色配置
const getCommissionerRoles = (config) => {
    const systemConfig = getSystemConfig(config);
    return systemConfig.organization.commissionerRoles;
};

const getCustomRoles = (config) => {
    const systemConfig = getSystemConfig(config);
    return normalizeCustomRoles(systemConfig.organization.customRoles || []);
};

// 获取藏宝阁商品配置
const getTreasuresConfig = (config) => {
    const systemConfig = getSystemConfig(config);
    return systemConfig.treasures;
};

const resolveTreasuresData = (treasures, config) => {
    if (Array.isArray(treasures)) {
        return treasures;
    }
    const legacyTreasures = getLegacyTreasureList(config);
    if (Array.isArray(legacyTreasures)) {
        return legacyTreasures;
    }
    return getTreasuresConfig(config);
};

const normalizeTreasureDomain = (domain) => {
    const safe = domain || {};
    const storage = safe.storage && typeof safe.storage === 'object' && !Array.isArray(safe.storage)
        ? safe.storage
        : {};
    return {
        treasures: Array.isArray(safe.treasures) ? safe.treasures : [],
        storage,
        logs: Array.isArray(safe.logs) ? safe.logs : []
    };
};

const hasTreasureDomainData = (domain) => {
    const normalized = normalizeTreasureDomain(domain);
    return normalized.treasures.length > 0
        || normalized.logs.length > 0
        || Object.keys(normalized.storage).length > 0;
};

const protectTreasureDomain = (nextDomain, readExistingDomain, options = {}) => {
    const normalizedNext = normalizeTreasureDomain(nextDomain);
    if (options.allowEmptyOverwrite || hasTreasureDomainData(normalizedNext)) {
        return normalizedNext;
    }
    const existing = typeof readExistingDomain === 'function'
        ? normalizeTreasureDomain(readExistingDomain())
        : normalizeTreasureDomain();
    if (hasTreasureDomainData(existing)) {
        console.warn('[藏宝阁] 检测到整域空覆盖风险，已保留现有藏宝阁数据');
        return existing;
    }
    return normalizedNext;
};

if (
    typeof window.createPointsConfigHelpers !== 'function' ||
    !window.PointsController ||
    !window.AttendancePoints ||
    !window.TreasurePoints ||
    !window.TreasureActions
) {
    throw new Error('Points helpers are missing');
}

const {
    POINT_SCENES,
    POINT_CATEGORIES,
    DEFAULT_POINT_SCENE,
    DEFAULT_POINT_CATEGORY,
    normalizePointScene,
    normalizePointCategory,
    getGroupsConfig,
    getDormsConfig,
    getReasonsPreset,
    getSubjectsConfig
} = window.createPointsConfigHelpers({
    getSystemConfig,
    DEFAULT_SYSTEM_CONFIG
});
const {
    batchUpdatePoints: runBatchUpdatePoints,
    updatePoints: runUpdatePoints,
    handleUndo: runHandleUndo,
    handleUndoByReasons: runHandleUndoByReasons,
    handleWage: runHandleWage
} = window.PointsController || {};

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

    const getNavView = () => {
        if (window.__NavViewComponent__) return window.__NavViewComponent__;
        if (typeof window.createNavView !== 'function') return null;
        window.__NavViewComponent__ = window.createNavView({
            h,
            Icon,
            getSystemConfig,
            getCurrentUser: () => window.__getCurrentUser__(),
            logout: () => window.__logout__()
        });
        return window.__NavViewComponent__;
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

    const getOperationView = () => {
        if (window.__OperationViewComponent__) return window.__OperationViewComponent__;
        if (typeof window.createOperationView !== 'function') return null;
        window.__OperationViewComponent__ = window.createOperationView({
            h,
            useState,
            useEffect,
            Modal,
            Icon,
            requireAdminAuth,
            getNow,
            getDateString,
            getSystemConfig,
            getGroupsConfig,
            getDormsConfig,
            getReasonsPreset,
            getSubjectsConfig,
            normalizePointScene,
            normalizePointCategory,
            POINT_SCENES,
            POINT_CATEGORIES,
            DEFAULT_POINT_SCENE,
            DEFAULT_POINT_CATEGORY
        });
        return window.__OperationViewComponent__;
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

    const getAttendanceView = () => {
        if (window.__AttendanceViewComponent__) return window.__AttendanceViewComponent__;
        if (typeof window.createAttendanceView !== 'function') return null;
        window.__AttendanceViewComponent__ = window.createAttendanceView({
            h,
            useState,
            useEffect,
            useMemo,
            Icon,
            requireAdminAuth,
            getNow,
            getDateString,
            getTodayStr,
            timeToMinutes,
            getSystemConfig,
            getScheduleConfig,
            getWeekendRules,
            getPenaltyRules,
            attendancePoints: window.AttendancePoints,
            AttendanceSettingsSection: getAttendanceSettingsSection()
        });
        return window.__AttendanceViewComponent__;
    };

    const getAttendanceSettingsSection = () => {
        if (window.__AttendanceSettingsSection__) return window.__AttendanceSettingsSection__;
        if (typeof window.createAttendanceSettingsSection !== 'function') return null;
        window.__AttendanceSettingsSection__ = window.createAttendanceSettingsSection({
            h,
            useState,
            Icon,
            requireAdminAuth,
            getTodayStr
        });
        return window.__AttendanceSettingsSection__;
    };

    const getTreasureView = () => {
        if (window.__TreasureViewComponent__) return window.__TreasureViewComponent__;
        if (typeof window.createTreasureView !== 'function') return null;
        window.__TreasureViewComponent__ = window.createTreasureView({
            h,
            useState,
            Modal,
            Icon,
            requireAdminAuth,
            getTodayStr
        });
        return window.__TreasureViewComponent__;
    };

    const getSettingsView = () => {
        if (window.__SettingsViewComponent__) return window.__SettingsViewComponent__;
        if (typeof window.createSettingsView !== 'function') return null;
        window.__SettingsViewComponent__ = window.createSettingsView({
            h,
            useState,
            useEffect,
            Icon,
            getNow,
            getDateString,
            getTodayStr,
            getStorageItem,
            setStorageItem,
            getSystemConfig,
            getGroupsConfig,
            getDormsConfig,
            getScheduleConfig,
            isAdminAuthed,
            clearAdminAuth,
            setAdminAuthUntil,
            ADMIN_AUTH_TTL_MS,
            DEFAULT_SYSTEM_CONFIG,
            stripTreasureConfig,
            stripSystemConfigTreasures,
            sanitizeStoredConfig,
            getLegacyTreasureList,
            normalizeCommissionerRoles,
            normalizeCustomRoles,
            getCustomRoles,
            getCommissionerRoles,
            buildNormalizedStudentProfiles,
            remapStudentProfilesToStudentsByName,
            hasStudentProfilesInData,
            restoreStudentProfilesFromData,
            battleNormalize,
            normalizeExamArchives,
            normalizeBattleSnapshots,
            loadScriptOnce,
            getExamArchivesView
        });
        return window.__SettingsViewComponent__;
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
        const [treasures, setTreasures] = useState(() => resolveTreasuresData(undefined, {}));
        const [storage, setStorage] = useState({});
        const [logs, setLogs] = useState([]);
        const [battle, setBattle] = useState({ version: 1, teams: [], squads: [], battles: [], logs: [], history: [], settlements: [], season: 1, rules: {}, teamBaseExamId: '', settleExamId: '' });
        const [examArchives, setExamArchives] = useState(() => normalizeExamArchives());
        const [battleSnapshots, setBattleSnapshots] = useState(() => normalizeBattleSnapshots());
        // NEW: Quotes state
        const [quotes, setQuotes] = useState(() => window.DEFAULT_QUOTES);
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

        const [syncStatus, setSyncStatus] = useState('idle'); // idle, success, error, saved, unsaved
        const [localHydrationDone, setLocalHydrationDone] = useState(false);
            
        const [config, setConfig] = useState({
            duty: { mon: ["", ""], tue: [""], wed: [""], thu: [""], fri: [""] },
            commissioners: getDefaultCommissioners(),
            lastWageDate: "",
            frozen: false,
            scheduleNotes: {},
            countdownEvents: []
        });
        const effectiveTreasures = resolveTreasuresData(treasures, config);
        const prevFrozenRef = useRef(!!(config && config.frozen));
            
        const [modal, setModal] = useState({ open: false, title: "", content: null, onConfirm: null, type: 'info' });
        const NavView = getNavView();
        const DashboardView = getDashboardView();
        const OperationView = getOperationView();
        const AttendanceView = getAttendanceView();
        const TreasureView = getTreasureView();
        const SettingsView = getSettingsView();
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
            loadScriptOnce('tasks/points.js')
                .then(() => loadScriptOnce('tasks-module.js'))
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
        const retryTimerRef = useRef(null);
        const serverMetaRef = useRef({ updatedAt: 0 });
        const initialServerSyncDoneRef = useRef(!getApiUrl());
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

        const protectTreasureDomainForPersistence = useCallback((nextDomain, options = {}) => {
            return protectTreasureDomain(nextDomain, () => ({ treasures, storage, logs }), options);
        }, [treasures, storage, logs]);

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
                config: sanitizeStoredConfig(safe.config),
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
            const incomingTreasures = resolveTreasuresData(normalized.treasures, normalized.config || config);
            const hasIncomingLegacyTreasureConfig = Array.isArray(getLegacyTreasureList(normalized.config));

            if (use(normalized.flags.students)) setStudents(normalized.students || []);
            if (use(normalized.flags.studentProfiles)) setStudentProfiles(restoreStudentProfilesFromData(normalized, studentProfiles, students));
            if (use(normalized.flags.history)) {
                const incomingHistory = normalized.history || [];
                const hasLocalHistory = Array.isArray(history) && history.length > 0;
                const hasIncomingHistory = Array.isArray(incomingHistory) && incomingHistory.length > 0;
                const keepLocal = !options.force && hasLocalHistory && !hasIncomingHistory;
                if (!keepLocal) setHistory(incomingHistory);
            }
            if (use(normalized.flags.config)) setConfig(sanitizeStoredConfig(normalized.config || {}));

            if (use(normalized.flags.attendanceRecords)) {
                const att = options.mergeAttendance
                    ? mergeAttendanceRecords(attendanceRecords || {}, normalized.attendanceRecords || {})
                    : (normalized.attendanceRecords || {});
                setAttendanceRecords(att);
            }

            if (use(normalized.flags.treasures) || hasIncomingLegacyTreasureConfig) {
                setTreasures(Array.isArray(incomingTreasures) ? incomingTreasures : []);
            }
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

        const enterTestMode = useCallback(() => {
            if (testMode) return;
            testSnapshotRef.current = {
                students: deepClone(students),
                studentProfiles: deepClone(buildNormalizedStudentProfiles(studentProfiles, students)),
                history: deepClone(history),
                config: deepClone(sanitizeStoredConfig(config)),
                attendanceRecords: deepClone(attendanceRecords),
                treasures: deepClone(effectiveTreasures),
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
                activeTab
            };
            window.__CM_TEST_STORAGE__ = snapshotStorage();
            setTestMode(true);
            setSimTime(getNow().getTime());
            setTimeSpeed(1);
            setSyncStatus('saved');
        }, [testMode, students, studentProfiles, history, config, attendanceRecords, effectiveTreasures, storage, logs, quotes, messages, teacherMessages, redemptionHistory, dailyRedemptionCounts, dailyUsageCounts, tasks, battle, examArchives, battleSnapshots, activeTab]);

        const exitTestMode = useCallback(() => {
            if (!testMode) return;
            const snap = testSnapshotRef.current;
            if (snap) {
                setStudents(snap.students || []);
                setStudentProfiles(restoreStudentProfilesFromData(snap, studentProfiles, students));
                setHistory(snap.history || []);
                setConfig(sanitizeStoredConfig(snap.config || {}));
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
                if (snap.activeTab) setActiveTab(snap.activeTab);
            }
            window.__CM_TEST_STORAGE__ = null;
            setTestMode(false);
            setSimTime(Date.now());
            setTimeSpeed(1);
            setSyncStatus('saved');
        }, [testMode]);

        const buildCurrentFullData = useCallback((overrides = {}) => {
            const att = Object.prototype.hasOwnProperty.call(overrides, 'attendanceRecords')
                ? overrides.attendanceRecords
                : (attendanceRecords || {});
            const nextStudents = Object.prototype.hasOwnProperty.call(overrides, 'students') ? overrides.students : students;
            const nextStudentProfiles = restoreStudentProfilesFromData(overrides, studentProfiles, nextStudents);
            const rawNextConfig = Object.prototype.hasOwnProperty.call(overrides, 'config') ? overrides.config : config;
            const nextConfig = sanitizeStoredConfig(rawNextConfig);
            const migratedTreasures = resolveTreasuresData(undefined, rawNextConfig);
            const nextTreasures = Object.prototype.hasOwnProperty.call(overrides, 'treasures')
                ? overrides.treasures
                : (Array.isArray(getLegacyTreasureList(rawNextConfig)) ? migratedTreasures : effectiveTreasures);
            return {
                history,
                attendanceRecords: att,
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
                config: nextConfig,
                treasures: Array.isArray(nextTreasures) ? nextTreasures : effectiveTreasures,
                students: nextStudents,
                studentProfiles: nextStudentProfiles
            };
        }, [attendanceRecords, students, studentProfiles, history, config, effectiveTreasures, storage, logs, quotes, messages, teacherMessages, redemptionHistory, dailyRedemptionCounts, dailyUsageCounts, tasks, battle, examArchives, battleSnapshots]);

        const savePayloadToServer = useCallback((payload, nowTs) => {
            if (window.__CM_TEST_MODE__) {
                setSyncStatus('saved');
                isSavingRef.current = false;
                return Promise.resolve({ success: true, updatedAt: nowTs });
            }
            const apiUrl = getApiUrl();
            if (!apiUrl) {
                setSyncStatus('error');
                isSavingRef.current = false;
                return Promise.reject(new Error('SERVER_UNAVAILABLE'));
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
                    isSavingRef.current = false;
                    return { success: true, updatedAt: savedUpdatedAt };
                })
                .catch((err) => {
                    if (err?.message === 'DATA_CONFLICT') throw err;
                    setSyncStatus('unsaved');
                    isSavingRef.current = false;
                    throw err;
                });
        }, []);

        const persistDataPatch = useCallback((partialData) => {
            isSavingRef.current = true;
            const nowTs = getNow().getTime();
            const fullData = buildCurrentFullData(partialData || {});
            const normalizedInput = normalizeFullData(fullData);
            const safeTreasureDomain = protectTreasureDomainForPersistence({
                treasures: fullData?.treasures,
                storage: fullData?.storage,
                logs: fullData?.logs
            });
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
                config: sanitizeStoredConfig(fullData?.config),
                treasures: safeTreasureDomain.treasures,
                storage: safeTreasureDomain.storage,
                logs: safeTreasureDomain.logs,
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
            const payload = { ...partialData, __meta: fullDataWithMeta.__meta };
            if (partialData && Object.prototype.hasOwnProperty.call(partialData, 'config')) {
                payload.config = sanitizeStoredConfig(partialData.config);
            }
            if (partialData && Object.prototype.hasOwnProperty.call(partialData, 'treasures')) {
                payload.treasures = safeTreasureDomain.treasures;
            }
            if (partialData && Object.prototype.hasOwnProperty.call(partialData, 'storage')) {
                payload.storage = safeTreasureDomain.storage;
            }
            if (partialData && Object.prototype.hasOwnProperty.call(partialData, 'logs')) {
                payload.logs = safeTreasureDomain.logs;
            }
            return savePayloadToServer(payload, nowTs);
        }, [buildCurrentFullData, students, studentProfiles, battle, examArchives, battleSnapshots, savePayloadToServer, protectTreasureDomainForPersistence]);

        /** 统一持久化：将当前完整数据写入服务器。 */
        const persistData = useCallback((fullData) => {
            isSavingRef.current = true;
            const nowTs = getNow().getTime();
            const normalizedInput = normalizeFullData(fullData);
            const safeTreasureDomain = protectTreasureDomainForPersistence({
                treasures: fullData?.treasures,
                storage: fullData?.storage,
                logs: fullData?.logs
            });
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
                config: sanitizeStoredConfig(fullData?.config),
                treasures: safeTreasureDomain.treasures,
                storage: safeTreasureDomain.storage,
                logs: safeTreasureDomain.logs,
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
            return savePayloadToServer(fullDataWithMeta, nowTs);
        }, [students, studentProfiles, battle, examArchives, battleSnapshots, savePayloadToServer, protectTreasureDomainForPersistence]);

        const fetchFromServer = useCallback((isAuto = false) => {
            if (window.__CM_TEST_MODE__) {
                if (!isAuto) alert("测试模式中已禁止同步。");
                return;
            }
            const apiUrl = getApiUrl();
            if (!apiUrl) {
                if (!isAuto) {
                    console.warn("Manual refresh ignored: unsupported runtime environment.");
                    alert("当前环境无法连接服务器。");
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
                .then(data => {
                    if (!data) return;
                    if (data && Object.keys(data).length > 0) {
                        const normalized = normalizeFullData(data);
                        const remoteTs = Number(normalized.__meta.updatedAt) || 0;
                        markServerMeta(remoteTs);
                        applyFullData(data, { mergeAttendance: true });
                        setSyncStatus('success');
                        if(!isAuto) alert("数据已从服务器刷新！");
                        console.log(`[${getNow().toLocaleTimeString()}] 数据同步完成`);
                        if (retryTimerRef.current) {
                            clearTimeout(retryTimerRef.current);
                            retryTimerRef.current = null;
                        }
                    } else {
                        initialServerSyncDoneRef.current = true;
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

        useEffect(() => {
            // 1. Initial sync
            setLocalHydrationDone(true);
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
                const safeTreasureDomain = protectTreasureDomainForPersistence({ treasures, storage, logs });

                const fullData = {
                    students: students || [],
                    studentProfiles: buildNormalizedStudentProfiles(studentProfiles, students),
                    history: history || [],
                    config: sanitizeStoredConfig(config || {}),
                    quotes: quotes || [],
                    messages: messages || [],
                    teacherMessages: teacherMessages || [],
                    redemptionHistory: redemptionHistory || {},
                    dailyRedemptionCounts: dailyRedemptionCounts || {},
                    dailyUsageCounts: dailyUsageCounts || {},
                    tasks: tasks || [],
                    attendanceRecords: attendanceRecords || {},
                    treasures: safeTreasureDomain.treasures,
                    storage: safeTreasureDomain.storage,
                    logs: safeTreasureDomain.logs,
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
        }, [students, studentProfiles, history, config, quotes, messages, teacherMessages, redemptionHistory, dailyRedemptionCounts, dailyUsageCounts, tasks, battle, examArchives, battleSnapshots, treasures, storage, logs, protectTreasureDomainForPersistence]);

        // 动态更新页面标题
        useEffect(() => {
            const systemConfig = getSystemConfig(config);
            const className = systemConfig.className || "班级自在管理系统";
            document.title = className;
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
                const safeTreasureDomain = protectTreasureDomainForPersistence({ treasures, storage, logs });

                const fullData = {
                    students: students || [],
                    studentProfiles: buildNormalizedStudentProfiles(studentProfiles, students),
                    history: history || [],
                    config: sanitizeStoredConfig(config || {}),
                    quotes: quotes || [],
                    messages: messages || [],
                    teacherMessages: teacherMessages || [],
                    redemptionHistory: redemptionHistory || {},
                    dailyRedemptionCounts: dailyRedemptionCounts || {},
                    dailyUsageCounts: dailyUsageCounts || {},
                    tasks: tasks || [],
                    attendanceRecords: attendanceRecords || {},
                    treasures: safeTreasureDomain.treasures,
                    storage: safeTreasureDomain.storage,
                    logs: safeTreasureDomain.logs,
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
        }, [students, studentProfiles, history, config, quotes, messages, teacherMessages, redemptionHistory, dailyRedemptionCounts, dailyUsageCounts, tasks, treasures, storage, logs, battle, examArchives, battleSnapshots, protectTreasureDomainForPersistence]);


        // --- 自动保存逻辑 (Debounced) ---
        useEffect(() => {
            if (!localHydrationDone) return undefined;
            isDirtyRef.current = true;

            if (!window.__CM_TEST_MODE__ && getApiUrl() && !initialServerSyncDoneRef.current) {
                isDirtyRef.current = false;
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
        }, [localHydrationDone, students, studentProfiles, history, config, attendanceRecords, treasures, storage, logs, quotes, messages, teacherMessages, redemptionHistory, dailyRedemptionCounts, dailyUsageCounts, tasks, persistData, buildCurrentFullData]);

        useEffect(() => {
            if (!localHydrationDone) return undefined;
            isDirtyRef.current = true;

            if (!window.__CM_TEST_MODE__ && getApiUrl() && !initialServerSyncDoneRef.current) {
                isDirtyRef.current = false;
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
        }, [localHydrationDone, battle, examArchives, battleSnapshots, persistDataPatch]);


        // NEW Batch Update Function
        const batchUpdatePoints = useCallback((updates) => runBatchUpdatePoints({
            updates,
            POINT_SCENES,
            POINT_CATEGORIES,
            getNow,
            setStudents,
            setHistory,
            GUEST_ROSTER,
            normalizePointScene,
            normalizePointCategory
        }), []);

        const updatePoints = (ids, val, reason, type = 'bonus', scene, category) => runUpdatePoints({
            ids,
            val,
            reason,
            type,
            scene,
            category,
            POINT_SCENES,
            POINT_CATEGORIES,
            batchUpdatePoints
        });

        const applyBattleSettlementToMainRecords = ({ updates, summaryText }) => {
            const battleTransfer = window.BattleTransfer || {};
            if (typeof battleTransfer.applySettlementPoints !== 'function') {
                alert("双子星结算入账工具未加载");
                return { applied: false, count: 0, skipped: true };
            }
            return battleTransfer.applySettlementPoints({
                updates,
                summaryText,
                batchUpdatePoints
            });
        };

        const handleUndo = (recordId) => runHandleUndo({
            recordId,
            history,
            students,
            setStudents,
            setHistory,
            normalizePointScene,
            normalizePointCategory
        });
        
        const handleUndoByReasons = (studentId, reasons) => runHandleUndoByReasons({
            studentId,
            reasons,
            history,
            handleUndo
        });

        const handleWage = () => runHandleWage({
            config,
            students,
            getTodayStr,
            getSystemConfig,
            getCustomRoles,
            batchUpdatePoints,
            setConfig
        });

        const runTreasureAction = (builderName, params) => {
            const treasureActions = window.TreasureActions || {};
            if (typeof treasureActions[builderName] !== 'function') {
                return { ok: false, message: "藏宝阁操作未加载" };
            }
            return treasureActions[builderName](params);
        };

        const commitTreasureAction = (result) => {
            if (!result?.ok) return result || { ok: false, message: "藏宝阁操作失败" };
            const nextState = result.nextState || {};
            if (Object.prototype.hasOwnProperty.call(nextState, 'students')) setStudents(nextState.students || []);
            if (Object.prototype.hasOwnProperty.call(nextState, 'history')) setHistory(nextState.history || []);
            if (Object.prototype.hasOwnProperty.call(nextState, 'treasures')) setTreasures(nextState.treasures || []);
            if (Object.prototype.hasOwnProperty.call(nextState, 'storage')) setStorage(nextState.storage || {});
            if (Object.prototype.hasOwnProperty.call(nextState, 'logs')) setLogs(nextState.logs || []);
            if (Object.prototype.hasOwnProperty.call(nextState, 'redemptionHistory')) setRedemptionHistory(nextState.redemptionHistory || {});
            if (Object.prototype.hasOwnProperty.call(nextState, 'dailyUsageCounts')) setDailyUsageCounts(nextState.dailyUsageCounts || {});
            if (Object.prototype.hasOwnProperty.call(nextState, 'dailyRedemptionCounts')) setDailyRedemptionCounts(nextState.dailyRedemptionCounts || {});
            persistData(buildCurrentFullData(nextState));
            return result;
        };

        const handleRedeemTreasure = (studentId, itemId) => commitTreasureAction(runTreasureAction('buildTreasureRedeemAction', {
            studentId,
            itemId,
            students,
            treasures,
            storage,
            history,
            logs,
            redemptionHistory,
            getNow
        }));

        const handleReturnItem = (studentId, itemId) => commitTreasureAction(runTreasureAction('buildTreasureReturnAction', {
            studentId,
            itemId,
            students,
            treasures,
            storage,
            history,
            logs,
            redemptionHistory,
            getNow
        }));

        const handleUseItem = (studentId, itemId) => commitTreasureAction(runTreasureAction('buildTreasureUseAction', {
            studentId,
            itemId,
            students,
            treasures,
            storage,
            logs,
            dailyUsageCounts,
            getTodayStr,
            getNow
        }));

        const handlePerformGacha = (studentId, times) => commitTreasureAction(runTreasureAction('buildTreasureGachaAction', {
            studentId,
            times,
            students,
            treasures,
            storage,
            history,
            logs,
            getNow
        }));

        const handleSaveTreasureItem = (draft, editMode) => commitTreasureAction(runTreasureAction('buildTreasureSaveItemAction', {
            draft,
            editMode,
            treasures,
            logs,
            getNow
        }));

        const handleDeleteTreasureItem = (itemId) => commitTreasureAction(runTreasureAction('buildTreasureDeleteItemAction', {
            itemId,
            treasures,
            storage,
            logs,
            redemptionHistory,
            dailyUsageCounts,
            getNow
        }));

        const handleClaimTask = (taskId, studentId) => {
            const tasksPoints = window.TasksPoints || {};
            if (typeof tasksPoints.buildTaskClaimState !== 'function') return false;
            const result = tasksPoints.buildTaskClaimState({
                taskId,
                studentId,
                tasks,
                students,
                history,
                getNow
            });
            if (!result?.ok) return false;

            setTasks(result.nextTasks);
            setStudents(result.nextStudents);
            setHistory(result.nextHistory);

            const fullData = {
                students: result.nextStudents,
                history: result.nextHistory,
                config,
                attendanceRecords: attendanceRecords || {},
                treasures,
                storage,
                logs,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts,
                tasks: result.nextTasks,
                battle
            };
            persistData(fullData);
            return true;
        };

        const handleAttendanceRecordsChange = useCallback((nextRecords) => {
            setAttendanceRecords(nextRecords || {});
        }, []);

        return h("div", { className: "min-h-screen pb-20" },
            h(NavView, { activeTab, setActiveTab, syncStatus, config }),
            h("main", { className: "max-w-6xl mx-auto p-4 mt-4" },
                activeTab === 'dashboard' && h(DashboardView, { students: displayStudents, studentProfiles, history, config, setConfig, updatePoints, handleUndo }),
                activeTab === 'operations' && h(OperationView, { students: displayStudents, handleWage, history, handleUndo, batchUpdatePoints, config, setConfig, setHistory }),
                activeTab === 'attendance' && (
                    AttendanceView
                        ? h(AttendanceView, { students: displayStudents, updatePoints, config, adminPassword: window.DEFAULT_ADMIN_PASSWORD, quotes, messages, setMessages, teacherMessages, setTeacherMessages, studentMessages: messages, setStudentMessages: setMessages, logs, attendanceRecords, handleUndoByReasons, onAttendanceRecordsChange: handleAttendanceRecordsChange, onUpdateAttendanceConfig: (nextSystemConfig) => { setConfig(sanitizeStoredConfig({ ...config, systemConfig: stripSystemConfigTreasures(nextSystemConfig) })); if (Array.isArray(nextSystemConfig.quotes)) setQuotes(nextSystemConfig.quotes); } })
                        : h("div", { className: "bg-white rounded-xl shadow-sm p-8 text-center space-y-3" },
                            h("div", { className: "text-lg font-bold text-gray-800" }, "考勤模块加载失败"),
                            h("div", { className: "text-sm text-gray-500" }, "请检查 `attendance/module.js` 是否正常加载。")
                        )
                ),
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
                    students: displayStudents, adminPassword: window.DEFAULT_ADMIN_PASSWORD,
                    treasures, storage, logs,
                    redemptionHistory, dailyUsageCounts,
                    onReturnItem: handleReturnItem,
                    onRedeemTreasure: handleRedeemTreasure,
                    onUseItem: handleUseItem,
                    onPerformGacha: handlePerformGacha,
                    onSaveItem: handleSaveTreasureItem,
                    onDeleteItem: handleDeleteTreasureItem
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
