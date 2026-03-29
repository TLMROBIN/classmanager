(function() {
    window.createPetView = function createPetView(deps) {
        const {
            h,
            useState,
            useEffect,
            Icon,
            Modal,
            requireAdminAuth
        } = deps || {};

        if (!h || !useState || !useEffect || !Icon || !Modal || !requireAdminAuth) {
            throw new Error('PetView dependencies are missing');
        }

        const petData = window.ClassPetData || {};
        const petState = window.ClassPetState || {};
        const artManifest = window.ClassPetArtManifest || {};
        const SPECIES_BY_ID = petData.SPECIES_BY_ID || {};
        const SHOP_ITEMS = Array.isArray(petState.SHOP_ITEMS) ? petState.SHOP_ITEMS : [];
        const INITIAL_PET_STATUS = petState.INITIAL_PET_STATUS || { happiness: 80, health: 80, energy: 80 };
        const PET_ART_SRC = artManifest.PET_ART_SRC || {};
        const FAMILY_FALLBACK_ART = artManifest.FAMILY_FALLBACK_ART || {};
        const RARITY_META = artManifest.RARITY_META || {};
        const SHOP_RARITY_META = artManifest.SHOP_RARITY_META || {};
        const FRAME_TONES = artManifest.FRAME_TONES || {};
        const getStageLabel = typeof petState.getStageLabel === 'function'
            ? petState.getStageLabel
            : (() => '蛋期');

        const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));
        const isHatchedPet = (pet) => !!(pet?.hatchedAt && pet?.speciesId);
        const getFrameTone = (species) => FRAME_TONES[species?.frameTone] || FRAME_TONES.sky || {
            start: '#081426',
            end: '#1d4ed8',
            glow: 'rgba(96,165,250,0.24)'
        };
        const getRarityMeta = (rarity) => RARITY_META[rarity] || RARITY_META.common || {
            label: 'Common',
            shortLabel: '普通',
            accent: '#94a3b8',
            glow: 'rgba(148,163,184,0.24)',
            ring: 'rgba(148,163,184,0.35)'
        };
        const getShopRarityMeta = (rarity) => SHOP_RARITY_META[rarity] || SHOP_RARITY_META.N || {
            accent: '#94a3b8',
            label: 'N'
        };
        const resolveSpeciesArtKey = (species) => species?.artKey || FAMILY_FALLBACK_ART[species?.family] || '';
        const resolvePetArtSrc = (pet) => {
            if (!isHatchedPet(pet)) return PET_ART_SRC.egg || '';
            const species = SPECIES_BY_ID[pet?.speciesId] || null;
            const artKey = resolveSpeciesArtKey(species);
            return PET_ART_SRC[artKey] || '';
        };

        const formatBoost = (boost) => {
            const items = [];
            if (Number(boost?.happiness) > 0) items.push(`快乐 +${boost.happiness}`);
            if (Number(boost?.health) > 0) items.push(`健康 +${boost.health}`);
            if (Number(boost?.energy) > 0) items.push(`精力 +${boost.energy}`);
            if (Number(boost?.exp) > 0) items.push(`经验 +${boost.exp}`);
            return items.join(' / ') || '状态提升';
        };
        const panelGradient = 'linear-gradient(180deg, #0f172a 0%, #111827 100%)';
        const heroGradient = 'linear-gradient(135deg, #0b1120 0%, #172554 42%, #1e293b 100%)';
        const shellGradient = 'radial-gradient(circle at top, #1e293b 0%, #0f172a 58%, #020617 100%)';
        const modalGradient = 'linear-gradient(180deg, #08111f 0%, #0f172a 100%)';
        const modalHeaderGradient = 'linear-gradient(180deg, #111827 0%, #0b1120 100%)';

        const StatBar = ({ label, value, color, compact = false }) => h("div", { className: compact ? "space-y-1" : "space-y-1" },
            h("div", { className: compact ? "flex items-center justify-between text-[9px] text-slate-400" : "flex items-center justify-between text-[10px] text-slate-300" },
                h("span", null, label),
                h("span", { className: "font-semibold text-white" }, clampPercent(value))
            ),
            h("div", { className: compact ? "h-1 rounded-full bg-white/10 overflow-hidden" : "h-1.5 rounded-full bg-white/10 overflow-hidden" },
                h("div", {
                    className: "h-full rounded-full transition-all",
                    style: {
                        width: `${clampPercent(value)}%`,
                        background: color
                    }
                })
            )
        );

        const getItemGlyph = (itemId) => ({
            daily_feed: '🍖',
            play_ball: '🎾',
            premium_meal: '✨',
            evolution_stone: '💎'
        }[itemId] || '🎁');

        const PetAvatar = ({ pet, size = 92, compact = false }) => {
            const species = SPECIES_BY_ID[pet?.speciesId] || null;
            const hatched = isHatchedPet(pet);
            const tone = getFrameTone(species);
            const rarity = getRarityMeta(species?.rarity);
            const artSrc = resolvePetArtSrc(pet);
            const [imageBroken, setImageBroken] = useState(false);

            useEffect(() => {
                setImageBroken(false);
            }, [pet?.speciesId, pet?.hatchedAt]);

            return h("div", {
                className: "relative shrink-0",
                style: {
                    width: `${size}px`,
                    height: `${Math.round(size * (compact ? 1.04 : 1.08))}px`
                }
            },
                h("div", {
                    className: "absolute inset-[-4px] rounded-[24px] blur-md opacity-90",
                    style: {
                        background: `radial-gradient(circle, ${rarity.glow} 0%, ${tone.glow} 48%, rgba(0,0,0,0) 78%)`
                    }
                }),
                h("div", {
                    className: "relative h-full rounded-[24px] overflow-hidden border shadow-[0_18px_36px_rgba(2,6,23,0.42)]",
                    style: {
                        borderColor: rarity.ring,
                        background: `linear-gradient(180deg, ${tone.start} 0%, ${tone.end} 100%)`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0 1px ${rarity.ring}, 0 20px 40px rgba(2,6,23,0.36)`
                    }
                },
                    h("div", {
                        className: "absolute inset-0 opacity-70",
                        style: {
                            background: 'radial-gradient(circle at 50% 28%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 32%, rgba(255,255,255,0) 68%)'
                        }
                    }),
                    h("div", {
                        className: "absolute inset-x-[14%] top-[12%] h-[1px] bg-white/18 rotate-[8deg]"
                    }),
                    h("div", {
                        className: "absolute inset-x-[20%] bottom-[22%] h-[1px] bg-white/8 -rotate-[10deg]"
                    }),
                    hatched && h("div", {
                        className: "absolute top-2 left-2 rounded-full px-2 py-0.5 text-[9px] font-black tracking-[0.16em]",
                        style: {
                            color: rarity.accent,
                            border: `1px solid ${rarity.ring}`,
                            background: 'rgba(15,23,42,0.7)'
                        }
                    }, rarity.shortLabel),
                    h("div", {
                        className: "absolute right-2 bottom-2 rounded-full flex items-center justify-center text-sm border border-white/10 bg-slate-950/80",
                        style: {
                            width: compact ? '22px' : '28px',
                            height: compact ? '22px' : '28px'
                        }
                    }, hatched ? (species?.emoji || '🐾') : '🐉'),
                    artSrc && !imageBroken && h("img", {
                        src: artSrc,
                        alt: hatched ? `${species?.name || '宠物'}形象` : '宠物蛋形象',
                        onError: () => setImageBroken(true),
                        className: "absolute inset-[8%] w-[84%] h-[84%] object-contain drop-shadow-[0_0_18px_rgba(129,236,255,0.22)]"
                    }),
                    (!artSrc || imageBroken) && h("div", {
                        className: "absolute inset-0 flex items-center justify-center"
                    },
                        h("div", {
                            style: {
                                fontSize: `${Math.max(28, Math.round(size * 0.4))}px`,
                                lineHeight: 1
                            }
                        }, hatched ? (species?.emoji || '🐾') : '🥚')
                    ),
                    h("div", {
                        className: "absolute inset-x-0 bottom-1 text-center text-[9px] font-black tracking-[0.24em]",
                        style: { color: hatched ? rarity.accent : '#fcd34d' }
                    }, hatched ? (species?.element || 'PET') : 'EGG')
                )
            );
        };

        const getMoodText = (pet) => {
            if (!isHatchedPet(pet)) return '等待孵化';
            const score = (Number(pet?.happiness) || 0) + (Number(pet?.health) || 0) + (Number(pet?.energy) || 0);
            if (score >= 240) return '状态极佳';
            if (score >= 190) return '精神饱满';
            if (score >= 150) return '状态稳定';
            return '需要照顾';
        };

        const buildDisplayPet = (pet) => (
            pet || {
                stage: 'egg',
                nickname: '宠物蛋',
                level: 1,
                exp: 0,
                happiness: INITIAL_PET_STATUS.happiness,
                health: INITIAL_PET_STATUS.health,
                energy: INITIAL_PET_STATUS.energy,
                careLog: []
            }
        );

        return function PetView({
            students,
            pets,
            onRenamePet,
            onBuyPetItem,
            onHatchPet,
            onResetPetSystem
        }) {
            const sourceStudents = Array.isArray(students) ? students : [];
            const petMap = pets?.pets || {};
            const [activeStudentId, setActiveStudentId] = useState('');
            const [nicknameDraft, setNicknameDraft] = useState('');
            const [shopOpen, setShopOpen] = useState(false);
            const [manageOpen, setManageOpen] = useState(false);

            useEffect(() => {
                if (!sourceStudents.length) {
                    setActiveStudentId('');
                    return;
                }
                const exists = sourceStudents.some((student) => String(student.id) === String(activeStudentId));
                if (!exists) setActiveStudentId(String(sourceStudents[0].id));
            }, [sourceStudents, activeStudentId]);

            const activeStudent = sourceStudents.find((student) => String(student.id) === String(activeStudentId)) || null;
            const activePet = buildDisplayPet(activeStudent ? petMap[String(activeStudent.id)] : null);
            const activeSpecies = SPECIES_BY_ID[activePet.speciesId] || null;

            useEffect(() => {
                setNicknameDraft(activePet.nickname || '');
            }, [activeStudentId, activePet.nickname]);

            const openStudentPanel = (studentId) => {
                setActiveStudentId(String(studentId));
                setShopOpen(true);
            };

            const handleRename = () => {
                if (!activeStudent || !isHatchedPet(activePet) || typeof onRenamePet !== 'function') return;
                const result = onRenamePet(activeStudent.id, nicknameDraft);
                if (!result?.ok && result?.message) alert(result.message);
            };

            const handlePurchase = (item) => {
                if (!activeStudent || typeof onBuyPetItem !== 'function') return;
                if (!confirm(`为 ${activeStudent.name} 购买 ${item.name}？\n消耗 ${item.price} 积分`)) return;
                const result = onBuyPetItem(activeStudent.id, item.id);
                if (!result?.ok && result?.message) alert(result.message);
            };

            const handleHatch = () => {
                if (!activeStudent || typeof onHatchPet !== 'function') return;
                const result = onHatchPet(activeStudent.id);
                if (!result?.ok && result?.message) alert(result.message);
            };

            const handleOpenManage = async () => {
                if (!await requireAdminAuth("请输入维护密码以进入宠物系统管理：")) return;
                setManageOpen(true);
            };

            const handleReset = () => {
                if (typeof onResetPetSystem !== 'function') return;
                if (!confirm('确定重置宠物系统吗？这会把全班宠物恢复为初始宠物蛋状态。')) return;
                const result = onResetPetSystem();
                if (!result?.ok && result?.message) {
                    alert(result.message);
                    return;
                }
                setManageOpen(false);
                setShopOpen(false);
            };

            if (!sourceStudents.length) {
                return h("div", {
                    className: "rounded-3xl border border-slate-800 p-8 text-center text-slate-300 shadow-xl",
                    style: { background: panelGradient }
                }, "当前没有学生数据，无法生成宠物画廊。");
            }

            return h("div", { className: "space-y-4 text-slate-100" },
                h("div", {
                    className: "rounded-3xl overflow-hidden border border-slate-800 shadow-xl",
                    style: { background: heroGradient }
                },
                    h("div", { className: "px-4 py-4 md:px-5 md:py-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between" },
                        h("div", null,
                            h("div", { className: "text-[11px] uppercase tracking-[0.28em] text-sky-200/80 font-semibold" }, "Pet Mission Board"),
                            h("h2", { className: "text-xl md:text-2xl font-black text-white mt-1" }, "班级宠物面板"),
                            h("p", { className: "text-xs md:text-sm text-slate-300 mt-2 max-w-2xl" }, "卡片直接显示核心状态，点击后进入宠物浮窗，进行孵化、改名和商城操作。")
                        ),
                        h("div", { className: "flex items-center gap-2 flex-wrap" },
                            h("div", { className: "text-xs text-slate-200 bg-white/10 border border-white/10 rounded-full px-3 py-2" }, `宠物蛋 ${sourceStudents.filter(student => !isHatchedPet(petMap[String(student.id)])).length} 枚`),
                            h("button", {
                                onClick: handleOpenManage,
                                className: "px-4 py-2 rounded-full text-sm font-semibold text-white bg-rose-500/90 hover:bg-rose-500"
                            }, "管理")
                        )
                    )
                ),
                h("div", {
                    className: "rounded-3xl border border-slate-800 p-3 md:p-4 shadow-2xl",
                    style: { background: shellGradient }
                },
                    h("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" },
                        sourceStudents.map((student) => {
                            const pet = buildDisplayPet(petMap[String(student.id)]);
                            const species = SPECIES_BY_ID[pet.speciesId] || null;
                            const hatched = isHatchedPet(pet);
                            const badgeText = hatched ? getStageLabel(pet.stage) : '待孵化';
                            const rarity = getRarityMeta(species?.rarity);
                            return h("button", {
                                key: student.id,
                                onClick: () => openStudentPanel(student.id),
                                className: "text-left rounded-3xl overflow-hidden border border-slate-700/90 shadow-lg hover:-translate-y-0.5 hover:border-sky-400/40 transition",
                                style: {
                                    background: panelGradient,
                                    boxShadow: '0 18px 40px rgba(2,6,23,0.42)'
                                }
                            },
                                h("div", { className: "px-3 py-2.5 border-b border-white/10 flex items-center justify-between gap-2 bg-white/[0.03]" },
                                    h("div", { className: "min-w-0" },
                                        h("div", { className: "text-sm font-black text-white truncate" }, student.name)
                                    ),
                                    h("span", { className: "text-[10px] px-2.5 py-1 rounded-full border border-white/10 bg-slate-900/90 text-slate-100 shrink-0" }, badgeText)
                                ),
                                h("div", { className: "p-3 space-y-2.5" },
                                    h("div", { className: "flex items-start gap-2.5" },
                                        h(PetAvatar, { pet, size: 84, compact: true }),
                                        h("div", { className: "min-w-0 flex-1 pt-0.5" },
                                            h("div", { className: "flex items-center gap-1.5 flex-wrap" },
                                                h("div", { className: "text-sm font-black text-white truncate" }, hatched ? pet.nickname : '宠物蛋'),
                                                hatched && h("span", {
                                                    className: "text-[10px] px-1.5 py-0.5 rounded-md border",
                                                    style: {
                                                        color: rarity.accent,
                                                        background: 'rgba(15,23,42,0.78)',
                                                        borderColor: rarity.ring
                                                    }
                                                }, species?.family || '宠物')
                                            ),
                                            h("div", { className: "text-[11px] text-slate-300 mt-1 truncate" }, hatched ? (species?.name || '班级宠物') : '点击卡片进入孵化舱'),
                                            h("div", { className: "text-[10px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap" },
                                                h("span", null, hatched ? '任务宠物已激活' : '全员同一起点'),
                                                hatched && h("span", { style: { color: rarity.accent } }, rarity.label)
                                            )
                                        )
                                    ),
                                    h("div", { className: "grid grid-cols-3 gap-1.5" },
                                        h("div", { className: "rounded-xl bg-slate-950/60 border border-white/8 px-2 py-1.5" },
                                            h("div", { className: "text-[9px] uppercase tracking-[0.16em] text-slate-500" }, "Lv"),
                                            h("div", { className: "text-xs font-black text-white mt-1" }, `Lv.${pet.level || 1}`)
                                        ),
                                        h("div", { className: "rounded-xl bg-slate-950/60 border border-white/8 px-2 py-1.5" },
                                            h("div", { className: "text-[9px] uppercase tracking-[0.16em] text-slate-500" }, "Exp"),
                                            h("div", { className: "text-xs font-black text-white mt-1" }, pet.exp || 0)
                                        ),
                                        h("div", { className: "rounded-xl bg-slate-950/60 border border-white/8 px-2 py-1.5" },
                                            h("div", { className: "text-[9px] uppercase tracking-[0.16em] text-slate-500" }, "Mood"),
                                            h("div", { className: "text-[11px] font-black text-white mt-1 truncate" }, getMoodText(pet))
                                        )
                                    ),
                                    h("div", { className: "grid grid-cols-3 gap-1.5" },
                                        h("div", { className: "rounded-xl border border-white/8 bg-white/[0.03] px-2 py-1.5" },
                                            h(StatBar, { compact: true, label: '快乐', value: pet.happiness, color: 'linear-gradient(90deg,#fb7185,#f97316)' })
                                        ),
                                        h("div", { className: "rounded-xl border border-white/8 bg-white/[0.03] px-2 py-1.5" },
                                            h(StatBar, { compact: true, label: '健康', value: pet.health, color: 'linear-gradient(90deg,#34d399,#22c55e)' })
                                        ),
                                        h("div", { className: "rounded-xl border border-white/8 bg-white/[0.03] px-2 py-1.5" },
                                            h(StatBar, { compact: true, label: '精力', value: pet.energy, color: 'linear-gradient(90deg,#60a5fa,#2563eb)' })
                                        )
                                    ),
                                    h("div", { className: "flex items-center justify-between text-[10px] text-slate-400 px-0.5" },
                                        h("span", null, hatched ? '点击打开宠物商城浮窗' : '点击孵化宠物蛋'),
                                        h("span", { className: "text-sky-300" }, '查看详情')
                                    )
                                )
                            );
                        })
                    )
                ),
                h(Modal, {
                    isOpen: shopOpen && !!activeStudent,
                    title: activeStudent ? `${activeStudent.name} 的宠物舱` : '宠物舱',
                    onClose: () => setShopOpen(false),
                    onConfirm: null,
                    panelClassName: 'max-w-5xl border border-slate-800 text-slate-100',
                    headerClassName: 'border-slate-800',
                    bodyClassName: '',
                    footerClassName: 'border-t border-slate-800',
                    titleClassName: 'text-white',
                    closeButtonClassName: 'text-slate-400 hover:text-white',
                    cancelButtonClassName: 'text-slate-200 hover:bg-white/10',
                    panelStyle: {
                        background: modalGradient,
                        boxShadow: '0 30px 80px rgba(2,6,23,0.58)'
                    },
                    headerStyle: { background: modalHeaderGradient },
                    bodyStyle: { background: panelGradient },
                    footerStyle: { background: '#0b1120' }
                },
                    activeStudent && h("div", { className: "space-y-5 text-slate-100" },
                        h("div", {
                            className: "rounded-3xl border border-slate-800 p-4 shadow-xl",
                            style: { background: heroGradient }
                        },
                            h("div", { className: "flex flex-col gap-4 md:flex-row md:items-start" },
                                h(PetAvatar, { pet: activePet, size: 150 }),
                                h("div", { className: "min-w-0 flex-1" },
                                    h("div", { className: "flex items-center gap-2 flex-wrap" },
                                        h("div", { className: "text-xl font-black text-white" }, isHatchedPet(activePet) ? activePet.nickname : '宠物蛋'),
                                        h("span", { className: "text-xs px-2 py-1 rounded-full border border-white/10 bg-white/10 text-slate-100" }, isHatchedPet(activePet) ? getStageLabel(activePet.stage) : '待孵化'),
                                        isHatchedPet(activePet) && h("span", {
                                            className: "text-xs px-2 py-1 rounded-full border",
                                            style: {
                                                color: getRarityMeta(activeSpecies?.rarity).accent,
                                                borderColor: getRarityMeta(activeSpecies?.rarity).ring,
                                                background: 'rgba(15,23,42,0.72)'
                                            }
                                        }, getRarityMeta(activeSpecies?.rarity).label)
                                    ),
                                    h("div", { className: "text-sm text-slate-300 mt-1" }, isHatchedPet(activePet) ? (activeSpecies?.name || '班级宠物') : '所有同学最开始都会从同一枚宠物蛋起步'),
                                    h("div", { className: "grid grid-cols-2 gap-2 mt-4 md:grid-cols-4" },
                                        h("div", { className: "rounded-2xl border border-white/8 bg-slate-950/50 px-3 py-2" },
                                            h("div", { className: "text-[10px] uppercase tracking-[0.16em] text-slate-500" }, "Level"),
                                            h("div", { className: "text-sm font-black text-white mt-1" }, `Lv.${activePet.level || 1}`)
                                        ),
                                        h("div", { className: "rounded-2xl border border-white/8 bg-slate-950/50 px-3 py-2" },
                                            h("div", { className: "text-[10px] uppercase tracking-[0.16em] text-slate-500" }, "Exp"),
                                            h("div", { className: "text-sm font-black text-white mt-1" }, activePet.exp || 0)
                                        ),
                                        h("div", { className: "rounded-2xl border border-white/8 bg-slate-950/50 px-3 py-2" },
                                            h("div", { className: "text-[10px] uppercase tracking-[0.16em] text-slate-500" }, "Mood"),
                                            h("div", { className: "text-sm font-black text-white mt-1" }, getMoodText(activePet))
                                        ),
                                        h("div", { className: "rounded-2xl border border-white/8 bg-slate-950/50 px-3 py-2" },
                                            h("div", { className: "text-[10px] uppercase tracking-[0.16em] text-slate-500" }, "Balance"),
                                            h("div", { className: "text-sm font-black text-amber-300 mt-1" }, activeStudent.balance || 0)
                                        )
                                    ),
                                    isHatchedPet(activePet) && h("div", { className: "grid grid-cols-3 gap-2 mt-4" },
                                        h("div", { className: "rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2" },
                                            h(StatBar, { compact: true, label: '快乐', value: activePet.happiness, color: 'linear-gradient(90deg,#fb7185,#f97316)' })
                                        ),
                                        h("div", { className: "rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2" },
                                            h(StatBar, { compact: true, label: '健康', value: activePet.health, color: 'linear-gradient(90deg,#34d399,#22c55e)' })
                                        ),
                                        h("div", { className: "rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2" },
                                            h(StatBar, { compact: true, label: '精力', value: activePet.energy, color: 'linear-gradient(90deg,#60a5fa,#2563eb)' })
                                        )
                                    )
                                )
                            )
                        ),
                        !isHatchedPet(activePet)
                            ? h("div", {
                                className: "rounded-3xl border border-amber-400/20 p-4 space-y-3",
                                style: { background: 'linear-gradient(180deg, #2a1708 0%, #111827 100%)' }
                            },
                                h("div", { className: "font-bold text-amber-200" }, "孵化说明"),
                                h("div", { className: "text-sm text-amber-100/80" }, "点击下方按钮后，将随机获得 1 只班级宠物。从孵化时刻开始，后续积分与考勤才会影响它的成长。"),
                                h("button", {
                                    onClick: handleHatch,
                                    className: "w-full px-4 py-3 rounded-2xl text-white font-bold hover:brightness-110",
                                    style: { background: 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)' }
                                }, "立即孵化")
                            )
                            : h("div", { className: "space-y-5" },
                                h("div", {
                                    className: "space-y-3 rounded-3xl border border-slate-800 p-4",
                                    style: { background: panelGradient }
                                },
                                    h("div", { className: "text-sm font-semibold text-slate-200" }, "宠物昵称"),
                                    h("div", { className: "flex gap-2" },
                                        h("input", {
                                            value: nicknameDraft,
                                            onChange: (event) => setNicknameDraft(event.target.value),
                                            maxLength: 12,
                                            className: "flex-1 rounded-xl border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-300",
                                            style: {
                                                background: '#f8fafc',
                                                borderColor: 'rgba(148,163,184,0.35)'
                                            },
                                            placeholder: "输入 1-12 个字"
                                        }),
                                        h("button", {
                                            onClick: handleRename,
                                            className: "px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-500"
                                        }, "保存")
                                    )
                                ),
                                h("div", {
                                    className: "space-y-3 rounded-3xl border border-slate-800 p-4",
                                    style: { background: panelGradient }
                                },
                                    h("div", { className: "text-sm font-semibold text-slate-200" }, "宠物商城"),
                                    SHOP_ITEMS.map((item) => h("div", {
                                        key: item.id,
                                        className: "rounded-2xl border border-white/10 bg-slate-950/50 p-4 flex items-center justify-between gap-4"
                                    },
                                        h("div", { className: "min-w-0 flex items-start gap-3" },
                                            h("div", {
                                                className: "shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center text-xl",
                                                style: { width: '46px', height: '46px' }
                                            }, getItemGlyph(item.id)),
                                            h("div", { className: "min-w-0" },
                                                h("div", { className: "flex items-center gap-2 flex-wrap" },
                                                    h("div", { className: "font-semibold text-white" }, item.name),
                                                    h("span", {
                                                        className: "text-[10px] px-2 py-0.5 rounded-full border",
                                                        style: {
                                                            color: getShopRarityMeta(item.rarity).accent,
                                                            borderColor: `${getShopRarityMeta(item.rarity).accent}55`,
                                                            background: 'rgba(15,23,42,0.7)'
                                                        }
                                                    }, getShopRarityMeta(item.rarity).label)
                                                ),
                                                h("div", { className: "text-xs text-slate-400 mt-1" }, item.desc),
                                                h("div", { className: "text-xs text-slate-500 mt-2" }, formatBoost(item.boost))
                                            )
                                        ),
                                        h("div", { className: "text-right shrink-0" },
                                            h("div", { className: "text-sm font-bold text-amber-300" }, `${item.price} 积分`),
                                            h("button", {
                                                onClick: () => handlePurchase(item),
                                                className: "mt-2 px-3 py-2 rounded-xl text-white text-sm font-semibold hover:brightness-110",
                                                style: { background: 'linear-gradient(90deg, #0ea5e9 0%, #38bdf8 100%)' }
                                            }, "购买")
                                        )
                                    ))
                                ),
                                h("div", {
                                    className: "space-y-3 rounded-3xl border border-slate-800 p-4",
                                    style: { background: panelGradient }
                                },
                                    h("div", { className: "text-sm font-semibold text-slate-200" }, "最近照顾记录"),
                                    (!Array.isArray(activePet.careLog) || activePet.careLog.length === 0)
                                        ? h("div", { className: "rounded-2xl bg-slate-950/50 p-4 text-sm text-slate-400" }, "还没有使用过宠物道具。")
                                        : activePet.careLog.slice(0, 5).map((entry) => h("div", {
                                            key: entry.id,
                                            className: "rounded-2xl bg-slate-950/50 p-4 border border-white/8"
                                        },
                                            h("div", { className: "flex items-center justify-between gap-3" },
                                                h("div", { className: "font-semibold text-slate-200" }, entry.itemName),
                                                h("div", { className: "text-xs text-slate-500" }, new Date(entry.ts).toLocaleString())
                                            ),
                                            h("div", { className: "text-xs text-slate-500 mt-2" }, formatBoost(entry.boost))
                                        ))
                                )
                            )
                    )
                ),
                h(Modal, {
                    isOpen: manageOpen,
                    title: '宠物系统管理',
                    onClose: () => setManageOpen(false),
                    onConfirm: null,
                    type: 'danger',
                    panelClassName: 'max-w-2xl bg-white',
                    titleClassName: 'text-slate-900'
                },
                    h("div", { className: "space-y-4" },
                        h("div", { className: "rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800" },
                            "重置后，全班宠物会恢复为初始宠物蛋状态，所有已孵化、等级、照顾记录都会清空。学生余额不会变化。"
                        ),
                        h("button", {
                            onClick: handleReset,
                            className: "w-full px-4 py-3 rounded-2xl bg-rose-600 text-white font-bold hover:bg-rose-700"
                        }, "重置宠物系统")
                    )
                )
            );
        };
    };
})();
