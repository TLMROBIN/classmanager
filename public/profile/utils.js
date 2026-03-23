(function() {
    const hasLegacyStudentProfileFields = (student) => !!(
        student && (
            student.avatar_happy ||
            student.avatar_sad ||
            student.title_left ||
            student.title_right
        )
    );

    const buildLegacyStudentProfileEntries = (students) => {
        const entries = {};
        (Array.isArray(students) ? students : []).forEach(student => {
            if (!student || student.id == null) return;
            const entry = {
                avatarHappy: typeof student.avatar_happy === 'string' ? student.avatar_happy : "",
                avatarSad: typeof student.avatar_sad === 'string' ? student.avatar_sad : "",
                titleLeft: typeof student.title_left === 'string' ? student.title_left : "",
                titleRight: typeof student.title_right === 'string' ? student.title_right : ""
            };
            if (entry.avatarHappy || entry.avatarSad || entry.titleLeft || entry.titleRight) {
                entries[String(student.id)] = entry;
            }
        });
        return entries;
    };

    const normalizeStudentProfiles = (studentProfiles, fallbackStudents = []) => {
        const sourceEntries = studentProfiles && typeof studentProfiles.entries === 'object' && studentProfiles.entries
            ? studentProfiles.entries
            : {};
        const normalizedEntries = {};
        Object.entries(sourceEntries).forEach(([studentId, entry]) => {
            const normalizedEntry = {
                avatarHappy: typeof entry?.avatarHappy === 'string' ? entry.avatarHappy : (typeof entry?.avatar_happy === 'string' ? entry.avatar_happy : ""),
                avatarSad: typeof entry?.avatarSad === 'string' ? entry.avatarSad : (typeof entry?.avatar_sad === 'string' ? entry.avatar_sad : ""),
                titleLeft: typeof entry?.titleLeft === 'string' ? entry.titleLeft : (typeof entry?.title_left === 'string' ? entry.title_left : ""),
                titleRight: typeof entry?.titleRight === 'string' ? entry.titleRight : (typeof entry?.title_right === 'string' ? entry.title_right : "")
            };
            if (normalizedEntry.avatarHappy || normalizedEntry.avatarSad || normalizedEntry.titleLeft || normalizedEntry.titleRight) {
                normalizedEntries[String(studentId)] = normalizedEntry;
            }
        });
        return {
            version: Number(studentProfiles?.version) || 1,
            entries: {
                ...buildLegacyStudentProfileEntries(fallbackStudents),
                ...normalizedEntries
            }
        };
    };

    const getStudentProfile = (studentProfiles, studentOrId, fallbackStudent = null) => {
        const student = fallbackStudent || (studentOrId && typeof studentOrId === 'object' ? studentOrId : null);
        const studentId = student ? student.id : studentOrId;
        const entries = studentProfiles && typeof studentProfiles.entries === 'object' ? studentProfiles.entries : {};
        const hasManagedProfiles = Object.keys(entries).length > 0;
        const raw = entries[String(studentId)] || entries[studentId] || {};
        return {
            avatarHappy: typeof raw.avatarHappy === 'string' ? raw.avatarHappy : (typeof raw.avatar_happy === 'string' ? raw.avatar_happy : (hasManagedProfiles ? "" : (student?.avatar_happy || ""))),
            avatarSad: typeof raw.avatarSad === 'string' ? raw.avatarSad : (typeof raw.avatar_sad === 'string' ? raw.avatar_sad : (hasManagedProfiles ? "" : (student?.avatar_sad || ""))),
            titleLeft: typeof raw.titleLeft === 'string' ? raw.titleLeft : (typeof raw.title_left === 'string' ? raw.title_left : (hasManagedProfiles ? "" : (student?.title_left || ""))),
            titleRight: typeof raw.titleRight === 'string' ? raw.titleRight : (typeof raw.title_right === 'string' ? raw.title_right : (hasManagedProfiles ? "" : (student?.title_right || "")))
        };
    };

    const remapStudentProfilesToStudentsByName = (currentStudents, nextStudents, studentProfiles) => {
        const normalizedProfiles = normalizeStudentProfiles(studentProfiles, currentStudents);
        const profileByName = new Map();
        (Array.isArray(currentStudents) ? currentStudents : []).forEach(student => {
            const key = String(student?.name || "").trim();
            if (!key) return;
            const profile = getStudentProfile(normalizedProfiles, student.id, student);
            if (profile.avatarHappy || profile.avatarSad || profile.titleLeft || profile.titleRight) {
                profileByName.set(key, profile);
            }
        });
        const nextEntries = {};
        (Array.isArray(nextStudents) ? nextStudents : []).forEach(student => {
            const key = String(student?.name || "").trim();
            if (!key) return;
            const profile = profileByName.get(key);
            if (!profile) return;
            nextEntries[String(student.id)] = {
                avatarHappy: profile.avatarHappy || "",
                avatarSad: profile.avatarSad || "",
                titleLeft: profile.titleLeft || "",
                titleRight: profile.titleRight || ""
            };
        });
        return normalizeStudentProfiles({ version: Number(normalizedProfiles.version) || 1, entries: nextEntries });
    };

    const resolveStudentProfilesForData = (data, currentStudentProfiles, currentStudents) => {
        const safe = data && typeof data === 'object' ? data : {};
        const hasProfiles = Object.prototype.hasOwnProperty.call(safe, 'studentProfiles');
        const hasStudents = Object.prototype.hasOwnProperty.call(safe, 'students');
        const nextStudents = hasStudents ? safe.students : currentStudents;
        if (hasProfiles) {
            return normalizeStudentProfiles(safe.studentProfiles, nextStudents);
        }
        if (hasStudents) {
            const incomingStudents = Array.isArray(safe.students) ? safe.students : [];
            if (incomingStudents.some(hasLegacyStudentProfileFields)) {
                return normalizeStudentProfiles(undefined, incomingStudents);
            }
            return normalizeStudentProfiles(currentStudentProfiles, incomingStudents);
        }
        return normalizeStudentProfiles(currentStudentProfiles, currentStudents);
    };

    const compressImage = (file, callback) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 150;
                const scale = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                callback(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    };

    const getAvatar = (student, studentProfilesOrMood = 'happy', maybeMood = 'happy') => {
        const studentProfiles = typeof studentProfilesOrMood === 'string' || studentProfilesOrMood == null
            ? null
            : studentProfilesOrMood;
        const mood = typeof studentProfilesOrMood === 'string' || studentProfilesOrMood == null
            ? (studentProfilesOrMood || 'happy')
            : (maybeMood || 'happy');
        const profile = getStudentProfile(studentProfiles, student, student);
        const custom = mood === 'happy' ? profile.avatarHappy : profile.avatarSad;
        if (custom) return custom;
        return `头像/${student.name}${mood === 'happy' ? '笑脸' : '鬼脸'}.jpg`;
    };

    const getFallbackAvatar = (studentName, mood) => {
        const seed = studentName + (mood === 'sad' ? 'sad' : '');
        return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=${mood === 'happy' ? 'b6e3f4' : 'ffd5dc'}`;
    };

    const handleAvatarError = (event, studentName, mood = 'happy') => {
        event.target.onerror = null;
        event.target.src = getFallbackAvatar(studentName, mood);
    };

    window.ProfileUtils = {
        hasLegacyStudentProfileFields,
        normalizeStudentProfiles,
        getStudentProfile,
        remapStudentProfilesToStudentsByName,
        resolveStudentProfilesForData,
        compressImage,
        getAvatar,
        handleAvatarError
    };
})();
