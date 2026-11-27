# ClassManager 插件开发规范与 AI Agent 引导手册（v1.3）

> 与 [v2-three-end-plugin-architecture.md](./v2-three-end-plugin-architecture.md)（v2.2-reviewed）同步。本手册同时适用于**校园模式**与**个人模式**部署，并兼容无学生平板（纯一体机）班级。

> **给班主任老师的使用说明：**  
> 您完全不需要阅读下面的技术代码！想为班级定制专属功能时，建议按这个顺序尝试：
> 1. **先看设置**：很多需求只需在官方插件的设置页调参数（分值、时间、开关）。
> 2. **再用“自定义登记”和“积分规则”**：古诗背诵、早读、值日、作业上交、连续全勤奖励等玩法，在教师端用这两个官方插件点选配置即可，不写代码。
> 3. **最后才让 AI 帮您做**：
>    - **网页版 DeepSeek / 豆包**：在教师端点击【复制本班 AI 定制引导词】发给 AI，回答 AI 的三四个小问题后，把 AI 给出的代码块粘贴回教师端即可。AI 会优先帮您生成“积分规则配置”，确实需要新界面时才生成完整插件。
>    - **Workbuddy 等本地 Agent**：把本文件连同教师端生成的临时 `Plugin Dev Token` 交给 Workbuddy，它会自动拉取您班级的环境、写好并自检，然后推送到您班级的【测试沙盒】供您试用。
>
> 日常加减分、查询、出周报等操作不需要做插件，可直接让 AI 通过 [Agent API](./agent-api.md) 帮您完成。

---

## 第一部分：致 AI Agent（Workbuddy / DeepSeek / 豆包）的系统指令

当你（AI Agent）读取到本规范时，你的服务对象是一位**中学教师（非程序员）**。你的目标是用**最轻的方式**满足老师的定制需求，并交付 100% 符合 ClassManager 准入网关的产出物。请严格执行以下工作流。

### 0. 先判断定制级别（必须）
ClassManager 的定制能力分三级，**必须选择能满足需求的最低一级**：

| 级别 | 适用情况 | 你的产出 |
| :--- | :--- | :--- |
| L1 参数配置 | 官方插件已有此功能，只是参数不同 | 用日常语言告诉老师去哪个设置页改哪个参数，**不产出代码** |
| L2 规则模板 | “登记某件事 + 按规则加减分 + 大屏展示 / 联动其他插件” | 单个 `.cmrule.json` 规则配置（见第二部分） |
| L3 自制插件 | 需要全新的界面、交互或复杂计算，L2 无法表达 | 单个 `.cmplugin.json` 插件包（见第三部分起） |

如果你判断需要 L3，必须先用一句话向老师说明“为什么现有设置和积分规则做不到”。

### 1. 环境探测（若老师提供了 `Plugin Dev Token` 与服务器地址）
如果你运行在具备 HTTP 请求能力的环境（如 **Workbuddy**）且用户提供了开发令牌：
1. 先请求 `GET <SERVER_URL>/api/agent/plugins/dev-context`（请求头带 `Authorization: Bearer <DEV_TOKEN>`），获取：部署模式（`school` / `personal`）、本班终端模式（`terminalMode`: `'kiosk_only' | 'tablet_first' | 'hybrid'`）、底座插件协议版本、本班分组列表、班委角色列表、**积分标准分类与本班子分类**、班级展示开关（如 `publicPenaltyFeed`），以及当前已装插件发出的全部事件清单（`std.*` 与 `custom.*`）；
2. 生成产出物后，先调用 `POST <SERVER_URL>/api/agent/plugins/validate` 进行静态与沙盒干跑自检（规则配置与插件包均可校验）；若返回 `valid: false`，请根据 `errors` 自行修复直到 `valid: true`，绝不把语法错误抛给老师；
3. 校验通过后，调用 `POST <SERVER_URL>/api/agent/plugins/push-sandbox` 推入该班测试沙盒，并告知老师去网页端预览确认。**转正必须由老师在网页上亲自点击，你无权直接启用到正式环境。**

### 2. 强制“教学需求访谈”（严禁未确认需求就直接写代码）
动笔前必须先用**日常教学语言（零编程黑话）**向老师确认以下要点（单次提问不超过 4 条，每条给出推荐默认项）：
1. **核心规则与积分联动**：什么情况下加分或扣分？分值多少？计入哪个类别（只能从标准分类 `学业` / `纪律` / `卫生` / `出勤` / `班务` / `兑奖` / `待定` 中选择，可再加本班子分类）？是否需要与其他插件联动（如触发宠物成长或监听其他插件事件）？
2. **三端界面与权限分配**：
   - **教室一体机（16:9 横屏轮播看板）**：要不要在大屏上放一张展示卡？**是否需要保留一体机免登录点击操作入口**（仅限全班人人免密直点的场景，例如早读本人点击签到，建议配开关；注意：**凡属班委/课代表登记操作，即使老师说本班没有学生平板、只能在教室一体机登记，也一律按班委权限设计——L2 用 `recorder.officerRole`，L3 用 `officerPanel`，底座会自动投射到一体机的“班委刷 PIN 码登记抽屉”，切勿做成免密公开的 `kioskActionModal`！**）
   - **学生端与班委工作台**：普通学生能看到或操作什么？是否专门授权给某类**班委 / 课代表**在“班委工作台 / 一体机班委登记抽屉”里操作？
   - **教师端**：哪些参数需要做成设置项方便日后随时改？
3. **结算与重置周期**：每日清零、按周统计，还是长期累计？

### 3. 产品原则铁律（底座强制执行，你的设计也必须遵守）
1. **成绩绝不上大屏（物理终端硬隔离）**：任何考试成绩（含排名、分数段、单科分）都不得出现在一体机或学生公开动态中；即使班委或学生在一体机刷 PIN 解锁了临时抽屉，一体机物理屏幕仍正对全班可见，底座在 `terminalType === 'kiosk'` 时会物理阻断一切成绩接口（无平板班的成绩仅在教师端查看）；学生只能在个人平板端看到**本人**成绩。老师即使提出在大屏展示成绩的需求，也要礼貌说明系统禁止，并建议改为展示“进步之星”等不含分数的荣誉。
2. **扣分公示服从班级开关**：展示积分流水时必须使用 `ctx.ledger.listPublic()`，它会自动按班级的“扣分记录公开展示”开关过滤；不得自行读取原始流水绕过该开关。
3. **正向激励优先**：大屏与公开展示默认以荣誉、进步、加分为主，不默认展示末位排名。
4. **口径统一**：积分分类必须用标准分类；考勤类插件的出勤状态必须用 `ok` / `late` / `absent` / `leave`。

### 4. 交付格式铁律
- L2：输出**单个**完整、可直接被 `JSON.parse` 解析的 `.cmrule.json` 对象。
- L3：输出**单个**完整、无省略号（严禁写 `// ...其余省略`）、可直接被 `JSON.parse` 解析的 `.cmplugin.json` 对象。

---

## 第二部分：L2 规则配置协议（`.cmrule.json`，Schema `cm-rule/v1`）

规则配置由官方插件 `official.custom-register`（自定义登记项）与 `official.rules`（积分规则引擎）加载，不含任何代码，可跨部署分享。

```json
{
  "apiVersion": "cm-rule/v1",
  "name": "古诗背诵闯关",
  "description": "语文课代表登记古诗背诵，每过一首加 1 分，累计 10 首额外奖励并让宠物成长。",
  "registers": [
    {
      "key": "poem",
      "label": "古诗背诵",
      "recorder": { "teacher": true, "officerRole": "语文课代表" },
      "options": ["通过", "未通过"],
      "points": { "通过": { "zizai": 1, "category": "学业", "subCategory": "古诗背诵" } },
      "period": "long_term",
      "kioskCard": { "enabled": true, "title": "本周古诗闯关榜", "show": "top_progress" },
      "emits": "custom.poem.passed"
    }
  ],
  "rules": [
    {
      "name": "累计 10 首奖励",
      "when": { "event": "custom.poem.passed" },
      "if": { "countInPeriod": { "event": "custom.poem.passed", "period": "long_term", "gte": 10, "once": true } },
      "then": [
        { "action": "ledger.adjust", "zizai": 3, "category": "学业", "reason": "古诗背诵满 10 首" },
        { "action": "kiosk.announce", "title": "{name} 完成古诗十首闯关！", "tone": "honor" },
        { "action": "event.emit", "event": "custom.poem.milestone" }
      ]
    }
  ]
}
```

- **`when`**：触发事件，可为任意 `std.*` 或本班已有的 `custom.*` 事件，也可为定时触发 `{ "schedule": "daily@21:00" }`。
- **`if`**：可选条件，支持计数、连续天数（`streakDays`）、分组 / 班委身份、时间段等，具体可用条件以 `dev-context` 返回为准。
- **`then`**：动作，支持 `ledger.adjust`、`kiosk.announce`、`event.emit`、`pet.boost`（需已安装宠物插件）等。
- **`registers[].recorder.officerRole` 跨端自动投射**：配置了对应班委/课代表角色后，底座会自动依据本班 `terminalMode` 将该登记入口投射到学生平板的“班委工作台”和/或教室一体机的【班委 PIN 码登记抽屉】中，无需额外写端适配逻辑。
- 规则同样受第一部分第 3 条产品原则约束（例如不能把成绩写进 `kiosk.announce`）。

---

## 第三部分：L3 插件包标准协议（`.cmplugin.json`，Schema `cm-plugin/v1`）

插件包为单个 UTF-8 JSON 文件，总体积上限 `512 KB`，顶层结构如下：

```json
{
  "apiVersion": "cm-plugin/v1",
  "pluginId": "custom.morning-reading-checkin",
  "name": "早读双端灵活考勤",
  "version": "1.0.0",
  "description": "支持一体机应急点击打卡与考勤委员平板点名，迟到自动扣分并广播标准考勤事件。",
  "category": "attendance",
  "kernelCompat": ">=2.0 <3.0",
  "requires": [],
  "maintainer": { "name": "王老师", "contact": "" },
  "permissions": [
    "roster:read",
    "ledger:write",
    "storage:readwrite",
    "events:emit",
    "kiosk:public-action",
    "student:officer-action"
  ],
  "officerPermissions": [
    {
      "key": "checkin",
      "label": "早读平板点名权",
      "description": "允许被授权的班委在学生平板端登记全班早读出勤状态"
    }
  ],
  "emits": [
    {
      "event": "std.attendance.recorded@1",
      "description": "学生完成早读考勤登记时触发",
      "payloadExample": { "enrollmentId": "enr_1", "status": "ok", "slot": "morning" }
    }
  ],
  "subscribes": [],
  "configSchema": [
    {
      "key": "deadlineTime",
      "label": "早读截止时间 (HH:MM)",
      "type": "string",
      "default": "07:20"
    },
    {
      "key": "latePenalty",
      "label": "迟到扣分值（正数）",
      "type": "number",
      "min": 0,
      "max": 20,
      "default": 1
    },
    {
      "key": "allowKioskCheckin",
      "label": "允许在教室一体机公开点击打卡（平板故障应急兜底）",
      "type": "boolean",
      "default": true
    }
  ],
  "slots": {
    "teacherTab": { "label": "早读考勤", "icon": "clock" },
    "kioskSlide": { "title": "今日早读出勤" },
    "kioskActionModal": { "buttonLabel": "早读打卡", "icon": "check" },
    "officerPanel": { "label": "早读点名", "requiredOfficerPermission": "checkin" },
    "studentWidget": { "title": "我的早读状态" }
  },
  "hooks": ["dailyCron"],
  "serverCode": "/* 服务端沙盒 JS 源码字符串 */",
  "uiCode": "/* 前端三端视图沙盒 JS 源码字符串 */"
}
```

**插槽跨端自适应说明（`slots`）：**
- `officerPanel` 具有**自动跨端投射能力**：在有学生平板的班级，它渲染在学生平板的“班委工作台”；在无学生平板（`terminalMode === 'kiosk_only'`）或混合兜底（`'hybrid'`）班级，底座会自动将其投射进教室一体机右下角的【班委 PIN 码登记抽屉】（班委刷本人 PIN 解锁后操作）。插件作者只需实现一次 `exports.slots.officerPanel`，无需重复编写端适配界面。

### 1. 兼容与部署声明
- **`kernelCompat`**：插件兼容的底座版本范围。底座升级时会据此做兼容检查，不兼容的插件会被安全停用并提示老师。
- **`requires`**：运行前提。默认留空 `[]`，表示两种部署模式都能运行。仅当插件依赖校园模式能力（如全校班级目录、统一认证信息、校级看板）时声明 `["school-mode"]`；依赖其他插件时声明如 `["plugin:official.pet"]`。**请尽量避免依赖校园模式**，这样插件才能进入官方市场供个人模式老师使用。
- **`maintainer`**：插件维护人。分享到市场后，作者调离时管理员可转移维护人。

### 2. 权限白名单（`permissions`）
未声明的权限在沙盒内不会挂载对应方法：
- `"roster:read"`：读取本班在籍（`active`）学生名册（含 `enrollmentId`, `studentNo`, `name`, `groupId`, `dormId`, `zizai`, `penalty`, `balance`）。个人模式下 `studentNo` 可能为空，不能当作唯一标识，应使用 `enrollmentId`。
- `"roster:write-group"`：修改本班学生的分组槽位（分组类插件专用）。
- `"ledger:read"` / `"ledger:write"`：读取本班积分流水 / 调用底座积分账本执行加减分（单次绝对值上限 `50` 分）。
- `"storage:readwrite"`：读写本插件在本班的隔离 KV 存储。
- `"events:emit"` / `"events:subscribe"`：向本班双层事件总线发送事件 / 订阅事件。
- `"kiosk:public-action"`：允许教室一体机端免个人登录触发标记了 `allowKiosk: true` 的 Action。
- `"student:action"`：允许已登录普通学生在平板（或开启了自助开关的一体机 30 秒自助窗）触发个人 Action（如发留言、买道具、领任务）。
- `"student:officer-action"`：允许持有对应 `officerPermissions` 的班委触发管理 Action（**同时覆盖学生平板“班委工作台”与一体机刷本人 PIN 解锁后的“班委登记抽屉”**）。
- `"exam:read"`：读取成绩底表，**严格绑定物理终端 `terminalType` 执行隔离**：
  - 仅在 `terminalType === 'teacher'` 的视图与 Action、`hooks`、`onEvent` 中可用 `ctx.exam.list()`；
  - 仅在 `terminalType === 'student_tablet'` 的学生私有视图可用 `ctx.exam.getOwn()` 读取**当前登录学生本人**的成绩；
  - **凡物理终端为 `terminalType === 'kiosk'`（包括一体机大屏轮播、免密弹窗以及班委/学生刷 PIN 解锁的一体机抽屉）或学生公开动态时，`ctx.exam` 整体物理不挂载**，`ctx.kiosk.announce` 也不能在本次调用链中携带成绩字段；
  - 允许输出由成绩计算出的**非成绩结果**（如分组名单、“进步之星”称号），但不得包含任何分数、排名或分数段。

### 3. 双层事件命名规范（`emits` 与 `subscribes`）
- **底座标准事件（`std.*@版本`）**：优先复用标准事件以兼容官方插件与其他班级的插件：

  | 事件 | 载荷 |
  | :--- | :--- |
  | `std.points.changed@1` | `{ enrollmentId, delta, scene, category, subCategory, reason, sourcePluginId }`（底座账本自动发出） |
  | `std.attendance.recorded@1` | `{ enrollmentId, status: 'ok' \| 'late' \| 'absent' \| 'leave', slot, timestamp }` |
  | `std.group.updated@1` | `{ assignments: { [enrollmentId]: groupId } }` |
  | `std.task.completed@1` | `{ enrollmentId, taskId, title, reward }` |

  省略 `@版本` 时视为当前大版本。同一大版本内底座只会增加字段，不删除、不改语义。
- **开放自定义事件（`custom.<插件简称>.<动作>`）**：标准事件无法表达时（如 `custom.poem.passed`、`custom.dorm.starred`），可自由定义以 `custom.` 开头的事件名，并在 `emits` 中写明 `description` 与 `payloadExample`。平台导出本班引导包时会自动把它展示给后续制作插件的 AI。

---

## 第四部分：服务端沙盒规范（`serverCode` 与 `ctx` SDK）

`serverCode` 运行在无网络、无文件系统的受控沙盒中（单次执行硬超时 `50ms`），通过 `exports` 导出：

- **`exports.getViewData(ctx)`**：按 `ctx.viewer.terminalType`（物理终端）与 `ctx.viewer.actorType`（操作人身份）返回脱敏视图数据（`ctx.viewer.clientType` 作为兼容字段保留）。
- **`exports.actions`**：定义可被前端 `api.callAction(name, payload)` 调用的服务端操作，必须显式声明调用方白名单（`allowTeacher`、`allowKiosk`、`allowStudent` 或 `requiredOfficerPermission`）。
- **`exports.onEvent(ctx, eventName, payload)`**（可选）：处理 `subscribes` 中订阅的事件。
- **`exports.hooks`**（可选）：如 `dailyCron(ctx)`。

### 核心 `ctx` SDK 速查
- **`ctx.now()`** `=> number`：获取当前毫秒时间戳（**严禁使用 `Date.now()` 或无参 `new Date()`**，必须用 `ctx.now()` 以支持真测试模式时间快进）。
- **`ctx.time.formatDate(ms)`** `=> "YYYY-MM-DD"` / **`ctx.time.formatHM(ms)`** `=> "HH:MM"`。
- **`ctx.config`**：当前班级合并默认值后的插件配置对象。
- **`ctx.deployment`**：`{ mode: 'school' | 'personal', kernelVersion }`，只读。
- **`ctx.classSettings`**：`{ terminalMode, publicPenaltyFeed, pointLabels, categories }`，只读。
- **`ctx.viewer`**：`{ terminalType, actorType, clientType, isPublicView, enrollmentId, roleNames, hasOfficerPermission(key) }`：
  - `terminalType`: `'teacher' | 'kiosk' | 'student_tablet' | 'system'`（物理终端边界，**隐私脱敏与成绩拦截必须看此字段**）；
  - `actorType`: `'teacher' | 'student_officer' | 'student' | 'kiosk_anonymous' | 'system'`（当前操作人身份；班委在一体机刷本人 PIN 解锁抽屉时，`terminalType === 'kiosk'` 且 `actorType === 'student_officer'`，`hasOfficerPermission(key)` 照常返回 `true`）；
  - `clientType`: 兼容简写（`'teacher' | 'kiosk' | 'student'`，仅作旧逻辑兼容，新插件请优先按 `terminalType` 与 `actorType` 分别判定物理屏幕隐私与身份权限）；
  - `isPublicView`: `boolean`（所有 `terminalType === 'kiosk'` 视图——含一体机上的班委 PIN 抽屉——以及学生公开动态页恒为 `true`；为 `true` 时必须调用 `ctx.ledger.listPublic()` 并隐藏私密备注/悄悄话）。
- **`ctx.roster.list()`** / **`ctx.roster.getById(enrollmentId)`** / **`ctx.roster.updateGroups(map)`**。
- **`ctx.ledger.adjust({ enrollmentId, delta, scene, category, subCategory, reason })`**：走底座统一账本。`category` 必须为标准分类，否则调用失败；若调用者是“先审后效”岗位的班委，底座自动路由进待审池并返回 `{ queuedForApproval: true }`。
- **`ctx.ledger.listPublic({ since, limit })`**：读取可公开展示的流水，自动遵守 `publicPenaltyFeed` 开关。**一体机与学生公开视图必须使用此方法。**
- **`ctx.ledger.list({ since, limit })`**：读取完整流水，仅 `terminalType === 'teacher'` 的教师视图与服务端内部逻辑可用。
- **`ctx.exam.list()` / `ctx.exam.getOwn()`**：见第三部分权限说明中的成绩隔离规则。
- **`ctx.storage.get(key)` / `set(key, val)` / `delete(key)` / `listKeys(prefix)`**。
- **`ctx.events.emit(eventName, payload)`**：发出已在 `manifest.emits` 声明的事件。
- **`ctx.kiosk.announce({ title, subtitle, tone })`**：向教室一体机大屏发送一条 5 秒荣誉弹窗动效并触发页面刷新。`tone` 建议使用 `honor` / `info`，不提供“点名批评”类样式。

---

## 第五部分：前端三端视图规范（`uiCode` 与平板 / 一体机准则）

`uiCode` 无编译步骤，**严禁使用 JSX `<div>` 尖括号语法**，一律使用 `api.h(type, props, ...children)` 与内置 Tailwind CSS 类名。

### 关键终端适配要求
1. **教室一体机轮播页（`slots.kioskSlide`）**：16:9 全屏无滚动分页轮播。控制在一屏高度内展示核心摘要或网格（字号建议 `text-base` ~ `text-2xl` 保证后排看清），不要堆砌超长纵向列表。默认展示荣誉与进步，不默认展示末位。
2. **触控热区**：学生平板与一体机弹窗中所有按钮最小高度不低于 `44px`（`min-h-[44px]`）。
3. **零外网依赖**：禁止引用任何 `http://` 或 `https://` 外链图片、脚本或字体。

---

## 第六部分：版本、发布与维护

### 1. 版本号与兼容
- 插件 `version` 遵循 `主版本.次版本.修订号`。修改了 `configSchema` 中已有字段含义或存储结构时必须升主版本。
- 班级安装的插件**锁定在已装版本**，不会被动升级；老师在教师端手动确认后才升级。
- 底座弃用某个接口或事件版本后，至少保留一个完整学年。收到弃用提示的插件应在此期间发布新版本。

### 2. 发布渠道

| 渠道 | 可用部署 | 说明 |
| :--- | :--- | :--- |
| 私有（本班） | 两种模式 | 通过自动准入校验即可在本班使用 |
| 本校插件市场 | 仅校园模式 | 班主任一键分享，本校管理员可加精或下架 |
| 官方插件市场 | **两种模式都可安装** | 由项目方审核、签名并标注兼容版本；本校市场的优秀插件可申请推荐。声明了 `requires: ["school-mode"]` 的插件只对校园模式部署显示 |
| 文件流转 | 两种模式 | 导出 `.cmplugin.json` / `.cmrule.json`，通过微信或教研群分享，对方导入后仍需通过准入校验 |

### 3. 维护归属
- 市场中的插件以 `maintainer` 为维护人。维护人停止维护时，管理员可转移维护人，或标记为“无人维护”（仍可使用，安装时提示风险，不再推荐）。

---

## 第七部分：交付前准入红线自检清单（Gatekeeper Checklist）

**L2 规则配置（`.cmrule.json`）：**
1. [ ] 顶层为单个严格合法的 JSON，`apiVersion` 为 `cm-rule/v1`。
2. [ ] 所有积分动作的 `category` 均为标准分类。
3. [ ] 引用的事件均为 `std.*` 或 `dev-context` 中本班已有 / 本配置新声明的 `custom.*` 事件。
4. [ ] `kiosk.announce` 与大屏展示卡不含任何成绩信息。

**L3 插件包（`.cmplugin.json`）：**
1. [ ] 顶层为单个严格合法的 JSON，无注释、无尾随逗号、无省略号代码。
2. [ ] `pluginId` 以 `custom.` 开头且仅含小写字母、数字与连字符。
3. [ ] 已声明 `kernelCompat`；`requires` 只包含确实必需的前提，未无故声明 `school-mode`。
4. [ ] 源码中**零禁用词**：不含 `eval`, `Function`, `fetch`, `XMLHttpRequest`, `WebSocket`, `window`, `document`, `localStorage`, `sessionStorage`, `process`, `require`, `import`。
5. [ ] 服务端取当前时间全部使用 `ctx.now()`，未出现 `Date.now()`。
6. [ ] 源码中不含任何 `http://` 或 `https://` 外网 URL。
7. [ ] 所有调用的 `ctx.*` 能力与发出的事件均已在 `permissions`、`emits`、`subscribes` 中如实声明。
8. [ ] `manifest.slots` 声明的每个槽位在 `uiCode` 的 `exports.slots` 中均有对应函数实现，且纯用 `api.h(...)` 无 JSX。
9. [ ] 所有 `ctx.ledger.adjust` 的 `category` 为标准分类；考勤状态使用 `ok` / `late` / `absent` / `leave`。
10. [ ] **成绩隔离**：`terminalType === 'kiosk'` 的全部一体机视图（包括一体机班委 PIN 抽屉）、学生公开视图与 `kiosk.announce` 中不出现任何分数、排名或分数段；`ctx.exam.getOwn()` 仅限 `terminalType === 'student_tablet'` 展示本人成绩。
11. [ ] **扣分公示**：一体机与学生公开视图中的积分流水全部来自 `ctx.ledger.listPublic()`。
12. [ ] `getViewData(ctx)` 在 `ctx.viewer.terminalType === 'kiosk'` 或 `isPublicView === true` 下严格执行隐私脱敏（即使已刷班委 PIN 解锁抽屉，也绝不泄露成绩、私密悄悄话或教师备注）。
13. [ ] 不使用 `studentNo` 作为唯一标识（个人模式下可能为空），统一使用 `enrollmentId`。

---

*（注：当本文件由教师端动态导出时，系统将在下方自动追加 `## 第八部分：本班当前环境上下文（部署模式、终端模式 terminalMode、分组字典、积分分类、班级展示开关与已装插件可用事件目录）` 供 AI 直接引用。）*
