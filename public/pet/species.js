(function() {
    const RAW_SPECIES = [
        { id: 'shiba', name: '柴犬宝宝', emoji: '🐕', accent: '#f97316', soft: '#ffedd5', family: '萌系', desc: '橙色卷尾，表情丰富。' },
        { id: 'panda', name: '熊猫小将', emoji: '🐼', accent: '#374151', soft: '#e5e7eb', family: '萌系', desc: '抱着竹子，圆滚滚。' },
        { id: 'bunny', name: '兔子骑士', emoji: '🐰', accent: '#ec4899', soft: '#fce7f3', family: '萌系', desc: '耳朵超长，动作轻快。' },
        { id: 'cat_spirit', name: '猫咪精灵', emoji: '🐱', accent: '#8b5cf6', soft: '#ede9fe', family: '萌系', desc: '会冒泡泡的发光猫咪。' },
        { id: 'bear_cake', name: '团子熊', emoji: '🐻', accent: '#f59e0b', soft: '#fef3c7', family: '萌系', desc: '头顶永远有一颗草莓。' },
        { id: 'hamster', name: '仓鼠队长', emoji: '🐹', accent: '#fb7185', soft: '#ffe4e6', family: '萌系', desc: '腮帮鼓鼓，戴着红领巾。' },
        { id: 'star_dragon', name: '星云龙宝', emoji: '🐉', accent: '#6366f1', soft: '#e0e7ff', family: '神秘系', desc: '像在星空里游动。' },
        { id: 'moon_fox', name: '月光狐', emoji: '🦊', accent: '#a855f7', soft: '#f3e8ff', family: '神秘系', desc: '尾巴在夜里会发光。' },
        { id: 'shadow_cat', name: '暗影猫', emoji: '🐈', accent: '#111827', soft: '#d1d5db', family: '神秘系', desc: '全黑轮廓，眼睛很亮。' },
        { id: 'lucky_koi', name: '锦鲤仙子', emoji: '🐟', accent: '#ef4444', soft: '#fee2e2', family: '神秘系', desc: '总像带着一点好运。' },
        { id: 'crystal_deer', name: '水晶鹿', emoji: '🦌', accent: '#06b6d4', soft: '#cffafe', family: '神秘系', desc: '透明鹿角，气质清冷。' },
        { id: 'cloud_whale', name: '云朵鲸', emoji: '🐋', accent: '#38bdf8', soft: '#e0f2fe', family: '神秘系', desc: '像在天空里缓慢游泳。' },
        { id: 'petal_fairy', name: '花瓣仙子', emoji: '🧚', accent: '#10b981', soft: '#d1fae5', family: '自然系', desc: '带着春天的气息。' },
        { id: 'frog_prince', name: '青蛙王子', emoji: '🐸', accent: '#22c55e', soft: '#dcfce7', family: '自然系', desc: '蹦跳很快，头戴小王冠。' },
        { id: 'mushroom', name: '蘑菇精灵', emoji: '🍄', accent: '#b45309', soft: '#fef3c7', family: '自然系', desc: '总喜欢躲在角落里。' },
        { id: 'bee_knight', name: '蜜蜂骑士', emoji: '🐝', accent: '#eab308', soft: '#fef9c3', family: '自然系', desc: '忙忙碌碌，特别勤快。' },
        { id: 'snow_spirit', name: '雪花精灵', emoji: '❄️', accent: '#60a5fa', soft: '#dbeafe', family: '自然系', desc: '一出现就很安静。' },
        { id: 'leaf_turtle', name: '叶片神龟', emoji: '🐢', accent: '#65a30d', soft: '#ecfccb', family: '自然系', desc: '慢吞吞，但很稳。' },
        { id: 'mecha_dog', name: '机甲战狗', emoji: '🤖', accent: '#475569', soft: '#e2e8f0', family: '炫酷系', desc: '金属感很强的战斗型伙伴。' },
        { id: 'neon_butterfly', name: '霓虹蝶', emoji: '🦋', accent: '#0ea5e9', soft: '#e0f2fe', family: '炫酷系', desc: '翅膀边缘像在发光。' },
        { id: 'lightning_cat', name: '电气猫', emoji: '⚡', accent: '#facc15', soft: '#fef9c3', family: '炫酷系', desc: '总带着一点静电。' },
        { id: 'speed_fish', name: '光速鱼', emoji: '🐠', accent: '#14b8a6', soft: '#ccfbf1', family: '炫酷系', desc: '会留下像流星一样的光轨。' },
        { id: 'fire_wolf', name: '火焰狼崽', emoji: '🐺', accent: '#ef4444', soft: '#fee2e2', family: '炫酷系', desc: '脚步像带着热度。' },
        { id: 'cyber_fox', name: '赛博狐', emoji: '🦾', accent: '#7c3aed', soft: '#ede9fe', family: '炫酷系', desc: '半机械半生物的风格。' },
        { id: 'owl_sage', name: '智慧猫头鹰', emoji: '🦉', accent: '#8b5a2b', soft: '#f3e8d6', family: '学霸系', desc: '总像在认真观察。' },
        { id: 'book_imp', name: '书本精灵', emoji: '📘', accent: '#2563eb', soft: '#dbeafe', family: '学霸系', desc: '像从书页里飞出来。' },
        { id: 'ink_dragon', name: '墨水龙', emoji: '🖋️', accent: '#1f2937', soft: '#e5e7eb', family: '学霸系', desc: '擅长把字写得很好看。' },
        { id: 'star_dolphin', name: '星星海豚', emoji: '🐬', accent: '#3b82f6', soft: '#dbeafe', family: '学霸系', desc: '看起来聪明又轻盈。' },
        { id: 'magic_rabbit', name: '魔法兔', emoji: '🎩', accent: '#d946ef', soft: '#fae8ff', family: '学霸系', desc: '总能变出惊喜答案。' },
        { id: 'atom_bear', name: '原子熊', emoji: '🧸', accent: '#0f766e', soft: '#ccfbf1', family: '学霸系', desc: '安静，但脑袋转得很快。' }
    ];

    const FAMILY_VISUALS = Object.freeze({
        '萌系': { artKey: 'cyber_cat', rarity: 'common', element: '萌能', frameTone: 'cyan' },
        '神秘系': { artKey: 'majestic_dragon', rarity: 'rare', element: '星雾', frameTone: 'violet' },
        '自然系': { artKey: 'bio_sprout', rarity: 'common', element: '自然', frameTone: 'emerald' },
        '炫酷系': { artKey: 'sonic_beast', rarity: 'rare', element: '动能', frameTone: 'sky' },
        '学霸系': { artKey: 'robo_bird', rarity: 'rare', element: '智识', frameTone: 'amber' }
    });

    const VISUAL_BY_ID = Object.freeze({
        shiba: { artKey: 'sonic_beast', frameTone: 'amber' },
        panda: { artKey: 'titan_core', frameTone: 'slate' },
        bunny: { artKey: 'cyber_cat', frameTone: 'violet' },
        cat_spirit: { artKey: 'electric_cat', rarity: 'rare', element: '灵光', frameTone: 'violet' },
        bear_cake: { artKey: 'titan_core', rarity: 'rare', frameTone: 'amber' },
        hamster: { artKey: 'cyber_cat', frameTone: 'crimson' },
        star_dragon: { artKey: 'majestic_dragon', rarity: 'legendary', element: '星穹', frameTone: 'violet' },
        moon_fox: { artKey: 'ghost_core', rarity: 'rare', element: '月影', frameTone: 'violet' },
        shadow_cat: { artKey: 'ghost_core', rarity: 'rare', element: '暗影', frameTone: 'slate' },
        lucky_koi: { artKey: 'hydro_serpent', rarity: 'rare', element: '流光', frameTone: 'crimson' },
        crystal_deer: { artKey: 'majestic_dragon', rarity: 'rare', element: '寒晶', frameTone: 'cyan' },
        cloud_whale: { artKey: 'hydro_serpent', rarity: 'rare', element: '天潮', frameTone: 'sky' },
        petal_fairy: { artKey: 'bio_sprout', frameTone: 'emerald' },
        frog_prince: { artKey: 'bio_sprout', frameTone: 'emerald' },
        mushroom: { artKey: 'bio_sprout', frameTone: 'amber' },
        bee_knight: { artKey: 'robo_bird', rarity: 'rare', element: '蜂鸣', frameTone: 'amber' },
        snow_spirit: { artKey: 'majestic_dragon', rarity: 'rare', element: '雪域', frameTone: 'cyan' },
        leaf_turtle: { artKey: 'bio_sprout', frameTone: 'emerald' },
        mecha_dog: { artKey: 'titan_core', rarity: 'rare', element: '机甲', frameTone: 'slate' },
        neon_butterfly: { artKey: 'robo_bird', rarity: 'rare', element: '霓虹', frameTone: 'cyan' },
        lightning_cat: { artKey: 'electric_cat', rarity: 'rare', element: '雷能', frameTone: 'amber' },
        speed_fish: { artKey: 'hydro_serpent', rarity: 'rare', element: '极速', frameTone: 'sky' },
        fire_wolf: { artKey: 'lava_bot', rarity: 'rare', element: '烈焰', frameTone: 'crimson' },
        cyber_fox: { artKey: 'sonic_beast', rarity: 'rare', element: '赛博', frameTone: 'violet' },
        owl_sage: { artKey: 'robo_bird', rarity: 'rare', element: '智识', frameTone: 'amber' },
        book_imp: { artKey: 'glitch_beast', rarity: 'rare', element: '数据', frameTone: 'sky' },
        ink_dragon: { artKey: 'dragon_neon', rarity: 'legendary', element: '墨晶', frameTone: 'slate' },
        star_dolphin: { artKey: 'hydro_serpent', rarity: 'rare', element: '星海', frameTone: 'sky' },
        magic_rabbit: { artKey: 'cyber_cat', rarity: 'rare', element: '奇想', frameTone: 'violet' },
        atom_bear: { artKey: 'titan_core', rarity: 'legendary', element: '原子', frameTone: 'emerald' }
    });

    const SPECIES = RAW_SPECIES.map((item) => ({
        ...FAMILY_VISUALS[item.family],
        ...item,
        ...VISUAL_BY_ID[item.id]
    }));

    const SHOP_ITEMS = [
        {
            id: 'daily_feed',
            name: '普通喂食',
            rarity: 'N',
            price: 8,
            desc: '让宠物恢复一点精力和健康。',
            boost: { energy: 12, health: 6 }
        },
        {
            id: 'play_ball',
            name: '玩具球',
            rarity: 'R',
            price: 12,
            desc: '让宠物开心起来。',
            boost: { happiness: 18, energy: 3 }
        },
        {
            id: 'premium_meal',
            name: '精品饲料',
            rarity: 'SR',
            price: 30,
            desc: '一次性全面补状态，并增加经验。',
            boost: { happiness: 10, health: 10, energy: 10, exp: 20 }
        },
        {
            id: 'evolution_stone',
            name: '进化石',
            rarity: 'SSR',
            price: 80,
            desc: '大幅提升经验，适合冲阶段。',
            boost: { happiness: 8, exp: 120 }
        }
    ];

    const SPECIES_BY_ID = SPECIES.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
    }, {});

    window.ClassPetData = {
        SPECIES,
        SHOP_ITEMS,
        SPECIES_BY_ID
    };
})();
