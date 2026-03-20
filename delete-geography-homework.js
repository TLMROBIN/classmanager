const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'classmanager.db');
const db = new Database(dbPath);

console.log('开始删除3月8日的地理作业记录...');

try {
    const rows = db.prepare('SELECT user_id, data_value FROM class_data WHERE data_key = ?').all('data');
    
    let totalDeleted = 0;
    
    rows.forEach(row => {
        try {
            const data = JSON.parse(row.data_value);
            if (data && data.history && Array.isArray(data.history)) {
                const originalLength = data.history.length;
                
                data.history = data.history.filter(item => {
                    if (!item || !item.reason) return true;
                    const reason = item.reason || '';
                    const isGeoHomework = reason.includes('地理作业') && reason.includes('2026-03-08');
                    return !isGeoHomework;
                });
                
                if (data.history.length < originalLength) {
                    const deleted = originalLength - data.history.length;
                    totalDeleted += deleted;
                    console.log(`用户 ${row.user_id}: 删除了 ${deleted} 条记录`);
                    
                    db.prepare('UPDATE class_data SET data_value = ? WHERE user_id = ? AND data_key = ?').run(
                        JSON.stringify(data),
                        row.user_id,
                        'data'
                    );
                }
            }
        } catch (err) {
            console.error(`处理用户 ${row.user_id} 数据时出错:`, err.message);
        }
    });
    
    console.log(`\n完成！共删除 ${totalDeleted} 条地理作业记录`);
    
} catch (err) {
    console.error('操作失败:', err);
} finally {
    db.close();
}