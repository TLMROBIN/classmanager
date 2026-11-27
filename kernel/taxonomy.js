const STANDARD_POINT_CATEGORIES = Object.freeze([
    '学业',
    '纪律',
    '卫生',
    '出勤',
    '班务',
    '兑奖',
    '待定'
]);

const STANDARD_POINT_SCENES = Object.freeze([
    '宿舍',
    '班级',
    '校级',
    '其他'
]);

const STANDARD_ATTENDANCE_STATUSES = Object.freeze([
    'ok',
    'late',
    'absent',
    'leave'
]);

const DEFAULT_COMP_EVAL_MAPPING = Object.freeze({
    学业: '学业水平',
    纪律: '思想品德',
    卫生: '身心健康',
    出勤: '身心健康',
    班务: '社会实践',
    兑奖: '思想品德',
    待定: '思想品德'
});

const STANDARD_CATEGORY_SET = new Set(STANDARD_POINT_CATEGORIES);
const STANDARD_SCENE_SET = new Set(STANDARD_POINT_SCENES);

const CATEGORY_ALIAS_MAP = Object.freeze({
    学习: '学业',
    作业: '学业',
    考试: '学业',
    成绩: '学业',
    背诵: '学业',
    朗读: '学业',
    考勤: '出勤',
    迟到: '出勤',
    缺勤: '出勤',
    早读: '出勤',
    全勤: '出勤',
    兑换: '兑奖',
    藏宝阁: '兑奖',
    奖品: '兑奖',
    祈愿: '兑奖',
    消费: '兑奖',
    清算: '兑奖',
    值日: '卫生',
    打扫: '卫生',
    保洁: '卫生',
    寝室卫生: '卫生',
    班委: '班务',
    工资: '班务',
    专员: '班务',
    值班: '班务',
    校正: '班务',
    违纪: '纪律',
    噪音: '纪律',
    桌面: '纪律',
    平板: '纪律',
    跑操: '纪律',
    常规: '纪律'
});

/**
 * Normalize any legacy or custom point category string into the standard V2 category taxonomy.
 */
const normalizeStandardCategory = (rawCategory, context = {}) => {
    const trimmed = typeof rawCategory === 'string' ? rawCategory.trim() : String(rawCategory || '').trim();
    if (trimmed && STANDARD_CATEGORY_SET.has(trimmed)) {
        return { category: trimmed, subCategory: null };
    }

    if (trimmed && Object.prototype.hasOwnProperty.call(CATEGORY_ALIAS_MAP, trimmed)) {
        return {
            category: CATEGORY_ALIAS_MAP[trimmed],
            subCategory: trimmed
        };
    }

    if (context?.type === 'points-set') {
        return {
            category: '班务',
            subCategory: trimmed || null
        };
    }

    const reason = typeof context?.reason === 'string' ? context.reason : '';
    const combined = `${trimmed} ${reason}`;
    if (/考勤|缺勤|迟到|全勤|早读/.test(trimmed) || /考勤|缺勤|迟到|全勤/.test(reason)) {
        return { category: '出勤', subCategory: trimmed || null };
    }
    if (/兑换|藏宝阁|祈愿|宝物|清算|奖品/.test(combined)) {
        return { category: '兑奖', subCategory: trimmed || null };
    }
    if (/作业|背诵|考试|复盘|学习|错题|导图/.test(combined)) {
        return { category: '学业', subCategory: trimmed || null };
    }
    if (/卫生|值日|打扫|保洁/.test(combined)) {
        return { category: '卫生', subCategory: trimmed || null };
    }
    if (/工资|专员|班委|校正/.test(combined)) {
        return { category: '班务', subCategory: trimmed || null };
    }
    if (/纪律|违纪|噪音|桌面|平板|跑操|常规/.test(trimmed)) {
        return { category: '纪律', subCategory: trimmed || null };
    }

    return {
        category: '待定',
        subCategory: trimmed || null
    };
};

const normalizeStandardScene = (rawScene) => {
    const trimmed = typeof rawScene === 'string' ? rawScene.trim() : '';
    return STANDARD_SCENE_SET.has(trimmed) ? trimmed : '班级';
};

const isValidStandardCategory = (value) => STANDARD_CATEGORY_SET.has(String(value || '').trim());

module.exports = {
    STANDARD_POINT_CATEGORIES,
    STANDARD_POINT_SCENES,
    STANDARD_ATTENDANCE_STATUSES,
    DEFAULT_COMP_EVAL_MAPPING,
    normalizeStandardCategory,
    normalizeStandardScene,
    isValidStandardCategory
};
