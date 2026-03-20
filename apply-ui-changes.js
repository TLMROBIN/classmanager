/**
 * 学科配置UI和工资函数修改脚本
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'script.js');
let content = fs.readFileSync(filePath, 'utf8');

// ============================================
// 修改 1: 维护页面 - 在专员角色配置后添加学科配置和心理委员设置
// ============================================

// 找到专员角色配置的结束位置
const commissionerEndPattern = /h\("button",\s*\{\s*onClick:\s*\(\)\s*=>\s*updateSystemConfig\(sc\s*=>\s*\{[\s\S]*?list\.splice\(idx,\s*1\);[\s\S]*?return\s*\{\s*\.\.\.sc,\s*organization:\s*\{\s*\.\.\.sc\.organization,\s*commissionerRoles:\s*list\s*\}\s*\};\s*\}\),\s*className:\s*"px-3\s*py-2\s*bg-red-50\s*text-red-600\s*rounded\s*hover:bg-red-100\s*text-xs"\s*\},\s*"删除"\)[\s\S]*?\)\s*\)\s*\)\s*\)\s*\),\s*h\("div",\s*null,\s*h\("h4",\s*\{\s*className:\s*"font-bold\s*text-gray-800\s*mb-3\s*text-sm"\s*\},\s*"积分设置"\)/;

if (commissionerEndPattern.test(content)) {
    content = content.replace(commissionerEndPattern, 
        `h("button", { onClick: () => updateSystemConfig(sc => {
                                        const list = [...sc.organization.commissionerRoles];
                                        list.splice(idx, 1);
                                        return { ...sc, organization: { ...sc.organization, commissionerRoles: list } };
                                    }), className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs" }, "删除")
                                    ))
                                )
                            )
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "学科配置"),
                        h("p", { className: "text-xs text-gray-500 mb-2" }, "设置班级学科及课代表（每科1-2人），作业登记后课代表自动+1分"),
                        h("div", { className: "flex justify-between items-center mb-2" },
                            h("span", { className: "text-sm font-medium text-gray-700" }, "学科列表"),
                            h("button", { onClick: () => updateSystemConfig(sc => {
                                const list = [...(sc.organization.subjects || [])];
                                list.push({ id: 'subject_' + Date.now(), name: "新学科", representatives: [] });
                                return { ...sc, organization: { ...sc.organization, subjects: list } };
                            }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增学科")
                        ),
                        h("div", { className: "space-y-3" },
                            (systemConfig.organization.subjects || []).map((sub, idx) => h("div", { key: sub.id || idx, className: "bg-white p-3 rounded border" },
                                h("div", { className: "flex flex-wrap gap-2 items-center" },
                                    h("input", { className: "border rounded p-2 text-sm w-24", value: sub.name || "", onChange: e => updateSystemConfig(sc => {
                                        const list = [...sc.organization.subjects];
                                        list[idx] = { ...list[idx], name: e.target.value };
                                        return { ...sc, organization: { ...sc.organization, subjects: list } };
                                    }), placeholder: "学科名" }),
                                    h("span", { className: "text-xs text-gray-500" }, "课代表:"),
                                    h("select", { 
                                        className: "border rounded p-2 text-sm", 
                                        value: sub.representatives?.[0] || "", 
                                        onChange: e => updateSystemConfig(sc => {
                                            const list = [...sc.organization.subjects];
                                            const reps = [...(list[idx].representatives || [])];
                                            reps[0] = e.target.value ? Number(e.target.value) : null;
                                            list[idx] = { ...list[idx], representatives: reps.filter(Boolean) };
                                            return { ...sc, organization: { ...sc.organization, subjects: list } };
                                        })
                                    }, 
                                        h("option", { value: "" }, "-"),
                                        students.map(s => h("option", { key: s.id, value: s.id }, s.name))
                                    ),
                                    h("select", { 
                                        className: "border rounded p-2 text-sm", 
                                        value: sub.representatives?.[1] || "", 
                                        onChange: e => updateSystemConfig(sc => {
                                            const list = [...sc.organization.subjects];
                                            const reps = [...(list[idx].representatives || [])];
                                            reps[1] = e.target.value ? Number(e.target.value) : null;
                                            list[idx] = { ...list[idx], representatives: reps.filter(Boolean) };
                                            return { ...sc, organization: { ...sc.organization, subjects: list } };
                                        })
                                    }, 
                                        h("option", { value: "" }, "-"),
                                        students.filter(s => s.id !== sub.representatives?.[0]).map(s => h("option", { key: s.id, value: s.id }, s.name))
                                    ),
                                    h("button", { onClick: () => updateSystemConfig(sc => {
                                        const list = [...sc.organization.subjects];
                                        list.splice(idx, 1);
                                        return { ...sc, organization: { ...sc.organization, subjects: list } };
                                    }), className: "px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs" }, "删除")
                                )
                            ))
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "心理委员"),
                        h("p", { className: "text-xs text-gray-500 mb-2" }, "每次发放工资时心理委员额外+1分"),
                        h("select", { 
                            className: "border rounded p-2 text-sm w-full max-w-xs", 
                            value: systemConfig.organization.psychologicalCommissioner || "", 
                            onChange: e => updateSystemConfig(sc => ({
                                ...sc, 
                                organization: { 
                                    ...sc.organization, 
                                    psychologicalCommissioner: e.target.value ? Number(e.target.value) : null 
                                }
                            }))
                        }, 
                            h("option", { value: "" }, "未设置"),
                            students.map(s => h("option", { key: s.id, value: s.id }, s.name))
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "积分设置")`
    );
    console.log('✅ 维护页面UI修改完成');
} else {
    console.log('⚠️  未找到专员角色配置区域，跳过UI修改');
}

// ============================================
// 修改 2: handleWage 函数 - 添加心理委员津贴
// ============================================

const handleWagePattern = /const handleWage\s*=\s*\(\)\s*=>\s*\{[\s\S]*?setConfig\(\{\s*\.\.\.config,\s*lastWageDate:\s*today\s*\}\);\s*\};/;

if (handleWagePattern.test(content)) {
    content = content.replace(handleWagePattern, 
        `const handleWage = () => {
            const today = getTodayStr();
            if (config.lastWageDate === today) { if (!confirm("今日工资似乎已发放，确定要再次发放吗？")) return; }
            const targets = students.filter(s => ['discipline', 'hygiene'].includes(s.group));
            if (targets.length === 0) return alert("没有找到目标成员");
                
            const updates = targets.map(t => ({
                id: t.id,
                val: t.role === 'leader' ? 6 : 5,
                reason: "每日工资",
                type: 'bonus',
                scene: "班级",
                category: "班务"
            }));
            
            // 心理委员额外+1分
            const psychId = getSystemConfig(config).organization?.psychologicalCommissioner;
            if (psychId) {
                updates.push({
                    id: psychId,
                    val: 1,
                    reason: "心理委员津贴",
                    type: 'bonus',
                    scene: '班级',
                    category: '班务'
                });
            }
            
            batchUpdatePoints(updates);
            setConfig({ ...config, lastWageDate: today });
        };`
    );
    console.log('✅ handleWage 函数修改完成');
} else {
    console.log('⚠️  未找到 handleWage 函数，跳过修改');
}

// ============================================
// 修改 3: 仪表盘 - 添加心理委员显示
// ============================================

const dashboardCommissionerPattern = /h\("div",\s*\{\s*className:\s*"grid\s*grid-cols-2\s*gap-3"\s*\},[\s\S]*?commissionerRoles\(\)\.map\(role\s*=>[\s\S]*?\)\s*\)\s*\)\s*\)\s*\)/;

if (dashboardCommissionerPattern.test(content)) {
    content = content.replace(dashboardCommissionerPattern, 
        `h("div", { className: "grid grid-cols-2 gap-3" },
                            (() => {
                                const commissionerRoles = getCommissionerRoles(config);
                                return commissionerRoles;
                            })().map(role => h("div", { key: role.id },
                                h("div", { className: "text-xs text-gray-500 mb-1" }, role.name),
                                h("select", { value: config.commissioners[role.id] || "", onChange: e => handleCommissionerChange(role.id, e.target.value), className: "w-full border rounded p-1 text-sm" }, h("option", { value: "" }, "未设置"), students.filter(s => s.group === 'discipline').map(s => h("option", { key: s.id, value: s.id }, s.name)))
                            ))
                        ),
                        h("div", { className: "mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200" },
                            h("div", { className: "text-xs text-purple-600 mb-1 font-medium" }, "心理委员"),
                            h("select", { 
                                value: getSystemConfig(config).organization?.psychologicalCommissioner || "", 
                                onChange: e => updateSystemConfig(sc => ({
                                    ...sc,
                                    organization: {
                                        ...sc.organization,
                                        psychologicalCommissioner: e.target.value ? Number(e.target.value) : null
                                    }
                                })),
                                className: "w-full border rounded p-1 text-sm bg-white"
                            }, 
                                h("option", { value: "" }, "未设置"),
                                students.map(s => h("option", { key: s.id, value: s.id }, s.name))
                            ),
                            h("p", { className: "text-xs text-purple-500 mt-1" }, "每次发工资额外+1分")
                        )
                    )`
    );
    console.log('✅ 仪表盘UI修改完成');
} else {
    console.log('⚠️  未找到专员角色显示区域，跳过修改');
}

fs.writeFileSync(filePath, content);
console.log('\n✅ 所有修改完成');