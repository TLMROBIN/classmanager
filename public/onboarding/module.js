(function () {
    'use strict';
    const SETUP = [
        { id: 'maintenance', tab: 'settings', target: 'maintenance', title: '先设置维护密码', text: '这是班主任修改名单、规则和数据的钥匙。首次使用请设置并确认维护密码；已有密码时解锁进入。它与登录密码分开。', action: '解锁后继续' },
        { id: 'basics', tab: 'settings', target: 'basics', title: '让系统属于你的班级', text: '填写班级或系统名称，按需要修改加分、扣分的称呼。双子星、宠物和附加榜单可以以后再开启；先保留适合本班的功能。' },
        { id: 'organization', tab: 'settings', target: 'organization', title: '先建小组，再填名单', text: '在小组管理中修改名称或新增小组，名称可自定义；同时配置宿舍。走读班可设置“走读”，学生宿舍也可留空。Excel 模板需要先有小组和宿舍。', note: '原纪律组、卫生组仍关联部分专员功能；只改名称可保留关联，删除后新建不会继承。' },
        { id: 'roster', tab: 'settings', target: 'roster', title: '加入本班学生', text: '先下载导入模板，按“导入说明”填写，再用“增量导入”；也可以逐个新增学生。小组、宿舍名称须与上一步一致。', note: '模板表头保持不变。已有名单时优先增量导入；覆盖导入会替换名单，请先核对。' },
        { id: 'save', tab: 'settings', target: 'save-config', title: '保存并确认同步', text: '点击页面中的“保存配置”，确认收到保存成功提示，再继续。名单导入会单独保存；手动修改也要留意顶部的同步状态。', action: '保存成功，继续' },
        { id: 'points', tab: 'operations', target: 'points-settings', title: '核对日常加扣分规则', text: '点击“打开设置”，核对学科、积分理由与分值、跑操、卫生和纪律登记规则，以及扣分恢复设置。工资金额和发放小组在“维护 → 组织架构”中设置。', note: '先核对规则即可。此处不要求给学生试加分或重置积分。', action: '已核对，下一步' },
        { id: 'attendance', tab: 'attendance', target: 'attendance-settings', title: '按本班作息设置考勤', text: '在教师工具中打开考勤设置，核对每个时段、迟到界限、周末安排及扣分规则。以后学生在“学生打卡”操作，老师在统计和修正中处理异常；教师工具还可管理通知、留言与语录。', note: '配置改动后请确认顶部同步成功，再开始正式打卡。', action: '结束首次设置导览' }
    ];
    const DAILY = [
        { id: 'dashboard', tab: 'dashboard', target: 'workspace', title: '每天从班级概况开始', text: '仪表盘汇总积分榜、班级状态与公示信息。值日安排、角色和日程完善后，也可以在这里查看。空班级显示的示例学生不代表名单已经导入。' },
        { id: 'quick', tab: 'operations', target: 'workspace', title: '选学生，再选择积分理由', text: '快速积分支持按小组、宿舍筛选，再选择学生和理由。提交前核对人数与分值；积分历史可以核查记录和撤销可撤销的操作。' },
        { id: 'registers', tab: 'operations', target: 'registers', title: '把高频登记放在一处', text: '日常登记包括作业、跑操、卫生和纪律。先确认日期、学科或原因，再选学生提交。各类登记的分值和专员奖励在积分设置中调整。' },
        { id: 'tasks', tab: 'tasks', target: 'workspace', title: '用任务安排班级行动', text: '在任务页发布班级任务，核对完成条件和奖励。学生完成后按页面流程领取；首次使用可以先阅读，不必立即发布任务。' },
        { id: 'treasure', tab: 'treasure', target: 'workspace', title: '把积分变成可兑现的激励', text: '藏宝阁管理商品、价格、库存和使用规则，学生兑换后进入背包。上架前先核对兑换成本与实际可提供的奖励；兑换与使用都有记录。' }
    ];
    const MORE = [
        { id: 'roles', tab: 'settings', target: 'roles', title: '按需要分配班级职责', text: '导入学生后再配置专员、自定义角色、卫生督查和值日安排。不同角色的候选人范围与奖励方式不同，请阅读各项说明后选择。' },
        { id: 'exams', tab: 'settings', target: 'exams', title: '需要成绩管理时再建考试档案', text: '打开考试档案后可下载模板、导入和查看成绩。先核对学生姓名与本班名单；双子星编队和结算可使用相关考试数据。' },
        { id: 'battle', tab: 'battle', target: 'workspace', feature: 'battle', title: '双子星：再进一步的班级激励', text: '按页面流程配置赛制、编队与结算考试，再核对结果。结算写入主积分需要维护权限，初次认识功能时无需执行结算。' },
        { id: 'profile', tab: 'profile', target: 'workspace', title: '完善学生头像和个人档案', text: '在头像页查看、维护学生形象和相关档案。先确认名单已导入，再逐步完善；这些资料可以稍后补充。' },
        { id: 'pet', tab: 'pet', target: 'workspace', feature: 'pet', title: '宠物：让日常积累可见', text: '启用后，学生的日常积分和考勤参与宠物成长。宠物有独立的成长与内置商城规则，可以在核心流程稳定后再引入。' },
        { id: 'tools', tab: 'settings', target: 'tools', title: '最后认识维护工具', text: '工具区提供假期封存、测试模式、日程、倒计时、学生周报与简报；下方还可查看异常行为预警。测试模式使用隔离副本，退出后不保留练习结果。服务器备份由运维配置，名单导出不能代替完整备份。' }
    ];
    const TOURS = { setup: SETUP, daily: DAILY, more: MORE };
    const LABELS = { setup: '首次设置', daily: '日常使用', more: '进阶功能' };
    const STORAGE_PREFIX = 'classmanager:onboarding:';
    const storageKey = user => STORAGE_PREFIX + String(user?.id ?? user?.username ?? 'local');
    const readProgress = (storage, key) => {
        try {
            const value = JSON.parse(storage.getItem(key));
            if (!value || value.version !== 1 || !TOURS[value.tour]) return null;
            return { version: 1, tour: value.tour, index: Math.max(0, Math.min(TOURS[value.tour].length - 1, Math.floor(Number(value.index)) || 0)), status: ['paused', 'complete', 'active'].includes(value.status) ? value.status : 'paused' };
        } catch (_) { return null; }
    };
    const writeProgress = (storage, key, value) => {
        try { storage.setItem(key, JSON.stringify({ ...value, version: 1 })); return true; }
        catch (_) { return false; }
    };
    const shouldOffer = ({ ready, testMode, user, students, history, progress }) => Boolean(
        ready && !testMode && user?.role === 'user' && !progress && Array.isArray(students) && students.length === 0 && Array.isArray(history) && history.length === 0
    );
    const inspectSetup = ({ students = [], systemConfig = {}, syncStatus }) => {
        const groups = systemConfig.organization?.groups || [];
        const dorms = systemConfig.organization?.dorms || [];
        const validNames = list => list.length > 0 && list.every(x => String(x.name || '').trim()) && new Set(list.map(x => String(x.name).trim())).size === list.length;
        const groupIds = new Set(groups.map(x => String(x.id)));
        const dormIds = new Set(dorms.map(x => String(x.id)));
        const roster = students.length > 0 && validNames(students) && students.every(x => (!x.group || groupIds.has(String(x.group))) && (!x.dorm || dormIds.has(String(x.dorm))));
        return [
            { label: '班级名称', ok: Boolean(String(systemConfig.className || '').trim()) },
            { label: '小组与宿舍名称', ok: validNames(groups) && validNames(dorms) },
            { label: '真实学生名单', ok: roster },
            { label: '当前同步状态', ok: syncStatus === 'success' || syncStatus === 'saved' }
        ];
    };
    window.ClassManagerOnboarding = { TOURS, storageKey, readProgress, writeProgress, shouldOffer, inspectSetup };

    window.createOnboarding = function ({ h, useState, useEffect, useRef }) {
        const getStorage = () => { try { return window.localStorage; } catch (_) { return null; } };
        function useOnboarding({ ready, testMode, user, students, history, setActiveTab, systemConfig }) {
            const key = storageKey(user);
            const [state, setState] = useState(null);
            const offered = useRef(false);
            const [savedConfigCount, setSavedConfigCount] = useState(0);
            const [locationKey, setLocationKey] = useState(0);
            const [storageWarning, setStorageWarning] = useState(false);
            const remember = value => {
                if (!writeProgress(getStorage(), key, value)) setStorageWarning(true);
            };
            useEffect(() => {
                if (!ready || testMode || offered.current) return;
                offered.current = true;
                const progress = readProgress(getStorage(), key);
                if (shouldOffer({ ready, testMode, user, students, history, progress })) setState({ screen: 'welcome', tour: 'setup', index: 0 });
            }, [ready, testMode, key, students.length, history.length]);
            const start = (tour = 'setup', index = 0) => {
                setSavedConfigCount(0);
                setState({ screen: 'step', tour, index });
            };
            const open = () => setState({ screen: 'welcome', tour: 'setup', index: 0 });
            const close = () => {
                if (state) remember({ tour: state.tour, index: state.index, status: state.screen === 'summary' ? 'complete' : 'paused' });
                setState(null);
            };
            const move = delta => {
                const index = state.index + delta;
                if (index >= TOURS[state.tour].length) {
                    remember({ tour: state.tour, index: state.index, status: 'complete' });
                    setState({ ...state, screen: 'summary' });
                } else {
                    setState({ ...state, index: Math.max(0, index) });
                }
            };
            const step = state?.screen === 'step' ? TOURS[state.tour][state.index] : null;
            const disabledFeature = step?.feature && (step.feature === 'pet' ? systemConfig.enabledFeatures?.pet !== true : systemConfig.enabledFeatures?.battle === false);
            const tab = disabledFeature ? 'settings' : step?.tab;
            useEffect(() => {
                if (!step) return;
                setActiveTab(tab);
                if (step.id === 'save') setSavedConfigCount(0);
                remember({ tour: state.tour, index: state.index, status: 'active' });
            }, [state?.screen, state?.tour, state?.index, tab]);
            return { state, step, tab, disabledFeature, savedConfigCount, onConfigSaved: () => setSavedConfigCount(n => n + 1), storageWarning, locationKey, locate: () => { setActiveTab(tab); setLocationKey(n => n + 1); }, progress: readProgress(getStorage(), key), start, open, close, move };
        }

        function Guide({ guide, students, systemConfig, syncStatus, testMode, activeTab }) {
            const { state, step, disabledFeature } = guide;
            const [collapsed, setCollapsed] = useState(false);
            const [geometry, setGeometry] = useState(null);
            const panel = useRef(null);
            const previousFocus = useRef(null);
            const liveGuide = useRef(guide);
            liveGuide.current = guide;
            const targetName = disabledFeature ? 'basics' : step?.target;
            useEffect(() => {
                if (!state) return;
                previousFocus.current = document.activeElement;
                const onKey = event => {
                    // Let password and other application dialogs handle Escape first.
                    if (event.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) { event.preventDefault(); liveGuide.current.close(); }
                };
                document.addEventListener('keydown', onKey);
                return () => {
                    document.removeEventListener('keydown', onKey);
                    if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
                };
            }, [Boolean(state)]);
            useEffect(() => {
                setCollapsed(false);
                panel.current?.focus({ preventScroll: true });
            }, [state?.screen, state?.tour, state?.index]);
            useEffect(() => {
                if (!step) { setGeometry(null); return; }
                let frame = 0;
                let lastTarget = null;
                const update = () => {
                    frame = 0;
                    let element = activeTab === guide.tab ? document.querySelector(`[data-onboarding="${targetName}"]`) : null;
                    if (!element && activeTab === guide.tab && guide.tab === 'settings') element = document.querySelector('[data-onboarding="maintenance"]');
                    if (!element && activeTab === guide.tab && targetName === 'maintenance') element = document.querySelector('[data-onboarding="settings"]');
                    if (element && element !== lastTarget) {
                        lastTarget = element;
                        element.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
                    }
                    const r = element?.getBoundingClientRect();
                    const w = window.innerWidth, height = window.innerHeight;
                    const ph = panel.current?.getBoundingClientRect().height || 300;
                    const width = Math.min(360, w - 24);
                    let left = Math.max(12, w - width - 20), top = 84;
                    if (r && w >= 760) {
                        if (r.right + width + 28 <= w) left = r.right + 16;
                        else if (r.left >= width + 28) left = r.left - width - 16;
                        else if (r.top - ph - 16 >= 76) top = r.top - ph - 16;
                        else top = r.bottom + ph + 24 <= height ? r.bottom + 16 : Math.max(76, height - ph - 16);
                    }
                    const rect = r && r.width && r.height ? { x: Math.max(6, r.left - 6), y: Math.max(68, r.top - 6), right: Math.min(w - 6, r.right + 6), bottom: Math.min(height - 6, r.bottom + 6) } : null;
                    const next = { rect, left, top: Math.min(top, Math.max(12, height - ph - 12)), width, w, height, unlocked: Boolean(document.querySelector('[data-onboarding="settings"]')) };
                    setGeometry(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
                };
                const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
                const observer = new MutationObserver(schedule);
                observer.observe(document.getElementById('root'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
                const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
                resize?.observe(document.getElementById('root'));
                if (panel.current) resize?.observe(panel.current);
                const onResize = () => { lastTarget = null; schedule(); };
                window.addEventListener('resize', onResize);
                window.addEventListener('scroll', schedule, true);
                schedule();
                return () => { observer.disconnect(); resize?.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', onResize); window.removeEventListener('scroll', schedule, true); };
            }, [step?.id, state?.tour, targetName, guide.tab, activeTab, collapsed, guide.locationKey]);
            if (!state) return null;
            const button = (label, onClick, primary = false, disabled = false) => h('button', { type: 'button', onClick, disabled, className: primary ? 'cm-guide-primary' : 'cm-guide-secondary' }, label);
            const commonHeader = h('div', { className: 'cm-guide-header' },
                h('span', null, step ? `${LABELS[state.tour]} · ${state.index + 1} / ${TOURS[state.tour].length}` : '班主任使用指引'),
                h('div', null,
                    step && h('button', { type: 'button', onClick: () => setCollapsed(!collapsed), 'aria-expanded': !collapsed, 'aria-label': collapsed ? '展开引导' : '收起引导说明' }, collapsed ? '展开' : '收起'),
                    h('button', { type: 'button', onClick: guide.close, 'aria-label': '关闭新手引导' }, '关闭 ×')));
            const welcome = state.screen === 'welcome';
            const summary = state.screen === 'summary';
            const checklist = inspectSetup({ students, systemConfig, syncStatus });
            const isLocked = guide.tab === 'settings' && !geometry?.unlocked;
            let blocked = '';
            if (step?.id === 'maintenance' && isLocked) blocked = '请先完成维护验证，也可选择稍后设置。';
            if (step?.id === 'roster' && !checklist[2].ok) blocked = '请加入真实学生并核对姓名与分组；也可稍后准备名单。';
            if (step?.id === 'save' && !guide.savedConfigCount) blocked = '请点击页面中的“保存配置”，成功后即可继续。';
            const r = geometry?.rect;
            const showSpotlight = step && r && r.right > r.x && r.bottom > r.y && !collapsed && activeTab === guide.tab;
            const panelStyle = step && geometry && geometry.w >= 760 ? { left: geometry.left, top: geometry.top, width: geometry.width } : undefined;
            return h('div', { className: `cm-guide ${step ? 'cm-guide-walkthrough' : 'cm-guide-centered'}${collapsed ? ' cm-guide-collapsed' : ''}` },
                showSpotlight && h('svg', { className: 'cm-guide-spotlight', width: '100%', height: '100%', 'aria-hidden': true },
                    h('defs', null, h('marker', { id: 'cm-guide-arrow', markerWidth: 8, markerHeight: 8, refX: 6, refY: 4, orient: 'auto' }, h('path', { d: 'M1 1 L6 4 L1 7', fill: 'none', stroke: '#2563eb', strokeWidth: 1.5 }))),
                    h('path', { d: `M0 0H${geometry.w}V${geometry.height}H0Z M${r.x} ${r.y}V${r.bottom}H${r.right}V${r.y}Z`, fillRule: 'evenodd', fill: 'rgba(15,23,42,.16)' }),
                    h('rect', { x: r.x, y: r.y, width: r.right - r.x, height: r.bottom - r.y, rx: 8, className: 'cm-guide-frame' }),
                    geometry.w >= 760 && h('path', { d: `M${geometry.left + 24} ${geometry.top} Q${geometry.left + 24} ${Math.max(68, geometry.top - 24)} ${Math.min(r.right - 12, Math.max(r.x + 12, geometry.left + 24))} ${r.y + 8}`, className: 'cm-guide-connector', markerEnd: 'url(#cm-guide-arrow)' })),
                h('section', { ref: panel, tabIndex: -1, role: 'dialog', 'aria-modal': 'false', 'aria-label': collapsed ? '新手引导，已收起' : undefined, 'aria-labelledby': collapsed ? undefined : 'cm-guide-title', className: 'cm-guide-panel', style: panelStyle },
                    commonHeader,
                    h('div', { className: 'cm-guide-content' },
                        h('h2', { id: 'cm-guide-title' }, welcome ? '把班级准备好，再开始日常管理' : summary ? '这段导览已结束' : disabledFeature ? `${step.title.split('：')[0]}尚未开启` : step.title),
                        welcome ? h(React.Fragment, null,
                            h('p', null, '跟着虚线框逐项操作真实页面。先完成基本设置，再按需要认识其他功能；随时可以关闭。'),
                            h('ol', { className: 'cm-guide-route' }, ['维护密码与班级信息', '小组、宿舍与学生名单', '保存、积分规则与考勤作息'].map(text => h('li', { key: text }, text))),
                            guide.progress?.status !== 'complete' && guide.progress && button('接着上次的位置继续', () => guide.start(guide.progress.tour, guide.progress.index), true),
                            button('开始首次设置', () => guide.start('setup'), !guide.progress),
                            h('div', { className: 'cm-guide-links' }, button('认识日常功能', () => guide.start('daily')), button('认识进阶功能', () => guide.start('more')))
                        ) : summary ? h(React.Fragment, null,
                            h('p', null, '下面按当前数据核对准备情况。看完导览不等于完成配置；积分和考勤规则仍需由你确认。'),
                            h('ul', { className: 'cm-guide-checklist' }, checklist.map(item => h('li', { key: item.label }, h('span', null, item.label), h('strong', { className: item.ok ? 'cm-guide-ok' : '' }, item.ok ? '已具备' : '待核对')))),
                            button('回到首次设置核对', () => guide.start('setup')),
                            h('div', { className: 'cm-guide-links' }, button('认识日常功能', () => guide.start('daily')), button('认识进阶功能', () => guide.start('more'))),
                            button('关闭指引，开始使用', guide.close, true)
                        ) : h(React.Fragment, null,
                            h('p', null, disabledFeature ? `可在这里的功能开关中启用${step.feature === 'pet' ? '班级宠物' : '双子星'}。也可以保持关闭，直接继续。` : step.text),
                            step.note && h('p', { className: 'cm-guide-note' }, step.note),
                            isLocked && step.id !== 'maintenance' && h('p', { role: 'status', className: 'cm-guide-note' }, '维护权限尚未解锁或已到期，请先在当前页面验证密码。'),
                            (activeTab !== guide.tab || !geometry?.rect) && button('回到当前引导位置', guide.locate),
                            !geometry?.rect && h('p', { role: 'status' }, '正在寻找操作区域。若页面加载失败，请先重试加载；也可跳过本步。'),
                            blocked && h('p', { className: 'cm-guide-status', role: 'status' }, blocked),
                            h('div', { className: 'cm-guide-actions' }, button('上一步', () => guide.move(-1), false, state.index === 0), button(step.action || '下一步', () => guide.move(1), true, Boolean(blocked))),
                            h('button', { type: 'button', className: 'cm-guide-skip', onClick: () => guide.move(1) }, '稍后设置，跳过此步')
                        ),
                        testMode && h('p', { className: 'cm-guide-note' }, '当前在测试模式：所有设置仅影响隔离副本，退出后不保留。'),
                        guide.storageWarning && h('p', { role: 'status' }, '浏览器未允许保存引导进度，刷新后可能需要重新开始。'),
                        h('p', { className: 'cm-guide-footer' }, '关闭后，可在「维护 → 系统配置 → 新手引导」重新打开。')
                    )
                )
            );
        }
        return { useOnboarding, Guide };
    };
})();
