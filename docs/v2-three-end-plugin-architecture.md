# ClassManager 2.0：三端分离与微内核插件底座架构方案

> 状态：方向已定，分阶段设决策点（v2.2-reviewed，2026-11-27 补充无学生移动端/纯一体机兼容机制）  
> 核心定位：一套**可私有部署、数据归老师和学校、可深度定制的班级运营系统**。面向中学班主任，提供教师端 / 教室一体机端 / 学生平板端三端体验（支持无学生平板班级降级为“教师端 + 纯一体机”完整运行）；既能作为学校统一部署的智慧校园组件，也能作为个人班主任独立使用的产品。“玩法皆插件、官方插件市场跨部署共享、AI 辅助教师零代码定制、1.0 存量数据无损升级”。

**哪些已锁定，哪些未锁定：**
- **已锁定**：底座四件套的概念边界（身份与名册、积分账本、成绩底表、插件引擎与事件总线）、`std.*` 标准事件契约及其版本政策、本文第 0 节的产品原则。
- **按阶段决策**：具体表结构细节、插件包格式演进、市场运营形态、各阶段范围。每个阶段结束时依据真实使用反馈复盘调整（见第 9 节）。

---

## 0. 产品定位与原则

### 0.1 一句话定位与差异化
同类产品（如希沃班级优化大师、钉钉/企业微信家校功能）已经覆盖“通用班级积分”。ClassManager 不在通用积分上硬拼，差异化在于：

| 维度 | ClassManager 的选择 |
| :--- | :--- |
| 部署与数据主权 | 可私有部署（校内服务器 / 个人设备），数据归老师和学校，不依赖外网 |
| 可定制深度 | 参数配置 → 规则模板 → AI 自制插件的三级定制阶梯 |
| 班级运营玩法 | 宠物养成、双子星对抗、藏宝阁、悬赏任务等游戏化机制 |
| 长期价值 | 跨学期积分账本沉淀为可导出的学生成长档案，对接综合素质评价 |

### 0.2 产品原则（写入底座默认行为，插件不可绕过）
1. **成绩绝不上大屏（物理终端数据防火墙）**：考试成绩只允许教师在教师端查看、学生本人在**个人平板端**查看（无平板班仅教师端可查或导出打印个人成绩条）。底座在路由层与插件沙盒实施**物理终端数据防火墙（Device Data Firewall）**：只要底层请求凭证为一体机 `cm_kiosk_token`，即使叠加了班委或学生临时 PIN 票据，仍一律硬拦截 `exam_archives`（成绩底表）、私密档案与悄悄话（统一返回 `403 KIOSK_PRIVACY_BLOCKED`）；任何声明了成绩读取权限的插件，都不能向一体机插槽或学生公开动态输出内容。
2. **扣分公示可开关**：班委实名操作流水默认向全班公示，用于防暗箱。班级设置提供“扣分记录公开展示”开关，关闭后扣分流水只对本人、教师和操作班委可见；加分公示与荣誉弹窗不受影响。
3. **正向激励优先**：官方插件和大屏默认以加分、荣誉、成长为主要展示内容；排行类看板默认展示进步与荣誉，不默认展示末位。
4. **教学口径统一，玩法放开**：积分分类、出勤状态等基础口径由底座统一定义（见第 5 节），插件玩法自由。
5. **AI 是助手，不替老师做决定**：AI 生成的插件必须经教师在测试沙盒试用确认后才能转正；AI 操作正式账本必须使用受限令牌且全程留痕。

### 0.3 明确的非目标（暂不做）
- **家长端**：家校沟通需求真实存在，但会显著增加老师的回复负担，并引入更多未成年人信息外流风险，而且已有成熟的 IM 工具覆盖。2.x 阶段不做家长端；如需对家长输出，仅以“教师手动导出成长报告”的形式提供。
- **通用 LMS / 作业批改 / 排课**：不做教学平台，只做班级运营。

---

## 1. 部署形态：校园模式与个人模式

产品同时服务两类用户，底座必须把两者都当作一等公民，不能让个人用户因为没有学校配合而无法使用。

| | **校园模式（School Edition）** | **个人模式（Personal Edition）** |
| :--- | :--- | :--- |
| 典型用户 | 已取得学校支持、统一部署在校内服务器 | 其他学校的班主任个人使用 |
| 部署位置 | 校内服务器 / 智慧校园内网 | 个人电脑、NAS、个人云主机等 |
| 教师登录 | 学校统一认证（OAuth2 / CAS / 签名 Token）+ 账号密码备用 | 账号密码 |
| 学生登录 / 终端形态 | 平板统一认证免密直进 + 姓名卡片 / PIN 备用；无学生平板班级可降级为“教师端 + 纯一体机（免密考勤 / 班委刷个人 PIN 登记）” | 姓名卡片 + 个人 PIN；同样支持有平板与无平板（纯一体机）两种班级形态 |
| 班级来源 | 从全校班级目录认领建班 | 教师自行创建班级（无全校目录） |
| 多教师协作 | 支持主班主任 / 协管老师 | 支持（邀请同部署内的其他账号） |
| 校级看板 | 支持（年级组 / 德育处只读视角，见 5.3） | 不提供 |
| 插件来源 | 官方插件市场 + 本校插件市场 + 私有 / 导入 | 官方插件市场 + 私有 / 导入 |

**设计要求：**
- 统一认证、全校班级目录、校级看板都是**可选的部署能力**，由部署配置 `deployment.mode = school | personal` 开启，不属于底座运行的前提条件。
- 两种模式共用同一套底座、同一套插件协议和同一套 `std.*` 事件，且**均同时支持有学生平板与无学生平板（纯一体机）班级**（无平板班仅凭“教师端 + 教室一体机”即可完成日常考勤与班委登记，详见 4.1.1）。仅依赖校园能力的插件需在 manifest 中声明 `requires: ["school-mode"]`。
- 个人模式应做到“下载即用”：首次启动向导完成建班、导入名单、勾选官方插件模板，延续 1.x 的新手引导体验。
- 个人模式的班级日后如果所在学校统一部署，支持“导出班级 → 导入校园部署并绑定目录”的迁移路径。

---

## 2. 核心架构决策总览

### 2.1 底座（Microkernel）与插件（Plugins）的精确切分
采用 **“精简微内核底座 + 官方预装插件模板”** 架构。

- **微内核底座（不可卸载的最小公用设施）**：
  1. **可插拔认证与班级目录**：认证适配层支持统一认证（校园模式）与账号密码 / 学号 + PIN（两种模式通用）；全校班级目录仅在校园模式启用。
  2. **班级与师生组织架构**：建班（校园模式为认领建班）、邀请协管老师、移交班级主权；维护在籍学生名单、组别槽位、宿舍槽位、动态班委岗位与细粒度权限（Scoped RBAC）。
  3. **原子积分核心账本（Core Point Ledger）**：统一维护学生的三轨积分（`zizai` 自在值 / 荣誉分、`penalty` 不自在值 / 累计扣分、`balance` 可消费余额，显示名称支持各班自定义），提供带幂等键、实名审计与一键撤回的唯一记账通道。每条流水带有统一口径的积分分类（见第 5 节）。
  4. **考试成绩底表（Core Exam Store）**：教师全量维护成绩档案，学生端仅查本人成绩，插件按声明权限受控读取脱敏数据，且受 0.2 第 1 条“成绩绝不上大屏”约束。
  5. **插件引擎、双层事件总线与真测试沙盒**：负责插件准入校验、隔离运行、三端插槽挂载、SSE 实时广播、兼容性检查，以及支持时间模拟的服务端真测试模式。
  6. **开放 API（Agent / Integration API）**：面向 AI Agent 与外部工具的受限令牌接口，是“AI 作为操作员”的基础（见 4.5）。

- **官方预置插件（均可启停、卸载或被替换；新建班级可一键勾选模板预装）**：
  - `official.attendance`：双模考勤插件（默认保留一体机应急点击打卡开关 + 考勤班委平板点名）
  - `official.message-board`：班级留言板与悄悄话插件（班级公开墙 + 给老师的私密悄悄话双通道；公开留言默认需老师审核后上大屏，可关闭审核改为直发；含每日条数防刷）
  - `official.officer-registers`：专员日常登记插件（噪音 / 书桌 / 平板 / 卫生 / 跑操登记及专员补贴）
  - `official.daily-wage-decay`：每日班委工资与扣分自动衰减插件
  - `official.grouping`：智能人员分组插件（成绩均衡蛇形分组、随机抽签等）
  - `official.treasure`：藏宝阁积分商城与祈愿抽卡插件（平板兑换、教师端核销）
  - `official.tasks`：班级悬赏任务插件
  - `official.battle`：双子星对抗赛制插件
  - `official.pet`：班级电子宠物养成插件
  - `official.weekly-report`：班级周报生成插件
  - `official.custom-register`：**通用自定义登记插件**（新增）。老师自定义登记项（如古诗背诵、早读、值日、作业上交），配置登记人（教师 / 指定班委）、分值、周期与大屏展示卡，覆盖大部分“小定制”需求，无需写代码。
  - `official.rules`：**积分规则模板引擎**（新增）。以“当……发生时 → 若满足……条件 → 执行……动作”的可视化规则订阅 `std.*` / `custom.*` 事件，例如“连续 5 天准时到校 → 加 2 分 → 宠物经验 +10”。
  - `official.growth-archive`：**学生成长档案插件**（新增）。按综合素质评价维度汇总跨学期账本，生成可导出的个人成长报告（见 5.2）。

---

## 3. 校园真实生命周期：建班、入班与升班 / 换班

### 3.1 建班与协管机制
1. **校园模式：按需认领建班**。系统维护一份 `school_class_catalog`（全校年级与班级目录，支持校内接口同步或管理员批量预置）。班主任登录教师端后，从全校班级列表中选择自己带的班级完成“认领建班”。尚未被认领的班级，学生用平板打开时看到提示页：“你所在的班级（如高一 5 班）暂未开通班级管理系统，请联系班主任开通”。
2. **个人模式：自由建班**。教师直接填写班级名称、年级标签创建班级，`catalog_code` 为空。
3. **多师协同与移交**：建班人成为该班 `owner`（主班主任），可邀请副班主任或科任老师作为 `collaborator`（协管老师，可分配加减分、看成绩、核销道具等权限，不可删班）；学期变动时支持将主班主任权限一键移交给接班老师。

### 3.2 学生双层身份模型
将学生数据拆分为**全局自然人身份表（`student_accounts`）**与**班级在籍档案表（`class_enrollments`）**：

- **场景 A：老师先导 Excel 名单，学生后登录**  
  系统按学号预建 `active` 在籍档案。校园模式下学生首次统一认证进入时按学号自动认领合并，免密进入本班；个人模式下学生在平板上选姓名卡片 + 初始 PIN 进入。
- **场景 B：老师只建了班还没导名单，或中途转来新学生先登录（校园模式）**  
  不在名单内的学生带着匹配的“年级 + 班号 + 学号”进入时，自动生成 `pending` 申请；班主任在教师端点一次“确认入班”即转为正式成员。后续导入 Excel 时按学号增量合并（Upsert），不重建、不冲掉已有积分。
- **场景 C：全班整体升年级 vs 学生中途换班 / 分科重组**
  - **整体升年级**：`class_id` 不变，仅更新年级标签（校园模式同时更新目录关联），积分、背包、宠物、分组全部延续。
  - **个别转班 / 分科进新班**：原班 `class_enrollments` 转为 `archived`（原班流水完整保留备查，移出原班点名表、分组与班委职务）；在新班创建零起点的新在籍记录。
  - **成长档案跨班延续**：积分余额归零起步，但 `student_accounts` 下的全部历史流水仍可由成长档案插件汇总，学生三年的成长记录不因换班中断。

---

## 4. 三端交互、插件市场与 AI 定制

### 4.1 三端交互与权限

| 终端 | 核心交互与布局设计 | 权限机制 |
| :--- | :--- | :--- |
| **教师端**<br>(`/teacher`) | 桌面与移动端自适应；名册准入、班委岗位授权、大屏轮播编排、插件市场安装与参数配置、今日班委操作撤回 / 待审池、真测试沙盒演练。 | 统一认证或账号密码登录；区分 `owner` 与 `collaborator`。移除旧版维护密码。 |
| **教室一体机端**<br>(`/kiosk`) | 16:9 全屏无滚动多页自动轮播看板（老师勾选上屏插件卡片、排序及停留秒数）；学生课间可点击标签手动翻页（纯查看）；加分或留言过审时触发 SSE 荣誉弹窗动效。右下角按班级配置提供【班务登记】双层抽屉（第一级为免密公开入口如考勤打卡；第二级为班委刷本人 PIN 码进入的短时登记台；可选开启无平板班学生 30 秒刷 PIN 自助兑奖/宠物浮窗）。**任何情况下成绩物理阻断不上屏。** | 6 位配对码绑定设备令牌（`cm_kiosk_token`）。底座拦截一切无权限写操作：仅当插件声明 `kiosk:public-action` 且老师开启对应开关时开放免密动作；班委点选姓名 + 输本人 4~6 位 PIN 码换取**仅驻留前端内存**的短效票据 `X-Kiosk-Actor-Token`（不覆盖 `cm_kiosk_token`，点退出即毁、无操作 90 秒自动锁屏退回大屏）。 |
| **学生平板端**<br>(`/student`) | 10~11 寸平板触控优先（点击热区 `≥44px`，零外网 CDN 依赖）；本班公开动态、个人积分账单、**本人成绩（仅本人可见）**、已装学生端插件；班委额外展示“班委工作台”。 | 校园模式优先统一认证免密直进，两种模式均保留“姓名卡片 + PIN”；默认个人专属平板长登录，可切为“公用平板 5 分钟无操作自动退登”。 |

#### 4.1.1 兼容无学生移动端：三种终端模式与插槽跨端投射
当部分或全部班级学生没有平板/手机等移动端时，班级无需恢复旧版“全班共用维护密码”，而是通过**终端模式切换 + 双凭证物理防火墙 + 语义化插槽投射**实现同一套底座与插件的无缝兼容：

1. **三种终端运行模式（`terminal_mode`，教师端班级设置可随时切换）**：
   - **`kiosk_only`（纯一体机模式，无学生平板）**：底座自动将基础班委记分台、L2 `official.custom-register` 登记面板及所有已装 L3 插件的 `officerPanel` 收纳投射至教室一体机右下角的【班务登记 -> 班委 PIN 码抽屉】；考勤开启一体机免密打卡；若开启可选开关 `allow_kiosk_self_service`，允许无平板班学生刷个人 PIN 码开启 30 秒自助浮窗（仅限藏宝阁兑奖/喂宠物等非成绩功能）。
   - **`tablet_first`（平板协同模式）**：`officerPanel` 与学生个人功能全部挂载在平板 `/student` 端，一体机保持纯净只读大屏（仅按需保留应急考勤窗口）。
   - **`hybrid`（双端混合兜底模式，默认）**：平板端全功能开放的同时，一体机也保留【班委 PIN 码登记抽屉】作为平板集中充电、忘带或故障时的常态化备用入口。
2. **双凭证解耦与物理终端防火墙**：班委在一体机刷 PIN 后，请求同时携带底层设备令牌 `cm_kiosk_token`（识别物理终端为公共大屏）与内存短效操作票据 `X-Kiosk-Actor-Token`（识别操作人为哪位班委）。服务端与插件沙盒始终以 `terminalType === 'kiosk'` 触发物理隐私防火墙——即使已刷班委 PIN，一体机仍硬拦截一切成绩、私密档案与悄悄话读取（`403 KIOSK_PRIVACY_BLOCKED`），成绩仅在教师端查看（或导出打印个人成绩条）。
3. **插件零改造跨端投射**：官方插件与 AI 自制插件均只需声明语义化的 `officerPanel` 插槽（L2 只需声明 `recorder.officerRole`），底座依据本班 `terminal_mode` 自动决定挂载到平板工作台还是/且投射进一体机【班委登记抽屉】，不需要为无平板班开发第二套代码。

### 4.2 班委加减分双模监督机制（平板与一体机抽屉通用）
教师创建班委 / 课代表岗位时配置受限能力，无论班委在学生平板“班委工作台”还是在教室一体机【班委 PIN 码登记抽屉】操作，均统一执行同一套约束：
- **额度硬顶**：允许操作的积分分类 / 场景、单次加减分上下限（如 `-3 ~ +3`）、每日最大操作次数。
- **按岗位双模切换**：
  - **即时生效模式（默认）**：立即入账，流水实名打上终端来源（如“操作人：纪律委员-李四（一体机登记）”或“纪律委员-李四（平板登记）”）。公示范围受班级“扣分记录公开展示”开关控制（见 0.2）；教师端首页提供按人 / 按批次一键撤回。
  - **先审后效模式（可选）**：班委提交的记录进入教师端“待审池”，老师勾选通过后入账。

### 4.3 三级定制阶梯
多数老师的定制需求是“自定义登记项 + 积分规则 + 展示卡”，不需要写代码。因此定制能力分三级，越往下越灵活，维护成本也越高：

| 级别 | 方式 | 覆盖场景 | 产出物 |
| :--- | :--- | :--- | :--- |
| L1 参数配置 | 在官方插件设置页调参 | 分值、时间节点、开关、显示名称 | `class_plugins.config_json` |
| L2 规则模板 | `official.custom-register` + `official.rules` 可视化配置；也可让 AI 生成规则配置 | 预计覆盖约 80% 的“班级特色玩法” | `.cmrule.json` 规则配置（无代码，可跨部署分享） |
| L3 自制插件 | AI 辅助生成完整 `.cmplugin.json` | 需要新界面、新交互的特殊玩法 | 插件包（含代码） |

教师端的“我想定制一个功能”入口先引导到 L1 / L2，确实满足不了时再进入 L3。AI 引导包同样优先尝试产出 L2 规则配置。L2 / L3 的协议细节与 AI 工作流见 [plugin-agent-guide.md](./plugin-agent-guide.md)（v1.3）。

### 4.4 双层事件总线
底座内置**本班隔离的双层事件总线**：

1. **标准教学事件（`std.*`）**：底座预定义，如 `std.points.changed`、`std.attendance.recorded`、`std.group.updated`、`std.task.completed`。不论班级装的是官方插件还是自制插件，只要发出标准事件，宠物、全勤奖、周报、成长档案等插件即可联动。
2. **开放自定义事件（`custom.*`）**：不设枚举上限。自制插件在 `manifest.emits` 中声明独创事件及字段说明（如 `custom.poem.passed`），其他插件在 `manifest.subscribes` 中订阅。
3. **动态上下文注入 AI 引导包**：教师点击“获取 AI 插件制作引导包”时，系统将本班已装插件发出的全部事件契约、分组字典和积分分类口径拼接到引导文档末尾，让 AI 能写出精准联动的插件。

### 4.5 AI 的两种角色：开发者与操作员

**角色一：AI 作为插件开发者**（采用 `.cmplugin.json` 单文件自包含插件包）
- **模式 A：网页对话式 AI（DeepSeek / 豆包）手动粘贴链**：老师一键复制“本班定制版 AI 引导提示词” → AI 经教学问答后输出规则配置或插件 JSON → 粘贴回教师端，过准入校验后进入测试沙盒试用。
- **模式 B：本地 Agent（Workbuddy）全自动调试链**：教师端生成限时 `Plugin Dev Token`（仅可读取本班脱敏插件上下文、调用校验接口、向本班测试沙盒推送草稿），Agent 依次调用 `GET /api/agent/plugins/dev-context`、`POST /api/agent/plugins/validate`、`POST /api/agent/plugins/push-sandbox`，自检修错后推入沙盒，老师预览满意后一键转正。

**角色二：AI 作为日常操作员**（在现有 1.x Agent API 基础上演进）
- 老师对 AI 说“给第三组今天值日的同学每人加 1 分”“生成本周周报”，AI 通过开放 API 完成登记、查询与报告生成。
- 使用按能力授权的受限令牌（如仅允许“加减分 + 查询名单”），所有操作写入账本并标注 `operator_type = 'agent'`，支持一键撤回。
- 长期看，AI 工具的形态变化很快，**底座 API 与 `std.*` 事件的稳定性比任何一种插件包格式都更重要**，两条路线都建立在它之上。

### 4.6 插件市场：三层结构

| 市场层级 | 范围 | 谁可发布 | 谁可安装 | 审核 |
| :--- | :--- | :--- | :--- | :--- |
| **官方插件市场**（公开） | 跨部署，由项目方托管的公开插件源 | 项目方；后期开放社区投稿 | **所有部署**（校园模式与个人模式） | 项目方审核、签名、标注兼容版本 |
| **本校插件市场** | 单个校园部署内 | 本校教师 | 本校教师 | 本校管理员加精 / 下架 |
| **私有 / 文件导入** | 单个班级 | 教师本人 | 本班；可导出 `.cmplugin.json` 通过微信 / 教研群流转 | 仅自动准入校验 |

- 个人模式教师虽然没有本校市场，但可以直接浏览和安装官方插件市场中的全部插件，并接收官方插件的版本更新。
- 部署离线时，官方市场插件可通过“离线插件包”手动导入，保持零外网依赖的能力。
- 本校市场中质量好的插件，作者可申请“推荐至官方市场”，经项目方审核后对所有部署可见。
- **插件维护归属**：市场中每个插件有明确的维护人。作者调离或停止维护时，管理员可转移维护人，或标记为“无人维护”（仍可使用、提示风险、不再推荐）。已安装的班级始终锁定在已装版本，不会被动升级。

### 4.7 底座 API 与事件的版本承诺
这是生态长期存续必须锁死的契约：
1. **版本标识**：插件协议以 `apiVersion: "cm-plugin/v1"` 标识；标准事件带版本号（如 `std.points.changed@1`）。
2. **兼容承诺**：同一大版本内只增加字段、不删除、不改语义；破坏性变更必须升大版本。
3. **弃用周期**：旧版本接口与事件在宣布弃用后至少保留**一个完整学年**。
4. **升级前兼容检查**：底座升级时自动检查各班已装插件的兼容性；不兼容的插件被安全停用并提示老师，而不是带病运行或拖垮班级数据。
5. **官方市场标注**：每个插件标明“兼容底座版本范围”，安装时自动过滤不兼容版本。

---

## 5. 统一口径、成长档案与校级视角

### 5.1 校级标准数据口径
玩法放开，口径统一。以下内容由底座定义，所有同类插件必须遵守：
- **积分分类枚举**：`学业` / `纪律` / `卫生` / `出勤` / `班务` / `兑奖` / `待定`。班级可自定义显示名称和子分类，但必须映射到标准分类。
- **出勤状态枚举**：`ok` / `late` / `absent` / `leave`。任何考勤插件发出 `std.attendance.recorded` 时都必须使用该枚举。
- **综评维度映射**：每个标准分类映射到综合素质评价维度（见 5.2）。

这样一来，无论各班装的是官方考勤还是自制考勤，年级与学校层面都能横向汇总。

### 5.2 学生成长档案与综合素质评价
账本跨学期沉淀的数据，是本系统最有长期价值、也最能说服学校的资产：
- 积分分类映射到综合素质评价五个维度：**思想品德、学业水平、身心健康、艺术素养、社会实践**。映射关系由底座提供默认值，学校（校园模式）或教师（个人模式）可调整。
- `official.growth-archive` 按学期 / 学年汇总每个学生的荣誉记录、任务完成、班务贡献、出勤情况，生成可导出的个人成长报告，供综评材料填报、期末评语、家长会使用。
- 成长档案仅对学生本人和有权限的教师可见，不上大屏；**考试成绩不进入成长档案的公开部分**。

### 5.3 校级只读视角（仅校园模式）
- 新增校级角色 `school_viewer`（如年级组长、德育处），可查看授权范围内各班的出勤率、积分分类汇总、班级活跃度等**聚合指标**，不能修改任何班级数据，看不到个人成绩明细。
- 不单独开发“第四端”，以教师端中的“校级看板”页面实现。

---

## 6. SQLite 2.0 核心表结构概览

> 表结构细节按阶段决策，以下为当前方向，相比初稿新增了部署模式、插件来源、维护归属与校级角色相关字段。

```sql
-- 0. 部署配置（单行）
CREATE TABLE deployment_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    mode TEXT NOT NULL DEFAULT 'personal',   -- 'school' | 'personal'
    school_name TEXT,
    official_market_url TEXT,                -- 官方插件市场源地址（可空，离线时手动导入）
    settings_json TEXT NOT NULL DEFAULT '{}' -- 统一认证适配器配置、综评维度映射等
);

-- 1. 全校班级字典（仅校园模式使用）与班级
CREATE TABLE school_class_catalog (
    catalog_code TEXT PRIMARY KEY,      -- 如 '2026_G1_C03'
    grade_name TEXT NOT NULL,           -- 如 '高一'
    class_name TEXT NOT NULL,           -- 如 '3班'
    display_name TEXT NOT NULL,         -- 如 '高一(3)班'
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE classes (
    id TEXT PRIMARY KEY,                -- 内部固定主键 如 'cls_xxx'（升年级不变）
    catalog_code TEXT UNIQUE,           -- 校园模式关联班级目录；个人模式为空
    title TEXT NOT NULL,
    grade_label TEXT,                   -- 年级标签（个人模式自填）
    owner_teacher_id INTEGER NOT NULL,
    terminal_mode TEXT NOT NULL DEFAULT 'hybrid', -- 'kiosk_only' | 'tablet_first' | 'hybrid'
    allow_kiosk_self_service INTEGER NOT NULL DEFAULT 0, -- 无平板班是否允许学生刷PIN开启30秒自助窗
    tablet_session_mode TEXT NOT NULL DEFAULT 'personal', -- 'personal' | 'shared_5m'
    kiosk_playlist_json TEXT NOT NULL DEFAULT '[]',
    config_json TEXT NOT NULL DEFAULT '{}', -- 分组/宿舍字典、积分别名、分类映射、公示开关(publicPenaltyFeed)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE class_teachers (
    class_id TEXT NOT NULL,
    teacher_id INTEGER NOT NULL,
    role TEXT NOT NULL,                 -- 'owner' | 'collaborator'
    permissions_json TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (class_id, teacher_id)
);

-- 校级只读角色（仅校园模式）
CREATE TABLE school_staff_roles (
    teacher_id INTEGER NOT NULL,
    role TEXT NOT NULL,                 -- 'school_viewer' | 'school_admin'
    scope_json TEXT NOT NULL DEFAULT '{}', -- 可见年级/班级范围
    PRIMARY KEY (teacher_id, role)
);

-- 2. 学生双层身份
CREATE TABLE student_accounts (
    id TEXT PRIMARY KEY,
    student_no TEXT UNIQUE,             -- 学号（校园模式必填；个人模式可空）
    sso_uid TEXT UNIQUE,
    name TEXT NOT NULL,
    pin_hash TEXT,
    must_change_pin INTEGER NOT NULL DEFAULT 1,
    last_sso_catalog_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE class_enrollments (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    student_account_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'pending' | 'archived'
    seat_or_no TEXT,
    group_id TEXT,
    dorm_id TEXT,
    zizai REAL NOT NULL DEFAULT 0,
    penalty REAL NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 0,
    profile_json TEXT NOT NULL DEFAULT '{}',
    avatar_json TEXT NOT NULL DEFAULT '{}',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    archived_at DATETIME,
    UNIQUE (class_id, student_account_id)
);

-- 3. 班委动态岗位
CREATE TABLE class_roles (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    name TEXT NOT NULL,
    approval_required INTEGER NOT NULL DEFAULT 0,
    capabilities_json TEXT NOT NULL
);

CREATE TABLE enrollment_roles (
    enrollment_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (enrollment_id, role_id)
);

-- 4. 教室一体机配对设备
CREATE TABLE kiosk_devices (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    last_seen_at DATETIME,
    revoked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. 原子积分核心账本与待审池
CREATE TABLE point_ledger (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    enrollment_id TEXT NOT NULL,
    delta_zizai REAL NOT NULL DEFAULT 0,
    delta_penalty REAL NOT NULL DEFAULT 0,
    delta_balance REAL NOT NULL DEFAULT 0,
    scene TEXT NOT NULL,
    category TEXT NOT NULL,                 -- 必须为标准分类枚举（见 5.1）
    sub_category TEXT,                      -- 班级自定义子分类
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'applied', -- 'applied' | 'pending_approval' | 'rejected' | 'reverted'
    operator_type TEXT NOT NULL,            -- 'teacher' | 'student_officer'（含平板与一体机PIN抽屉） | 'kiosk_plugin' | 'plugin_auto' | 'agent'
    operator_id TEXT NOT NULL,
    operator_label TEXT NOT NULL,           -- 含终端来源标注，如 '纪律委员-李四（一体机登记）' / '纪律委员-李四（平板登记）'
    source_plugin_id TEXT NOT NULL DEFAULT 'core',
    idempotency_key TEXT UNIQUE,
    reverted_by_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. 插件市场、班级安装实例与隔离存储
CREATE TABLE plugin_packages (
    plugin_id TEXT NOT NULL,
    version TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'local',       -- 'official_market' | 'school_market' | 'local' | 'imported'
    visibility TEXT NOT NULL DEFAULT 'private', -- 'official' | 'school_market' | 'private'
    featured INTEGER NOT NULL DEFAULT 0,
    author_teacher_id INTEGER,
    author_name TEXT,
    maintainer_name TEXT,
    maintenance_status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'unmaintained' | 'withdrawn'
    kernel_compat TEXT NOT NULL DEFAULT 'cm-plugin/v1',
    signature TEXT,                             -- 官方市场签名（可空）
    manifest_json TEXT NOT NULL,
    server_code TEXT NOT NULL,
    ui_code TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (plugin_id, version)
);

CREATE TABLE class_plugins (
    class_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    version TEXT NOT NULL,                      -- 锁定版本，不被动升级
    enabled INTEGER NOT NULL DEFAULT 1,
    disabled_reason TEXT,                       -- 如 'incompatible_kernel'
    config_json TEXT NOT NULL DEFAULT '{}',
    installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, plugin_id)
);

CREATE TABLE plugin_storage (
    class_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    storage_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, plugin_id, storage_key)
);
```

---

## 7. 1.0 存量数据无损迁移

针对已有的正式班级数据，采用“先自动备份封存，再幂等迁移转换”策略。迁移脚本 `scripts/migrate-v1-to-v2.js`：
- 自动调用 `scripts/backup-sqlite.js` 生成迁移前快照并校验完整性；
- 根据部署配置选择目标模式：本校服务器迁入校园模式，其他 1.x 自部署用户迁入个人模式；
- 将原 `users (role='user')` 转为教师账号并创建对应 `classes`；
- 将原 `students` 与 `studentProfiles` 拆入 `student_accounts` + `class_enrollments`（完整保留三轨积分、分组、宿舍、头像与档案）；
- 将原 `history` 逐条迁入 `point_ledger`，保留时间戳与原因，并把旧分类映射到标准分类枚举；将 `examArchives` 迁入成绩底表；
- 按原 `config` 启用状态在 `class_plugins` 中开启对应官方插件，并将 `attendanceRecords`、`messages`、`treasures/storage/logs`、`battle`、`pets` 迁入对应插件的 `plugin_storage` 命名空间。

---

## 8. 风险清单

| 风险 | 影响 | 应对 |
| :--- | :--- | :--- |
| 第二系统效应：一次性重写导致长期“新的没好、旧的不敢动” | 现有用户长时间得不到新价值 | 渐进替换，在 1.x 上分阶段长出 2.0（第 9 节） |
| 插件生态冷启动：自制插件作者太少 | 市场空心化 | 先做强 L2 规则模板与官方市场；个人模式用户也能用官方插件 |
| 自制插件随底座升级失效、作者离开无人维护 | 班级功能突然坏掉 | 版本承诺 + 升级前兼容检查 + 维护归属转移（4.6、4.7） |
| 各班插件不同导致学校无法横向统计 | 校级价值缺失 | 统一数据口径（5.1） |
| 积分公示引发同伴关系或家长争议 | 产品在校园中的正当性 | 成绩不上屏、扣分公示开关、正向激励优先（0.2） |
| 单人维护的可持续性 | 产品公开后支持压力大 | 优先保证底座稳定与文档完善；官方插件数量宁少勿滥 |

---

## 9. 分阶段实施路线与决策点

学校支持已经取得，校园模式能力可按计划推进；同时从第 0 阶段起就按“两种部署模式共用一个底座”设计，避免日后为个人模式返工。

| 阶段 | 内容 | 进入下一阶段的条件 |
| :--- | :--- | :--- |
| **阶段 0：内核提炼** | 在 1.x 内部先抽出积分账本、标准分类口径与 `std.*` 事件；现有模块按内部插件方式重组（暂不开放第三方插件）；引入 `deployment.mode` 与认证适配层骨架；完成 v1 → v2 迁移脚本与演练 | 本校正式数据迁移演练通过，现有功能零回退 |
| **阶段 1：三端上线** | 学生平板端 + 一体机 16:9 轮播与班委刷 PIN 短时登记抽屉（含 `terminal_mode` 切换）；班委双模账本；扣分公示开关；物理终端成绩防火墙（`cm_kiosk_token` 硬阻断成绩）与个人平板端仅本人可查成绩；校园统一认证 + PIN 备用 | 本校有平板班及无平板（纯一体机）班均能每天稳定使用 |
| **阶段 2：协作与口径** | 多教师协作与移交；校级只读看板；成长档案插件与综评维度映射 | 有科任老师 / 年级组真实参与使用 |
| **阶段 3：定制阶梯** | `official.custom-register` 与 `official.rules`（L2）；插件引擎、准入校验、版本兼容检查；AI 引导包优先产出规则配置；Agent API 演进为受限能力令牌 | 老师能不写代码完成大部分特色玩法 |
| **阶段 4：开放生态** | 个人模式安装包与首次启动向导；官方插件市场（公开插件源、签名、兼容标注、离线包）；本校插件市场；L3 自制插件与 Workbuddy 开发链；社区投稿通道 | 出现 3 位以上非项目方的插件作者；有外校个人用户稳定使用 |

每个阶段结束时复盘：真实使用数据、老师反馈、维护成本，再决定下一阶段的范围是否调整。
