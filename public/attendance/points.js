(function() {
    const awardPerfectAttendance = ({ perfectNames, students, perfectAttendanceBonus, updatePoints }) => {
        const targetIds = new Set();
        (Array.isArray(perfectNames) ? perfectNames : []).forEach(name => {
            const student = (Array.isArray(students) ? students : []).find(entry => entry.name === name);
            if (student) targetIds.add(student.id);
        });
        if (targetIds.size === 0 || typeof updatePoints !== 'function') return 0;
        const result = updatePoints(targetIds, perfectAttendanceBonus, "周全勤奖", "bonus", "班级", "出勤");
        const verifyCount = (count) => {
            const savedCount = Number(count);
            if (!Number.isFinite(savedCount) || savedCount !== targetIds.size) {
                throw new Error('全勤奖保存条数不完整，请核对后重试');
            }
            return savedCount;
        };
        if (result && typeof result.then === 'function') {
            return Promise.resolve(result).then(verifyCount);
        }
        return verifyCount(result);
    };

    window.AttendancePoints = {
        awardPerfectAttendance
    };
})();
