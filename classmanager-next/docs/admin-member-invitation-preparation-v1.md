# 后台成员邀请准备说明 v1

## 1. 当前目标

当前后台已经具备：

- 成员摘要
- 成员筛选
- 角色分配
- 成员停用 / 恢复

下一阶段最自然的扩展不是“删除成员”，而是“新增成员 / 邀请成员”。但邀请流程一旦直接开做，会同时牵涉：

- 用户账号创建
- 租户成员关系创建
- 初始角色分配
- 激活状态流转
- 首次登录

当前系统已经落下最小邀请链路：

- `POST /api/tenants/:tenantId/admin/members/invitations`
- 后台页中的“新增 invited 成员”表单
- invited 成员可在后台直接激活为 `active`

因此这份文档现在既是准备说明，也是当前实现的约束说明。

## 2. 建议拆成两层对象

### 用户账号 `User`

表示系统级登录主体。

建议规则：

- 可先存在于系统中，再加入租户
- `username` / `email` 仍是全局唯一
- `status` 可为：
  - `active`
  - `disabled`
  - `invited`

### 租户成员关系 `Membership`

表示某个用户在某个租户中的身份。

建议规则：

- 邀请本质上优先操作 `Membership`
- `Membership.status` 当前沿用：
  - `active`
  - `disabled`
  - `invited`
- 初始角色应跟成员关系一起落下

## 3. 建议的最小邀请范围

不要一开始就做邮件、短信、外部通知。当前第一阶段只做“后台内创建 invited 成员”：

1. 管理员输入：
   - `username`
   - `displayName`
   - 可选 `email`
   - 初始 `roleCodes`
2. 系统检查：
   - 当前租户是否已存在该成员
   - `username` / `email` 是否冲突
3. 写入：
   - 若用户不存在，则创建 `User(status=invited)`
   - 创建 `Membership(status=invited)`
   - 写入初始角色
   - 写审计 `membership.invite.create`

当前实现已经按这个边界落地，可以先把“租户成员新增”这件事独立出来，不被外部通知渠道拖住。

## 4. 不建议现在就做的部分

以下内容不应在第一阶段一起落地：

- 邮件或短信通知
- 激活链接
- 一次性邀请码池
- 批量导入成员
- 删除成员

这些都应排在“后台最小邀请链路”之后。

## 5. 后续激活路径建议

如果第一阶段已经能创建 `invited` 成员，下一阶段再考虑激活：

### 路径 A：管理员直接激活

- 把 `Membership.status` 从 `invited` 改成 `active`
- 若对应 `User.status` 仍是 `invited`，同步改成 `active`

适合内部部署和小规模使用。

### 路径 B：成员首次登录激活

- 用户完成首次登录或设置密码
- 系统再把 `User / Membership` 从 `invited` 转 `active`

适合正式 SaaS，但复杂度更高。

当前系统已经开始走路径 A，后台可直接把 `invited` 成员激活为 `active`。后续如果继续扩展，再考虑是否需要首次登录激活。

## 6. 审计建议

邀请能力一旦落地，至少要有这些动作：

- `membership.invite.create`
- `membership.status.enable`
- `membership.status.disable`
- `membership.roles.update`

这样后台才能完整追踪“成员是怎么进来的、什么时候被启用、什么时候角色被改过”。

## 7. 前端建议

真正进入实现时，建议只补一个最小表单：

- 用户名
- 显示名
- 邮箱
- 初始角色

并且放在当前后台页里，不立即单独开复杂邀请中心。

## 8. 当前结论

下一阶段如果继续做后台成员治理，推荐顺序是：

1. 先做真实数据库回归，验证 invited 创建与激活链路
2. 再决定是否补首次登录激活
3. 最后再考虑外部通知
