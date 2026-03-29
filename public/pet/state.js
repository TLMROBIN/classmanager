(function() {
    const petData = window.ClassPetData || {};
    const SPECIES = Array.isArray(petData.SPECIES) ? petData.SPECIES : [];
    const SHOP_ITEMS = Array.isArray(petData.SHOP_ITEMS) ? petData.SHOP_ITEMS : [];
    const SPECIES_BY_ID = petData.SPECIES_BY_ID || {};
    const DEFAULT_PET_DOMAIN = Object.freeze({
        version: 1,
        pets: {}
    });
    const PET_LEVEL_CAP = 50;
    const EXP_PER_LEVEL = 50;
    const INITIAL_PET_STATUS = Object.freeze({
        happiness: 80,
        health: 80,
        energy: 80
    });
    const STAGE_THRESHOLDS = Object.freeze([
        { id: 'young', minLevel: 1, label: '幼体' },
        { id: 'growth', minLevel: 10, label: '成长' },
        { id: 'adult', minLevel: 25, label: '成年' }
    ]);

    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
    const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const sameId = (left, right) => String(left) === String(right);
    const sameStudent = (recordStudentId, studentId) => String(recordStudentId) === String(studentId);

    const cloneBoosts = (boosts) => ({
        happiness: toNumber(boosts?.happiness),
        health: toNumber(boosts?.health),
        energy: toNumber(boosts?.energy),
        exp: toNumber(boosts?.exp)
    });

    const normalizeCareLog = (items) => (
        Array.isArray(items) ? items : []
    ).map((item, index) => ({
        id: item?.id || `care_${index}`,
        ts: toNumber(item?.ts),
        itemId: item?.itemId || '',
        itemName: item?.itemName || '宠物道具',
        price: Math.max(0, toNumber(item?.price)),
        boost: cloneBoosts(item?.boost)
    })).sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0)).slice(0, 30);

    const hashSeed = (value) => {
        const text = String(value || '');
        let hash = 0;
        for (let i = 0; i < text.length; i += 1) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    };

    const pickSpeciesForStudent = (student) => {
        if (!SPECIES.length) return null;
        const seed = hashSeed(student?.id ?? student?.name ?? Date.now());
        return SPECIES[seed % SPECIES.length];
    };

    const calculateLevel = (exp) => clamp(Math.floor(toNumber(exp) / EXP_PER_LEVEL) + 1, 1, PET_LEVEL_CAP);

    const calculateStage = (level, hatchedAt) => {
        if (!hatchedAt) return 'egg';
        const safeLevel = clamp(level, 1, PET_LEVEL_CAP);
        let current = STAGE_THRESHOLDS[0];
        STAGE_THRESHOLDS.forEach((stage) => {
            if (safeLevel >= stage.minLevel) current = stage;
        });
        return current.id;
    };

    const getStageLabel = (stageId) => {
        if (stageId === 'egg') return '蛋期';
        const stage = STAGE_THRESHOLDS.find((item) => item.id === stageId);
        return stage ? stage.label : '蛋期';
    };

    const getDefaultComputedState = () => ({
        level: 1,
        exp: 0,
        stage: 'egg',
        happiness: INITIAL_PET_STATUS.happiness,
        health: INITIAL_PET_STATUS.health,
        energy: INITIAL_PET_STATUS.energy,
        lastHistoryTs: 0,
        lastAttendanceTs: 0
    });

    const normalizePetRecord = (pet, student, nowTs) => {
        const computed = getDefaultComputedState();
        const chosenSpecies = SPECIES_BY_ID[pet?.speciesId] || null;
        const hatchedAt = Math.max(0, toNumber(pet?.hatchedAt));
        return {
            speciesId: chosenSpecies?.id || '',
            nickname: String(pet?.nickname || chosenSpecies?.name || '宠物蛋').trim().slice(0, 12) || (chosenSpecies?.name || '宠物蛋'),
            initializedAt: Math.max(0, toNumber(pet?.initializedAt, nowTs)),
            hatchedAt,
            manualBoosts: cloneBoosts(pet?.manualBoosts),
            careLog: normalizeCareLog(pet?.careLog),
            accessories: Array.isArray(pet?.accessories) ? pet.accessories.slice(0, 3) : [],
            level: clamp(toNumber(pet?.level, computed.level), 1, PET_LEVEL_CAP),
            exp: Math.max(0, toNumber(pet?.exp, computed.exp)),
            stage: hatchedAt > 0 ? (pet?.stage || 'young') : 'egg',
            happiness: clamp(toNumber(pet?.happiness, computed.happiness), 0, 100),
            health: clamp(toNumber(pet?.health, computed.health), 0, 100),
            energy: clamp(toNumber(pet?.energy, computed.energy), 0, 100),
            lastHistoryTs: Math.max(0, toNumber(pet?.lastHistoryTs, computed.lastHistoryTs)),
            lastAttendanceTs: Math.max(0, toNumber(pet?.lastAttendanceTs, computed.lastAttendanceTs))
        };
    };

    const normalizePetDomain = (domain) => {
        const safe = domain && typeof domain === 'object' ? domain : {};
        const sourcePets = safe.pets && typeof safe.pets === 'object' && !Array.isArray(safe.pets)
            ? safe.pets
            : {};
        const pets = {};
        Object.keys(sourcePets).forEach((studentId) => {
            pets[String(studentId)] = normalizePetRecord(sourcePets[studentId], { id: studentId }, Date.now());
        });
        return {
            version: Number(safe.version) || DEFAULT_PET_DOMAIN.version,
            pets
        };
    };

    const createHistoryAccumulator = () => ({
        exp: 0,
        happiness: INITIAL_PET_STATUS.happiness,
        health: INITIAL_PET_STATUS.health,
        energy: INITIAL_PET_STATUS.energy,
        lastHistoryTs: 0
    });

    const applyHistoryRecord = (state, record) => {
        const next = { ...state };
        const ts = toNumber(record?.ts);
        if (ts > next.lastHistoryTs) next.lastHistoryTs = ts;

        if (record?.type === 'spending') {
            return next;
        }

        const reason = String(record?.reason || '');
        const category = String(record?.category || '');
        const val = toNumber(record?.val);
        if (!val) return next;

        if (reason.startsWith('撤销扣分:')) {
            next.happiness += Math.min(Math.abs(val) * 0.5, 15);
            return next;
        }

        if (val > 0) {
            next.happiness += Math.min(val * 0.5, 20);
            next.exp += val;
            if (category === '学业') next.exp += val;
            if (category === '卫生') next.health += 3;
            if (category === '出勤') next.energy += 2;
            return next;
        }

        next.happiness -= Math.min(Math.abs(val) * 0.5, 15);
        if (category === '卫生') next.health -= 4;
        if (category === '出勤') next.energy -= 3;
        return next;
    };

    const createAttendanceAccumulator = () => ({
        exp: 0,
        health: 0,
        energy: 0,
        lastAttendanceTs: 0
    });

    const deriveAttendanceTimestamp = (dateKey) => {
        const text = String(dateKey || '');
        const parsed = Date.parse(`${text}T00:00:00`);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const applyAttendanceRecord = (state, record, dateKey) => {
        const next = { ...state };
        const ts = Math.max(toNumber(record?.timestamp), deriveAttendanceTimestamp(dateKey));
        if (ts > next.lastAttendanceTs) next.lastAttendanceTs = ts;
        const status = String(record?.status || '');
        if (status === 'ok') {
            next.energy += 6;
            next.health += 3;
            next.exp += 2;
            return next;
        }
        if (status === 'late') {
            next.energy += 2;
            next.exp += 1;
            return next;
        }
        if (status === 'absent') {
            next.energy -= 12;
            next.health -= 8;
        }
        return next;
    };

    const buildComputedPet = ({ pet, history, attendanceRecords, student }) => {
        if (!pet.hatchedAt || !pet.speciesId) {
            return {
                ...pet,
                exp: 0,
                level: 1,
                stage: 'egg',
                happiness: INITIAL_PET_STATUS.happiness,
                health: INITIAL_PET_STATUS.health,
                energy: INITIAL_PET_STATUS.energy,
                lastHistoryTs: 0,
                lastAttendanceTs: 0
            };
        }
        const historyState = createHistoryAccumulator();
        (Array.isArray(history) ? history : []).forEach((record) => {
            if (record?.studentId == null || !sameStudent(record.studentId, student.id)) return;
            if (toNumber(record?.ts) < pet.hatchedAt) return;
            Object.assign(historyState, applyHistoryRecord(historyState, record));
        });

        const attendanceState = createAttendanceAccumulator();
        Object.keys(attendanceRecords || {}).forEach((dateKey) => {
            const studentRecords = attendanceRecords?.[dateKey]?.[student?.name];
            if (!studentRecords || typeof studentRecords !== 'object') return;
            Object.keys(studentRecords).forEach((sessionId) => {
                const record = studentRecords[sessionId];
                const recordTs = Math.max(toNumber(record?.timestamp), deriveAttendanceTimestamp(dateKey));
                if (recordTs < pet.hatchedAt) return;
                Object.assign(attendanceState, applyAttendanceRecord(attendanceState, record, dateKey));
            });
        });

        const boosts = cloneBoosts(pet.manualBoosts);
        const exp = Math.max(0, historyState.exp + attendanceState.exp + boosts.exp);
        const level = calculateLevel(exp);
        return {
            ...pet,
            exp,
            level,
            stage: calculateStage(level, pet.hatchedAt),
            happiness: clamp(historyState.happiness + boosts.happiness, 0, 100),
            health: clamp(historyState.health + attendanceState.health + boosts.health, 0, 100),
            energy: clamp(historyState.energy + attendanceState.energy + boosts.energy, 0, 100),
            lastHistoryTs: historyState.lastHistoryTs,
            lastAttendanceTs: attendanceState.lastAttendanceTs
        };
    };

    const reconcilePetDomain = ({ domain, students, history, attendanceRecords, nowTs }) => {
        const normalizedDomain = normalizePetDomain(domain);
        const sourceStudents = Array.isArray(students) ? students : [];
        const nextPets = {};

        sourceStudents.forEach((student) => {
            const studentId = String(student?.id ?? '');
            if (!studentId) return;
            const existing = normalizedDomain.pets[studentId];
            const pet = normalizePetRecord(existing, student, nowTs);
            nextPets[studentId] = buildComputedPet({
                pet,
                history,
                attendanceRecords,
                student
            });
        });

        const nextDomain = {
            version: 1,
            pets: nextPets
        };

        return {
            domain: nextDomain,
            changed: JSON.stringify(normalizedDomain) !== JSON.stringify(nextDomain)
        };
    };

    const renamePet = ({ domain, studentId, nickname }) => {
        const normalizedDomain = normalizePetDomain(domain);
        const key = String(studentId);
        const pet = normalizedDomain.pets[key];
        if (!pet) return { ok: false, message: '未找到宠物数据' };
        const nextNickname = String(nickname || '').trim().slice(0, 12);
        if (!nextNickname) return { ok: false, message: '昵称不能为空' };
        return {
            ok: true,
            domain: {
                ...normalizedDomain,
                pets: {
                    ...normalizedDomain.pets,
                    [key]: {
                        ...pet,
                        nickname: nextNickname
                    }
                }
            }
        };
    };

    const purchasePetItem = ({ domain, students, history, studentId, itemId, nowTs }) => {
        const normalizedDomain = normalizePetDomain(domain);
        const key = String(studentId);
        const item = SHOP_ITEMS.find((entry) => entry.id === itemId);
        const pet = normalizedDomain.pets[key];
        const sourceStudents = Array.isArray(students) ? students : [];
        const sourceHistory = Array.isArray(history) ? history : [];
        const student = sourceStudents.find((entry) => sameId(entry.id, studentId));

        if (!item) return { ok: false, message: '未找到宠物商品' };
        if (!student) return { ok: false, message: '未找到学生' };
        if (!pet) return { ok: false, message: '该学生尚未拥有宠物' };
        if (!pet.hatchedAt || !pet.speciesId) return { ok: false, message: '请先孵化宠物蛋' };
        if (toNumber(student.balance) < item.price) {
            return { ok: false, message: '积分不足' };
        }

        const snapshot = {
            zizai: toNumber(student.zizai),
            balance: toNumber(student.balance),
            penalty: toNumber(student.penalty)
        };
        const nextStudents = sourceStudents.map((entry) => (
            sameId(entry.id, studentId)
                ? { ...entry, balance: toNumber(entry.balance) - item.price }
                : entry
        ));
        const nextHistory = [{
            id: nowTs + Math.random(),
            ts: nowTs,
            studentId: student.id,
            studentName: student.name,
            val: -item.price,
            reason: `宠物商店: ${item.name}`,
            snapshot,
            type: 'spending',
            scene: '班级',
            category: '兑奖'
        }, ...sourceHistory];
        const nextPet = {
            ...pet,
            manualBoosts: {
                happiness: toNumber(pet.manualBoosts?.happiness) + toNumber(item.boost?.happiness),
                health: toNumber(pet.manualBoosts?.health) + toNumber(item.boost?.health),
                energy: toNumber(pet.manualBoosts?.energy) + toNumber(item.boost?.energy),
                exp: toNumber(pet.manualBoosts?.exp) + toNumber(item.boost?.exp)
            },
            careLog: [{
                id: `care_${nowTs}_${Math.random().toString(36).slice(2, 8)}`,
                ts: nowTs,
                itemId: item.id,
                itemName: item.name,
                price: item.price,
                boost: cloneBoosts(item.boost)
            }, ...normalizeCareLog(pet.careLog)].slice(0, 30)
        };

        return {
            ok: true,
            students: nextStudents,
            history: nextHistory,
            domain: {
                ...normalizedDomain,
                pets: {
                    ...normalizedDomain.pets,
                    [key]: nextPet
                }
            }
        };
    };

    const hatchPet = ({ domain, studentId, student, nowTs }) => {
        const normalizedDomain = normalizePetDomain(domain);
        const key = String(studentId);
        const pet = normalizedDomain.pets[key];
        if (!pet) return { ok: false, message: '未找到宠物蛋' };
        if (pet.hatchedAt > 0 && pet.speciesId) return { ok: false, message: '该宠物已经孵化' };
        const species = pickSpeciesForStudent({
            id: `${studentId}_${nowTs}_${Math.random().toString(36).slice(2, 8)}`,
            name: student?.name || ''
        }) || SPECIES[0];
        if (!species) return { ok: false, message: '没有可用的宠物物种' };
        return {
            ok: true,
            domain: {
                ...normalizedDomain,
                pets: {
                    ...normalizedDomain.pets,
                    [key]: {
                        ...pet,
                        speciesId: species.id,
                        nickname: species.name,
                        hatchedAt: nowTs,
                        stage: 'young',
                        exp: 0,
                        level: 1,
                        happiness: INITIAL_PET_STATUS.happiness,
                        health: INITIAL_PET_STATUS.health,
                        energy: INITIAL_PET_STATUS.energy,
                        lastHistoryTs: 0,
                        lastAttendanceTs: 0
                    }
                }
            }
        };
    };

    const resetPetSystem = ({ students, nowTs }) => {
        const sourceStudents = Array.isArray(students) ? students : [];
        const pets = {};
        sourceStudents.forEach((student) => {
            const key = String(student?.id ?? '');
            if (!key) return;
            pets[key] = normalizePetRecord({}, student, nowTs);
        });
        return {
            version: 1,
            pets
        };
    };

    const getPetSpeciesById = (speciesId) => SPECIES_BY_ID[speciesId] || SPECIES[0] || null;

    window.ClassPetState = {
        INITIAL_PET_STATUS,
        SHOP_ITEMS,
        STAGE_THRESHOLDS,
        getStageLabel,
        normalizePetDomain,
        reconcilePetDomain,
        renamePet,
        purchasePetItem,
        hatchPet,
        resetPetSystem,
        getPetSpeciesById
    };
})();
