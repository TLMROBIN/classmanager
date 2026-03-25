(function() {
    window.createSettingsStudentRosterSection = function createSettingsStudentRosterSection(deps) {
        const { h } = deps || {};

        if (!h) {
            throw new Error('Settings student roster section dependencies are missing');
        }

        return function SettingsStudentRosterSection(props) {
            const {
                showStudentRosterManager,
                onToggleOpen,
                handleExportStudentsExcel,
                handleDownloadStudentTemplate,
                handleImportStudentsExcel,
                addStudent,
                students,
                systemConfig,
                updateStudent,
                removeStudent
            } = props || {};

            const studentList = Array.isArray(students) ? students : [];
            const groups = systemConfig?.organization?.groups || [];
            const dorms = systemConfig?.organization?.dorms || [];

            return h("div", { className: "bg-white border rounded-lg p-4 space-y-4" },
                h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                    h("div", null,
                        h("div", { className: "text-sm font-medium text-gray-700" }, "学生名单维护"),
                        h("p", { className: "text-xs text-gray-500 mt-1" }, "导入、导出、增量更新和手动编辑学生名单都收在这里。")
                    ),
                    h("button", {
                        onClick: onToggleOpen,
                        className: "px-4 py-2 bg-white border rounded hover:bg-gray-100 text-sm font-medium"
                    }, showStudentRosterManager ? "收起学生名单维护" : "打开学生名单维护")
                ),
                showStudentRosterManager && h("div", { className: "border-t pt-4" },
                    h("div", { className: "flex flex-wrap gap-2 mb-4" },
                        h("button", { onClick: handleExportStudentsExcel, className: "px-3 py-2 border border-blue-500 text-blue-600 rounded hover:bg-blue-50 text-sm" }, "导出学生名单"),
                        h("button", { onClick: handleDownloadStudentTemplate, className: "px-3 py-2 border border-sky-500 text-sky-600 rounded hover:bg-sky-50 text-sm" }, "下载导入模板"),
                        h("label", { className: "px-3 py-2 border border-emerald-500 text-emerald-600 rounded hover:bg-emerald-50 text-sm cursor-pointer" },
                            "增量导入",
                            h("input", { type: "file", accept: ".xlsx,.xls", onChange: e => handleImportStudentsExcel(e, 'merge'), style: { display: 'none' } })
                        ),
                        h("label", { className: "px-3 py-2 border border-amber-500 text-amber-600 rounded hover:bg-amber-50 text-sm cursor-pointer" },
                            "覆盖导入",
                            h("input", { type: "file", accept: ".xlsx,.xls", onChange: e => handleImportStudentsExcel(e, 'overwrite'), style: { display: 'none' } })
                        ),
                        h("button", { onClick: addStudent, className: "px-3 py-2 border border-green-500 text-green-600 rounded hover:bg-green-50 text-sm" }, "新增学生")
                    ),
                    h("p", { className: "text-xs text-gray-500 mb-4" }, "导入学生名单前，请先在“系统配置 -> 组织架构”中维护小组和宿舍，再使用系统模板填写。表头错误或小组/宿舍名称不匹配时，将整批拒绝导入。"),
                    h("div", { className: "max-h-96 overflow-y-auto border rounded" },
                        h("table", { className: "w-full text-sm text-left" },
                            h("thead", null,
                                h("tr", { className: "bg-gray-50" },
                                    h("th", { className: "p-2" }, "姓名"),
                                    h("th", { className: "p-2" }, "性别"),
                                    h("th", { className: "p-2" }, "小组"),
                                    h("th", { className: "p-2" }, "职位"),
                                    h("th", { className: "p-2" }, "宿舍"),
                                    h("th", { className: "p-2" }, "操作")
                                )
                            ),
                            h("tbody", null,
                                studentList.map(student => h("tr", { key: student.id, className: "border-t" },
                                    h("td", { className: "p-2" }, h("input", { className: "w-full border rounded p-1", value: student.name || "", onChange: e => updateStudent(student.id, { name: e.target.value }) })),
                                    h("td", { className: "p-2" }, h("select", { className: "w-full border rounded p-1", value: student.gender || "", onChange: e => updateStudent(student.id, { gender: e.target.value }) }, h("option", { value: "" }, "-"), h("option", { value: "M" }, "男"), h("option", { value: "F" }, "女"))),
                                    h("td", { className: "p-2" }, h("select", { className: "w-full border rounded p-1", value: student.group || "", onChange: e => updateStudent(student.id, { group: e.target.value }) },
                                        h("option", { value: "" }, "-"),
                                        groups.map(group => h("option", { key: group.id, value: group.id }, group.name))
                                    )),
                                    h("td", { className: "p-2" }, h("select", { className: "w-full border rounded p-1", value: student.role || "member", onChange: e => updateStudent(student.id, { role: e.target.value }) },
                                        h("option", { value: "leader" }, "组长"),
                                        h("option", { value: "member" }, "组员")
                                    )),
                                    h("td", { className: "p-2" }, h("select", { className: "w-full border rounded p-1", value: student.dorm || "", onChange: e => updateStudent(student.id, { dorm: e.target.value }) },
                                        h("option", { value: "" }, "-"),
                                        dorms.map(dorm => h("option", { key: dorm.id, value: dorm.id }, dorm.name))
                                    )),
                                    h("td", { className: "p-2" }, h("button", { onClick: () => removeStudent(student.id), className: "px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600" }, "删除"))
                                ))
                            )
                        )
                    )
                )
            );
        };
    };
})();
