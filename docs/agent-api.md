# ClassManager Agent API

这组接口供 Agent 或其他受控 HTTP 客户端使用，不需要服务器操作系统账号，也不需要浏览器自动化。客户端必须能访问 ClassManager 的 HTTP 地址；数据写入仍受普通用户登录和维护密码保护。

## 认证流程

1. `POST /api/auth/login`
   ```json
   {"username":"班主任账号","password":"登录密码"}
   ```
   保存响应中的 `Set-Cookie`，后续请求带上 `Cookie`。
2. `POST /api/maintenance/unlock`
   ```json
   {"password":"维护密码"}
   ```
   保存响应中的 `token`，积分变更请求带上 `X-Maintenance-Token`。维护令牌有效期为 10 分钟。

不要把密码放在命令行参数、URL、日志或请求结果中。优先使用系统钥匙串、权限为 0600 的本地配置或交互式输入。

测试会话如需使用服务端沙盒，还要在每个请求中带上 `X-Test-Session`；维护令牌必须在对应测试会话中重新解锁。

## 查询学生

`GET /api/agent/students?q=张三&limit=20`

`q` 会匹配学生 ID、姓名、组别或宿舍；省略 `q` 可查询全部学生，`limit` 最大为 200。接口只返回 Agent 所需的受限学生视图，不返回完整班级数据、学生档案或维护凭据。

响应示例：

```json
{
  "success": true,
  "query": "张三",
  "count": 1,
  "updatedAt": 1720000000000,
  "students": [
    {
      "id": "stu_1",
      "name": "张三",
      "group": "discipline",
      "dorm": "boy_715",
      "zizai": 10,
      "balance": 10,
      "penalty": 0,
      "lastPenaltyAt": 0
    }
  ]
}
```

## 增加或扣除积分

`POST /api/agent/points/adjust`

请求必须带：

- 登录 Cookie；
- `X-Maintenance-Token`；
- `Idempotency-Key`，用于防止 Agent 或网络重试造成重复加扣分。

请求体：

```json
{
  "studentId": "stu_1",
  "delta": 1,
  "reason": "早读表现良好",
  "scene": "班级",
  "category": "纪律",
  "expectedUpdatedAt": 1720000000000
}
```

- `studentId` 优先；也可以使用精确的 `studentName`。姓名重名时接口返回 `409 AMBIGUOUS_STUDENT`，不会写入。
- `delta` 为正数时增加积分，负数时扣除积分并增加 `penalty`；单次绝对值不能超过 100。
- `reason` 必填，最长 200 个字符。
- `scene` 可选值：`宿舍`、`班级`、`校级`、`其他`。
- `category` 可选值：`待定`、`学业`、`纪律`、`卫生`、`兑奖`、`出勤`、`班务`。
- `expectedUpdatedAt` 来自学生查询响应；版本不一致时返回 `409 DATA_CONFLICT`，不会写入。

成功响应会返回 `student` 的最新积分、积分历史记录 ID、操作 ID和新的 `updatedAt`。使用相同 `Idempotency-Key` 重试同一请求时会返回 `replayed: true`，不会再次变更积分。

## 典型 Agent 流程

1. 按姓名调用查询接口。
2. 若没有结果或有重名，停止并向用户说明；不要猜学生。
3. 使用唯一 `studentId`、查询得到的 `updatedAt`、明确原因和新生成的 `Idempotency-Key` 调用积分变更接口。
4. 把响应中的变更前后结果和历史记录 ID反馈给用户。

当前没有单独的 CLI；Agent 可以直接调用这两个 HTTP 接口，网页端也继续使用原有流程。
