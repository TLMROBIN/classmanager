#!/usr/bin/env node
// 开发启动脚本：自动加载 .env.runtime，并将 --port / --host 参数转发给 server.js
const fs = require('fs');
const path = require('path');

// 1. 加载 .env.runtime（已存在的同名环境变量优先，不覆盖）
const envFile = path.join(__dirname, '..', '.env.runtime');
if (fs.existsSync(envFile)) {
    for (const rawLine of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim();
        if (!(key in process.env)) process.env[key] = value;
    }
}

// 2. 解析 CLI 参数：--port/-p、--host/--hostname（支持 "--flag value" 与 "--flag=value" 两种形式）
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const match = argv[i].match(/^(--port|--host|--hostname|-p)(?:=(.*))?$/);
    if (!match) continue;
    const flag = match[1];
    let value = match[2];
    if (value === undefined && argv[i + 1] && !argv[i + 1].startsWith('-')) {
        value = argv[++i];
    }
    if (value === undefined) continue;
    if (flag === '--port' || flag === '-p') {
        process.env.PORT = String(value);
    } else {
        process.env.CLASSMANAGER_HOST = String(value);
    }
}

// 3. 启动主服务器
require('../server.js');
