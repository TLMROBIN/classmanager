# 导出模块实现说明 v1

## 1. 当前目标

当前导出模块的目标不是一次性做到完整任务中心，而是先把“结构化导出 + 审计 + 文件落盘 + 任务记录 + 有边界的恢复能力”收成稳定、可继续演进的实现底座。

## 2. 当前分层

### 2.1 路由层

文件：

- `apps/api/src/modules/exports/routes.ts`

职责：

- 鉴权
- 参数解析
- 调用访问控制、装配、执行、查询 service
- 组织 HTTP 响应

### 2.2 装配层

文件：

- `apps/api/src/modules/exports/builder.ts`

职责：

- 组装 `settings / students / points / attendance / homework / full`
- 做数值归一化
- 做作业事件提炼
- 生成结构化导出体

### 2.3 恢复层

文件：

- `apps/api/src/modules/exports/restore.ts`

职责：

- 校验 `structured full export v1` 恢复输入
- 生成恢复计划与范围说明
- 在事务内执行班级级别的结构化全量恢复
- 为恢复链路写入 `import_jobs`

### 2.4 执行层

文件：

- `apps/api/src/modules/exports/executor.ts`

职责：

- 创建 `queued` 任务
- 驱动 `running -> succeeded / failed`
- 写出导出文件
- 回写任务摘要和状态

### 2.5 基础设施与查询层

文件：

- `apps/api/src/modules/exports/service.ts`

职责：

- 班级访问校验
- 导出输出路径
- `manifest.json` 读写
- 导出审计写入
- `export_jobs` 列表/详情
- `summary / history` 聚合

## 3. 当前接口

- `GET /api/classes/:classId/exports/structured`
- `GET /api/classes/:classId/exports/summary`
- `GET /api/classes/:classId/exports/history`
- `POST /api/classes/:classId/export-jobs`
- `GET /api/classes/:classId/export-jobs`
- `POST /api/classes/:classId/exports/structured-full/restore`
- `GET /api/export-jobs/:jobId`
- `GET /api/export-jobs/:jobId/download`

## 4. 当前测试覆盖

- `apps/api/src/modules/exports/service.test.ts`
- `apps/api/src/modules/exports/executor.test.ts`
- `apps/api/src/modules/exports/builder.test.ts`
- `apps/api/src/modules/exports/routes.test.ts`

覆盖范围：

- 输出路径生成
- 下载成功 / 过期 / 文件缺失 / 非授权下载拒绝
- `structured full restore` 的权限拒绝与非法 payload 拒绝
- `manifest` 去重与聚合
- `queued -> running -> succeeded / failed`
- `points / homework / full` 的导出装配

## 5. 当前结论

导出模块已经从“大路由文件”收成了可维护分层，并且已经具备最小前端任务面：

- 创建导出任务
- 查看最近任务/摘要/审计
- 最近任务支持按导出域 / 状态 / 归属 / 日期范围 / 关键词筛选
- 最近任务支持当前筛选结果的状态/可下载数量摘要
- 导出清单支持按任务 / manifest 来源、导出域、关键词筛选
- 导出清单支持按日期范围筛选
- 导出审计支持按动作 / 关键词 / 日期范围筛选
- 导出清单与审计支持当前筛选结果摘要
- 下载成功任务文件
- 仅允许有导出写权限的成员创建原始导出
- 下载仅允许任务创建者或有管理权限的成员执行
- 维护中心可下载结构化全量备份 JSON
- 仅允许有导出写权限的成员执行 `structured full export v1` 范围内的全量恢复

当前恢复范围说明：

- 会覆盖：班级配置、小组/宿舍/岗位、模板、功能开关、学生、学生档案标题/备注/头像映射、积分流水、考勤场次/记录
- 不会恢复：后台成员、审计日志、导入导出任务

下一阶段如果接独立 worker，可以直接复用：

- `builder.ts`
- `executor.ts`
- `service.ts`

不需要再从路由层做二次拆分。
