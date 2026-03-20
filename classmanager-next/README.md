# classmanager-next

这是班级管理系统的新一代重构工程目录。

## 目录目的

- 所有新系统相关代码、脚本、配置、迁移文件统一放在此目录
- 旧系统继续保留在仓库根目录运行
- 重构期间不得直接依赖或改写旧系统运行文件

## 隔离原则

新工程必须遵守以下规则：

1. 不修改旧系统入口文件：
   - `server.js`
   - `public/*`
   - `database/classmanager.db`
   - `start.sh`
   - `stop.sh`

2. 不直接写旧系统数据库。

3. 所有迁移与导出动作必须通过 `classmanager-next/scripts` 中的独立脚本执行。

4. 新系统开发、测试、迁移演练默认使用独立数据库实例。

5. 旧系统数据导出只允许通过只读脚本执行，例如：
   - `npm run legacy:export`

## 当前状态

当前目录已建立以下基础结构：

- `apps/web`
- `apps/api`
- `apps/admin`
- `packages/ui`
- `packages/types`
- `packages/config`
- `prisma`
- `docs`
- `scripts`

## Web 前端环境

`apps/web` 使用 Vite，默认读取：

- [apps/web/.env.example](/home/binyu/文档/trae_projects/classmanager/classmanager-multi/classmanager-next/apps/web/.env.example)

开发时可复制为 `apps/web/.env.local`，例如：

```env
VITE_API_BASE=http://127.0.0.1:4010/api
```

前端会本地持久化：

- 登录态
- 上次用户名
- 已选班级
- 已选学生

## 设计文档

重构设计与迁移文档已归档到 [docs](./docs)。

## 下一步

建议下一步直接初始化：

1. monorepo 根配置
2. Prisma schema 初版
3. API 基础应用
4. 旧系统导出脚本

## 已提供的只读迁移脚本

- `npm run legacy:export`
- `npm run legacy:attendance-template`
- `npm run legacy:transform`
- `npm run normalized:validate`

该脚本会只读连接旧系统数据库，并把导出结果写到 `classmanager-next/out/legacy-export`。

`npm run legacy:attendance-template` 会扫描旧导出数据中的历史考勤姓名缺口，并生成：

- `out/review/attendance-name-gaps.json`
- `scripts/attendance-name-mapping.template.json`
- 可手工维护的 `scripts/attendance-name-mapping.json`

建议先运行：

1. `npm run legacy:attendance-template`
2. `npm run legacy:attendance-prepare -- --write`
3. 按需编辑 `scripts/attendance-name-mapping.json`
4. `npm run legacy:attendance-validate`

`npm run legacy:transform` 只读取导出后的 JSON，并生成标准化中间文件到 `classmanager-next/out/normalized`。
它不会写入任何数据库。

`npm run normalized:validate` 会校验标准化结果中的引用完整性和关键计数。

当前不提供真实导入命令，只有 dry-run：

- `npm run normalized:load:dry-run`
- `npm run safe-subset:dry-run`

`safe-subset:dry-run` 对应的是“首轮安全子集导入计划”，只覆盖：

- tenant
- user
- class
- groups / dormitories / positions
- students
- point accounts
- point reason templates
- point transactions
- attendance policy / schedules
- class config / feature flags

真实写库虽然已经有事务型加载器骨架，但默认不会执行，必须显式传入 `--apply` 和 dry-run 输出的确认串，例如：

- `node ./scripts/load-safe-subset.js --input ./out/normalized/0010-14ban.normalized.json --apply --confirm SAFE_SUBSET:legacy-14ban`

真实写库还会额外做这些保护：

- 仅接受 PostgreSQL `DATABASE_URL`
- 拒绝疑似旧系统 SQLite/`classmanager.db`
- 成功导入后写入 `import_jobs` 和 `audit_logs`
- 使用 `migration_mappings` 避免重复导入积分流水

安全子集导入同时会初始化租户角色目录，并为当前导入用户分配默认角色。
对从旧系统迁移的班级拥有者，默认分配 `tenant_owner`，避免后续被误判为无写权限。

## 本地数据库

新系统默认使用独立 PostgreSQL，不会触碰旧系统 SQLite。

常用命令：

1. `npm run db:up`
2. `npm run prisma:generate`
3. `npm run prisma:migrate:dev`
4. `npm run prisma:seed`
5. `npm run roles:backfill`

`roles:backfill` 用于把已导入的新库租户补齐默认角色，并为现有成员回填角色绑定。
它只作用于 `classmanager-next` 的 PostgreSQL，不会接触旧系统 SQLite。

## 后台回归清理

后台成员治理在真实回归时会创建测试前缀账号，例如：

- `invite_reg_...`

当前提供独立清理脚本：

- `npm run admin:cleanup:regression`

默认只做 dry-run。

如果要真实清理这些回归用户、成员关系和对应目标审计，执行：

- `npm run admin:cleanup:regression -- --apply`

如果测试前缀以后调整过，也可以指定：

- `npm run admin:cleanup:regression -- --username-prefix invite_reg_`

该脚本只接受 PostgreSQL `DATABASE_URL`，并且只会清理匹配前缀的测试用户，不会接触旧系统 SQLite。

## 作业回归清理

作业写链路在真实回归时会创建带回归前缀的测试记录，例如：

- `回归123456作业未交 2026-03-10`

当前提供独立清理脚本：

- `npm run homework:cleanup:regression`

默认只做 dry-run。

如果要真实清理这些已经撤销完成的回归作业记录及对应审计，执行：

- `npm run homework:cleanup:regression -- --apply`

如果回归前缀以后调整过，也可以指定：

- `npm run homework:cleanup:regression -- --subject-prefix 回归`

该脚本只接受 PostgreSQL `DATABASE_URL`，并且只会处理：

- `sourceModule=homework_record`
- 已撤销完成的回归记录
- 对应的 `homework.record.create / homework.record.revert` 审计

## 结构化导出

当前已提供运维脚本：

- `npm run export:structured -- --username <username> --password <password> --class-id <uuid> --domain points --date-from 2026-03-08 --date-to 2026-03-09`

它会调用新系统 API，把结构化导出结果写到：

- `classmanager-next/out/structured-exports`

这条链路会复用：

- 登录鉴权
- 结构化导出接口
- 导出审计日志

每次文件导出还会维护：

- `classmanager-next/out/structured-exports/manifest.json`

其中会记录最近导出的：

- 文件路径
- 导出域
- 时间范围
- 计数摘要

同时会维护按班级聚合的最近导出摘要，便于后续做：

- 导出管理页
- 最近导出列表
- 异步任务过渡层

当前还提供导出任务清理脚本：

- `npm run export:cleanup`

默认只做 dry-run。

如果要真正把已过期任务标记为 `expired`，执行：

- `npm run export:cleanup -- --apply`

如果还要同时删除已过期导出文件，再加：

- `npm run export:cleanup -- --apply --remove-files`

导出任务的运维与保留规则见：

- [docs/export-job-operations-v1.md](/home/binyu/文档/trae_projects/classmanager/classmanager-multi/classmanager-next/docs/export-job-operations-v1.md)
- [docs/export-download-policy-v1.md](/home/binyu/文档/trae_projects/classmanager/classmanager-multi/classmanager-next/docs/export-download-policy-v1.md)

默认开发管理员：

- 用户名：`admin`
- 密码：`ChangeMe123!`

首次 seed 后请尽快更改。
