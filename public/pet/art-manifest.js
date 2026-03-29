(function() {
    const PET_ART_SRC = Object.freeze({
        egg: '/pet/assets/egg/dragon-egg-shell.svg',
        dragon_neon: '/pet/assets/pets/dragon-neon-main.webp',
        cyber_cat: '/pet/assets/pets/cyber-cat-main.webp',
        robo_bird: '/pet/assets/pets/robo-bird-main.webp',
        glitch_beast: '/pet/assets/pets/glitch-beast-main.webp',
        titan_core: '/pet/assets/pets/titan-core-main.webp',
        hydro_serpent: '/pet/assets/pets/hydro-serpent-main.webp',
        lava_bot: '/pet/assets/pets/lava-bot-main.webp',
        ghost_core: '/pet/assets/pets/ghost-core-main.webp',
        solar_lion: '/pet/assets/pets/solar-lion-main.webp',
        bio_sprout: '/pet/assets/pets/bio-sprout-main.webp',
        sonic_beast: '/pet/assets/pets/sonic-beast-main.webp',
        electric_cat: '/pet/assets/pets/electric-cat-main.webp',
        majestic_dragon: '/pet/assets/pets/majestic-dragon-main.webp'
    });

    const FAMILY_FALLBACK_ART = Object.freeze({
        '萌系': 'cyber_cat',
        '神秘系': 'majestic_dragon',
        '自然系': 'bio_sprout',
        '炫酷系': 'sonic_beast',
        '学霸系': 'robo_bird'
    });

    const RARITY_META = Object.freeze({
        common: {
            label: 'Common',
            shortLabel: '普通',
            accent: '#94a3b8',
            glow: 'rgba(148,163,184,0.28)',
            ring: 'rgba(148,163,184,0.35)'
        },
        rare: {
            label: 'Rare',
            shortLabel: '稀有',
            accent: '#81ecff',
            glow: 'rgba(129,236,255,0.24)',
            ring: 'rgba(129,236,255,0.45)'
        },
        legendary: {
            label: 'Legendary',
            shortLabel: '传说',
            accent: '#fdd400',
            glow: 'rgba(253,212,0,0.24)',
            ring: 'rgba(253,212,0,0.48)'
        }
    });

    const SHOP_RARITY_META = Object.freeze({
        N: { accent: '#94a3b8', label: 'N' },
        R: { accent: '#81ecff', label: 'R' },
        SR: { accent: '#b5f700', label: 'SR' },
        SSR: { accent: '#fdd400', label: 'SSR' }
    });

    const FRAME_TONES = Object.freeze({
        amber: { start: '#2a1808', end: '#6b3f13', glow: 'rgba(251,191,36,0.28)' },
        cyan: { start: '#081a25', end: '#005f76', glow: 'rgba(129,236,255,0.26)' },
        emerald: { start: '#071b14', end: '#0f766e', glow: 'rgba(74,222,128,0.24)' },
        violet: { start: '#140b25', end: '#5b21b6', glow: 'rgba(168,85,247,0.24)' },
        crimson: { start: '#220b0b', end: '#991b1b', glow: 'rgba(248,113,113,0.24)' },
        slate: { start: '#111827', end: '#334155', glow: 'rgba(148,163,184,0.22)' },
        sky: { start: '#071426', end: '#2563eb', glow: 'rgba(96,165,250,0.26)' }
    });

    window.ClassPetArtManifest = {
        PET_ART_SRC,
        FAMILY_FALLBACK_ART,
        RARITY_META,
        SHOP_RARITY_META,
        FRAME_TONES
    };
})();
