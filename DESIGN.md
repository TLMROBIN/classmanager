---
name: ClassManager Multi
description: 让班级日常行动转化为清晰、可参与、可持续的成长反馈。
colors:
  action-blue: "#2563EB"
  action-blue-hover: "#1D4ED8"
  focus-blue: "#3B82F6"
  canvas-mist: "#F3F4F6"
  surface-white: "#FFFFFF"
  surface-subtle: "#F9FAFB"
  border-soft: "#E5E7EB"
  text-strong: "#1F2937"
  text-default: "#374151"
  text-muted: "#6B7280"
  info-soft: "#EFF6FF"
  success: "#16A34A"
  success-soft: "#F0FDF4"
  warning: "#D97706"
  warning-soft: "#FFFBEB"
  danger: "#DC2626"
  danger-soft: "#FEF2F2"
typography:
  display:
    fontFamily: "Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: "2.25rem"
  headline:
    fontFamily: "Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "2rem"
  title:
    fontFamily: "Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: "1.75rem"
  body:
    fontFamily: "Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
  label:
    fontFamily: "Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  micro:
    fontFamily: "Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
rounded:
  compact: "4px"
  control: "8px"
  surface: "12px"
  dialog: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.surface-white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.action-blue-hover}"
    textColor: "{colors.surface-white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.text-default}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface-white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  input-field:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.text-default}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  nav-tab:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    padding: "16px 8px"
  nav-tab-active:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.action-blue}"
    typography: "{typography.label}"
    padding: "16px 8px"
  status-chip:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.action-blue}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
  standard-surface:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.text-default}"
    rounded: "{rounded.surface}"
    padding: "16px"
  modal-panel:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.surface}"
    padding: "24px"
---

# Design System: ClassManager Multi

## 1. Overview

**Creative North Star: "成长可见的班级工作台"**

ClassManager 是一张明亮、可靠、随时可以开始操作的班级工作台。可信行动蓝负责指向下一步，白板白与雾灰负责承载高频信息，语义色只在结果确实发生时出现。视觉层级必须帮助教师迅速判断，也让学生在触控与投屏场景中清楚看见自己的行动和反馈。

系统可以在双子星、宠物等特定功能里形成有边界的主题氛围，但所有局部主题都必须保留统一的操作语法、状态含义和可读性。登录页的动画渐变与宠物舱的深色主题属于局部特例，不是新页面默认复制的全局风格。

设计明确拒绝低幼手游式刺激、冰冷企业后台和培训机构营销页。活力来自及时、真实的反馈；亲切来自清楚的语言与触控；可信来自稳定的组件、克制的色彩和可核验的状态。

**Key Characteristics:**

- 明亮的蓝白灰工作区，语义色按真实状态出现。
- 信息密度服务高频操作，不用装饰制造忙碌感。
- 触控友好、状态明确，键盘与投屏同样可用。
- 局部主题可以鲜明，全局操作语法必须一致。
- 动效只解释状态变化，并尊重减少动态效果设置。

## 2. Colors

这是一套以可信行动蓝为唯一全局强调色、以白板白和雾灰建立层级、以语义色诚实表达结果的克制产品色盘。

### Primary

- **可信行动蓝**（`colors.action-blue`）：用于主要操作、当前导航和明确选中状态；它必须稀缺，不能铺满普通容器。
- **深水操作蓝**（`colors.action-blue-hover`）：只用于可信行动蓝的悬停或按压状态，表达同一操作的深化反馈。
- **清晰焦点蓝**（`colors.focus-blue`）：用于键盘焦点环和需要被立即定位的交互边界。

### Secondary

- **成功绿与柔和成功面**（`colors.success`、`colors.success-soft`）：只表达完成、同步成功、正常出勤或正向结果。
- **提醒琥珀与柔和提醒面**（`colors.warning`、`colors.warning-soft`）：只表达待处理、规则提醒或需要注意但尚未失败的状态。
- **风险红与柔和风险面**（`colors.danger`、`colors.danger-soft`）：只表达错误、扣分、破坏性操作或不可忽略的风险。
- **信息浅蓝面**（`colors.info-soft`）：用于解释性提示、筛选选中和非紧急的信息状态。

### Neutral

- **白板白**（`colors.surface-white`）：主要工作面、表单和浮层的标准背景。
- **雾灰画布**（`colors.canvas-mist`）：应用底层背景，使白色工作面自然分离。
- **微光灰面**（`colors.surface-subtle`）：表头、页脚、次级分组和轻量悬停状态。
- **柔和分隔灰**（`colors.border-soft`）：结构边界和分隔线，不能与宽而软的阴影同时装饰同一容器。
- **深墨、稳定正文灰与辅助灰**（`colors.text-strong`、`colors.text-default`、`colors.text-muted`）：依次承担标题、正文与辅助信息；核心操作说明不得降级为辅助灰。

**The Single Action Blue Rule.** 可信行动蓝只属于主要动作、当前选择和焦点，不得作为无意义的装饰色块。

**The Semantic Honesty Rule.** 绿是成功，琥珀是提醒，红是风险；任何模块都不得为了“更活泼”而改写这套含义。

## 3. Typography

**Display Font:** Segoe UI（回退到 Roboto、Helvetica Neue 和系统无衬线字体）

**Body Font:** Segoe UI（使用同一回退栈）
**Label/Mono Font:** 界面标签沿用系统无衬线体；只有积分数值、时间和技术标识可以局部使用系统等宽字体。

**Character:** 单一、熟悉的系统无衬线字体让工具消失在任务后面。粗细与字号负责层级，不使用展示字体给按钮或数据增加虚假的品牌腔调。

### Hierarchy

- **Display**（`typography.display`）：只用于登录标题或极少数页面级标题，不能进入密集工作区。
- **Headline**（`typography.headline`）：页面主标题和重要结果摘要。
- **Title**（`typography.title`）：模块标题、弹窗标题和关键卡片标题。
- **Body**（`typography.body`）：说明与连续文本；长段落保持在 65–75ch 内。
- **Label**（`typography.label`）：按钮、表单标签、导航和表头，语气直接，不使用全大写与宽字距制造装饰。
- **Micro**（`typography.micro`）：时间戳、紧凑状态和次级元数据；关键积分、考勤结果和错误信息禁止使用该级别。

**The One Family Rule.** 产品界面只使用一套系统无衬线字体；层级来自尺寸、字重和间距，不来自额外字体。

**The Read-It-Across-the-Classroom Rule.** 投屏上的关键结果必须使用 Title 或更高层级，不能把学生需要看见的信息压成 Micro。

## 4. Elevation

系统采用结构化分层。普通工作面依靠白板白、雾灰画布和柔和分隔灰建立关系；低阴影只帮助可交互浮起状态，强阴影只属于弹窗、菜单等真正离开文档流的浮层。任何静态容器都不应为了“高级感”同时叠加完整边框与宽而软的阴影。

### Shadow Vocabulary

- **Ambient Low**（见侧车 `extensions.shadows.ambient-low`）：用于小型悬浮反馈或无边框的轻量卡片。
- **Structural Low**（见侧车 `extensions.shadows.structural-low`）：用于需要与底层背景轻微分离的菜单或工具面。
- **Overlay**（见侧车 `extensions.shadows.overlay`）：只用于模态面板等真正的顶层浮层，并配合遮罩建立阻断关系。

**The Border-or-Lift Rule.** 普通容器选择结构边框或轻微抬升中的一种；禁止把一像素边框与宽阴影组合成幽灵卡片。

**The Overlay Earns Its Shadow Rule.** 只有离开正常文档流、覆盖其他内容的元素才能使用 Overlay 阴影。

## 5. Components

组件的共同气质是“直接、触控友好、状态明确”。标准状态必须可预测，局部主题只能改变氛围，不能改变交互语法。

### Buttons

- **Shape:** 主要与次要按钮使用控制圆角（`rounded.control`），标签使用 `typography.label`；圆形图标按钮和标签胶囊才允许使用 `rounded.pill`。
- **Primary:** 使用 `components.button-primary`；悬停切换到 `components.button-primary-hover`，按压反馈短促，不使用弹跳。
- **Hover / Focus:** 悬停只深化色值；键盘焦点使用清晰焦点蓝外环，不能用取消 `outline` 代替完整焦点样式。
- **Secondary / Ghost:** 使用白板白或透明背景、稳定正文灰文字和柔和分隔灰边界；危险操作必须使用 `components.button-danger`，不能仅靠文案区分。
- **Touch:** 所有主要按钮和独立图标按钮的可点击区域不得小于 44×44px。

### Chips

- **Style:** 默认使用 `components.status-chip`；筛选胶囊与状态胶囊在语义上必须区分，不能把所有短文本都做成彩色徽章。
- **State:** 选中状态同时使用背景、文字或图标变化，不能只改变颜色；紧凑标签仍需满足正文对比度要求。

### Cards / Containers

- **Corner Style:** 标准工作面使用表面圆角（`rounded.surface`），大型登录容器可使用 `rounded.dialog`；普通卡片不得继续放大圆角。
- **Background:** 使用 `colors.surface-white`，分组层使用 `colors.surface-subtle`，页面底层使用 `colors.canvas-mist`。
- **Shadow Strategy:** 静态容器优先结构边框；确需抬升时只使用 Ambient Low，不与宽阴影叠加。
- **Internal Padding:** 紧凑操作区使用 `spacing.md`，标准工作面使用 `spacing.lg`，说明型或模态内容使用 `spacing.xl`。

### Inputs / Fields

- **Style:** 使用 `components.input-field`，配合柔和分隔灰边界；占位文字使用辅助灰且必须保持可读对比度。
- **Focus:** 使用清晰焦点蓝的边界与外环，不通过布局移动或阴影膨胀制造焦点。
- **Error / Disabled:** 错误同时提供风险红、图标或文字说明；禁用状态必须降低交互暗示并保留可读标签。

### Navigation

- **Style:** 顶部导航使用白板白、底部分隔线和 `components.nav-tab`；当前项使用 `components.nav-tab-active`，并增加明确的底部指示线。
- **Behavior:** 桌面端保持粘性顶部导航；窄屏允许横向滚动并保留当前项可见，不把九个功能强行压缩成难以触控的小标签。
- **Status:** 同步状态同时使用图标与文字，不只显示绿点或红点。

### Modal

- **Structure:** 使用半透明深色遮罩、`components.modal-panel`、清晰标题、可滚动正文和固定操作区。
- **Behavior:** 进入动效使用短促淡入或上移；必须支持减少动态效果。遮罩模糊只用于建立阻断层级，不是装饰性玻璃拟态。
- **Actions:** 取消在前、确认在后；破坏性确认使用风险红，并在文案中说清不可逆后果。

### Student Feedback Grid

- **Purpose:** 学生按钮、考勤状态与任务反馈应在投屏和触控中同时清楚；每个单元至少有姓名、状态文字或图标，不能只依赖背景色。
- **Density:** 网格可以紧凑，但触控区域不得小于 44×44px；内容过多时优先分组、筛选或滚动，而不是继续缩小文字。

## 6. Do's and Don'ts

### Do:

- **Do** 使用可信行动蓝指向主要动作、当前导航和焦点，把它限制在真正需要用户注意的位置。
- **Do** 让绿、琥珀、红保持稳定语义，并同时提供文字或图标说明状态。
- **Do** 保证主要触控目标至少 44×44px，键盘焦点清晰，200% 缩放和课堂投屏下的关键结果仍可读。
- **Do** 使用边框、色面和间距建立普通层级，只把强阴影留给真正的浮层。
- **Do** 让动效解释保存、选中、成功、失败或浮层进入，并为 `prefers-reduced-motion` 提供即时或淡入替代。
- **Do** 允许宠物、双子星等模块有边界地使用主题色，但始终保留统一的按钮、状态和可访问性规则。

### Don't:

- **Don't** 做低幼卡通或手游式刺激；禁止过量闪光、抽卡感和奖励轰炸，游戏化反馈必须服务真实成长。
- **Don't** 做冰冷的企业后台或密集数据大屏；禁止让信息压迫和指标堆叠取代清楚的班级任务。
- **Don't** 做培训机构营销页或宣传海报；禁止让口号、动画渐变和装饰压过真实操作。
- **Don't** 在同一静态容器上同时使用一像素完整边框与宽而软的阴影。
- **Don't** 给普通卡片使用大于 `rounded.dialog` 的圆角；超大圆角只属于完整胶囊或圆形控件。
- **Don't** 把登录页动画渐变或宠物深色舱体复制成全局默认主题。
- **Don't** 依赖颜色单独表达正确、错误、选中、缺勤或同步状态。
