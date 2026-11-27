const { STD_EVENTS } = require('./event-bus');

const OFFICIAL_PLUGINS = Object.freeze([
    {
        pluginId: 'official.attendance',
        name: '双模考勤',
        version: '2.0.0',
        category: 'attendance',
        kernelCompat: 'cm-plugin/v1',
        requires: [],
        permissions: ['roster:read', 'ledger:write', 'storage:readwrite', 'events:emit'],
        emits: [STD_EVENTS.ATTENDANCE_RECORDED],
        subscribes: [],
        defaultEnabled: () => true
    },
    {
        pluginId: 'official.message-board',
        name: '班级留言板与悄悄话',
        version: '2.0.0',
        category: 'communication',
        kernelCompat: 'cm-plugin/v1',
        requires: [],
        permissions: ['roster:read', 'storage:readwrite'],
        emits: [],
        subscribes: [],
        defaultEnabled: () => true
    },
    {
        pluginId: 'official.officer-registers',
        name: '专员日常登记',
        version: '2.0.0',
        category: 'operations',
        kernelCompat: 'cm-plugin/v1',
        requires: [],
        permissions: ['roster:read', 'ledger:write', 'storage:readwrite'],
        emits: [],
        subscribes: [],
        defaultEnabled: () => true
    },
    {
        pluginId: 'official.daily-wage-decay',
        name: '每日班委工资与扣分衰减',
        version: '2.0.0',
        category: 'points',
        kernelCompat: 'cm-plugin/v1',
        requires: [],
        permissions: ['roster:read', 'ledger:read', 'ledger:write'],
        emits: [],
        subscribes: [STD_EVENTS.POINTS_CHANGED],
        defaultEnabled: () => true
    },
    {
        pluginId: 'official.grouping',
        name: '智能人员分组',
        version: '2.0.0',
        category: 'organization',
        kernelCompat: 'cm-plugin/v1',
        requires: [],
        permissions: ['roster:read', 'roster:write-group', 'events:emit'],
        emits: [STD_EVENTS.GROUP_UPDATED],
        subscribes: [],
        defaultEnabled: () => true
    },
    {
        pluginId: 'official.treasure',
        name: '藏宝阁积分商城与祈愿',
        version: '2.0.0',
        category: 'treasure',
        kernelCompat: 'cm-plugin/v1',
        requires: [],
        permissions: ['roster:read', 'ledger:write', 'storage:readwrite'],
        emits: [],
        subscribes: [],
        defaultEnabled: () => true
    },
    {
        pluginId: 'official.tasks',
        name: '班级悬赏任务',
        version: '2.0.0',
        category: 'tasks',
        kernelCompat: 'cm-plugin/v1',
        requires: [],
        permissions: ['roster:read', 'ledger:write', 'storage:readwrite', 'events:emit'],
        emits: [STD_EVENTS.TASK_COMPLETED],
        subscribes: [],
        defaultEnabled: () => true
    },
    {
        pluginId: 'official.battle',
        name: '双子星对抗赛制',
        version: '2.0.0',
        category: 'battle',
        kernelCompat: 'cm-plugin/v1',
        requires: [],
        permissions: ['roster:read', 'ledger:write', 'storage:readwrite', 'exam:read'],
        emits: [],
        subscribes: [],
        defaultEnabled: (config) => config?.systemConfig?.enabledFeatures?.battle !== false
    },
    {
        pluginId: 'official.pet',
        name: '班级电子宠物',
        version: '2.0.0',
        category: 'pet',
        kernelCompat: 'cm-plugin/v1',
        requires: [],
        permissions: ['roster:read', 'ledger:read', 'storage:readwrite', 'events:subscribe'],
        emits: [],
        subscribes: [STD_EVENTS.POINTS_CHANGED, STD_EVENTS.ATTENDANCE_RECORDED],
        defaultEnabled: (config) => config?.systemConfig?.enabledFeatures?.pet === true
    },
    {
        pluginId: 'official.weekly-report',
        name: '班级周报生成器',
        version: '2.0.0',
        category: 'report',
        kernelCompat: 'cm-plugin/v1',
        requires: [],
        permissions: ['roster:read', 'ledger:read'],
        emits: [],
        subscribes: [],
        defaultEnabled: () => true
    }
]);

const V1_KEY_TO_PLUGIN_STORAGE = Object.freeze({
    attendanceRecords: Object.freeze({ pluginId: 'official.attendance', storageKey: 'records' }),
    messages: Object.freeze({ pluginId: 'official.message-board', storageKey: 'messages' }),
    teacherMessages: Object.freeze({ pluginId: 'official.message-board', storageKey: 'teacherMessages' }),
    treasures: Object.freeze({ pluginId: 'official.treasure', storageKey: 'treasures' }),
    storage: Object.freeze({ pluginId: 'official.treasure', storageKey: 'storage' }),
    logs: Object.freeze({ pluginId: 'official.treasure', storageKey: 'logs' }),
    redemptionHistory: Object.freeze({ pluginId: 'official.treasure', storageKey: 'redemptionHistory' }),
    dailyRedemptionCounts: Object.freeze({ pluginId: 'official.treasure', storageKey: 'dailyRedemptionCounts' }),
    dailyUsageCounts: Object.freeze({ pluginId: 'official.treasure', storageKey: 'dailyUsageCounts' }),
    liquidatedTreasures: Object.freeze({ pluginId: 'official.treasure', storageKey: 'liquidatedTreasures' }),
    tasks: Object.freeze({ pluginId: 'official.tasks', storageKey: 'tasks' }),
    battle: Object.freeze({ pluginId: 'official.battle', storageKey: 'state' }),
    pets: Object.freeze({ pluginId: 'official.pet', storageKey: 'state' }),
    quotes: Object.freeze({ pluginId: 'core', storageKey: 'quotes' }),
    __meta: Object.freeze({ pluginId: 'core', storageKey: '__meta' })
});

const ensureOfficialPluginCatalog = (db) => {
    const upsertPackage = db.prepare(`
        INSERT INTO plugin_packages (
            plugin_id, version, source, visibility, featured,
            author_teacher_id, author_name, maintainer_name,
            maintenance_status, kernel_compat, signature,
            manifest_json, server_code, ui_code
        ) VALUES (?, ?, 'official_market', 'official', 1, NULL, 'ClassManager', 'ClassManager', 'active', ?, NULL, ?, '', '')
        ON CONFLICT(plugin_id, version) DO UPDATE SET
            source = excluded.source,
            visibility = excluded.visibility,
            maintenance_status = excluded.maintenance_status,
            kernel_compat = excluded.kernel_compat,
            manifest_json = excluded.manifest_json
    `);

    const transaction = db.transaction(() => {
        for (const plugin of OFFICIAL_PLUGINS) {
            const manifest = {
                apiVersion: 'cm-plugin/v1',
                pluginId: plugin.pluginId,
                name: plugin.name,
                version: plugin.version,
                category: plugin.category,
                kernelCompat: plugin.kernelCompat,
                requires: plugin.requires,
                permissions: plugin.permissions,
                emits: plugin.emits,
                subscribes: plugin.subscribes
            };
            upsertPackage.run(
                plugin.pluginId,
                plugin.version,
                plugin.kernelCompat,
                JSON.stringify(manifest)
            );
        }
    });

    transaction();
};

const ensureClassDefaultPlugins = (db, classId, config = {}) => {
    const upsertClassPlugin = db.prepare(`
        INSERT INTO class_plugins (class_id, plugin_id, version, enabled, disabled_reason, config_json)
        VALUES (?, ?, ?, ?, NULL, '{}')
        ON CONFLICT(class_id, plugin_id) DO NOTHING
    `);

    for (const plugin of OFFICIAL_PLUGINS) {
        const enabled = plugin.defaultEnabled(config) ? 1 : 0;
        upsertClassPlugin.run(classId, plugin.pluginId, plugin.version, enabled);
    }
};

const syncClassPluginStatesFromConfig = (db, classId, config = {}) => {
    ensureClassDefaultPlugins(db, classId, config);

    const updateEnabled = db.prepare(`
        UPDATE class_plugins
        SET enabled = ?
        WHERE class_id = ? AND plugin_id = ?
    `);

    for (const plugin of OFFICIAL_PLUGINS) {
        if (plugin.pluginId === 'official.battle' || plugin.pluginId === 'official.pet') {
            updateEnabled.run(plugin.defaultEnabled(config) ? 1 : 0, classId, plugin.pluginId);
        }
    }
};

module.exports = {
    OFFICIAL_PLUGINS,
    V1_KEY_TO_PLUGIN_STORAGE,
    ensureOfficialPluginCatalog,
    ensureClassDefaultPlugins,
    syncClassPluginStatesFromConfig
};
