(function() {
    const DAY_LABELS = {
        monday: "周一",
        tuesday: "周二",
        wednesday: "周三",
        thursday: "周四",
        friday: "周五",
        saturday: "周六",
        sunday: "周日"
    };

    const WEEK_DAYS = Object.keys(DAY_LABELS);

    window.createAttendanceSettingsSection = function createAttendanceSettingsSection(deps) {
        const {
            h,
            useState,
            Icon,
            requireAdminAuth
        } = deps || {};

        if (!h || !useState || !Icon || !requireAdminAuth) {
            throw new Error('AttendanceSettingsSection dependencies are missing');
        }

        return function AttendanceSettingsSection({
            systemConfig,
            updateSystemConfig,
            adminPassword
        }) {
            const [isOpen, setIsOpen] = useState(false);

            const attendanceConfig = systemConfig && systemConfig.attendance ? systemConfig.attendance : {};
            const schedule = Array.isArray(attendanceConfig.schedule) ? attendanceConfig.schedule : [];
            const weekendRules = attendanceConfig.weekendRules || {};
            const sundaySpecialLateTime = attendanceConfig.sundaySpecialLateTime || {};
            const penaltyRules = attendanceConfig.penaltyRules || {};

            const ensureOpenWithAuth = () => {
                if (isOpen) {
                    setIsOpen(prev => !prev);
                    return;
                }
                if (!requireAdminAuth("请输入管理员密码以打开考勤设置：", adminPassword)) return;
                setIsOpen(true);
            };

            const updateAttendance = (updater) => {
                if (typeof updateSystemConfig !== 'function') return;
                updateSystemConfig(sc => {
                    const currentAttendance = sc && sc.attendance ? sc.attendance : {};
                    return {
                        ...sc,
                        attendance: updater(currentAttendance)
                    };
                });
            };

            const updateScheduleItem = (idx, patch) => {
                updateAttendance(currentAttendance => {
                    const nextSchedule = Array.isArray(currentAttendance.schedule) ? [...currentAttendance.schedule] : [];
                    nextSchedule[idx] = { ...(nextSchedule[idx] || {}), ...patch };
                    return { ...currentAttendance, schedule: nextSchedule };
                });
            };

            return h("div", { className: "bg-white rounded-xl shadow-sm border p-4 space-y-4" },
                h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                    h("div", { className: "space-y-1" },
                        h("div", { className: "flex items-center gap-2 text-gray-800" },
                            h(Icon, { name: "clock", size: 18 }),
                            h("h4", { className: "font-bold text-sm" }, "考勤设置")
                        ),
                        h("p", { className: "text-xs text-gray-500" }, "考勤时段、周末规则、周日特殊迟到时间和奖惩规则统一在这里维护。")
                    ),
                    h("div", { className: "flex gap-2" },
                        h("button", {
                            onClick: ensureOpenWithAuth,
                            className: `px-3 py-2 rounded-lg text-sm font-medium ${isOpen ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                        }, isOpen ? "收起考勤设置" : "打开考勤设置")
                    )
                ),
                isOpen && h("div", { className: "space-y-6 border-t pt-4" },
                    h("div", null,
                        h("div", { className: "flex justify-between items-center mb-2" },
                            h("span", { className: "text-sm font-medium text-gray-700" }, "时段配置"),
                            h("button", {
                                onClick: () => updateAttendance(currentAttendance => {
                                    const nextSchedule = Array.isArray(currentAttendance.schedule) ? [...currentAttendance.schedule] : [];
                                    nextSchedule.push({
                                        id: `period_${Date.now()}`,
                                        name: "新时段",
                                        start: "00:00",
                                        end: "00:00",
                                        lateTime: "00:00"
                                    });
                                    return { ...currentAttendance, schedule: nextSchedule };
                                }),
                                className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
                            }, "新增时段")
                        ),
                        h("div", { className: "space-y-3" },
                            schedule.map((period, idx) => h("div", {
                                key: period.id || idx,
                                className: "grid grid-cols-1 md:grid-cols-6 gap-2 bg-white p-3 rounded border"
                            },
                                h("input", {
                                    className: "border rounded p-2 text-sm md:col-span-1",
                                    value: period.id || "",
                                    onChange: e => updateScheduleItem(idx, { id: e.target.value }),
                                    placeholder: "id"
                                }),
                                h("input", {
                                    className: "border rounded p-2 text-sm md:col-span-1",
                                    value: period.name || "",
                                    onChange: e => updateScheduleItem(idx, { name: e.target.value }),
                                    placeholder: "名称"
                                }),
                                h("input", {
                                    type: "time",
                                    className: "border rounded p-2 text-sm",
                                    value: period.start || "",
                                    onChange: e => updateScheduleItem(idx, { start: e.target.value })
                                }),
                                h("input", {
                                    type: "time",
                                    className: "border rounded p-2 text-sm",
                                    value: period.end || "",
                                    onChange: e => updateScheduleItem(idx, { end: e.target.value })
                                }),
                                h("input", {
                                    type: "time",
                                    className: "border rounded p-2 text-sm",
                                    value: period.lateTime || "",
                                    onChange: e => updateScheduleItem(idx, { lateTime: e.target.value })
                                }),
                                h("button", {
                                    onClick: () => updateAttendance(currentAttendance => {
                                        const nextSchedule = Array.isArray(currentAttendance.schedule) ? [...currentAttendance.schedule] : [];
                                        nextSchedule.splice(idx, 1);
                                        return { ...currentAttendance, schedule: nextSchedule };
                                    }),
                                    className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs"
                                }, "删除")
                            ))
                        )
                    ),
                    h("div", null,
                        h("div", { className: "text-sm font-medium text-gray-700 mb-2" }, "周末规则"),
                        h("div", { className: "space-y-3" },
                            WEEK_DAYS.map(day => h("div", { key: day, className: "bg-white p-3 rounded border" },
                                h("div", { className: "text-xs text-gray-500 mb-2" }, DAY_LABELS[day]),
                                h("div", { className: "flex flex-wrap gap-3" },
                                    schedule.map((period, idx) => {
                                        const rules = Array.isArray(weekendRules[day]) ? weekendRules[day] : [];
                                        const checked = rules.includes(idx);
                                        return h("label", {
                                            key: period.id || idx,
                                            className: "flex items-center gap-1 text-xs"
                                        },
                                            h("input", {
                                                type: "checkbox",
                                                checked,
                                                onChange: e => updateAttendance(currentAttendance => {
                                                    const nextWeekendRules = { ...(currentAttendance.weekendRules || {}) };
                                                    const nextDayRules = Array.isArray(nextWeekendRules[day]) ? [...nextWeekendRules[day]] : [];
                                                    const exists = nextDayRules.includes(idx);
                                                    if (e.target.checked && !exists) nextDayRules.push(idx);
                                                    if (!e.target.checked && exists) nextDayRules.splice(nextDayRules.indexOf(idx), 1);
                                                    nextWeekendRules[day] = nextDayRules.sort((a, b) => a - b);
                                                    return { ...currentAttendance, weekendRules: nextWeekendRules };
                                                })
                                            }),
                                            h("span", null, period.name || period.id || idx)
                                        );
                                    })
                                )
                            ))
                        )
                    ),
                    h("div", null,
                        h("div", { className: "text-sm font-medium text-gray-700 mb-2" }, "周日特殊迟到时间"),
                        h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
                            schedule.map((period, idx) => h("div", {
                                key: period.id || idx,
                                className: "flex items-center gap-2 bg-white p-3 rounded border"
                            },
                                h("span", { className: "text-xs text-gray-500 w-24" }, period.name || period.id || idx),
                                h("input", {
                                    type: "time",
                                    className: "border rounded p-2 text-sm flex-1",
                                    value: sundaySpecialLateTime[period.id] || "",
                                    onChange: e => updateAttendance(currentAttendance => {
                                        const nextSpecialTime = { ...(currentAttendance.sundaySpecialLateTime || {}) };
                                        if (e.target.value) nextSpecialTime[period.id] = e.target.value;
                                        else delete nextSpecialTime[period.id];
                                        return { ...currentAttendance, sundaySpecialLateTime: nextSpecialTime };
                                    })
                                }),
                                h("button", {
                                    onClick: () => updateAttendance(currentAttendance => {
                                        const nextSpecialTime = { ...(currentAttendance.sundaySpecialLateTime || {}) };
                                        delete nextSpecialTime[period.id];
                                        return { ...currentAttendance, sundaySpecialLateTime: nextSpecialTime };
                                    }),
                                    className: "px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs"
                                }, "清除")
                            ))
                        )
                    ),
                    h("div", null,
                        h("div", { className: "text-sm font-medium text-gray-700 mb-2" }, "扣分规则"),
                        h("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3" },
                            h("div", null,
                                h("label", { className: "block text-xs text-gray-500 mb-1" }, "迟到扣分"),
                                h("input", {
                                    type: "number",
                                    className: "w-full border rounded p-2 text-sm",
                                    value: penaltyRules.late ?? 0,
                                    onChange: e => updateAttendance(currentAttendance => ({
                                        ...currentAttendance,
                                        penaltyRules: {
                                            ...(currentAttendance.penaltyRules || {}),
                                            late: Number(e.target.value)
                                        }
                                    }))
                                })
                            ),
                            h("div", null,
                                h("label", { className: "block text-xs text-gray-500 mb-1" }, "缺勤扣分"),
                                h("input", {
                                    type: "number",
                                    className: "w-full border rounded p-2 text-sm",
                                    value: penaltyRules.absent ?? 0,
                                    onChange: e => updateAttendance(currentAttendance => ({
                                        ...currentAttendance,
                                        penaltyRules: {
                                            ...(currentAttendance.penaltyRules || {}),
                                            absent: Number(e.target.value)
                                        }
                                    }))
                                })
                            ),
                            h("div", null,
                                h("label", { className: "block text-xs text-gray-500 mb-1" }, "全勤奖"),
                                h("input", {
                                    type: "number",
                                    className: "w-full border rounded p-2 text-sm",
                                    value: penaltyRules.perfectAttendance ?? 0,
                                    onChange: e => updateAttendance(currentAttendance => ({
                                        ...currentAttendance,
                                        penaltyRules: {
                                            ...(currentAttendance.penaltyRules || {}),
                                            perfectAttendance: Number(e.target.value)
                                        }
                                    }))
                                })
                            )
                        )
                    )
                )
            );
        };
    };
})();
