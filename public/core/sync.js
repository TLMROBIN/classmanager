(function() {
    window.createClassManagerSync = function createClassManagerSync(deps) {
        const {
            useRef,
            useEffect,
            useCallback,
            getApiUrl,
            getNow,
            getStorageItem,
            setStorageItem,
            getTestRequestHeaders,
            handleTestSessionApiError,
            parseApiResponse,
            getAdminAuthHeaders,
            clearAdminAuth,
            clearScopedTestArtifacts,
            clearStoredTestSessionState,
            applyTestRuntimeContext,
            requestAttendanceJson,
            buildNormalizedStudentProfiles,
            hasStudentProfilesInData,
            restoreStudentProfilesFromData,
            sanitizeStoredConfig,
            normalizeExamArchives,
            resolveTreasuresData,
            getLegacyTreasureList,
            mergeAttendanceRecords,
            battleNormalize,
            protectTreasureDomain,
            DEFAULT_QUOTES,
            TEST_SESSION_INVALID_EVENT
        } = deps || {};

        if (
            !useRef ||
            !useEffect ||
            !useCallback ||
            !getApiUrl ||
            !getNow ||
            !getStorageItem ||
            !setStorageItem ||
            !getTestRequestHeaders ||
            !handleTestSessionApiError ||
            !parseApiResponse ||
            !getAdminAuthHeaders ||
            !clearAdminAuth ||
            !clearScopedTestArtifacts ||
            !clearStoredTestSessionState ||
            !applyTestRuntimeContext ||
            !requestAttendanceJson ||
            !buildNormalizedStudentProfiles ||
            !hasStudentProfilesInData ||
            !restoreStudentProfilesFromData ||
            !sanitizeStoredConfig ||
            !normalizeExamArchives ||
            !resolveTreasuresData ||
            !getLegacyTreasureList ||
            !mergeAttendanceRecords ||
            !battleNormalize ||
            !protectTreasureDomain ||
            !DEFAULT_QUOTES ||
            !TEST_SESSION_INVALID_EVENT
        ) {
            throw new Error('ClassManagerSync dependencies are missing');
        }

        const RETRY_CONNECT_MS = 10 * 60 * 1000;

        const buildMainAutosavePatch = (previousSnapshot, currentSnapshot) => {
            if (!previousSnapshot || !currentSnapshot) return null;

            const patch = {};
            const markChanged = (key) => {
                if (previousSnapshot[key] !== currentSnapshot[key]) {
                    patch[key] = currentSnapshot[key];
                }
            };

            if (previousSnapshot.students !== currentSnapshot.students) {
                patch.students = currentSnapshot.students;
            } else if (previousSnapshot.studentProfiles !== currentSnapshot.studentProfiles) {
                patch.studentProfiles = currentSnapshot.studentProfiles;
            }

            markChanged('history');
            markChanged('config');
            markChanged('treasures');
            markChanged('storage');
            markChanged('logs');
            markChanged('quotes');
            markChanged('messages');
            markChanged('teacherMessages');
            markChanged('redemptionHistory');
            markChanged('dailyRedemptionCounts');
            markChanged('dailyUsageCounts');
            markChanged('tasks');

            return Object.keys(patch).length > 0 ? patch : null;
        };

        return function useClassManagerSync(params) {
            const {
                students,
                studentProfiles,
                history,
                config,
                attendanceRecords,
                treasures,
                storage,
                logs,
                quotes,
                messages,
                teacherMessages,
                redemptionHistory,
                dailyRedemptionCounts,
                dailyUsageCounts,
                tasks,
                battle,
                examArchives,
                effectiveTreasures,
                setStudents,
                setStudentProfiles,
                setHistory,
                setConfig,
                setAttendanceRecords,
                setTreasures,
                setStorage,
                setLogs,
                setQuotes,
                setMessages,
                setTeacherMessages,
                setRedemptionHistory,
                setDailyRedemptionCounts,
                setDailyUsageCounts,
                setTasks,
                setBattle,
                setExamArchives,
                testMode,
                testSessionId,
                setTestSessionId,
                setTestMode,
                setSimTime,
                setTimeSpeed,
                timeSpeed,
                localHydrationDone,
                setLocalHydrationDone,
                setSyncStatus
            } = params || {};

            const isSavingRef = useRef(false);
            const isDirtyRef = useRef(false);
            const retryTimerRef = useRef(null);
            const serverMetaRef = useRef({ updatedAt: 0 });
            const initialServerSyncDoneRef = useRef(!getApiUrl());
            const skipMainAutosaveRef = useRef(false);
            const skipBattleAutosaveRef = useRef(false);
            const mainAutosaveSnapshotRef = useRef(null);
            const latestSyncStateRef = useRef({
                students: [],
                studentProfiles: buildNormalizedStudentProfiles(),
                history: [],
                config: {},
                attendanceRecords: {}
            });
            const previousTestContextRef = useRef({
                testMode,
                testSessionId
            });

            latestSyncStateRef.current = {
                students,
                studentProfiles,
                history,
                config,
                attendanceRecords
            };

            const getDeviceId = () => {
                const key = 'cm_device_id';
                let id = getStorageItem(key);
                if (!id) {
                    id = `${getNow().getTime()}_${Math.random().toString(36).slice(2, 10)}`;
                    setStorageItem(key, id);
                }
                return id;
            };

            const protectTreasureDomainForPersistence = useCallback((nextDomain, options = {}) => {
                return protectTreasureDomain(nextDomain, () => ({ treasures, storage, logs }), options);
            }, [treasures, storage, logs]);

            const markServerMeta = (updatedAt) => {
                const ts = Number(updatedAt) || 0;
                if (ts > 0) {
                    serverMetaRef.current = { updatedAt: ts };
                }
                initialServerSyncDoneRef.current = true;
            };

            const normalizeFullData = (data) => {
                const safe = data || {};
                return {
                    students: safe.students,
                    studentProfiles: buildNormalizedStudentProfiles(safe.studentProfiles, safe.students),
                    history: safe.history,
                    config: sanitizeStoredConfig(safe.config),
                    attendanceRecords: safe.attendanceRecords || safe.attendance_records,
                    treasures: safe.treasures,
                    storage: safe.storage,
                    logs: safe.logs,
                    quotes: safe.quotes,
                    messages: safe.messages,
                    teacherMessages: safe.teacherMessages,
                    redemptionHistory: safe.redemptionHistory,
                    dailyRedemptionCounts: safe.dailyRedemptionCounts,
                    dailyUsageCounts: safe.dailyUsageCounts,
                    tasks: safe.tasks,
                    battle: safe.battle,
                    examArchives: normalizeExamArchives(safe.examArchives, safe.battle),
                    __meta: safe.__meta || {},
                    flags: {
                        students: Object.prototype.hasOwnProperty.call(safe, 'students'),
                        studentProfiles: hasStudentProfilesInData(safe),
                        history: Object.prototype.hasOwnProperty.call(safe, 'history'),
                        config: Object.prototype.hasOwnProperty.call(safe, 'config'),
                        attendanceRecords: Object.prototype.hasOwnProperty.call(safe, 'attendanceRecords') || Object.prototype.hasOwnProperty.call(safe, 'attendance_records'),
                        treasures: Object.prototype.hasOwnProperty.call(safe, 'treasures'),
                        storage: Object.prototype.hasOwnProperty.call(safe, 'storage'),
                        logs: Object.prototype.hasOwnProperty.call(safe, 'logs'),
                        quotes: Object.prototype.hasOwnProperty.call(safe, 'quotes'),
                        messages: Object.prototype.hasOwnProperty.call(safe, 'messages'),
                        teacherMessages: Object.prototype.hasOwnProperty.call(safe, 'teacherMessages'),
                        redemptionHistory: Object.prototype.hasOwnProperty.call(safe, 'redemptionHistory'),
                        dailyRedemptionCounts: Object.prototype.hasOwnProperty.call(safe, 'dailyRedemptionCounts'),
                        dailyUsageCounts: Object.prototype.hasOwnProperty.call(safe, 'dailyUsageCounts'),
                        tasks: Object.prototype.hasOwnProperty.call(safe, 'tasks'),
                        battle: Object.prototype.hasOwnProperty.call(safe, 'battle'),
                        examArchives: Object.prototype.hasOwnProperty.call(safe, 'examArchives') || !!(safe.battle && Array.isArray(safe.battle.exams))
                    }
                };
            };

            const applyFullData = (data, options = {}, baseState = null) => {
                const normalized = normalizeFullData(data);
                const latestState = baseState || latestSyncStateRef.current || {};
                const latestStudents = Array.isArray(latestState.students) ? latestState.students : students;
                const latestStudentProfiles = latestState.studentProfiles || studentProfiles;
                const latestHistory = Array.isArray(latestState.history) ? latestState.history : history;
                const latestConfig = latestState.config || config;
                const latestAttendanceRecords = latestState.attendanceRecords || attendanceRecords;
                const use = (flag) => options.force || flag;
                const incomingTreasures = resolveTreasuresData(normalized.treasures, normalized.config || latestConfig);
                const hasIncomingLegacyTreasureConfig = Array.isArray(getLegacyTreasureList(normalized.config));

                if (use(normalized.flags.students)) setStudents(normalized.students || []);
                if (use(normalized.flags.studentProfiles)) setStudentProfiles(restoreStudentProfilesFromData(normalized, latestStudentProfiles, latestStudents));
                if (use(normalized.flags.history)) {
                    const incomingHistory = normalized.history || [];
                    const hasLocalHistory = Array.isArray(latestHistory) && latestHistory.length > 0;
                    const hasIncomingHistory = Array.isArray(incomingHistory) && incomingHistory.length > 0;
                    const keepLocal = !options.force && hasLocalHistory && !hasIncomingHistory;
                    if (!keepLocal) setHistory(incomingHistory);
                }
                if (use(normalized.flags.config)) setConfig(sanitizeStoredConfig(normalized.config || {}));

                if (use(normalized.flags.attendanceRecords)) {
                    const att = options.mergeAttendance
                        ? mergeAttendanceRecords(latestAttendanceRecords || {}, normalized.attendanceRecords || {})
                        : (normalized.attendanceRecords || {});
                    setAttendanceRecords(att);
                }

                if (use(normalized.flags.treasures) || hasIncomingLegacyTreasureConfig) {
                    setTreasures(Array.isArray(incomingTreasures) ? incomingTreasures : []);
                }
                if (use(normalized.flags.storage)) setStorage(normalized.storage || {});
                if (use(normalized.flags.logs)) setLogs(normalized.logs || []);
                if (use(normalized.flags.quotes)) setQuotes(normalized.quotes && normalized.quotes.length > 0 ? normalized.quotes : DEFAULT_QUOTES);
                if (use(normalized.flags.messages)) setMessages(normalized.messages || []);
                if (use(normalized.flags.teacherMessages)) setTeacherMessages(normalized.teacherMessages || []);
                if (use(normalized.flags.redemptionHistory)) setRedemptionHistory(normalized.redemptionHistory || {});
                if (use(normalized.flags.dailyRedemptionCounts)) setDailyRedemptionCounts(normalized.dailyRedemptionCounts || {});
                if (use(normalized.flags.dailyUsageCounts)) setDailyUsageCounts(normalized.dailyUsageCounts || {});
                if (use(normalized.flags.tasks)) setTasks(normalized.tasks || []);
                if (use(normalized.flags.battle)) setBattle(battleNormalize(normalized.battle || {}));
                if (use(normalized.flags.examArchives)) setExamArchives(normalizeExamArchives(normalized.examArchives, normalized.battle));
            };

            const applyAttendanceServerPayload = useCallback((data, options = {}) => {
                const safe = data || {};
                const updatedAt = Number(safe.updatedAt) || Number(safe.__meta?.updatedAt) || 0;
                if (updatedAt > 0) markServerMeta(updatedAt);
                const partial = {};
                if (Object.prototype.hasOwnProperty.call(safe, 'attendanceRecords')) partial.attendanceRecords = safe.attendanceRecords;
                if (Object.prototype.hasOwnProperty.call(safe, 'students')) partial.students = safe.students;
                if (Object.prototype.hasOwnProperty.call(safe, 'history')) partial.history = safe.history;
                if (Object.prototype.hasOwnProperty.call(partial, 'students') || Object.prototype.hasOwnProperty.call(partial, 'history')) {
                    skipMainAutosaveRef.current = true;
                }
                applyFullData(partial, {
                    mergeAttendance: options.mergeAttendance === true
                }, latestSyncStateRef.current);
                setSyncStatus('saved');
            }, [setSyncStatus]);

            const enterTestMode = useCallback(async () => {
                if (testMode) return;
                if (!getApiUrl()) {
                    alert('当前环境无法启用真测试模式。');
                    return;
                }
                try {
                    const nowTs = getNow().getTime();
                    const res = await fetch('/api/test-sessions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...window.__getAuthHeaders__()
                        },
                        body: JSON.stringify({
                            simTimeMs: nowTs,
                            timeSpeed: 1
                        })
                    });
                    const { data } = await parseApiResponse(res);
                    if (window.__handleAuthError__(res)) return;
                    if (!res.ok) {
                        throw new Error(data?.error || '进入测试模式失败');
                    }
                    setTestSessionId(data?.sessionId || '');
                    setTestMode(true);
                    setSimTime(Number.isFinite(Number(data?.simTimeMs)) ? Number(data.simTimeMs) : nowTs);
                    setTimeSpeed(Number(data?.timeSpeed) > 0 ? Number(data.timeSpeed) : 1);
                    setSyncStatus('saved');
                } catch (error) {
                    console.error('进入测试模式失败:', error);
                    alert(error.message || '进入测试模式失败');
                }
            }, [testMode, setTestSessionId, setTestMode, setSimTime, setTimeSpeed, setSyncStatus]);

            const exitTestMode = useCallback(async () => {
                if (!testMode || !testSessionId) return;
                try {
                    const res = await fetch(`/api/test-sessions/${encodeURIComponent(testSessionId)}`, {
                        method: 'DELETE',
                        headers: {
                            ...window.__getAuthHeaders__(),
                            ...getTestRequestHeaders()
                        }
                    });
                    const { data } = await parseApiResponse(res);
                    if (window.__handleAuthError__(res)) return;
                    if (!res.ok && res.status !== 404) {
                        throw new Error(data?.error || '退出测试模式失败');
                    }
                    clearAdminAuth();
                    clearScopedTestArtifacts(testSessionId);
                    clearStoredTestSessionState();
                    applyTestRuntimeContext({ enabled: false });
                    setTestSessionId('');
                    setTestMode(false);
                    setSimTime(Date.now());
                    setTimeSpeed(1);
                    setSyncStatus('saved');
                } catch (error) {
                    console.error('退出测试模式失败:', error);
                    alert(error.message || '退出测试模式失败');
                }
            }, [testMode, testSessionId, setTestSessionId, setTestMode, setSimTime, setTimeSpeed, setSyncStatus]);

            const buildCurrentFullData = useCallback((overrides = {}) => {
                const nextStudents = Object.prototype.hasOwnProperty.call(overrides, 'students') ? overrides.students : students;
                const nextStudentProfiles = restoreStudentProfilesFromData(overrides, studentProfiles, nextStudents);
                const rawNextConfig = Object.prototype.hasOwnProperty.call(overrides, 'config') ? overrides.config : config;
                const nextConfig = sanitizeStoredConfig(rawNextConfig);
                const migratedTreasures = resolveTreasuresData(undefined, rawNextConfig);
                const nextTreasures = Object.prototype.hasOwnProperty.call(overrides, 'treasures')
                    ? overrides.treasures
                    : (Array.isArray(getLegacyTreasureList(rawNextConfig)) ? migratedTreasures : effectiveTreasures);
                return {
                    history,
                    storage,
                    logs,
                    quotes,
                    messages,
                    teacherMessages,
                    redemptionHistory,
                    dailyRedemptionCounts,
                    dailyUsageCounts,
                    tasks,
                    battle,
                    examArchives,
                    ...overrides,
                    config: nextConfig,
                    treasures: Array.isArray(nextTreasures) ? nextTreasures : effectiveTreasures,
                    students: nextStudents,
                    studentProfiles: nextStudentProfiles
                };
            }, [students, studentProfiles, history, config, effectiveTreasures, storage, logs, quotes, messages, teacherMessages, redemptionHistory, dailyRedemptionCounts, dailyUsageCounts, tasks, battle, examArchives]);

            const fetchFromServerCore = useCallback(async (options = {}) => {
                const normalizedOptions = typeof options === 'boolean' ? { isAuto: options } : (options || {});
                const {
                    isAuto = false,
                    allowDirtyOverride = false,
                    successAlert,
                    emptyAlert,
                    errorAlert
                } = normalizedOptions;

                const apiUrl = getApiUrl();
                if (!apiUrl) {
                    if (!isAuto && errorAlert !== false) {
                        console.warn('Manual refresh ignored: unsupported runtime environment.');
                        alert(typeof errorAlert === 'string' ? errorAlert : '当前环境无法连接服务器。');
                    }
                    return Promise.resolve({ skipped: true, reason: 'unsupported-runtime' });
                }
                if (!allowDirtyOverride && isAuto && (isSavingRef.current || isDirtyRef.current)) {
                    console.log('[自动刷新] 跳过：存在未保存更改或正在保存');
                    return Promise.resolve({ skipped: true, reason: 'dirty' });
                }
                if (!allowDirtyOverride && !isAuto && (isSavingRef.current || isDirtyRef.current)) {
                    alert('当前存在未保存更改，已阻止同步覆盖，请稍后再刷新。');
                    return Promise.resolve({ skipped: true, reason: 'dirty' });
                }
                if (allowDirtyOverride && (isSavingRef.current || isDirtyRef.current)) {
                    console.warn('[冲突恢复] 将使用服务器最新数据覆盖本地未保存更改');
                }

                if (!isAuto) setSyncStatus('unsaved');

                try {
                    const res = await fetch(apiUrl, {
                        headers: {
                            ...window.__getAuthHeaders__(),
                            ...getTestRequestHeaders()
                        }
                    });
                    const { data, text } = await parseApiResponse(res);
                    if (window.__handleAuthError__(res)) return { skipped: true, reason: 'auth' };
                    if (handleTestSessionApiError(res, data)) {
                        return { skipped: true, reason: 'test-session-invalid' };
                    }
                    if (!res.ok) {
                        throw new Error(data?.error || text || '刷新失败');
                    }
                    if (data && Object.keys(data).length > 0) {
                        const normalized = normalizeFullData(data);
                        const remoteTs = Number(normalized.__meta.updatedAt) || 0;
                        markServerMeta(remoteTs);
                        skipMainAutosaveRef.current = true;
                        skipBattleAutosaveRef.current = true;
                        applyFullData(data, {
                            mergeAttendance: true,
                            force: allowDirtyOverride
                        }, latestSyncStateRef.current);
                        setSyncStatus('success');
                        if (typeof successAlert === 'string' && successAlert) {
                            alert(successAlert);
                        } else if (!isAuto && successAlert !== false) {
                            alert('数据已从服务器刷新！');
                        }
                        console.log(`[${getNow().toLocaleTimeString()}] 数据同步完成`);
                        if (retryTimerRef.current) {
                            clearTimeout(retryTimerRef.current);
                            retryTimerRef.current = null;
                        }
                        return { success: true, updatedAt: remoteTs };
                    }
                    initialServerSyncDoneRef.current = true;
                    if (typeof emptyAlert === 'string' && emptyAlert) {
                        alert(emptyAlert);
                    } else if (!isAuto && emptyAlert !== false) {
                        alert('服务器无数据或数据为空。');
                    }
                    return { success: true, empty: true };
                } catch (err) {
                    if (err?.message === 'TEST_SESSION_INVALID') {
                        return { skipped: true, reason: 'test-session-invalid' };
                    }
                    console.error('Server fetch failed', err);
                    setSyncStatus('error');
                    if (typeof errorAlert === 'string' && errorAlert) {
                        alert(errorAlert);
                    } else if (!isAuto && errorAlert !== false) {
                        alert('刷新失败，无法连接到服务器。');
                    }
                    if (!retryTimerRef.current) {
                        retryTimerRef.current = setTimeout(() => {
                            retryTimerRef.current = null;
                            fetchFromServerCore(true);
                        }, RETRY_CONNECT_MS);
                    }
                    throw err;
                }
            }, []);

            const savePayloadToServer = useCallback(async (payload, nowTs) => {
                const apiUrl = getApiUrl();
                if (!apiUrl) {
                    setSyncStatus('error');
                    isSavingRef.current = false;
                    throw new Error('SERVER_UNAVAILABLE');
                }
                try {
                    const res = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...window.__getAuthHeaders__(),
                            ...getTestRequestHeaders(),
                            ...getAdminAuthHeaders()
                        },
                        body: JSON.stringify(payload)
                    });
                    const { data } = await parseApiResponse(res);
                    if (window.__handleAuthError__(res)) return null;
                    if (handleTestSessionApiError(res, data)) {
                        throw new Error(data?.code || 'TEST_SESSION_INVALID');
                    }
                    if (res.status === 409) {
                        const serverUpdatedAt = Number(data?.serverUpdatedAt) || 0;
                        if (serverUpdatedAt > 0) serverMetaRef.current = { updatedAt: serverUpdatedAt };
                        isSavingRef.current = false;
                        try {
                            const refreshResult = await fetchFromServerCore({
                                isAuto: true,
                                allowDirtyOverride: true,
                                successAlert: false,
                                emptyAlert: false,
                                errorAlert: false
                            });
                            if (!refreshResult || refreshResult.skipped) {
                                throw new Error('CONFLICT_REFRESH_SKIPPED');
                            }
                            alert('服务器数据已自动刷新，请基于最新数据重新操作后再保存。');
                        } catch (refreshErr) {
                            setSyncStatus('error');
                            console.error('冲突后自动刷新失败', refreshErr);
                            alert('检测到其他浏览器或标签页已更新服务器数据，且自动刷新失败，请手动刷新后再保存。');
                        }
                        throw new Error('DATA_CONFLICT');
                    }
                    if (res.status === 403 && data?.code === 'MAINTENANCE_AUTH_REQUIRED') {
                        clearAdminAuth();
                        throw new Error(data?.error || '当前操作需要重新验证维护密码');
                    }
                    if (!res.ok) {
                        throw new Error(data?.error || '保存失败');
                    }
                    const savedUpdatedAt = Number(data?.updatedAt) || nowTs;
                    markServerMeta(savedUpdatedAt);
                    setSyncStatus('saved');
                    isSavingRef.current = false;
                    return { success: true, updatedAt: savedUpdatedAt };
                } catch (err) {
                    if (err?.message === 'DATA_CONFLICT') throw err;
                    if (err?.message === 'TEST_SESSION_INVALID' || err?.message === 'TEST_SESSION_EXPIRED') {
                        isSavingRef.current = false;
                        return { skipped: true, reason: 'test-session-invalid' };
                    }
                    setSyncStatus('unsaved');
                    isSavingRef.current = false;
                    throw err;
                }
            }, [fetchFromServerCore, setSyncStatus]);

            const persistDataPatch = useCallback((partialData, options = {}) => {
                const suppressFollowupAutoSave = options?.suppressFollowupAutoSave === true;
                if (suppressFollowupAutoSave && partialData && typeof partialData === 'object') {
                    if (
                        Object.prototype.hasOwnProperty.call(partialData, 'battle') ||
                        Object.prototype.hasOwnProperty.call(partialData, 'examArchives')
                    ) {
                        skipBattleAutosaveRef.current = true;
                    }
                    if (
                        Object.keys(partialData).some(key => key !== 'battle' && key !== 'examArchives')
                    ) {
                        skipMainAutosaveRef.current = true;
                    }
                }
                isSavingRef.current = true;
                const nowTs = getNow().getTime();
                const fullData = buildCurrentFullData(partialData || {});
                const normalizedInput = normalizeFullData(fullData);
                const safeTreasureDomain = protectTreasureDomainForPersistence({
                    treasures: fullData?.treasures,
                    storage: fullData?.storage,
                    logs: fullData?.logs
                });
                const nextStudentProfiles = restoreStudentProfilesFromData(fullData, studentProfiles, fullData?.students || students);
                const hasExplicitExamArchives = !!(partialData && Object.prototype.hasOwnProperty.call(partialData, 'examArchives'));
                const incomingExamArchives = normalizeExamArchives(fullData?.examArchives || examArchives, normalizedInput.battle || battle);
                const currentExamArchives = normalizeExamArchives(examArchives, battle);
                const allowEmptyExamArchives = hasExplicitExamArchives &&
                    Array.isArray(incomingExamArchives.exams) &&
                    incomingExamArchives.exams.length === 0;
                const protectedExamArchives = (
                    !allowEmptyExamArchives &&
                    Array.isArray(incomingExamArchives.exams) &&
                    incomingExamArchives.exams.length === 0 &&
                    Array.isArray(currentExamArchives.exams) &&
                    currentExamArchives.exams.length > 0
                ) ? currentExamArchives : incomingExamArchives;
                const fullDataWithMeta = {
                    ...fullData,
                    config: sanitizeStoredConfig(fullData?.config),
                    treasures: safeTreasureDomain.treasures,
                    storage: safeTreasureDomain.storage,
                    logs: safeTreasureDomain.logs,
                    studentProfiles: nextStudentProfiles,
                    battle: normalizedInput.battle,
                    examArchives: protectedExamArchives,
                    __meta: {
                        updatedAt: nowTs,
                        baseUpdatedAt: Number(serverMetaRef.current.updatedAt) || 0,
                        deviceId: getDeviceId(),
                        allowEmptyExamArchives
                    }
                };
                const payload = { ...partialData, __meta: fullDataWithMeta.__meta };
                if (partialData && Object.prototype.hasOwnProperty.call(partialData, 'students')) {
                    payload.students = fullDataWithMeta.students;
                    payload.studentProfiles = fullDataWithMeta.studentProfiles;
                } else if (partialData && Object.prototype.hasOwnProperty.call(partialData, 'studentProfiles')) {
                    payload.studentProfiles = fullDataWithMeta.studentProfiles;
                }
                if (partialData && Object.prototype.hasOwnProperty.call(partialData, 'config')) {
                    payload.config = sanitizeStoredConfig(partialData.config);
                }
                if (partialData && Object.prototype.hasOwnProperty.call(partialData, 'treasures')) {
                    payload.treasures = safeTreasureDomain.treasures;
                }
                if (partialData && Object.prototype.hasOwnProperty.call(partialData, 'storage')) {
                    payload.storage = safeTreasureDomain.storage;
                }
                if (partialData && Object.prototype.hasOwnProperty.call(partialData, 'logs')) {
                    payload.logs = safeTreasureDomain.logs;
                }
                if (partialData && Object.prototype.hasOwnProperty.call(partialData, 'battle')) {
                    payload.battle = fullDataWithMeta.battle;
                }
                if (partialData && Object.prototype.hasOwnProperty.call(partialData, 'examArchives')) {
                    payload.examArchives = fullDataWithMeta.examArchives;
                }
                return savePayloadToServer(payload, nowTs);
            }, [buildCurrentFullData, students, studentProfiles, battle, examArchives, savePayloadToServer, protectTreasureDomainForPersistence]);

            const persistData = useCallback((fullData) => {
                isSavingRef.current = true;
                const nowTs = getNow().getTime();
                const normalizedInput = normalizeFullData(fullData);
                const safeTreasureDomain = protectTreasureDomainForPersistence({
                    treasures: fullData?.treasures,
                    storage: fullData?.storage,
                    logs: fullData?.logs
                });
                const nextStudentProfiles = restoreStudentProfilesFromData(fullData, studentProfiles, fullData?.students || students);
                const hasExplicitExamArchives = !!(fullData && Object.prototype.hasOwnProperty.call(fullData, 'examArchives'));
                const incomingExamArchives = normalizeExamArchives(fullData?.examArchives || examArchives, normalizedInput.battle || battle);
                const currentExamArchives = normalizeExamArchives(examArchives, battle);
                const allowEmptyExamArchives = hasExplicitExamArchives &&
                    Array.isArray(incomingExamArchives.exams) &&
                    incomingExamArchives.exams.length === 0;
                const protectedExamArchives = (
                    !allowEmptyExamArchives &&
                    Array.isArray(incomingExamArchives.exams) &&
                    incomingExamArchives.exams.length === 0 &&
                    Array.isArray(currentExamArchives.exams) &&
                    currentExamArchives.exams.length > 0
                ) ? currentExamArchives : incomingExamArchives;
                const fullDataWithMeta = {
                    ...fullData,
                    config: sanitizeStoredConfig(fullData?.config),
                    treasures: safeTreasureDomain.treasures,
                    storage: safeTreasureDomain.storage,
                    logs: safeTreasureDomain.logs,
                    studentProfiles: nextStudentProfiles,
                    battle: normalizedInput.battle,
                    examArchives: protectedExamArchives,
                    __meta: {
                        updatedAt: nowTs,
                        baseUpdatedAt: Number(serverMetaRef.current.updatedAt) || 0,
                        deviceId: getDeviceId(),
                        allowEmptyExamArchives
                    }
                };
                return savePayloadToServer(fullDataWithMeta, nowTs);
            }, [students, studentProfiles, battle, examArchives, savePayloadToServer, protectTreasureDomainForPersistence]);

            const fetchFromServer = useCallback((options = {}) => {
                return fetchFromServerCore(options);
            }, [fetchFromServerCore]);

            const persistManagedPatch = useCallback((partialData) => (
                persistDataPatch(partialData, {
                    suppressFollowupAutoSave: true
                })
            ), [persistDataPatch]);

            const fetchAttendanceData = useCallback(async (options = {}) => {
                const {
                    silent = true
                } = options || {};
                try {
                    const data = await requestAttendanceJson('/api/attendance');
                    applyAttendanceServerPayload(data, { mergeAttendance: false });
                    return data;
                } catch (error) {
                    console.error('读取考勤接口失败:', error);
                    if (!silent && error?.code !== 'AUTH_REQUIRED') {
                        alert(error?.message || '读取考勤失败');
                    }
                    throw error;
                }
            }, [applyAttendanceServerPayload]);

            const handleAttendanceCheckIn = useCallback(async (studentName) => {
                const data = await requestAttendanceJson('/api/attendance/check-in', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentName })
                });
                applyAttendanceServerPayload(data, { mergeAttendance: false });
                return data;
            }, [applyAttendanceServerPayload]);

            const handleAttendanceMaintenance = useCallback(async (action, items) => {
                const data = await requestAttendanceJson('/api/attendance/maintenance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, items }),
                    includeMaintenanceAuth: true
                });
                applyAttendanceServerPayload(data, { mergeAttendance: false });
                return data;
            }, [applyAttendanceServerPayload]);

            useEffect(() => {
                const handleInvalidTestSession = (event) => {
                    clearScopedTestArtifacts(event?.detail?.sessionId || testSessionId);
                    applyTestRuntimeContext({ enabled: false });
                    setTestSessionId('');
                    setTestMode(false);
                    setSimTime(Date.now());
                    setTimeSpeed(1);
                    setSyncStatus('saved');
                    const message = event?.detail?.message;
                    if (message) {
                        setTimeout(() => alert(message), 0);
                    }
                };
                window.addEventListener(TEST_SESSION_INVALID_EVENT, handleInvalidTestSession);
                return () => {
                    window.removeEventListener(TEST_SESSION_INVALID_EVENT, handleInvalidTestSession);
                };
            }, [testSessionId, setTestSessionId, setTestMode, setSimTime, setTimeSpeed, setSyncStatus]);

            useEffect(() => {
                const prev = previousTestContextRef.current;
                const changed = prev.testMode !== testMode || prev.testSessionId !== testSessionId;
                previousTestContextRef.current = {
                    testMode,
                    testSessionId
                };
                if (!localHydrationDone || !changed) return;

                serverMetaRef.current = { updatedAt: 0 };
                initialServerSyncDoneRef.current = false;
                isDirtyRef.current = false;
                isSavingRef.current = false;
                fetchFromServer({
                    isAuto: true,
                    allowDirtyOverride: true,
                    successAlert: false,
                    emptyAlert: false,
                    errorAlert: false
                }).catch(() => {});
            }, [localHydrationDone, testMode, testSessionId, fetchFromServer]);

            useEffect(() => {
                try {
                    localStorage.removeItem('class_manager_snapshots');
                    localStorage.removeItem('class_manager_snapshot_last_date');
                    localStorage.removeItem('cm_battle_snapshots_v1');
                } catch (_) {}
                setLocalHydrationDone(true);
                fetchFromServer(true);

                const interval = setInterval(() => {
                    fetchFromServer(true);
                }, 10 * 60 * 1000);

                const onFocus = () => fetchFromServer(true);
                const onVisibilityChange = () => {
                    if (document.visibilityState === 'visible') onFocus();
                };
                window.addEventListener('focus', onFocus);
                document.addEventListener('visibilitychange', onVisibilityChange);

                return () => {
                    clearInterval(interval);
                    window.removeEventListener('focus', onFocus);
                    document.removeEventListener('visibilitychange', onVisibilityChange);
                };
            }, [fetchFromServer, setLocalHydrationDone]);

            useEffect(() => {
                if (!localHydrationDone) return undefined;

                fetchAttendanceData({ silent: true }).catch(() => {});

                const interval = setInterval(() => {
                    fetchAttendanceData({ silent: true }).catch(() => {});
                }, testMode ? 5000 : 30000);

                const onFocus = () => {
                    fetchAttendanceData({ silent: true }).catch(() => {});
                };
                const onVisibilityChange = () => {
                    if (document.visibilityState === 'visible') onFocus();
                };

                window.addEventListener('focus', onFocus);
                document.addEventListener('visibilitychange', onVisibilityChange);

                return () => {
                    clearInterval(interval);
                    window.removeEventListener('focus', onFocus);
                    document.removeEventListener('visibilitychange', onVisibilityChange);
                };
            }, [localHydrationDone, testMode, testSessionId, fetchAttendanceData]);

            useEffect(() => {
                if (!localHydrationDone) return undefined;
                const currentMainAutosaveSnapshot = {
                    students,
                    studentProfiles,
                    history,
                    config,
                    treasures,
                    storage,
                    logs,
                    quotes,
                    messages,
                    teacherMessages,
                    redemptionHistory,
                    dailyRedemptionCounts,
                    dailyUsageCounts,
                    tasks
                };
                if (!mainAutosaveSnapshotRef.current) {
                    mainAutosaveSnapshotRef.current = currentMainAutosaveSnapshot;
                    return undefined;
                }
                if (skipMainAutosaveRef.current) {
                    skipMainAutosaveRef.current = false;
                    mainAutosaveSnapshotRef.current = currentMainAutosaveSnapshot;
                    isDirtyRef.current = false;
                    return undefined;
                }
                const patch = buildMainAutosavePatch(mainAutosaveSnapshotRef.current, currentMainAutosaveSnapshot);
                mainAutosaveSnapshotRef.current = currentMainAutosaveSnapshot;
                if (!patch) {
                    isDirtyRef.current = false;
                    return undefined;
                }
                isDirtyRef.current = true;

                if (getApiUrl() && !initialServerSyncDoneRef.current) {
                    isDirtyRef.current = false;
                    return undefined;
                }

                const saveData = () => {
                    persistDataPatch(patch).then(() => {
                        isDirtyRef.current = false;
                    }).catch(() => {
                        isDirtyRef.current = false;
                    });
                };

                const timer = setTimeout(saveData, 1500);
                return () => clearTimeout(timer);
            }, [localHydrationDone, students, studentProfiles, history, config, treasures, storage, logs, quotes, messages, teacherMessages, redemptionHistory, dailyRedemptionCounts, dailyUsageCounts, tasks, persistDataPatch]);

            useEffect(() => {
                if (!localHydrationDone) return undefined;
                if (skipBattleAutosaveRef.current) {
                    skipBattleAutosaveRef.current = false;
                    isDirtyRef.current = false;
                    return undefined;
                }
                isDirtyRef.current = true;

                if (getApiUrl() && !initialServerSyncDoneRef.current) {
                    isDirtyRef.current = false;
                    return undefined;
                }

                const saveBattleDomain = () => {
                    persistDataPatch({
                        battle,
                        examArchives
                    }).then(() => {
                        isDirtyRef.current = false;
                    }).catch(() => {
                        isDirtyRef.current = false;
                    });
                };

                const timer = setTimeout(saveBattleDomain, 1200);
                return () => clearTimeout(timer);
            }, [localHydrationDone, battle, examArchives, persistDataPatch]);

            return {
                isDirtyRef,
                enterTestMode,
                exitTestMode,
                persistData,
                persistDataPatch,
                persistManagedPatch,
                handleAttendanceCheckIn,
                handleAttendanceMaintenance
            };
        };
    };
})();
