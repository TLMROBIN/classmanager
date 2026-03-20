# 结构化导出路线 v1

## 1. 当前目标

新系统的导出能力不再沿用旧系统“大 JSON 快照”模式，而是改为按业务域输出结构化数据。

当前第一阶段只覆盖已经完成迁移并具备真实数据支撑的核心域：

- `settings`
- `students`
- `points`
- `attendance`
- `homework`

## 2. 当前接口

- `GET /api/classes/:classId/exports/structured`
- `GET /api/classes/:classId/exports/summary`
- `GET /api/classes/:classId/exports/history`

支持查询参数：

- `domain=full`
- `domain=settings`
- `domain=students`
- `domain=points`
- `domain=attendance`
- `domain=homework`
- `dateFrom=YYYY-MM-DD`
- `dateTo=YYYY-MM-DD`

未传时默认 `full`。

当前 `dateFrom / dateTo` 只作用于：

- `points`
- `attendance`
- `homework`
- `full` 中的 `points`、`attendance`、`homework` 子域

`summary / history` 用于读取：

- 文件导出 manifest
- 导出审计日志

## 3. 当前设计原则

### 3.1 导出按域组织

每个导出包只包含：

- 通用头信息
- 当前导出域的计数
- 当前导出域的数据体

`full` 导出只是把多个域组合在一个包里，不再代表“系统完整状态快照”。

### 3.2 导出内容结构化

当前导出统一包含：

- `schemaVersion`
- `exportType`
- `exportedAt`
- `tenant`
- `class`
- `counts`
- 具体域数据

### 3.3 不混入前端运行态

导出中明确不包含：

- 页面状态
- 本地缓存
- 浏览器选择项
- 临时 UI 配置

### 3.4 文件导出维护 manifest

当前文件导出脚本会维护：

- `out/structured-exports/manifest.json`

用于记录最近导出的：

- 输出文件路径
- 导出域
- 过滤条件
- 计数摘要

同时维护：

- `byClass` 聚合摘要

用于记录每个班级最近一次导出、累计导出次数和导出域分布。

## 4. 当前适用场景

第一阶段主要用于：

- 班级数据人工核对
- 迁移后比对
- 结构化备份验证
- 后续异步导出任务的格式基线
- 导出审计基线
- 文件级导出清单基线

## 5. 后续计划

下一阶段再考虑：

- 异步导出任务与文件落盘

当前字段边界冻结文档见：

- `docs/structured-export-schema-v1.md`
- `docs/export-job-model-v1.md`

## 6. 当前限制

当前导出仍直接走同步接口返回 JSON，适合：

- 小规模班级数据
- 本地重构验证
- 结构检查

不适合直接作为最终商业化大规模导出方案。
