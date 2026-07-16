(function() {
    window.createClassManagerStore = function createClassManagerStore(deps) {
        const {
            useState,
            buildNormalizedStudentProfiles,
            resolveTreasuresData,
            normalizeExamArchives,
            getDefaultCommissioners,
            getTreasureGachaConfig,
            GUEST_ROSTER,
            initialTestSessionState,
            DEFAULT_QUOTES
        } = deps || {};

        if (
            !useState ||
            !buildNormalizedStudentProfiles ||
            !resolveTreasuresData ||
            !normalizeExamArchives ||
            !getDefaultCommissioners ||
            !getTreasureGachaConfig ||
            !GUEST_ROSTER ||
            !initialTestSessionState ||
            !DEFAULT_QUOTES
        ) {
            throw new Error('ClassManagerStore dependencies are missing');
        }

        const createInitialBattleState = () => ({
            version: 1,
            teams: [],
            squads: [],
            battles: [],
            logs: [],
            history: [],
            settlements: [],
            season: 1,
            rules: {},
            teamBaseExamId: '',
            settleExamId: ''
        });

        const createInitialConfig = () => ({
            duty: { mon: ['', ''], tue: [''], wed: [''], thu: [''], fri: [''] },
            commissioners: getDefaultCommissioners(),
            lastWageDate: '',
            frozen: false,
            scheduleNotes: {},
            countdownEvents: []
        });

        const createInitialModalState = () => ({
            open: false,
            title: '',
            content: null,
            onConfirm: null,
            type: 'info'
        });

        const getInitialModuleStatus = (factoryName) => (
            typeof window[factoryName] === 'function' ? 'ready' : 'idle'
        );

        const getInitialSettingsModuleStatus = () => (
            typeof window.createSettingsView === 'function' &&
            typeof window.createSettingsExamArchivesSection === 'function' &&
            typeof window.createSettingsStudentRosterSection === 'function' &&
            typeof window.createSettingsSystemConfigSection === 'function' &&
            typeof window.createSettingsToolsSection === 'function' &&
            typeof window.createSettingsBehaviorAlertSection === 'function'
                ? 'ready'
                : 'idle'
        );

        return function useClassManagerStore() {
            const [activeTab, setActiveTab] = useState(() => {
                try {
                    return sessionStorage.getItem('classmanager:pending-attendance') ? 'attendance' : 'dashboard';
                } catch (_) {
                    return 'dashboard';
                }
            });
            const [students, setStudents] = useState([]);
            const [studentProfiles, setStudentProfiles] = useState(() => buildNormalizedStudentProfiles());
            const [history, setHistory] = useState([]);
            const [attendanceRecords, setAttendanceRecords] = useState({});
            const [pets, setPets] = useState(() => ({ version: 1, pets: {} }));
            const [treasures, setTreasures] = useState(() => resolveTreasuresData(undefined, {}));
            const [storage, setStorage] = useState({});
            const [logs, setLogs] = useState([]);
            const [battle, setBattle] = useState(createInitialBattleState);
            const [examArchives, setExamArchives] = useState(() => normalizeExamArchives());
            const [quotes, setQuotes] = useState(() => DEFAULT_QUOTES);
            const [messages, setMessages] = useState([]);
            const [teacherMessages, setTeacherMessages] = useState([]);
            const [redemptionHistory, setRedemptionHistory] = useState({});
            const [dailyRedemptionCounts, setDailyRedemptionCounts] = useState({});
            const [dailyUsageCounts, setDailyUsageCounts] = useState({});
            const [liquidatedTreasures, setLiquidatedTreasures] = useState([]);
            const [tasks, setTasks] = useState([]);
            const [profileModuleStatus, setProfileModuleStatus] = useState(() => getInitialModuleStatus('createProfileView'));
            const [tasksModuleStatus, setTasksModuleStatus] = useState(() => getInitialModuleStatus('createTasksView'));
            const [battleModuleStatus, setBattleModuleStatus] = useState(() => getInitialModuleStatus('createBattleView'));
            const [petModuleStatus, setPetModuleStatus] = useState(() => getInitialModuleStatus('createPetView'));
            const [settingsModuleStatus, setSettingsModuleStatus] = useState(getInitialSettingsModuleStatus);
            const [testSessionId, setTestSessionId] = useState(initialTestSessionState.sessionId || '');
            const [testMode, setTestMode] = useState(Boolean(initialTestSessionState.sessionId));
            const [simTime, setSimTime] = useState(initialTestSessionState.simTimeMs || Date.now());
            const [timeSpeed, setTimeSpeed] = useState(initialTestSessionState.timeSpeed || 1);
            const [syncStatus, setSyncStatus] = useState('idle');
            const [localHydrationDone, setLocalHydrationDone] = useState(false);
            const [config, setConfig] = useState(createInitialConfig);
            const [modal, setModal] = useState(createInitialModalState);

            const displayStudents = (Array.isArray(students) && students.length > 0) ? students : GUEST_ROSTER;
            const effectiveTreasures = resolveTreasuresData(treasures, config);
            const treasureGachaConfig = getTreasureGachaConfig(config);

            return {
                activeTab,
                setActiveTab,
                students,
                setStudents,
                studentProfiles,
                setStudentProfiles,
                history,
                setHistory,
                attendanceRecords,
                setAttendanceRecords,
                pets,
                setPets,
                treasures,
                setTreasures,
                storage,
                setStorage,
                logs,
                setLogs,
                battle,
                setBattle,
                examArchives,
                setExamArchives,
                quotes,
                setQuotes,
                messages,
                setMessages,
                teacherMessages,
                setTeacherMessages,
                redemptionHistory,
                setRedemptionHistory,
                dailyRedemptionCounts,
                setDailyRedemptionCounts,
                dailyUsageCounts,
                setDailyUsageCounts,
                liquidatedTreasures,
                setLiquidatedTreasures,
                tasks,
                setTasks,
                profileModuleStatus,
                setProfileModuleStatus,
                tasksModuleStatus,
                setTasksModuleStatus,
                battleModuleStatus,
                setBattleModuleStatus,
                petModuleStatus,
                setPetModuleStatus,
                settingsModuleStatus,
                setSettingsModuleStatus,
                displayStudents,
                testSessionId,
                setTestSessionId,
                testMode,
                setTestMode,
                simTime,
                setSimTime,
                timeSpeed,
                setTimeSpeed,
                syncStatus,
                setSyncStatus,
                localHydrationDone,
                setLocalHydrationDone,
                config,
                setConfig,
                effectiveTreasures,
                treasureGachaConfig,
                modal,
                setModal
            };
        };
    };
})();
