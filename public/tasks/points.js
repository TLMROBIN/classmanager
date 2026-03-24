(function() {
    const buildTaskClaimState = ({ taskId, studentId, tasks, students, history, getNow }) => {
        if (!studentId) return { ok: false };
        const taskList = Array.isArray(tasks) ? tasks : [];
        const taskIndex = taskList.findIndex(task => task.id === taskId);
        if (taskIndex === -1) return { ok: false };
        const task = taskList[taskIndex];

        const now = typeof getNow === 'function' ? getNow() : new Date();
        const start = new Date(task.startTime || 0);
        const end = new Date(task.endTime || 0);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return { ok: false };
        if (now < start || now > end) return { ok: false };

        const claimed = task.claimedBy || [];
        if (claimed.length > 0) return { ok: false };

        const student = (Array.isArray(students) ? students : []).find(item => String(item.id) === String(studentId));
        if (!student) return { ok: false };

        const points = parseFloat(task.points) || 0;
        const ts = typeof getNow === 'function' ? getNow().getTime() : Date.now();
        const nextTasks = taskList.map((item, idx) => (
            idx === taskIndex ? { ...item, claimedBy: [student.id] } : item
        ));
        const nextStudents = (Array.isArray(students) ? students : []).map(item => (
            item.id === student.id
                ? {
                    ...item,
                    zizai: (item.zizai || 0) + points,
                    balance: (item.balance || 0) + points
                }
                : item
        ));
        const snapshot = {
            zizai: student.zizai,
            balance: student.balance,
            penalty: student.penalty
        };
        const nextHistory = [{
            id: ts + Math.random(),
            ts,
            studentId: student.id,
            studentName: student.name,
            val: points,
            reason: `完成任务: ${task.title}`,
            snapshot,
            type: 'bonus',
            scene: "班级",
            category: "学业"
        }, ...(Array.isArray(history) ? history : [])];

        return {
            ok: true,
            nextTasks,
            nextStudents,
            nextHistory
        };
    };

    window.TasksPoints = {
        buildTaskClaimState
    };
})();
