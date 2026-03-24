(function() {
    const buildStudentMap = (students) => {
        const map = new Map();
        (Array.isArray(students) ? students : []).forEach(student => {
            map.set(String(student.id), student);
        });
        return map;
    };

    const getFilteredStudents = ({ students, filterGroup, filterDorm, defaultFilter = 'all' }) => (
        (Array.isArray(students) ? students : []).filter(student => {
            if (filterGroup !== defaultFilter && student.group !== filterGroup) return false;
            if (filterDorm !== defaultFilter && student.dorm !== filterDorm) return false;
            return true;
        })
    );

    const getFilteredSelectedCount = (students, selectedIds) => (
        (Array.isArray(students) ? students : []).reduce((count, student) => (
            selectedIds.has(student.id) ? count + 1 : count
        ), 0)
    );

    const getReasonsByType = (reasons, type) => (
        (Array.isArray(reasons) ? reasons : []).filter(reason => reason.type === type)
    );

    const getHomeworkSubjects = (subjectsConfig) => (
        (Array.isArray(subjectsConfig) ? subjectsConfig : []).map(subject => subject.name)
    );

    const getHomeworkDates = ({ getNow, getDateString }) => {
        const now = getNow();
        const day = now.getDay();
        const daysToFriday = (5 - day + 7) % 7;
        const friday = new Date(now);
        friday.setDate(now.getDate() + daysToFriday);
        const sunday = new Date(friday);
        sunday.setDate(friday.getDate() - 5);
        const list = [];
        for (let i = 0; i < 6; i++) {
            const date = new Date(sunday);
            date.setDate(sunday.getDate() + i);
            list.push(getDateString(date));
        }
        return list;
    };

    const getRecentHistory = (history, limit = 50) => (
        (Array.isArray(history) ? history : []).slice(0, limit)
    );

    const sanitizeIdSetByStudents = (idSet, students) => {
        const validIdKeys = new Set((Array.isArray(students) ? students : []).map(student => String(student.id)));
        return new Set(Array.from(idSet || []).filter(id => validIdKeys.has(String(id))));
    };

    window.OperationSelectors = {
        buildStudentMap,
        getFilteredStudents,
        getFilteredSelectedCount,
        getReasonsByType,
        getHomeworkSubjects,
        getHomeworkDates,
        getRecentHistory,
        sanitizeIdSetByStudents
    };
})();
