# 设置写操作实现说明 v1

## 1. 当前范围

当前已经补了一组切换价值高、实现范围可控的设置写能力：

- 班级基础配置编辑
- 新增积分模板
- 编辑积分模板核心字段
- 删除可编辑积分模板
- 积分模板启停
- 积分模板排序
- 积分模板分类管理
- 积分模板批量导入
- 功能开关启停
- 功能开关配置编辑
- 班级冻结/解冻
- 课程备注整体更新
- 倒计时事件整体更新
- 课程备注手动 / 拖拽排序治理
- 倒计时事件手动 / 拖拽排序治理
- 学生状态字典编辑
- 工资配置编辑
- 发放今日工资

这一版故意不做：

- 暂无

## 2. 后端接口

文件：

- `apps/api/src/modules/settings/routes.ts`

当前新增接口：

- `PUT /api/classes/:classId/settings/class-config`
- `POST /api/classes/:classId/settings/reason-templates`
- `POST /api/classes/:classId/settings/reason-templates/batch`
- `PUT /api/classes/:classId/settings/reason-templates/:templateId`
- `PUT /api/classes/:classId/settings/reason-templates/reorder`
- `PUT /api/classes/:classId/settings/reason-templates/categories`
- `PUT /api/classes/:classId/settings/feature-flags/:featureFlagId`
- `PUT /api/classes/:classId/settings/student-statuses`
- `PUT /api/classes/:classId/settings/wage-config`
- `PUT /api/classes/:classId/settings/class-freeze`
- `PUT /api/classes/:classId/settings/schedule-notes`
- `PUT /api/classes/:classId/settings/countdown-events`

请求体：

- `className`
- `timezone`
- `name`
- `value`
- `transactionType`
  - `bonus`
  - `penalty`
  - `reward`
- `scene`
- `category`

写入规则：

- 同班级下模板名称唯一
- 新模板默认：
  - `isEditable = true`
  - `isActive = true`
- `displayOrder` 追加到当前最大值之后
- 同步写 `settings.reason_template.create` 审计

功能开关写入规则：

- 允许切换 `enabled`
- 允许整体更新 `config`
- 功能开关必须属于当前班级
- `config` 必须是 JSON 对象
- 配置和状态都未变化时拒绝提交
- 同步写 `settings.feature_flag.update` 审计

班级基础配置规则：

- 当前只允许编辑：
  - `className`
  - `timezone`
- 班级配置必须存在
- 内容未变化时拒绝提交
- 冻结状态下拒绝修改
- 同步写 `settings.class.config.update` 审计

积分模板启停规则：

- 允许切换 `isActive`
- 允许编辑：
  - `name`
  - `value`
  - `transactionType`
  - `scene`
  - `category`
- 模板必须属于当前班级
- 内容和状态都未变化时拒绝提交
- 名称修改后仍需满足班级内唯一
- 同步写 `settings.reason_template.update` 审计

积分模板删除规则：

- 只允许删除 `isEditable = true` 的模板
- 模板必须属于当前班级
- 冻结状态下拒绝删除
- 同步写 `settings.reason_template.delete` 审计

积分模板批量导入规则：

- 接受 JSON 数组或 CSV/TSV（支持表头与列映射）
- 支持预检重名提示
- 列表内模板名称不能重复
- 模板名称与现有模板重复时整体拒绝
- 自动追加 `displayOrder`
- 同步写 `settings.reason_template.batch_create` 审计

积分模板排序规则：

- 只接受完整排序列表
- 列表中不能有重复模板
- 列表中所有模板必须属于当前班级
- 顺序未变化时拒绝提交
- 同步写 `settings.reason_template.reorder` 审计

积分模板分类管理规则：

- 只接受旧分类与新分类
- 旧分类必须存在且属于当前班级
- 新旧分类一致时拒绝提交
- 同步写 `settings.reason_template.category.update` 审计

班级冻结规则：

- 只允许切换 `classConfig.isFrozen`
- 冻结后拦截：
  - 积分写操作
  - 作业写操作
  - 考勤写操作
  - 设置写操作
- 不影响读取
- 同步写 `settings.class.freeze.update` 审计

课程备注规则：

- 当前按整个 `scheduleNotes` 对象整体提交
- 保存时保留提交顺序，支持前端手动上移/下移或拖拽排序后统一覆盖
- 键名不能为空，值按字符串保存
- 内容未变化时拒绝提交
- 冻结状态下拒绝修改
- 同步写 `settings.class.schedule_notes.update` 审计

倒计时事件规则：

- 当前按整个 `countdownEvents` 数组整体提交
- 每条至少包含 `title`，可选 `id/date/note`
- `date` 如填写，必须是有效 `YYYY-MM-DD`
- 保存时保留提交顺序，支持前端手动上移/下移或拖拽排序后统一覆盖
- 内容未变化时拒绝提交
- 冻结状态下拒绝修改
- 同步写 `settings.class.countdown_events.update` 审计

学生状态字典规则：

- 当前按整个 `studentStatusOptions` 数组整体提交
- 每条允许编辑：
  - `value`
  - `label`
  - `participatesInDailyFlow`
- 预置状态 `active / archived / graduated / transferred` 会自动保底存在
- 内容未变化时拒绝提交
- 若仍有学生处于被移除状态，拒绝提交
- 冻结状态下拒绝修改
- 同步写 `settings.class.student_statuses.update` 审计

工资配置规则：

- 允许编辑：
  - `dailyWageAmount`
  - `dailyWageGroupIds`
  - `psychologyCommitteeStudentIds`
  - `studentCouncilRoles`
- 工资小组必须属于当前班级
- 心理委员和学生会职位引用的学生必须属于当前班级
- 内容未变化时拒绝提交
- 同步写 `settings.class.wage_config.update` 审计

## 3. 权限规则

- 必须先通过班级访问校验
- 当前复用积分管理权限
- 没有积分管理权限则拒绝新增

## 4. 前端能力

文件：

- `apps/web/src/components/SettingsPanel.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/lib/api.ts`

当前页面能力：

- 在设置页编辑班级名称和时区
- 在设置页冻结/解冻班级
- 在设置页新增积分模板
- 在设置页编辑积分模板核心字段
- 在设置页删除可编辑积分模板
- 在设置页启用/停用积分模板
- 在设置页按类型/状态/关键词筛选积分模板，并查看当前筛选摘要
- 在设置页调整积分模板排序
- 在设置页编辑积分模板分类
- 在设置页批量导入积分模板
- 批量导入编辑过程中即时预检重复名、缺字段和非法类型，并展示导入摘要与预览
- 在设置页启用/停用功能开关
- 在设置页编辑功能开关 JSON 配置
- 在设置页以键值对方式编辑简单功能开关配置，复杂嵌套结构保留 JSON 入口
- 在设置页按状态/关键词筛选功能开关
- 在设置页以 JSON 方式整体编辑课程备注
- 在设置页以 JSON 方式整体编辑倒计时事件
- 在设置页直接新增/编辑/删除单条课程备注与倒计时事件，再统一保存
- 在设置页直接上移/下移或拖拽排序课程备注与倒计时事件，并按当前顺序保存
- 在设置页按关键词筛选倒计时事件与课程备注
- 在设置页编辑学生状态字典，支持新增自定义状态、修改显示名称、切换是否参与日常、上下调整顺序
- 在设置页编辑工资基础分、工资小组、心理委员和学生会职位
- 在设置页按当前已保存工资配置发放今日工资
- 当天重复发工资前，会根据已保存的最近工资日期先做确认提醒
- 维护配置导入工资配置时，会一并恢复最近工资日期
- 在设置页导入积分 Excel，兼容旧“积分表”和新“积分数据”列名，并直接覆盖学生积分账户
- 在设置页选择单名学生，手动修正总分 / 余额 / 罚分
- 学生名单导入、配置包导入、本地快照恢复、积分账户导入/修正、按流水重建积分账户、全量备份恢复前，会展示影响人数、覆盖范围或备份计数摘要
- 积分模板新增、批量导入、编辑/启停/删除、模板分类整体更新、功能开关启停/配置保存前，会展示模板/分类/开关键名差异摘要
- 小组 / 宿舍 / 岗位配置保存前，会展示新增、重命名、启停、顺序调整和已有归属摘要
- 工资配置保存与“发放今日工资”前，会展示基础分、工资小组、心理委员、学生会职位和最近工资日期摘要
- 学科配置与学生状态字典保存前，会展示学科增删/课代表调整、状态增删/参与日常变化和在用影响摘要
- 在设置页导出考勤 Excel，生成考勤记录 / 考勤明细 / 考勤场次三张工作表
- 在设置页导入考勤 Excel，兼容旧系统“日期 / 姓名 / 时段列”格式，并按场次合并写入现有考勤数据
- 输入模板名称、分值、类型、场景、类别
- 成功后自动刷新设置总览

## 5. 当前测试基线

文件：

- `apps/api/src/modules/settings/routes.test.ts`

当前已覆盖：

- 班级基础配置更新成功
- 班级基础配置未变化拒绝
- 班级冻结状态更新成功
- 班级冻结状态未变化拒绝
- 课程备注更新成功
- 课程备注顺序保留更新成功
- 课程备注未变化拒绝
- 倒计时事件更新成功
- 倒计时事件顺序保留更新成功
- 倒计时事件未变化拒绝
- 正常新增积分模板
- 重名模板拒绝
- 积分模板核心字段编辑成功
- 可编辑积分模板删除成功
- 积分模板启停成功
- 积分模板不存在拒绝
- 积分模板排序成功
- 积分模板分类更新成功
- 积分模板批量导入成功
- 功能开关启停成功
- 功能开关配置更新成功
- 功能开关不存在拒绝
- 工资配置更新成功
- 工资配置未变化拒绝

## 6. 当前局限

- 冻结当前只做写操作拦截，不做更细粒度白名单
- 积分 Excel 导入当前只覆盖积分账户，不会反向补写历史积分流水
- 手动修正积分账户当前同样只覆盖账户分数，不会补写或回滚历史流水
- 积分 Excel 导入当前要求学生名可唯一匹配到新系统学生；重名学生需要先处理数据
- 考勤 Excel 导入当前要求学生名可唯一匹配到新系统学生；重名学生需要先处理数据
- 考勤 Excel 导入依赖当前班级仍保留对应考勤时段；已删除时段不能直接自动恢复

## 7. 当前结论

设置域现在已经不再完全只读，至少“班级基础配置 + 班级冻结 + 课程备注更新/手动/拖拽排序 + 倒计时事件更新/手动/拖拽排序 + 工资配置与发放 + 积分模板新增/编辑/删除/启停/排序/分类管理/批量导入 + 功能开关启停/配置编辑”几条核心链路已经具备，并已补充高风险设置写操作的确认摘要治理。
