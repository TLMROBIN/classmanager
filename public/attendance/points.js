(function() {
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
        awardPerfectAttendance
    };
})();
