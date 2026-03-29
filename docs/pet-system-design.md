# 班级宠物系统设计与落地方案

## 1. 当前结论

班级宠物系统按独立模块实现，由 `enabledFeatures.pet` 控制开关，不接入藏宝阁商品体系。当前采用的设计约束如下：

- 全班首次开启时，所有学生都从同一状态起步
- 初始状态统一为龙蛋，只有 `balance` 保持各自现状
- 学生点击宠物卡后，在浮窗内手动孵化，随机获得一个物种
- 宠物成长由 `history + attendanceRecords + manualBoosts` 派生，撤销安全
- 宠物详细信息直接展示在宠物卡中，点击后打开浮窗进行孵化、改名、商城购买
- 增加维护密码验证后的管理入口，支持一键重置全班宠物系统

## 2. 当前实现范围

### Phase 1

- 30 个物种定义保留在 `public/pet/species.js`
- 宠物状态存于 `pets` 域，结构由 `public/pet/state.js` 维护
- 仅保留 3 个核心状态轴：`happiness`、`health`、`energy`
- 阶段先使用：`egg -> young -> growth -> adult`
- 商城为宠物系统内置商城，不依赖 treasure schema

### 延后内容

- 能力系统
- 饰品系统
- 战斗联动
- 与藏宝阁互通

## 3. 数据与状态规则

`pets[studentId]` 最小结构：

```js
{
  speciesId,
  nickname,
  level,
  exp,
  stage,
  happiness,
  health,
  energy,
  initializedAt,
  hatchedAt,
  lastHistoryTs,
  lastAttendanceTs,
  manualBoosts,
  careLog,
  accessories
}
```

规则：

- 未孵化时固定为龙蛋状态，等级 1，经验 0，三维状态相同
- 只有 `hatchedAt` 之后的 `history` 和 `attendanceRecords` 才参与计算
- 购买宠物道具会写入 `manualBoosts` 与 `careLog`
- 重置后，所有宠物回到相同的龙蛋初始态，不影响学生余额

## 4. 视觉改造目标

现有 MVP 已具备功能，但宠物形象仍以 emoji 为主。下一轮改造目标是将 `public/pet/宠物素材.txt` 中的赛博宠物 UI 素材融入当前系统，同时保持现有交互和状态逻辑不变。

目标：

- 将外链宠物图片本地化到仓库
- 用本地图替换当前宠物主形象
- 保留没有专属图时的 emoji fallback
- 将卡片与浮窗统一为赛博展示舱风格
- 保持卡片信息密度，不回退成“大图大白块”的布局

## 5. 素材本地化策略

素材文件中的图片大多为外链，不直接依赖线上资源。落地时采用三级资源策略：

### 5.1 S 级资源

单独主视觉：

- 龙蛋
- 龙系
- 猫系
- 鸟系
- 水系
- 火系
- 幽灵系
- 自然系
- 速度系
- 王冠兽系

### 5.2 A 级资源

按 family 共享视觉图：

- 萌系
- 神秘系
- 自然系
- 炫酷系
- 学霸系

### 5.3 B 级资源

图片缺失时回退：

- 继续显示 emoji
- 保留赛博舱体、光晕、徽章和状态条

## 6. 资源目录约定

新增目录：

- `public/pet/assets/egg/`
- `public/pet/assets/pets/`
- `public/pet/assets/thumbs/`
- `public/pet/assets/bg/`

推荐命名：

- `dragon-egg-shell.svg`
- `dragon-neon-main.webp`
- `cyber-cat-main.webp`
- `robo-bird-main.webp`
- `glitch-beast-main.webp`
- `titan-core-main.webp`
- `hydro-serpent-main.webp`
- `lava-bot-main.webp`
- `ghost-core-main.webp`
- `solar-lion-main.webp`
- `bio-sprout-main.webp`
- `sonic-beast-main.webp`
- `electric-cat-main.webp`
- `majestic-dragon-main.webp`

## 7. 数据层扩展方案

在 `public/pet/species.js` 中为物种补充视觉字段：

- `artKey`
- `rarity`
- `element`
- `frameTone`

说明：

- `artKey` 指向本地资源 manifest
- `rarity` 只做视觉徽章，不影响成长逻辑
- `element` 和 `frameTone` 用于展示舱配色

单独维护 `public/pet/art-manifest.js`：

- 统一管理 `artKey -> src`
- 管理 family fallback
- 管理 rarity 视觉风格

## 8. 组件改造方案

### 8.1 宠物卡

保留当前紧凑信息布局，但将形象区升级为“宠物展示舱”：

- 顶部：学生姓名、阶段徽章
- 中部：展示舱、本地图、稀有度小徽章、emoji 角标
- 下部：昵称、物种、等级、经验、心情、余额
- 底部：快乐/健康/精力微型状态条

### 8.2 浮窗

浮窗头部改成深色赛博面板：

- 左侧大图展示舱
- 右侧状态信息和余额
- 未孵化时显示龙蛋 + 孵化按钮
- 已孵化时显示大图 + 改名区 + 商城区 + 最近照顾记录

### 8.3 商城

保留现有逻辑，提升视觉：

- 商品卡深色化
- 显示稀有度色条
- 增加道具图标/徽章位
- 购买按钮统一为高亮 CTA

## 9. 本地化执行步骤

1. 从 `public/pet/宠物素材.txt` 提取可用外链图片
2. 按宠物主图、背景图、非宠物图分类筛选
3. 下载到 `public/pet/assets/` 本地目录
4. 转为统一格式并压缩
5. 建立 `art-manifest.js`
6. 扩展 `species.js`
7. 改造 `module.js` 接入本地图
8. 保留 fallback，防止缺图导致空白
9. 运行脚本检查和测试

## 10. 实施边界

这轮实施只做以下内容：

- 记录方案
- 本地化一组核心宠物图
- 接入物种视觉字段和 manifest
- 改造宠物卡与浮窗使用本地图
- 保留无图 fallback

本轮不做：

- 引入素材中的完整侧边栏/顶部导航
- 重做全站 design system
- 依赖外链图片在线加载
- 上线复杂动效和大体积背景图
- 为 30 个物种制作 30 套独立插画
