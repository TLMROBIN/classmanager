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
            requireAdminAuth,
            getTodayStr
        } = deps || {};

        if (!h || !useState || !Icon || !requireAdminAuth || !getTodayStr) {
            throw new Error('AttendanceSettingsSection dependencies are missing');
        }

        return function AttendanceSettingsSection({
            systemConfig,
            updateSystemConfig
        }) {
            const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
            const [isQuotesOpen, setIsQuotesOpen] = useState(false);

            const attendanceConfig = systemConfig && systemConfig.attendance ? systemConfig.attendance : {};
            const schedule = Array.isArray(attendanceConfig.schedule) ? attendanceConfig.schedule : [];
            const weekendRules = attendanceConfig.weekendRules || {};
            const sundaySpecialLateTime = attendanceConfig.sundaySpecialLateTime || {};
            const penaltyRules = attendanceConfig.penaltyRules || {};
            const quoteList = Array.isArray(systemConfig && systemConfig.quotes) ? systemConfig.quotes : [];

            const togglePanelWithAuth = async (panel) => {
                const isOpen = panel === 'attendance' ? isAttendanceOpen : isQuotesOpen;
                if (isOpen) {
                    if (panel === 'attendance') setIsAttendanceOpen(false);
                    else setIsQuotesOpen(false);
                    return;
                }
                const promptText = panel === 'attendance'
                    ? "请输入维护密码以打开考勤设置："
                    : "请输入维护密码以打开语录设置：";
                if (!await requireAdminAuth(promptText)) return;
                if (panel === 'attendance') setIsAttendanceOpen(true);
                else setIsQuotesOpen(true);
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

            const updateQuotes = (updater) => {
                if (typeof updateSystemConfig !== 'function') return;
                updateSystemConfig(sc => {
                    const currentQuotes = Array.isArray(sc && sc.quotes) ? sc.quotes : [];
                    return {
                        ...sc,
                        quotes: updater(currentQuotes)
                    };
                });
            };

            const handleExportQuotesExcel = () => {
                const quoteList = Array.isArray(systemConfig && systemConfig.quotes) ? systemConfig.quotes : [];
                const data = quoteList.map(q => ({ "内容": q }));
                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "励志语录");
                XLSX.writeFile(wb, `励志语录_${getTodayStr()}.xlsx`);
            };

            const handleImportQuotesExcel = (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const importGuards = window.ClassManagerImportGuards;
                if (!importGuards?.readWorkbookFromFile || !importGuards?.getFirstWorksheet || !importGuards?.assertWorksheetRows) {
                    alert("导入组件未加载，请刷新后重试");
                    e.target.value = '';
                    return;
                }
                void importGuards.readWorkbookFromFile({
                    file,
                    xlsx: XLSX,
                    label: "导入励志语录",
                    maxSheets: 2
                }).then((wb) => {
                    const json = XLSX.utils.sheet_to_json(importGuards.getFirstWorksheet(wb, "导入励志语录"));
                    importGuards.assertWorksheetRows(json, {
                        label: "导入励志语录",
                        maxRows: 2000,
                        emptyMessage: "未解析到有效语录"
                    });
                    const nextQuotes = json.map(row => row["内容"]).filter(Boolean);
                    if (nextQuotes.length === 0) {
                        alert("未解析到有效语录");
                        return;
                    }
                    if (!confirm(`解析到 ${nextQuotes.length} 条语录，确定覆盖现有语录吗？`)) return;
                    updateQuotes(() => nextQuotes);
                    alert("语录更新成功");
                }).catch((error) => {
                    alert(error?.message || "导入失败，请检查 Excel 文件");
                }).finally(() => {
                    e.target.value = '';
                });
            };

            return h("div", { className: "space-y-4" },
                h("div", { className: "bg-white rounded-xl shadow-sm border p-4 space-y-4" },
                    h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                        h("div", { className: "space-y-1" },
                            h("div", { className: "flex items-center gap-2 text-gray-800" },
                                h(Icon, { name: "clock", size: 18 }),
                                h("h4", { className: "font-bold text-sm" }, "考勤设置")
                            ),
                            h("p", { className: "text-xs text-gray-500" }, "这里只维护考勤时段、周末规则和奖惩规则。")
                        ),
                        h("button", {
                            onClick: () => togglePanelWithAuth('attendance'),
                            className: `px-3 py-2 rounded-lg text-sm font-medium ${isAttendanceOpen ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                        }, isAttendanceOpen ? "收起考勤设置" : "打开考勤设置")
                    ),
                    isAttendanceOpen && h("div", { className: "space-y-6 border-t pt-4" },
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
                ),
                h("div", { className: "bg-white rounded-xl shadow-sm border p-4 space-y-4" },
                    h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                        h("div", { className: "space-y-1" },
                            h("div", { className: "flex items-center gap-2 text-gray-800" },
                                h(Icon, { name: "flame", size: 18 }),
                                h("h4", { className: "font-bold text-sm" }, "语录设置")
                            ),
                            h("p", { className: "text-xs text-gray-500" }, "这里只维护考勤页顶部显示的每日励志语录。")
                        ),
                        h("button", {
                            onClick: () => togglePanelWithAuth('quotes'),
                            className: `px-3 py-2 rounded-lg text-sm font-medium ${isQuotesOpen ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                        }, isQuotesOpen ? "收起语录设置" : "打开语录设置")
                    ),
                    isQuotesOpen && h("div", { className: "space-y-4 border-t pt-4" },
                        h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                            h("div", { className: "text-xs text-gray-500" }, "支持手工维护和 Excel 导入导出。"),
                            h("div", { className: "flex gap-2" },
                                h("button", {
                                    onClick: handleExportQuotesExcel,
                                    className: "px-3 py-2 bg-white border border-yellow-200 text-yellow-700 rounded hover:bg-yellow-50 text-xs font-medium"
                                }, "导出 Excel"),
                                h("label", {
                                    className: "relative px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-xs font-medium cursor-pointer"
                                },
                                    "导入 Excel",
                                    h("input", {
                                        type: "file",
                                        className: "absolute inset-0 opacity-0 cursor-pointer",
                                        accept: ".xlsx",
                                        onChange: handleImportQuotesExcel
                                    })
                                )
                            )
                        ),
                        h("div", { className: "space-y-2" },
                            quoteList.map((quote, idx) => h("div", {
                                key: idx,
                                className: "flex gap-2"
                            },
                                h("input", {
                                    className: "flex-1 border rounded-lg p-2 text-sm",
                                    value: quote,
                                    onChange: e => updateQuotes(currentQuotes => {
                                        const nextQuotes = [...currentQuotes];
                                        nextQuotes[idx] = e.target.value;
                                        return nextQuotes;
                                    })
                                }),
                                h("button", {
                                    onClick: () => updateQuotes(currentQuotes => currentQuotes.filter((_, quoteIdx) => quoteIdx !== idx)),
                                    className: "px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-xs"
                                }, "删除")
                            )),
                            h("button", {
                                onClick: () => updateQuotes(currentQuotes => [...currentQuotes, ""]),
                                className: "px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-xs"
                            }, "新增语录")
                        )
                    )
                )
            );
        };
    };
})();
