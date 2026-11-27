const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const Database = require('better-sqlite3');

const { LEGACY_SCHEMA_SQL, ensureSchema } = require('../database/schema');
const { hashPassword } = require('../utils/password');
const { STANDARD_POINT_CATEGORIES } = require('../kernel/taxonomy');
const { STD_EVENTS, createEventBus } = require('../kernel/event-bus');
const { ensureOfficialPluginCatalog } = require('../kernel/plugins');
const { ensureDeploymentSettings } = require('../kernel/auth-adapter');
const { ensureClassForUser, createV2CompatStore } = require('../kernel/v2-store');

const ROOT_DIR = path.resolve(__dirname, '..');
const SERVER_SCRIPT = path.join(ROOT_DIR, 'server.js');
const MIGRATE_SCRIPT = path.join(ROOT_DIR, 'scripts', 'migrate-v1-to-v2.js');
const BACKUP_SCRIPT = path.join(ROOT_DIR, 'scripts', 'backup-sqlite.js');
const VERIFY_SCRIPT = path.join(ROOT_DIR, 'scripts', 'verify-backup.js');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getFreePort = () => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        server.close((err) => (err ? reject(err) : resolve(port)));
    });
});

const sha256File = (filePath) => {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
};

const extractCookieHeader = (response) => {
    const raw = response.headers.get('set-cookie');
    return raw ? raw.split(';')[0] : '';
};

const requestJson = async (baseUrl, pathname, options = {}) => {
    const headers = { ...(options.headers || {}) };
    let body = options.body;
    if (body !== undefined) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        body = JSON.stringify(body);
    }
    const response = await fetch(`${baseUrl}${pathname}`, {
        method: options.method || 'GET',
        headers,
        body
    });
    const text = await response.text();
    let json = null;
    if (text) {
        try {
            json = JSON.parse(text);
        } catch (_) {
            json = null;
        }
    }
    return {
        status: response.status,
        headers: response.headers,
        body: json,
        text,
        cookie: extractCookieHeader(response)
    };
};

const waitForServerReady = async (baseUrl, child, logs, timeoutMs = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (child.exitCode !== null) {
            throw new Error(`Server exited prematurely (${child.exitCode}):\n${logs.stderr.join('')}`);
        }
        try {
            const res = await fetch(`${baseUrl}/api/health`);
            if (res.ok) return;
        } catch (_) {}
        await sleep(150);
    }
    throw new Error(`Timed out waiting for server:\n${logs.stderr.join('')}`);
};

const stopServer = async (child) => {
    if (!child || child.exitCode !== null) return;
    const exitPromise = once(child, 'exit');
    child.kill('SIGTERM');
    const res = await Promise.race([exitPromise, sleep(5000).then(() => null)]);
    if (!res && child.exitCode === null) {
        child.kill('SIGKILL');
        await once(child, 'exit');
    }
};

const buildRichV1Domains = (nowTs) => {
    const students = [
        {
            id: 'stu_1',
            name: '张伟',
            gender: '男',
            group: 'discipline',
            dorm: 'boy_715',
            role: 'leader',
            zizai: 25,
            penalty: 2,
            balance: 23,
            lastPenaltyAt: nowTs - 10000,
            lastSanRecoveryDate: '2026-03-30'
        },
        {
            id: 104,
            name: '数字编号同学',
            gender: '女',
            group: 'hygiene',
            dorm: 'girl_713',
            zizai: 12.5,
            penalty: 0,
            balance: 12.5
        },
        {
            id: 'stu_3',
            name: '李敏',
            group: '',
            zizai: 5,
            penalty: 3,
            balance: -2.5
        }
    ];

    const studentProfiles = {
        version: 1,
        entries: {
            stu_1: { avatarHappy: 'data:image/jpeg;base64,abc', avatarSad: '', titleLeft: '纪律之星', titleRight: '' },
            '104': { avatarHappy: '', avatarSad: '', titleLeft: '', titleRight: '卫生标兵' },
            stu_orphan_profile: { avatarHappy: 'data:image/jpeg;base64,orphan', avatarSad: '', titleLeft: '', titleRight: '' }
        }
    };

    const history = [
        {
            id: nowTs + 0.111,
            ts: nowTs - 1000,
            studentId: 104,
            studentName: '数字编号同学',
            val: 5,
            reason: '古诗背诵通过',
            snapshot: { zizai: 7.5, balance: 7.5, penalty: 0 },
            type: 'bonus',
            scene: '班级',
            category: '学习'
        },
        {
            id: nowTs + 0.222,
            ts: nowTs - 5000,
            studentId: 'stu_1',
            studentName: '张伟',
            val: 0,
            reason: '分值核对',
            snapshot: { zizai: 20, balance: 18, penalty: 2 },
            type: 'points-set',
            scene: '班级',
            category: '班务',
            pointValues: { zizai: 25, balance: 23 },
            pointsBefore: { zizai: 20, balance: 18, penalty: 2 },
            pointsAfter: { zizai: 25, balance: 23, penalty: 2 },
            agentOperationId: 'legacy-agent-set-1',
            source: 'agent-api'
        },
        {
            id: nowTs + 0.333,
            ts: nowTs - 10000,
            studentId: 'stu_1',
            studentName: '张伟',
            val: -2,
            reason: '桌面杂乱',
            snapshot: { zizai: 20, balance: 20, penalty: 0 },
            type: 'penalty',
            scene: '班级',
            category: '桌面常规检查'
        },
        {
            id: nowTs + 0.444,
            ts: nowTs - 20000,
            studentId: 'stu_graduated',
            studentName: '已转出同学',
            val: 3,
            reason: '早读表扬',
            snapshot: { zizai: 0, balance: 0, penalty: 0 },
            type: 'bonus',
            scene: '班级',
            category: '未知旧分类'
        },
        {
            id: nowTs + 0.555,
            ts: nowTs - 30000,
            studentId: 'stu_3',
            studentName: '李敏',
            val: 1,
            reason: '撤销扣分: 迟到',
            snapshot: { zizai: 5, balance: -3.5, penalty: 4 },
            type: 'bonus',
            isUndoLog: true,
            scene: '班级',
            category: '考勤'
        }
    ];

    const config = {
        systemConfig: {
            className: '高一(5)班测试班级',
            adminPassword: 'legacy-plaintext-should-be-stripped',
            enabledFeatures: {
                battle: true,
                pet: true
            },
            points: {
                dailyWageAmount: 6,
                penaltyDecayDays: 7,
                penaltyDecayAmount: 10
            }
        }
    };

    const attendanceRecords = {
        '2026-03-30': {
            张伟: {
                morning: { status: 'ok', checkTime: '06:50', timestamp: nowTs - 86400000 }
            },
            李敏: {
                morning: { status: 'absent', checkTime: '缺勤', timestamp: 0, isDerived: true, source: 'server' }
            }
        }
    };

    const treasures = [
        { id: 1, name: '免做卡', rarity: 'SSR', price: 20, stock: 4, desc: '免作业', ladderPrices: [], dailyLimit: 1 }
    ];
    const storage = { stu_1: { 1: 2 } };
    const logs = [{ ts: nowTs - 2000, action: '兑换', studentId: 'stu_1', studentName: '张伟', itemName: '免做卡', cost: 20 }];
    const redemptionHistory = { stu_1: { 1: 1 } };
    const dailyRedemptionCounts = { '2026-03-30': { stu_1: 1 } };
    const dailyUsageCounts = { '2026-03-30': { stu_1: 0 } };
    const liquidatedTreasures = [];
    const tasks = [
        { id: 901, title: '整理讲台', desc: '下课整理', points: 2, startTime: '2026-03-30T08:00', endTime: '2026-03-30T18:00', claimedBy: [] }
    ];
    const battle = { version: 1, teams: [{ id: 't1', name: '青龙队' }], exams: [] };
    const pets = { version: 1, pets: { stu_1: { speciesId: 'star_cat', exp: 30, level: 2, happiness: 90, health: 95, energy: 80 } } };
    const examArchives = {
        version: 1,
        exams: [
            {
                id: 'ex_midterm',
                name: '期中考试',
                ts: nowTs - 100000,
                records: {
                    stu_1: { totalAssigned: 620, totalRaw: 605, totalClassRank: 3, totalGradeRank: 45 },
                    104: { totalAssigned: 590, totalRaw: 580, totalClassRank: 8, totalGradeRank: 90 },
                    stu_graduated: { totalAssigned: 510, totalRaw: 500, totalClassRank: 20, totalGradeRank: 200 }
                },
                ranks: {
                    stu_1: { c: 3, g: 45 },
                    104: { c: 8, g: 90 },
                    stu_graduated: { c: 20, g: 200 }
                }
            }
        ],
        latestExamId: 'ex_midterm',
        defaultBattleBaseExamId: 'ex_midterm',
        defaultBattleSettleExamId: 'ex_midterm'
    };
    const messages = [{ id: 'm1', text: '欢迎来到2.0测试' }];
    const teacherMessages = [{ id: 'tm1', text: '本周关注卫生' }];
    const quotes = ['行百里者半九十。'];
    const __meta = { updatedAt: nowTs };

    return {
        students,
        studentProfiles,
        history,
        config,
        attendance_records: attendanceRecords,
        treasures,
        storage,
        logs,
        redemptionHistory,
        dailyRedemptionCounts,
        dailyUsageCounts,
        liquidatedTreasures,
        tasks,
        battle,
        pets,
        examArchives,
        messages,
        teacherMessages,
        quotes,
        __meta
    };
};

const createLegacyV1Database = (dbPath, nowTs) => {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(LEGACY_SCHEMA_SQL);

    db.prepare("INSERT INTO users (id, username, password_hash, role) VALUES (1, 'admin', ?, 'admin')")
        .run(hashPassword('AdminPass123'));
    db.prepare("INSERT INTO users (id, username, password_hash, role) VALUES (2, 'teacher_a', ?, 'user')")
        .run(hashPassword('TeacherA123'));
    db.prepare("INSERT INTO users (id, username, password_hash, role) VALUES (3, 'teacher_b', ?, 'user')")
        .run(hashPassword('TeacherB123'));

    db.prepare('INSERT INTO maintenance_credentials (user_id, password_hash, migrated_from_legacy) VALUES (2, ?, 0)')
        .run(hashPassword('MaintainA123'));

    const richDomains = buildRichV1Domains(nowTs);
    const insertData = db.prepare('INSERT INTO class_data (user_id, data_key, data_value) VALUES (?, ?, ?)');
    for (const [key, value] of Object.entries(richDomains)) {
        insertData.run(2, key, JSON.stringify(value));
    }

    insertData.run(3, 'students', JSON.stringify([{ id: 'b1', name: '乙班学生', zizai: 2, penalty: 0, balance: 2 }]));
    insertData.run(3, 'messages', JSON.stringify([{ id: 'bm1', text: '乙班公告' }]));
    insertData.run(3, '__meta', JSON.stringify({ updatedAt: nowTs }));

    db.close();
};

test('Stage 0 migration dry-run, lossless migration, idempotency, live server & sandbox isolation', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-stage0-test-'));
    const v1DbPath = path.join(tempDir, 'legacy.db');
    const backupDir = path.join(tempDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    const nowTs = Date.now() - 60_000;
    createLegacyV1Database(v1DbPath, nowTs);
    const initialSha = sha256File(v1DbPath);

    try {
        await t.test('dry-run migrates and verifies in temp copy without touching source DB', () => {
            const output = execFileSync(process.execPath, [
                MIGRATE_SCRIPT,
                '--db', v1DbPath,
                '--mode', 'school',
                '--school-name', '实验中学',
                '--dry-run',
                '--json'
            ], { cwd: ROOT_DIR, encoding: 'utf8' });

            const parsed = JSON.parse(output);
            assert.equal(parsed.dryRun, true);
            assert.equal(parsed.verification.ok, true);
            assert.equal(parsed.verification.deployment.mode, 'school');
            assert.equal(parsed.verification.deployment.schoolName, '实验中学');
            assert.equal(sha256File(v1DbPath), initialSha);
        });

        await t.test('startup guard refuses unmigrated V1 database with clear instructions', () => {
            const portPromise = getFreePort();
            return portPromise.then((port) => {
                const res = spawnSync(process.execPath, [SERVER_SCRIPT], {
                    cwd: ROOT_DIR,
                    env: {
                        ...process.env,
                        PORT: String(port),
                        CLASSMANAGER_HOST: '127.0.0.1',
                        JWT_SECRET: 'stage0-test-secret',
                        CLASSMANAGER_DB_PATH: v1DbPath,
                        CLASSMANAGER_BACKUP_DIR: backupDir
                    },
                    encoding: 'utf8',
                    timeout: 5000
                });
                assert.notEqual(res.status, 0);
                assert.match(res.stderr, /migrate:v2/);
            });
        });

        await t.test('real migration creates pre-backup, normalizes categories, preserves class_data, and is idempotent', () => {
            execFileSync(process.execPath, [
                MIGRATE_SCRIPT,
                '--db', v1DbPath,
                '--mode', 'school',
                '--school-name', '实验中学',
                '--backup-dir', backupDir
            ], { cwd: ROOT_DIR, stdio: 'pipe' });

            const backupFiles = fs.readdirSync(backupDir).filter((f) => f.endsWith('.db'));
            assert.equal(backupFiles.length, 1);
            assert.match(backupFiles[0], /pre-v2-migration/);

            const db = new Database(v1DbPath, { readonly: true });
            try {
                const classRows = db.prepare('SELECT id, owner_teacher_id, title FROM classes ORDER BY owner_teacher_id').all();
                assert.equal(classRows.length, 2);
                assert.equal(classRows[0].id, 'cls_u2');
                assert.equal(classRows[0].title, '高一(5)班测试班级');

                const enrollments = db.prepare("SELECT status, COUNT(*) as count FROM class_enrollments WHERE class_id = 'cls_u2' GROUP BY status").all();
                const byStatus = Object.fromEntries(enrollments.map((r) => [r.status, r.count]));
                assert.equal(byStatus.active, 3);
                assert.equal(byStatus.archived, 1);

                const ledgerRows = db.prepare("SELECT category, sub_category, reason FROM point_ledger WHERE class_id = 'cls_u2' AND status = 'applied' ORDER BY seq DESC").all();
                assert.equal(ledgerRows.length, 5);
                ledgerRows.forEach((row) => {
                    assert.ok(STANDARD_POINT_CATEGORIES.includes(row.category), `Non-standard category: ${row.category}`);
                });
                assert.equal(ledgerRows[0].category, '学业');
                assert.equal(ledgerRows[0].sub_category, '学习');
                assert.equal(ledgerRows[2].category, '纪律');
                assert.equal(ledgerRows[3].category, '待定');
                assert.equal(ledgerRows[4].category, '出勤');

                const examCount = db.prepare("SELECT COUNT(*) as c FROM exam_archives WHERE class_id = 'cls_u2'").get().c;
                const scoreCount = db.prepare("SELECT COUNT(*) as c FROM exam_scores WHERE class_id = 'cls_u2'").get().c;
                assert.equal(examCount, 1);
                assert.equal(scoreCount, 3);

                const legacyCount = db.prepare('SELECT COUNT(*) as c FROM class_data WHERE user_id = 2').get().c;
                assert.equal(legacyCount, 20);
            } finally {
                db.close();
            }

            // Re-run migration: must be idempotent
            const secondOut = execFileSync(process.execPath, [
                MIGRATE_SCRIPT,
                '--db', v1DbPath,
                '--mode', 'school',
                '--skip-backup',
                '--json'
            ], { cwd: ROOT_DIR, encoding: 'utf8' });
            const secondParsed = JSON.parse(secondOut);
            assert.equal(secondParsed.verification.ok, true);
            assert.ok(secondParsed.migrationResult.users.every((u) => u.status === 'skipped_already_migrated'));

            // Verify-only passes cleanly
            execFileSync(process.execPath, [
                MIGRATE_SCRIPT,
                '--db', v1DbPath,
                '--verify-only'
            ], { cwd: ROOT_DIR, stdio: 'pipe' });
        });

        await t.test('live server in school mode preserves existing login, URLs, ledger diffs, agent API, sandbox & backup', async () => {
            const port = await getFreePort();
            const env = {
                ...process.env,
                PORT: String(port),
                CLASSMANAGER_HOST: '127.0.0.1',
                JWT_SECRET: 'stage0-live-secret',
                AUTH_COOKIE_SECURE: 'false',
                CLASSMANAGER_DB_PATH: v1DbPath,
                CLASSMANAGER_BACKUP_DIR: backupDir
            };
            const logs = { stdout: [], stderr: [] };
            const child = spawn(process.execPath, [SERVER_SCRIPT], {
                cwd: ROOT_DIR,
                env,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            child.stdout.on('data', (c) => logs.stdout.push(c.toString()));
            child.stderr.on('data', (c) => logs.stderr.push(c.toString()));

            const baseUrl = `http://127.0.0.1:${port}`;
            try {
                await waitForServerReady(baseUrl, child, logs);

                const healthRes = await requestJson(baseUrl, '/api/health');
                assert.equal(healthRes.status, 200);
                assert.equal(healthRes.body.checks.database.schemaVersion, '2.0-stage0');
                assert.equal(healthRes.body.checks.database.deploymentMode, 'school');

                const providersRes = await requestJson(baseUrl, '/api/auth/providers');
                assert.equal(providersRes.status, 200);
                assert.equal(providersRes.body.mode, 'school');
                assert.equal(providersRes.body.schoolName, '实验中学');
                assert.equal(providersRes.body.passwordLoginEnabled, true);
                assert.deepEqual(providersRes.body.providers, ['password']);
                assert.deepEqual(providersRes.body.runtime, {
                    version: 'v2.0-stage0',
                    schemaVersion: '2.0-stage0',
                    deploymentMode: 'school',
                    deploymentLabel: '校园模式'
                });

                // Existing user logs in with original password
                const loginRes = await requestJson(baseUrl, '/api/auth/login', {
                    method: 'POST',
                    body: { username: 'teacher_a', password: 'TeacherA123' }
                });
                assert.equal(loginRes.status, 200);
                const cookie = loginRes.cookie;
                assert.ok(cookie);

                const verifyRes = await requestJson(baseUrl, '/api/auth/verify', { headers: { Cookie: cookie } });
                assert.equal(verifyRes.status, 200);
                assert.deepEqual(verifyRes.body.runtime, {
                    version: 'v2.0-stage0',
                    schemaVersion: '2.0-stage0',
                    deploymentMode: 'school',
                    deploymentLabel: '校园模式'
                });

                // Read migrated data via V1 API
                const dataRes = await requestJson(baseUrl, '/api/data', { headers: { Cookie: cookie } });
                assert.equal(dataRes.status, 200);
                assert.equal(dataRes.body.students.length, 3);
                assert.equal(dataRes.body.students[1].id, 104);
                assert.equal(dataRes.body.students[2].balance, -2.5);
                assert.equal(dataRes.body.config.systemConfig.adminPassword, undefined);
                assert.equal(dataRes.body.examArchives.exams[0].records['104'].totalAssigned, 590);
                assert.equal(dataRes.body.pets.pets.stu_1.speciesId, 'star_cat');

                // Attendance API strips stored isDerived but serves live derived records cleanly
                const attRes = await requestJson(baseUrl, '/api/attendance', { headers: { Cookie: cookie } });
                assert.equal(attRes.status, 200);
                assert.equal(attRes.body.attendanceRecords['2026-03-30']['张伟'].morning.status, 'ok');

                // Unlock maintenance with existing V1 maintenance password
                const unlockRes = await requestJson(baseUrl, '/api/maintenance/unlock', {
                    method: 'POST',
                    headers: { Cookie: cookie },
                    body: { password: 'MaintainA123' }
                });
                assert.equal(unlockRes.status, 200);
                const mToken = unlockRes.body.token;

                // Prepend a history entry via /api/data and undo it via /api/data
                const appendedEntry = {
                    id: nowTs + 9.99,
                    ts: nowTs + 1000,
                    studentId: 'stu_1',
                    studentName: '张伟',
                    val: 3,
                    reason: '课堂发言',
                    snapshot: { zizai: 25, balance: 23, penalty: 2 },
                    type: 'bonus',
                    scene: '班级',
                    category: '学业'
                };
                const updatedStudents = dataRes.body.students.map((s) => (
                    s.id === 'stu_1' ? { ...s, zizai: 28, balance: 26 } : s
                ));
                const saveAppendRes = await requestJson(baseUrl, '/api/data', {
                    method: 'POST',
                    headers: { Cookie: cookie, 'x-maintenance-token': mToken },
                    body: {
                        students: updatedStudents,
                        history: [appendedEntry, ...dataRes.body.history],
                        __meta: { baseUpdatedAt: dataRes.body.__meta.updatedAt }
                    }
                });
                assert.equal(saveAppendRes.status, 200);

                // Undo that appended entry
                const undoEntry = {
                    id: nowTs + 10.99,
                    ts: nowTs + 2000,
                    studentId: 'stu_1',
                    studentName: '张伟',
                    val: -3,
                    reason: '撤销扣分: 课堂发言',
                    snapshot: { zizai: 28, balance: 26, penalty: 2 },
                    type: 'bonus',
                    isUndoLog: true,
                    scene: '班级',
                    category: '学业'
                };
                const saveUndoRes = await requestJson(baseUrl, '/api/data', {
                    method: 'POST',
                    headers: { Cookie: cookie, 'x-maintenance-token': mToken },
                    body: {
                        students: dataRes.body.students,
                        history: [undoEntry, ...dataRes.body.history],
                        __meta: { baseUpdatedAt: saveAppendRes.body.updatedAt }
                    }
                });
                assert.equal(saveUndoRes.status, 200);

                // Agent API persists to point_ledger with operator_type = 'agent'
                const agentAdjRes = await requestJson(baseUrl, '/api/agent/points/adjust', {
                    method: 'POST',
                    headers: {
                        Cookie: cookie,
                        'x-maintenance-token': mToken,
                        'idempotency-key': 'stage0-agent-adj-1'
                    },
                    body: {
                        studentId: 'stu_1',
                        delta: 2,
                        reason: '实验室清理加分',
                        category: '卫生',
                        expectedUpdatedAt: saveUndoRes.body.updatedAt
                    }
                });
                assert.equal(agentAdjRes.status, 200);
                assert.equal(agentAdjRes.body.student.balance, 25);

                // Test session creates isolated SQLite sandbox file and cleans up on DELETE
                const sessionRes = await requestJson(baseUrl, '/api/test-sessions', {
                    method: 'POST',
                    headers: { Cookie: cookie },
                    body: { simTimeMs: Date.now() }
                });
                assert.equal(sessionRes.status, 200);
                const sessionId = sessionRes.body.sessionId;
                const sandboxFile = path.join(path.dirname(v1DbPath), '.test-sandboxes', `${sessionId}.db`);
                assert.equal(fs.existsSync(sandboxFile), true);

                const sandboxUnlock = await requestJson(baseUrl, '/api/maintenance/unlock', {
                    method: 'POST',
                    headers: { Cookie: cookie, 'x-test-session': sessionId },
                    body: { password: 'MaintainA123' }
                });
                assert.equal(sandboxUnlock.status, 200);

                const sandboxSave = await requestJson(baseUrl, '/api/data', {
                    method: 'POST',
                    headers: {
                        Cookie: cookie,
                        'x-test-session': sessionId,
                        'x-maintenance-token': sandboxUnlock.body.token
                    },
                    body: {
                        students: [{ id: 'stu_sandbox_only', name: '沙盒测试生', zizai: 99, penalty: 0, balance: 99 }],
                        history: [],
                        __meta: { allowServerOverwrite: true }
                    }
                });
                assert.equal(sandboxSave.status, 200);

                // Formal DB must remain unaffected
                const formalCheck = await requestJson(baseUrl, '/api/data', { headers: { Cookie: cookie } });
                assert.equal(formalCheck.body.students.length, 3);
                assert.equal(formalCheck.body.students[0].balance, 25);

                // Delete test session removes sandbox DB file
                const delSession = await requestJson(baseUrl, `/api/test-sessions/${sessionId}`, {
                    method: 'DELETE',
                    headers: { Cookie: cookie }
                });
                assert.equal(delSession.status, 200);
                assert.equal(delSession.body.deleted, true);
                assert.equal(fs.existsSync(sandboxFile), false);

                // Two consecutive non-maintenance saves with non-canonical object key order must succeed without 403
                const latestData = await requestJson(baseUrl, '/api/data', { headers: { Cookie: cookie } });
                assert.equal(latestData.status, 200);
                const nonCanonicalEntry1 = {
                    category: '学业',
                    type: 'bonus',
                    snapshot: { penalty: 0, balance: 12.5, zizai: 12.5 },
                    reason: '非规范键序加分1',
                    extraTag: { b: 2, a: 1 },
                    val: 1,
                    studentName: '数字编号同学',
                    studentId: 104,
                    ts: nowTs + 3000,
                    id: nowTs + 11.11,
                    scene: '班级'
                };
                const stuAfter1 = latestData.body.students.map((s) => (
                    s.id === 104 ? { ...s, zizai: 13.5, balance: 13.5 } : s
                ));
                const historyAfter1 = [nonCanonicalEntry1, ...latestData.body.history];
                const nonMaintSave1 = await requestJson(baseUrl, '/api/data', {
                    method: 'POST',
                    headers: { Cookie: cookie },
                    body: {
                        students: stuAfter1,
                        history: historyAfter1,
                        __meta: { baseUpdatedAt: latestData.body.__meta.updatedAt }
                    }
                });
                assert.equal(nonMaintSave1.status, 200);

                const nonCanonicalEntry2 = {
                    category: '学业',
                    type: 'bonus',
                    snapshot: { penalty: 0, balance: 13.5, zizai: 13.5 },
                    reason: '非规范键序加分2',
                    val: 2,
                    studentName: '数字编号同学',
                    studentId: 104,
                    ts: nowTs + 4000,
                    id: nowTs + 12.22,
                    scene: '班级'
                };
                const stuAfter2 = stuAfter1.map((s) => (
                    s.id === 104 ? { ...s, zizai: 15.5, balance: 15.5 } : s
                ));
                const nonMaintSave2 = await requestJson(baseUrl, '/api/data', {
                    method: 'POST',
                    headers: { Cookie: cookie },
                    body: {
                        students: stuAfter2,
                        history: [nonCanonicalEntry2, ...historyAfter1],
                        __meta: { baseUpdatedAt: nonMaintSave1.body.updatedAt }
                    }
                });
                assert.equal(nonMaintSave2.status, 200);

                // Modifying an existing history entry without maintenance token must still return 403
                const tamperedHistory = [nonCanonicalEntry2, ...historyAfter1].map((item, idx) => (
                    idx === 1 ? { ...item, val: 99 } : item
                ));
                const tamperedSave = await requestJson(baseUrl, '/api/data', {
                    method: 'POST',
                    headers: { Cookie: cookie },
                    body: {
                        students: stuAfter2,
                        history: tamperedHistory,
                        __meta: { baseUpdatedAt: nonMaintSave2.body.updatedAt }
                    }
                });
                assert.equal(tamperedSave.status, 403);
                assert.equal(tamperedSave.body.code, 'MAINTENANCE_AUTH_REQUIRED');
            } finally {
                await stopServer(child);
            }

            // Inspect point_ledger audit trail in migrated DB after server stops
            const db = new Database(v1DbPath, { readonly: true });
            try {
                const revertedRow = db.prepare(
                    "SELECT status, reverted_by_id FROM point_ledger WHERE class_id = 'cls_u2' AND reason = '课堂发言'"
                ).get();
                assert.equal(revertedRow.status, 'reverted');
                assert.ok(revertedRow.reverted_by_id);

                const agentRow = db.prepare(
                    "SELECT operator_type, idempotency_key, category FROM point_ledger WHERE class_id = 'cls_u2' AND reason = '实验室清理加分'"
                ).get();
                assert.equal(agentRow.operator_type, 'agent');
                assert.equal(agentRow.idempotency_key, 'cls_u2:stage0-agent-adj-1');
                assert.equal(agentRow.category, '卫生');
            } finally {
                db.close();
            }

            // Run online backup & verify on V2 DB
            execFileSync(process.execPath, [BACKUP_SCRIPT, '--db', v1DbPath, '--out-dir', backupDir, '--label', 'post-v2'], {
                cwd: ROOT_DIR,
                stdio: 'pipe'
            });
            const verifyOut = execFileSync(process.execPath, [VERIFY_SCRIPT, '--dir', backupDir], {
                cwd: ROOT_DIR,
                encoding: 'utf8'
            });
            assert.match(verifyOut, /classes: 2/);
            assert.match(verifyOut, /point_ledger:/);
        });

        await t.test('live server in personal mode keeps username/password login intact', async () => {
            const db = new Database(v1DbPath);
            db.prepare("UPDATE deployment_settings SET mode = 'personal', school_name = NULL WHERE id = 1").run();
            db.close();

            const port = await getFreePort();
            const logs = { stdout: [], stderr: [] };
            const child = spawn(process.execPath, [SERVER_SCRIPT], {
                cwd: ROOT_DIR,
                env: {
                    ...process.env,
                    PORT: String(port),
                    CLASSMANAGER_HOST: '127.0.0.1',
                    JWT_SECRET: 'stage0-personal-secret',
                    AUTH_COOKIE_SECURE: 'false',
                    CLASSMANAGER_DB_PATH: v1DbPath,
                    CLASSMANAGER_BACKUP_DIR: backupDir
                },
                stdio: ['ignore', 'pipe', 'pipe']
            });
            child.stdout.on('data', (c) => logs.stdout.push(c.toString()));
            child.stderr.on('data', (c) => logs.stderr.push(c.toString()));

            const baseUrl = `http://127.0.0.1:${port}`;
            try {
                await waitForServerReady(baseUrl, child, logs);
                const providersRes = await requestJson(baseUrl, '/api/auth/providers');
                assert.equal(providersRes.status, 200);
                assert.equal(providersRes.body.mode, 'personal');
                assert.equal(providersRes.body.passwordLoginEnabled, true);
                assert.deepEqual(providersRes.body.runtime, {
                    version: 'v2.0-stage0',
                    schemaVersion: '2.0-stage0',
                    deploymentMode: 'personal',
                    deploymentLabel: '个人模式'
                });

                const loginRes = await requestJson(baseUrl, '/api/auth/login', {
                    method: 'POST',
                    body: { username: 'teacher_b', password: 'TeacherB123' }
                });
                assert.equal(loginRes.status, 200);
                const dataRes = await requestJson(baseUrl, '/api/data', { headers: { Cookie: loginRes.cookie } });
                assert.equal(dataRes.status, 200);
                assert.equal(dataRes.body.students[0].name, '乙班学生');
            } finally {
                await stopServer(child);
            }
        });
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('Stage 0 event bus emits std.*@1 events on store mutations', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    ensureSchema(db);
    ensureDeploymentSettings(db, { mode: 'personal' });
    ensureOfficialPluginCatalog(db);

    db.prepare("INSERT INTO users (id, username, password_hash, role) VALUES (1, 'teacher', 'hash', 'user')").run();
    const classRow = ensureClassForUser(db, 1, { title: '测试班' });

    const bus = createEventBus();
    const captured = [];
    bus.subscribe('*', (ev) => captured.push(ev), { classId: classRow.id });

    const store = createV2CompatStore({
        db,
        userId: 1,
        mode: 'formal',
        eventBus: bus
    });

    store.runInTransaction(() => {
        store.upsertDataKey('students', JSON.stringify([
            { id: 's1', name: '王一', group: 'discipline', zizai: 0, penalty: 0, balance: 0 }
        ]));
        store.upsertDataKey('students', JSON.stringify([
            { id: 's1', name: '王一', group: 'hygiene', zizai: 1, penalty: 0, balance: 1 }
        ]));
        store.upsertDataKey('history', JSON.stringify([
            { id: 1.5, ts: 1000, studentId: 's1', studentName: '王一', val: 1, reason: '加分', type: 'bonus', scene: '班级', category: '卫生' }
        ]));
        store.upsertDataKey('tasks', JSON.stringify([
            { id: 10, title: '擦黑板', points: 2, claimedBy: [] }
        ]));
        store.upsertDataKey('tasks', JSON.stringify([
            { id: 10, title: '擦黑板', points: 2, claimedBy: ['s1'] }
        ]));
    });
    store.emitAttendanceRecorded({
        studentId: 's1',
        studentName: '王一',
        status: 'ok',
        slot: 'morning',
        timestamp: 2000
    });

    const eventNames = captured.map((e) => e.eventName);
    assert.ok(eventNames.includes(STD_EVENTS.GROUP_UPDATED));
    assert.ok(eventNames.includes(STD_EVENTS.POINTS_CHANGED));
    assert.ok(eventNames.includes(STD_EVENTS.TASK_COMPLETED));
    assert.ok(eventNames.includes(STD_EVENTS.ATTENDANCE_RECORDED));

    db.close();
});
