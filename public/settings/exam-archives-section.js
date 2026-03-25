(function() {
    window.createSettingsExamArchivesSection = function createSettingsExamArchivesSection(deps) {
        const { h, Icon } = deps || {};

        if (!h || !Icon) {
            throw new Error('Settings exam archives section dependencies are missing');
        }

        return function renderSettingsExamArchivesSection(props) {
            const {
                examArchivesModuleStatus,
                showExamArchivesManager,
                openExamArchivesManager,
                setExamArchivesModuleStatus,
                ensureExamArchivesModule,
                ExamArchivesView,
                students,
                battle,
                examArchives,
                setBattle,
                setExamArchives,
                persistExamArchives
            } = props || {};

            return h("div", { className: "border-t pt-6 space-y-4 min-w-0" },
                h("div", { className: "border rounded-xl p-4 bg-indigo-50 border-indigo-100" },
                    h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between" },
                        h("div", null,
                            h("h3", { className: "font-bold text-indigo-800 mb-1 flex items-center gap-2" }, h(Icon, { name: "fileText" }), "考试档案"),
                            h("p", { className: "text-sm text-indigo-700/80" }, "考试成绩导入、模板下载、删除和档案查看统一收在这里。模块默认不加载，点开后才按需加载。")
                        ),
                        h("button", {
                            onClick: openExamArchivesManager,
                            className: "px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium"
                        }, showExamArchivesManager ? "收起考试档案" : "打开考试档案")
                    )
                ),
                showExamArchivesManager && (
                    examArchivesModuleStatus === 'ready' && ExamArchivesView
                        ? h(ExamArchivesView, {
                            students,
                            battle,
                            examArchives,
                            setBattle,
                            setExamArchives,
                            persistExamArchives
                        })
                        : h("div", { className: "border rounded-xl p-6 bg-gray-50 text-center space-y-2" },
                            h("div", { className: "font-bold text-gray-800" }, examArchivesModuleStatus === 'error' ? "考试档案模块加载失败" : "考试档案模块加载中"),
                            h("div", { className: "text-sm text-gray-500" }, examArchivesModuleStatus === 'error' ? "请重试加载考试档案模块。" : "首次打开维护页中的考试档案时会按需加载。"),
                            examArchivesModuleStatus === 'error' && h("button", {
                                onClick: () => {
                                    setExamArchivesModuleStatus('idle');
                                    setTimeout(ensureExamArchivesModule, 0);
                                },
                                className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            }, "重试")
                        )
                )
            );
        };
    };
})();
