# SQLite 恢复流程说明

本文档对应交互式恢复脚本：

- `scripts/restore-sqlite.js`

它会把当前仓库里原本分散的人工步骤串起来，按顺序引导你完成整库恢复。

## 适用范围

适用于这套系统的 SQLite 主库恢复：

- 主库：`.env.runtime` 中的 `CLASSMANAGER_DB_PATH`
- 备份目录：`.env.runtime` 中的 `CLASSMANAGER_BACKUP_DIR`

不适用于：

- `database/dump.sql`

## 脚本入口

正式恢复：

```bash
npm run restore:sqlite
```

只演练、不落盘：

```bash
npm run restore:sqlite:dry-run
```

## 脚本会做什么

运行后，脚本会按这个顺序处理：

1. 列出当前备份目录中的可恢复备份文件
2. 让你选择其中一份
3. 对所选备份先做完整性校验
4. 调用 `./stop.sh` 停服务
5. 将当前主库、`-wal`、`-shm` 封存到安全目录：
   - 默认是 `${XDG_STATE_HOME:-$HOME/.local/state}/classmanager-multi/recovery`
   - 也可由 `CLASSMANAGER_RECOVERY_DIR` 或 `--recovery-dir` 覆盖
6. 用所选备份覆盖主库
7. 删除旧的主库 `-wal` / `-shm`
8. 对恢复后的主库再次做完整性校验
9. 询问是否调用 `./start.sh` 重新启动服务

## 为什么要先封存现场

即使你确定当前库有问题，也不要直接覆盖。

脚本会先保留现场副本，原因有两个：

- 防止选错备份后无法回退
- 防止恢复后发现需要对比现场数据

## 交互提示说明

### 选择备份

脚本会列出备份文件、时间和大小，例如：

```text
1. classmanager_20260319_093557.db | 2026/03/19 09:35:57 | 5.5 MB
```

默认选择最新的一份，也就是序号 `1`。

### 确认恢复

脚本会在真正写入前再次确认，因为这一步会覆盖当前主库。

### 是否启动服务

恢复完成后，脚本会询问是否立即启动。

如果你想先自己检查文件，可以选择不启动。

## 常用参数

脚本默认是交互式的，但也支持一些辅助参数：

- `--dry-run`
  - 只演练流程，不改文件、不停服务、不启动服务

- `--file <path>`
  - 直接指定要恢复的备份文件

- `--yes`
  - 尽量使用默认选项继续执行
  - 配合 `--file` 使用更合适

- `--skip-stop`
  - 跳过停服步骤
  - 一般不建议使用

- `--skip-start`
  - 恢复后不自动启动

- `--db <path>`
  - 指定目标主库路径

- `--backup-dir <path>`
  - 指定备份目录

- `--recovery-dir <path>`
  - 指定安全封存目录

## 示例

选择式恢复：

```bash
npm run restore:sqlite
```

指定文件并自动继续：

```bash
node scripts/restore-sqlite.js --file backups/sqlite/classmanager_20260319_093557.db --yes
```

先演练一遍：

```bash
npm run restore:sqlite:dry-run
```

## 建议操作方式

第一次用时，建议先执行：

```bash
npm run restore:sqlite:dry-run
```

确认流程和提示都符合预期后，再执行正式恢复。

## 失败时怎么处理

如果脚本中途失败：

- 优先查看终端输出
- 现场副本一般已经保存在当前恢复安全目录
- 如果主库已被替换但服务未启动，可以手动执行：

```bash
sqlite3 "${CLASSMANAGER_DB_PATH:-$PWD/database/classmanager.db}" "PRAGMA integrity_check;"
./start.sh
```

## 与备份文档的关系

完整的备份、轮转、定时器、告警说明仍然在：

- `docs/backup-restore.md`

如果你只关心“怎么恢复”，优先看本文档即可。
