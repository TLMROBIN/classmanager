const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');

const ROOT_DIR = path.resolve(__dirname, '..');
const SERVER_SCRIPT = path.join(ROOT_DIR, 'server.js');
const BOOTSTRAP_ADMIN_SCRIPT = path.join(ROOT_DIR, 'scripts', 'bootstrap-admin.js');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getFreePort = () => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(port);
        });
    });
});

const formatBackupTimestamp = (date = new Date()) => {
    const pad2 = (value) => String(value).padStart(2, '0');
    return [
        date.getFullYear(),
        pad2(date.getMonth() + 1),
        pad2(date.getDate())
    ].join('') + '_' + [
        pad2(date.getHours()),
        pad2(date.getMinutes()),
        pad2(date.getSeconds())
    ].join('');
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
            throw new Error([
                `测试服务提前退出，exitCode=${child.exitCode}`,
                `stdout:\n${logs.stdout.join('')}`,
                `stderr:\n${logs.stderr.join('')}`
            ].join('\n\n'));
        }

        try {
            const response = await fetch(`${baseUrl}/api/health`);
            if (response.ok) {
                return;
            }
        } catch (_) {}

        await sleep(200);
    }

    throw new Error([
        '等待测试服务启动超时',
        `stdout:\n${logs.stdout.join('')}`,
        `stderr:\n${logs.stderr.join('')}`
    ].join('\n\n'));
};

const stopServer = async (child) => {
    if (!child || child.exitCode !== null) return;

    child.kill('SIGINT');
    const exitPromise = once(child, 'exit');
    const timeout = sleep(5000).then(() => null);
    const result = await Promise.race([exitPromise, timeout]);

    if (!result && child.exitCode === null) {
        child.kill('SIGKILL');
        await once(child, 'exit');
    }
};

test('API smoke flows', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'classmanager-api-smoke-'));
    const dbPath = path.join(tempDir, 'classmanager.test.db');
    const backupDir = path.join(tempDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    const env = {
        ...process.env,
        PORT: String(await getFreePort()),
        CLASSMANAGER_HOST: '127.0.0.1',
        JWT_SECRET: 'test-jwt-secret',
        AUTH_COOKIE_SECURE: 'false',
        CLASSMANAGER_DB_PATH: dbPath,
        CLASSMANAGER_BACKUP_DIR: backupDir
    };

    execFileSync(process.execPath, [
        BOOTSTRAP_ADMIN_SCRIPT,
        '--username', 'admin',
        '--password', 'Admin1234',
        '--confirm-password', 'Admin1234'
    ], {
        cwd: ROOT_DIR,
        env,
        stdio: 'pipe'
    });

    const backupPath = path.join(backupDir, `classmanager_${formatBackupTimestamp()}.db`);
    fs.copyFileSync(dbPath, backupPath);

    const logs = { stdout: [], stderr: [] };
    const child = spawn(process.execPath, [SERVER_SCRIPT], {
        cwd: ROOT_DIR,
        env,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', (chunk) => logs.stdout.push(chunk.toString()));
    child.stderr.on('data', (chunk) => logs.stderr.push(chunk.toString()));

    const baseUrl = `http://127.0.0.1:${env.PORT}`;
    let userCookie = '';

    try {
        await waitForServerReady(baseUrl, child, logs);

        await t.test('health endpoint exposes sqlite and backup freshness', async () => {
            const response = await requestJson(baseUrl, '/api/health');
            assert.equal(response.status, 200);
            assert.equal(response.body.status, 'ok');
            assert.equal(response.body.ready, true);
            assert.equal(response.body.checks.database.ok, true);
            assert.equal(response.body.checks.backup.ok, true);
            assert.equal(response.body.checks.backup.status, 'fresh');
        });

        await t.test('register, logout, login and verify access auth', async () => {
            const username = `user_${Date.now()}`;
            const password = 'User123456';

            const registerResponse = await requestJson(baseUrl, '/api/auth/register', {
                method: 'POST',
                body: { username, password }
            });
            assert.equal(registerResponse.status, 200);
            assert.ok(registerResponse.cookie);

            const logoutResponse = await requestJson(baseUrl, '/api/auth/logout', {
                method: 'POST',
                headers: { Cookie: registerResponse.cookie }
            });
            assert.equal(logoutResponse.status, 200);

            const loginResponse = await requestJson(baseUrl, '/api/auth/login', {
                method: 'POST',
                body: { username, password }
            });
            assert.equal(loginResponse.status, 200);
            assert.ok(loginResponse.cookie);
            userCookie = loginResponse.cookie;

            const verifyResponse = await requestJson(baseUrl, '/api/auth/verify', {
                headers: { Cookie: userCookie }
            });
            assert.equal(verifyResponse.status, 200);
            assert.equal(verifyResponse.body.user.username, username);
            assert.equal(verifyResponse.body.user.role, 'user');
        });

        await t.test('maintenance password can be setup and unlocked', async () => {
            const statusResponse = await requestJson(baseUrl, '/api/maintenance/status', {
                headers: { Cookie: userCookie }
            });
            assert.equal(statusResponse.status, 200);
            assert.equal(statusResponse.body.configured, false);

            const setupResponse = await requestJson(baseUrl, '/api/maintenance/setup', {
                method: 'POST',
                headers: { Cookie: userCookie },
                body: { password: 'Maintain123' }
            });
            assert.equal(setupResponse.status, 200);
            assert.equal(typeof setupResponse.body.token, 'string');

            const unlockResponse = await requestJson(baseUrl, '/api/maintenance/unlock', {
                method: 'POST',
                headers: { Cookie: userCookie },
                body: { password: 'Maintain123' }
            });
            assert.equal(unlockResponse.status, 200);
            assert.equal(typeof unlockResponse.body.token, 'string');
        });

        await t.test('data API saves and reads non-maintenance domains', async () => {
            const payload = {
                messages: [
                    { id: 'msg_1', text: 'hello smoke test' }
                ]
            };

            const saveResponse = await requestJson(baseUrl, '/api/data', {
                method: 'POST',
                headers: { Cookie: userCookie },
                body: payload
            });
            assert.equal(saveResponse.status, 200);
            assert.equal(saveResponse.body.success, true);

            const readResponse = await requestJson(baseUrl, '/api/data', {
                headers: { Cookie: userCookie }
            });
            assert.equal(readResponse.status, 200);
            assert.deepEqual(readResponse.body.messages, payload.messages);
        });
    } finally {
        await stopServer(child);
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
