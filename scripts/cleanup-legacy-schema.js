const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'database', 'classmanager.db');
const db = new Database(dbPath);

const selectConfigRows = db.prepare(`
    SELECT user_id, data_value
    FROM class_data
    WHERE data_key = 'config'
`);

const updateConfigRow = db.prepare(`
    UPDATE class_data
    SET data_value = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND data_key = 'config'
`);

const deleteByKey = db.prepare(`
    DELETE FROM class_data
    WHERE data_key = ?
`);

const deleteEffectiveTreasuresByUser = db.prepare(`
    DELETE FROM class_data
    WHERE user_id = ? AND data_key = 'effectiveTreasures'
`);

const countByKey = db.prepare(`
    SELECT COUNT(*) AS count
    FROM class_data
    WHERE data_key = ?
`);

const dataKeyRows = db.prepare(`
    SELECT user_id
    FROM class_data
    WHERE data_key = 'data'
    ORDER BY user_id
`).all();

const effectiveRows = db.prepare(`
    SELECT user_id
    FROM class_data
    WHERE data_key = 'effectiveTreasures'
    ORDER BY user_id
`).all();

const stats = {
    configStripped: 0,
    effectiveRemoved: 0,
    battleSnapshotsRemoved: 0
};

const transaction = db.transaction(() => {
    selectConfigRows.all().forEach(row => {
        let parsed;
        try {
            parsed = JSON.parse(row.data_value);
        } catch (_) {
            return;
        }
        if (!parsed || typeof parsed !== 'object' || !parsed.systemConfig || typeof parsed.systemConfig !== 'object') {
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(parsed.systemConfig, 'treasures')) {
            return;
        }
        const { treasures, ...restSystemConfig } = parsed.systemConfig;
        void treasures;
        updateConfigRow.run(JSON.stringify({
            ...parsed,
            systemConfig: restSystemConfig
        }), row.user_id);
        stats.configStripped += 1;
    });

    effectiveRows.forEach(row => {
        stats.effectiveRemoved += deleteEffectiveTreasuresByUser.run(row.user_id).changes;
    });

    stats.battleSnapshotsRemoved = deleteByKey.run('battleSnapshots').changes;
});

transaction();

const remainingEffective = countByKey.get('effectiveTreasures').count;
const remainingBattleSnapshots = countByKey.get('battleSnapshots').count;

console.log('Legacy schema cleanup finished.');
console.log(`Database: ${dbPath}`);
console.log(`Config rows stripped of systemConfig.treasures: ${stats.configStripped}`);
console.log(`effectiveTreasures rows removed: ${stats.effectiveRemoved}`);
console.log(`battleSnapshots rows removed: ${stats.battleSnapshotsRemoved}`);
console.log(`Remaining effectiveTreasures rows: ${remainingEffective}`);
console.log(`Remaining battleSnapshots rows: ${remainingBattleSnapshots}`);
if (dataKeyRows.length > 0) {
    console.log(`Legacy single-key data rows still present for users: ${dataKeyRows.map(row => row.user_id).join(', ')}`);
} else {
    console.log('Legacy single-key data rows present: none');
}

db.close();
