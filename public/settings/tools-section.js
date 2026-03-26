(function() {
    window.createSettingsToolsSection = function createSettingsToolsSection(deps) {
        const { h } = deps || {};

        if (!h) {
            throw new Error('Settings tools section dependencies are missing');
        }

        const renderToolCard = (title, description, content) => h("div", { className: "bg-white border rounded-lg p-4 space-y-3 h-full" },
            h("div", { className: "text-sm font-medium text-gray-700" }, title),
            description ? h("p", { className: "text-xs text-gray-500" }, description) : null,
            content
        );

        return function renderSettingsToolsSection(props) {
            const {
                config,
                setConfigSafe,
                students,
                setStudents,
                testMode,
                enterTestMode,
                exitTestMode,
                simTime,
                setSimTime,
                timeSpeed,
                setTimeSpeed,
                getNow,
                formatDateTimeLocal,
                scheduleDate,
                scheduleText,
                setScheduleText,
                handleScheduleDateChange,
                handleSaveSchedule,
                handleDeleteSchedule,
                countdownName,
                setCountdownName,
                countdownDate,
                setCountdownDate,
                addCountdownEvent,
                removeCountdownEvent,
                reportStart,
                setReportStart,
                reportEnd,
                setReportEnd,
                getReportRange,
                handleGenerateBrief
            } = props || {};

            const studentList = Array.isArray(students) ? students : [];
            const countdownEvents = Array.isArray(config?.countdownEvents) ? config.countdownEvents : [];
            const scheduleNotes = config?.scheduleNotes && typeof config.scheduleNotes === 'object'
                ? config.scheduleNotes
                : {};
            const scheduleNoteList = Object.entries(scheduleNotes)
                .map(([date, note]) => ({ date, note: String(note || '').trim() }))
                .filter(item => item.date && item.note)
                .sort((a, b) => a.date.localeCompare(b.date));

            return h("div", { className: "border-t pt-6" },
                h("h3", { className: "font-bold text-gray-700 mb-4" }, "🧰 工具区"),
                h("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start" },
                    renderToolCard(
                        "❄️ 假期封存",
                        "开启后暂停缺勤记录、迟到扣分、缺勤结算、全勤奖等所有自动机制，适用于假期。",
                        h("div", { className: "space-y-3" },
                            h("button", {
                                onClick: () => {
                                    const newFrozen = !config?.frozen;
                                    setConfigSafe(c => ({ ...c, frozen: newFrozen }));

                                    if (!newFrozen) {
                                        const now = getNow().getTime();
                                        const newStudents = studentList.map(student => ({
                                            ...student,
                                            lastPenaltyAt: now
                                        }));
                                        setStudents(newStudents);
                                        alert("系统已解封，所有学生的未扣分天数已重置为0天");
                                    }
                                },
                                className: `w-full py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${config?.frozen ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`
                            }, config?.frozen ? "✓ 已封存（点击解除）" : "未封存（点击开启）")
                        )
                    ),
                    renderToolCard(
                        "🧪 测试模式",
                        "进入后所有操作仅在测试隔离环境中生效，退出后自动还原。",
                        h("div", { className: "space-y-3" },
                            h("div", { className: "flex flex-wrap gap-3 items-center" },
                                h("button", {
                                    onClick: () => testMode ? exitTestMode() : enterTestMode(),
                                    className: `px-4 py-2 rounded-lg font-bold text-sm ${testMode ? "bg-red-500 text-white hover:bg-red-600" : "bg-blue-600 text-white hover:bg-blue-700"}`
                                }, testMode ? "退出测试模式" : "进入测试模式"),
                                h("span", { className: `text-xs font-medium ${testMode ? "text-green-600" : "text-gray-400"}` }, testMode ? "已启用" : "未启用")
                            ),
                            testMode && h("div", { className: "bg-gray-50 border rounded-lg p-3 space-y-3" },
                                h("div", { className: "text-sm text-gray-700" }, `当前模拟时间：${new Date(simTime).toLocaleString()}`),
                                h("div", { className: "space-y-3" },
                                    h("div", null,
                                        h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "设置模拟时间"),
                                        h("input", {
                                            type: "datetime-local",
                                            className: "w-full border rounded-lg p-2 text-sm bg-white",
                                            value: formatDateTimeLocal(simTime),
                                            onChange: (e) => {
                                                const value = e.target.value;
                                                if (!value) return;
                                                const nextTime = new Date(value);
                                                if (!isNaN(nextTime.getTime())) setSimTime(nextTime.getTime());
                                            }
                                        })
                                    ),
                                    h("div", null,
                                        h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "时间流速"),
                                        h("div", { className: "flex gap-2 flex-wrap" },
                                            [1, 2, 5, 10, 30, 60].map(speed => h("button", {
                                                key: speed,
                                                onClick: () => setTimeSpeed(speed),
                                                className: `px-3 py-2 rounded-lg text-xs font-bold ${timeSpeed === speed ? "bg-blue-600 text-white" : "bg-white border text-gray-700 hover:bg-gray-100"}`
                                            }, `${speed}x`))
                                        )
                                    )
                                ),
                                h("div", { className: "flex flex-wrap gap-2" },
                                    h("button", { onClick: () => setSimTime(time => time - 60 * 60 * 1000), className: "px-3 py-2 bg-white border rounded text-xs hover:bg-gray-100" }, "后退1小时"),
                                    h("button", { onClick: () => setSimTime(time => time + 60 * 60 * 1000), className: "px-3 py-2 bg-white border rounded text-xs hover:bg-gray-100" }, "前进1小时"),
                                    h("button", { onClick: () => setSimTime(time => time - 24 * 60 * 60 * 1000), className: "px-3 py-2 bg-white border rounded text-xs hover:bg-gray-100" }, "后退1天"),
                                    h("button", { onClick: () => setSimTime(time => time + 24 * 60 * 60 * 1000), className: "px-3 py-2 bg-white border rounded text-xs hover:bg-gray-100" }, "前进1天"),
                                    h("button", { onClick: () => setSimTime(getNow().getTime()), className: "px-3 py-2 bg-gray-200 rounded text-xs hover:bg-gray-300" }, "重置当前")
                                )
                            )
                        )
                    ),
                    renderToolCard(
                        "🗓️ 日程设置",
                        "维护仪表盘首页“日历日程”的显示内容。",
                        h("div", { className: "space-y-3" },
                            h("div", { className: "flex flex-col gap-2" },
                                h("input", {
                                    type: "date",
                                    className: "border rounded p-2 text-sm bg-white",
                                    value: scheduleDate,
                                    onChange: e => handleScheduleDateChange(e.target.value)
                                }),
                                h("textarea", {
                                    className: "border rounded p-2 text-sm bg-white min-h-[88px]",
                                    value: scheduleText,
                                    onChange: e => setScheduleText(e.target.value),
                                    placeholder: "输入当天日程内容"
                                }),
                                h("div", { className: "flex gap-2" },
                                    h("button", {
                                        onClick: handleSaveSchedule,
                                        className: "flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm"
                                    }, "保存日程"),
                                    h("button", {
                                        onClick: () => {
                                            setScheduleText('');
                                            handleSaveSchedule(scheduleDate, '');
                                        },
                                        className: "px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm"
                                    }, "清空")
                                )
                            ),
                            h("div", { className: "space-y-2" },
                                scheduleNoteList.length === 0
                                    ? h("div", { className: "text-xs text-gray-400" }, "暂无已设置日程")
                                    : scheduleNoteList.map(item => h("div", { key: item.date, className: "bg-gray-50 border rounded p-2 space-y-2" },
                                        h("div", { className: "text-xs font-medium text-gray-700" }, item.date),
                                        h("div", { className: "text-sm text-gray-600 whitespace-pre-wrap break-words" }, item.note),
                                        h("div", { className: "flex gap-2" },
                                            h("button", {
                                                onClick: () => handleScheduleDateChange(item.date),
                                                className: "px-2 py-1 text-xs bg-white border text-gray-700 rounded"
                                            }, "编辑"),
                                            h("button", {
                                                onClick: () => handleDeleteSchedule(item.date),
                                                className: "px-2 py-1 text-xs bg-red-50 text-red-600 rounded"
                                            }, "删除")
                                        )
                                    ))
                            )
                        )
                    ),
                    renderToolCard(
                        "📅 倒数日",
                        "新增和维护首页倒数日显示内容。",
                        h("div", { className: "space-y-3" },
                            h("div", { className: "flex flex-col gap-2" },
                                h("input", { className: "border rounded p-2 text-sm bg-white", value: countdownName, onChange: e => setCountdownName(e.target.value), placeholder: "事件名称" }),
                                h("input", { type: "date", className: "border rounded p-2 text-sm bg-white", value: countdownDate, onChange: e => setCountdownDate(e.target.value) }),
                                h("button", { onClick: addCountdownEvent, className: "px-3 py-2 bg-blue-600 text-white rounded text-sm" }, "新增")
                            ),
                            h("div", { className: "space-y-2" },
                                countdownEvents.map(event => h("div", { key: event.id || `${event.name}-${event.date}`, className: "flex items-center gap-2 bg-gray-50 p-2 rounded border text-sm" },
                                    h("div", { className: "flex-1 min-w-0" }, `${event.name} · ${event.date}`),
                                    h("button", { onClick: () => removeCountdownEvent(event.id), className: "px-2 py-1 text-xs bg-red-50 text-red-600 rounded shrink-0" }, "删除")
                                ))
                            )
                        )
                    ),
                    renderToolCard(
                        "📝 简报",
                        "按日期范围导出简报文本。",
                        h("div", { className: "space-y-3" },
                            h("div", { className: "flex flex-wrap gap-2" },
                                h("button", {
                                    onClick: () => {
                                        const range = getReportRange(7);
                                        setReportStart(range.start);
                                        setReportEnd(range.end);
                                    },
                                    className: "px-3 py-1 text-xs bg-white border text-gray-700 rounded"
                                }, "近7天"),
                                h("button", {
                                    onClick: () => {
                                        const range = getReportRange(30);
                                        setReportStart(range.start);
                                        setReportEnd(range.end);
                                    },
                                    className: "px-3 py-1 text-xs bg-white border text-gray-700 rounded"
                                }, "近30天")
                            ),
                            h("div", { className: "flex flex-col gap-2" },
                                h("input", { type: "date", className: "border rounded p-2 text-sm bg-white", value: reportStart, onChange: e => setReportStart(e.target.value) }),
                                h("input", { type: "date", className: "border rounded p-2 text-sm bg-white", value: reportEnd, onChange: e => setReportEnd(e.target.value) }),
                                h("button", { onClick: handleGenerateBrief, className: "px-3 py-2 bg-emerald-600 text-white rounded text-sm" }, "生成简报")
                            )
                        )
                    )
                )
            );
        };
    };
})();
