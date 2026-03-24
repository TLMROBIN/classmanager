(function() {
    const ensureRecordSlot = (records, item, nowTs, status, checkTime) => {
        if (!records[item.date]) records[item.date] = {};
        if (!records[item.date][item.name]) records[item.date][item.name] = {};
        const ruleId = String(item.id || '').split('-').pop();
        records[item.date][item.name][ruleId] = {
            status,
            checkTime,
            timestamp: nowTs
        };
    };

    const buildLateReasonCandidates = (item) => [
        `考勤迟到: ${item.date} ${item.session}`,
        `考勤迟到: ${item.session}`
    ];

    const applyLatePenalty = ({ student, sessionName, latePenalty, updatePoints, isFrozen }) => {
        if (!student || isFrozen || typeof updatePoints !== 'function') return false;
        updatePoints(new Set([student.id]), latePenalty, `考勤迟到: ${sessionName}`, "penalty", "班级", "出勤");
        return true;
    };

    const correctSelectedIssues = ({ selectedIds, abnormalRecords, students, records, nowTs, handleUndoByReasons }) => {
        const nextRecords = { ...(records || {}) };
        (Array.isArray(selectedIds) ? selectedIds : []).forEach(id => {
            const item = (Array.isArray(abnormalRecords) ? abnormalRecords : []).find(entry => entry.id === id);
            if (!item) return;
            const student = (Array.isArray(students) ? students : []).find(entry => entry.name === item.name);
            if (!student) return;
            if (item.type === 'late') {
                ensureRecordSlot(nextRecords, item, nowTs, 'ok', item.desc.replace('迟到 ', '') + ' (已撤销)');
                if (typeof handleUndoByReasons === 'function') {
                    handleUndoByReasons(student.id, buildLateReasonCandidates(item));
                }
                return;
            }
            if (item.type === 'absent') {
                ensureRecordSlot(nextRecords, item, nowTs, 'ok', '管理员补卡');
            }
        });
        return nextRecords;
    };

    const settleAbsentItems = ({ items, students, records, nowTs, absentPenalty, updatePoints }) => {
        const nextRecords = { ...(records || {}) };
        (Array.isArray(items) ? items : []).forEach(item => {
            const student = (Array.isArray(students) ? students : []).find(entry => entry.name === item.name);
            if (!student) return;
            ensureRecordSlot(nextRecords, item, nowTs, 'absent', '已扣分');
            if (typeof updatePoints === 'function') {
                updatePoints(new Set([student.id]), absentPenalty, `缺勤扣分: ${item.date} ${item.session}`, "penalty", "班级", "出勤");
            }
        });
        return nextRecords;
    };

    const awardPerfectAttendance = ({ perfectNames, students, perfectAttendanceBonus, updatePoints }) => {
        const targetIds = new Set();
        (Array.isArray(perfectNames) ? perfectNames : []).forEach(name => {
            const student = (Array.isArray(students) ? students : []).find(entry => entry.name === name);
            if (student) targetIds.add(student.id);
        });
        if (targetIds.size === 0 || typeof updatePoints !== 'function') return 0;
        updatePoints(targetIds, perfectAttendanceBonus, "周全勤奖", "bonus", "班级", "出勤");
        return targetIds.size;
    };

    window.AttendancePoints = {
        applyLatePenalty,
        correctSelectedIssues,
        settleAbsentItems,
        awardPerfectAttendance
    };
})();
