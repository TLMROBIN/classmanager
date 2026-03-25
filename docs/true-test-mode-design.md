# 真测试模式设计

## 目标

- 测试模式必须走真实后端读写链路，而不是前端假保存。
- 测试模式中的所有数据修改都不能污染正式数据。
- 退出测试模式后，正式系统保持进入测试模式前的状态。
- 测试模式中应支持：
  - 正常操作、考勤、宝物、任务、双子星、考试档案、维护设置
  - 自动保存、冲突检测、维护密码验证
  - 模拟时间
- 测试模式退出后，不依赖前端快照回滚；即使浏览器崩溃，正式数据也不受影响。

## 当前实现的问题

当前测试模式是前端沙箱，不是真测试模式。

- 进入测试模式时，只保存 React state 快照。
- `getNow()` 读取 `window.__CM_TEST_TIME__`，所以时间能模拟。
- `localStorage/sessionStorage` 被重定向到 `window.__CM_TEST_STORAGE__`。
- 但网络同步被直接短路：
  - `fetchFromServerCore()` 在测试模式下直接 `skipped`
  - `savePayloadToServer()` 在测试模式下直接 `Promise.resolve`
  - 维护密码接口也是假成功

对应代码：

- [public/script.js](/home/binyu/文档/trae_projects/classmanager/classmanager-multi/public/script.js#L689)
- [public/script.js](/home/binyu/文档/trae_projects/classmanager/classmanager-multi/public/script.js#L1756)
- [public/script.js](/home/binyu/文档/trae_projects/classmanager/classmanager-multi/public/script.js#L1859)
- [public/script.js](/home/binyu/文档/trae_projects/classmanager/classmanager-multi/public/script.js#L1945)

结论：当前测试模式不能验证数据库写入、接口冲突、服务端推导逻辑、权限、并发覆盖等真实问题。

## 设计原则

### 1. 隔离必须在服务端

只靠前端快照不可靠。真正的隔离必须在服务端数据层完成。

### 2. 测试环境必须是正式数据的“分叉”

测试模式开始时，应当基于当前正式数据创建一个独立副本。后续所有读写都只发生在这个副本上。

### 3. 退出不做“回滚”，而是“丢弃沙盒”

正式数据从未被修改，因此退出测试模式时不需要回滚正式库，只需要关闭或删除测试会话。

### 4. 时间模拟必须前后端一致

前端界面和服务端规则都必须使用同一个“测试当前时间”。

## 方案选择

推荐方案：`服务端测试会话 + 用户级数据副本`

不推荐继续扩展当前前端快照方案。

### 为什么不直接复制整个 SQLite 数据库文件

整库复制最接近真环境，但要把当前全局 `db.prepare(...)` 重构成“按请求选择数据库连接”，改造面太大。

当前项目里用户侧核心数据主要集中在：

- `class_data`
- `maintenance_credentials`

所以更合适的落地方案是：

- 正式库继续保留
- 测试模式把当前用户的数据复制到测试表
- 用户页面 API 在测试模式下改读写测试表

这已经可以完整覆盖当前普通用户系统的真实运行

## 数据模型

新增表：

### `test_sessions`

```sql
CREATE TABLE test_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    sim_time_ms INTEGER,
    time_speed REAL NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

作用：

- 标识一个测试会话
- 归属到某个真实用户
- 记录模拟时间
- 控制生命周期

### `test_class_data`

```sql
CREATE TABLE test_class_data (
    session_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    data_key TEXT NOT NULL,
    data_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, user_id, data_key),
    FOREIGN KEY (session_id) REFERENCES test_sessions(id) ON DELETE CASCADE
);
```

作用：

- 保存测试会话中的用户数据副本
- 结构与正式 `class_data` 对齐，方便复用现有逻辑

### `test_maintenance_credentials`

```sql
CREATE TABLE test_maintenance_credentials (
    session_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    password_hash TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, user_id),
    FOREIGN KEY (session_id) REFERENCES test_sessions(id) ON DELETE CASCADE
);
```

作用：

- 让维护密码设置、修改、验证也在测试模式里独立运行
- 不污染正式维护密码

## 服务端请求上下文

新增请求头：

- `X-Test-Session`
- `X-Test-Now`

### `X-Test-Session`

由前端在测试模式下自动携带，用于指向当前测试会话。

### `X-Test-Now`

由前端携带当前模拟时间毫秒值，服务端据此计算：

- 考勤时段
- 缺勤推导
- 自动奖惩
- 一切依赖“当前时间”的逻辑

## 服务端分层改造

### 1. 增加测试会话解析中间件

新增中间件 `resolveTestSessionMiddleware`：

- 读取 `X-Test-Session`
- 校验该会话是否属于当前登录用户
- 校验会话状态是否有效
- 解析 `X-Test-Now`
- 注入：
  - `req.testSession`
  - `req.effectiveNow`

### 2. 增加统一数据访问层

不要在业务逻辑里直接使用全局 `selectClassDataValue`。

应新增一层 store，例如：

```js
const createDataStore = (req) => ({
  readDataKey(userId, key) {},
  readAllData(userId) {},
  writeDataKey(userId, key, value) {},
  readMaintenanceCredential(userId) {},
  writeMaintenanceCredential(userId, value) {}
});
```

规则：

- 正式模式：读写 `class_data` / `maintenance_credentials`
- 测试模式：读写 `test_class_data` / `test_maintenance_credentials`

### 3. 时间读取统一改成 `getRequestNow(req)`

新增：

```js
const getRequestNow = (req) => {
  if (Number.isFinite(req?.effectiveNow)) return new Date(req.effectiveNow);
  return new Date();
};
```

替换现有直接 `new Date()` 的业务时间读取点，尤其是：

- `buildAttendanceRecordsForResponse`
- 一切计算当天、结算窗口、奖惩逻辑的地方

## 测试会话生命周期

### 进入测试模式

前端调用：

- `POST /api/test-sessions`

服务端执行：

1. 为当前用户创建一个新的 `test_sessions` 记录
2. 把当前用户正式 `class_data` 全量复制到 `test_class_data`
3. 把当前用户正式 `maintenance_credentials` 复制到 `test_maintenance_credentials`
4. 返回：

```json
{
  "success": true,
  "sessionId": "...",
  "simTimeMs": 1770000000000
}
```

### 测试中

用户页面所有接口自动携带：

- `X-Test-Session`
- `X-Test-Now`

此时：

- `GET /api/data` 读测试副本
- `POST /api/data` 写测试副本
- `maintenance/*` 操作测试副本
- `adjustments` 从测试副本读取

### 退出测试模式

前端调用：

- `DELETE /api/test-sessions/:id`

服务端执行：

- 删除对应测试会话
- 级联删除测试数据

前端随后：

- 清掉本地 `test_session_id`
- 清掉测试时间
- 强制重新拉取正式 `/api/data`

## 前端改造

### 当前测试模式要移除的部分

以下逻辑不应继续作为“真测试模式”的核心：

- 前端快照回滚
- 禁止网络同步
- 假维护密码成功

现有代码：

- [public/script.js](/home/binyu/文档/trae_projects/classmanager/classmanager-multi/public/script.js#L1756)
- [public/script.js](/home/binyu/文档/trae_projects/classmanager/classmanager-multi/public/script.js#L1859)
- [public/script.js](/home/binyu/文档/trae_projects/classmanager/classmanager-multi/public/script.js#L1945)

### 新前端行为

#### 进入测试模式

- 调 `POST /api/test-sessions`
- 存 `test_session_id` 到 `sessionStorage`
- 不再保存前端全量快照
- 保留 `simTime` 和 `timeSpeed` UI

#### 所有请求统一附带测试头

通过统一请求封装自动加头：

```js
{
  'X-Test-Session': currentTestSessionId,
  'X-Test-Now': String(simTime)
}
```

#### 退出测试模式

- 调 `DELETE /api/test-sessions/:id`
- 清本地测试会话 id
- `fetchFromServer({ allowDirtyOverride: true })`

## 冲突检测

测试模式中的冲突检测必须只针对测试副本内部，不应与正式数据互相冲突。

做法：

- `test_class_data` 内部也保存独立的 `__meta`
- `baseUpdatedAt` 只比较当前测试会话中的 `__meta.updatedAt`
- 不和正式 `class_data.__meta` 比较

这样测试中的多个标签页仍可复现真实冲突逻辑，但不会影响正式环境。

## 维护密码

维护密码在测试模式下也应完全独立：

- `setup`
- `unlock`
- `change`

都读写 `test_maintenance_credentials`

这样可以真实验证：

- 初次设置维护密码
- 改密码
- 过期重新验证

同时不污染正式维护密码。

## 考勤场景如何工作

这是本项目最关键的一点。

在真测试模式下：

- 打卡请求真实写入 `test_class_data.attendanceRecords`
- 服务端缺勤推导基于测试副本和 `X-Test-Now`
- 修正、结算、扣分都只发生在测试副本
- 退出测试模式后，正式 `attendanceRecords` 完全不变

这能真实覆盖你最近遇到的两类问题：

- 打卡未落库
- 缺勤推导覆盖显示

## 安全约束

### 普通用户页完全支持

本方案优先覆盖当前普通用户页面全部功能。

### 管理员后台默认不进入测试模式

管理员功能涉及：

- 用户角色修改
- 删除用户

这类跨用户、跨表的全局管理操作，不建议在第一版真测试模式里直接开放。

建议第一版策略：

- 用户首页支持真测试模式
- 管理员后台暂不支持测试模式

如果未来要支持管理员测试，应升级为“整库沙盒”方案。

## 清理策略

为防止用户异常退出后残留测试会话，增加清理机制：

- `expires_at` 默认 24 小时
- 服务启动时清理过期测试会话
- 定时清理过期测试会话

## 实施顺序

### 第一阶段

- 新增测试会话表
- 新增测试数据表
- 新增会话中间件
- 新增数据访问层

### 第二阶段

- 改造 `/api/data`
- 改造 `/api/maintenance/*`
- 改造 `/api/adjustments`

### 第三阶段

- 前端进入/退出测试模式改成服务端会话模式
- 所有请求自动带测试头
- 去掉当前“假保存”逻辑

### 第四阶段

- 把时间相关逻辑统一改成 `getRequestNow(req)`
- 做考勤、奖惩、维护、任务、宝物全链路回归

## 最终效果

用户进入测试模式后：

- 所有操作都像正式系统一样运行
- 所有接口都真实执行
- 所有数据都真实写入测试副本
- 页面刷新、切标签、自动保存、冲突检测都能真实复现
- 退出后只删除测试副本，正式系统完全不变

这才是真测试模式。
