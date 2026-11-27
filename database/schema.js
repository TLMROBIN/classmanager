const path = require('path');

const DEFAULT_DB_PATH = path.join(__dirname, 'classmanager.db');
const resolveConfiguredPath = (configuredPath, fallbackPath) => {
    if (!configuredPath) return fallbackPath;
    return path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(process.cwd(), configuredPath);
};

const dbPath = resolveConfiguredPath(process.env.CLASSMANAGER_DB_PATH, DEFAULT_DB_PATH);

const LEGACY_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    );

    CREATE TABLE IF NOT EXISTS class_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        data_key TEXT NOT NULL,
        data_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, data_key)
    );

    CREATE INDEX IF NOT EXISTS idx_class_data_user ON class_data(user_id);
    CREATE INDEX IF NOT EXISTS idx_class_data_key ON class_data(user_id, data_key);

    CREATE TABLE IF NOT EXISTS maintenance_credentials (
        user_id INTEGER PRIMARY KEY,
        password_hash TEXT NOT NULL,
        migrated_from_legacy INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS test_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        sim_time_ms INTEGER,
        time_speed REAL NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_test_sessions_user ON test_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_test_sessions_expires ON test_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS test_class_data (
        session_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        data_key TEXT NOT NULL,
        data_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id, user_id, data_key),
        FOREIGN KEY (session_id) REFERENCES test_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_test_class_data_session_user ON test_class_data(session_id, user_id);

    CREATE TABLE IF NOT EXISTS test_maintenance_credentials (
        session_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        password_hash TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id, user_id),
        FOREIGN KEY (session_id) REFERENCES test_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`;

const V2_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS deployment_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        mode TEXT NOT NULL DEFAULT 'personal',
        school_name TEXT,
        official_market_url TEXT,
        settings_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS school_class_catalog (
        catalog_code TEXT PRIMARY KEY,
        grade_name TEXT NOT NULL,
        class_name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        catalog_code TEXT UNIQUE,
        title TEXT NOT NULL,
        grade_label TEXT,
        owner_teacher_id INTEGER NOT NULL,
        tablet_session_mode TEXT NOT NULL DEFAULT 'personal',
        kiosk_playlist_json TEXT NOT NULL DEFAULT '[]',
        config_json TEXT NOT NULL DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_classes_owner ON classes(owner_teacher_id);

    CREATE TABLE IF NOT EXISTS class_teachers (
        class_id TEXT NOT NULL,
        teacher_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        permissions_json TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (class_id, teacher_id),
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS school_staff_roles (
        teacher_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        scope_json TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (teacher_id, role),
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_accounts (
        id TEXT PRIMARY KEY,
        student_no TEXT UNIQUE,
        sso_uid TEXT UNIQUE,
        name TEXT NOT NULL,
        pin_hash TEXT,
        must_change_pin INTEGER NOT NULL DEFAULT 1,
        last_sso_catalog_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS class_enrollments (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL,
        student_account_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        seat_or_no TEXT,
        group_id TEXT,
        dorm_id TEXT,
        zizai REAL NOT NULL DEFAULT 0,
        penalty REAL NOT NULL DEFAULT 0,
        balance REAL NOT NULL DEFAULT 0,
        profile_json TEXT NOT NULL DEFAULT '{}',
        avatar_json TEXT NOT NULL DEFAULT '{}',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        archived_at DATETIME,
        UNIQUE (class_id, student_account_id),
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
        FOREIGN KEY (student_account_id) REFERENCES student_accounts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_status ON class_enrollments(class_id, status);

    CREATE TABLE IF NOT EXISTS class_roles (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL,
        name TEXT NOT NULL,
        approval_required INTEGER NOT NULL DEFAULT 0,
        capabilities_json TEXT NOT NULL,
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS enrollment_roles (
        enrollment_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        PRIMARY KEY (enrollment_id, role_id),
        FOREIGN KEY (enrollment_id) REFERENCES class_enrollments(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES class_roles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS kiosk_devices (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        last_seen_at DATETIME,
        revoked_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS point_ledger (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL,
        enrollment_id TEXT NOT NULL,
        delta_zizai REAL NOT NULL DEFAULT 0,
        delta_penalty REAL NOT NULL DEFAULT 0,
        delta_balance REAL NOT NULL DEFAULT 0,
        scene TEXT NOT NULL,
        category TEXT NOT NULL,
        sub_category TEXT,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'applied',
        operator_type TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        operator_label TEXT NOT NULL,
        source_plugin_id TEXT NOT NULL DEFAULT 'core',
        idempotency_key TEXT UNIQUE,
        reverted_by_id TEXT,
        event_ts_ms INTEGER NOT NULL DEFAULT 0,
        seq INTEGER NOT NULL DEFAULT 0,
        meta_json TEXT NOT NULL DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
        FOREIGN KEY (enrollment_id) REFERENCES class_enrollments(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_point_ledger_class_status_seq ON point_ledger(class_id, status, seq DESC);
    CREATE INDEX IF NOT EXISTS idx_point_ledger_enrollment ON point_ledger(class_id, enrollment_id);

    CREATE TABLE IF NOT EXISTS exam_archives (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL,
        exam_key TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        exam_date TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (class_id, exam_key),
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_exam_archives_class ON exam_archives(class_id, sort_order);

    CREATE TABLE IF NOT EXISTS exam_scores (
        exam_archive_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        enrollment_id TEXT NOT NULL,
        student_key TEXT NOT NULL,
        scores_json TEXT NOT NULL DEFAULT '{}',
        legacy_rank_json TEXT,
        PRIMARY KEY (exam_archive_id, student_key),
        FOREIGN KEY (exam_archive_id) REFERENCES exam_archives(id) ON DELETE CASCADE,
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_exam_scores_class_enrollment ON exam_scores(class_id, enrollment_id);

    CREATE TABLE IF NOT EXISTS plugin_packages (
        plugin_id TEXT NOT NULL,
        version TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'local',
        visibility TEXT NOT NULL DEFAULT 'private',
        featured INTEGER NOT NULL DEFAULT 0,
        author_teacher_id INTEGER,
        author_name TEXT,
        maintainer_name TEXT,
        maintenance_status TEXT NOT NULL DEFAULT 'active',
        kernel_compat TEXT NOT NULL DEFAULT 'cm-plugin/v1',
        signature TEXT,
        manifest_json TEXT NOT NULL,
        server_code TEXT NOT NULL,
        ui_code TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (plugin_id, version)
    );

    CREATE TABLE IF NOT EXISTS class_plugins (
        class_id TEXT NOT NULL,
        plugin_id TEXT NOT NULL,
        version TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        disabled_reason TEXT,
        config_json TEXT NOT NULL DEFAULT '{}',
        installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (class_id, plugin_id),
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plugin_storage (
        class_id TEXT NOT NULL,
        plugin_id TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        storage_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (class_id, plugin_id, storage_key),
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );
`;

const SCHEMA_SQL = `${LEGACY_SCHEMA_SQL}\n${V2_SCHEMA_SQL}`;

const V2_TABLES = Object.freeze([
    'deployment_settings',
    'school_class_catalog',
    'classes',
    'class_teachers',
    'school_staff_roles',
    'student_accounts',
    'class_enrollments',
    'class_roles',
    'enrollment_roles',
    'kiosk_devices',
    'point_ledger',
    'exam_archives',
    'exam_scores',
    'plugin_packages',
    'class_plugins',
    'plugin_storage'
]);

const ensureSchema = (db) => {
    db.exec(SCHEMA_SQL);
};

const countAdmins = (db) => {
    const row = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get();
    return Number(row?.count) || 0;
};

module.exports = {
    SCHEMA_SQL,
    LEGACY_SCHEMA_SQL,
    V2_SCHEMA_SQL,
    V2_TABLES,
    dbPath,
    ensureSchema,
    countAdmins
};
