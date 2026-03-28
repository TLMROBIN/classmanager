# ClassManager Multi (班级管理系统 - 多用户版)

这是一个基于 Node.js 和 Express 构建的班级管理系统后端项目。它使用了 SQLite 数据库来存储信息，并支持多用户、权限管理以及完整的数据备份和恢复机制。

## 主要技术栈

- **后端层**: Node.js, Express
- **数据库**: SQLite (`better-sqlite3`)
- **安全性**: 密码哈希 (`bcryptjs`), JWT身份验证 (`jsonwebtoken`)
- **跨域支持**: CORS

## 快速开始

### 1. 环境准备

确保你的系统已安装：
- [Node.js](https://nodejs.org/) (推荐 v16 以上版本)
- npm

### 2. 安装依赖

```bash
npm install
```

### 3. 初始化数据库

初次运行前，需要初始化数据库表结构：

```bash
npm run init-db
```

### 4. 启动服务

启动前必须先配置 `JWT_SECRET`。推荐在项目根目录创建 `.env.runtime`。

也可以先复制仓库内的示例文件：

```bash
cp .env.example .env.runtime
```

如果你希望把“代码目录 / 数据目录 / 备份目录”分离，推荐同时把 SQLite 主库和备份目录放到仓库外，例如当前用户的状态目录：

```bash
STATE_ROOT="${XDG_STATE_HOME:-$HOME/.local/state}/classmanager-multi"
mkdir -p \
  "$STATE_ROOT/database" \
  "$STATE_ROOT/backups/sqlite" \
  "$STATE_ROOT/runtime" \
  "$STATE_ROOT/alerts" \
  "$STATE_ROOT/recovery"

cat > .env.runtime <<EOF
JWT_SECRET=请替换为至少32位的随机字符串
CLASSMANAGER_DB_PATH=$STATE_ROOT/database/classmanager.db
CLASSMANAGER_BACKUP_DIR=$STATE_ROOT/backups/sqlite
CLASSMANAGER_RUNTIME_DIR=$STATE_ROOT/runtime
CLASSMANAGER_ALERT_DIR=$STATE_ROOT/alerts
CLASSMANAGER_RECOVERY_DIR=$STATE_ROOT/recovery
EOF
```

如果你是从仓库内旧库迁移过来，请先手动复制旧数据，再切换这些路径变量。当前项目不会自动搬迁现有数据库和备份。

手工使用 `start.sh` / `stop.sh` 时，`server.log` 和 `server.pid` 也会写入 `CLASSMANAGER_RUNTIME_DIR`。备份失败告警、备份过期告警、恢复前现场封存则分别使用 `CLASSMANAGER_ALERT_DIR` 和 `CLASSMANAGER_RECOVERY_DIR`。如果你通过 `systemd --user` 跑主服务，主日志仍然在 `journalctl --user -u classmanager-app.service`。

首次部署还需要先创建首个管理员：

```bash
npm run bootstrap-admin
```

使用以下命令启动服务器：

```bash
# 开发模式启动
npm start
```
或者，使用项目中自带的启停脚本：
- `start.bat` / `start.sh`
- `stop.bat` / `stop.sh`

### 5. 配置开机自启动

项目已提供用户级 `systemd` 安装脚本：

```bash
./ops/systemd/user/install-classmanager-app-autostart.sh
```

安装完成后可用下面命令查看状态：

```bash
systemctl --user status classmanager-app.service
```

如果你希望机器开机后在未登录前也自动启动，需要再执行一次：

```bash
sudo loginctl enable-linger $USER
```

`classmanager-app.service` 和备份相关的 `systemd` 单元都会读取项目根目录的 `.env.runtime`，所以数据库路径、备份目录、运行时目录和 `JWT_SECRET` 可以统一在这一个文件里维护。

### 6. 配置 SQLite 定时备份

项目已提供用户级备份定时器安装脚本：

```bash
./ops/systemd/user/install-classmanager-backup-timers.sh
```

安装完成后可用下面命令查看：

```bash
systemctl --user list-timers | rg classmanager-backup
```

如果你使用 `cron` 而不是 `systemd`，仓库里也提供了会自动加载 `.env.runtime` 的模板：

```bash
cat ops/cron/classmanager-backup.cron
```

## 内置脚本和工具

项目中包含了一套完整的数据库备份和恢复工具体系：

- **备份数据库 (SQLite)**: `npm run backup:sqlite`
- **清理过期备份**: `npm run backup:prune:apply`
- **每日定时备份计划**: `npm run backup:daily`
- **验证备份有效性**: `npm run backup:verify`
- **检查备份新鲜度**: `npm run backup:check-freshness`
- **从备份恢复数据**: `npm run restore:sqlite`
