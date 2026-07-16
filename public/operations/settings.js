(function() {
    window.createOperationSettingsSections = function createOperationSettingsSections(deps) {
        const {
            h,
            useState,
            useEffect,
            Icon,
            requireAdminAuth,
            getSystemConfig,
            normalizePointScene,
            normalizePointCategory,
            POINT_SCENES,
            POINT_CATEGORIES,
            DEFAULT_POINT_SCENE,
            DEFAULT_POINT_CATEGORY
        } = deps || {};

        if (
            !h ||
            !useState ||
            !useEffect ||
            !Icon ||
            !requireAdminAuth ||
            !getSystemConfig ||
            !normalizePointScene ||
            !normalizePointCategory ||
            !POINT_SCENES ||
            !POINT_CATEGORIES ||
            !DEFAULT_POINT_SCENE ||
            !DEFAULT_POINT_CATEGORY
        ) {
            throw new Error('Operation settings dependencies are missing');
        }

        const updateSystemConfig = (config, setConfig, updater) => {
            if (typeof setConfig !== 'function' || typeof updater !== 'function') return false;
            const nextSystemConfig = updater(getSystemConfig(config));
            if (!nextSystemConfig) return false;
            setConfig({ ...(config || {}), systemConfig: nextSystemConfig });
            return true;
        };

        const toggleManagedSection = async ({ isOpen, setIsOpen, promptText }) => {
            if (isOpen) {
                setIsOpen(false);
                return;
            }
            if (!await requireAdminAuth(promptText)) return;
            setIsOpen(true);
        };

        const SubjectConfigSection = ({ students, config, setConfig, embedded = false }) => {
            const [isOpen, setIsOpen] = useState(false);
            const systemConfig = getSystemConfig(config);
            const studentList = Array.isArray(students) ? students : [];
            const subjects = Array.isArray(systemConfig.subjects) ? systemConfig.subjects : [];
            const isVisible = isOpen;

            return h("div", { className: "bg-white p-4 rounded-xl shadow-sm border space-y-4" },
                h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                    h("div", { className: "space-y-1" },
                        h("div", { className: "flex items-center gap-2 text-gray-800" },
                            h(Icon, { name: "users", size: 18 }),
                            h("h3", { className: "font-bold text-sm" }, "课代表设置")
                        ),
                        h("p", { className: "text-xs text-gray-500" }, "配置作业登记使用的学科，以及每个学科的 1 到 2 名课代表。")
                    ),
                    h("button", {
                        onClick: () => {
                            if (embedded) {
                                setIsOpen(prev => !prev);
                                return;
                            }
                            toggleManagedSection({
                                isOpen,
                                setIsOpen,
                                promptText: "请输入维护密码以打开课代表设置："
                            });
                        },
                        className: `px-3 py-2 rounded-lg text-sm font-medium ${isOpen ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                    }, isOpen ? "收起课代表设置" : "打开课代表设置")
                ),
                isVisible && h("div", { className: "space-y-3 border-t pt-4" },
                    h("div", { className: "flex justify-between items-center" },
                        h("span", { className: "text-sm font-medium text-gray-700" }, "学科列表"),
                        h("button", {
                            onClick: () => updateSystemConfig(config, setConfig, sc => {
                                const list = [...(sc.subjects || [])];
                                list.push({ id: `subject_${Date.now()}`, name: "新学科", representatives: [] });
                                return { ...sc, subjects: list };
                            }),
                            className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
                        }, "新增学科")
                    ),
                    subjects.map((subject, idx) => h("div", {
                        key: subject.id || idx,
                        className: "bg-white p-3 rounded border space-y-2"
                    },
                        h("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2" },
                            h("input", {
                                className: "border rounded p-2 text-sm",
                                'aria-label': `第 ${idx + 1} 个学科的标识`,
                                value: subject.id || "",
                                onChange: e => updateSystemConfig(config, setConfig, sc => {
                                    const list = [...(sc.subjects || [])];
                                    list[idx] = { ...list[idx], id: e.target.value };
                                    return { ...sc, subjects: list };
                                }),
                                placeholder: "id"
                            }),
                            h("input", {
                                className: "border rounded p-2 text-sm",
                                'aria-label': `第 ${idx + 1} 个学科的名称`,
                                value: subject.name || "",
                                onChange: e => updateSystemConfig(config, setConfig, sc => {
                                    const list = [...(sc.subjects || [])];
                                    list[idx] = { ...list[idx], name: e.target.value };
                                    return { ...sc, subjects: list };
                                }),
                                placeholder: "学科名称"
                            }),
                            h("button", {
                                'aria-label': `删除学科：${subject.name || `第 ${idx + 1} 个学科`}`,
                                onClick: () => updateSystemConfig(config, setConfig, sc => {
                                    const list = [...(sc.subjects || [])];
                                    list.splice(idx, 1);
                                    return { ...sc, subjects: list };
                                }),
                                className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs"
                            }, "删除学科")
                        ),
                        h("div", { className: "border-t pt-2" },
                            h("div", { className: "text-xs font-medium text-gray-600 mb-2" }, "课代表"),
                            h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-2" },
                                [0, 1].map(pos => {
                                    const currentRepId = (subject.representatives || [])[pos];
                                    return h("div", { key: pos, className: "flex items-center gap-2" },
                                        h("span", { className: "text-xs text-gray-500 w-16" }, `课代表${pos + 1}`),
                                        h("select", {
                                            className: "flex-1 border rounded p-2 text-sm",
                                            'aria-label': `${subject.name || `第 ${idx + 1} 个学科`}的课代表 ${pos + 1}`,
                                            value: currentRepId || "",
                                            onChange: e => updateSystemConfig(config, setConfig, sc => {
                                                const list = [...(sc.subjects || [])];
                                                const reps = [...(list[idx].representatives || [])];
                                                const selectedId = e.target.value
                                                    ? (studentList.find(stu => String(stu.id) === String(e.target.value))?.id || e.target.value)
                                                    : null;
                                                reps[pos] = selectedId;
                                                list[idx] = { ...list[idx], representatives: reps.filter(Boolean) };
                                                return { ...sc, subjects: list };
                                            })
                                        },
                                            h("option", { value: "" }, "- 不设置 -"),
                                            studentList.map(student => h("option", {
                                                key: student.id,
                                                value: student.id,
                                                disabled: pos === 0
                                                    ? (subject.representatives || [])[1] === student.id
                                                    : (subject.representatives || [])[0] === student.id
                                            }, student.name))
                                        )
                                    );
                                })
                            )
                        )
                    ))
                )
            );
        };

        const ReasonsConfigSection = ({ config, setConfig, embedded = false }) => {
            const [isOpen, setIsOpen] = useState(false);
            const systemConfig = getSystemConfig(config);
            const reasons = (((systemConfig || {}).points || {}).reasons) || [];
            const isVisible = isOpen;

            return h("div", { className: "bg-white p-4 rounded-xl shadow-sm border space-y-4" },
                h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                    h("div", { className: "space-y-1" },
                        h("div", { className: "flex items-center gap-2 text-gray-800" },
                            h(Icon, { name: "clipboard", size: 18 }),
                            h("h3", { className: "font-bold text-sm" }, "积分理由设置")
                        ),
                        h("p", { className: "text-xs text-gray-500" }, "维护奖励、扣分及其他积分理由预设，直接影响本页快捷操作按钮。")
                    ),
                    h("button", {
                        onClick: () => {
                            if (embedded) {
                                setIsOpen(prev => !prev);
                                return;
                            }
                            toggleManagedSection({
                                isOpen,
                                setIsOpen,
                                promptText: "请输入维护密码以打开积分理由设置："
                            });
                        },
                        className: `px-3 py-2 rounded-lg text-sm font-medium ${isOpen ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                    }, isOpen ? "收起积分理由设置" : "打开积分理由设置")
                ),
                isVisible && h("div", { className: "space-y-3 border-t pt-4" },
                    h("div", { className: "flex justify-between items-center" },
                        h("span", { className: "text-sm font-medium text-gray-700" }, "积分理由预设"),
                        h("button", {
                            onClick: () => updateSystemConfig(config, setConfig, sc => {
                                const list = [...(((sc || {}).points || {}).reasons || [])];
                                list.push({
                                    name: "新理由",
                                    val: 0,
                                    type: "bonus",
                                    scene: DEFAULT_POINT_SCENE,
                                    category: DEFAULT_POINT_CATEGORY
                                });
                                return {
                                    ...sc,
                                    points: {
                                        ...(sc.points || {}),
                                        reasons: list
                                    }
                                };
                            }),
                            className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
                        }, "新增理由")
                    ),
                    reasons.map((reason, idx) => h("div", {
                        key: idx,
                        role: 'group',
                        'aria-label': `积分理由：${reason.name || `第 ${idx + 1} 个积分理由`}`,
                        className: "grid grid-cols-1 md:grid-cols-8 gap-2 bg-white p-3 rounded border"
                    },
                        h("input", {
                            className: "border rounded p-2 text-sm md:col-span-2",
                            'aria-label': `第 ${idx + 1} 个积分理由的名称`,
                            value: reason.name || "",
                            onChange: e => updateSystemConfig(config, setConfig, sc => {
                                const list = [...(((sc || {}).points || {}).reasons || [])];
                                list[idx] = { ...list[idx], name: e.target.value };
                                return { ...sc, points: { ...(sc.points || {}), reasons: list } };
                            }),
                            placeholder: "名称"
                        }),
                        h("input", {
                            type: "number",
                            className: "border rounded p-2 text-sm",
                            'aria-label': `${reason.name || `第 ${idx + 1} 个积分理由`}的分值`,
                            value: reason.val ?? 0,
                            onChange: e => updateSystemConfig(config, setConfig, sc => {
                                const list = [...(((sc || {}).points || {}).reasons || [])];
                                list[idx] = { ...list[idx], val: Number(e.target.value) };
                                return { ...sc, points: { ...(sc.points || {}), reasons: list } };
                            })
                        }),
                        h("select", {
                            className: "border rounded p-2 text-sm",
                            'aria-label': `${reason.name || `第 ${idx + 1} 个积分理由`}的类型`,
                            value: reason.type || "bonus",
                            onChange: e => updateSystemConfig(config, setConfig, sc => {
                                const list = [...(((sc || {}).points || {}).reasons || [])];
                                list[idx] = { ...list[idx], type: e.target.value };
                                return { ...sc, points: { ...(sc.points || {}), reasons: list } };
                            })
                        },
                            h("option", { value: "bonus" }, "奖励"),
                            h("option", { value: "penalty" }, "惩罚"),
                            h("option", { value: "spending" }, "消费")
                        ),
                        h("select", {
                            className: "border rounded p-2 text-sm",
                            'aria-label': `${reason.name || `第 ${idx + 1} 个积分理由`}的场景`,
                            value: normalizePointScene(reason.scene),
                            onChange: e => updateSystemConfig(config, setConfig, sc => {
                                const list = [...(((sc || {}).points || {}).reasons || [])];
                                list[idx] = { ...list[idx], scene: e.target.value };
                                return { ...sc, points: { ...(sc.points || {}), reasons: list } };
                            })
                        }, POINT_SCENES.map(scene => h("option", { key: scene, value: scene }, scene))),
                        h("select", {
                            className: "border rounded p-2 text-sm",
                            'aria-label': `${reason.name || `第 ${idx + 1} 个积分理由`}的类别`,
                            value: normalizePointCategory(reason.category),
                            onChange: e => updateSystemConfig(config, setConfig, sc => {
                                const list = [...(((sc || {}).points || {}).reasons || [])];
                                list[idx] = { ...list[idx], category: e.target.value };
                                return { ...sc, points: { ...(sc.points || {}), reasons: list } };
                            })
                        }, POINT_CATEGORIES.map(category => h("option", { key: category, value: category }, category))),
                        h("input", {
                            className: "border rounded p-2 text-sm",
                            'aria-label': `${reason.name || `第 ${idx + 1} 个积分理由`}的备注`,
                            value: reason.note || "",
                            onChange: e => updateSystemConfig(config, setConfig, sc => {
                                const list = [...(((sc || {}).points || {}).reasons || [])];
                                list[idx] = { ...list[idx], note: e.target.value };
                                return { ...sc, points: { ...(sc.points || {}), reasons: list } };
                            }),
                            placeholder: "备注"
                        }),
                        h("div", { className: "flex items-center gap-2 text-xs" },
                            h("label", { className: "flex items-center gap-1" },
                                h("input", {
                                    type: "checkbox",
                                    'aria-label': `${reason.name || `第 ${idx + 1} 个积分理由`}：允许编辑分值`,
                                    checked: !!reason.editable,
                                    onChange: e => updateSystemConfig(config, setConfig, sc => {
                                        const list = [...(((sc || {}).points || {}).reasons || [])];
                                        list[idx] = { ...list[idx], editable: e.target.checked };
                                        return { ...sc, points: { ...(sc.points || {}), reasons: list } };
                                    })
                                }),
                                "可编辑"
                            ),
                            h("label", { className: "flex items-center gap-1" },
                                h("input", {
                                    type: "checkbox",
                                    'aria-label': `${reason.name || `第 ${idx + 1} 个积分理由`}：启用倍率`,
                                    checked: !!reason.isMulti,
                                    onChange: e => updateSystemConfig(config, setConfig, sc => {
                                        const list = [...(((sc || {}).points || {}).reasons || [])];
                                        list[idx] = { ...list[idx], isMulti: e.target.checked };
                                        return { ...sc, points: { ...(sc.points || {}), reasons: list } };
                                    })
                                }),
                                "倍率"
                            )
                        ),
                        h("div", { className: "flex gap-2 items-center" },
                            h("input", {
                                type: "number",
                                className: "border rounded p-2 text-sm w-24",
                                'aria-label': `${reason.name || `第 ${idx + 1} 个积分理由`}的倍率`,
                                value: reason.factor ?? 1,
                                onChange: e => updateSystemConfig(config, setConfig, sc => {
                                    const list = [...(((sc || {}).points || {}).reasons || [])];
                                    list[idx] = { ...list[idx], factor: Number(e.target.value) };
                                    return { ...sc, points: { ...(sc.points || {}), reasons: list } };
                                })
                            }),
                            h("button", {
                                'aria-label': `删除积分理由：${reason.name || `第 ${idx + 1} 个积分理由`}`,
                                onClick: () => updateSystemConfig(config, setConfig, sc => {
                                    const list = [...(((sc || {}).points || {}).reasons || [])];
                                    list.splice(idx, 1);
                                    return { ...sc, points: { ...(sc.points || {}), reasons: list } };
                                }),
                                className: "px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs"
                            }, "删除")
                        )
                    ))
                )
            );
        };

        const PenaltyDecaySection = ({ config, setConfig, embedded = false }) => {
            const [isOpen, setIsOpen] = useState(false);
            const systemConfig = getSystemConfig(config);
            const pointsConfig = (systemConfig && systemConfig.points) || {};
            const isVisible = isOpen;

            return h("div", { className: "bg-white p-4 rounded-xl shadow-sm border space-y-4" },
                h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                    h("div", { className: "space-y-1" },
                        h("div", { className: "flex items-center gap-2 text-gray-800" },
                            h(Icon, { name: "clock", size: 18 }),
                            h("h3", { className: "font-bold text-sm" }, "扣分衰减设置")
                        ),
                        h("p", { className: "text-xs text-gray-500" }, "设置扣分多久自动衰减一次，以及每次衰减多少分。")
                    ),
                    h("button", {
                        onClick: () => {
                            if (embedded) {
                                setIsOpen(prev => !prev);
                                return;
                            }
                            toggleManagedSection({
                                isOpen,
                                setIsOpen,
                                promptText: "请输入维护密码以打开扣分衰减设置："
                            });
                        },
                        className: `px-3 py-2 rounded-lg text-sm font-medium ${isOpen ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                    }, isOpen ? "收起扣分衰减设置" : "打开扣分衰减设置")
                ),
                isVisible && h("div", { className: "space-y-3 border-t pt-4" },
                    h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
                        h("label", { className: "space-y-1" },
                            h("span", { className: "block text-sm font-medium text-gray-700" }, "衰减周期（天）"),
                            h("input", {
                                type: "number",
                                min: 0,
                                step: 1,
                                className: "w-full border rounded-lg p-2 text-sm",
                                value: pointsConfig.penaltyDecayDays ?? 7,
                                onChange: e => updateSystemConfig(config, setConfig, sc => ({
                                    ...sc,
                                    points: {
                                        ...(sc.points || {}),
                                        penaltyDecayDays: Math.max(0, Math.floor(Number(e.target.value) || 0))
                                    }
                                }))
                            }),
                            h("p", { className: "text-xs text-gray-500" }, "每满多少天自动衰减一次。填 0 表示关闭衰减。")
                        ),
                        h("label", { className: "space-y-1" },
                            h("span", { className: "block text-sm font-medium text-gray-700" }, "每周期衰减数额"),
                            h("input", {
                                type: "number",
                                min: 0,
                                step: 0.5,
                                className: "w-full border rounded-lg p-2 text-sm",
                                value: pointsConfig.penaltyDecayAmount ?? 10,
                                onChange: e => updateSystemConfig(config, setConfig, sc => ({
                                    ...sc,
                                    points: {
                                        ...(sc.points || {}),
                                        penaltyDecayAmount: Math.max(0, Number(e.target.value) || 0)
                                    }
                                }))
                            }),
                            h("p", { className: "text-xs text-gray-500" }, "每到一个衰减周期，从当前扣分里扣减这部分数额，最低减到 0。")
                        )
                    ),
                    h("div", { className: "rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 leading-5" }, "扣分衰减由服务端统一计算并写入数据库，不依赖页面是否打开。")
                )
            );
        };

        const RunningExerciseSettingsSection = ({ students, config, setConfig, embedded = false }) => {
            const [isOpen, setIsOpen] = useState(false);
            const systemConfig = getSystemConfig(config);
            const pointsConfig = (systemConfig && systemConfig.points) || {};
            const studentList = Array.isArray(students) ? students : [];
            const isVisible = isOpen;

            return h("div", { className: "bg-white p-4 rounded-xl shadow-sm border space-y-4" },
                h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                    h("div", { className: "space-y-1" },
                        h("div", { className: "flex items-center gap-2 text-gray-800" },
                            h(Icon, { name: "tasks", size: 18 }),
                            h("h3", { className: "font-bold text-sm" }, "跑操考勤设置")
                        ),
                        h("p", { className: "text-xs text-gray-500" }, "配置跑操登记时，缺勤学生扣多少分，以及正常出勤学生加多少分。")
                    ),
                    h("button", {
                        onClick: () => {
                            if (embedded) {
                                setIsOpen(prev => !prev);
                                return;
                            }
                            toggleManagedSection({
                                isOpen,
                                setIsOpen,
                                promptText: "请输入维护密码以打开跑操考勤设置："
                            });
                        },
                        className: `px-3 py-2 rounded-lg text-sm font-medium ${isOpen ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                    }, isOpen ? "收起跑操设置" : "打开跑操设置")
                ),
                isVisible && h("div", { className: "space-y-3 border-t pt-4" },
                    h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
                        h("label", { className: "space-y-1" },
                            h("span", { className: "block text-sm font-medium text-gray-700" }, "跑操缺勤扣分"),
                            h("input", {
                                type: "number",
                                step: 0.5,
                                className: "w-full border rounded-lg p-2 text-sm",
                                value: pointsConfig.runningExerciseAbsentPenalty ?? 1,
                                onChange: e => updateSystemConfig(config, setConfig, sc => ({
                                    ...sc,
                                    points: {
                                        ...(sc.points || {}),
                                        runningExerciseAbsentPenalty: Number(e.target.value) || 0
                                    }
                                }))
                            }),
                            h("p", { className: "text-xs text-gray-500" }, "登记为缺勤的学生会按这个值扣分，实际记分时会自动按扣分处理。")
                        ),
                        h("label", { className: "space-y-1" },
                            h("span", { className: "block text-sm font-medium text-gray-700" }, "跑操正常加分"),
                            h("input", {
                                type: "number",
                                step: 0.5,
                                className: "w-full border rounded-lg p-2 text-sm",
                                value: pointsConfig.runningExercisePresentBonus ?? 1,
                                onChange: e => updateSystemConfig(config, setConfig, sc => ({
                                    ...sc,
                                    points: {
                                        ...(sc.points || {}),
                                        runningExercisePresentBonus: Number(e.target.value) || 0
                                    }
                                }))
                            }),
                            h("p", { className: "text-xs text-gray-500" }, "未被勾为缺勤的其余学生都会获得这个加分。填 0 表示只登记不加分。")
                        ),
                        h("label", { className: "space-y-1" },
                            h("span", { className: "block text-sm font-medium text-gray-700" }, "跑操体委"),
                            h("select", {
                                className: "w-full border rounded-lg p-2 text-sm bg-white",
                                value: pointsConfig.runningExerciseCommissionerStudentId ?? '',
                                onChange: e => updateSystemConfig(config, setConfig, sc => ({
                                    ...sc,
                                    points: {
                                        ...(sc.points || {}),
                                        runningExerciseCommissionerStudentId: e.target.value || null
                                    }
                                }))
                            },
                                h("option", { value: "" }, "不设置"),
                                studentList.map(student => h("option", { key: student.id, value: student.id }, student.name || `学生${student.id}`))
                            ),
                            h("p", { className: "text-xs text-gray-500" }, "每次提交跑操登记后，会额外给这里设置的体委发放下面设置的奖励分。")
                        ),
                        h("label", { className: "space-y-1" },
                            h("span", { className: "block text-sm font-medium text-gray-700" }, "体委提交奖励分"),
                            h("input", {
                                type: "number",
                                step: 0.5,
                                className: "w-full border rounded-lg p-2 text-sm",
                                value: pointsConfig.runningExerciseCommissionerBonus ?? 1,
                                onChange: e => updateSystemConfig(config, setConfig, sc => ({
                                    ...sc,
                                    points: {
                                        ...(sc.points || {}),
                                        runningExerciseCommissionerBonus: Number(e.target.value) || 0
                                    }
                                }))
                            }),
                            h("p", { className: "text-xs text-gray-500" }, "只在提交跑操登记时发给体委。填 0 表示不额外加分。")
                        )
                    ),
                    h("div", { className: "rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600 leading-5" }, "跑操登记每天只能提交一次，提交后会同时写入缺勤扣分、正常出勤加分，以及体委提交奖励分记录。")
                )
            );
        };

        const HygieneRegisterSettingsSection = ({ config, setConfig, embedded = false }) => {
            const [isOpen, setIsOpen] = useState(false);
            const systemConfig = getSystemConfig(config);
            const pointsConfig = (systemConfig && systemConfig.points) || {};
            const hygieneConfig = pointsConfig.hygieneRegister || {};
            const isVisible = isOpen;

            return h("div", { className: "bg-white p-4 rounded-xl shadow-sm border space-y-4" },
                h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                    h("div", { className: "space-y-1" },
                        h("div", { className: "flex items-center gap-2 text-gray-800" },
                            h(Icon, { name: "droplet", size: 18 }),
                            h("h3", { className: "font-bold text-sm" }, "卫生登记设置")
                        ),
                        h("p", { className: "text-xs text-gray-500" }, "配置卫生登记开关、专员加分与不合格扣分分值。")
                    ),
                    h("button", {
                        onClick: () => {
                            if (embedded) {
                                setIsOpen(prev => !prev);
                                return;
                            }
                            toggleManagedSection({
                                isOpen,
                                setIsOpen,
                                promptText: "请输入维护密码以打开卫生登记设置："
                            });
                        },
                        className: `px-3 py-2 rounded-lg text-sm font-medium ${isOpen ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                    }, isOpen ? "收起卫生登记设置" : "打开卫生登记设置")
                ),
                isVisible && h("div", { className: "space-y-3 border-t pt-4" },
                    h("div", { className: "flex items-center gap-2" },
                        h("input", {
                            type: "checkbox",
                            id: "hygieneRegisterEnabled",
                            checked: systemConfig.enabledFeatures?.hygieneRegister === true,
                            onChange: e => updateSystemConfig(config, setConfig, sc => ({
                                ...sc,
                                enabledFeatures: { ...(sc.enabledFeatures || {}), hygieneRegister: e.target.checked }
                            })),
                            className: "w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        }),
                        h("label", { htmlFor: "hygieneRegisterEnabled", className: "text-sm text-gray-700 cursor-pointer" }, "启用卫生登记")
                    ),
                    h("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
                        h("label", { className: "space-y-1" },
                            h("span", { className: "block text-sm font-medium text-gray-700" }, "卫生专员加分"),
                            h("input", {
                                type: "number",
                                step: 0.5,
                                className: "w-full border rounded-lg p-2 text-sm",
                                value: hygieneConfig.inspectorBonus ?? 1,
                                onChange: e => updateSystemConfig(config, setConfig, sc => ({
                                    ...sc,
                                    points: {
                                        ...(sc.points || {}),
                                        hygieneRegister: { ...(sc.points?.hygieneRegister || {}), inspectorBonus: Number(e.target.value) || 0 }
                                    }
                                }))
                            }),
                            h("p", { className: "text-xs text-gray-500" }, "每次提交后，当日卫生专员获得此加分。")
                        ),
                        h("label", { className: "space-y-1" },
                            h("span", { className: "block text-sm font-medium text-gray-700" }, "卫生不达标扣分"),
                            h("input", {
                                type: "number",
                                step: 0.5,
                                className: "w-full border rounded-lg p-2 text-sm",
                                value: hygieneConfig.areaPenalty ?? 1,
                                onChange: e => updateSystemConfig(config, setConfig, sc => ({
                                    ...sc,
                                    points: {
                                        ...(sc.points || {}),
                                        hygieneRegister: { ...(sc.points?.hygieneRegister || {}), areaPenalty: Number(e.target.value) || 0 }
                                    }
                                }))
                            }),
                            h("p", { className: "text-xs text-gray-500" }, "被勾选为不合格的学生每人扣此分值。")
                        )
                    )
                )
            );
        };

        const DisciplineRegisterSettingsSection = ({ config, setConfig, embedded = false }) => {
            const [isOpen, setIsOpen] = useState(false);
            const systemConfig = getSystemConfig(config);
            const pointsConfig = (systemConfig && systemConfig.points) || {};
            const discConfig = pointsConfig.disciplineRegister || {};
            const isVisible = isOpen;

            const disciplineItems = [
                { key: 'noise',   label: '学习时间讲话', commissionerName: '噪音专员' },
                { key: 'desk',    label: '桌面杂乱',     commissionerName: '书桌专员' },
                { key: 'tablet',  label: '平板未归',     commissionerName: '平板专员' },
                { key: 'outdoor', label: '晚自习外出',   commissionerName: '外出专员' }
            ];

            return h("div", { className: "bg-white p-4 rounded-xl shadow-sm border space-y-4" },
                h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                    h("div", { className: "space-y-1" },
                        h("div", { className: "flex items-center gap-2 text-gray-800" },
                            h(Icon, { name: "shield", size: 18 }),
                            h("h3", { className: "font-bold text-sm" }, "纪律登记设置")
                        ),
                        h("p", { className: "text-xs text-gray-500" }, "配置纪律登记开关、各检查项扣分与专员加分。")
                    ),
                    h("button", {
                        onClick: () => {
                            if (embedded) {
                                setIsOpen(prev => !prev);
                                return;
                            }
                            toggleManagedSection({
                                isOpen,
                                setIsOpen,
                                promptText: "请输入维护密码以打开纪律登记设置："
                            });
                        },
                        className: `px-3 py-2 rounded-lg text-sm font-medium ${isOpen ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                    }, isOpen ? "收起纪律登记设置" : "打开纪律登记设置")
                ),
                isVisible && h("div", { className: "space-y-3 border-t pt-4" },
                    h("div", { className: "flex items-center gap-2" },
                        h("input", {
                            type: "checkbox",
                            id: "disciplineRegisterEnabled",
                            checked: systemConfig.enabledFeatures?.disciplineRegister === true,
                            onChange: e => updateSystemConfig(config, setConfig, sc => ({
                                ...sc,
                                enabledFeatures: { ...(sc.enabledFeatures || {}), disciplineRegister: e.target.checked }
                            })),
                            className: "w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        }),
                        h("label", { htmlFor: "disciplineRegisterEnabled", className: "text-sm text-gray-700 cursor-pointer" }, "启用纪律登记")
                    ),
                    h("div", { className: "space-y-2" },
                        disciplineItems.map(item => {
                            const itemConfig = discConfig[item.key] || {};
                            return h("div", { key: item.key, className: "grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 border rounded-lg p-3" },
                                h("div", { className: "flex items-center gap-2 text-sm font-medium text-gray-700" },
                                    h("span", null, item.label),
                                    h("span", { className: "text-xs text-gray-400" }, `→ ${item.commissionerName}`)
                                ),
                                h("label", { className: "space-y-1" },
                                    h("span", { className: "block text-xs font-medium text-gray-600" }, "扣分"),
                                    h("input", {
                                        type: "number",
                                        step: 0.5,
                                        'aria-label': `${item.label}扣分`,
                                        className: "w-full border rounded p-2 text-sm",
                                        value: itemConfig.penalty ?? 1,
                                        onChange: e => updateSystemConfig(config, setConfig, sc => {
                                            const next = { ...(sc.points?.disciplineRegister || {}) };
                                            next[item.key] = { ...(next[item.key] || {}), penalty: Number(e.target.value) || 0 };
                                            return { ...sc, points: { ...(sc.points || {}), disciplineRegister: next } };
                                        })
                                    })
                                ),
                                h("label", { className: "space-y-1" },
                                    h("span", { className: "block text-xs font-medium text-gray-600" }, "专员加分"),
                                    h("input", {
                                        type: "number",
                                        step: 0.5,
                                        'aria-label': `${item.label}专员加分`,
                                        className: "w-full border rounded p-2 text-sm",
                                        value: itemConfig.commissionerBonus ?? 1,
                                        onChange: e => updateSystemConfig(config, setConfig, sc => {
                                            const next = { ...(sc.points?.disciplineRegister || {}) };
                                            next[item.key] = { ...(next[item.key] || {}), commissionerBonus: Number(e.target.value) || 0 };
                                            return { ...sc, points: { ...(sc.points || {}), disciplineRegister: next } };
                                        })
                                    })
                                )
                            );
                        })
                    )
                )
            );
        };

        const RecordAttributesSection = ({ history, setHistory, config, setConfig, embedded = false }) => {
            const [isOpen, setIsOpen] = useState(false);
            const [recordSearch, setRecordSearch] = useState("");
            const [recordSelection, setRecordSelection] = useState(new Set());
            const [recordScene, setRecordScene] = useState(DEFAULT_POINT_SCENE);
            const [recordCategory, setRecordCategory] = useState(DEFAULT_POINT_CATEGORY);
            const [showPendingOnly, setShowPendingOnly] = useState(false);

            const systemConfig = getSystemConfig(config);
            const historyList = Array.isArray(history) ? history : [];
            const isVisible = isOpen;

            useEffect(() => {
                if (historyList.length === 0) return;
                if (systemConfig && systemConfig.recordCategoryPendingMigrated) return;
                const nextHistory = historyList.map(item => ({ ...item, category: "待定" }));
                if (typeof setHistory === 'function') setHistory(nextHistory);
                updateSystemConfig(config, setConfig, sc => ({ ...sc, recordCategoryPendingMigrated: true }));
            }, [historyList.length, systemConfig && systemConfig.recordCategoryPendingMigrated]);

            const normalizedRecordSearch = (recordSearch || "").trim().toLowerCase();
            const recordSearchTerms = normalizedRecordSearch ? normalizedRecordSearch.split(/\s+/) : [];
            const filteredHistoryRecords = historyList.filter(item => {
                if (showPendingOnly && normalizePointCategory(item.category) !== "待定") return false;
                if (!recordSearchTerms.length) return true;
                const haystack = `${item.studentName || ""} ${item.reason || ""} ${normalizePointScene(item.scene)} ${normalizePointCategory(item.category)}`.toLowerCase();
                return recordSearchTerms.every(term => haystack.includes(term));
            });
            const visibleHistoryRecords = filteredHistoryRecords.slice(0, 200);

            const toggleRecordSelection = (id) => {
                setRecordSelection(prev => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                });
            };

            const selectFilteredRecords = () => {
                setRecordSelection(new Set(filteredHistoryRecords.map(item => item.id)));
            };

            const clearRecordSelection = () => {
                setRecordSelection(new Set());
            };

            const applyRecordAttributes = () => {
                if (recordSelection.size === 0) return alert("请先选择记录");
                if (typeof setHistory !== 'function') return;
                const nextHistory = historyList.map(item => recordSelection.has(item.id)
                    ? { ...item, scene: normalizePointScene(recordScene), category: normalizePointCategory(recordCategory) }
                    : item
                );
                setHistory(nextHistory);
                setRecordSelection(new Set());
            };

            const deleteSelectedRecords = () => {
                if (recordSelection.size === 0) return alert("请先选择记录");
                if (!confirm(`确定删除选中的 ${recordSelection.size} 条记录？\n注意：此操作仅删除记录，不会影响学生积分数据。`)) return;
                if (typeof setHistory !== 'function') return;
                const nextHistory = historyList.filter(item => !recordSelection.has(item.id));
                setHistory(nextHistory);
                setRecordSelection(new Set());
            };

            return h("div", { className: "bg-white p-4 rounded-xl shadow-sm border space-y-4" },
                h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                    h("div", { className: "space-y-1" },
                        h("div", { className: "flex items-center gap-2 text-gray-800" },
                            h(Icon, { name: "fileText", size: 18 }),
                            h("h3", { className: "font-bold text-sm" }, "积分记录属性维护")
                        ),
                        h("p", { className: "text-xs text-gray-500" }, "批量修正积分记录的场景、类别，或删除错误记录。")
                    ),
                    h("button", {
                        onClick: () => {
                            if (embedded) {
                                setIsOpen(prev => !prev);
                                return;
                            }
                            toggleManagedSection({
                                isOpen,
                                setIsOpen,
                                promptText: "请输入维护密码以打开积分记录属性维护："
                            });
                        },
                        className: `px-3 py-2 rounded-lg text-sm font-medium ${isOpen ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                    }, isOpen ? "收起记录属性维护" : "打开记录属性维护")
                ),
                isVisible && h("div", { className: "bg-gray-50 border rounded-lg p-4 space-y-3 border-t pt-4" },
                    h("div", { className: "flex flex-wrap items-center justify-between gap-3" },
                        h("div", null,
                            h("div", { className: "font-bold text-gray-700 text-sm" }, "积分记录属性维护"),
                            h("div", { className: "text-xs text-gray-500 mt-1" }, `共 ${filteredHistoryRecords.length} 条，当前展示 ${visibleHistoryRecords.length} 条`)
                        ),
                        h("div", { className: "flex flex-wrap gap-2" },
                            h("button", { onClick: selectFilteredRecords, className: "px-3 py-1 bg-white border rounded text-xs hover:bg-gray-100" }, "全选筛选"),
                            h("button", { onClick: clearRecordSelection, className: "px-3 py-1 bg-white border rounded text-xs hover:bg-gray-100" }, "清空选择"),
                            h("button", { onClick: () => setShowPendingOnly(v => !v), className: `px-3 py-1 border rounded text-xs ${showPendingOnly ? 'bg-amber-500 text-white border-amber-500' : 'bg-white hover:bg-gray-100'}` }, "仅显示待定类别记录"),
                            h("button", { onClick: applyRecordAttributes, className: "px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700" }, "应用到已选"),
                            h("button", { onClick: deleteSelectedRecords, className: "px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600" }, "删除已选")
                        )
                    ),
                    h("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2" },
                        h("input", {
                            className: "border rounded p-2 text-sm",
                            'aria-label': '检索积分记录',
                            value: recordSearch,
                            onChange: e => setRecordSearch(e.target.value),
                            placeholder: "检索学生/理由/场景/类别"
                        }),
                        h("select", {
                            className: "border rounded p-2 text-sm",
                            'aria-label': '按积分场景筛选记录',
                            value: recordScene,
                            onChange: e => setRecordScene(e.target.value)
                        }, POINT_SCENES.map(scene => h("option", { key: scene, value: scene }, scene))),
                        h("select", {
                            className: "border rounded p-2 text-sm",
                            'aria-label': '按积分类别筛选记录',
                            value: recordCategory,
                            onChange: e => setRecordCategory(e.target.value)
                        }, POINT_CATEGORIES.map(category => h("option", { key: category, value: category }, category)))
                    ),
                    h("div", { className: "max-h-80 overflow-y-auto border rounded bg-white" },
                        h("table", { className: "w-full text-xs text-left" },
                            h("thead", { className: "bg-gray-50 sticky top-0" },
                                h("tr", null,
                                    h("th", { className: "p-2 w-10", scope: 'col' }, "选择"),
                                    h("th", { className: "p-2" }, "时间"),
                                    h("th", { className: "p-2" }, "学生"),
                                    h("th", { className: "p-2" }, "事项"),
                                    h("th", { className: "p-2" }, "场景"),
                                    h("th", { className: "p-2" }, "类别"),
                                    h("th", { className: "p-2 text-right" }, "变动")
                                )
                            ),
                            h("tbody", { className: "divide-y" },
                                visibleHistoryRecords.length === 0
                                    ? h("tr", null, h("td", { colSpan: 7, className: "p-4 text-center text-gray-400" }, "暂无匹配记录"))
                                    : visibleHistoryRecords.map(item => h("tr", { key: item.id, className: "hover:bg-gray-50" },
                                        h("td", { className: "p-2" },
                                            h("input", {
                                                type: "checkbox",
                                                'aria-label': `选择 ${item.studentName || '未知学生'} ${new Date(item.ts).toLocaleString()} ${item.reason || '积分变动'}记录`,
                                                checked: recordSelection.has(item.id),
                                                onChange: () => toggleRecordSelection(item.id)
                                            })
                                        ),
                                        h("td", { className: "p-2 text-gray-400" }, new Date(item.ts).toLocaleString()),
                                        h("td", { className: "p-2 font-medium" }, item.studentName),
                                        h("td", { className: "p-2 text-gray-600" }, item.reason),
                                        h("td", { className: "p-2" }, normalizePointScene(item.scene)),
                                        h("td", { className: "p-2" }, normalizePointCategory(item.category)),
                                        h("td", { className: `p-2 text-right font-bold ${item.val > 0 ? 'text-green-600' : 'text-red-500'}` }, item.val > 0 ? `+${item.val}` : item.val)
                                    ))
                            )
                        )
                    )
                )
            );
        };

        return {
            SubjectConfigSection,
            ReasonsConfigSection,
            PenaltyDecaySection,
            RunningExerciseSettingsSection,
            HygieneRegisterSettingsSection,
            DisciplineRegisterSettingsSection,
            RecordAttributesSection
        };
    };
})();
