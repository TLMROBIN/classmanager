# 作业写操作实现说明 v1

## 1. 当前范围

当前新系统已经补上最小作业写闭环：

- 单学生作业未交扣分
- 单学生作业登记奖励
- 多学生同理由批量作业登记
- 历史批量作业登记按逻辑批次聚合查看
- 按历史 `batchId` 修正整批作业登记
- 单学生作业记录撤销
- 最近一次批量作业登记撤销
- 最近作业操作按审计统一撤销

实现目标不是一次性追平旧系统全部批量操作，而是先把“作业事件如何稳定写入新系统”这件事做对。

## 2. 后端接口

文件：

- `apps/api/src/modules/homework/routes.ts`

当前新增接口：

- `POST /api/classes/:classId/homework/records`
- `POST /api/classes/:classId/homework/records/batch`
- `POST /api/classes/:classId/homework/records/batch-revert`
- `GET /api/classes/:classId/homework/records/batch`
- `POST /api/classes/:classId/homework/records/batch/:batchId/correct`
- `POST /api/classes/:classId/homework/records/batch/:batchId/revert`
- `POST /api/classes/:classId/homework/records/:transactionId/revert`
- `POST /api/classes/:classId/homework/audits/:auditId/revert`

请求体：

- `studentId`
- `subjectName`
- `homeworkDate`
- `eventType`
  - `missing`
  - `register`
- `value`

写入规则：

- `missing` 会写成积分流水：
  - `transactionType = penalty`
  - `reason = <学科>作业未交 <日期>`
- `register` 会写成积分流水：
  - `transactionType = reward`
  - `reason = <学科>作业登记 <日期>`

共用字段：

- `scene = 作业`
- `sourceModule = homework_record`
- `sourceType = homework_record`

## 3. 当前保护规则

- 必须先通过班级访问校验
- 复用积分写权限判断
- 学生必须存在且已有积分账户
- 相同学生 + 相同理由 + `sourceModule=homework_record` + 未撤销记录，不允许重复登记
- 所有写入会同步更新积分账户
- 所有写入会记录 `homework.record.create` 审计
- 只允许撤销 `sourceModule=homework_record` 的作业记录
- 已撤销记录不允许重复撤销
- 撤销会新增反向积分流水、回写原流水 `isReverted/revertedByTransactionId`
- 撤销会记录 `homework.record.revert` 审计
- 批量撤销会记录 `homework.record.batch_revert` 审计
- 作业总览 / 明细 / 学生统计只统计 `sourceModule=homework_record` 且 `isReverted=false` 的记录

## 4. 前端能力

文件：

- `apps/web/src/components/HomeworkPanel.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/lib/api.ts`

当前页面能力：

- 在作业页直接选择学生
- 复用当前学生页勾选结果做批量作业登记
- 输入学科与作业日期
- 选择 `未交扣分` 或 `登记奖励`
- 可从历史批量作业登记直接载入“修正模式”，先撤销旧批次再按当前勾选结果重建
- 提交后自动刷新：
  - 作业总览
  - 作业明细
  - 作业学生统计
  - 班级积分汇总
  - 排行榜
  - 学生详情（如果当前选中的正好是该学生）
- 最近作业记录可直接执行撤销
- 最近一次批量作业登记可直接执行撤销
- 最近作业操作列表可按审计统一撤销单条登记或批量登记中的单条记录
- 最近作业操作支持按单条/批量登记与对应撤销动作、可撤销状态、日期范围筛选，并按学科/日期/学生/批次/人数/操作人搜索
- 最近作业操作支持当前筛选结果的单条登记 / 批量登记 / 单条撤销 / 批量撤销 / 可撤销数量摘要
- 最近作业操作列表会直接展示学科、日期、学生、批量人数、回退数量与批次上下文
- 历史批量作业登记可按事件类型、日期范围筛选
- 历史批量作业登记可按理由 / 类型 / 人数 / 日期 / 批次搜索，并支持按入库时间 / 发生时间 / 影响人数排序
- 历史批量作业登记支持当前筛选结果的未交批次 / 登记批次 / 学生人数 / 课代表奖励摘要
- 历史批量作业登记会按逻辑 `batchId` 聚合显示学生人数、课代表奖励人数与主分值，不再把同一批次拆成多条
- 作业登记明细支持按事件类型、学生姓名/学号筛选
- 作业登记明细支持按最新/最早/学生姓名排序
- 学生作业统计支持按需关注/正常、学生姓名/学号筛选
- 学生作业统计支持按未交次数/登记次数/学生姓名排序
- 批量作业登记 / 修正确认弹窗会展示学科、日期、学生预览、主分值与总分变动；最近或历史批量撤销也会展示主回退变动、课代表奖励回退与人数摘要，减少误操作
- 班级冻结时历史批量记录仍可查看，但撤销入口会显式暂停

## 5. 当前测试基线

文件：

- `apps/api/src/modules/homework/routes.test.ts`

当前已覆盖：

- 正常写入未交记录
- 正常批量写入作业记录
- 最近一次批量作业登记撤销
- 按 `batchId` 聚合读取历史批量作业登记
- 正常按 `batchId` 修正整批作业登记
- 正常通过审计 ID 撤销单条作业登记
- 批量目标已全部存在时拒绝
- 重复登记拒绝
- 无写权限拒绝
- 正常撤销作业记录
- 非作业积分流水禁止撤销

## 6. 当前局限

- 批量作业登记当前只支持“同学科/同日期/同事件类型/同分值”
- 还没有独立的作业模板或课代表协作流
- 当前批量修正仍以“撤销旧批次 + 新建替代批次”的方式完成，还没有更细粒度的局部改写
- 目前仍然复用积分流水表达作业事件，没有拆出独立 `homework_records` 表

## 7. 当前结论

这条链路已经足够支撑：

- 新系统里真实登记作业事件
- 新系统里真实撤销单条作业事件
- 让作业视图和积分视图保持一致
- 在隔离 PostgreSQL 上完成过真实回归：创建未交记录后立即撤销，账户分值回到原值，作业明细统计归零

下一阶段如果继续扩作业域，优先顺序应是：

1. 批量修正后的真实回归与更复杂历史治理
2. 独立作业记录模型与模板化规则
3. 课代表协作与模板化规则
