(function() {
    const SCHEDULE_CONFIG = [
        { id: 'morning', name: '早读', start: '06:00', end: '07:20', lateTime: '07:00' },
        { id: 'noon', name: '午练', start: '14:00', end: '14:40', lateTime: '14:20' },
        { id: 'evening', name: '晚自习', start: '18:00', end: '19:00', lateTime: '18:30' }
    ];

    const DEFAULT_QUOTES = [
        '乾坤未定，你我皆是黑马。',
        '拼两个春夏秋冬，博高考无怨无悔。',
        '每一分钟的努力，都是为了遇见更好的自己。',
        '将来的你，一定会感谢现在拼命的自己。',
        '不苦不累，高三无味；不拼不搏，等于白活。',
        '含泪播种的人一定能含笑收获。',
        '有志者自有千计万计，无志者只感千难万难。',
        '耐得住寂寞，守得住繁华。',
        '行百里者半九十。',
        '天道酬勤，厚德载物。',
        '星光不问赶路人，时光不负有心人。',
        '没有白走的路，每一步都算数。'
    ];

    const DEFAULT_TREASURE_GACHA_RATES = Object.freeze({
        SSR: 0.05,
        SR: 4.95,
        R: 25,
        N: 70
    });
    const DEFAULT_TREASURE_GACHA_COSTS = Object.freeze({
        single: 15,
        ten: 120
    });

    const roundTreasureGachaRate = (value) => Math.round(Number(value) * 100) / 100;
    const roundTreasureGachaCost = (value) => Math.round(Number(value) * 100) / 100;
    const normalizeTreasureGachaConfig = (input) => {
        const source = input && typeof input === 'object' ? input : {};
        const sourceRates = source.rates && typeof source.rates === 'object' ? source.rates : source;
        const sourceCosts = source.costs && typeof source.costs === 'object' ? source.costs : source;
        const rates = {};
        let hasExplicitValue = false;
        let invalid = false;

        ['SSR', 'SR', 'R', 'N'].forEach((rarity) => {
            const raw = sourceRates[rarity];
            if (raw === undefined || raw === null || raw === '') {
                rates[rarity] = DEFAULT_TREASURE_GACHA_RATES[rarity];
                return;
            }
            hasExplicitValue = true;
            const parsed = Number(raw);
            if (!Number.isFinite(parsed) || parsed < 0) {
                invalid = true;
                rates[rarity] = DEFAULT_TREASURE_GACHA_RATES[rarity];
                return;
            }
            rates[rarity] = roundTreasureGachaRate(parsed);
        });

        if (!hasExplicitValue || invalid) {
            return {
                rates: { ...DEFAULT_TREASURE_GACHA_RATES },
                costs: {
                    single: Number.isFinite(Number(sourceCosts.single)) && Number(sourceCosts.single) >= 0 ? roundTreasureGachaCost(sourceCosts.single) : DEFAULT_TREASURE_GACHA_COSTS.single,
                    ten: Number.isFinite(Number(sourceCosts.ten)) && Number(sourceCosts.ten) >= 0 ? roundTreasureGachaCost(sourceCosts.ten) : DEFAULT_TREASURE_GACHA_COSTS.ten
                }
            };
        }

        const total = rates.SSR + rates.SR + rates.R + rates.N;
        if (Math.abs(total - 100) > 0.01) {
            return {
                rates: { ...DEFAULT_TREASURE_GACHA_RATES },
                costs: {
                    single: Number.isFinite(Number(sourceCosts.single)) && Number(sourceCosts.single) >= 0 ? roundTreasureGachaCost(sourceCosts.single) : DEFAULT_TREASURE_GACHA_COSTS.single,
                    ten: Number.isFinite(Number(sourceCosts.ten)) && Number(sourceCosts.ten) >= 0 ? roundTreasureGachaCost(sourceCosts.ten) : DEFAULT_TREASURE_GACHA_COSTS.ten
                }
            };
        }

        return {
            rates,
            costs: {
                single: Number.isFinite(Number(sourceCosts.single)) && Number(sourceCosts.single) >= 0 ? roundTreasureGachaCost(sourceCosts.single) : DEFAULT_TREASURE_GACHA_COSTS.single,
                ten: Number.isFinite(Number(sourceCosts.ten)) && Number(sourceCosts.ten) >= 0 ? roundTreasureGachaCost(sourceCosts.ten) : DEFAULT_TREASURE_GACHA_COSTS.ten
            }
        };
    };

    const formatTreasureGachaRate = (value) => {
        const rate = roundTreasureGachaRate(value);
        return Number.isInteger(rate) ? String(rate) : rate.toFixed(2).replace(/\.?0+$/, '');
    };
    const formatTreasureGachaCost = (value) => {
        const cost = roundTreasureGachaCost(value);
        return Number.isInteger(cost) ? String(cost) : cost.toFixed(2).replace(/\.?0+$/, '');
    };

    const formatTreasureGachaPublicity = (input) => {
        const normalized = normalizeTreasureGachaConfig(input);
        const rates = normalized.rates;
        return `SSR ${formatTreasureGachaRate(rates.SSR)}% | SR ${formatTreasureGachaRate(rates.SR)}% | R ${formatTreasureGachaRate(rates.R)}% | N ${formatTreasureGachaRate(rates.N)}%`;
    };
    const formatTreasureGachaSettingsSummary = (input) => {
        const normalized = normalizeTreasureGachaConfig(input);
        return `概率 ${formatTreasureGachaPublicity(normalized)} | 价格 单抽 ${formatTreasureGachaCost(normalized.costs.single)} / 十连 ${formatTreasureGachaCost(normalized.costs.ten)}`;
    };

    const DEFAULT_SYSTEM_CONFIG = {
        className: '班级自在管理系统',
        quotes: [...DEFAULT_QUOTES],
        recordCategoryPendingMigrated: false,
        enabledFeatures: {
            battle: true,
            pet: false
        },
        attendance: {
            schedule: [...SCHEDULE_CONFIG],
            weekendRules: {
                monday: [0, 1, 2],
                tuesday: [0, 1, 2],
                wednesday: [0, 1, 2],
                thursday: [0, 1, 2],
                friday: [0, 1],
                saturday: [],
                sunday: [2]
            },
            sundaySpecialLateTime: {
                evening: '19:00'
            },
            penaltyRules: {
                punctual: 0,
                late: -1,
                absent: -5,
                perfectAttendance: 10
            }
        },
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
        points: {
            dailyWageAmount: 5,
            dailyWageGroups: ['discipline', 'hygiene'],
            penaltyDecayDays: 7,
            penaltyDecayAmount: 10,
            runningExerciseAbsentPenalty: 1,
            runningExercisePresentBonus: 1,
            reasons: [
                { name: '每日工资', val: 5, type: 'bonus', note: '组长+6', scene: '班级', category: '班务' },
                { name: '宣传组装饰', val: 100, type: 'bonus', note: '组长+120', scene: '班级', category: '纪律' },
                { name: '组织活动', val: 20, type: 'bonus', note: '组长+24', scene: '班级', category: '纪律' },
                { name: '周全勤奖', val: 10, type: 'bonus', scene: '班级', category: '纪律' },
                { name: '大考优秀', val: 20, type: 'bonus', scene: '班级', category: '纪律' },
                { name: '学习复盘', val: 5, type: 'bonus', editable: true, scene: '班级', category: '纪律' },
                { name: '错题抽查', val: 5, type: 'bonus', editable: true, scene: '班级', category: '纪律' },
                { name: '思维导图', val: 5, type: 'bonus', editable: true, scene: '班级', category: '纪律' },
                { name: '宿舍加分', val: 1, type: 'bonus', isMulti: true, factor: 10, note: '输入值×10', scene: '宿舍', category: '纪律' },
                { name: '噪音/喧哗', val: -5, type: 'penalty', scene: '班级', category: '纪律' },
                { name: '桌面杂乱', val: -5, type: 'penalty', scene: '班级', category: '纪律' },
                { name: '平板未归位', val: -5, type: 'penalty', scene: '班级', category: '纪律' },
                { name: '任意走动', val: -0.5, type: 'penalty', scene: '班级', category: '纪律' },
                { name: '擅自外出', val: -1, type: 'penalty', scene: '班级', category: '纪律' },
                { name: '失联(严重)', val: -100, type: 'penalty', scene: '班级', category: '纪律' },
                { name: '迟到', val: -1, type: 'penalty', scene: '班级', category: '纪律' },
                { name: '缺勤', val: -5, type: 'penalty', scene: '班级', category: '出勤' },
                { name: '缺交作业', val: -1, type: 'penalty', scene: '班级', category: '学业' },
                { name: '卫生扣分', val: -1, type: 'penalty', isMulti: true, factor: 5, note: '仅卫生组×5', scene: '宿舍', category: '卫生' }
            ]
        },
        treasures: [
            { id: 1, name: '免做卡', rarity: 'SSR', price: 200, stock: 3, desc: '免除一次作业', ladderPrices: [], dailyLimit: 0 },
            { id: 2, name: '奶茶券', rarity: 'SR', price: 50, stock: 10, desc: '兑换一杯奶茶', ladderPrices: [50, 60, 70], dailyLimit: 2 },
            { id: 3, name: '自选座位', rarity: 'SR', price: 60, stock: 5, desc: '优先选择座位一次', ladderPrices: [], dailyLimit: 0 },
            { id: 4, name: '免值日卡', rarity: 'R', price: 30, stock: 20, desc: '免除一次值日', ladderPrices: [], dailyLimit: 0 },
            { id: 5, name: '零食包', rarity: 'R', price: 20, stock: 50, desc: '随机小零食', ladderPrices: [], dailyLimit: 0 },
            { id: 6, name: '铅笔', rarity: 'N', price: 5, stock: 100, desc: '普通铅笔一支', ladderPrices: [], dailyLimit: 0 },
            { id: 7, name: '橡皮擦', rarity: 'N', price: 5, stock: 100, desc: '普通橡皮一块', ladderPrices: [], dailyLimit: 0 },
            { id: 8, name: '棒棒糖', rarity: 'N', price: 2, stock: 200, desc: '甜蜜一下', ladderPrices: [], dailyLimit: 0 },
            { id: 9, name: '测试宝物', rarity: 'N', price: 0, stock: 1000, desc: '仅供测试使用', ladderPrices: [], dailyLimit: 0 }
        ],
        treasureGacha: {
            rates: { ...DEFAULT_TREASURE_GACHA_RATES },
            costs: { ...DEFAULT_TREASURE_GACHA_COSTS }
        },
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
        name: role?.name || '',
        studentId: role?.studentId != null && role.studentId !== '' ? Number(role.studentId) : null,
        dailyWage: Number.isFinite(Number(role?.dailyWage)) ? Number(role.dailyWage) : fallbackDailyWage
    }));

    const normalizeCommissionerRoles = (roles, legacyAssignments = null) => {
        const roleList = Array.isArray(roles) ? roles : [];
        const legacyMap = legacyAssignments && typeof legacyAssignments === 'object' ? legacyAssignments : {};
        return roleList.map((role, idx) => {
            const ownStudentId = role?.studentId != null && role.studentId !== ''
                ? Number(role.studentId)
                : null;
            const legacyStudentId = role?.id && legacyMap[role.id] != null && legacyMap[role.id] !== ''
                ? Number(legacyMap[role.id])
                : null;
            return {
                id: role?.id || `commissioner_role_${idx + 1}`,
                name: role?.name || '',
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

    const getLatestExamArchiveRank = (examArchives, studentId) => {
        const archives = normalizeExamArchives(examArchives);
        const latestExamId = archives.latestExamId || archives.exams[0]?.id || '';
        if (!latestExamId) return null;
        const exam = archives.exams.find((item) => item.id === latestExamId) || archives.exams[0];
        if (!exam) return null;
        const record = exam.records?.[studentId] || exam.records?.[String(studentId)] || null;
        const rank = exam.ranks?.[studentId] || exam.ranks?.[String(studentId)] || null;
        const rawC = record?.totalClassRank != null ? record.totalClassRank : rank?.c;
        const rawG = record?.totalGradeRank != null ? record.totalGradeRank : rank?.g;
        const c = Number.isFinite(Number(rawC)) ? Number(rawC) : null;
        const g = Number.isFinite(Number(rawG)) ? Number(rawG) : null;
        if (c == null && g == null) return null;
        return { c, g };
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

    const stripLegacyAdminPasswordFromConfig = (config) => {
        if (!config || typeof config !== 'object') return config || {};
        if (!config.systemConfig || typeof config.systemConfig !== 'object') return config;
        if (!Object.prototype.hasOwnProperty.call(config.systemConfig, 'adminPassword')) return config;
        const { adminPassword, ...restSystemConfig } = config.systemConfig;
        return { ...config, systemConfig: restSystemConfig };
    };

    const sanitizeStoredConfig = (config) => (
        stripLegacyPsychologyCommittee(
            stripLegacyAdminPasswordFromConfig(
                stripTreasureConfig(config)
            )
        )
    );

    const getSystemConfig = (config) => {
        const merged = JSON.parse(JSON.stringify(DEFAULT_SYSTEM_CONFIG));
        const userConfig = config?.systemConfig || {};

        if (userConfig.className !== undefined) merged.className = userConfig.className;
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

        if (userConfig.points) {
            if (userConfig.points.dailyWageAmount !== undefined) {
                merged.points.dailyWageAmount = Number(userConfig.points.dailyWageAmount);
            }
            if (Array.isArray(userConfig.points.dailyWageGroups)) {
                merged.points.dailyWageGroups = userConfig.points.dailyWageGroups;
            }
            if (userConfig.points.penaltyDecayDays !== undefined) {
                const decayDays = Number(userConfig.points.penaltyDecayDays);
                if (Number.isFinite(decayDays)) merged.points.penaltyDecayDays = decayDays;
            }
            if (userConfig.points.penaltyDecayAmount !== undefined) {
                const decayAmount = Number(userConfig.points.penaltyDecayAmount);
                if (Number.isFinite(decayAmount)) merged.points.penaltyDecayAmount = decayAmount;
            }
            if (userConfig.points.runningExerciseAbsentPenalty !== undefined) {
                const absentPenalty = Number(userConfig.points.runningExerciseAbsentPenalty);
                if (Number.isFinite(absentPenalty)) merged.points.runningExerciseAbsentPenalty = absentPenalty;
            }
            if (userConfig.points.runningExercisePresentBonus !== undefined) {
                const presentBonus = Number(userConfig.points.runningExercisePresentBonus);
                if (Number.isFinite(presentBonus)) merged.points.runningExercisePresentBonus = presentBonus;
            }
            if (userConfig.points.reasons) {
                merged.points.reasons = userConfig.points.reasons;
            }
        }

        if (userConfig.subjects) {
            merged.subjects = userConfig.subjects;
        }

        if (Array.isArray(userConfig.treasures)) {
            merged.treasures = userConfig.treasures;
        }
        if (userConfig.treasureGacha) {
            merged.treasureGacha = normalizeTreasureGachaConfig(userConfig.treasureGacha);
        }

        return merged;
    };

    const getScheduleConfig = (config) => getSystemConfig(config).attendance.schedule;
    const getWeekendRules = (config) => getSystemConfig(config).attendance.weekendRules;
    const getPenaltyRules = (config) => getSystemConfig(config).attendance.penaltyRules;
    const getCommissionerRoles = (config) => getSystemConfig(config).organization.commissionerRoles;
    const getCustomRoles = (config) => normalizeCustomRoles(getSystemConfig(config).organization.customRoles || []);
    const getTreasuresConfig = (config) => getSystemConfig(config).treasures;
    const getTreasureGachaConfig = (config) => normalizeTreasureGachaConfig(getSystemConfig(config).treasureGacha);

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
        const statusPriority = (rec) => {
            if (!rec) return -1;
            if (rec.status === 'ok' || rec.status === 'late') return 2;
            if (rec.status === 'absent') return 1;
            return 0;
        };

        Object.keys(remote).forEach((date) => {
            if (!merged[date]) merged[date] = {};
            Object.keys(remote[date] || {}).forEach((name) => {
                if (!merged[date][name]) merged[date][name] = {};
                Object.keys(remote[date][name] || {}).forEach((sessionId) => {
                    const localRec = merged[date][name][sessionId];
                    const remoteRec = remote[date][name][sessionId];
                    if (!localRec) {
                        merged[date][name][sessionId] = remoteRec;
                        return;
                    }
                    if (!remoteRec) return;
                    const localPriority = statusPriority(localRec);
                    const remotePriority = statusPriority(remoteRec);
                    if (remotePriority > localPriority) {
                        merged[date][name][sessionId] = remoteRec;
                    } else if (remotePriority === localPriority) {
                        const localTs = typeof localRec.timestamp === 'number' ? localRec.timestamp : 0;
                        const remoteTs = typeof remoteRec.timestamp === 'number' ? remoteRec.timestamp : 0;
                        if (remoteTs >= localTs) merged[date][name][sessionId] = remoteRec;
                    }
                });
            });
        });

        return merged;
    };

    window.SCHEDULE_CONFIG = SCHEDULE_CONFIG;
    window.DEFAULT_QUOTES = DEFAULT_QUOTES;
    window.ClassManagerSchema = {
        SCHEDULE_CONFIG,
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
    };
})();
