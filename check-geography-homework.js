const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'classmanager.db');
const db = new Database(dbPath);

console.log('查找地理作业记录...');

try {
    const rows = db.prepare('SELECT user_id, data_value FROM class_data WHERE data_key = ?').all('data');
    
    rows.forEach(row => {
        try {
            const data = JSON.parse(row.data_value);
            if (data && data.history && Array.isArray(data.history)) {
                const geoRecords = data.history.filter(item => {
                    if (!item || !item.reason) return false;
                    const reason = item.reason || '';
                    return reason.includes('地理作业');
                });
                
                if (geoRecords.length > 0) {
                    console.log(`\n用户 ${row.user_id} 的地理作业记录:`);
                    geoRecords.forEach(r => {
                        console.log(`  - ${r.reason} (学生: ${r.studentName || r.name || '未知'})`);
                    });
                }
            }
        } catch (err) {
            console.error(`处理用户 ${row.user_id} 数据时出错:`, err.message);
        }
    });
    
} catch (err) {
    console.error('操作失败:', err);
} finally {
    db.close();
}