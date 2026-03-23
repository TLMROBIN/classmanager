(function() {
    const profileUtils = window.ProfileUtils || {};
    const {
        hasLegacyStudentProfileFields,
        normalizeStudentProfiles,
        resolveStudentProfilesForData
    } = profileUtils;

    if (!hasLegacyStudentProfileFields || !normalizeStudentProfiles || !resolveStudentProfilesForData) {
        throw new Error('Profile persistence dependencies are missing');
    }

    const hasStudentProfilesInData = (data) => {
        const safe = data || {};
        return Object.prototype.hasOwnProperty.call(safe, 'studentProfiles') || (Array.isArray(safe.students) && safe.students.some(hasLegacyStudentProfileFields));
    };

    const buildNormalizedStudentProfiles = (studentProfiles, students) => normalizeStudentProfiles(studentProfiles, students);

    const restoreStudentProfilesFromData = (data, currentStudentProfiles, currentStudents) => {
        return resolveStudentProfilesForData(data, currentStudentProfiles, currentStudents);
    };

    const mergeStudentProfilesForData = (remoteData, localData, mergedStudents) => {
        const remoteProfiles = normalizeStudentProfiles(remoteData?.studentProfiles, remoteData?.students || mergedStudents);
        const localProfiles = normalizeStudentProfiles(localData?.studentProfiles, localData?.students || mergedStudents);
        return normalizeStudentProfiles({
            version: Math.max(Number(remoteProfiles?.version) || 1, Number(localProfiles?.version) || 1),
            entries: {
                ...((remoteProfiles || {}).entries || {}),
                ...((localProfiles || {}).entries || {})
            }
        }, mergedStudents);
    };

    window.ProfilePersistence = {
        hasStudentProfilesInData,
        buildNormalizedStudentProfiles,
        restoreStudentProfilesFromData,
        mergeStudentProfilesForData
    };
})();
