# 迁移 Warning 策略 v1

## 1. 目的

本文档用于定义旧系统迁移过程中出现的 warning 如何分级、如何处理，以及哪些 warning 会阻断真实导入。

本策略适用于：

- `legacy:transform`
- `normalized:validate`
- 后续真实导入器

## 2. 分级定义

### `blocker`

含义：

- 不允许进入真实导入
- 必须人工确认或修复

典型场景：

- 核心引用断裂
- 学生、班级、租户主键映射缺失
- 积分流水无法定位学生
- 考勤记录无法定位场次且无法恢复

### `review`

含义：

- 不阻断标准化输出
- 不自动导入对应字段或记录
- 必须进入人工复核清单

典型场景：

- 历史姓名无法映射到当前学生
- 旧字段格式不统一
- 配置中引用了不存在的学生

### `info`

含义：

- 仅提示
- 不阻断导入

典型场景：

- 头像仍为 base64，需要后续资产迁移
- 历史展示字段尚未结构化

## 3. 当前规则

### 3.1 Base64 头像

- 识别条件：`contains base64 avatar data`
- 当前等级：`info`
- 当前策略：
  - 学生主记录允许导入
  - 头像资产不进入首轮数据库写入
  - 后续单独做对象存储迁移

### 3.2 考勤姓名无法映射

- 识别条件：`Attendance entry could not resolve student id`
- 当前等级：`review`
- 当前策略：
  - 不直接写入正式 `attendance_records`
  - 先保留在中间文件与复核报告
  - 后续增加“归档学生”或“历史姓名映射表”后再处理

### 3.3 配置中的岗位引用缺失

- 识别条件：`Commissioner ... references missing student`
- 当前等级：`review`
- 当前策略：
  - 岗位字典可导入
  - 岗位任命关系跳过
  - 写入复核清单

### 3.4 引用完整性错误

- 识别条件：
  - `*.missing_student`
  - `*.missing_group`
  - `*.missing_dorm`
  - `*.missing_position`
  - `*.missing_session`
- 当前等级：`blocker`
- 当前策略：
  - 禁止真实导入

## 4. 首轮真实导入范围

为了降低风险，首轮真实导入只允许以下数据进入 PostgreSQL：

- tenant
- user
- class
- groups
- dormitories
- positions
- students
- pointAccounts
- pointReasonTemplates
- pointTransactions
- attendancePolicy
- attendanceSchedules
- classConfig
- featureFlags

以下数据默认不进入首轮真实导入：

- studentProfiles 中的头像资产
- 无法映射学生的 attendanceRecords
- tasks
- shop
- battle

## 5. 真实导入前置条件

必须同时满足以下条件：

1. `normalized:validate` 无 `error`
2. `review` 级 warning 已人工确认
3. 导入器处于事务模式
4. 导入器支持 `--dry-run`
5. 导入器支持幂等键或映射表
6. 目标库为新系统独立 PostgreSQL，不是旧系统库

## 6. 当前结论

按当前样本数据：

- base64 头像不阻断
- 历史考勤姓名不匹配不允许自动导入考勤明细
- 真实导入应先做“学生 + 积分 + 配置”的安全子集

