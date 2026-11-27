const crypto = require('crypto');
const {
    normalizeStandardCategory,
    normalizeStandardScene
} = require('./taxonomy');
const { STD_EVENTS } = require('./event-bus');
const {
    V1_KEY_TO_PLUGIN_STORAGE,
    ensureClassDefaultPlugins,
    syncClassPluginStatesFromConfig
} = require('./plugins');

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseJsonSafe = (raw, fallback = null) => {
    if (typeof raw !== 'string' || !raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch (_) {
        return fallback;
    }
};

const canonicalizeComparable = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => (item === undefined ? null : canonicalizeComparable(item)));
    }
    if (isPlainObject(value)) {
        const sorted = {};
        for (const key of Object.keys(value).sort()) {
            if (value[key] === undefined) continue;
            sorted[key] = canonicalizeComparable(value[key]);
        }
        return sorted;
    }
    return value;
};

const stringifyComparable = (value) => JSON.stringify(canonicalizeComparable(value ?? null));

const getDefaultClassIdForUser = (userId) => {
    const normalized = Number(userId);
    if (!Number.isFinite(normalized)) {
        throw new Error('无效用户上下文');
    }
    return `cls_u${normalized}`;
};

const restoreTypedValue = (rawStr, typeHint) => {
    if (typeHint === 'undefined') return undefined;
    if (typeHint === 'null' || rawStr == null) return null;
    if (typeHint === 'number') {
        const parsed = Number(rawStr);
        return Number.isFinite(parsed) ? parsed : rawStr;
    }
    return String(rawStr);
};

const makeSafeIdToken = (value) => {
    const raw = String(value ?? '');
    const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 8);
    return `${safe || 'item'}_${hash}`;
};

const KNOWN_STUDENT_FIELDS = new Set([
    'id',
    'name',
    'zizai',
    'penalty',
    'balance',
    'group',
    'dorm',
    'gender',
    'role',
    'lastPenaltyAt',
    'lastSanRecoveryDate',
    'seatNo',
    'seat_or_no',
    'studentNo'
]);

const KNOWN_HISTORY_FIELDS = new Set([
    'id',
    'ts',
    'studentId',
    'studentName',
    'val',
    'reason',
    'snapshot',
    'type',
    'scene',
    'category',
    'isUndoLog',
    'pointValues',
    'pointsBefore',
    'pointsAfter',
    'agentOperationId',
    'source'
]);

const KNOWN_EXAM_ARCHIVE_TOP_KEYS = new Set([
    'version',
    'exams',
    'latestExamId',
    'defaultBattleBaseExamId',
    'defaultBattleSettleExamId'
]);

const KNOWN_EXAM_ITEM_FIELDS = new Set([
    'id',
    'name',
    'title',
    'ts',
    'date',
    'examDate',
    'records',
    'ranks'
]);

const pickExtraFields = (obj, knownSet) => {
    if (!isPlainObject(obj)) return {};
    const extra = {};
    for (const [key, value] of Object.entries(obj)) {
        if (!knownSet.has(key)) {
            extra[key] = value;
        }
    }
    return extra;
};

const readPluginStorageRow = (db, classId, pluginId, storageKey) => {
    return db.prepare(`
        SELECT storage_value
        FROM plugin_storage
        WHERE class_id = ? AND plugin_id = ? AND storage_key = ?
    `).get(classId, pluginId, storageKey);
};

const upsertPluginStorageValue = (db, classId, pluginId, storageKey, value) => {
    db.prepare(`
        INSERT INTO plugin_storage (class_id, plugin_id, storage_key, storage_value, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(class_id, plugin_id, storage_key)
        DO UPDATE SET storage_value = excluded.storage_value, updated_at = CURRENT_TIMESTAMP
    `).run(classId, pluginId, storageKey, JSON.stringify(value));
};

const deletePluginStorageKey = (db, classId, pluginId, storageKey) => {
    db.prepare(`
        DELETE FROM plugin_storage
        WHERE class_id = ? AND plugin_id = ? AND storage_key = ?
    `).run(classId, pluginId, storageKey);
};

const readDomainFlags = (db, classId) => {
    const row = readPluginStorageRow(db, classId, 'core', 'v1DomainFlags');
    const parsed = parseJsonSafe(row?.storage_value, {});
    return isPlainObject(parsed) ? parsed : {};
};

const updateDomainFlag = (db, classId, flagName, enabled) => {
    const current = readDomainFlags(db, classId);
    if (Boolean(current[flagName]) === Boolean(enabled)) return;
    const next = { ...current };
    if (enabled) {
        next[flagName] = true;
    } else {
        delete next[flagName];
    }
    upsertPluginStorageValue(db, classId, 'core', 'v1DomainFlags', next);
};

const findPrimaryClassForUser = (db, userId) => {
    return db.prepare(`
        SELECT id, catalog_code, title, grade_label, owner_teacher_id, tablet_session_mode, kiosk_playlist_json, config_json
        FROM classes
        WHERE owner_teacher_id = ?
        ORDER BY created_at ASC, id ASC
        LIMIT 1
    `).get(Number(userId));
};

const ensureClassForUser = (db, userId, options = {}) => {
    const normalizedUserId = Number(userId);
    if (!Number.isFinite(normalizedUserId)) {
        throw new Error('无效用户上下文');
    }

    const existing = findPrimaryClassForUser(db, normalizedUserId);
    if (existing) return existing;

    const classId = options.classId || getDefaultClassIdForUser(normalizedUserId);
    const config = isPlainObject(options.config) ? options.config : {};
    const title = String(options.title || config?.systemConfig?.className || '我的班级').trim() || '我的班级';

    const createTx = db.transaction(() => {
        const again = findPrimaryClassForUser(db, normalizedUserId);
        if (again) return again;

        db.prepare(`
            INSERT INTO classes (id, catalog_code, title, grade_label, owner_teacher_id, config_json)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            classId,
            options.catalogCode || null,
            title,
            options.gradeLabel || null,
            normalizedUserId,
            JSON.stringify(config)
        );

        db.prepare(`
            INSERT INTO class_teachers (class_id, teacher_id, role, permissions_json)
            VALUES (?, ?, 'owner', '{}')
            ON CONFLICT(class_id, teacher_id) DO NOTHING
        `).run(classId, normalizedUserId);

        ensureClassDefaultPlugins(db, classId, config);
        return findPrimaryClassForUser(db, normalizedUserId);
    });

    return createTx();
};

const readConfig = (db, classId) => {
    const flags = readDomainFlags(db, classId);
    if (!flags.hasConfig) return null;
    const row = db.prepare('SELECT config_json FROM classes WHERE id = ?').get(classId);
    if (!row) return null;
    const parsed = parseJsonSafe(row.config_json, {});
    return isPlainObject(parsed) ? parsed : {};
};

const writeConfig = (db, classId, incomingConfig) => {
    const safeConfig = isPlainObject(incomingConfig) ? incomingConfig : {};
    const className = typeof safeConfig?.systemConfig?.className === 'string' && safeConfig.systemConfig.className.trim()
        ? safeConfig.systemConfig.className.trim()
        : null;

    if (className) {
        db.prepare('UPDATE classes SET config_json = ?, title = ? WHERE id = ?')
            .run(JSON.stringify(safeConfig), className, classId);
    } else {
        db.prepare('UPDATE classes SET config_json = ? WHERE id = ?')
            .run(JSON.stringify(safeConfig), classId);
    }

    syncClassPluginStatesFromConfig(db, classId, safeConfig);
    updateDomainFlag(db, classId, 'hasConfig', true);
};

const reconstructStudentFromRow = (row) => {
    const profile = parseJsonSafe(row.profile_json, {});
    const student = {};

    if (profile.hasId !== false) {
        if (profile.legacyId !== undefined) {
            student.id = restoreTypedValue(profile.legacyId, profile.legacyIdType);
        } else {
            student.id = row.student_account_id;
        }
    }

    if (profile.hasName !== false) {
        student.name = row.name;
    }

    if (profile.hasGroup) {
        if (profile.groupValueType === 'undefined') {
            // JSON omits undefined
        } else if (profile.groupValueType === 'null') {
            student.group = null;
        } else if (profile.groupValueType === 'empty') {
            student.group = '';
        } else if (row.group_id != null) {
            student.group = row.group_id;
        }
    } else if (row.group_id != null) {
        student.group = row.group_id;
    }

    if (profile.hasDorm) {
        if (profile.dormValueType === 'null') {
            student.dorm = null;
        } else if (profile.dormValueType === 'empty') {
            student.dorm = '';
        } else if (row.dorm_id != null) {
            student.dorm = row.dorm_id;
        }
    } else if (row.dorm_id != null) {
        student.dorm = row.dorm_id;
    }

    if (profile.hasGender) {
        student.gender = profile.gender;
    }
    if (profile.hasRole) {
        student.role = profile.role;
    }
    if (profile.hasZizai !== false) {
        student.zizai = Number(row.zizai) || 0;
    }
    if (profile.hasPenalty !== false) {
        student.penalty = Number(row.penalty) || 0;
    }
    if (profile.hasBalance !== false) {
        student.balance = Number(row.balance) || 0;
    }
    if (profile.hasLastPenaltyAt) {
        student.lastPenaltyAt = profile.lastPenaltyAt;
    }
    if (profile.hasLastSanRecoveryDate) {
        student.lastSanRecoveryDate = profile.lastSanRecoveryDate;
    }
    if (profile.hasSeatNo) {
        student.seatNo = row.seat_or_no;
    } else if (profile.hasSeatOrNo) {
        student.seat_or_no = row.seat_or_no;
    }
    if (profile.hasStudentNo) {
        student.studentNo = profile.rawStudentNo !== undefined ? profile.rawStudentNo : row.student_no;
    }

    if (isPlainObject(profile.extraFields)) {
        for (const [key, value] of Object.entries(profile.extraFields)) {
            student[key] = value;
        }
    }

    return student;
};

const readStudents = (db, classId) => {
    const flags = readDomainFlags(db, classId);
    if (!flags.hasStudents) return null;

    const rows = db.prepare(`
        SELECT
            ce.id,
            ce.student_account_id,
            ce.status,
            ce.seat_or_no,
            ce.group_id,
            ce.dorm_id,
            ce.zizai,
            ce.penalty,
            ce.balance,
            ce.profile_json,
            sa.name,
            sa.student_no
        FROM class_enrollments ce
        INNER JOIN student_accounts sa ON sa.id = ce.student_account_id
        WHERE ce.class_id = ? AND ce.status = 'active'
    `).all(classId);

    const parsed = rows.map((row) => {
        const profile = parseJsonSafe(row.profile_json, {});
        return {
            sortOrder: Number.isFinite(Number(profile.sortOrder)) ? Number(profile.sortOrder) : Number.MAX_SAFE_INTEGER,
            student: reconstructStudentFromRow(row)
        };
    });

    parsed.sort((left, right) => left.sortOrder - right.sortOrder);
    return parsed.map((entry) => entry.student);
};

const getStudentInternalKey = (student, index) => {
    if (student && student.id != null) {
        return String(student.id);
    }
    return `__idx_${index}`;
};

const buildStudentProfileJson = (student, index) => {
    const hasId = Boolean(student) && Object.prototype.hasOwnProperty.call(student, 'id');
    const legacyId = hasId && student.id != null ? String(student.id) : (hasId && student.id === null ? null : undefined);
    const legacyIdType = !hasId ? 'undefined' : student.id === null ? 'null' : typeof student.id;

    const hasGroup = Boolean(student) && Object.prototype.hasOwnProperty.call(student, 'group');
    const groupValueType = !hasGroup
        ? 'absent'
        : student.group === undefined
            ? 'undefined'
            : student.group === null
                ? 'null'
                : student.group === ''
                    ? 'empty'
                    : 'string';

    const hasDorm = Boolean(student) && Object.prototype.hasOwnProperty.call(student, 'dorm');
    const dormValueType = !hasDorm
        ? 'absent'
        : student.dorm === undefined
            ? 'undefined'
            : student.dorm === null
                ? 'null'
                : student.dorm === ''
                    ? 'empty'
                    : 'string';

    const profile = {
        legacyId,
        legacyIdType,
        hasId,
        hasName: Boolean(student) && Object.prototype.hasOwnProperty.call(student, 'name'),
        hasZizai: Boolean(student) && Object.prototype.hasOwnProperty.call(student, 'zizai'),
        hasBalance: Boolean(student) && Object.prototype.hasOwnProperty.call(student, 'balance'),
        hasPenalty: Boolean(student) && Object.prototype.hasOwnProperty.call(student, 'penalty'),
        hasGroup,
        groupValueType,
        hasDorm,
        dormValueType,
        hasGender: Boolean(student) && Object.prototype.hasOwnProperty.call(student, 'gender'),
        gender: student?.gender,
        hasRole: Boolean(student) && Object.prototype.hasOwnProperty.call(student, 'role'),
        role: student?.role,
        hasLastPenaltyAt: Boolean(student) && Object.prototype.hasOwnProperty.call(student, 'lastPenaltyAt'),
        lastPenaltyAt: student?.lastPenaltyAt,
        hasLastSanRecoveryDate: Boolean(student) && Object.prototype.hasOwnProperty.call(student, 'lastSanRecoveryDate'),
        lastSanRecoveryDate: student?.lastSanRecoveryDate,
        hasSeatNo: Boolean(student) && Object.prototype.hasOwnProperty.call(student, 'seatNo'),
        hasSeatOrNo: Boolean(student) && Object.prototype.hasOwnProperty.call(student, 'seat_or_no'),
        hasStudentNo: Boolean(student) && Object.prototype.hasOwnProperty.call(student, 'studentNo'),
        rawStudentNo: student?.studentNo,
        sortOrder: index,
        extraFields: pickExtraFields(student, KNOWN_STUDENT_FIELDS)
    };

    return JSON.stringify(profile);
};

const writeStudents = (db, eventBus, classId, incomingStudents, options = {}) => {
    const { emitEvents = true } = options;
    const list = Array.isArray(incomingStudents) ? incomingStudents : [];

    const existingRows = db.prepare(`
        SELECT ce.id, ce.student_account_id, ce.status, ce.group_id, ce.profile_json, ce.avatar_json
        FROM class_enrollments ce
        WHERE ce.class_id = ?
    `).all(classId);

    const existingQueuesByKey = new Map();
    const previousActiveGroupById = new Map();
    existingRows.forEach((row) => {
        const profile = parseJsonSafe(row.profile_json, {});
        const key = profile.legacyId != null ? String(profile.legacyId) : row.student_account_id;
        if (!existingQueuesByKey.has(key)) {
            existingQueuesByKey.set(key, []);
        }
        existingQueuesByKey.get(key).push(row);
        if (row.status === 'active') {
            previousActiveGroupById.set(row.id, row.group_id || null);
        }
    });

    const profilesMetaRow = readPluginStorageRow(db, classId, 'core', 'studentProfilesMeta');
    const profilesMeta = parseJsonSafe(profilesMetaRow?.storage_value, null);
    const orphanEntries = isPlainObject(profilesMeta?.orphanEntries) ? { ...profilesMeta.orphanEntries } : null;
    let orphanEntriesChanged = false;

    const insertAccount = db.prepare(`
        INSERT INTO student_accounts (id, student_no, name, must_change_pin)
        VALUES (?, ?, ?, 1)
    `);
    const updateAccount = db.prepare(`
        UPDATE student_accounts
        SET name = ?, student_no = COALESCE(?, student_no)
        WHERE id = ?
    `);
    const checkStudentNoTaken = db.prepare('SELECT id FROM student_accounts WHERE student_no = ? LIMIT 1');
    const insertEnrollment = db.prepare(`
        INSERT INTO class_enrollments (
            id, class_id, student_account_id, status,
            seat_or_no, group_id, dorm_id,
            zizai, penalty, balance,
            profile_json, avatar_json, archived_at
        ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `);
    const updateEnrollment = db.prepare(`
        UPDATE class_enrollments
        SET status = 'active',
            seat_or_no = ?,
            group_id = ?,
            dorm_id = ?,
            zizai = ?,
            penalty = ?,
            balance = ?,
            profile_json = ?,
            avatar_json = ?,
            archived_at = NULL
        WHERE id = ?
    `);
    const archiveEnrollment = db.prepare(`
        UPDATE class_enrollments
        SET status = 'archived', archived_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

    const matchedIds = new Set();
    const groupChanges = {};
    const keyOccurrences = new Map();

    list.forEach((student, index) => {
        const safeStudent = isPlainObject(student) ? student : {};
        const key = getStudentInternalKey(safeStudent, index);
        const occ = keyOccurrences.get(key) || 0;
        keyOccurrences.set(key, occ + 1);

        const queue = existingQueuesByKey.get(key);
        const matchedRow = queue && queue.length > 0 ? queue.shift() : null;

        const name = String(safeStudent.name ?? '');
        const groupId = safeStudent.group ? String(safeStudent.group) : null;
        const dormId = safeStudent.dorm ? String(safeStudent.dorm) : null;
        const seatOrNo = safeStudent.seatNo != null
            ? String(safeStudent.seatNo)
            : (safeStudent.seat_or_no != null ? String(safeStudent.seat_or_no) : null);
        const zizai = Number.isFinite(Number(safeStudent.zizai)) ? Number(safeStudent.zizai) : 0;
        const penalty = Number.isFinite(Number(safeStudent.penalty)) ? Number(safeStudent.penalty) : 0;
        const balance = Number.isFinite(Number(safeStudent.balance)) ? Number(safeStudent.balance) : 0;
        const profileJson = buildStudentProfileJson(safeStudent, index);

        let rawStudentNo = safeStudent.studentNo != null && String(safeStudent.studentNo).trim()
            ? String(safeStudent.studentNo).trim()
            : null;

        if (matchedRow) {
            matchedIds.add(matchedRow.id);
            if (rawStudentNo) {
                const taken = checkStudentNoTaken.get(rawStudentNo);
                if (taken && taken.id !== matchedRow.student_account_id) {
                    rawStudentNo = null;
                }
            }
            updateAccount.run(name, rawStudentNo, matchedRow.student_account_id);

            let avatarJson = matchedRow.avatar_json || '{}';
            if (orphanEntries && Object.prototype.hasOwnProperty.call(orphanEntries, key)) {
                avatarJson = JSON.stringify({ entry: orphanEntries[key] });
                delete orphanEntries[key];
                orphanEntriesChanged = true;
            }

            updateEnrollment.run(
                seatOrNo,
                groupId,
                dormId,
                zizai,
                penalty,
                balance,
                profileJson,
                avatarJson,
                matchedRow.id
            );

            if (previousActiveGroupById.has(matchedRow.id)) {
                const prevGroup = previousActiveGroupById.get(matchedRow.id);
                if (prevGroup !== groupId) {
                    groupChanges[matchedRow.id] = groupId;
                }
            }
        } else {
            const token = makeSafeIdToken(`${key}_${occ}`);
            const suffix = crypto.randomBytes(3).toString('hex');
            const accountId = `acc_${classId}_${token}_${suffix}`;
            const enrollmentId = `enr_${classId}_${token}_${suffix}`;

            if (rawStudentNo && checkStudentNoTaken.get(rawStudentNo)) {
                rawStudentNo = null;
            }
            insertAccount.run(accountId, rawStudentNo, name);

            let avatarJson = '{}';
            if (orphanEntries && Object.prototype.hasOwnProperty.call(orphanEntries, key)) {
                avatarJson = JSON.stringify({ entry: orphanEntries[key] });
                delete orphanEntries[key];
                orphanEntriesChanged = true;
            }

            insertEnrollment.run(
                enrollmentId,
                classId,
                accountId,
                seatOrNo,
                groupId,
                dormId,
                zizai,
                penalty,
                balance,
                profileJson,
                avatarJson
            );
            matchedIds.add(enrollmentId);
            if (groupId) {
                groupChanges[enrollmentId] = groupId;
            }
        }
    });

    existingRows.forEach((row) => {
        if (row.status === 'active' && !matchedIds.has(row.id)) {
            archiveEnrollment.run(row.id);
        }
    });

    if (orphanEntriesChanged && profilesMeta) {
        upsertPluginStorageValue(db, classId, 'core', 'studentProfilesMeta', {
            ...profilesMeta,
            orphanEntries
        });
    }

    updateDomainFlag(db, classId, 'hasStudents', true);

    if (emitEvents && eventBus && Object.keys(groupChanges).length > 0) {
        eventBus.emit({
            classId,
            eventName: STD_EVENTS.GROUP_UPDATED,
            payload: { assignments: groupChanges },
            sourcePluginId: 'official.grouping'
        });
    }
};

const readStudentProfiles = (db, classId) => {
    const flags = readDomainFlags(db, classId);
    if (!flags.hasStudentProfiles) return null;

    const metaRow = readPluginStorageRow(db, classId, 'core', 'studentProfilesMeta');
    const meta = parseJsonSafe(metaRow?.storage_value, {});
    const entries = {};

    const rows = db.prepare(`
        SELECT id, profile_json, avatar_json
        FROM class_enrollments
        WHERE class_id = ?
    `).all(classId);

    rows.forEach((row) => {
        const avatar = parseJsonSafe(row.avatar_json, null);
        if (!isPlainObject(avatar) || !Object.prototype.hasOwnProperty.call(avatar, 'entry')) return;
        const profile = parseJsonSafe(row.profile_json, {});
        const key = profile.legacyId != null ? String(profile.legacyId) : row.id;
        entries[key] = avatar.entry;
    });

    if (isPlainObject(meta?.orphanEntries)) {
        for (const [key, entry] of Object.entries(meta.orphanEntries)) {
            if (!Object.prototype.hasOwnProperty.call(entries, key)) {
                entries[key] = entry;
            }
        }
    }

    const result = {};
    if (meta && Object.prototype.hasOwnProperty.call(meta, 'version')) {
        result.version = meta.version;
    }
    if (meta?.hasEntries !== false) {
        result.entries = entries;
    }
    if (isPlainObject(meta?.extraTopLevel)) {
        for (const [key, value] of Object.entries(meta.extraTopLevel)) {
            result[key] = value;
        }
    }
    return result;
};

const writeStudentProfiles = (db, classId, incomingProfiles) => {
    const safe = isPlainObject(incomingProfiles) ? incomingProfiles : {};
    const hasEntries = Object.prototype.hasOwnProperty.call(safe, 'entries') && isPlainObject(safe.entries);
    const sourceEntries = hasEntries ? safe.entries : {};

    const enrollments = db.prepare(`
        SELECT id, profile_json
        FROM class_enrollments
        WHERE class_id = ?
    `).all(classId);

    const enrollmentByKey = new Map();
    enrollments.forEach((row) => {
        const profile = parseJsonSafe(row.profile_json, {});
        const key = profile.legacyId != null ? String(profile.legacyId) : row.id;
        if (!enrollmentByKey.has(key)) {
            enrollmentByKey.set(key, []);
        }
        enrollmentByKey.get(key).push(row.id);
    });

    const updateAvatar = db.prepare('UPDATE class_enrollments SET avatar_json = ? WHERE id = ?');
    const assignedKeys = new Set();

    enrollments.forEach((row) => {
        const profile = parseJsonSafe(row.profile_json, {});
        const key = profile.legacyId != null ? String(profile.legacyId) : row.id;
        if (Object.prototype.hasOwnProperty.call(sourceEntries, key)) {
            updateAvatar.run(JSON.stringify({ entry: sourceEntries[key] }), row.id);
            assignedKeys.add(key);
        } else {
            updateAvatar.run('{}', row.id);
        }
    });

    const orphanEntries = {};
    for (const [key, value] of Object.entries(sourceEntries)) {
        if (!assignedKeys.has(key)) {
            orphanEntries[key] = value;
        }
    }

    const extraTopLevel = {};
    for (const [key, value] of Object.entries(safe)) {
        if (key !== 'version' && key !== 'entries') {
            extraTopLevel[key] = value;
        }
    }

    const meta = {
        hasEntries,
        orphanEntries,
        extraTopLevel
    };
    if (Object.prototype.hasOwnProperty.call(safe, 'version')) {
        meta.version = safe.version;
    }

    upsertPluginStorageValue(db, classId, 'core', 'studentProfilesMeta', meta);
    updateDomainFlag(db, classId, 'hasStudentProfiles', true);
};

const reconstructHistoryItem = (row) => {
    const meta = parseJsonSafe(row.meta_json, {});
    const item = {};

    if (meta.hasId) {
        item.id = restoreTypedValue(meta.legacyId, meta.legacyIdType);
    }
    if (meta.hasTs) {
        item.ts = Number(row.event_ts_ms) || 0;
    }
    if (meta.hasStudentId) {
        item.studentId = restoreTypedValue(meta.studentId, meta.studentIdType);
    }
    if (meta.hasStudentName) {
        item.studentName = meta.studentName;
    }
    if (meta.hasVal) {
        item.val = meta.val;
    }
    if (meta.hasReason) {
        item.reason = row.reason;
    }
    if (meta.hasSnapshot) {
        item.snapshot = meta.snapshot;
    }
    if (meta.hasType) {
        item.type = meta.type;
    }
    if (meta.hasIsUndoLog) {
        item.isUndoLog = meta.isUndoLog;
    }
    if (meta.hasScene) {
        item.scene = meta.rawScene !== undefined ? meta.rawScene : row.scene;
    }
    if (meta.hasCategory) {
        item.category = meta.rawCategory !== undefined ? meta.rawCategory : row.category;
    }
    if (meta.hasPointValues) {
        item.pointValues = meta.pointValues;
    }
    if (meta.hasPointsBefore) {
        item.pointsBefore = meta.pointsBefore;
    }
    if (meta.hasPointsAfter) {
        item.pointsAfter = meta.pointsAfter;
    }
    if (meta.hasAgentOperationId) {
        item.agentOperationId = meta.agentOperationId;
    }
    if (meta.hasSource) {
        item.source = meta.source;
    }

    if (isPlainObject(meta.extraFields)) {
        for (const [key, value] of Object.entries(meta.extraFields)) {
            item[key] = value;
        }
    }

    return item;
};

const computeLedgerDeltas = (record, revertedOriginal = null) => {
    if (record?.type === 'points-set') {
        const before = isPlainObject(record.pointsBefore) ? record.pointsBefore : (record.snapshot || {});
        const after = isPlainObject(record.pointsAfter) ? record.pointsAfter : {};
        return {
            deltaZizai: (Number(after.zizai) || 0) - (Number(before.zizai) || 0),
            deltaPenalty: (Number(after.penalty) || 0) - (Number(before.penalty) || 0),
            deltaBalance: (Number(after.balance) || 0) - (Number(before.balance) || 0)
        };
    }

    const val = Number(record?.val) || 0;
    if (record?.isUndoLog) {
        if (revertedOriginal) {
            const origVal = Number(revertedOriginal.val) || 0;
            return {
                deltaZizai: origVal > 0 ? -origVal : 0,
                deltaPenalty: (origVal < 0 && revertedOriginal.type === 'penalty') ? origVal : 0,
                deltaBalance: val
            };
        }
        return {
            deltaZizai: val < 0 ? val : 0,
            deltaPenalty: val > 0 ? -val : 0,
            deltaBalance: val
        };
    }

    return {
        deltaZizai: val > 0 ? val : 0,
        deltaPenalty: (val < 0 && record?.type === 'penalty') ? Math.abs(val) : 0,
        deltaBalance: val
    };
};

const buildHistorySignature = (item) => {
    const safe = isPlainObject(item) ? item : {};
    return stringifyComparable(safe);
};

const buildHistoryMetaJson = (item) => {
    const safe = isPlainObject(item) ? item : {};
    const hasId = Object.prototype.hasOwnProperty.call(safe, 'id');
    const hasStudentId = Object.prototype.hasOwnProperty.call(safe, 'studentId');

    return JSON.stringify({
        hasId,
        legacyId: hasId && safe.id != null ? String(safe.id) : (hasId && safe.id === null ? null : undefined),
        legacyIdType: !hasId ? 'undefined' : safe.id === null ? 'null' : typeof safe.id,
        hasTs: Object.prototype.hasOwnProperty.call(safe, 'ts'),
        hasStudentId,
        studentId: hasStudentId && safe.studentId != null ? String(safe.studentId) : (hasStudentId && safe.studentId === null ? null : undefined),
        studentIdType: !hasStudentId ? 'undefined' : safe.studentId === null ? 'null' : typeof safe.studentId,
        hasStudentName: Object.prototype.hasOwnProperty.call(safe, 'studentName'),
        studentName: safe.studentName,
        hasVal: Object.prototype.hasOwnProperty.call(safe, 'val'),
        val: safe.val,
        hasReason: Object.prototype.hasOwnProperty.call(safe, 'reason'),
        hasSnapshot: Object.prototype.hasOwnProperty.call(safe, 'snapshot'),
        snapshot: safe.snapshot,
        hasType: Object.prototype.hasOwnProperty.call(safe, 'type'),
        type: safe.type,
        hasScene: Object.prototype.hasOwnProperty.call(safe, 'scene'),
        rawScene: safe.scene,
        hasCategory: Object.prototype.hasOwnProperty.call(safe, 'category'),
        rawCategory: safe.category,
        hasIsUndoLog: Object.prototype.hasOwnProperty.call(safe, 'isUndoLog'),
        isUndoLog: safe.isUndoLog,
        hasPointValues: Object.prototype.hasOwnProperty.call(safe, 'pointValues'),
        pointValues: safe.pointValues,
        hasPointsBefore: Object.prototype.hasOwnProperty.call(safe, 'pointsBefore'),
        pointsBefore: safe.pointsBefore,
        hasPointsAfter: Object.prototype.hasOwnProperty.call(safe, 'pointsAfter'),
        pointsAfter: safe.pointsAfter,
        hasAgentOperationId: Object.prototype.hasOwnProperty.call(safe, 'agentOperationId'),
        agentOperationId: safe.agentOperationId,
        hasSource: Object.prototype.hasOwnProperty.call(safe, 'source'),
        source: safe.source,
        extraFields: pickExtraFields(safe, KNOWN_HISTORY_FIELDS)
    });
};

const resolveOrCreateEnrollmentForLedger = (db, classId, item) => {
    const rawStudentId = item?.studentId;
    const studentName = String(item?.studentName || '').trim();
    const rows = db.prepare(`
        SELECT ce.id, ce.status, ce.profile_json, sa.name
        FROM class_enrollments ce
        INNER JOIN student_accounts sa ON sa.id = ce.student_account_id
        WHERE ce.class_id = ?
        ORDER BY CASE WHEN ce.status = 'active' THEN 0 ELSE 1 END, ce.joined_at ASC
    `).all(classId);

    if (rawStudentId != null) {
        const targetId = String(rawStudentId);
        const byLegacyId = rows.find((row) => {
            const profile = parseJsonSafe(row.profile_json, {});
            return profile.legacyId != null && String(profile.legacyId) === targetId;
        });
        if (byLegacyId) return byLegacyId.id;
    }

    if (studentName) {
        const byName = rows.find((row) => String(row.name || '').trim() === studentName);
        if (byName) return byName.id;
    }

    const key = rawStudentId != null ? String(rawStudentId) : `name_${studentName || 'unknown'}`;
    const token = makeSafeIdToken(key);
    const suffix = crypto.randomBytes(3).toString('hex');
    const accountId = `acc_${classId}_arch_${token}_${suffix}`;
    const enrollmentId = `enr_${classId}_arch_${token}_${suffix}`;
    const profileJson = JSON.stringify({
        legacyId: rawStudentId != null ? String(rawStudentId) : key,
        legacyIdType: rawStudentId == null ? 'string' : typeof rawStudentId,
        hasId: rawStudentId !== undefined,
        sortOrder: Number.MAX_SAFE_INTEGER,
        archivedFromHistory: true
    });

    db.prepare(`
        INSERT INTO student_accounts (id, student_no, name, must_change_pin)
        VALUES (?, NULL, ?, 1)
    `).run(accountId, studentName || `历史学生(${key})`);

    db.prepare(`
        INSERT INTO class_enrollments (
            id, class_id, student_account_id, status,
            zizai, penalty, balance, profile_json, avatar_json, archived_at
        ) VALUES (?, ?, ?, 'archived', 0, 0, 0, ?, '{}', CURRENT_TIMESTAMP)
    `).run(enrollmentId, classId, accountId, profileJson);

    return enrollmentId;
};

const readHistory = (db, classId) => {
    const flags = readDomainFlags(db, classId);
    if (!flags.hasHistory) return null;

    const rows = db.prepare(`
        SELECT *
        FROM point_ledger
        WHERE class_id = ? AND status = 'applied'
        ORDER BY seq DESC, event_ts_ms DESC, id DESC
    `).all(classId);

    return rows.map(reconstructHistoryItem);
};

const syncHistoryFromV1 = (db, eventBus, classId, incomingHistory, options = {}) => {
    const {
        emitEvents = true,
        operatorContext = null
    } = options;
    const incoming = Array.isArray(incomingHistory) ? incomingHistory : [];

    const existingRows = db.prepare(`
        SELECT *
        FROM point_ledger
        WHERE class_id = ? AND status = 'applied'
        ORDER BY seq DESC, event_ts_ms DESC, id DESC
    `).all(classId);

    const existingItems = existingRows.map((row) => ({
        row,
        item: reconstructHistoryItem(row),
        sig: buildHistorySignature(reconstructHistoryItem(row))
    }));

    const insertRow = db.prepare(`
        INSERT INTO point_ledger (
            id, class_id, enrollment_id,
            delta_zizai, delta_penalty, delta_balance,
            scene, category, sub_category, reason,
            status, operator_type, operator_id, operator_label,
            source_plugin_id, idempotency_key, reverted_by_id,
            event_ts_ms, seq, meta_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'applied', ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `);
    const releaseCollidingRevertedKey = db.prepare(`
        UPDATE point_ledger
        SET idempotency_key = idempotency_key || '::reverted:' || id
        WHERE idempotency_key = ? AND status = 'reverted'
    `);
    const updateSeq = db.prepare('UPDATE point_ledger SET seq = ? WHERE id = ?');
    const markReverted = db.prepare(`
        UPDATE point_ledger
        SET status = 'reverted', reverted_by_id = ?
        WHERE id = ?
    `);

    const insertSingleLedgerItem = (item, seqValue, revertedOriginal = null) => {
        const safe = isPlainObject(item) ? item : {};
        const ledgerId = `pl_${crypto.randomBytes(10).toString('hex')}`;
        const enrollmentId = resolveOrCreateEnrollmentForLedger(db, classId, safe);
        const deltas = computeLedgerDeltas(safe, revertedOriginal);
        const scene = normalizeStandardScene(safe.scene);
        const { category, subCategory } = normalizeStandardCategory(safe.category, {
            type: safe.type,
            reason: safe.reason
        });
        const reason = String(safe.reason ?? '');
        const operatorType = operatorContext?.operatorType
            || (safe.source === 'agent-api' ? 'agent' : 'teacher');
        const operatorId = String(operatorContext?.operatorId ?? 'teacher');
        const operatorLabel = String(
            operatorContext?.operatorLabel
            || (safe.source === 'agent-api' ? 'Agent API' : '班主任')
        );
        const sourcePluginId = String(safe.sourcePluginId || 'core');
        const idempotencyKey = safe.agentOperationId ? `${classId}:${String(safe.agentOperationId)}` : null;
        const eventTsMs = Number.isFinite(Number(safe.ts)) ? Math.trunc(Number(safe.ts)) : 0;

        if (idempotencyKey) {
            releaseCollidingRevertedKey.run(idempotencyKey);
        }

        insertRow.run(
            ledgerId,
            classId,
            enrollmentId,
            deltas.deltaZizai,
            deltas.deltaPenalty,
            deltas.deltaBalance,
            scene,
            category,
            subCategory,
            reason,
            operatorType,
            operatorId,
            operatorLabel,
            sourcePluginId,
            idempotencyKey,
            eventTsMs,
            seqValue,
            buildHistoryMetaJson(safe)
        );

        return {
            ledgerId,
            enrollmentId,
            deltas,
            scene,
            category,
            subCategory,
            reason,
            sourcePluginId,
            eventTsMs
        };
    };

    const emittedEvents = [];

    // Fast path: prepend-only (normal point addition, attendance penalty/bonus, wage)
    let isPrependOnly = incoming.length >= existingItems.length;
    const prependedCount = incoming.length - existingItems.length;
    if (isPrependOnly && existingItems.length > 0) {
        for (let i = 0; i < existingItems.length; i += 1) {
            if (buildHistorySignature(incoming[prependedCount + i]) !== existingItems[i].sig) {
                isPrependOnly = false;
                break;
            }
        }
    }

    if (isPrependOnly) {
        if (prependedCount > 0) {
            const maxSeq = existingItems.length > 0 ? (Number(existingItems[0].row.seq) || 0) : 0;
            for (let idx = prependedCount - 1; idx >= 0; idx -= 1) {
                const seqValue = maxSeq + (prependedCount - idx);
                const inserted = insertSingleLedgerItem(incoming[idx], seqValue);
                emittedEvents.push(inserted);
            }
        }
    } else {
        // General diff path (undo, maintenance delete, or test seed overwrite)
        const sigQueues = new Map();
        existingItems.forEach((entry) => {
            if (!sigQueues.has(entry.sig)) {
                sigQueues.set(entry.sig, []);
            }
            sigQueues.get(entry.sig).push(entry);
        });

        const total = incoming.length;
        const plan = new Array(total);
        const matchedRowIds = new Set();

        for (let i = 0; i < total; i += 1) {
            const sig = buildHistorySignature(incoming[i]);
            const queue = sigQueues.get(sig);
            const targetSeq = total - i;
            if (queue && queue.length > 0) {
                const matched = queue.shift();
                matchedRowIds.add(matched.row.id);
                plan[i] = { kind: 'keep', entry: matched, targetSeq };
            } else {
                plan[i] = { kind: 'insert', item: incoming[i], targetSeq };
            }
        }

        const removedEntries = existingItems.filter((entry) => !matchedRowIds.has(entry.row.id));

        const insertedEntries = [];
        for (let i = total - 1; i >= 0; i -= 1) {
            const step = plan[i];
            if (step.kind === 'keep') {
                if (Number(step.entry.row.seq) !== step.targetSeq) {
                    updateSeq.run(step.targetSeq, step.entry.row.id);
                }
            } else {
                let revertedOriginal = null;
                if (step.item?.isUndoLog) {
                    revertedOriginal = removedEntries.find((rem) => (
                        String(rem.item?.studentId ?? '') === String(step.item?.studentId ?? '')
                    ))?.item || null;
                }
                const inserted = insertSingleLedgerItem(step.item, step.targetSeq, revertedOriginal);
                insertedEntries.push({ item: step.item, inserted });
                emittedEvents.push(inserted);
            }
        }

        removedEntries.forEach((removed) => {
            const undoEntry = insertedEntries.find(({ item }) => (
                item?.isUndoLog === true
                && String(item?.studentId ?? '') === String(removed.item?.studentId ?? '')
            ));
            markReverted.run(undoEntry ? undoEntry.inserted.ledgerId : null, removed.row.id);
        });
    }

    updateDomainFlag(db, classId, 'hasHistory', true);

    if (emitEvents && eventBus && emittedEvents.length > 0) {
        emittedEvents.forEach((ev) => {
            eventBus.emit({
                classId,
                eventName: STD_EVENTS.POINTS_CHANGED,
                sourcePluginId: ev.sourcePluginId,
                timestamp: ev.eventTsMs || Date.now(),
                payload: {
                    enrollmentId: ev.enrollmentId,
                    delta: ev.deltas.deltaBalance,
                    deltaZizai: ev.deltas.deltaZizai,
                    deltaPenalty: ev.deltas.deltaPenalty,
                    deltaBalance: ev.deltas.deltaBalance,
                    scene: ev.scene,
                    category: ev.category,
                    subCategory: ev.subCategory,
                    reason: ev.reason,
                    sourcePluginId: ev.sourcePluginId
                }
            });
        });
    }
};

const readExamArchives = (db, classId) => {
    const flags = readDomainFlags(db, classId);
    if (!flags.hasExamArchives) return null;

    const metaRow = readPluginStorageRow(db, classId, 'core', 'examArchivesMeta');
    const meta = parseJsonSafe(metaRow?.storage_value, {});

    const archiveRows = db.prepare(`
        SELECT id, exam_key, title, exam_date, metadata_json, sort_order
        FROM exam_archives
        WHERE class_id = ?
        ORDER BY sort_order ASC
    `).all(classId);

    const scoreRows = db.prepare(`
        SELECT exam_archive_id, student_key, scores_json, legacy_rank_json
        FROM exam_scores
        WHERE class_id = ?
        ORDER BY rowid ASC
    `).all(classId);

    const scoresByArchiveId = new Map();
    scoreRows.forEach((row) => {
        if (!scoresByArchiveId.has(row.exam_archive_id)) {
            scoresByArchiveId.set(row.exam_archive_id, []);
        }
        scoresByArchiveId.get(row.exam_archive_id).push(row);
    });

    const exams = archiveRows.map((row) => {
        const itemMeta = parseJsonSafe(row.metadata_json, {});
        const exam = {};

        if (itemMeta.hasId !== false) {
            exam.id = restoreTypedValue(itemMeta.legacyId ?? row.exam_key, itemMeta.legacyIdType);
        }
        if (itemMeta.hasName) {
            exam.name = row.title;
        }
        if (itemMeta.hasTitle) {
            exam.title = itemMeta.rawTitle;
        }
        if (itemMeta.hasTs) {
            exam.ts = itemMeta.ts;
        }
        if (itemMeta.hasDate) {
            exam.date = row.exam_date;
        }
        if (itemMeta.hasExamDate) {
            exam.examDate = itemMeta.rawExamDate;
        }

        const archiveScores = scoresByArchiveId.get(row.id) || [];
        const records = {};
        const ranks = {};
        let hasAnyRecord = false;
        let hasAnyRank = false;

        archiveScores.forEach((sRow) => {
            const parsedScores = parseJsonSafe(sRow.scores_json, {});
            if (isPlainObject(parsedScores) && Object.prototype.hasOwnProperty.call(parsedScores, '__absentRecord')) {
                // Only rank existed
            } else {
                records[sRow.student_key] = parsedScores;
                hasAnyRecord = true;
            }
            if (sRow.legacy_rank_json != null) {
                ranks[sRow.student_key] = parseJsonSafe(sRow.legacy_rank_json, null);
                hasAnyRank = true;
            }
        });

        if (itemMeta.hasRecords || hasAnyRecord) {
            exam.records = records;
        }
        if (itemMeta.hasRanks || hasAnyRank) {
            exam.ranks = ranks;
        }
        if (isPlainObject(itemMeta.extraFields)) {
            for (const [key, value] of Object.entries(itemMeta.extraFields)) {
                exam[key] = value;
            }
        }
        return exam;
    });

    const result = {};
    if (meta && Object.prototype.hasOwnProperty.call(meta, 'version')) {
        result.version = meta.version;
    }
    if (meta?.hasExams !== false) {
        result.exams = exams;
    }
    if (meta && Object.prototype.hasOwnProperty.call(meta, 'latestExamId')) {
        result.latestExamId = meta.latestExamId;
    }
    if (meta && Object.prototype.hasOwnProperty.call(meta, 'defaultBattleBaseExamId')) {
        result.defaultBattleBaseExamId = meta.defaultBattleBaseExamId;
    }
    if (meta && Object.prototype.hasOwnProperty.call(meta, 'defaultBattleSettleExamId')) {
        result.defaultBattleSettleExamId = meta.defaultBattleSettleExamId;
    }
    if (isPlainObject(meta?.extraTopLevel)) {
        for (const [key, value] of Object.entries(meta.extraTopLevel)) {
            result[key] = value;
        }
    }
    return result;
};

const writeExamArchives = (db, classId, incomingExamArchives) => {
    const safe = isPlainObject(incomingExamArchives) ? incomingExamArchives : {};
    const hasExams = Object.prototype.hasOwnProperty.call(safe, 'exams') && Array.isArray(safe.exams);
    const exams = hasExams ? safe.exams : [];

    db.prepare('DELETE FROM exam_scores WHERE class_id = ?').run(classId);
    db.prepare('DELETE FROM exam_archives WHERE class_id = ?').run(classId);

    const enrollments = db.prepare(`
        SELECT id, profile_json
        FROM class_enrollments
        WHERE class_id = ?
    `).all(classId);
    const enrollmentByStudentKey = new Map();
    enrollments.forEach((row) => {
        const profile = parseJsonSafe(row.profile_json, {});
        if (profile.legacyId != null) {
            enrollmentByStudentKey.set(String(profile.legacyId), row.id);
        }
    });

    const insertArchive = db.prepare(`
        INSERT INTO exam_archives (id, class_id, exam_key, title, exam_date, metadata_json, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertScore = db.prepare(`
        INSERT INTO exam_scores (exam_archive_id, class_id, enrollment_id, student_key, scores_json, legacy_rank_json)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    exams.forEach((exam, idx) => {
        const safeExam = isPlainObject(exam) ? exam : {};
        const hasId = Object.prototype.hasOwnProperty.call(safeExam, 'id');
        const examKey = hasId && safeExam.id != null ? String(safeExam.id) : `__exam_${idx}`;
        const archiveId = `exa_${classId}_${makeSafeIdToken(`${examKey}_${idx}`)}`;
        const hasName = Object.prototype.hasOwnProperty.call(safeExam, 'name');
        const hasTitle = Object.prototype.hasOwnProperty.call(safeExam, 'title');
        const hasTs = Object.prototype.hasOwnProperty.call(safeExam, 'ts');
        const hasDate = Object.prototype.hasOwnProperty.call(safeExam, 'date');
        const hasExamDate = Object.prototype.hasOwnProperty.call(safeExam, 'examDate');
        const hasRecords = Object.prototype.hasOwnProperty.call(safeExam, 'records') && isPlainObject(safeExam.records);
        const hasRanks = Object.prototype.hasOwnProperty.call(safeExam, 'ranks') && isPlainObject(safeExam.ranks);

        const itemMeta = {
            hasId,
            legacyId: hasId && safeExam.id != null ? String(safeExam.id) : (hasId && safeExam.id === null ? null : undefined),
            legacyIdType: !hasId ? 'undefined' : safeExam.id === null ? 'null' : typeof safeExam.id,
            hasName,
            hasTitle,
            rawTitle: safeExam.title,
            hasTs,
            ts: safeExam.ts,
            hasDate,
            hasExamDate,
            rawExamDate: safeExam.examDate,
            hasRecords,
            hasRanks,
            extraFields: pickExtraFields(safeExam, KNOWN_EXAM_ITEM_FIELDS)
        };

        insertArchive.run(
            archiveId,
            classId,
            examKey,
            String(safeExam.name ?? safeExam.title ?? ''),
            safeExam.date != null ? String(safeExam.date) : null,
            JSON.stringify(itemMeta),
            idx
        );

        const recordsObj = hasRecords ? safeExam.records : {};
        const ranksObj = hasRanks ? safeExam.ranks : {};
        const studentKeys = new Set([...Object.keys(recordsObj), ...Object.keys(ranksObj)]);

        for (const studentKey of studentKeys) {
            const hasRec = Object.prototype.hasOwnProperty.call(recordsObj, studentKey);
            const hasRank = Object.prototype.hasOwnProperty.call(ranksObj, studentKey);
            const enrollmentId = enrollmentByStudentKey.get(studentKey) || `legacy:${studentKey}`;
            const scoresJson = hasRec
                ? JSON.stringify(recordsObj[studentKey])
                : JSON.stringify({ __absentRecord: true });
            const rankJson = hasRank ? JSON.stringify(ranksObj[studentKey]) : null;

            insertScore.run(archiveId, classId, enrollmentId, studentKey, scoresJson, rankJson);
        }
    });

    const meta = {
        hasExams,
        extraTopLevel: pickExtraFields(safe, KNOWN_EXAM_ARCHIVE_TOP_KEYS)
    };
    ['version', 'latestExamId', 'defaultBattleBaseExamId', 'defaultBattleSettleExamId'].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(safe, key)) {
            meta[key] = safe[key];
        }
    });

    upsertPluginStorageValue(db, classId, 'core', 'examArchivesMeta', meta);
    updateDomainFlag(db, classId, 'hasExamArchives', true);
};

const emitTaskCompletionsDiff = (db, eventBus, classId, previousTasks, nextTasks) => {
    if (!eventBus || !Array.isArray(nextTasks)) return;
    const prevClaimsByTaskId = new Map();
    (Array.isArray(previousTasks) ? previousTasks : []).forEach((task) => {
        if (!task || task.id == null) return;
        prevClaimsByTaskId.set(String(task.id), new Set((Array.isArray(task.claimedBy) ? task.claimedBy : []).map(String)));
    });

    const enrollments = db.prepare('SELECT id, profile_json FROM class_enrollments WHERE class_id = ?').all(classId);
    const enrollmentMap = new Map();
    enrollments.forEach((row) => {
        const profile = parseJsonSafe(row.profile_json, {});
        if (profile.legacyId != null) {
            enrollmentMap.set(String(profile.legacyId), row.id);
        }
    });

    nextTasks.forEach((task) => {
        if (!task || task.id == null || !Array.isArray(task.claimedBy)) return;
        const prevSet = prevClaimsByTaskId.get(String(task.id)) || new Set();
        task.claimedBy.forEach((claimerId) => {
            const key = String(claimerId);
            if (prevSet.has(key)) return;
            eventBus.emit({
                classId,
                eventName: STD_EVENTS.TASK_COMPLETED,
                sourcePluginId: 'official.tasks',
                payload: {
                    enrollmentId: enrollmentMap.get(key) || key,
                    taskId: task.id,
                    title: String(task.title || ''),
                    reward: Number(task.points) || 0
                }
            });
        });
    });
};

/**
 * Create a V1-compatible data store backed by V2 relational tables and plugin_storage.
 */
const createV2CompatStore = ({
    db,
    userId,
    mode = 'formal',
    testSessionId = null,
    eventBus = null,
    operatorContext = null
}) => {
    const normalizedUserId = Number(userId);
    if (!Number.isFinite(normalizedUserId)) {
        throw new Error('无效用户上下文');
    }

    const resolveExistingClassId = () => {
        const row = findPrimaryClassForUser(db, normalizedUserId);
        return row ? row.id : null;
    };

    const resolveOrCreateClassId = () => ensureClassForUser(db, normalizedUserId).id;

    const readDataKey = (dataKey) => {
        const classId = resolveExistingClassId();
        if (!classId) return null;

        if (dataKey === 'students') return readStudents(db, classId);
        if (dataKey === 'studentProfiles') return readStudentProfiles(db, classId);
        if (dataKey === 'history') return readHistory(db, classId);
        if (dataKey === 'config') return readConfig(db, classId);
        if (dataKey === 'examArchives') return readExamArchives(db, classId);

        const pluginTarget = V1_KEY_TO_PLUGIN_STORAGE[dataKey];
        if (!pluginTarget) return null;

        const row = readPluginStorageRow(db, classId, pluginTarget.pluginId, pluginTarget.storageKey);
        return row ? parseJsonSafe(row.storage_value, null) : null;
    };

    const readAllData = () => {
        const classId = resolveExistingClassId();
        if (!classId) return {};

        const result = {};

        const students = readStudents(db, classId);
        if (students !== null) result.students = students;

        const studentProfiles = readStudentProfiles(db, classId);
        if (studentProfiles !== null) result.studentProfiles = studentProfiles;

        const history = readHistory(db, classId);
        if (history !== null) result.history = history;

        const config = readConfig(db, classId);
        if (config !== null) result.config = config;

        const examArchives = readExamArchives(db, classId);
        if (examArchives !== null) result.examArchives = examArchives;

        const pluginRows = db.prepare(`
            SELECT plugin_id, storage_key, storage_value
            FROM plugin_storage
            WHERE class_id = ?
        `).all(classId);

        const reverseKeyMap = new Map();
        for (const [v1Key, target] of Object.entries(V1_KEY_TO_PLUGIN_STORAGE)) {
            reverseKeyMap.set(`${target.pluginId}::${target.storageKey}`, v1Key);
        }

        pluginRows.forEach((row) => {
            const v1Key = reverseKeyMap.get(`${row.plugin_id}::${row.storage_key}`);
            if (!v1Key) return;
            result[v1Key] = parseJsonSafe(row.storage_value, null);
        });

        return result;
    };

    const upsertDataKey = (dataKey, rawJsonString, options = {}) => {
        const classId = resolveOrCreateClassId();
        const parsedValue = typeof rawJsonString === 'string' ? parseJsonSafe(rawJsonString, null) : rawJsonString;
        const emitEvents = options.emitEvents !== false;

        if (dataKey === 'students') {
            writeStudents(db, eventBus, classId, parsedValue, { emitEvents });
            return { changes: 1 };
        }
        if (dataKey === 'studentProfiles') {
            writeStudentProfiles(db, classId, parsedValue);
            return { changes: 1 };
        }
        if (dataKey === 'history') {
            syncHistoryFromV1(db, eventBus, classId, parsedValue, {
                emitEvents,
                operatorContext: options.operatorContext || operatorContext
            });
            return { changes: 1 };
        }
        if (dataKey === 'config') {
            writeConfig(db, classId, parsedValue);
            return { changes: 1 };
        }
        if (dataKey === 'examArchives') {
            writeExamArchives(db, classId, parsedValue);
            return { changes: 1 };
        }

        const pluginTarget = V1_KEY_TO_PLUGIN_STORAGE[dataKey];
        if (!pluginTarget) {
            return { changes: 0 };
        }

        if (dataKey === 'tasks' && emitEvents && eventBus) {
            const prevRow = readPluginStorageRow(db, classId, pluginTarget.pluginId, pluginTarget.storageKey);
            const prevTasks = prevRow ? parseJsonSafe(prevRow.storage_value, []) : [];
            emitTaskCompletionsDiff(db, eventBus, classId, prevTasks, parsedValue);
        }

        upsertPluginStorageValue(db, classId, pluginTarget.pluginId, pluginTarget.storageKey, parsedValue);
        return { changes: 1 };
    };

    const deleteDataKeys = (dataKeys) => {
        const classId = resolveExistingClassId();
        if (!classId) return;
        const keys = Array.isArray(dataKeys) ? dataKeys : [];
        keys.forEach((rawKey) => {
            const dataKey = String(rawKey);
            if (dataKey === 'students') {
                db.prepare("UPDATE class_enrollments SET status = 'archived', archived_at = CURRENT_TIMESTAMP WHERE class_id = ? AND status = 'active'").run(classId);
                updateDomainFlag(db, classId, 'hasStudents', false);
                return;
            }
            if (dataKey === 'studentProfiles') {
                db.prepare("UPDATE class_enrollments SET avatar_json = '{}' WHERE class_id = ?").run(classId);
                deletePluginStorageKey(db, classId, 'core', 'studentProfilesMeta');
                updateDomainFlag(db, classId, 'hasStudentProfiles', false);
                return;
            }
            if (dataKey === 'history') {
                db.prepare("UPDATE point_ledger SET status = 'reverted' WHERE class_id = ? AND status = 'applied'").run(classId);
                updateDomainFlag(db, classId, 'hasHistory', false);
                return;
            }
            if (dataKey === 'config') {
                db.prepare("UPDATE classes SET config_json = '{}' WHERE id = ?").run(classId);
                updateDomainFlag(db, classId, 'hasConfig', false);
                return;
            }
            if (dataKey === 'examArchives') {
                db.prepare('DELETE FROM exam_scores WHERE class_id = ?').run(classId);
                db.prepare('DELETE FROM exam_archives WHERE class_id = ?').run(classId);
                deletePluginStorageKey(db, classId, 'core', 'examArchivesMeta');
                updateDomainFlag(db, classId, 'hasExamArchives', false);
                return;
            }
            const pluginTarget = V1_KEY_TO_PLUGIN_STORAGE[dataKey];
            if (pluginTarget) {
                deletePluginStorageKey(db, classId, pluginTarget.pluginId, pluginTarget.storageKey);
            }
        });
    };

    const emitAttendanceRecorded = ({
        studentId,
        studentName,
        status,
        slot,
        timestamp,
        sourcePluginId = 'official.attendance'
    }) => {
        if (!eventBus) return null;
        const classId = resolveExistingClassId();
        if (!classId) return null;
        const enrollmentId = resolveOrCreateEnrollmentForLedger(db, classId, { studentId, studentName });
        return eventBus.emit({
            classId,
            eventName: STD_EVENTS.ATTENDANCE_RECORDED,
            sourcePluginId,
            timestamp: Number(timestamp) || Date.now(),
            payload: {
                enrollmentId,
                studentId,
                studentName,
                status,
                slot,
                timestamp: Number(timestamp) || Date.now()
            }
        });
    };

    const runInTransaction = (fn) => db.transaction(fn)();

    const readMaintenanceCredential = () => {
        return db.prepare('SELECT user_id, password_hash, updated_at FROM maintenance_credentials WHERE user_id = ?').get(normalizedUserId);
    };

    const insertMaintenanceCredential = (passwordHash, migratedFromLegacy = 0) => {
        return db.prepare(`
            INSERT INTO maintenance_credentials (user_id, password_hash, migrated_from_legacy, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).run(normalizedUserId, passwordHash, migratedFromLegacy);
    };

    const updateMaintenanceCredential = (passwordHash) => {
        return db.prepare(`
            UPDATE maintenance_credentials
            SET password_hash = ?, migrated_from_legacy = 0, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        `).run(passwordHash, normalizedUserId);
    };

    return {
        mode,
        userId: normalizedUserId,
        testSessionId,
        db,
        eventBus,
        get classId() {
            return resolveExistingClassId();
        },
        ensureClassId() {
            return resolveOrCreateClassId();
        },
        runInTransaction,
        readDataKey,
        readAllData,
        upsertDataKey,
        deleteDataKeys,
        emitAttendanceRecorded,
        readMaintenanceCredential,
        insertMaintenanceCredential,
        updateMaintenanceCredential
    };
};

module.exports = {
    getDefaultClassIdForUser,
    findPrimaryClassForUser,
    ensureClassForUser,
    readDomainFlags,
    updateDomainFlag,
    readPluginStorageRow,
    upsertPluginStorageValue,
    readStudents,
    writeStudents,
    readStudentProfiles,
    writeStudentProfiles,
    readHistory,
    syncHistoryFromV1,
    readConfig,
    writeConfig,
    readExamArchives,
    writeExamArchives,
    createV2CompatStore,
    computeLedgerDeltas,
    canonicalizeComparable,
    stringifyComparable
};
