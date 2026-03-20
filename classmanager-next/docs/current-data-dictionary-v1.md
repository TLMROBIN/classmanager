# 现有数据字典 v1

## 1. 文档目的

本文档用于拆解旧系统当前真实使用中的数据结构，为后续数据库重构、迁移脚本编写和接口设计提供依据。

本文档基于以下来源整理：

- 旧系统 SQLite 数据库 `class_data`
- 当前真实用户数据样本
- 前端状态结构与读写逻辑

本文档的重点不是定义理想模型，而是准确记录“旧系统实际上存了什么”。

## 2. 旧系统存储方式概览

### 2.1 数据库表结构

旧系统业务数据主要保存在 `class_data` 表中：

- `user_id`
- `data_key`
- `data_value`
- `updated_at`

每个用户的业务数据不是结构化表，而是多个 JSON 片段，按 `data_key` 分拆。

### 2.2 当前已存在的主要 data_key

- `__meta`
- `attendanceRecords`
- `battle`
- `config`
- `dailyRedemptionCounts`
- `dailyUsageCounts`
- `history`
- `logs`
- `messages`
- `quotes`
- `redemptionHistory`
- `storage`
- `students`
- `tasks`
- `teacherMessages`
- `treasures`

### 2.3 总体判断

- 这套数据已经形成了完整的“隐式领域模型”
- 但字段约束依赖前端代码，而不是数据库
- 数据之间缺少真正的外键关系
- 同一业务概念同时混有“当前状态”“历史日志”“派生数据”“配置”

## 3. 顶层数据键说明

### 3.1 `__meta`

类型：

- `object`

样例：

```json
{
  "updatedAt": 1773042600521,
  "deviceId": "1772900913145_mjrvqeqy"
}
```

字段说明：

- `updatedAt`: number，毫秒时间戳，表示最后一次整包保存时间
- `deviceId`: string，设备标识，用于同步冲突判断

用途：

- 前端同步比较
- 离线/在线冲突判断

迁移建议：

- 新系统保留“实体版本”和“操作来源设备”概念
- 不再以全局 `__meta` 作为整套业务真相的同步依据

### 3.2 `students`

类型：

- `array`

样例字段：

```json
{
  "id": 1,
  "name": "代韧康",
  "gender": "M",
  "group": "publicity",
  "role": "member",
  "dorm": "boy_715",
  "zizai": 225,
  "balance": 119,
  "penalty": 41,
  "avatar_happy": "data:image/jpeg;base64,..."
}
```

已观察到的核心字段：

- `id`: number，学生主键，系统内广泛引用
- `name`: string，学生姓名
- `gender`: string，`M` / `F`
- `group`: string，小组 ID，如 `publicity`
- `role`: string，组内角色，如 `leader` / `member`
- `dorm`: string，宿舍 ID，如 `boy_715`
- `zizai`: number，累计积分或主积分
- `balance`: number，可消费/当前余额类积分
- `penalty`: number，惩罚值
- `avatar_happy`: string，base64 图片

从代码推断可能还存在的字段：

- `avatar_normal`
- `avatar_sad`
- `titleLeft`
- `titleRight`
- `lastPenaltyAt`

用途：

- 学生档案
- 组织归属
- 当前积分状态
- 头像与展示信息

问题判断：

- 这是一个“混合实体”
- 同时承担了身份信息、组织信息、账户余额、展示信息、策略状态

迁移建议：

- 拆为：
  - `students`
  - `student_group_assignments`
  - `student_dorm_assignments`
  - `student_profiles`
  - `point_accounts`
- 头像不要继续存 base64 到主数据中，应迁到对象存储

### 3.3 `history`

类型：

- `array`

样例：

```json
{
  "id": 1773041250308.9426,
  "ts": 1773041250308,
  "studentId": 5,
  "studentName": "郝栋",
  "val": -1,
  "reason": "语文作业未交 2026-03-08",
  "snapshot": {
    "zizai": 96,
    "balance": -111,
    "penalty": 112.5
  },
  "type": "penalty",
  "scene": "班级",
  "category": "学业"
}
```

核心字段：

- `id`: number，记录 ID，通常由时间戳 + 随机数组成
- `ts`: number，毫秒时间戳
- `studentId`: number，关联学生
- `studentName`: string，冗余学生名
- `val`: number，加减分值
- `reason`: string，业务原因
- `snapshot`: object，操作前快照
- `type`: string，常见为 `bonus` / `penalty`
- `scene`: string，场景，如 `班级`、`宿舍`
- `category`: string，类别，如 `学业`、`纪律`、`出勤`

`snapshot` 子结构：

- `zizai`: number
- `balance`: number
- `penalty`: number

用途：

- 加减分历史
- 撤销依据
- 恢复分数依据
- 部分统计展示

问题判断：

- 当前 `history` 实际上已经非常接近“积分流水”
- 但存在两个问题：
  - 把“回滚前快照”混进同一记录
  - 没有严格的事务来源、操作者和业务对象关联

迁移建议：

- 映射到 `point_transactions`
- `snapshot` 仅作为迁移辅助，不作为新系统事实字段
- 后续增加：
  - `actor_id`
  - `source_module`
  - `source_type`
  - `source_id`
  - `reverted_transaction_id`

### 3.4 `config`

类型：

- `object`

顶层已观察字段：

- `duty`
- `commissioners`
- `lastWageDate`
- `lastPeriodicTaskDate`
- `lastPenaltyReductionDate`
- `frozen`
- `systemConfig`
- `countdownEvents`
- `scheduleNotes`
- `psychologyCommittee`

#### 3.4.1 `duty`

类型：

- `object`

样例：

```json
{
  "mon": ["谢宇欣", "胡诺翔"],
  "tue": ["陈正岳"],
  "wed": ["庄锐生"],
  "thu": ["陈可欣"],
  "fri": ["刘梦颖"]
}
```

说明：

- 工作日值日安排
- 值为姓名数组，不是学生 ID

迁移建议：

- 新系统改为基于学生 ID 的排班表

#### 3.4.2 `commissioners`

类型：

- `object`

样例：

```json
{
  "noise": 20,
  "desk": 18,
  "tablet": 17,
  "outdoor": 16,
  "attend": 21,
  "homework": 19
}
```

说明：

- 专员角色到学生 ID 的映射

迁移建议：

- 映射到 `student_positions`

#### 3.4.3 日期状态字段

- `lastWageDate`: string，最近工资发放日期
- `lastPeriodicTaskDate`: string，最近周期任务处理日期
- `lastPenaltyReductionDate`: string，最近惩罚衰减日期

迁移建议：

- 迁入策略执行记录表，不应继续混在班级配置内

#### 3.4.4 `frozen`

类型：

- `boolean`

说明：

- 系统冻结状态，影响部分自动策略

迁移建议：

- 保留为班级级策略开关

#### 3.4.5 `psychologyCommittee`

类型：

- `array`

说明：

- 心理委员配置，可能是学生 ID 数组或占位数组

迁移建议：

- 归入 `student_positions`

#### 3.4.6 `countdownEvents`

类型：

- `array`

说明：

- 倒计时事件配置

迁移建议：

- 归入班级展示/公告配置

#### 3.4.7 `scheduleNotes`

类型：

- `object`

说明：

- 课表或日程备注

迁移建议：

- 归入班级配置扩展表

#### 3.4.8 `systemConfig`

类型：

- `object`

该对象是旧系统最复杂的配置核心，已观察到如下结构：

- `className`
- `adminPassword`
- `quotes`
- `recordCategoryPendingMigrated`
- `enabledFeatures`
- `attendance`
- `organization`
- `points`
- `treasures`
- `subjects`

##### a. `className`

- string，班级显示名

##### b. `adminPassword`

- string，旧系统前端管理员密码

问题判断：

- 高风险字段
- 不应迁移为新系统真实密码

##### c. `quotes`

- `array<string>`，励志语录

##### d. `recordCategoryPendingMigrated`

- boolean，旧版本兼容标志位

迁移建议：

- 迁移后可废弃

##### e. `enabledFeatures`

样例：

```json
{
  "battle": true
}
```

说明：

- 功能开关

##### f. `attendance`

类型：

- `object`

包含：

- `schedule`
- `weekendRules`
- `sundaySpecialLateTime`
- `penaltyRules`

`schedule` 样例：

```json
[
  { "id": "morning", "name": "早读", "start": "06:00", "end": "07:20", "lateTime": "07:00" }
]
```

`weekendRules` 样例：

```json
{
  "monday": [0, 1, 2],
  "friday": [0, 1],
  "saturday": [],
  "sunday": [2]
}
```

`sundaySpecialLateTime` 样例：

```json
{
  "evening": "19:00"
}
```

`penaltyRules` 样例：

```json
{
  "late": -1,
  "absent": -5,
  "perfectAttendance": 10
}
```

迁移建议：

- 拆为 `attendance_schedules`、`attendance_policies`

##### g. `organization`

类型：

- `object`

包含：

- `groups`
- `dorms`
- `commissionerRoles`

`groups` 元素样例：

```json
{
  "id": "publicity",
  "name": "🎨 宣传组",
  "color": "bg-pink-100 text-pink-800 border-pink-200"
}
```

`dorms` 元素样例：

```json
{
  "id": "boy_715",
  "name": "👦 715"
}
```

`commissionerRoles` 元素样例：

```json
{
  "id": "noise",
  "name": "噪音专员"
}
```

迁移建议：

- 拆为组织字典表和岗位字典表

##### h. `points`

类型：

- `object`

包含：

- `reasons`

`reasons` 元素样例：

```json
{
  "name": "每日工资",
  "val": 5,
  "type": "bonus",
  "note": "组长+6",
  "scene": "班级",
  "category": "班务"
}
```

可见字段：

- `name`
- `val`
- `type`
- `note`
- `scene`
- `category`
- `editable`
- `isMulti`
- `factor`

迁移建议：

- 映射到 `point_reason_templates`

##### i. `treasures`

类型：

- `array`

这是默认商品配置，不等同于运行时 `treasures`

##### j. `subjects`

类型：

- `array`

元素样例：

```json
{
  "id": "chinese",
  "name": "语文",
  "representatives": []
}
```

迁移建议：

- 映射到 `subjects`

### 3.5 `attendanceRecords`

类型：

- `object`

结构层级：

```text
date -> studentName -> sessionId -> record
```

样例：

```json
{
  "2026-03-06": {
    "代韧康": {
      "morning": {
        "status": "absent",
        "checkTime": "缺勤",
        "timestamp": 1772936775591
      }
    }
  }
}
```

记录字段：

- `status`: string，常见如 `present` / `late` / `absent`
- `checkTime`: string，签到时间文本或“缺勤”
- `timestamp`: number，写入时间戳

问题判断：

- 学生使用姓名而不是 ID 作为二级键，存在重名和改名风险
- 日期与时段作为嵌套对象键，不利于查询和约束

迁移建议：

- 拆为：
  - `attendance_sessions`
  - `attendance_records`
- 统一使用学生 ID

### 3.6 `treasures`

类型：

- `array`

样例：

```json
{
  "id": 1,
  "name": "什么都没有卡",
  "rarity": "N",
  "price": 1,
  "stock": 969,
  "desc": "字面意义"
}
```

已观察字段：

- `id`: number 或时间戳型数字
- `name`: string
- `rarity`: string，如 `N` / `R` / `SR` / `SSR`
- `price`: number
- `stock`: number
- `desc`: string

从代码推断可能还存在的字段：

- `ladderPrices`: array
- `dailyLimit`: number

说明：

- 这是当前生效商品清单
- 与 `config.systemConfig.treasures` 不同，后者更像默认模板

迁移建议：

- 映射到 `shop_items`

### 3.7 `storage`

类型：

- `object`

结构层级：

```text
studentId -> itemId -> quantity
```

样例：

```json
{
  "2": {
    "2": 6,
    "7": 1,
    "11": 1
  }
}
```

说明：

- 表示每个学生当前持有的商品数量

问题判断：

- 这是库存余额，不是交易事实
- 无法单独说明来源、时间和操作人

迁移建议：

- 映射到 `inventory_balances`
- 来源与变化应从兑换/使用/退货明细表重建

### 3.8 `logs`

类型：

- `array`

样例：

```json
{
  "id": 1772971006205.508,
  "ts": 1772971006205,
  "studentName": "陈妍",
  "action": "兑换",
  "itemName": "陈妍",
  "rarity": "SSR",
  "cost": 75,
  "note": ""
}
```

已观察字段：

- `id`: number
- `ts`: number
- `studentName`: string
- `action`: string，如 `兑换` / `使用` / `退宝物` / `管理`
- `itemName`: string
- `rarity`: string
- `cost`: number
- `note`: string

说明：

- 这是藏宝阁相关操作日志
- 同时混有用户操作和管理员管理日志

迁移建议：

- 拆为：
  - `redemption_orders`
  - `item_usage_records`
  - `inventory_adjustment_logs`

### 3.9 `redemptionHistory`

类型：

- `object`

结构层级：

```text
studentId -> itemId -> count
```

样例：

```json
{
  "2": {
    "2": 9,
    "15": 1
  }
}
```

说明：

- 记录学生历史兑换次数

问题判断：

- 这是统计结果，不是原始订单

迁移建议：

- 由 `redemption_orders` 聚合生成
- 不建议作为新系统主存储事实

### 3.10 `dailyRedemptionCounts`

类型：

- `object`

当前样本：

```json
{}
```

推断结构：

```text
date -> itemId -> count
```

迁移建议：

- 由订单表实时聚合或缓存生成

### 3.11 `dailyUsageCounts`

类型：

- `object`

样例：

```json
{
  "2026-01-03": { "2": 2 },
  "2026-01-06": { "2": 1, "1767658460498": 8 }
}
```

结构层级：

```text
date -> itemId -> count
```

说明：

- 记录某一天某商品被使用的次数
- 用于限制每日使用上限

迁移建议：

- 由 `item_usage_records` 聚合生成

### 3.12 `messages`

类型：

- `array`

样例：

```json
{
  "id": 1768371802233,
  "content": "问如何才能让果冻中准点上床",
  "time": "14:23",
  "date": "2026-01-14"
}
```

字段：

- `id`: number
- `content`: string
- `time`: string
- `date`: string

说明：

- 学生留言

迁移建议：

- 如果保留，迁到消息/公告模块

### 3.13 `teacherMessages`

类型：

- `array`

当前样本为空数组：

```json
[]
```

说明：

- 教师留言

迁移建议：

- 与 `messages` 统一建模为消息表，加 `author_type`

### 3.14 `quotes`

类型：

- `array<string>`

样例：

```json
[
  "每个人当下的生活，是十年前的自己决定的。",
  "当你陷入困境时，告诉自己：“这是一个励志故事的开始”"
]
```

说明：

- 励志语录集合

迁移建议：

- 迁入 `class_quotes` 或配置扩展表

### 3.15 `tasks`

类型：

- `array`

样例：

```json
{
  "id": 1768746330780,
  "title": "复盘的复盘",
  "desc": "复盘上一次复盘中同学复盘的内容",
  "points": 25,
  "startTime": "2026-01-18T22:25",
  "endTime": "2026-01-23T22:25",
  "claimedBy": []
}
```

已观察字段：

- `id`: number
- `title`: string
- `desc`: string
- `points`: number
- `startTime`: string，ISO 或本地时间格式
- `endTime`: string，ISO 或本地时间格式
- `claimedBy`: array，学生 ID 列表，但当前业务基本只允许一人领取

问题判断：

- 时间格式不统一
- 领取与任务本体耦合在一起

迁移建议：

- 拆为：
  - `tasks`
  - `task_claims`

### 3.16 `battle`

类型：

- `object`

顶层已观察字段：

- `version`
- `teams`
- `squads`
- `battles`
- `logs`
- `history`
- `settlements`
- `season`
- `rules`
- `exams`
- `teamBaseExamId`
- `settleExamId`

#### 3.16.1 `teams`

元素样例：

```json
{
  "id": "t1",
  "name": "安慕希",
  "memberIds": [10, 12],
  "points": 50
}
```

字段：

- `id`: string
- `name`: string
- `memberIds`: array<number>
- `points`: number

#### 3.16.2 `squads`

元素样例：

```json
{
  "id": "sq1",
  "name": "引力场A",
  "teamIds": ["t2", "t11"]
}
```

说明：

- 队伍分区/分组配置

#### 3.16.3 `battles`

元素样例：

```json
{
  "id": 1767444295478,
  "teamAId": "t4",
  "teamBId": "t1",
  "stake": 10,
  "isUnderdog": true
}
```

字段：

- `id`: number
- `teamAId`: string
- `teamBId`: string
- `stake`: number
- `isUnderdog`: boolean

#### 3.16.4 `logs`

元素样例：

```json
{
  "time": "10:18:43",
  "msg": "安慕希 下克上失败 / XAVI 常规胜 ..."
}
```

说明：

- 展示型日志，包含 HTML 片段或富文本字符串

#### 3.16.5 其他字段

- `history`: array，对战历史赛季数据
- `settlements`: array，结算记录
- `season`: number，当前赛季编号
- `rules`: object，对战规则
- `exams`: array，考试成绩数据
- `teamBaseExamId`: string，组队依据考试 ID
- `settleExamId`: string，结算依据考试 ID

迁移建议：

- 拆为：
  - `battle_seasons`
  - `battle_teams`
  - `battle_team_members`
  - `battle_squads`
  - `battle_matches`
  - `battle_settlements`
  - `battle_exams`
  - `battle_logs`

## 4. 数据之间的隐含关系

旧系统存在以下强依赖关系，但数据库并未显式表达：

- `history.studentId` -> `students.id`
- `config.commissioners[*]` -> `students.id`
- `storage.<studentId>` -> `students.id`
- `redemptionHistory.<studentId>` -> `students.id`
- `tasks.claimedBy[]` -> `students.id`
- `battle.teams.memberIds[]` -> `students.id`
- `attendanceRecords.<date>.<studentName>` -> `students.name`

问题判断：

- 这些关联几乎全部靠前端内存维持
- 其中 `attendanceRecords` 使用姓名关联是最脆弱的一类

## 5. 数据风险清单

### 5.1 标识不统一

- 有的地方用学生 ID
- 有的地方用学生姓名
- 有的地方用字符串化数字

### 5.2 时间格式不统一

- 毫秒时间戳
- `YYYY-MM-DD`
- `HH:mm`
- `datetime-local`
- ISO 时间字符串

### 5.3 同一业务既存原始数据又存派生统计

例如：

- `storage` 是余额
- `redemptionHistory` 是累计统计
- `dailyUsageCounts` 是日聚合
- `logs` 是操作日志

这导致数据重复与一致性风险上升。

### 5.4 展示字段混入业务主数据

例如：

- 学生头像 base64
- 对战日志富文本
- 商品说明与展示稀有度

### 5.5 管理与业务配置混杂

例如：

- `adminPassword`
- `recordCategoryPendingMigrated`
- 默认模板数据
- 运行中生效数据

## 6. 新系统迁移映射总表

| 旧键 | 旧含义 | 新系统建议落点 |
| --- | --- | --- |
| `__meta` | 全局同步元信息 | 实体版本、设备来源、同步日志 |
| `students` | 学生主数据 + 当前积分 + 展示信息 | `students` / `student_profiles` / `point_accounts` |
| `history` | 积分变更历史 | `point_transactions` |
| `config` | 班级配置、规则、策略状态 | `class_configs` / `attendance_policies` / `point_reason_templates` / `subjects` / `positions` |
| `attendanceRecords` | 考勤原始记录 | `attendance_sessions` / `attendance_records` |
| `treasures` | 生效商品清单 | `shop_items` |
| `storage` | 学生持有物品余额 | `inventory_balances` |
| `logs` | 商城相关操作日志 | `redemption_orders` / `item_usage_records` / `inventory_adjustment_logs` |
| `redemptionHistory` | 学生兑换累计 | 聚合视图 |
| `dailyRedemptionCounts` | 每日兑换统计 | 聚合视图或缓存 |
| `dailyUsageCounts` | 每日使用统计 | 聚合视图或缓存 |
| `messages` | 学生留言 | `messages` |
| `teacherMessages` | 教师留言 | `messages` |
| `quotes` | 励志语录 | `class_quotes` |
| `tasks` | 任务本体 + 领取状态 | `tasks` / `task_claims` |
| `battle` | 对战全量状态 | `battle_*` 系列表 |

## 7. 本文档结论

### 7.1 旧系统最核心的事实数据

从迁移角度，最应优先保障的不是全部 JSON，而是这些真实核心事实：

- 学生档案
- 积分流水
- 考勤原始记录
- 当前配置
- 商品清单与库存余额
- 任务定义与领取关系
- 对战赛季核心结构

### 7.2 需要谨慎迁移的数据

- `snapshot`
- `adminPassword`
- `recordCategoryPendingMigrated`
- base64 头像
- 各类统计型计数对象
- 展示型日志

### 7.3 下一份文档

基于本数据字典，下一步应输出《目标数据库 schema 初稿 v1》，把以下内容正式定下来：

- PostgreSQL 核心表
- 主键、外键、唯一约束
- 审计与事务表
- 迁移最小闭环表集

