# 备份与恢复说明

## 目标

这套方案只做低风险的一期改造：

- 不修改 `server.js` 的请求处理链路
- 不改前端与服务器的同步链路
- 不直接复制运行中的 `database/classmanager.db`
- 只通过独立脚本生成旁路备份

当前主库位置：

- `database/classmanager.db`

如果你只想看“如何恢复”，可以直接看：

- `docs/restore-workflow.md`

## 已提供脚本

- `npm run backup:sqlite`
  - 使用 SQLite 在线备份接口生成整库副本
  - 默认输出到 `backups/sqlite/`
  - 备份后自动做 `PRAGMA integrity_check`
  - 自动写出同名清单文件 `*.manifest.json`

- `npm run backup:verify`
  - 默认校验 `backups/sqlite/` 中最新的备份文件
  - 也可以手动指定：
  - `node scripts/verify-backup.js --file backups/sqlite/xxx.db`

- `npm run backup:prune`
  - 仅预览清理结果，不会删除文件

- `npm run backup:prune:apply`
  - 实际清理旧备份
  - 保留策略：
    - 最近 `7` 个自然日各保留 `1` 份
    - 最近 `4` 个自然周各保留 `1` 份
    - 最近 `3` 个月各保留 `1` 份

- `npm run backup:daily`
  - 先执行在线备份，再执行实际轮转清理

- `npm run backup:check-freshness`
  - 检查最新 SQLite 备份是否仍在新鲜度阈值内
  - 默认阈值为 `36` 小时

- `npm run backup:alert:test`
  - 手动生成一条测试告警
  - 主要用于验证日志落盘和桌面通知

- `npm run restore:sqlite`
  - 启动交互式 SQLite 恢复向导

- `npm run restore:sqlite:dry-run`
  - 演练恢复流程，但不真正修改数据库

## 为什么这样更安全

当前系统使用 SQLite `WAL` 模式。运行中如果直接复制数据库文件，容易得到不完整副本。

本方案改用 SQLite 在线备份接口，避免以下问题：

- 只复制主库，不复制 `-wal`
- 在写入进行时拿到不一致文件
- 误把损坏副本当成可恢复备份

## 备份文件位置

默认目录：

- `backups/sqlite/`

每次备份会生成两类文件：

- `classmanager_YYYYMMDD_HHMMSS.db`
- `classmanager_YYYYMMDD_HHMMSS.manifest.json`

清单文件包含：

- 创建时间
- 校验结果
- 文件大小
- SHA256
- `users` / `class_data` 行数

## 推荐日常操作

### 手动执行一次备份

```bash
npm run backup:sqlite
```

### 校验最新备份

```bash
npm run backup:verify
```

### 先预览清理结果

```bash
npm run backup:prune
```

### 实际执行轮转清理

```bash
npm run backup:prune:apply
```

## 推荐定时任务

仓库内已附带模板：

- `ops/cron/classmanager-backup.cron`
- `ops/systemd/user/classmanager-backup.service`
- `ops/systemd/user/classmanager-backup.timer`
- `ops/systemd/user/classmanager-backup-verify.service`
- `ops/systemd/user/classmanager-backup-verify.timer`
- `ops/systemd/user/classmanager-backup-alert.service`
- `ops/systemd/user/classmanager-backup-verify-alert.service`
- `ops/systemd/user/classmanager-backup-freshness.service`
- `ops/systemd/user/classmanager-backup-freshness.timer`

Linux `cron` 示例，每天凌晨 `02:15` 备份一次：

```cron
15 2 * * * cd /home/binyu/文档/trae_projects/classmanager/classmanager-multi && /usr/bin/npm run backup:daily >> backups/backup.log 2>&1
```

建议补一个每周校验：

```cron
30 2 * * 1 cd /home/binyu/文档/trae_projects/classmanager/classmanager-multi && /usr/bin/npm run backup:verify >> backups/backup.log 2>&1
```

### 使用 `cron` 模板

1. 打开 `ops/cron/classmanager-backup.cron`
2. 将 `/path/to/classmanager-multi` 替换为实际仓库路径
3. 执行：

```bash
crontab ops/cron/classmanager-backup.cron
```

### 使用 `systemd --user` 模板

推荐直接执行仓库自带安装脚本：

```bash
./ops/systemd/user/install-classmanager-backup-timers.sh
```

脚本会自动：

- 把 `ops/systemd/user/` 下的备份相关 unit 渲染到 `~/.config/systemd/user/`
- 自动替换 `WorkingDirectory`
- 执行 `systemctl --user daemon-reload`
- 启用并启动以下 timer：
  - `classmanager-backup.timer`
  - `classmanager-backup-verify.timer`
  - `classmanager-backup-freshness.timer`

如需手工安装，也可以按下面步骤执行：

1. 打开以下文件并修改 `WorkingDirectory`：
   - `ops/systemd/user/classmanager-backup.service`
   - `ops/systemd/user/classmanager-backup-verify.service`
   - `ops/systemd/user/classmanager-backup-freshness.service`
2. 复制到用户级 systemd 目录：

```bash
mkdir -p ~/.config/systemd/user
cp ops/systemd/user/classmanager-backup.service ~/.config/systemd/user/
cp ops/systemd/user/classmanager-backup.timer ~/.config/systemd/user/
cp ops/systemd/user/classmanager-backup-verify.service ~/.config/systemd/user/
cp ops/systemd/user/classmanager-backup-verify.timer ~/.config/systemd/user/
cp ops/systemd/user/classmanager-backup-freshness.service ~/.config/systemd/user/
cp ops/systemd/user/classmanager-backup-freshness.timer ~/.config/systemd/user/
```

3. 重新加载并启用：

```bash
systemctl --user daemon-reload
systemctl --user enable --now classmanager-backup.timer
systemctl --user enable --now classmanager-backup-verify.timer
systemctl --user enable --now classmanager-backup-freshness.timer
```

4. 查看状态：

```bash
systemctl --user list-timers | rg classmanager
```

## 失败告警

如果启用了仓库里的 `systemd --user` 模板：

- 日备份失败会触发 `classmanager-backup-alert.service`
- 周校验失败会触发 `classmanager-backup-verify-alert.service`

告警会做三件事：

- 写入 `backups/alerts/failures.log`
- 刷新 `backups/alerts/latest-failure.json`
- 生成一份带时间戳的明细 JSON

如果桌面会话可用，还会尝试发送 `notify-send` 弹窗。

### 手动测试告警

```bash
npm run backup:alert:test
```

### 查看最近一次告警

```bash
cat backups/alerts/latest-failure.json
```

### 查看告警汇总

```bash
tail -n 20 backups/alerts/failures.log
```

## 备份过期告警

仓库还提供了一条“备份新鲜度检查”：

- `classmanager-backup-freshness.service`
- `classmanager-backup-freshness.timer`

默认策略：

- 每天 `03:30 / 09:30 / 15:30 / 21:30` 检查一次
- 如果最新备份超过 `36` 小时未更新，则写入过期告警

过期告警文件位置：

- `backups/alerts/latest-stale-backup.json`
- `backups/alerts/stale-backups.log`

### 手动检查一次

```bash
npm run backup:check-freshness
```

### 查看最近一次过期告警

```bash
cat backups/alerts/latest-stale-backup.json
```

## 恢复流程

恢复前必须先停服务，避免把恢复库和旧的 `WAL/SHM` 混在一起。

### 1. 停服务

```bash
./stop.sh
```

### 2. 先封存当前现场

即使当前库疑似损坏，也先保留一份现场：

```bash
mkdir -p database/recovery-safety
cp database/classmanager.db database/recovery-safety/classmanager.db.$(date +%Y%m%d_%H%M%S)
test -f database/classmanager.db-wal && cp database/classmanager.db-wal database/recovery-safety/classmanager.db-wal.$(date +%Y%m%d_%H%M%S)
test -f database/classmanager.db-shm && cp database/classmanager.db-shm database/recovery-safety/classmanager.db-shm.$(date +%Y%m%d_%H%M%S)
```

### 3. 选择一个已校验通过的备份

建议先查看：

```bash
ls -lh backups/sqlite
```

必要时再次校验：

```bash
node scripts/verify-backup.js --file backups/sqlite/你的备份文件.db
```

### 4. 替换主库

```bash
cp backups/sqlite/你的备份文件.db database/classmanager.db
rm -f database/classmanager.db-wal database/classmanager.db-shm
```

### 5. 启动前再做一次完整性检查

```bash
sqlite3 database/classmanager.db "PRAGMA integrity_check;"
```

结果应为：

```text
ok
```

### 6. 启动服务

```bash
./start.sh
```

## 恢复时的注意事项

- 不要直接把运行中的 `database/classmanager.db` 当备份复制出去
- 不要恢复后保留旧的 `database/classmanager.db-wal` / `database/classmanager.db-shm`
- 不要把 `database/dump.sql` 当作当前可靠主恢复源；它现有文件末尾是回滚状态
- 恢复前先保留现场，避免二次损坏后无从回退

## 建议的后续二期

如果需要把方案继续提升到更稳的级别，下一步建议补：

- 全用户逻辑导出/导入
- 异地副本同步
- 月度恢复演练
- 磁盘空间告警
