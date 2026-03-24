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
            updatePoints,
            adminPassword,
            treasures,
            setTreasures,
            storage,
            setStorage,
            logs,
            setLogs,
            redemptionHistory = {},
            setRedemptionHistory,
            dailyUsageCounts = {},
            setDailyUsageCounts,
            onReturnItem,
            onRedeemTreasure,
            onUseItem
        }) {
            const treasurePoints = window.TreasurePoints || {};
            const {
                getTreasurePrice,
                getNextTreasurePriceHint
            } = treasurePoints;
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

            const checkDailyUsageLimit = (itemId) => {
                const item = treasures.find(t => t.id == itemId);
                if (!item || !item.dailyLimit || item.dailyLimit <= 0) return true;
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

                const currentPrice = getTreasurePrice({
                    studentId: student.id,
                    item,
                    redemptionHistory
                });

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
                if (!newItemData.name) return alert("名称不能为空");

                const ladderPrices = newItemData.ladderPrices.toString().split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
                const newItem = {
                    id: editMode ? newItemData.id : Date.now(),
                    name: newItemData.name,
                    rarity: newItemData.rarity,
                    price: parseFloat(newItemData.price),
                    stock: parseInt(newItemData.stock),
                    desc: newItemData.desc,
                    ladderPrices,
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
