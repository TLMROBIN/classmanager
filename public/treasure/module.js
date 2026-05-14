(function() {
    window.createTreasureView = function createTreasureView(deps) {
        const {
            h,
            useState,
            Modal,
            Icon,
            requireAdminAuth,
            getTodayStr
        } = deps || {};

        if (!h || !useState || !Modal || !Icon || !requireAdminAuth || !getTodayStr) {
            throw new Error('TreasureView dependencies are missing');
        }
        if (typeof window.createTreasureIo !== 'function') {
            throw new Error('Treasure IO helpers are missing');
        }
        const treasureIo = window.createTreasureIo({ getTodayStr });
        const DEFAULT_GACHA_CONFIG = {
            rates: {
                SSR: 0.05,
                SR: 4.95,
                R: 25,
                N: 70
            },
            costs: {
                single: 15,
                ten: 120
            }
        };
        const roundRate = (value) => Math.round(Number(value) * 100) / 100;
        const formatRate = (value) => {
            const rate = roundRate(value);
            return Number.isInteger(rate) ? String(rate) : rate.toFixed(2).replace(/\.?0+$/, '');
        };
        const normalizeGachaConfig = (source, fallback = DEFAULT_GACHA_CONFIG) => {
            const safeFallbackRates = fallback?.rates || DEFAULT_GACHA_CONFIG.rates;
            const safeFallbackCosts = fallback?.costs || DEFAULT_GACHA_CONFIG.costs;
            const safeSource = source && typeof source === 'object' ? source : {};
            const sourceRates = safeSource.rates && typeof safeSource.rates === 'object' ? safeSource.rates : safeSource;
            const sourceCosts = safeSource.costs && typeof safeSource.costs === 'object' ? safeSource.costs : safeSource;
            return {
                rates: {
                    SSR: Number.isFinite(Number(sourceRates.SSR)) ? roundRate(sourceRates.SSR) : safeFallbackRates.SSR,
                    SR: Number.isFinite(Number(sourceRates.SR)) ? roundRate(sourceRates.SR) : safeFallbackRates.SR,
                    R: Number.isFinite(Number(sourceRates.R)) ? roundRate(sourceRates.R) : safeFallbackRates.R,
                    N: Number.isFinite(Number(sourceRates.N)) ? roundRate(sourceRates.N) : safeFallbackRates.N
                },
                costs: {
                    single: Number.isFinite(Number(sourceCosts.single)) && Number(sourceCosts.single) >= 0 ? roundRate(sourceCosts.single) : safeFallbackCosts.single,
                    ten: Number.isFinite(Number(sourceCosts.ten)) && Number(sourceCosts.ten) >= 0 ? roundRate(sourceCosts.ten) : safeFallbackCosts.ten
                }
            };
        };
        const formatGachaPublicity = (config) => {
            const rates = normalizeGachaConfig(config).rates;
            return `SSR ${formatRate(rates.SSR)}% | SR ${formatRate(rates.SR)}% | R ${formatRate(rates.R)}% | N ${formatRate(rates.N)}%`;
        };
        const formatGachaPriceSummary = (config) => {
            const costs = normalizeGachaConfig(config).costs;
            return `单抽 ${formatRate(costs.single)} 积分 | 十连 ${formatRate(costs.ten)} 积分`;
        };
        const createGachaDraft = (config, fallback = DEFAULT_GACHA_CONFIG) => {
            const normalized = normalizeGachaConfig(config, fallback);
            const rates = normalized.rates;
            const costs = normalized.costs;
            return {
                SSR: formatRate(rates.SSR),
                SR: formatRate(rates.SR),
                R: formatRate(rates.R),
                N: formatRate(rates.N),
                single: formatRate(costs.single),
                ten: formatRate(costs.ten)
            };
        };
        const parseDraftRate = (value) => {
            if (value == null) return NaN;
            const text = String(value).trim();
            if (!text) return NaN;
            const parsed = Number(text);
            return Number.isFinite(parsed) ? roundRate(parsed) : NaN;
        };
        const buildGachaConfigFromDraft = (draft) => {
            const rates = {};
            for (const rarity of ['SSR', 'SR', 'R', 'N']) {
                const parsed = parseDraftRate(draft?.[rarity]);
                if (!Number.isFinite(parsed) || parsed < 0) {
                    return { ok: false, message: `${rarity} 概率格式不正确` };
                }
                rates[rarity] = parsed;
            }
            const total = rates.SSR + rates.SR + rates.R + rates.N;
            if (Math.abs(total - 100) > 0.01) {
                return { ok: false, message: `概率总和需为 100%，当前为 ${formatRate(total)}%` };
            }
            const costs = {};
            for (const key of ['single', 'ten']) {
                const parsed = parseDraftRate(draft?.[key]);
                if (!Number.isFinite(parsed) || parsed < 0) {
                    return { ok: false, message: key === 'single' ? '单抽价格格式不正确' : '十连价格格式不正确' };
                }
                costs[key] = parsed;
            }
            return {
                ok: true,
                value: { rates, costs }
            };
        };

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

        return function TreasureView({
            students,
            treasures,
            storage,
            logs,
            gachaConfig,
            defaultGachaConfig,
            redemptionHistory = {},
            dailyUsageCounts = {},
            liquidatedTreasures = [],
            liquidationEnabled = false,
            onReturnItem,
            onRedeemTreasure,
            onUseItem,
            onPerformGacha,
            onUpdateGachaConfig,
            onSaveItem,
            onDeleteItem,
            onImportTreasureData,
            onRedeemLiquidatedItem,
            onToggleLiquidation
        }) {
            const treasurePoints = window.TreasurePoints || {};
            const {
                getTreasurePrice,
                getNextTreasurePriceHint
            } = treasurePoints;
            const createEmptyItemData = () => ({ id: null, name: '', rarity: 'N', price: 10, stock: 10, desc: '', ladderPrices: '', dailyLimit: 0 });
            const [tab, setTab] = useState('shop');
            const [selectedStudent, setSelectedStudent] = useState("");
            const [gachaResult, setGachaResult] = useState(null);
            const [isGachaAnimating, setIsGachaAnimating] = useState(false);
            const [addModalOpen, setAddModalOpen] = useState(false);
            const [editMode, setEditMode] = useState(false);
            const [newItemData, setNewItemData] = useState(createEmptyItemData);
            const resolvedDefaultGachaConfig = normalizeGachaConfig(defaultGachaConfig, DEFAULT_GACHA_CONFIG);
            const resolvedGachaConfig = normalizeGachaConfig(gachaConfig, resolvedDefaultGachaConfig);
            const [gachaDraft, setGachaDraft] = useState(() => createGachaDraft(resolvedGachaConfig, resolvedDefaultGachaConfig));
            const [isSavingGachaConfig, setIsSavingGachaConfig] = useState(false);

            const handleTabChange = async (t) => {
                if (t === 'admin') {
                    if (!await requireAdminAuth("请输入维护密码以进入管理模式：")) return;
                    setGachaDraft(createGachaDraft(resolvedGachaConfig, resolvedDefaultGachaConfig));
                }
                setTab(t);
            };

            const handleBuy = (item) => {
                if (!selectedStudent) return alert("请先选择一名学生");
                const student = students.find(s => s.id == selectedStudent);
                if (!student) return;

                const currentPrice = getTreasurePrice({
                    studentId: student.id,
                    item,
                    redemptionHistory
                });
                if (!confirm(`确定为 ${student.name} 兑换 ${item.name} 吗？\n消耗: ${currentPrice} 积分`)) return;
                if (typeof onRedeemTreasure !== 'function') return alert("兑换功能不可用");

                const result = onRedeemTreasure(student.id, item.id);
                if (result?.ok) {
                    alert("兑换成功！");
                } else {
                    alert(result?.message || "兑换失败，请重试");
                }
            };

            const handleBuyLiquidated = (item) => {
                if (!selectedStudent) return alert("请先选择一名学生");
                const student = students.find(s => s.id == selectedStudent);
                if (!student) return;
                if (!confirm(`确定为 ${student.name} 兑换清算物品 ${item.name} 吗？\n消耗: ${item.price} 积分`)) return;
                if (typeof onRedeemLiquidatedItem !== 'function') return alert("兑换功能不可用");

                const result = onRedeemLiquidatedItem(student.id, item.id);
                if (result?.ok) {
                    alert("兑换成功！");
                } else {
                    alert(result?.message || "兑换失败，请重试");
                }
            };

            const handleUseItem = (itemId) => {
                if (!selectedStudent) return alert("请先选择学生");
                const student = students.find(s => s.id == selectedStudent);
                if (!student) return;
                const count = storage[student.id]?.[itemId] || 0;
                if (count <= 0) return alert("该物品数量不足");
                const item = treasures.find(t => t.id == itemId) || { name: "未知物品", rarity: "N" };
                if (!confirm(`确定要使用 ${item.name} 吗？`)) return;
                if (typeof onUseItem !== 'function') return alert("使用功能不可用");

                const result = onUseItem(student.id, itemId);
                if (result?.ok) {
                    alert("使用成功！");
                } else {
                    alert(result?.message || "使用失败，请重试");
                }
            };

            const handleReturnItem = async (itemId) => {
                if (!selectedStudent) return alert("请先选择学生");
                const student = students.find(s => s.id == selectedStudent);
                if (!student) return;
                const count = storage[student.id]?.[itemId] || 0;
                if (count <= 0) return;
                const item = treasures.find(t => t.id == itemId);
                if (!item) return;

                if (!await requireAdminAuth("请输入维护密码以退回宝物：")) return;
                if (typeof onReturnItem !== 'function') return alert("退回功能不可用");

                const result = onReturnItem(student.id, itemId);
                if (result?.ok) {
                    alert("退回成功！");
                } else if (result?.message) {
                    alert(result.message);
                }
            };

            const performGacha = (times) => {
                if (!selectedStudent) return alert("请先选择祈愿对象");
                const student = students.find(s => s.id == selectedStudent);
                if (!student) return;
                setIsGachaAnimating(true);

                setTimeout(() => {
                    setIsGachaAnimating(false);
                    if (typeof onPerformGacha !== 'function') return alert("祈愿功能不可用");

                    const result = onPerformGacha(student.id, times);
                    if (!result?.ok) return alert(result?.message || "祈愿失败，请重试");

                    setGachaResult(Array.isArray(result?.ui?.gachaResults) ? result.ui.gachaResults : []);
                }, 2500);
            };

            const handleSaveGachaConfig = () => {
                const parsed = buildGachaConfigFromDraft(gachaDraft);
                if (!parsed.ok) return alert(parsed.message);
                if (typeof onUpdateGachaConfig !== 'function') return alert("祈愿设置保存功能不可用");

                setIsSavingGachaConfig(true);
                Promise.resolve(onUpdateGachaConfig(parsed.value))
                    .then((result) => {
                        if (!result?.ok) {
                            if (result?.message) alert(result.message);
                            return;
                        }
                        const savedConfig = normalizeGachaConfig(result.gachaConfig || parsed.value, resolvedDefaultGachaConfig);
                        setGachaDraft(createGachaDraft(savedConfig, resolvedDefaultGachaConfig));
                        alert("祈愿设置已保存");
                    })
                    .catch((err) => {
                        console.error('保存祈愿设置失败:', err);
                        alert(err?.message || "祈愿设置保存失败，请重试");
                    })
                    .finally(() => {
                        setIsSavingGachaConfig(false);
                    });
            };

            const handleSaveItem = () => {
                if (typeof onSaveItem !== 'function') return alert("保存功能不可用");
                const result = onSaveItem(newItemData, editMode);
                if (!result?.ok) return alert(result?.message || "保存失败，请重试");
                setAddModalOpen(false);
                setEditMode(false);
                setNewItemData(createEmptyItemData());
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
                if (typeof onDeleteItem !== 'function') return alert("删除功能不可用");

                const result = onDeleteItem(item.id);
                if (!result?.ok) return alert(result?.message || "删除失败，请重试");

                if (editMode && newItemData.id === item.id) {
                    setAddModalOpen(false);
                    setEditMode(false);
                    setNewItemData(createEmptyItemData());
                }
            };

            const handleExportTreasureExcel = () => treasureIo.exportTreasureExcel({
                treasures,
                storage,
                students
            });

            const handleImportTreasureExcel = (e) => treasureIo.importTreasureExcel({
                event: e,
                students,
                onImportTreasureData
            });

            const rarityColor = (r) => {
                switch (r) {
                    case 'SSR': return 'text-yellow-500 border-yellow-500 bg-yellow-50 glow-ssr';
                    case 'SR': return 'text-purple-500 border-purple-500 bg-purple-50 glow-sr';
                    case 'R': return 'text-blue-500 border-blue-500 bg-blue-50 glow-r';
                    default: return 'text-gray-500 border-gray-400 bg-gray-50 glow-n';
                }
            };

            const sortedTreasures = [...treasures].sort((a, b) => {
                const rank = { SSR: 4, SR: 3, R: 2, N: 1 };
                return rank[b.rarity] - rank[a.rarity];
            });
            const draftTotal = ['SSR', 'SR', 'R', 'N'].reduce((sum, rarity) => {
                const parsed = parseDraftRate(gachaDraft[rarity]);
                return Number.isFinite(parsed) ? sum + parsed : sum;
            }, 0);
            const hasInvalidDraftRateValue = ['SSR', 'SR', 'R', 'N'].some((rarity) => !Number.isFinite(parseDraftRate(gachaDraft[rarity])) || parseDraftRate(gachaDraft[rarity]) < 0);
            const hasInvalidDraftCostValue = ['single', 'ten'].some((key) => !Number.isFinite(parseDraftRate(gachaDraft[key])) || parseDraftRate(gachaDraft[key]) < 0);
            const isDraftTotalValid = !hasInvalidDraftRateValue && Math.abs(draftTotal - 100) <= 0.01;
            const isGachaDraftValid = isDraftTotalValid && !hasInvalidDraftCostValue;
            const currentGachaPublicity = formatGachaPublicity(resolvedGachaConfig);
            const currentGachaPriceSummary = formatGachaPriceSummary(resolvedGachaConfig);

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
                        h("span", { className: "font-mono font-bold text-green-600 text-lg" }, students.find(s => s.id == selectedStudent).balance)
                    )
                ),
                h("div", { className: "flex-1 p-4 bg-gray-100 overflow-y-auto relative" },
                    tab === 'shop' && h("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4" },
                        sortedTreasures.map(item => {
                            const finalPrice = selectedStudent ? getTreasurePrice({
                                studentId: selectedStudent,
                                item,
                                redemptionHistory
                            }) : item.price;
                            const nextPriceHint = selectedStudent ? getNextTreasurePriceHint({
                                studentId: selectedStudent,
                                item,
                                redemptionHistory
                            }) : null;

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
                    liquidatedTreasures.filter(t => t.stock > 0).length > 0 && h("div", { className: "mt-6" },
                        h("div", { className: "flex items-center gap-2 mb-3" },
                            h("span", { className: "text-lg font-bold text-orange-600" }, "🔥 清算专区"),
                            h("span", { className: "text-xs text-orange-400" }, "破产清算物品，八五折特惠")
                        ),
                        h("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4" },
                            liquidatedTreasures.filter(t => t.stock > 0).map(item =>
                                h("div", { key: item.id, className: "bg-white rounded-lg shadow border-2 border-orange-300 p-3 flex flex-col relative bg-orange-50" },
                                    h("div", { className: "absolute top-2 right-2 text-xs font-bold px-1 rounded border border-orange-400 text-orange-600 bg-orange-100" }, item.rarity),
                                    h("div", { className: "font-bold text-gray-800" }, item.name),
                                    h("div", { className: "text-xs text-gray-500 mb-2 h-8 overflow-hidden" }, item.desc),
                                    item.ownerStudentName && h("div", { className: "text-xs text-orange-600 mb-1" }, `来源: ${item.ownerStudentName}`),
                                    item.originalPrice && h("div", { className: "text-xs text-gray-400 line-through" }, `原价: ${item.originalPrice}`),
                                    h("div", { className: "mt-auto flex justify-between items-center" },
                                        h("div", { className: "text-sm text-gray-500" }, `库存: ${item.stock}`),
                                        h("button", { onClick: () => handleBuyLiquidated(item), className: "bg-orange-500 text-white px-3 py-1 rounded text-xs hover:bg-orange-600" }, `${item.price} 积分`)
                                    )
                                )
                            )
                        )
                    ),
                    tab === 'gacha' && h("div", { className: "h-full flex flex-col items-center justify-center relative overflow-hidden rounded-xl bg-space" },
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
                                    h("div", { className: "text-sm text-blue-200" }, `${formatRate(resolvedGachaConfig.costs.single)} 积分`)
                                ),
                                h("button", {
                                    onClick: () => performGacha(10),
                                    className: "group relative px-8 py-4 bg-purple-600/80 hover:bg-purple-600 text-white rounded-xl backdrop-blur border border-purple-400 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(147,51,234,0.5)]"
                                },
                                    h("div", { className: "text-xl font-bold" }, "祈愿 10 次"),
                                    h("div", { className: "text-sm text-purple-200" }, `${formatRate(resolvedGachaConfig.costs.ten)} 积分`)
                                )
                            )
                        ),
                        h("div", { className: "mt-12 text-gray-400 text-xs z-10" }, `概率公示: ${currentGachaPublicity}`)
                    ),
                    isGachaAnimating && h("div", { className: "fixed inset-0 z-50 bg-space flex flex-col items-center justify-center overflow-hidden" },
                        Array.from({ length: 50 }).map((_, i) =>
                            h("div", { key: i, className: "star", style: { top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, width: `${Math.random() * 3}px`, height: `${Math.random() * 3}px`, animationDelay: `${Math.random() * 3}s` } })
                        ),
                        h("div", { className: "meteor-shower", style: { top: "10%", left: "80%" } }),
                        h("div", { className: "meteor-shower", style: { top: "20%", left: "40%", animationDelay: "1.5s" } }),
                        h("div", { className: "z-50 text-center animate-pulse-glow" },
                            h("div", { className: "w-32 h-32 mx-auto mb-8 animate-spin-slow" }, h(GachaCrystal)),
                            h("h2", { className: "text-3xl font-bold text-white tracking-widest" }, "祈愿中...")
                        )
                    ),
                    gachaResult && h("div", { className: "fixed inset-0 z-50 bg-space flex flex-col items-center justify-center overflow-hidden p-4" },
                        h("div", { className: "absolute inset-0 bg-black/80" }),
                        h("div", { className: "z-50 w-full max-w-6xl flex flex-col items-center h-full justify-center" },
                            h("h2", { className: "text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500 mb-8 animate-slide-up" }, "⭐ 祈愿结果 ⭐"),
                            h("div", { className: "flex flex-wrap gap-6 justify-center max-h-[60vh] overflow-y-auto p-4" },
                                gachaResult.map((item, idx) =>
                                    h("div", {
                                        key: idx,
                                        className: "w-40 h-56 rounded-xl border-4 flex flex-col items-center justify-between p-4 bg-gray-900 shadow-2xl card-enter relative overflow-hidden group hover:scale-105 transition-transform duration-300",
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
                                h("button", { onClick: () => { setGachaResult(null); performGacha(1); }, className: "px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold shadow-lg transition transform hover:-translate-y-1" }, `再抽一次 (${formatRate(resolvedGachaConfig.costs.single)})`),
                                h("button", { onClick: () => { setGachaResult(null); performGacha(10); }, className: "px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold shadow-lg transition transform hover:-translate-y-1" }, `再抽十次 (${formatRate(resolvedGachaConfig.costs.ten)})`),
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
                                const item = treasures.find(t => t.id == tid) || liquidatedTreasures.find(t => t.id == tid);
                                const count = storage[selectedStudent][tid];
                                if (!item) return null;
                                const isLegacyLiquidatedItem = item.liquidation === true && item.originalTreasureId;

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
                                        !isLegacyLiquidatedItem && h("button", { onClick: () => handleUseItem(tid), className: "bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600" }, "使用"),
                                        !isLegacyLiquidatedItem && h("button", { onClick: () => handleReturnItem(tid), className: "bg-amber-500 text-white px-3 py-1 rounded text-xs hover:bg-amber-600" }, "退回")
                                    )
                                );
                            })
                        )
                    ),
                    tab === 'admin' && h("div", { className: "space-y-6" },
                        h("div", { className: "bg-white p-4 rounded shadow" },
                            h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                                h("div", null,
                                    h("h4", { className: "font-bold text-gray-800" }, "清算设置"),
                                    h("p", { className: "text-xs text-gray-500 mt-1" }, "开启后，学生余额为负时自动清算储物箱宝物，按70%返还积分，物品以85折上架到清算专区。")
                                ),
                                h("label", { className: "flex items-center gap-2 cursor-pointer" },
                                    h("input", {
                                        type: "checkbox",
                                        checked: liquidationEnabled,
                                        onChange: () => { if (typeof onToggleLiquidation === 'function') onToggleLiquidation(!liquidationEnabled); },
                                        className: "w-5 h-5 accent-orange-500"
                                    }),
                                    h("span", { className: "text-sm font-medium " + (liquidationEnabled ? "text-orange-600" : "text-gray-600") }, liquidationEnabled ? "已开启" : "已关闭")
                                )
                            )
                        ),
                        h("div", { className: "bg-white p-4 rounded shadow" },
                            h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                                h("div", null,
                                    h("h4", { className: "font-bold text-gray-800" }, "数据导入导出"),
                                    h("p", { className: "text-xs text-gray-500 mt-1" }, "导出或导入宝物库存与学生储物箱，包含基础价格、阶梯价格、库存、日限额和稳定 ID。")
                                ),
                                h("div", { className: "flex flex-wrap gap-2" },
                                    h("button", {
                                        onClick: handleExportTreasureExcel,
                                        className: "px-3 py-2 border border-purple-500 text-purple-600 rounded hover:bg-purple-50 text-sm font-medium"
                                    }, "导出 Excel"),
                                    h("label", {
                                        className: "px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm font-medium cursor-pointer"
                                    },
                                        "导入 Excel",
                                        h("input", {
                                            type: "file",
                                            accept: ".xlsx,.xls",
                                            onChange: handleImportTreasureExcel,
                                            style: { display: "none" }
                                        })
                                    )
                                )
                            )
                        ),
                        h("div", { className: "bg-white p-4 rounded shadow" },
                            h("h4", { className: "font-bold mb-4" }, "库存管理 (仅管理员)"),
                            h("div", { className: "flex gap-2 mb-4" },
                                h("button", { onClick: () => { setEditMode(false); setNewItemData(createEmptyItemData()); setAddModalOpen(true); }, className: "px-3 py-1 border border-green-500 text-green-600 rounded hover:bg-green-50 text-sm flex items-center gap-1" }, h(Icon, { name: "plus", size: 14 }), "手动添加")
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
                        h("div", { className: "bg-white p-4 rounded shadow space-y-4" },
                            h("div", { className: "flex flex-col gap-3 md:flex-row md:items-start md:justify-between" },
                                h("div", null,
                                    h("h4", { className: "font-bold text-gray-800" }, "祈愿设置"),
                                    h("p", { className: "text-xs text-gray-500 mt-1" }, "在这里统一调整祈愿概率和价格。概率总和必须为 100%；若目标稀有度库存为空，仍会自动降档补抽。")
                                ),
                                h("div", { className: "text-xs text-gray-500 md:text-right space-y-1" },
                                    h("div", null, `当前概率: ${currentGachaPublicity}`),
                                    h("div", null, `当前价格: ${currentGachaPriceSummary}`)
                                )
                            ),
                            h("div", { className: "space-y-2" },
                                h("div", { className: "text-sm font-bold text-gray-700" }, "价格"),
                                h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
                                    h("label", { className: "space-y-1 text-sm" },
                                        h("div", { className: "font-bold text-gray-700" }, "单抽价格"),
                                        h("div", { className: "flex items-center gap-2" },
                                            h("input", {
                                                type: "number",
                                                step: "0.01",
                                                min: "0",
                                                className: "border w-full p-2 rounded",
                                                value: gachaDraft.single,
                                                onChange: (e) => setGachaDraft(prev => ({ ...prev, single: e.target.value }))
                                            }),
                                            h("span", { className: "text-gray-400 text-xs" }, "积分")
                                        )
                                    ),
                                    h("label", { className: "space-y-1 text-sm" },
                                        h("div", { className: "font-bold text-gray-700" }, "十连价格"),
                                        h("div", { className: "flex items-center gap-2" },
                                            h("input", {
                                                type: "number",
                                                step: "0.01",
                                                min: "0",
                                                className: "border w-full p-2 rounded",
                                                value: gachaDraft.ten,
                                                onChange: (e) => setGachaDraft(prev => ({ ...prev, ten: e.target.value }))
                                            }),
                                            h("span", { className: "text-gray-400 text-xs" }, "积分")
                                        )
                                    )
                                )
                            ),
                            h("div", { className: "space-y-2" },
                                h("div", { className: "text-sm font-bold text-gray-700" }, "概率"),
                            h("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3" },
                                ['SSR', 'SR', 'R', 'N'].map((rarity) => h("label", { key: rarity, className: "space-y-1 text-sm" },
                                    h("div", { className: "font-bold text-gray-700" }, rarity),
                                    h("div", { className: "flex items-center gap-2" },
                                        h("input", {
                                            type: "number",
                                            step: "0.01",
                                            min: "0",
                                            className: "border w-full p-2 rounded",
                                            value: gachaDraft[rarity],
                                            onChange: (e) => setGachaDraft(prev => ({ ...prev, [rarity]: e.target.value }))
                                        }),
                                        h("span", { className: "text-gray-400 text-xs" }, "%")
                                    )
                                ))
                            )),
                            h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                                h("div", { className: `text-sm font-medium ${isGachaDraftValid ? 'text-emerald-600' : 'text-rose-600'}` },
                                    hasInvalidDraftCostValue ? "价格必须为不小于 0 的数字" : (hasInvalidDraftRateValue ? "存在无效概率值" : `当前概率总和: ${formatRate(draftTotal)}%`)
                                ),
                                h("div", { className: "flex flex-wrap gap-2" },
                                    h("button", {
                                        onClick: () => setGachaDraft(createGachaDraft(resolvedDefaultGachaConfig, resolvedDefaultGachaConfig)),
                                        className: "px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm"
                                    }, "恢复默认值"),
                                    h("button", {
                                        onClick: handleSaveGachaConfig,
                                        disabled: isSavingGachaConfig || !isGachaDraftValid,
                                        className: "px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                    }, isSavingGachaConfig ? "保存中..." : "保存设置")
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
                                h("input", { className: "border w-full p-2 rounded", value: newItemData.name, onChange: e => setNewItemData({ ...newItemData, name: e.target.value }) })
                            ),
                            h("div", { className: "grid grid-cols-2 gap-3" },
                                h("div", null,
                                    h("label", { className: "block font-bold mb-1" }, "稀有度"),
                                    h("select", { className: "border w-full p-2 rounded", value: newItemData.rarity, onChange: e => setNewItemData({ ...newItemData, rarity: e.target.value }) },
                                        ['N', 'R', 'SR', 'SSR'].map(r => h("option", { key: r, value: r }, r))
                                    )
                                ),
                                h("div", null,
                                    h("label", { className: "block font-bold mb-1" }, "基础价格"),
                                    h("input", { type: "number", className: "border w-full p-2 rounded", value: newItemData.price, onChange: e => setNewItemData({ ...newItemData, price: e.target.value }) })
                                )
                            ),
                            h("div", { className: "grid grid-cols-2 gap-3" },
                                h("div", null,
                                    h("label", { className: "block font-bold mb-1" }, "库存"),
                                    h("input", { type: "number", className: "border w-full p-2 rounded", value: newItemData.stock, onChange: e => setNewItemData({ ...newItemData, stock: e.target.value }) })
                                ),
                                h("div", null,
                                    h("label", { className: "block font-bold mb-1" }, "单日全班使用上限 (0为不限)"),
                                    h("input", { type: "number", className: "border w-full p-2 rounded", value: newItemData.dailyLimit, onChange: e => setNewItemData({ ...newItemData, dailyLimit: e.target.value }) })
                                )
                            ),
                            h("div", null,
                                h("label", { className: "block font-bold mb-1" }, "阶梯价格 (逗号分隔，如: 10,20,30)"),
                                h("input", { className: "border w-full p-2 rounded", value: newItemData.ladderPrices, onChange: e => setNewItemData({ ...newItemData, ladderPrices: e.target.value }), placeholder: "留空则使用基础价格" })
                            ),
                            h("div", null,
                                h("label", { className: "block font-bold mb-1" }, "描述"),
                                h("input", { className: "border w-full p-2 rounded", value: newItemData.desc, onChange: e => setNewItemData({ ...newItemData, desc: e.target.value }) })
                            )
                        )
                    )
                )
            );
        };
    };
})();
