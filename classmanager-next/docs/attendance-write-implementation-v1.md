# 考勤写操作实现说明 v1

## 1. 当前范围

当前新系统已经补上最小考勤写闭环：

- 考勤时段配置增改停用与排序
- 考勤规则核心数值、周规则、周日特殊迟到时间编辑
- 单条考勤记录状态修正
- 单条考勤修正撤销
- 单场次内勾选记录的批量状态修正
- 单场次内勾选记录的最近批量修正撤销
- 跨场次异常/请假记录集中查看、批量修正与缺勤结算
- 新建考勤场次并生成默认参与日常的学生记录
- 在已有场次中补录缺失学生记录
- 在已有场次中批量补录缺失学生记录
- 在已有场次中撤销最近批量补录
- 单场次结算迟到/缺勤积分
- 撤销最近一次单场次结算

当前目标不是一次性追平旧系统全部出勤玩法，而是先把“历史场次如何安全修正，并把迟到/缺勤安全结算到积分”做对。

## 2. 后端接口

文件：

- `apps/api/src/modules/attendance/routes.ts`

当前新增接口：

- `PUT /api/classes/:classId/attendance/policy`
- `PUT /api/classes/:classId/attendance/records/:recordId`
- `POST /api/classes/:classId/attendance/records/:recordId/revert-latest`
- `POST /api/classes/:classId/attendance/audits/:auditId/revert`
- `PUT /api/classes/:classId/attendance/sessions/:sessionId/records/batch-status`
- `GET /api/classes/:classId/attendance/issues`
- `PUT /api/classes/:classId/attendance/issues/status`
- `POST /api/classes/:classId/attendance/issues/settle-absent`
- `POST /api/classes/:classId/attendance/sessions/:sessionId/records/batch-revert-latest`
- `GET /api/classes/:classId/attendance/sessions/:sessionId/records/batch`
- `POST /api/classes/:classId/attendance/sessions/:sessionId/records/batch/:batchId/revert`
- `POST /api/classes/:classId/attendance/sessions`
- `POST /api/classes/:classId/attendance/sessions/:sessionId/records`
- `POST /api/classes/:classId/attendance/sessions/:sessionId/records/batch-create`
- `POST /api/classes/:classId/attendance/sessions/:sessionId/records/batch-revert-create-latest`
- `POST /api/classes/:classId/attendance/sessions/:sessionId/settle`
- `POST /api/classes/:classId/attendance/sessions/:sessionId/revert-latest-settlement`
- `GET /api/classes/:classId/attendance/audits`

请求体：

- `status`
  - `present`
  - `late`
  - `absent`
  - `excused`
- `POST /attendance/sessions`
  - `seedDailyParticipantStudents`
  - 兼容保留旧字段 `seedAllActiveStudents`
- `POST /attendance/sessions/:sessionId/records`
  - `allowNonDailyParticipant`
  - 兼容保留旧字段 `allowInactiveStudent`

写入规则：

- 只允许修改当前班级下的单条 `attendance_records`
- 写入后会：
  - 更新 `status`
  - 将 `source` 置为 `manual_update`
  - 更新 `recordedAt`
  - 回写 `actorUserId / actorMembershipId`
- 如果改成 `absent`，会把 `checkInAt` 清空
- 如果该记录之前已经完成迟到/缺勤结算，后续修正会自动撤销旧扣分
- 如果修正后的新状态仍需扣分，会按新状态补建替代结算；撤销这次修正时也会恢复原结算关系

## 3. 当前保护规则

- 必须先通过班级访问校验
- 当前复用积分写权限角色作为考勤修正权限
- 目标记录必须属于当前班级
- 状态未变化时拒绝提交
- 所有修正会写入 `attendance.record.update` 审计
- 场次明细读取现在会显式带出 `note / source`

## 4. 前端能力

文件：

- `apps/web/src/components/AttendancePanel.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/lib/api.ts`

当前页面能力：

- 在考勤页内直接维护考勤时段编码、名称、开始/结束/迟到时间、启停状态与顺序
- 在考勤页内直接编辑：
  - 迟到扣分
  - 缺勤扣分
  - 周全勤奖
- 在考勤页内直接编辑每周各天可创建的考勤时段
- 在考勤页内直接编辑周日各时段的特殊迟到时间
- 在考勤页直接新建某一天某个时段的考勤场次
- 新建场次时会按所选日期的周规则过滤可选时段
- 新建时可指定生成记录的默认状态
- 历史场次列表支持按场次状态、日期/时段/状态关键词筛选
- 在当前场次中为缺失学生补录单条记录
- 在当前场次中勾选多名缺失学生后批量补录
- 在考勤页场次明细中直接修正单条记录状态
- 场次明细支持按状态、学生姓名/学号/备注筛选
- 在当前场次最近操作中撤销最近一次单条修正
- 在当前场次明细中勾选多条记录后批量修正状态
- 在当前场次明细中勾选多条记录后撤销最近一次批量修正
- 在当前场次明细中勾选多条记录后撤销最近一次批量补录
- 在异常工作台中集中查看跨场次迟到/缺勤/请假记录
- 异常工作台支持按异常类型（含请假）、姓名/学号/日期/时段关键词筛选
- 异常工作台工具条会实时展示当前勾选异常的状态分布、待结算缺勤和涉及场次数
- 在异常工作台中勾选多条记录后跨场次批量修正状态
- 异常工作台批量修正确认会展示当前状态分布、涉及场次与已结算缺勤数量，减少误操作
- 在异常工作台中勾选缺勤记录后批量结算缺勤积分
- 异常工作台缺勤结算确认会展示可结算人数、已结算人数、涉及场次与扣分规则，并保留最近一次结算预览
- 在当前场次查看历史批量补录/批量修正列表
- 在历史批量列表中按操作类型 / 目标状态筛选
- 在历史批量列表中按类型 / 状态 / 人数 / 日期 / 批次搜索，并支持按记录时间 / 影响人数排序
- 在历史批量列表中按 `batchId` 撤销批量补录或批量修正
- 在当前场次中结算迟到/缺勤记录为积分
- 在当前场次中撤销最近一次场次结算
- 场次结算 / 最近一次结算撤销确认会展示场次、迟到/缺勤人数和扣分规则，减少误操作
- 按当前筛选统计发放周全勤奖
- 撤销最近一次周全勤奖发放
- 周全勤奖发放 / 撤销确认会展示当前筛选范围、时段、影响人数和分值，减少误操作
- 在当前场次下查看最近考勤写操作记录
- 在最近操作列表里直接按动作类型撤销：
  - 单条修正
  - 批量修正
  - 批量补录
- 最近操作列表统一走审计撤销接口，不再由前端按动作类型分发不同接口
- 最近操作支持按单条修正/批量修正/批量补录、可撤销状态、日期范围筛选，并按学生/场次/状态/操作人搜索
- 最近操作支持当前筛选结果的动作分布与可撤销数量摘要
- 最近操作列表已补充新建场次、补录撤销、场次结算、异常缺勤结算等动作筛选，并直接展示学生/场次/数量上下文
- 支持把单条记录修正为：
  - `present`
  - `late`
  - `absent`
  - `excused`
- 支持把当前勾选记录批量修正为：
  - `present`
  - `late`
  - `absent`
  - `excused`
- 支持把当前勾选记录撤销最近一次批量修正
- 支持把当前勾选缺失学生批量补录为：
  - `present`
  - `late`
  - `absent`
  - `excused`
- 支持把当前勾选记录撤销最近一次批量补录
- 提交后自动刷新：
  - 场次列表汇总
  - 当前场次明细
  - 按学生统计
  - 按日期统计
- 历史批量撤销与最近操作撤销的确认弹窗会展示批量类型、目标状态、影响人数和场次信息，减少误撤销
- 当前场次里“最近一次批量修正/补录撤销”也会展示当前勾选记录数与状态分布，减少误撤销
- 班级冻结时历史批量操作仍可查看，但撤销入口会显式暂停

## 5. 当前测试基线

文件：

- `apps/api/src/modules/attendance/routes.test.ts`

当前已覆盖：

- 正常更新考勤时段配置，并同步重映射周规则/周日特殊迟到时间
- 考勤时段未变化时拒绝
- 正常更新考勤规则
- 考勤规则未变化时拒绝
- 正常创建考勤场次并生成记录
- 周日场次会应用特殊迟到时间
- 重复场次创建拒绝
- 正常补录缺失学生记录
- 重复补录拒绝
- 正常批量补录缺失学生记录
- 批量补录目标都已存在时拒绝
- 正常撤销最近一次批量补录
- 没有可撤销批量补录时拒绝
- 正常结算单场次迟到/缺勤积分
- 正常撤销最近一次单场次结算
- 当前场次审计过滤查询
- 正常修正单条考勤记录
- 正常撤销最近一次单条修正
- 正常撤销最近一次批量修正
- 正常通过审计 ID 撤销单条修正 / 批量修正 / 批量补录
- 没有可撤销批量修正时拒绝
- 没有可撤销修正时拒绝
- 无写权限拒绝
- 状态未变化拒绝
- 正常批量修正多条记录
- 批量目标状态未变化拒绝
- 正常读取跨场次异常记录列表
- 跨场次异常记录列表默认纳入 `excused`
- 正常跨场次批量修正异常记录
- 正常跨场次批量结算缺勤异常
- 已结算记录修正为正常时自动撤销原扣分
- 已结算记录在异常状态间切换时自动替换扣分

## 6. 当前真实回归

已在隔离 PostgreSQL 上完成真实回归：

- 新建一个未来日期的 `morning/早读` 场次
- 自动生成 `28` 条记录，默认状态为 `present`
- 场次详情汇总显示 `present 28 / late 0 / absent 0`
- 回归脚本已在验证后立即删除测试场次、记录和对应审计
- 在测试场次中手动删掉 1 条记录后，使用补录接口恢复
- 场次汇总从 `28 -> 27 -> 28`，说明补录接口能恢复缺失记录
- 回归脚本已在验证后立即删除测试场次、记录和对应审计
- 在真实历史场次中临时删除 2 条记录后，使用批量补录接口恢复
- 场次汇总从 `26 -> 28` 恢复，批量补录返回 `createdCount = 2 / skippedCount = 0`
- 回归脚本已在验证后立即删除批量补录生成的记录和审计
- 把一条 `absent` 记录修正为 `present` 后，再执行单条撤销
- 记录状态恢复为 `absent`
- 当前场次最近操作中可以看到 `attendance.record.revert`
- 把一条 `absent` 记录修正为 `present`
- 场次汇总从 `present 25 / absent 1` 变成 `present 26 / absent 0`
- 再把该记录修正回 `absent`
- 场次汇总恢复为 `present 25 / absent 1`
- 把同一场次内 2 条 `present` 记录批量修正为 `absent`
- 场次汇总从 `present 25 / absent 1` 变成 `present 23 / absent 3`
- 再逐条修正回原状态，场次汇总恢复为 `present 25 / absent 1`
- 在真实历史场次里把 2 条 `present` 记录批量修正为 `absent`
- 场次汇总从 `present 26 / absent 0` 变成 `present 24 / absent 2`
- 再执行批量撤销后，场次汇总恢复为 `present 26 / absent 0`
- 在临时测试场次里删除 2 条记录后执行批量补录
- 场次汇总从 `26` 恢复到 `28`
- 再执行“批量补录撤销”后，场次汇总恢复到 `26`
- 回归脚本已在验证后立即删除测试场次、记录和相关审计

这说明当前链路已经具备：

- 真正写库
- 汇总即时生效
- 状态可恢复

## 7. 当前局限

- 当前只支持撤销最近一次单条修正
- 最近操作列表已统一为按审计 ID 撤销，但底层仍以“该记录当前最新可回退动作”为准
- 按 `batchId` 撤销只会处理仍保持为最新批量状态的记录
- 当前自动结算只覆盖迟到/缺勤，不包含周全勤奖
- 当前规则编辑已补到周规则和周日特殊迟到时间，但仍未覆盖更多特殊日期和更细颗粒自动规则
- 删除已有历史场次的时段时，当前会自动转为停用并保留历史数据，不做物理删除
- 当前已开放 `excused` 状态的前端修正入口，异常工作台也已纳入请假记录，但缺勤结算仍只覆盖 `absent`
- 周全勤奖当前复用积分批量加分链路，仍按“最近一次”粒度撤销，但前端已补充最近一次发放范围 / 人数 / 分值提示

## 8. 下一阶段建议

如果继续扩考勤写操作，优先顺序应是：

1. 跨动作统一撤销策略
2. `excused` / 缺勤结算 / 工作台真实回归继续收口
3. 单学生区间明细与实时打卡视图
4. 周全勤奖与更细的自动规则联动
