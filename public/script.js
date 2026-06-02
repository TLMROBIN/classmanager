const schema = window.ClassManagerSchema;
if (!schema) {
    throw new Error('ClassManagerSchema failed to load');
}
const {
    DEFAULT_QUOTES,
    DEFAULT_SYSTEM_CONFIG,
    normalizeTreasureGachaConfig,
    formatTreasureGachaSettingsSummary,
    normalizeCustomRoles,
    normalizeCommissionerRoles,
    normalizeExamArchives,
    getLatestExamArchiveRank,
    getLegacyTreasureList,
    stripSystemConfigTreasures,
    sanitizeStoredConfig,
    getSystemConfig,
    getScheduleConfig,
    getWeekendRules,
    getPenaltyRules,
    getCommissionerRoles,
    getCustomRoles,
    getTreasureGachaConfig,
    resolveTreasuresData,
    protectTreasureDomain,
    getDefaultCommissioners,
    mergeAttendanceRecords
} = schema;

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
if (
    typeof window.createPointsConfigHelpers !== 'function' ||
    !window.PointsController ||
    !window.AttendancePoints ||
    !window.TreasurePoints ||
    !window.TreasureActions ||
    !window.ClassPetState ||
    !window.ClassPetData
) {
    throw new Error('Core helpers are missing');
}

const petState = window.ClassPetState || {};
const {
    reconcilePetDomain,
    renamePet,
    purchasePetItem,
    hatchPet,
    resetPetSystem
} = petState;
if (!reconcilePetDomain || !renamePet || !purchasePetItem || !hatchPet || !resetPetSystem) {
    throw new Error('Pet state helpers are missing');
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
    handleWage: runHandleWage
} = window.PointsController || {};

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
    const runtime = window.ClassManagerRuntime;
    if (!runtime) {
        throw new Error('ClassManagerRuntime failed to load');
    }

    const {
        TEST_SESSION_INVALID_EVENT,
        initialTestSessionState,
        getStorageItem,
        setStorageItem,
        storeTestSessionState,
        clearStoredTestSessionState,
        applyTestRuntimeContext,
        handleTestSessionApiError,
        getTestRequestHeaders,
        getNow,
        getTodayStr,
        timeToMinutes,
        getDateString,
        DAY_MS,
        getStartOfDay,
        diffDays,
        getApiUrl,
        loadScriptOnce,
        clearAdminAuth,
        clearScopedTestArtifacts,
        isAdminAuthed,
        getAdminAuthHeaders,
        parseApiResponse,
        requestAttendanceJson,
        fetchMaintenanceStatus,
        unlockAdminAuth,
        setupAdminAuth,
        changeAdminAuthPassword,
        requireAdminAuth
    } = runtime;

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
            heart: h("path", { d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" }),
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

    const createClassManagerModal = window.createClassManagerModal;
    if (typeof createClassManagerModal !== 'function') {
        throw new Error('ClassManagerModal failed to load');
    }
    const Modal = createClassManagerModal({
        h,
        Icon
    });

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
            requireAdminAuth,
            getNow
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
            requireAdminAuth,
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
            useRef,
            Modal,
            Icon,
            requireAdminAuth,
            getNow,
            getTodayStr,
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
            getTodayStr,
            getNow,
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
            Modal,
            Icon,
            requireAdminAuth,
            getTodayStr,
            getNow,
            battleState: stateFactory,
            battleSimulator: simulatorFactory,
            battleNormalize,
            normalizeExamArchives,
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
            useRef,
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

    const getPetView = () => {
        if (window.__PetViewComponent__) return window.__PetViewComponent__;
        if (typeof window.createPetView !== 'function') return null;
        window.__PetViewComponent__ = window.createPetView({
            h,
            useState,
            useEffect,
            Icon,
            Modal,
            requireAdminAuth
        });
        return window.__PetViewComponent__;
    };

    const getSettingsView = () => {
        if (window.__SettingsViewComponent__) return window.__SettingsViewComponent__;
        if (
            typeof window.createSettingsView !== 'function' ||
            typeof window.createSettingsExamArchivesSection !== 'function' ||
            typeof window.createSettingsStudentRosterSection !== 'function' ||
            typeof window.createSettingsSystemConfigSection !== 'function' ||
            typeof window.createSettingsToolsSection !== 'function' ||
            typeof window.createSettingsBehaviorAlertSection !== 'function'
        ) return null;
        window.__SettingsViewComponent__ = window.createSettingsView({
            h,
            useState,
            useEffect,
            useMemo,
            Icon,
            getNow,
            getDateString,
            getTodayStr,
            getSystemConfig,
            getGroupsConfig,
            getDormsConfig,
            getScheduleConfig,
            isAdminAuthed,
            clearAdminAuth,
            unlockAdminAuth,
            setupAdminAuth,
            changeAdminAuthPassword,
            fetchMaintenanceStatus,
            DEFAULT_SYSTEM_CONFIG,
            stripSystemConfigTreasures,
            sanitizeStoredConfig,
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
            loadScriptOnce,
            getExamArchivesView,
            normalizePointScene,
            normalizePointCategory,
            POINT_SCENES,
            POINT_CATEGORIES,
            createSettingsExamArchivesSection: window.createSettingsExamArchivesSection,
            createSettingsStudentRosterSection: window.createSettingsStudentRosterSection,
            createSettingsSystemConfigSection: window.createSettingsSystemConfigSection,
            createSettingsToolsSection: window.createSettingsToolsSection,
            createSettingsBehaviorAlertSection: window.createSettingsBehaviorAlertSection
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

    const createClassManagerSync = window.createClassManagerSync;
    if (typeof createClassManagerSync !== 'function') {
        throw new Error('ClassManagerSync failed to load');
    }
    const useClassManagerSync = createClassManagerSync({
        useRef,
        useState,
        useEffect,
        useCallback,
        getApiUrl,
        getNow,
        getStorageItem,
        setStorageItem,
        getTestRequestHeaders,
        handleTestSessionApiError,
        parseApiResponse,
        getAdminAuthHeaders,
        clearAdminAuth,
        clearScopedTestArtifacts,
        clearStoredTestSessionState,
        applyTestRuntimeContext,
        requestAttendanceJson,
        buildNormalizedStudentProfiles,
        hasStudentProfilesInData,
        restoreStudentProfilesFromData,
        sanitizeStoredConfig,
        normalizeExamArchives,
        resolveTreasuresData,
        getLegacyTreasureList,
        mergeAttendanceRecords,
        battleNormalize,
        protectTreasureDomain,
        DEFAULT_QUOTES,
        TEST_SESSION_INVALID_EVENT
    });
    const createClassManagerStore = window.createClassManagerStore;
    if (typeof createClassManagerStore !== 'function') {
        throw new Error('ClassManagerStore failed to load');
    }
    const useClassManagerStore = createClassManagerStore({
        useState,
        buildNormalizedStudentProfiles,
        resolveTreasuresData,
        normalizeExamArchives,
        getDefaultCommissioners,
        getTreasureGachaConfig,
        GUEST_ROSTER,
        initialTestSessionState,
        DEFAULT_QUOTES
    });

    // --- 核心 App ---
    var App = function() {
        const {
            activeTab,
            setActiveTab,
            students,
            setStudents,
            studentProfiles,
            setStudentProfiles,
            history,
            setHistory,
            attendanceRecords,
            setAttendanceRecords,
            pets,
            setPets,
            treasures,
            setTreasures,
            storage,
            setStorage,
            logs,
            setLogs,
            battle,
            setBattle,
            examArchives,
            setExamArchives,
            quotes,
            setQuotes,
            messages,
            setMessages,
            teacherMessages,
            setTeacherMessages,
            redemptionHistory,
            setRedemptionHistory,
            dailyRedemptionCounts,
            setDailyRedemptionCounts,
            dailyUsageCounts,
            setDailyUsageCounts,
            liquidatedTreasures,
            setLiquidatedTreasures,
            tasks,
            setTasks,
            profileModuleStatus,
            setProfileModuleStatus,
            tasksModuleStatus,
            setTasksModuleStatus,
            battleModuleStatus,
            setBattleModuleStatus,
            petModuleStatus,
            setPetModuleStatus,
            settingsModuleStatus,
            setSettingsModuleStatus,
            displayStudents,
            testSessionId,
            setTestSessionId,
            testMode,
            setTestMode,
            simTime,
            setSimTime,
            timeSpeed,
            setTimeSpeed,
            syncStatus,
            setSyncStatus,
            localHydrationDone,
            setLocalHydrationDone,
            config,
            setConfig,
            effectiveTreasures,
            treasureGachaConfig,
            modal,
            setModal
        } = useClassManagerStore();
        const NavView = getNavView();
        const DashboardView = getDashboardView();
        const OperationView = getOperationView();
        const AttendanceView = getAttendanceView();
        const TreasureView = getTreasureView();
        const PetView = petModuleStatus === 'ready' ? getPetView() : null;
        const SettingsView = settingsModuleStatus === 'ready' ? getSettingsView() : null;
        const ProfileView = profileModuleStatus === 'ready' ? getProfileView() : null;
        const TasksView = tasksModuleStatus === 'ready' ? getTasksView() : null;
        const BattleView = battleModuleStatus === 'ready' ? getBattleView() : null;
        const petFeatureEnabled = getSystemConfig(config).enabledFeatures?.pet === true;
        const loadWeeklyReportHelperScript = useCallback(async (src) => {
            try {
                const res = await fetch(src, { method: 'HEAD', cache: 'no-store' });
                if (!res.ok) return false;
            } catch (_) {
                return false;
            }
            await loadScriptOnce(src);
            return true;
        }, []);
        const loadWeeklyReportHelperScripts = useCallback(async () => {
            const helperScripts = [
                'weekly-report/utils.js',
                'weekly-report/builder.js',
                'weekly-report/markdown.js'
            ];
            for (const src of helperScripts) {
                await loadWeeklyReportHelperScript(src);
            }
        }, [loadWeeklyReportHelperScript]);

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
            if (activeTab !== 'pet' || petModuleStatus === 'ready' || petModuleStatus === 'loading') return;
            setPetModuleStatus('loading');
            loadScriptOnce('pet/module.js')
                .then(() => {
                    if (typeof window.createPetView === 'function') {
                        getPetView();
                        setPetModuleStatus('ready');
                    } else {
                        setPetModuleStatus('error');
                    }
                })
                .catch(err => {
                    console.error('加载宠物模块失败:', err);
                    setPetModuleStatus('error');
                });
        }, [activeTab, petModuleStatus]);

        useEffect(() => {
            if (activeTab === 'pet' && !petFeatureEnabled) {
                setActiveTab('dashboard');
            }
        }, [activeTab, petFeatureEnabled, setActiveTab]);

        useEffect(() => {
            if (activeTab !== 'settings' || settingsModuleStatus === 'ready' || settingsModuleStatus === 'loading') return;
            setSettingsModuleStatus('loading');
            loadScriptOnce('settings/exam-archives-section.js')
                .then(() => loadScriptOnce('settings/student-roster-section.js'))
                .then(() => loadScriptOnce('settings/system-config-section.js'))
                .then(() => loadWeeklyReportHelperScripts())
                .then(() => loadScriptOnce('settings/tools-section.js'))
                .then(() => loadScriptOnce('settings/behavior-alert-section.js'))
                .then(() => loadScriptOnce('settings/module.js'))
                .then(() => {
                    if (
                        typeof window.createSettingsView === 'function' &&
                        typeof window.createSettingsExamArchivesSection === 'function' &&
                        typeof window.createSettingsStudentRosterSection === 'function' &&
                        typeof window.createSettingsSystemConfigSection === 'function' &&
                        typeof window.createSettingsToolsSection === 'function' &&
                        typeof window.createSettingsBehaviorAlertSection === 'function'
                    ) {
                        getSettingsView();
                        setSettingsModuleStatus('ready');
                    } else {
                        setSettingsModuleStatus('error');
                    }
                })
                .catch(err => {
                    console.error('加载维护中心模块失败:', err);
                    setSettingsModuleStatus('error');
                });
        }, [activeTab, settingsModuleStatus, loadWeeklyReportHelperScripts]);

        useEffect(() => {
            if (testMode && testSessionId) {
                applyTestRuntimeContext({
                    enabled: true,
                    sessionId: testSessionId,
                    simTimeMs: simTime,
                    timeSpeed
                });
                storeTestSessionState({
                    sessionId: testSessionId,
                    simTimeMs: simTime,
                    timeSpeed
                });
            } else {
                applyTestRuntimeContext({ enabled: false });
                clearStoredTestSessionState();
            }
        }, [testMode, testSessionId, simTime, timeSpeed]);

        useEffect(() => {
            if (!testMode) return;
            const timer = setInterval(() => {
                setSimTime(prev => prev + 1000 * timeSpeed);
            }, 1000);
            return () => clearInterval(timer);
        }, [testMode, timeSpeed]);

        // --- 局域网同步逻辑（防覆盖升级）---
        const {
            isDirtyRef,
            enterTestMode,
            exitTestMode,
            persistData,
            persistDataPatch,
            persistManagedPatch,
            fetchAttendanceData,
            realDataReady,
            handleAttendanceCheckIn,
            handleAttendanceMaintenance
        } = useClassManagerSync({
            students,
            studentProfiles,
            history,
            config,
            attendanceRecords,
            pets,
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
            effectiveTreasures,
            setStudents,
            setStudentProfiles,
            setHistory,
            setConfig,
            setAttendanceRecords,
            setPets,
            setTreasures,
            setStorage,
            setLogs,
            setQuotes,
            setMessages,
            setTeacherMessages,
            setRedemptionHistory,
            setDailyRedemptionCounts,
            setDailyUsageCounts,
            setLiquidatedTreasures,
            setTasks,
            setBattle,
            setExamArchives,
            testMode,
            testSessionId,
            setTestSessionId,
            setTestMode,
            setSimTime,
            setTimeSpeed,
            timeSpeed,
            localHydrationDone,
            setLocalHydrationDone,
            setSyncStatus
        });

        // 动态更新页面标题
        useEffect(() => {
            const systemConfig = getSystemConfig(config);
            const className = systemConfig.className || "班级自在管理系统";
            document.title = className;
        }, [config]);

        useEffect(() => {
            if (!localHydrationDone) return;
            const hasPetData = Object.keys((pets && pets.pets) || {}).length > 0;
            if (!petFeatureEnabled && !hasPetData) return;
            const result = reconcilePetDomain({
                domain: pets,
                students,
                history,
                attendanceRecords,
                nowTs: getNow().getTime()
            });
            if (result.changed) {
                setPets(result.domain);
                persistManagedPatch({ pets: result.domain }).catch((error) => {
                    console.error('自动同步宠物域失败:', error);
                });
            }
        }, [localHydrationDone, petFeatureEnabled, pets, students, history, attendanceRecords, setPets, persistManagedPatch]);


        // NEW Batch Update Function
        const batchUpdatePoints = useCallback((updates) => runBatchUpdatePoints({
            updates,
            students,
            history,
            POINT_SCENES,
            POINT_CATEGORIES,
            getNow,
            setStudents,
            setHistory,
            GUEST_ROSTER,
            normalizePointScene,
            normalizePointCategory,
            onPersist: ({ nextStudents, nextHistory }) => {
                persistManagedPatch({
                    students: nextStudents,
                    history: nextHistory
                });
            }
        }), [students, history, persistManagedPatch]);

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
            normalizePointCategory,
            applyRelatedUndo: ({ record, students: nextStudents, history: nextHistory }) => {
                const liquidationLib = window.TreasureLiquidation || {};
                if (typeof liquidationLib.rollbackLiquidationForUndo !== 'function') return null;
                const rollback = liquidationLib.rollbackLiquidationForUndo({
                    sourceHistoryId: record?.id,
                    students: nextStudents,
                    history: nextHistory,
                    storage,
                    liquidatedTreasures,
                    logs
                });
                if (rollback?.changed) {
                    setStorage(rollback.storage || {});
                    setLiquidatedTreasures(rollback.liquidatedTreasures || []);
                    setLogs(rollback.logs || []);
                }
                return rollback;
            },
            onPersist: (undoPatch) => {
                const patch = {
                    students: undoPatch.nextStudents,
                    history: undoPatch.nextHistory
                };
                if (undoPatch && Object.prototype.hasOwnProperty.call(undoPatch, 'storage')) patch.storage = undoPatch.storage;
                if (undoPatch && Object.prototype.hasOwnProperty.call(undoPatch, 'liquidatedTreasures')) patch.liquidatedTreasures = undoPatch.liquidatedTreasures;
                if (undoPatch && Object.prototype.hasOwnProperty.call(undoPatch, 'logs')) patch.logs = undoPatch.logs;
                persistManagedPatch(patch);
            }
        });

        const handleWage = () => runHandleWage({
            config,
            students,
            history,
            getNow,
            getSystemConfig,
            getCustomRoles,
            setStudents,
            setHistory,
            setConfig,
            GUEST_ROSTER,
            normalizePointScene,
            normalizePointCategory,
            onPersist: ({ nextStudents, nextHistory, nextConfig }) => {
                persistManagedPatch({
                    students: nextStudents,
                    history: nextHistory,
                    config: nextConfig
                });
            }
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
            if (Object.prototype.hasOwnProperty.call(nextState, 'liquidatedTreasures')) setLiquidatedTreasures(nextState.liquidatedTreasures || []);
            if (Object.prototype.hasOwnProperty.call(nextState, 'logs')) setLogs(nextState.logs || []);
            if (Object.prototype.hasOwnProperty.call(nextState, 'redemptionHistory')) setRedemptionHistory(nextState.redemptionHistory || {});
            if (Object.prototype.hasOwnProperty.call(nextState, 'dailyUsageCounts')) setDailyUsageCounts(nextState.dailyUsageCounts || {});
            if (Object.prototype.hasOwnProperty.call(nextState, 'dailyRedemptionCounts')) setDailyRedemptionCounts(nextState.dailyRedemptionCounts || {});
            persistManagedPatch(nextState);
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
            gachaConfig: treasureGachaConfig,
            getNow
        }));

        const handleUpdateTreasureGachaConfig = (nextGachaConfig) => {
            const normalizedGachaConfig = normalizeTreasureGachaConfig(nextGachaConfig);
            const nextSystemConfig = {
                ...getSystemConfig(config),
                treasureGacha: normalizedGachaConfig
            };
            const nextConfig = sanitizeStoredConfig({
                ...config,
                systemConfig: stripSystemConfigTreasures(nextSystemConfig)
            });
            const ts = getNow().getTime();
            const nextLogs = [{
                id: ts + Math.random(),
                ts,
                studentName: '系统',
                action: '祈愿设置调整',
                itemName: '概率与价格',
                rarity: 'MIX',
                cost: '',
                note: formatTreasureGachaSettingsSummary(normalizedGachaConfig)
            }, ...(Array.isArray(logs) ? logs : [])];

            return persistManagedPatch({
                config: nextConfig,
                logs: nextLogs
            }).then(() => {
                setConfig(nextConfig);
                setLogs(nextLogs);
                return {
                    ok: true,
                    gachaConfig: normalizedGachaConfig
                };
            }).catch((err) => {
                console.error('保存祈愿设置失败:', err);
                return {
                    ok: false,
                    message: err?.message || '祈愿设置保存失败，请重试'
                };
            });
        };

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

        const handleRedeemLiquidatedItem = (studentId, itemId) => commitTreasureAction(runTreasureAction('buildLiquidatedRedeemAction', {
            studentId,
            itemId,
            students,
            liquidatedTreasures,
            storage,
            history,
            logs,
            getNow
        }));

        const handleToggleLiquidation = async (enabled) => {
            if (!await requireAdminAuth("切换破产清算需要维护密码，请输入：")) return;
            const previousConfig = config;
            const nextSystemConfig = {
                ...getSystemConfig(config),
                treasureLiquidation: { enabled }
            };
            const nextConfig = sanitizeStoredConfig({
                ...config,
                systemConfig: stripSystemConfigTreasures(nextSystemConfig)
            });
            setConfig(nextConfig);
            try {
                await persistManagedPatch({ config: nextConfig });
            } catch (error) {
                setConfig(previousConfig);
                alert(error?.message || "清算设置保存失败，请重试");
            }
        };

        const handleApplyFixedStudents = (nextStudents) => {
            setStudents(nextStudents);
            persistManagedPatch({ students: nextStudents });
        };

        const handleImportTreasureData = (nextDomain) => {
            const nextTreasures = Array.isArray(nextDomain?.treasures) ? nextDomain.treasures : [];
            if (nextTreasures.length === 0) {
                return { ok: false, message: "未解析到有效的宝物数据" };
            }

            const safeDomain = protectTreasureDomain({
                treasures: nextTreasures,
                storage: nextDomain?.storage,
                logs
            }, () => ({ treasures, storage, logs }), { allowEmptyOverwrite: true });

            setTreasures(safeDomain.treasures || []);
            setStorage(safeDomain.storage || {});
            setRedemptionHistory({});
            setDailyRedemptionCounts({});
            setDailyUsageCounts({});
            persistManagedPatch({
                treasures: safeDomain.treasures,
                storage: safeDomain.storage,
                logs: safeDomain.logs,
                redemptionHistory: {},
                dailyRedemptionCounts: {},
                dailyUsageCounts: {}
            });

            return { ok: true };
        };

        const handleRenamePet = (studentId, nickname) => {
            const result = renamePet({
                domain: pets,
                studentId,
                nickname
            });
            if (!result?.ok) return result || { ok: false, message: "宠物改名失败" };
            setPets(result.domain);
            persistManagedPatch({ pets: result.domain });
            return { ok: true };
        };

        const handleHatchPet = (studentId) => {
            const student = students.find((entry) => String(entry.id) === String(studentId));
            const result = hatchPet({
                domain: pets,
                studentId,
                student,
                nowTs: getNow().getTime()
            });
            if (!result?.ok) return result || { ok: false, message: "宠物孵化失败" };
            const reconciled = reconcilePetDomain({
                domain: result.domain,
                students,
                history,
                attendanceRecords,
                nowTs: getNow().getTime()
            });
            setPets(reconciled.domain);
            persistManagedPatch({ pets: reconciled.domain });
            return { ok: true };
        };

        const handleBuyPetItem = (studentId, itemId) => {
            const purchaseResult = purchasePetItem({
                domain: pets,
                students,
                history,
                studentId,
                itemId,
                nowTs: getNow().getTime()
            });
            if (!purchaseResult?.ok) return purchaseResult || { ok: false, message: "宠物商城购买失败" };
            const reconciled = reconcilePetDomain({
                domain: purchaseResult.domain,
                students: purchaseResult.students,
                history: purchaseResult.history,
                attendanceRecords,
                nowTs: getNow().getTime()
            });
            setStudents(purchaseResult.students);
            setHistory(purchaseResult.history);
            setPets(reconciled.domain);
            persistManagedPatch({
                students: purchaseResult.students,
                history: purchaseResult.history,
                pets: reconciled.domain
            });
            return { ok: true };
        };

        const handleResetPetSystem = () => {
            const nextDomain = resetPetSystem({
                students,
                nowTs: getNow().getTime()
            });
            setPets(nextDomain);
            persistManagedPatch({ pets: nextDomain });
            return { ok: true };
        };

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

            persistManagedPatch({
                students: result.nextStudents,
                history: result.nextHistory,
                tasks: result.nextTasks
            });
            return true;
        };

        return h("div", { className: "min-h-screen pb-20" },
            h(NavView, { activeTab, setActiveTab, syncStatus, config }),
            h("main", { className: "max-w-6xl mx-auto p-4 mt-4" },
                activeTab === 'dashboard' && h(DashboardView, { students: displayStudents, studentProfiles, history, config, setConfig, updatePoints, handleUndo }),
                activeTab === 'operations' && h(OperationView, { students: displayStudents, handleWage, history, handleUndo, batchUpdatePoints, config, setConfig, setHistory, onApplyFixedStudents: handleApplyFixedStudents }),
                activeTab === 'attendance' && (
                    AttendanceView
                        ? h(AttendanceView, { students: displayStudents, updatePoints, config, quotes, messages, setMessages, teacherMessages, setTeacherMessages, studentMessages: messages, setStudentMessages: setMessages, attendanceRecords, onAttendanceCheckIn: handleAttendanceCheckIn, onAttendanceMaintenance: handleAttendanceMaintenance, onUpdateAttendanceConfig: (nextSystemConfig) => { setConfig(sanitizeStoredConfig({ ...config, systemConfig: stripSystemConfigTreasures(nextSystemConfig) })); if (Array.isArray(nextSystemConfig.quotes)) setQuotes(nextSystemConfig.quotes); } })
                        : h("div", { className: "bg-white rounded-xl shadow-sm p-8 text-center space-y-3" },
                            h("div", { className: "text-lg font-bold text-gray-800" }, "考勤模块加载失败"),
                            h("div", { className: "text-sm text-gray-500" }, "请检查 `attendance/module.js` 是否正常加载。")
                        )
                ),
                activeTab === 'tasks' && (
                    tasksModuleStatus === 'ready' && TasksView
                        ? h(TasksView, { students: displayStudents, tasks, setTasks, onClaimTask: handleClaimTask })
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
                        ? h(BattleView, { students: displayStudents, battle, examArchives, setExamArchives, setBattle, onApplySettlementPoints: applyBattleSettlementToMainRecords })
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
                    students: displayStudents,
                    treasures, storage, logs,
                    gachaConfig: treasureGachaConfig,
                    defaultGachaConfig: normalizeTreasureGachaConfig(DEFAULT_SYSTEM_CONFIG.treasureGacha),
                    redemptionHistory, dailyUsageCounts,
                    liquidatedTreasures,
                    liquidationEnabled: getSystemConfig(config).treasureLiquidation?.enabled === true,
                    onRedeemTreasure: handleRedeemTreasure,
                    onUseItem: handleUseItem,
                    onPerformGacha: handlePerformGacha,
                    onUpdateGachaConfig: handleUpdateTreasureGachaConfig,
                    onSaveItem: handleSaveTreasureItem,
                    onDeleteItem: handleDeleteTreasureItem,
                    onImportTreasureData: handleImportTreasureData,
                    onRedeemLiquidatedItem: handleRedeemLiquidatedItem,
                    onToggleLiquidation: handleToggleLiquidation
                }),
                activeTab === 'pet' && (
                    petModuleStatus === 'ready' && PetView
                        ? h(PetView, {
                            students,
                            pets,
                            onRenamePet: handleRenamePet,
                            onBuyPetItem: handleBuyPetItem,
                            onHatchPet: handleHatchPet,
                            onResetPetSystem: handleResetPetSystem
                        })
                        : h("div", { className: "bg-white rounded-xl shadow-sm p-8 text-center space-y-3" },
                            h("div", { className: "text-lg font-bold text-gray-800" },
                                petModuleStatus === 'error' ? "宠物模块加载失败" : "宠物模块加载中"
                            ),
                            h("div", { className: "text-sm text-gray-500" },
                                petModuleStatus === 'error' ? "请重试加载宠物模块。" : "首次打开宠物页时会按需加载模块。"
                            ),
                            petModuleStatus === 'error' && h("button", {
                                onClick: () => setPetModuleStatus('idle'),
                                className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            }, "重试")
                        )
                ),
                activeTab === 'profile' && (
                    profileModuleStatus === 'ready' && ProfileView
                        ? h(ProfileView, { students: displayStudents, studentProfiles, setStudentProfiles, history })
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
                activeTab === 'settings' && (
                    settingsModuleStatus === 'ready' && SettingsView
                        ? h(SettingsView, { 
                            students: displayStudents, studentProfiles, history, config,
                            rawStudents: students,
                            treasures, storage, logs,
                            setStudents, setStudentProfiles, setHistory, setConfig,
                            setTreasures, setStorage, setLogs,
                            quotes, setQuotes,
                            persistData,
                            persistDataPatch,
                            fetchAttendanceData,
                            realDataReady,
                            tasks, setTasks, messages, setMessages, teacherMessages, setTeacherMessages,
                            redemptionHistory, setRedemptionHistory, dailyRedemptionCounts, setDailyRedemptionCounts, dailyUsageCounts, setDailyUsageCounts, liquidatedTreasures, setLiquidatedTreasures,
                            battle, setBattle, examArchives, setExamArchives, isDirtyRef,
                            testMode, enterTestMode, exitTestMode,
                            simTime, setSimTime, timeSpeed, setTimeSpeed
                        })
                        : h("div", { className: "bg-white rounded-xl shadow-sm p-8 text-center space-y-3" },
                            h("div", { className: "text-lg font-bold text-gray-800" },
                                settingsModuleStatus === 'error' ? "维护中心模块加载失败" : "维护中心模块加载中"
                            ),
                            h("div", { className: "text-sm text-gray-500" },
                                settingsModuleStatus === 'error' ? "请重试加载维护中心模块。" : "首次打开维护中心时会按需加载模块。"
                            ),
                            settingsModuleStatus === 'error' && h("button", {
                                onClick: () => setSettingsModuleStatus('idle'),
                                className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            }, "重试")
                        )
                )
            ),
            h(Modal, { isOpen: modal.open, title: modal.title, onClose: () => setModal({ ...modal, open: false }), onConfirm: modal.onConfirm, type: modal.type }, modal.content)
        );
    };

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(h(App));
})();
