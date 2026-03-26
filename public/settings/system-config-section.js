(function() {
    window.createSettingsSystemConfigSection = function createSettingsSystemConfigSection(deps) {
        const { h, Icon } = deps || {};

        if (!h || !Icon) {
            throw new Error('Settings system config section dependencies are missing');
        }

        return function renderSettingsSystemConfigSection(props) {
            const {
                config,
                systemConfig,
                students,
                DEFAULT_SYSTEM_CONFIG,
                handleResetSystemConfig,
                updateSystemConfig,
                showOrganizationManager,
                onToggleOrganizationManager,
                showCustomRolesManager,
                onToggleCustomRolesManager,
                normalizeCommissionerRoles,
                normalizeCustomRoles,
                getCommissionerRoles,
                getCustomRoles,
                handleDutyChange,
                StudentRosterSection,
                studentRosterProps,
                onChangeMaintenancePassword,
                onSaveConfig
            } = props || {};

            return h("div", { className: "border-t pt-6", style: { order: -1 } },
                h("h3", { className: "font-bold text-gray-700 mb-4 flex items-center gap-2" }, h(Icon, { name: "settings" }), "⚙️ 系统配置"),
                h("div", { className: "bg-gray-50 border rounded-lg p-6 space-y-8" },
                    h("div", { className: "flex flex-wrap gap-2" },
                        h("button", { onClick: handleResetSystemConfig, className: "px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded hover:bg-red-100 text-sm" }, "恢复默认配置")
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "基础设置"),
                        h("div", { className: "space-y-4" },
                            h("div", null,
                                h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "班级名称"),
                                h("input", {
                                    type: "text",
                                    className: "w-full border rounded-lg p-2 text-sm",
                                    value: systemConfig.className || "",
                                    onChange: (e) => updateSystemConfig(sc => ({ ...sc, className: e.target.value })),
                                    placeholder: "请输入班级名称"
                                })
                            ),
                            h("div", null,
                                h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "维护密码"),
                                h("div", { className: "flex gap-2" },
                                    h("button", {
                                        onClick: onChangeMaintenancePassword,
                                        className: "px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm"
                                    }, "🔐 修改维护密码")
                                ),
                                h("p", { className: "text-xs text-gray-500 mt-2" }, "维护密码由服务器保存为哈希值，不再以内置默认密码或明文配置的方式存储。")
                            ),
                            h("div", null,
                                h("label", { className: "block text-sm font-medium text-gray-700 mb-2" }, "功能开关"),
                                h("div", { className: "space-y-2 bg-gray-50 p-3 rounded-lg" },
                                    h("label", { className: "flex items-center gap-3 cursor-pointer" },
                                        h("input", {
                                            type: "checkbox",
                                            checked: systemConfig.enabledFeatures?.battle ?? true,
                                            onChange: (e) => updateSystemConfig(sc => ({
                                                ...sc,
                                                enabledFeatures: {
                                                    ...(sc.enabledFeatures || {}),
                                                    battle: e.target.checked
                                                }
                                            })),
                                            className: "w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        }),
                                        h("span", { className: "text-sm text-gray-700" }, "启用双子星对战系统"),
                                        h("span", { className: "text-xs text-gray-500" }, "（关闭后导航栏将隐藏此功能）")
                                    )
                                )
                            )
                        )
                    ),
                    h("div", null,
                        h("h4", { className: "font-bold text-gray-800 mb-3 text-sm" }, "组织与角色"),
                        h("div", { className: "space-y-4" },
                            h("div", { className: "bg-white border rounded-lg p-4 space-y-4" },
                                h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                                    h("div", null,
                                        h("div", { className: "text-sm font-medium text-gray-700" }, "组织架构"),
                                        h("p", { className: "text-xs text-gray-500 mt-1" }, "小组管理、宿舍管理和工资设置统一收在这里。")
                                    ),
                                    h("button", {
                                        onClick: onToggleOrganizationManager,
                                        className: "px-4 py-2 bg-white border rounded hover:bg-gray-100 text-sm font-medium"
                                    }, showOrganizationManager ? "收起组织架构" : "打开组织架构")
                                ),
                                showOrganizationManager && h("div", { className: "border-t pt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start max-w-5xl" },
                                    h("div", { className: "w-full max-w-xs sm:max-w-sm bg-white border rounded-lg p-4 space-y-3" },
                                        h("div", { className: "flex justify-between items-center" },
                                            h("span", { className: "text-sm font-medium text-gray-700" }, "小组管理"),
                                            h("button", { onClick: () => updateSystemConfig(sc => {
                                                const list = [...(sc.organization.groups || [])];
                                                list.push({ id: `group_${Date.now()}`, name: "新小组", color: "bg-gray-100 text-gray-700 border-gray-200" });
                                                return { ...sc, organization: { ...sc.organization, groups: list } };
                                            }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增小组")
                                        ),
                                        (systemConfig.organization.groups || []).length === 0
                                            ? h("div", { className: "text-sm text-gray-400 py-2" }, "暂无小组")
                                            : h("div", { className: "space-y-2" },
                                                (systemConfig.organization.groups || []).map((group, idx) => h("div", { key: group.id || idx, className: "flex items-center gap-2 bg-gray-50 p-2 rounded border" },
                                                    h("input", { className: "w-32 sm:w-36 max-w-full border rounded p-2 text-sm bg-white", value: group.name || "", onChange: e => updateSystemConfig(sc => {
                                                        const list = [...sc.organization.groups];
                                                        list[idx] = { ...list[idx], name: e.target.value };
                                                        return { ...sc, organization: { ...sc.organization, groups: list } };
                                                    }), placeholder: "小组名称" }),
                                                    h("button", { onClick: () => updateSystemConfig(sc => {
                                                        const list = [...sc.organization.groups];
                                                        list.splice(idx, 1);
                                                        return { ...sc, organization: { ...sc.organization, groups: list } };
                                                    }), className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs shrink-0" }, "删除")
                                                ))
                                            )
                                    ),
                                    h("div", { className: "w-full max-w-xs sm:max-w-sm bg-white border rounded-lg p-4 space-y-3" },
                                        h("div", { className: "flex justify-between items-center" },
                                            h("span", { className: "text-sm font-medium text-gray-700" }, "宿舍管理"),
                                            h("button", { onClick: () => updateSystemConfig(sc => {
                                                const list = [...(sc.organization.dorms || [])];
                                                list.push({ id: `dorm_${Date.now()}`, name: "新宿舍" });
                                                return { ...sc, organization: { ...sc.organization, dorms: list } };
                                            }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增宿舍")
                                        ),
                                        (systemConfig.organization.dorms || []).length === 0
                                            ? h("div", { className: "text-sm text-gray-400 py-2" }, "暂无宿舍")
                                            : h("div", { className: "space-y-2" },
                                                (systemConfig.organization.dorms || []).map((dorm, idx) => h("div", { key: dorm.id || idx, className: "flex items-center gap-2 bg-gray-50 p-2 rounded border" },
                                                    h("input", { className: "w-32 sm:w-36 max-w-full border rounded p-2 text-sm bg-white", value: dorm.name || "", onChange: e => updateSystemConfig(sc => {
                                                        const list = [...sc.organization.dorms];
                                                        list[idx] = { ...list[idx], name: e.target.value };
                                                        return { ...sc, organization: { ...sc.organization, dorms: list } };
                                                    }), placeholder: "宿舍名称" }),
                                                    h("button", { onClick: () => updateSystemConfig(sc => {
                                                        const list = [...sc.organization.dorms];
                                                        list.splice(idx, 1);
                                                        return { ...sc, organization: { ...sc.organization, dorms: list } };
                                                    }), className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs shrink-0" }, "删除")
                                                ))
                                            )
                                    ),
                                    h("div", { className: "w-full max-w-xs sm:max-w-sm bg-white border rounded-lg p-4 space-y-4" },
                                        h("div", { className: "text-sm font-medium text-gray-700" }, "工资设置"),
                                        h("div", { className: "space-y-4" },
                                            h("div", null,
                                                h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "每日工资基础分"),
                                                h("input", {
                                                    type: "number",
                                                    className: "w-full border rounded-lg p-2 text-sm",
                                                    value: systemConfig.points.dailyWageAmount ?? 5,
                                                    onChange: e => updateSystemConfig(sc => ({
                                                        ...sc,
                                                        points: {
                                                            ...sc.points,
                                                            dailyWageAmount: Number(e.target.value)
                                                        }
                                                    }))
                                                }),
                                                h("p", { className: "text-xs text-gray-500 mt-1" }, "普通成员按此分值发放，组长固定额外 +1 分。")
                                            ),
                                            h("div", null,
                                                h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "发放工资的小组"),
                                                h("div", { className: "space-y-2 border rounded-lg p-3 bg-gray-50" },
                                                    (systemConfig.organization.groups || []).map(group => {
                                                        const selectedGroups = Array.isArray(systemConfig.points.dailyWageGroups) ? systemConfig.points.dailyWageGroups : [];
                                                        const checked = selectedGroups.includes(group.id);
                                                        return h("label", { key: group.id, className: "flex items-center gap-2 text-sm text-gray-700" },
                                                            h("input", {
                                                                type: "checkbox",
                                                                checked,
                                                                onChange: e => updateSystemConfig(sc => {
                                                                    const current = Array.isArray(sc.points.dailyWageGroups) ? sc.points.dailyWageGroups : [];
                                                                    const next = e.target.checked
                                                                        ? [...new Set([...current, group.id])]
                                                                        : current.filter(id => id !== group.id);
                                                                    return {
                                                                        ...sc,
                                                                        points: {
                                                                            ...sc.points,
                                                                            dailyWageGroups: next
                                                                        }
                                                                    };
                                                                })
                                                            }),
                                                            h("span", null, group.name || group.id)
                                                        );
                                                    })
                                                ),
                                                h("p", { className: "text-xs text-gray-500 mt-1" }, "“一键工资”只会给这里勾选的小组成员发放工资。")
                                            )
                                        )
                                    ),
                                )
                            ),
                            StudentRosterSection && h(StudentRosterSection, studentRosterProps || {}),
                            h("div", { className: "bg-white border rounded-lg p-4 space-y-4" },
                                h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                                    h("div", null,
                                        h("div", { className: "text-sm font-medium text-gray-700" }, "自定义角色"),
                                        h("p", { className: "text-xs text-gray-500 mt-1" }, "专员角色、卫生督查和班级自定义角色统一收在这里。")
                                    ),
                                    h("button", {
                                        onClick: onToggleCustomRolesManager,
                                        className: "px-4 py-2 bg-white border rounded hover:bg-gray-100 text-sm font-medium"
                                    }, showCustomRolesManager ? "收起自定义角色" : "打开自定义角色")
                                ),
                                showCustomRolesManager && h("div", { className: "border-t pt-4 space-y-4" },
                                    h("div", { className: "grid grid-cols-1 xl:grid-cols-2 gap-4 items-start max-w-4xl" },
                                        h("div", { className: "w-full max-w-sm" },
                                            h("div", { className: "bg-white border rounded-lg p-4 space-y-3" },
                                                h("div", { className: "flex justify-between items-center" },
                                                    h("span", { className: "text-sm font-medium text-gray-700" }, "专员角色"),
                                                    h("button", { onClick: () => updateSystemConfig(sc => {
                                                        const list = normalizeCommissionerRoles(sc.organization.commissionerRoles || [], config.commissioners);
                                                        list.push({ id: `role_${Date.now()}`, name: "新角色", studentId: null });
                                                        return { ...sc, organization: { ...sc.organization, commissionerRoles: list } };
                                                    }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增角色")
                                                ),
                                                h("p", { className: "text-xs text-gray-500" }, "一般用于纪律组内分工，不另外发工资，只用于首页公示提醒，不设置则不显示"),
                                                (systemConfig.organization.commissionerRoles || []).length === 0
                                                    ? h("div", { className: "text-sm text-gray-400 py-2" }, "暂无专员角色")
                                                    : h("div", { className: "space-y-2" },
                                                        getCommissionerRoles(config).map((role, idx) => h("div", { key: role.id || idx, className: "bg-gray-50 p-2 rounded border" },
                                                            h("div", { className: "flex flex-wrap sm:flex-nowrap items-center gap-2" },
                                                                h("input", { className: "w-24 sm:w-28 border rounded p-2 text-sm bg-white shrink-0", value: role.name || "", onChange: e => updateSystemConfig(sc => {
                                                                    const list = normalizeCommissionerRoles(sc.organization.commissionerRoles || [], config.commissioners);
                                                                    list[idx] = { ...list[idx], name: e.target.value };
                                                                    return { ...sc, organization: { ...sc.organization, commissionerRoles: list } };
                                                                }), placeholder: "角色名称" }),
                                                                h("select", { className: "w-16 sm:w-20 border rounded p-2 text-sm bg-white shrink-0", value: role.studentId || "", onChange: e => updateSystemConfig(sc => {
                                                                    const list = normalizeCommissionerRoles(sc.organization.commissionerRoles || [], config.commissioners);
                                                                    list[idx] = { ...list[idx], studentId: e.target.value ? Number(e.target.value) : null };
                                                                    return { ...sc, organization: { ...sc.organization, commissionerRoles: list } };
                                                                }) },
                                                                    h("option", { value: "" }, "未设置"),
                                                                    Array.from(new Map(
                                                                        (students || [])
                                                                            .filter(student => student.group === 'discipline' || student.id === role.studentId)
                                                                            .map(student => [student.id, student])
                                                                    ).values()).map(student => h("option", { key: student.id, value: student.id }, student.name))
                                                                ),
                                                                h("button", { onClick: () => updateSystemConfig(sc => {
                                                                    const list = normalizeCommissionerRoles(sc.organization.commissionerRoles || [], config.commissioners);
                                                                    list.splice(idx, 1);
                                                                    return { ...sc, organization: { ...sc.organization, commissionerRoles: list } };
                                                                }), className: "px-2 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs shrink-0" }, "删除")
                                                            )
                                                        ))
                                                    )
                                            )
                                        ),
                                        h("div", { className: "w-full max-w-xl bg-white border rounded-lg p-4 space-y-3" },
                                            h("div", { className: "flex justify-between items-center" },
                                                h("span", { className: "text-sm font-medium text-gray-700" }, "班级自定义角色"),
                                                h("button", { onClick: () => updateSystemConfig(sc => {
                                                    const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                    list.push({ id: `custom_role_${Date.now()}`, name: "新职务", dailyWage: 2, studentId: null });
                                                    return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                                }), className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs" }, "新增职务")
                                            ),
                                            h("p", { className: "text-xs text-gray-500" }, "只维护职务名称、每日工资和任职学生，内部编号继续保留但不在这里编辑。"),
                                            getCustomRoles(config).length === 0
                                                ? h("div", { className: "text-sm text-gray-400 py-2" }, "暂无班级自定义角色")
                                                : h("div", { className: "space-y-2" },
                                                    getCustomRoles(config).map((role, idx) => h("div", { key: role.id || idx, className: "bg-gray-50 p-2 rounded border" },
                                                        h("div", { className: "flex flex-wrap sm:flex-nowrap items-center gap-2" },
                                                            h("input", { className: "w-24 sm:w-28 shrink-0 border rounded p-2 text-sm bg-white", value: role.name || "", onChange: e => updateSystemConfig(sc => {
                                                                const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                                list[idx] = { ...list[idx], name: e.target.value };
                                                                return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                                            }), placeholder: "职务名称" }),
                                                            h("input", { type: "number", className: "w-14 sm:w-16 shrink-0 border rounded p-2 text-sm bg-white", value: role.dailyWage ?? 0, onChange: e => updateSystemConfig(sc => {
                                                                const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                                list[idx] = { ...list[idx], dailyWage: Number(e.target.value) };
                                                                return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                                            }), placeholder: "工资" }),
                                                            h("select", { className: "w-16 sm:w-20 shrink-0 border rounded p-2 text-sm bg-white", value: role.studentId || "", onChange: e => updateSystemConfig(sc => {
                                                                const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                                list[idx] = { ...list[idx], studentId: e.target.value ? Number(e.target.value) : null };
                                                                return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                                            }) },
                                                                h("option", { value: "" }, "未设置"),
                                                                (students || []).map(student => h("option", { key: student.id, value: student.id }, student.name))
                                                            ),
                                                            h("button", { onClick: () => updateSystemConfig(sc => {
                                                                const list = normalizeCustomRoles(sc.organization.customRoles || sc.organization.studentCouncilRoles || [], 2);
                                                                list.splice(idx, 1);
                                                                return { ...sc, organization: { ...sc.organization, customRoles: list } };
                                                            }), className: "px-2 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs shrink-0" }, "删除")
                                                        )
                                                    ))
                                                )
                                        )
                                    ),
                                    h("div", { className: "w-full bg-white border rounded-lg p-4 space-y-3" },
                                        h("div", null,
                                            h("div", { className: "text-sm font-medium text-gray-700" }, "卫生督查"),
                                            h("p", { className: "text-xs text-gray-500 mt-1" }, "一般用于卫生组内分工，不另外发工资，只用于首页公示提醒，不设置则不显示")
                                        ),
                                        h("div", { className: "grid grid-cols-5 gap-3 text-sm" },
                                            ['mon', 'tue', 'wed', 'thu', 'fri'].map(day => h("div", { key: `label_${day}`, className: "text-center text-sm font-medium text-gray-700" }, { mon: "周一", tue: "周二", wed: "周三", thu: "周四", fri: "周五" }[day])),
                                            ['mon', 'tue', 'wed', 'thu', 'fri'].map(day => h("div", { key: day, className: "bg-gray-50 border rounded-lg p-2 space-y-2" },
                                                (config.duty?.[day] || []).map((val, idx) => h("select", {
                                                    key: idx,
                                                    value: val,
                                                    onChange: e => handleDutyChange(day, idx, e.target.value),
                                                    className: "w-full border rounded p-2 text-sm bg-white"
                                                },
                                                    h("option", { value: "" }, "未设置"),
                                                    students.filter(student => student.group === 'hygiene').map(student => h("option", { key: student.id, value: student.name }, student.name))
                                                ))
                                            ))
                                        )
                                    )
                                )
                            )
                        )
                    ),
                    h("div", { className: "border-t pt-4" },
                        h("button", {
                            onClick: onSaveConfig,
                            className: "w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                        }, "💾 保存配置")
                    )
                )
            );
        };
    };
})();
