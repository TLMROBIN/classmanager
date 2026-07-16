---
target: 考勤与积分主流程
total_score: 20
p0_count: 0
p1_count: 3
timestamp: 2026-07-16T22-37-34Z
slug: public-attendance-module-js
---
Method: dual-agent (A: /root/critique_a · B: /root/critique_b)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 2/4 | 有当前时段与已打卡状态，但缺少提交中状态；成功反馈三秒即消失，失败常退化为原生弹窗。 |
| 2 | Match System / Real World | 3/4 | 班级、时段、积分语言自然，但迟到扣分仍显示“打卡成功”，语义与后果冲突。 |
| 3 | User Control and Freedom | 2/4 | 积分有取消与撤销；考勤结果不能暂停、关闭或就地修正。 |
| 4 | Consistency and Standards | 2/4 | 原生 alert/confirm、自定义弹窗、div 选人和高动效考勤反馈并存，交互语法不统一。 |
| 5 | Error Prevention | 2/4 | 有时段与重复打卡防护，但无单人提交锁；看似阻断的全屏反馈仍允许底层点击。 |
| 6 | Recognition Rather Than Recall | 3/4 | 导航、规则、姓名和选中数可见；隐藏滚动条、图标按钮仍要求猜测。 |
| 7 | Flexibility and Efficiency | 2/4 | 积分有筛选、全选、批量与预设，但键盘路径、原因搜索和大班级定位不足。 |
| 8 | Aesthetic and Minimalist Design | 2/4 | 核心数据可读，但动画格言、留言、维护与多个登记模块争夺主任务注意力。 |
| 9 | Error Recovery | 1/4 | 错误多为无恢复建议的弹窗；实测打卡后返回登录页，没有解释，也没有生成记录。 |
| 10 | Help and Documentation | 1/4 | 有少量说明，但缺少禁用原因、会话失效、积分语义与误操作修正的上下文帮助。 |
| **Total** |  | **20/40** | **Acceptable：基础可用，但核心流程仍需显著改进。** |

## Anti-Patterns Verdict

**Does this look AI-generated?** 局部会，整体不会。问题集中在考勤反馈这一块“视觉噪声口袋”，而不是整个产品。

**LLM assessment:** 主应用已有熟悉、可用的教师工具骨架，但考勤页把发光呼吸的黄色渐变格言、Georgia 展示字体、烟花、弹跳、emoji、粗边框和大阴影叠在一次日常打卡上。它与周围克制的蓝白灰工作区断裂，也直接撞上 PRODUCT.md 中“不做低幼手游式刺激”的边界。更严重的是，视觉高峰很响，操作收尾却很弱：没有持久回执、新余额、修正入口和可靠的失败恢复。

**Deterministic scan:** 扫描 `public/attendance/module.js` 与 `public/operations`，退出码 2，共 22 项：20 个 warning、2 个 advisory。逐项核对后，19 个 `gray-on-color` 是扫描器跨互斥条件分支配对造成的误报。保留 3 个有效信号：`public/attendance/module.js:534` 的休息日灰字落在蓝色提示面上；`public/attendance/module.js:539` 的 10px 状态字；`public/operations/history-section.js:213` 的 11px 标签。后两处脱离 DESIGN.md 字号梯度，也不利于投屏和低视力阅读。

**Visual overlays:** 两个代理都建立了独立临时数据库并进入已登录页面。A 实际查看了考勤与积分页面；B 到达已登录考勤页并确认控件结构。浏览器安全策略拒绝 `javascript:` 可变注入，因此没有启动检测服务器、没有注入 overlay，也没有可靠的用户可见覆盖层；可用的回退证据是已登录页面的可见 DOM 状态与源码路径。

## Overall Impression

它已经具备一套真正能工作的班级工具基础：当前时段、姓名、积分变化、批量操作与撤销都有数据支持。最大机会不是再加视觉效果，而是把“当前时段 → 点名/选人 → 等待 → 结果 → 修正”收成一条单焦点、可访问、可核验的闭环。现在的设计把情绪预算花在烟花与弹跳上，却没有把信任预算花在持久回执和错误恢复上。

## What's Working

1. **时段与规则上下文能防止低级错误。** 页面显示日期时间、当前时段、迟到阈值和当天规则；时段外与已完成学生会禁用。
2. **反馈数据已经足够丰富。** 前端能拿到准点/迟到、积分增减、迟到卡与连胜信息，不必停留在泛化的“成功”。
3. **积分路径已有高效批量基础。** 筛选、全选、奖惩切换、预设分值、个别调整、近期历史和撤销，已经接近教师高频工作流需要的能力。

## Priority Issues

### [P1] 主流程没有完成键盘与辅助技术闭环

**Why it matters:** 积分选人使用只有 `onClick` 的 div，键盘用户无法进入；选中状态没有 `aria-pressed`。弹窗缺少 `role=dialog`、焦点圈定、Escape、关闭按钮名称与焦点恢复。考勤结果没有 live region，hover 才出现的图标操作对触控和键盘用户不可发现。

**Fix:** 把学生单元改为 button，并加入 `aria-pressed` 与可见焦点；结果回执使用 `role=status`/`aria-live`；弹窗改为完整语义对话框；图标按钮全部提供可访问名称；主要触控区域至少 44×44px；补齐 `prefers-reduced-motion`。

**Suggested command:** `$impeccable audit public/attendance/module.js public/operations/views.js public/ui/modal.js`，随后 `$impeccable harden …`。

### [P1] 考勤与积分页面缺少单一主任务

**Why it matters:** 考勤页同时展示动画格言、通知编辑、规则、学生网格、留言、统计与设置；积分页把快速积分、作业、跑操、设置与历史堆在同一长页。全局导航也有八个同权选项。教师熟悉后能用，但学生、代课教师和投屏场景都承受高认知负荷。

**Fix:** 让“当前时段 + 学生网格”成为考勤首屏唯一主角；格言降为静态次级信息；通知编辑、留言管理与维护进入明确的教师工具。积分页用任务级标签或渐进披露分开快速积分、专项登记与历史。

**Suggested command:** `$impeccable distill public/attendance/module.js public/operations/module.js`，随后 `$impeccable layout …`。

### [P1] 反馈很响，但提交与恢复不可靠

**Why it matters:** 点击后没有单人 pending 锁；全屏视觉层设置 `pointer-events-none`，看似阻断却仍可误触底层；结果三秒后消失。独立浏览器实测中，一次打卡点击直接回到登录页，没有可见原因，也没有生成记录。这会让教师和学生怀疑积分是否真的变化。

**Fix:** 点击后立即锁定对应学生并显示提交中；将烟花全屏层改为网格附近的持久回执，包含学生、状态、积分增减、新余额、时间与“查看/修正”；会话失效时保留意图，解释需要重新登录并提供重试；toast 只作次级强化。

**Suggested command:** `$impeccable harden public/attendance/module.js`，随后 `$impeccable clarify …`。

### [P2] 日常考勤反馈偏离新设计基线

**Why it matters:** 连续 glow/breath/pulse、serif 展示字体、渐变、烟花、bounce/pop、大阴影和 emoji 把普通打卡做成手游式奖励峰值，违背“有活力、亲切、可信”与单一行动蓝原则。迟到扣分仍使用庆祝式“打卡成功”，更损害语义诚实。

**Fix:** 使用系统无衬线体、可信行动蓝与稳定语义色；移除连续动画与弹跳，只保留 150–250ms 状态过渡；分别为准点、迟到卡、迟到扣分使用诚实标题与克制色面；把 10px/11px 状态文字提升到规范字号。

**Suggested command:** `$impeccable quieter public/attendance/module.js public/styles.css`，随后 `$impeccable typeset …` 与 `$impeccable polish …`。

## Persona Red Flags

### Alex（高频班主任）

- 每天重复操作仍需越过格言、通知与多模块内容；没有考勤搜索、分组或键盘加速。
- 积分原因横向栏隐藏滚动条，没有最近使用、收藏或搜索；预设增长后效率会下降。
- 专项登记与历史拉长页面，快速积分路径没有被明确保护。

### Sam（键盘、读屏或减少动态效果用户）

- 考勤按钮语义尚可，但结果不播报、不管理焦点、不能关闭。
- 积分学生 div 无法键盘选择；弹窗没有完整对话框语义。
- 无限 glow、pulse、firework 与 quote 动画没有 reduced-motion 替代。
- hover-only 删除按钮在触控与键盘路径中不可发现。

### Jordan（首次使用的学生或代课教师）

- 五秒内最强视觉是格言，不是当前操作。
- 禁用学生单元没有就地解释下一个可打卡时间。
- “打卡成功”与迟到、断连或扣分结果冲突。
- 学生侧与教师侧编辑/维护工具混在同一表面，角色边界不清。

## Minor Observations

- 考勤头部蓝到靛色渐变偏离单一行动蓝规则；Georgia 格言字体偏离单字体规则。
- 多处 `px-3 py-1 text-xs` 操作需要 44px 触控目标审计。
- 消息输入依赖 placeholder 而非持久标签；键盘事件仍使用 `onKeyPress`。
- 空格言数组会使每日格言取值失效；长姓名与大班级没有搜索、分组或明确溢出策略。
- 自定义弹窗仍使用 bounce 动效，与产品动效规范不符。

## Questions to Consider

- 如果投屏上只能有一个视觉主角，它应是每日格言、当前时段与学生网格，还是刚刚产生的学生结果？
- 迟到扣分是否应该继续使用与准点相同的“🎉 打卡成功”峰值？
- 教师通知编辑、学生留言与维护设置是否真的应该出现在学生打卡表面？
- 为了让一次打卡可信，结束时必须保留积分变化、新余额和修正入口中的哪几项？
