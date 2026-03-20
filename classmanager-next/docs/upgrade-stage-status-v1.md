# 升级改造阶段状态说明 v1

## 1. 当前结论

截至当前阶段，新系统已经从“核心模块只读可看”推进到“核心高频写操作已具备基础闭环，并补齐了一轮前端治理能力”。

按当前目标定义，初始升级目标已经完成，可配合 `docs/initial-goal-completion-v1.md` 一起查看。

当前可认为已经完成的阶段目标：

- 学生、积分、考勤、作业、设置五个核心教学管理模块已形成稳定读面
- 积分、考勤、作业、设置、学生档案都已进入可操作状态
- 旧功能兼容区已接住留言、任务、藏宝阁、祈愿、双子星主流程
- 管理后台与导出任务中心已具备最小可用治理界面
- 维护中心已具备常用导入导出、快照、测试模式与全量备份恢复入口
- 核心页面已补齐一轮筛选、摘要、预览、确认提示等治理能力
- 相关实现文档和进度矩阵已同步到当前真实状态

## 2. 已完成范围

### 2.1 学生档案

- 新增学生
- 学生基础资料编辑
- 主小组 / 主宿舍 / 岗位调整
- 批量岗位 / 小组 / 宿舍 / 状态调整
- 组织调整预览
- 学生详情最近积分记录筛选与摘要

### 2.2 积分手工调整

- 单人手工加减分
- 最小批量加减分
- 历史批量按 `batchId` 修正
- 单条撤销
- 最近批量撤销
- 按审计统一撤销
- 历史批量按 `batchId` 撤销
- 最近积分操作与历史批量调整的筛选、搜索、摘要治理

### 2.3 考勤写操作

- 考勤时段配置增改停用与排序
- 考勤规则 3 项核心数值编辑
- 周规则编辑与周日特殊迟到时间编辑
- 新建场次
- 新建场次按日期过滤可选时段
- 单条补录 / 批量补录
- 单条修正 / 批量修正
- 跨场次异常工作台（含请假）/ 跨场次批量修正 / 跨场次缺勤结算
- 单条撤销 / 批量撤销 / 审计撤销
- 场次结算与最近结算撤销
- 周全勤奖发放与最近一次撤销
- 历史场次、场次明细、异常工作台、最近操作、历史批量操作的筛选与摘要治理

### 2.4 作业写操作

- 单学生作业登记
- 最小批量作业登记
- 单条撤销
- 审计统一撤销
- 历史批量按 `batchId` 撤销
- 最近操作、明细、学生统计、历史批量的筛选、排序、确认提示治理

### 2.5 设置写操作

- 班级基础配置编辑
- 班级冻结 / 解冻
- 课程备注整体更新
- 倒计时事件整体更新
- 工资基础分 / 工资小组 / 心理委员 / 学生会职位配置 / 最近工资日期继承
- 旧系统 `lastPeriodicTaskDate` / `lastPenaltyReductionDate` 兼容数据保留，并纳入维护中心兼容数据摘要与全量导出恢复链路
- 积分模板新增 / 编辑 / 删除 / 启停 / 排序 / 分类调整 / 批量导入
- 功能开关启停与配置编辑
- 学生名单 / 语录 Excel 导入导出
- 积分 Excel 导入导出
- 单人手动修正积分账户
- 考勤 Excel 导入导出
- 藏宝阁 Excel 导入导出
- 配置 JSON 导入导出
- 本地快照与测试模式
- 从积分流水恢复分数
- 下载全量备份 JSON 与恢复结构化全量备份 JSON
- 模板筛选摘要、功能开关筛选、倒计时 / 课程备注搜索

### 2.6 旧功能兼容区

- 留言、教师留言、任务主流程
- 藏宝阁宝物配置、兑换、退回、使用、日志
- 祈愿 1 次 / 10 次
- 双子星初始化、配置、备份导出 / 导入、考试成绩导入、结算

### 2.7 管理后台

- 成员摘要、列表、详情、角色分配
- 停用 / 恢复 / 设置密码 / 删除 invited 或 disabled 成员
- 后台审计与成员审计
- 成员操作摘要、操作视角筛选、角色预览、邀请预览、审计筛选与摘要

### 2.8 导出任务中心

- 结构化导出任务创建
- 最近任务、清单、审计查看
- 下载权限控制
- 维护中心全量备份下载
- `structured full export v1` 范围内的全量恢复
- 最近任务、清单、审计的筛选与状态摘要

## 3. 已完成验证

### 3.1 前端

- `npm run build -w @classmanager/web` 已多轮通过

### 3.2 后端

以下命令已执行并通过：

```bash
npm test -w @classmanager/api -- src/modules/points/routes.test.ts
npm test -w @classmanager/api -- src/modules/attendance/routes.test.ts
npm test -w @classmanager/api -- src/modules/homework/routes.test.ts
npm test -w @classmanager/api -- src/modules/settings/routes.test.ts
npm test -w @classmanager/api -- src/modules/admin/routes.test.ts
npm test -w @classmanager/api -- src/modules/exports/routes.test.ts
```

说明：

- 当前 `@classmanager/api` 的测试脚本会把整套 `src/**/*.test.ts` 全量执行，因此上述任一命令本质上都验证了完整 API 测试集。

### 3.3 文档

当前已经补齐并保持同步的核心文档：

- `docs/legacy-feature-progress-matrix-v1.md`
- `docs/upgrade-regression-checklist-v1.md`
- `docs/upgrade-acceptance-record-initial-v1.md`
- `docs/next-phase-todo-v1.md`
- `docs/student-write-implementation-v1.md`
- `docs/points-manual-adjustment-acceptance-v1.md`
- `docs/attendance-write-implementation-v1.md`
- `docs/homework-write-implementation-v1.md`
- `docs/settings-write-implementation-v1.md`
- `docs/admin-module-implementation-v1.md`
- `docs/export-module-implementation-v1.md`

## 4. 当前剩余风险

- 目前补的大量治理能力属于前端本地筛选、摘要和预览，需要一次真实数据库人工走查，确认字段呈现和业务使用习惯一致。
- 核心写操作虽然已经具备测试闭环，但跨模块联动场景还缺一次完整人工串行演练。
- 结构化全量恢复当前仍不包含后台成员、审计日志、导入导出任务；学生档案标题/备注与头像映射已纳入恢复范围。
- 仍有部分模块只是“部分实现”，主要缺口集中在：
  - 更复杂批量写入能力
  - 更细权限模型
  - 兼容区正式拆模
  - 后台真实运维工具
  - 导出独立 worker 与文件治理

## 5. 下一步建议

按优先级建议：

1. 按 `docs/upgrade-regression-checklist-v1.md` 做一轮真实人工验收。
2. 使用 `docs/upgrade-acceptance-record-template-v1.md` 记录验收结果与问题清单。
3. 进入真实使用阶段，按反馈决定是补高频问题，还是进入“更复杂写操作扩展”。

## 6. 当前判断

当前这版已经不再是“演示型页面改造”，而是具备了实际切换前准备价值的升级基线。

还不能直接宣告“全系统可切换”，但已经具备：

- 可持续迭代的实现底座
- 可执行的回归清单
- 与当前实现一致的状态文档
- 稳定的构建与测试基线
- 可用于持续二次迁移与灾备恢复的基础工具链
