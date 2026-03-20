# 导出任务模型 v1

## 1. 目的

本文档定义结构化导出从“同步接口 + 文件脚本”演进到“异步任务”所需的最小任务模型。

目标不是立刻实现完整任务中心，而是冻结下一阶段的实现边界。

## 2. 为什么要任务化

当前导出链路已经具备：

- 结构化导出接口
- 按域导出
- 时间范围过滤
- 导出审计
- 文件落盘
- `manifest` 清单

但它仍然是同步模式，存在这些限制：

- 导出请求和生成过程强耦合
- 不适合更大数据量
- 不能稳定支持重试
- 不能表达排队、处理中、失败、过期等状态

## 3. 最小任务目标

第一阶段任务化只解决 4 件事：

1. 记录导出请求
2. 生成导出文件
3. 记录任务状态
4. 提供任务查询

第一阶段明确不做：

- 分布式队列
- 多 worker 并发控制
- 对象存储上传
- 下载签名 URL

## 4. 最小任务实体

建议新增实体：

- `export_jobs`

最小字段建议：

- `id`
- `tenant_id`
- `class_id`
- `requested_by_user_id`
- `requested_by_membership_id`
- `job_type`
- `export_type`
- `filters`
- `status`
- `output_path`
- `manifest_entry`
- `error_message`
- `started_at`
- `finished_at`
- `created_at`
- `updated_at`

## 5. 第一阶段状态机

建议状态：

- `queued`
- `running`
- `succeeded`
- `failed`
- `expired`

状态流转：

1. 用户创建任务 -> `queued`
2. worker 开始执行 -> `running`
3. 文件生成成功 -> `succeeded`
4. 执行失败 -> `failed`
5. 文件过期清理 -> `expired`

## 6. 与现有能力的关系

### 6.1 与 `audit_logs`

`audit_logs` 继续保留，职责是：

- 记录谁导出了什么
- 记录范围
- 记录结果摘要

`export_jobs` 的职责是：

- 表示一个任务实例
- 提供任务状态
- 提供重试与清理基础

### 6.2 与 `manifest.json`

第一阶段可以继续保留 `manifest.json`，作为：

- 文件落盘清单
- 本地开发期兼容层

进入正式任务化后，`manifest` 不再是唯一事实来源，应逐步退为：

- 本地缓存
- 调试辅助

### 6.3 与现有 `/exports/summary` 和 `/exports/history`

下一阶段这两个接口建议改成：

- 优先读 `export_jobs`
- 补充读取 `audit_logs`
- 本地开发模式下可兼容读取 `manifest`

当前状态：

- 已实现为“`export_jobs` 优先，`manifest` 兼容回退”

## 7. 第一阶段接口建议

建议新增：

- `POST /api/classes/:classId/export-jobs`
- `GET /api/classes/:classId/export-jobs`
- `GET /api/export-jobs/:jobId`

当前返回建议至少包含：

- `id`
- `status`
- `exportType`
- `filters`
- `createdAt`
- `startedAt`
- `finishedAt`
- `outputPath`
- `errorMessage`

## 8. 第一阶段执行方式

最保守实现顺序：

1. 先写 `export_jobs` 表
2. 先做“同步创建 + 同步执行 + 落状态”
3. 再把现有文件脚本接成一个内部执行器
4. 最后再考虑真正的后台 worker

这样能保证：

- 不引入太多并发复杂度
- 可以复用当前导出接口和文件脚本
- 仍然保持可审计

## 9. 推荐分期

### 9.1 Phase A

目标：

- `export_jobs` 入库
- 任务状态可查
- 继续同步执行

当前状态：

- 已实现
- 当前接口：
  - `POST /api/classes/:classId/export-jobs`
  - `GET /api/classes/:classId/export-jobs`
  - `GET /api/export-jobs/:jobId`
- 当前执行层：
  - `apps/api/src/modules/exports/executor.ts`
  - 已从路由中抽离 `createQueuedStructuredExportJob(...)` 和 `runStructuredExportJob(...)`
  - 当前仍为同步执行，但已经具备后续接 worker 的复用边界
- 当前基础设施层：
  - `apps/api/src/modules/exports/service.ts`
  - 已承接导出文件路径、`manifest` 维护和导出审计写入
  - 已承接 `export_jobs`、`audit_logs`、`manifest` 的 summary/history 查询聚合
  - 已承接班级访问校验与导出类上下文装配
  - 路由层只保留鉴权、参数解析和响应组织
- 当前装配层：
  - `apps/api/src/modules/exports/builder.ts`
  - 已承接 `settings / students / points / attendance / homework / full` 的结构化导出内容组装
  - 后续如需接 worker，只需要复用 builder 和 executor，不需要再从路由中剥离业务装配
- 当前测试基线：
  - `apps/api/src/modules/exports/builder.test.ts`
  - `apps/api/src/modules/exports/service.test.ts`
  - `apps/api/src/modules/exports/executor.test.ts`
  - 已覆盖导出输出路径生成、`manifest` 去重与按班级聚合
  - 已覆盖 `queued -> running -> succeeded/failed` 的任务状态流转
  - 已覆盖 `points / homework / full` 的结构化导出内容装配
  - `@classmanager/api` 已接入 `node:test` 最小测试命令
- 当前配套脚本：
  - `npm run export:cleanup`

当前清理策略：

- 默认 dry-run
- `--apply` 才会把过期任务标记为 `expired`
- `--remove-files` 才会同时删除过期文件

当前运维策略文档：

- `docs/export-job-operations-v1.md`

### 9.2 Phase B

目标：

- API 创建任务只入队
- 独立 worker 执行
- 失败可重试

准备文档：

- `docs/export-download-policy-v1.md`

### 9.3 Phase C

目标：

- 文件清理策略
- 更完整的下载授权
- 对象存储

当前状态补充：

- Phase A 已补齐“创建导出任务需具备导出写权限”
- Phase A 已补齐“下载仅允许任务创建者或有管理权限的成员”
- 更细粒度的授权、签名 URL 与对象存储仍属于后续阶段

## 10. 当前结论

导出链路已经完成“结构化 + 审计 + 文件 + 清单”四层基线。

下一阶段不应直接跳到复杂队列系统，而应先实现：

- `export_jobs`
- 状态机
- 查询接口

这是最小、最稳妥的任务化切入点。
