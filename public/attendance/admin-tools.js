(function() {
    window.createAttendanceAdminTools = function createAttendanceAdminTools(deps) {
        const { getTodayStr } = deps || {};

        if (!getTodayStr) {
            throw new Error('Attendance admin tools dependencies are missing');
        }

        const exportAttendanceExcel = ({ records, scheduleConfig }) => {
            const xlsx = window.XLSX;
            if (!xlsx?.utils || typeof xlsx.writeFile !== 'function') {
                alert("导出组件未加载，请刷新后重试");
                return;
            }

            const rows = [];
            const sessions = Array.isArray(scheduleConfig) ? scheduleConfig : [];
            Object.keys(records || {}).sort().forEach(date => {
                const dayRecords = records[date] || {};
                Object.keys(dayRecords).sort().forEach(name => {
                    const studentSessions = dayRecords[name] || {};
                    const row = { "日期": date, "姓名": name };
                    sessions.forEach(session => {
                        const rec = studentSessions[session.id];
                        row[session.name] = rec ? `${rec.status === 'ok' ? '✅' : '❌'}${rec.status === 'late' ? '(迟)' : ''} ${rec.checkTime}` : '-';
                    });
                    rows.push(row);
                });
            });

            const ws = xlsx.utils.json_to_sheet(rows);
            const wb = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(wb, ws, "考勤记录");
            xlsx.writeFile(wb, `考勤记录_${getTodayStr()}.xlsx`);
        };

        return {
            exportAttendanceExcel
        };
    };
})();
