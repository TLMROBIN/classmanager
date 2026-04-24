# 学生周报批量生成功能 - 实施计划

> 创建时间：2025-04-17
> 状态：已审核，待实现

---

## 一、需求确认

| 需求项 | 确认结果 |
|---|---|
| 输出形式 | Markdown 文件（`.md`），一个大文件包含所有学生 |
| 文件名格式 | `{起始日期}~{结束日期}学生报告.md`，例如 `2025-04-07~2025-04-13学生报告.md` |
| 积分显示 | 按分类展示，且显示**理由**（`reason`） |
| 积分分类 | 跑操、作业、宿舍、班务、考勤、其他奖励、其他扣分、消费/兑奖 |
| 任务模块 | 本周任务**无数据时整板块不显示** |
| 综合板块 | **暂时不需要** |
| 入口位置 | 维护页工具区（`settings/tools-section.js`），与"简报"工具卡并排 |

---

## 二、周报内容结构

每个学生一个区块，Markdown 结构如下：

```markdown
## 张三

### 本周考勤
- 准点：5次
- 迟到：0次
- 缺勤：0次
- 连续全勤：12天

### 本周积分明细

#### 跑操
- 2025-04-07 跑操出勤 `+1`
- 2025-04-08 跑操出勤 `+1`

#### 作业
- 数学作业登记 2025-04-07 `+1`

#### 宿舍
- 宿舍加分 `+10`

#### 班务
- 每日工资 `+5`

（其他分类同理，无数据的分类不显示）

### 本周任务
- 完成任务"背诵单词" `+5`
- 完成任务"数学竞赛" `+10`

**共领取 2 个任务，获得 15 积分**

### 本周积分净值
**+22**

---

## 三、积分分类规则

**优先级：`category`（结构化字段）优先，关键词匹配次之。**

| 周报分类 | 匹配规则 |
|---|---|
| **作业** | `category === "学业"`，且 `reason` 包含"作业" |
| **跑操** | `reason` 包含"跑操" |
| **宿舍** | `scene === "宿舍"` 或 `reason` 包含"宿舍" |
| **班务** | `category === "班务"` |
| **考勤** | `category === "出勤"`，且 `reason` 不含"跑操" |
| **消费/兑奖** | `type === "spending"` 或 `category === "兑奖"` |
| **其他奖励** | `val > 0`，且不匹配以上分类 |
| **其他扣分** | `val < 0`，且不匹配以上分类 |

分类关键词常量单独管理，后续修改只需改一处。

---

## 四、数据来源与 API

| 数据 | 来源 | 注意事项 |
|---|---|---|
| 学生列表 | `store.students` | 遍历生成周报 |
| 积分历史 | `store.history` | 按 `ts` + `studentId` 过滤，含 `reason`/`val`/`category`/`scene` |
| 考勤记录 | **`GET /api/attendance`** | `store.attendanceRecords` 可能未加载，**生成前必须主动调接口** |
| 任务 | `store.tasks` | 按 `claimedBy` + 时间范围过滤，**无数据时隐藏整板块** |

---

## 五、新增与修改文件

### 新增文件

| 文件 | 职责 |
|---|---|
| `public/weekly-report/builder.js` | 数据聚合引擎：`buildWeeklyReport(student, range, historyByStudent, attendanceData, tasks)` |
| `public/weekly-report/markdown.js` | Markdown 生成器：周报对象数组 → `.md` 字符串 |
| `public/weekly-report/utils.js` | 时间范围工具、格式化函数、下载函数 |

### 修改文件

| 文件 | 修改内容 |
|---|---|
| `public/index.bootstrap.js` | `APP_SCRIPTS` 追加三个新文件路径 |
| `public/settings/tools-section.js` | 新增"学生周报"工具卡 |
| `public/settings/module.js` | 新增周报 state 和 `handleGenerateWeeklyReport` 回调 |

---

## 六、关键实现细节

### 6.1 历史记录预建索引（性能优化）

```javascript
// 一次遍历建立 studentId → history[] 的 Map
const historyByStudent = new Map();
(allHistory || []).forEach(h => {
    if (!historyByStudent.has(h.studentId)) historyByStudent.set(h.studentId, []);
    historyByStudent.get(h.studentId).push(h);
});
```

将 O(n×m) 复杂度降为 O(n+m)。

### 6.2 考勤数据加载检查

```javascript
// 生成周报前确保 attendanceRecords 已加载
async function ensureAttendanceLoaded() {
    if (!store.attendanceRecords || Object.keys(store.attendanceRecords).length === 0) {
        await fetchAttendance(); // GET /api/attendance
    }
}
```

### 6.3 分类关键词常量

```javascript
// utils.js
const CLASSIFY_RULES = {
    run: { keywords: ['跑操'], priority: 1 },
    homework: { category: '学业', keywords: ['作业'], priority: 2 },
    dorm: { scene: '宿舍', keywords: ['宿舍'], priority: 3 },
    classDuty: { category: '班务', priority: 4 },
    attendance: { category: '出勤', excludeKeywords: ['跑操'], priority: 5 },
    spending: { type: 'spending', priority: 6 },
    bonus: { valPositive: true, priority: 7 },
    penalty: { valNegative: true, priority: 8 },
};
```

### 6.4 下载触发

```javascript
function downloadMarkdown(filename, content) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
```

### 6.5 进度反馈（按钮加载态）

```javascript
const [generating, setGenerating] = useState(false);

h("button", {
    onClick: async () => {
        setGenerating(true);
        try {
            await handleGenerateWeeklyReport();
        } finally {
            setGenerating(false);
        }
    },
    disabled: generating,
    className: generating ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
}, generating ? "生成中..." : "生成学生周报")
```

---

## 七、实施步骤

| 步骤 | 任务 | 优先级 |
|---|---|---|
| 1 | `utils.js`：时间范围工具、`CLASSIFY_RULES`、下载函数 | 高 |
| 2 | `builder.js`：预建 Map 索引 + `buildWeeklyReport` | 高 |
| 3 | `markdown.js`：Markdown 拼接（各板块条件渲染） | 高 |
| 4 | `settings/module.js`：state + `handleGenerateWeeklyReport`（含考勤加载检查） | 高 |
| 5 | `settings/tools-section.js`：工具卡 UI（含加载态/进度） | 高 |
| 6 | `index.bootstrap.js`：注册三个脚本 | 高 |
| 7 | 联调验证 | 高 |

---

## 八、风险清单与改进措施

| 风险 | 等级 | 改进措施 |
|---|---|---|
| `attendanceRecords` 未加载导致考勤数据缺失 | **高** | 生成前主动调 `GET /api/attendance` |
| 关键词硬编码导致后续维护困难 | **高** | `CLASSIFY_RULES` 常量对象统一管理 |
| 主线程遍历阻塞 UI | **中** | 预建 Map 索引 + 按钮加载态 |
| 测试模式下生成的是沙盒数据周报 | **中** | 按钮旁显示"测试模式"警告提示 |
| Markdown 对非技术用户不友好 | **低** | 可选改为 `.txt` 扩展名 |
| 教师期望近7天而非完整上周 | **低** | 参考简报工具卡加"近7天"快捷按钮 |

---

## 九、已明确的禁区（不可触碰）

- 不调用 `POST /api/data`
- 不调用 `stripDerivedAttendanceRecords()`
- 不调用 `hasMaintenanceProtectedMutation()`
- 不调用 `getProtectedTreasureDomain()`
- 周报功能**只读**，不修改任何数据域
