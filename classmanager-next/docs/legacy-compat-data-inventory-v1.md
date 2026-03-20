# `legacyCompat` 兼容数据维护清单 v1

## 1. 文档目的

本文档用于把当前仍直接保存在 `classConfig.extra.legacyCompat` 中的数据拆成可核对清单，避免继续只靠页面印象判断兼容区到底维护了哪些运行态数据。

对应背景：

- `docs/legacy-full-inheritance-plan-v1.md`
- `docs/legacy-feature-progress-matrix-v1.md`
- `apps/api/src/modules/legacy/routes.ts`
- `apps/web/src/components/LegacyPanel.tsx`

## 2. 当前存储位置

当前兼容区数据统一挂在：

- `classConfig.extra.legacyCompat`

这部分数据同时被以下入口读写：

- API 兼容写接口：任务领取、藏宝阁兑换 / 祈愿 / 使用 / 退回、双子星结算
- 前端兼容维护面板：留言、任务增删改、藏宝阁配置、双子星初始化 / 备份导入导出 / 考试导入 / 赛季维护
- 设置页兼容数据维护入口：原始 JSON 编辑、恢复链路、部分 Excel 导入导出

这意味着 `legacyCompat` 当前仍承载“配置 + 运行态 + 历史日志 + 归档结果”四类不同性质的数据。

## 3. 字段清单

### 3.1 周期策略保留字段

- `strategyDates.lastPeriodicTaskDate`：旧系统周期任务最近执行日期
- `strategyDates.lastPenaltyReductionDate`：旧系统惩罚衰减最近执行日期

说明：

- 这两项属于迁移保留态
- 主要用于兼容摘要、导出恢复与人工核对

### 3.2 留言区

- `messages[]`：学生留言
- `teacherMessages[]`：教师留言

单条字段：

- `id`
- `content`
- `time`
- `date`

说明：

- 以兼容展示和简单维护为主
- 暂未拆成正式留言领域模型

### 3.3 任务区

- `tasks[]`

单条字段：

- `id`
- `title`
- `desc`
- `points`
- `startTime`
- `endTime`
- `claimedByStudentIds[]`

运行态字段：

- `claimedByStudentIds` 会被 `POST /classes/:classId/legacy/tasks/:taskId/claim` 直接修改

风险点：

- 任务领取状态仍依赖数组状态维护，而不是独立 `task_claims`
- 学生引用仍是直接写死在 JSON 中的 `studentId`

### 3.4 藏宝阁 / 祈愿区

- `shop.treasures[]`
- `shop.storage`
- `shop.logs[]`
- `shop.redemptionHistory`
- `shop.dailyRedemptionCounts`
- `shop.dailyUsageCounts`

#### `shop.treasures[]`

字段：

- `id`
- `name`
- `rarity`
- `price`
- `stock`
- `desc`
- `ladderPrices[]`
- `dailyLimit`

说明：

- 同时承担商品配置和实时库存
- `stock` 为运行态字段

#### `shop.storage`

结构：

- `Record<studentId, Record<itemId, count>>`

说明：

- 表示每个学生当前持有的宝物数量
- 被兑换、祈愿、使用、退回直接修改

#### `shop.logs[]`

字段：

- `id`
- `ts`
- `studentName`
- `action`
- `itemName`
- `rarity`
- `cost`
- `note`

说明：

- 属于兼容运行日志
- 同时被前端维护动作和 API 兼容写接口追加

#### `shop.redemptionHistory`

结构：

- `Record<studentId, Record<itemId, count>>`

说明：

- 用于阶梯价格和退回价格计算
- 属于高风险运行态，不建议手工随意改动

#### `shop.dailyRedemptionCounts`

结构：

- `Record<dateKey, Record<itemId, count>>`

说明：

- 记录每日兑换次数
- 主要用于兼容统计与日维度治理

#### `shop.dailyUsageCounts`

结构：

- `Record<dateKey, Record<itemId, count>>`

说明：

- 记录每日使用次数
- 直接影响 `dailyLimit` 校验

### 3.5 双子星 / 对战区

- `battle.version`
- `battle.teams[]`
- `battle.squads[]`
- `battle.battles[]`
- `battle.logs[]`
- `battle.history[]`
- `battle.settlements[]`
- `battle.season`
- `battle.rules`
- `battle.exams[]`
- `battle.teamBaseExamId`
- `battle.settleExamId`

#### `battle.teams[]`

字段：

- `id`
- `name`
- `memberStudentIds[]`
- `points`

说明：

- 同时承载战队配置和实时积分
- `memberStudentIds[]` 仍直接引用学生 ID

#### `battle.squads[]`

字段：

- `id`
- `name`
- `teamIds[]`

说明：

- 用于保留旧版共鸣 / 小队结构

#### `battle.battles[]`

字段：

- `id`
- `teamAId`
- `teamBId`
- `stake`
- `isUnderdog`

说明：

- 表示待结算对局队列
- `legacy/battle/settle` 成功后会被清空

#### `battle.logs[]`

- 兼容区人工维护日志与结算日志

#### `battle.history[]`

- 旧版赛季历史归档
- 当前主要作为兼容承接数据保留

#### `battle.settlements[]`

- 新系统兼容结算结果归档
- 属于恢复与回归时重点核对对象

#### `battle.exams[]`

- 双子星导入的考试快照
- 每条考试内通过 `studentId -> { c, g }` 记录班排、级排

#### `battle.teamBaseExamId` / `battle.settleExamId`

- 指向当前组队基准考试与结算考试
- 属于关键引用字段，恢复和二次迁移时需重点校验

## 4. 当前高风险字段

以下字段最容易在导入、恢复、二次迁移后出现脏引用：

- `tasks[].claimedByStudentIds[]`
- `shop.storage`
- `shop.redemptionHistory`
- `battle.teams[].memberStudentIds[]`
- `battle.squads[].teamIds[]`
- `battle.battles[].teamAId` / `teamBId`
- `battle.exams[].ranks`
- `battle.teamBaseExamId`
- `battle.settleExamId`

## 5. 建议治理方式

按当前阶段建议把 `legacyCompat` 字段分成三类看待：

- 兼容配置：`messages`、`teacherMessages`、`shop.treasures`、`battle.rules`
- 兼容运行态：`tasks[].claimedByStudentIds`、`shop.storage`、`shop.redemptionHistory`、`shop.daily*`、`battle.teams[].points`、`battle.battles`
- 兼容历史归档：`shop.logs`、`battle.logs`、`battle.history`、`battle.settlements`、`battle.exams`

推进顺序建议：

1. 先给运行态字段补边界回归和恢复校验
2. 再把高频运行态逐步移出 `legacyCompat`
3. 最后再收缩 `legacyCompat` 到兼容展示和迁移承接用途
