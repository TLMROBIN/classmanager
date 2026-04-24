# ClassManager Multi — agents.md

> 给 AI 协作者的项目导航手册。读完这份文档，你应该能独立定位任何功能，知道改哪里、不能碰哪里，以及这个项目的设计底线。

---

## 项目一句话

这是一个运行在局域网/本机的班级管理 Web 系统，面向中学班主任。核心功能是学生积分管理、考勤打卡、藏宝阁（积分商城）、任务发布、双子星对战赛制、班级宠物，以及一套完整的数据备份与恢复体系。

---

## 技术栈

| 层次 | 技术 |
|---|---|
| 运行时 | Node.js (≥16) |
| HTTP 框架 | Express 4 |
| 数据库 | SQLite（`better-sqlite3`，WAL 模式，外键开启） |
| 认证 | JWT（httpOnly Cookie，7天有效）+ 独立维护密码（bcrypt，10分钟短令牌） |
| 安全头 | Helmet + 手写 CSP |
| 前端 | 原生 JS + React 18（CDN vendor，无构建步骤）+ Tailwind CSS |
| 前端状态 | React hooks（`useClassManagerStore`，单一大 store） |
| 测试 | Node.js 内置 `node:test`（`tests/api-smoke.test.js`） |
| 运维 | systemd user 服务 + 定时备份 timer（或 cron 等价配置） |

---

## 目录速览

```
classmanager-multi/
├── server.js                  ← 唯一后端入口，所有路由和业务逻辑都在这里
├── database/
│   ├── schema.js              ← 建表 SQL + dbPath 解析
│   └── init.js                ← 一次性初始化脚本
├── middleware/
│   └── auth.js                ← JWT 生成/验证，authMiddleware / adminMiddleware / userMiddleware
├── utils/
│   ├── password.js            ← bcrypt 封装
│   ├── health.js              ← /api/health 报告构建
│   └── config-security.js     ← 剔除 config 里遗留的明文密码字段
├── public/                    ← 全部前端静态文件（Express 直接 serve）
│   ├── index.html / login.html / admin.html
│   ├── script.js              ← 前端主入口（庞大，含同步、考勤、宝物等主逻辑）
│   ├── core/
│   │   ├── store.js           ← useClassManagerStore（React state 定义）
│   │   ├── sync.js            ← 服务端数据同步层
│   │   ├── runtime.js         ← 运行时工具（getNow、测试时间等）
│   │   └── schema.js          ← 前端数据结构规范化工具
│   ├── attendance/            ← 考勤模块（UI + 积分计算）
│   ├── battle/                ← 双子星对战模块
│   ├── pet/                   ← 班级宠物模块
│   │   ├── species.js         ← 30个物种定义
│   │   ├── state.js           ← 宠物状态派生逻辑（纯计算）
│   │   ├── module.js          ← 宠物 React 视图
│   │   └── art-manifest.js    ← 本地图片资源映射表
│   ├── treasure/              ← 藏宝阁（积分商城）
│   ├── operations/            ← 积分操作主界面
│   ├── settings/              ← 设置页（学生名单、考试档案、系统配置）
│   ├── tasks/                 ← 任务模块
│   ├── profile/               ← 学生个人档案
│   ├── dashboard/             ← 仪表盘
│   └── nav/                   ← 导航栏
├── scripts/                   ← 运维脚本（备份、恢复、审计）
├── ops/systemd/user/          ← systemd 服务单元和安装脚本
├── tests/
│   └── api-smoke.test.js      ← API 冒烟测试（真实启动服务器）
└── docs/                      ← 设计文档
```

---

## 数据库 Schema

### 正式表

| 表 | 说明 |
|---|---|
| `users` | 用户账号，`role` 为 `admin` 或 `user` |
| `class_data` | 用户班级数据，key-value 结构，每个 `data_key` 对应一个数据域 |
| `maintenance_credentials` | 用户级维护密码（bcrypt），独立于登录密码 |

### 测试模式表（真测试沙盒）

| 表 | 说明 |
|---|---|
| `test_sessions` | 测试会话记录，含模拟时间、过期时间 |
| `test_class_data` | 测试会话期间的数据副本，结构与 `class_data` 对齐 |
| `test_maintenance_credentials` | 测试会话期间的维护密码副本 |

### 数据域（`class_data.data_key` 枚举）

| 域名 | 类型 | 上限 | 说明 |
|---|---|---|---|
| `students` | array | 1MB | 学生列表（含积分字段） |
| `studentProfiles` | object | 1MB | 学生详细档案 |
| `history` | array | 2MB | 积分变动历史 |
| `config` | object | 512KB | 系统配置（考勤规则、值日、积分规则等） |
| `attendanceRecords` | object | 2MB | 考勤记录（只存原始数据，缺勤由服务端派生） |
| `pets` | object | 1MB | 宠物系统数据 |
| `treasures` | array | 512KB | 藏宝阁商品列表 |
| `storage` | object | 512KB | 学生背包（持有道具） |
| `logs` | array | 1MB | 藏宝阁操作日志 |
| `tasks` | array | 512KB | 任务列表 |
| `battle` | object | 1MB | 双子星对战数据 |
| `examArchives` | object | 2MB | 考试档案 |
| `messages` | array | 512KB | 班级公告（学生可见） |
| `teacherMessages` | array | 512KB | 教师备忘 |
| `quotes` | array | 128KB | 每日格言 |
| `redemptionHistory` | object | 256KB | 兑换记录（用于防刷）|
| `dailyRedemptionCounts` | object | 256KB | 每日兑换次数 |
| `dailyUsageCounts` | object | 256KB | 每日使用次数 |
| `__meta` | object | 32KB | 元信息，含 `updatedAt`（冲突检测时钟） |

---

## API 路由总览

### 公开接口
- `GET /api/health` — 健康检查（数据库状态 + 备份新鲜度）

### 认证
- `POST /api/auth/register` — 注册
- `POST /api/auth/login` — 登录（返回 httpOnly Cookie）
- `POST /api/auth/logout` — 登出
- `GET /api/auth/verify` — 验证 token
- `POST /api/auth/change-password` — 修改登录密码

### 测试模式（仅 `user` 角色）
- `POST /api/test-sessions` — 创建测试会话（快照正式数据）
- `GET /api/test-sessions/:id` — 查询会话状态
- `PATCH /api/test-sessions/:id` — 更新模拟时间/时间流速
- `DELETE /api/test-sessions/:id` — 销毁会话（级联删除测试数据）

### 维护密码（仅 `user` 角色）
- `GET /api/maintenance/status` — 是否已配置、是否已解锁
- `POST /api/maintenance/setup` — 首次设置维护密码
- `POST /api/maintenance/unlock` — 验证并获取10分钟短令牌
- `POST /api/maintenance/change` — 修改维护密码

### 班级数据（仅 `user` 角色）
- `GET /api/data` — 读取全量数据（自动触发扣分衰减）
- `POST /api/data` — 保存数据（含冲突检测、维护权限检查、防空覆盖）

### 考勤（仅 `user` 角色）
- `GET /api/attendance` — 读取考勤数据（服务端派生缺勤记录）
- `POST /api/attendance/check-in` — 打卡（自动判断迟到/准点，写积分）
- `POST /api/attendance/maintenance` — 考勤维护（需维护令牌）：`correct`（撤销迟到/补卡）、`settleAbsent`（缺勤结算扣分）

### 管理员（仅 `admin` 角色）
- `GET /api/admin/users` — 用户列表
- 其他管理接口（在 server.js 末段）

---

## 核心设计原则

### 1. 冲突检测（乐观锁）
每次 `POST /api/data` 时，前端需在 `__meta.baseUpdatedAt` 里携带上次已知的服务端时间戳。服务端对比 `existingMeta.updatedAt`，不一致则返回 `409 DATA_CONFLICT`。前端必须先拉取最新数据才能再次保存。

### 2. 维护密码保护的操作
以下变更必须持有有效维护令牌（`X-Maintenance-Token` 请求头）：
- 修改学生名单（增删改学生基本信息）
- 修改系统配置
- 修改考试档案或 `studentProfiles`
- 删减积分历史记录
- 藏宝阁商品上下架/改价/增库存
- 以及其他被 `hasMaintenanceProtectedMutation()` 检测为"需要维护权限"的操作

### 3. 考勤缺勤派生（服务端计算，不存库）
- 存储的 `attendanceRecords` 只含已打卡记录（`ok`/`late`）
- `GET /api/attendance` 和 `GET /api/data` 在返回时动态推导：若某时段已有人打卡、时段已结束、且某学生无记录，则将其标记为 `absent`（`isDerived: true`）
- 派生记录永远不写入数据库，保存时也会被 `stripDerivedAttendanceRecords()` 剔除

### 4. 真测试模式（服务端沙盒）
- 进入测试模式：全量复制正式数据到 `test_class_data`，正式表从此刻起不受影响
- 测试中：所有请求携带 `X-Test-Session` 头，服务端透明切换到测试表读写
- `X-Test-Now` 头允许前端注入模拟时间戳，影响所有时间相关逻辑
- 退出：直接删除测试会话，级联清空测试数据，正式数据零损伤

### 5. 扣分衰减（自动）
`students[].penalty` 字段记录累计扣分值。服务端在每次 `GET /api/data` 和 `POST /api/data` 时，根据 `config.systemConfig.points.penaltyDecayDays` 和 `penaltyDecayAmount` 自动衰减，逻辑在 `applyPenaltyDecayLifecycle()` 中。

### 6. 藏宝阁防护
`POST /api/data` 对藏宝阁相关域（`treasures`/`storage`/`logs`/`redemptionHistory`/...）有专项保护：
- 检测日志是否只追加（禁止删改历史）
- 检测兑换/使用计数是否单调递增
- 防止空数据覆盖已有宝物（`getProtectedTreasureDomain`）

---

## 宠物系统（Phase 1 MVP）

- 数据存于 `pets` 域，结构为 `{ version: 1, pets: { [studentId]: PetState } }`
- 三个核心状态轴：`happiness`、`health`、`energy`（0-100）
- 成长阶段：`egg → young（1级）→ growth（10级）→ adult（25级）`，上限50级
- 宠物成长由 `history + attendanceRecords + manualBoosts` 派生（`public/pet/state.js`）
- 商城为宠物系统内置商城，不依赖 `treasures` 域
- 图片资源在 `public/pet/assets/`，`art-manifest.js` 统一管理 `artKey → src` 映射

---

## 双子星（Battle）模块

- 数据存于 `battle` 域
- 模块文件在 `public/battle/`，已按职责拆分：`state.js`（状态变更）、`simulator.js`（纯计算）、`transfer.js`（导入导出）
- 结算结果可写回主积分系统（`students + history`），需维护权限
- 后续优化方向见 `public/battle/README.md`

---

## 备份体系

| 脚本 | 作用 |
|---|---|
| `scripts/backup-sqlite.js` | 热备份 SQLite（WAL checkpoint + 文件复制） |
| `scripts/verify-backup.js` | 验证备份文件完整性 |
| `scripts/prune-backups.js` | 清理过期备份 |
| `scripts/check-backup-freshness.js` | 检查备份是否过期（供 systemd timer 调用）|
| `scripts/restore-sqlite.js` | 从备份恢复（有 `--dry-run` 选项）|
| `scripts/backup-failure-notify.js` | 备份失败告警（写告警文件） |

备份目录、数据库路径、运行时目录均通过 `.env.runtime` 环境变量配置（`CLASSMANAGER_DB_PATH`、`CLASSMANAGER_BACKUP_DIR` 等），不硬编码。

---

## 测试

```bash
npm test
# 实际执行：node --test tests/api-smoke.test.js
```

冒烟测试会：
1. 在临时目录建立独立数据库
2. 真实启动一个服务器进程（随机端口）
3. 覆盖：健康检查、注册/登录/登出、修改密码、维护密码设置/解锁、数据读写、测试模式下的考勤打卡（准点/迟到）
4. 最终 SIGTERM 验证优雅停机，清理临时目录

---

## 开发时的注意事项

### 不要碰的区域
- `stripDerivedAttendanceRecords()` — 任何缺勤派生记录必须在存库前被清除，若此函数被绕过，数据库会存入脏数据
- `hasMaintenanceProtectedMutation()` — 维护权限检查的判断入口，不能缩减检测范围
- `getProtectedTreasureDomain()` — 防止空覆盖宝物数据，改动前先读懂藏宝阁日志追加逻辑
- JWT_SECRET 必须在 `.env.runtime` 里配置，服务器缺少该变量时拒绝启动

### 改后端路由时
- 所有用户接口必须过 `authMiddleware`（验证 Cookie 或 Bearer token）
- 用户操作必须再过 `userMiddleware`（禁止 admin 使用普通用户功能）
- 涉及考勤/数据的接口必须再过 `resolveTestSessionMiddleware`（支持测试模式透明切换）
- 时间读取统一用 `getRequestNow(req)`，不要直接 `new Date()`

### 改前端时
- 前端无构建步骤，直接修改 `public/` 下的 JS 文件即生效
- `public/vendor/` 目录是 CDN 本地化的库（React、Tailwind、xlsx），不要手动编辑
- 需要运行 Tailwind 编译时：`npm run build:web-assets`

### 数据迁移
- Schema 变更用 `migrate.js` 或在 `database/schema.js` 的 `SCHEMA_SQL` 里加 `CREATE TABLE IF NOT EXISTS`（幂等）
- 不要删除现有字段，现有数据需向前兼容

---

## 环境变量速查

| 变量 | 说明 | 默认值 |
|---|---|---|
| `JWT_SECRET` | JWT 签名密钥（必填，≥32位）| 无，缺少则拒绝启动 |
| `PORT` | 监听端口 | 3002 |
| `CLASSMANAGER_HOST` | 监听地址 | `0.0.0.0` |
| `CLASSMANAGER_DB_PATH` | SQLite 数据库路径 | `database/classmanager.db` |
| `CLASSMANAGER_BACKUP_DIR` | 备份目录 | 无（脚本运行时需指定）|
| `CLASSMANAGER_RUNTIME_DIR` | PID/日志目录（start.sh 使用）| 无 |
| `CLASSMANAGER_ALERT_DIR` | 告警文件目录 | 无 |
| `CLASSMANAGER_RECOVERY_DIR` | 恢复前现场封存目录 | 无 |
| `AUTH_COOKIE_SECURE` | Cookie Secure 模式（`true`/`false`/`auto`）| `auto`（HTTPS 时自动启用）|
| `CLASSMANAGER_REQUEST_BODY_LIMIT` | 请求体大小上限 | `10mb` |

---

## 快速定位指南

| 想改什么 | 去哪里 |
|---|---|
| 考勤时段/迟到规则 | `server.js` `DEFAULT_ATTENDANCE_SCHEDULE` / `config.systemConfig.attendance` |
| 扣分衰减逻辑 | `server.js` `applyPenaltyDecayLifecycle()` |
| 维护权限判定规则 | `server.js` `hasMaintenanceProtectedMutation()` 及其子函数 |
| 前端全局状态定义 | `public/core/store.js` |
| 前端数据同步（保存/拉取）| `public/core/sync.js` 和 `public/script.js` |
| 考勤打卡 UI | `public/attendance/module.js` |
| 宠物成长计算 | `public/pet/state.js` |
| 宠物物种定义 | `public/pet/species.js` |
| 宠物图片资源管理 | `public/pet/art-manifest.js` |
| 双子星对战逻辑 | `public/battle/simulator.js` |
| 藏宝阁兑换/使用 | `public/treasure/` |
| JWT 逻辑 | `middleware/auth.js` |
| 数据库表结构 | `database/schema.js` |
| 备份/恢复 | `scripts/` |
| 运维部署 | `ops/systemd/user/` |
| 设计决策文档 | `docs/` |
