# 结构化导出 Schema v1

## 1. 目的

本文档用于冻结当前结构化导出接口的字段边界，避免后续在未经过兼容评估的情况下随意变更返回结构。

当前基线对应：

- `GET /api/classes/:classId/exports/structured`
- `GET /api/classes/:classId/exports/summary`
- `GET /api/classes/:classId/exports/history`

## 2. 顶层公共字段

`structured` 导出返回统一包含：

- `schemaVersion`
- `exportType`
- `exportedAt`
- `tenant`
- `class`
- `counts`

其中：

- `schemaVersion` 当前固定为 `classmanager.export.v1`
- `exportType` 当前取值：
  - `full`
  - `settings`
  - `students`
  - `points`
  - `attendance`
  - `homework`

## 3. 顶层对象约定

### 3.1 tenant

- `id`
- `name`
- `slug`

### 3.2 class

- `id`
- `name`
- `code`
- `timezone`

### 3.3 filters

仅在以下导出中出现：

- `points`
- `attendance`
- `homework`
- `full`

当前字段：

- `dateFrom`
- `dateTo`

## 4. 各导出域字段

### 4.1 settings

包含：

- `classConfig`
- `featureFlags`
- `groups`
- `dormitories`
- `positions`
- `reasonTemplates`
- `attendancePolicy`
- `attendanceSchedules`

当前 `counts`：

- `groups`
- `dormitories`
- `positions`
- `reasonTemplates`
- `attendanceSchedules`

### 4.2 students

当前返回数组，每个学生包含：

- 基础字段：
  - `id`
  - `legacyId`
  - `studentNo`
  - `name`
  - `gender`
  - `status`
  - `sortOrder`
  - `joinedAt`
  - `leftAt`
- `profile`
  - `titleLeft`
  - `titleRight`
  - `notes`
  - `avatarHappyData`
  - `avatarNormalData`
  - `avatarSadData`
- `account`
- `groups`
- `dorms`
- `positions`

当前 `counts`：

- `students`

### 4.3 points

包含：

- `transactions`

每条流水当前包含：

- `id`
- `studentId`
- `transactionType`
- `value`
- `reason`
- `scene`
- `category`
- `sourceModule`
- `sourceType`
- `occurredAt`
- `isReverted`
- `revertedByTransactionId`
- `legacyNumericId`
- `metadata`
- `reasonTemplateId`

当前 `counts`：

- `pointTransactions`

### 4.4 attendance

包含：

- `sessions`
- `records`

`sessions` 当前字段：

- `id`
- `scheduleId`
- `sessionDate`
- `sessionCode`
- `plannedStartAt`
- `plannedEndAt`
- `lateDeadlineAt`
- `status`

`records` 当前字段：

- `id`
- `attendanceSessionId`
- `studentId`
- `status`
- `checkInAt`
- `recordedAt`
- `source`
- `note`
- `pointTransactionId`
- `legacyStudentName`
- `legacyTimestamp`

当前 `counts`：

- `attendanceSessions`
- `attendanceRecords`

### 4.5 homework

包含：

- `events`

每条作业事件当前字段：

- `id`
- `occurredAt`
- `transactionType`
- `value`
- `reason`
- `scene`
- `category`
- `subjectName`
- `homeworkDate`
- `eventType`
- `student`

当前 `counts`：

- `homeworkEvents`
- `missingCount`
- `registerCount`

## 5. full 导出规则

`full` 当前由以下子域组合而成：

- `settings`
- `students`
- `points`
- `attendance`
- `homework`

其 `counts` 为各子域 `counts` 的平铺组合，不再代表“前端整包状态”。

## 6. summary / history 约定

### 6.1 summary

返回：

- `manifestUpdatedAt`
- `classId`
- `latestAudit`
- `manifestSummary`
- `recentAudits`

### 6.2 history

返回：

- `classId`
- `manifestUpdatedAt`
- `items`
- `audits`

## 7. 兼容性规则

从本版本起，以下变更视为破坏性变更：

- 删除已有顶层字段
- 删除已有 counts 字段
- 修改既有字段语义
- 把字符串数值改回原始 Decimal/BigInt 表示

允许的非破坏性变更：

- 新增可选字段
- 新增新的导出域
- 在 `metadata` 或 manifest 扩展附加信息

## 8. 当前结论

`structured export v1` 已可视为当前新系统导出能力的第一版冻结格式。
后续如果要进入异步任务化或管理后台展示，应默认基于本文件保持兼容。
