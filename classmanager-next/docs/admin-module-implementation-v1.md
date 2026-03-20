# 后台管理模块实现说明 v1

## 1. 当前目标

当前后台管理模块的目标不是一次性做完整租户后台，而是先把旧系统已有的“查看成员、查看角色、查看后台审计、最小角色分配”收成稳定基线。

## 2. 当前后端能力

文件：

- `apps/api/src/modules/admin/routes.ts`
- `apps/api/src/lib/permissions.ts`

当前接口：

- `GET /api/tenants/:tenantId/admin/summary`
- `GET /api/tenants/:tenantId/admin/members`
- `GET /api/tenants/:tenantId/admin/members/:membershipId`
- `GET /api/tenants/:tenantId/admin/roles`
- `GET /api/tenants/:tenantId/admin/audits`
- `POST /api/tenants/:tenantId/admin/members/invitations`
- `PUT /api/tenants/:tenantId/admin/members/:membershipId/status`
- `PUT /api/tenants/:tenantId/admin/members/:membershipId/password`
- `PUT /api/tenants/:tenantId/admin/members/:membershipId/roles`
- `DELETE /api/tenants/:tenantId/admin/members/:membershipId`

当前权限规则：

- 可查看成员和后台审计：
  - `tenant_owner`
  - `tenant_admin`
  - `class_admin`
  - `head_teacher`
- 可修改成员角色：
  - `tenant_owner`
  - `tenant_admin`

当前保护规则：

- 禁止修改自己的角色
- 禁止修改自己的成员状态
- 禁止修改自己的密码
- 禁止移除最后一个 `tenant_owner`
- 禁止停用最后一个 `tenant_owner`
- 当前阶段支持将 `invited` 成员激活为 `active`
- 当前阶段不支持直接停用 `invited` 成员
- 当前阶段支持为 `active / invited` 成员直接设置新密码
- 当前阶段不支持直接为 `disabled` 成员设置密码
- 当前阶段只支持删除 `invited / disabled` 成员
- 当前阶段不支持直接删除 `active` 成员
- 当前阶段只支持创建 `invited` 成员，不支持外部通知和首次登录激活
- 只允许分配当前租户已有角色
- 角色变更写入 `membership.roles.update` 审计日志
- 状态停用/恢复分别写入 `membership.status.disable` / `membership.status.enable`
- 新成员邀请写入 `membership.invite.create`
- 后台设置密码写入 `membership.password.set`

## 3. 当前前端能力

文件：

- `apps/web/src/components/AdminPanel.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/types.ts`

当前页面能力：

- 后台摘要
- 成员列表
- 成员搜索 / 状态 / 角色筛选
- 成员按状态 / 加入时间 / 最近登录排序
- 成员列表支持按“可编辑 / 本人受限 / 待激活 / 可删除”操作视角筛选
- 成员列表支持当前筛选结果的状态/可删除数量摘要
- 成员详情
- 成员详情操作摘要卡片
- 新增 invited 成员
- 邀请表单与角色分配区支持角色影响预览
- invited 成员激活
- 成员停用/恢复
- 成员密码设置
- invited / disabled 成员删除
- 角色列表
- 成员级角色变更审计
- 租户后台审计列表
- 后台审计动作筛选
- 后台审计关键词筛选
- 后台审计与成员审计支持日期范围筛选
- 后台审计支持当前筛选结果的动作分布摘要
- 更可读的后台审计文案与摘要
- 最小角色分配表单
- 后台独立成功/错误反馈

当前前端保护与提示：

- 当前成员如果是自己，前端直接禁用提交
- 当前租户只有 1 个成员时，显示无法完整演练角色分配的提示
- 成员角色分配、停用/恢复、密码设置、删除均带二次确认，并补充成员/账号/状态/角色摘要
- invited 激活、成员恢复与停用会明确提示目标状态和访问影响
- `invited` 成员可直接在后台激活
- invited 成员创建当前只做租户内创建，不发送外部通知
- 后端错误会映射成更明确的中文说明
- 后台读写错误已与全局错误分离，避免干扰其他模块
- 新增 invited 成员后，如果当前筛选命中，会自动定位到该成员
- 若当前筛选未命中新成员，会明确提示“已创建，但当前筛选未显示”
- 成员列表和详情已统一格式化加入时间、最近登录、账号创建/更新时间
- 成员状态在列表和详情中统一显示为中文标签
- 成员列表已补充角色数与最近登录提示，方便快速排查
- 成员详情和后台审计都已显示操作者摘要，不再只显示原始 action 或 JSON
- 成员详情审计支持按操作者 / 动作 / 摘要关键词筛选

当前运维辅助：

- 已提供回归成员清理脚本 `npm run admin:cleanup:regression`
- 默认只清理 `invite_reg_` 前缀测试账号
- 默认 dry-run，显式 `--apply` 才真实删除

## 4. 当前局限

- 还没有全局平台管理员视角
- 还没有后台独立导航和专属布局
- 还没有更细粒度的租户治理权限
- 还没有真实生产数据下的批量运维工具与验收报告

## 5. 当前测试基线

文件：

- `apps/api/src/lib/permissions.test.ts`
- `apps/api/src/modules/admin/routes.test.ts`

当前已覆盖：

- 后台摘要路由
- 后台成员读取角色判定
- 后台成员写入角色判定
- 迁移兼容阶段的空角色 fallback
- 后台成员列表路由
- 后台成员搜索 / 状态 / 角色筛选参数透传
- 后台成员排序参数透传
- 无权限后台读取拒绝
- 成员详情 recent audit 操作者信息返回
- 后台审计 action 筛选参数透传
- 本人自改角色拒绝
- 本人自改成员状态拒绝
- 最后一个 `tenant_owner` 停用拒绝
- 正常停用成员写入与审计记录
- 正常恢复成员写入与审计记录
- 正常创建 invited 成员写入与审计记录
- 正常设置成员密码写入与审计记录
- 正常删除 invited 成员写入与审计记录
- active 成员删除拒绝
- 重复租户成员邀请拒绝
- disabled 全局用户邀请拒绝
- invited 成员激活时同步用户状态并写入审计记录
- 正常角色分配写入与审计记录

测试入口：

- `npm run test -w @classmanager/api`

## 6. 当前结论

后台管理模块已经具备最小可用骨架：

- 可读：摘要、成员、角色、审计
- 可筛：成员搜索、状态/角色筛选、后台审计动作筛选
- 可排：状态优先、最近加入、最近登录
- 可写：创建 invited 成员、激活 invited 成员、成员状态停用/恢复、设置成员密码、删除 invited/disabled 成员、最小角色分配，并已补充高风险成员操作确认摘要
- 可审计：角色变更、成员状态、成员邀请、成员密码设置，并已在前端做可读摘要展示

下一阶段应优先补：

1. 真实数据库回归和后台操作链路核对
2. 更细粒度的租户治理权限
3. 若继续扩写操作，再决定是否补首次登录激活、外部通知或批量运维工具

参考文档：

- `docs/admin-member-status-lifecycle-v1.md`
- `docs/admin-member-invitation-preparation-v1.md`
