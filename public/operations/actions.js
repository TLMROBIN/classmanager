(function() {
    const toggleIdInSet = (idSet, id) => {
        const next = new Set(idSet);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    };

    const toggleFilteredStudentsInSet = ({ idSet, filteredStudents, allFilteredSelected }) => {
        const next = new Set(idSet);
        (Array.isArray(filteredStudents) ? filteredStudents : []).forEach(student => {
            if (allFilteredSelected) next.delete(student.id);
            else next.add(student.id);
        });
        return next;
    };

    window.createOperationHandlers = function createOperationHandlers(deps) {
        const {
            selectedIdsState,
            setSelectedIds,
            allFilteredSelected,
            filteredStudents,
            buildModalStudents,
            studentMap,
            opTabState,
            setBatchAdjustModal,
            normalizePointScene,
            normalizePointCategory,
            parseNumericInput,
            batchAdjustModal,
            buildBatchUpdates,
            batchUpdatePoints,
            hwSubject,
            hwDate,
            homeworkDates,
            historyList,
            subjectsConfig,
            hwSelectedIds,
            buildHomeworkUpdates,
            buildHomeworkConfirmMessage,
            setHwSelectedIds,
            setHwSubject,
            students,
            runDate,
            runSelectedAbsentIds,
            buildRunningExerciseUpdates,
            buildRunningExerciseConfirmMessage,
            setRunSelectedAbsentIds,
            runningExerciseAbsentPenalty,
            runningExercisePresentBonus,
            runningExerciseCommissionerStudentId,
            runningExerciseCommissionerBonus,
            buildHygieneUpdates,
            buildHygieneConfirmMessage,
            buildDisciplineUpdates,
            buildDisciplineConfirmMessage,
            getTodayStr,
            hygieneSession,
            hygieneSelectedIds,
            hygieneInspectorStudentIds,
            hygieneInspectorNames,
            hygieneAreaPenalty,
            hygieneInspectorBonus,
            setHygieneSelectedIds,
            disciplineDate,
            disciplineActiveTab,
            disciplineSelectedIds,
            disciplineConfig,
            disciplineCommissionerMap,
            disciplineCommissionerNamesMap,
            setDisciplineSelectedIds
        } = deps || {};

        if (
            !(selectedIdsState instanceof Set) ||
            typeof setSelectedIds !== 'function' ||
            !buildModalStudents ||
            !studentMap ||
            typeof setBatchAdjustModal !== 'function' ||
            !normalizePointScene ||
            !normalizePointCategory ||
            typeof parseNumericInput !== 'function' ||
            !buildBatchUpdates ||
            typeof batchUpdatePoints !== 'function' ||
            !buildHomeworkUpdates ||
            !buildHomeworkConfirmMessage ||
            typeof setHwSelectedIds !== 'function' ||
            typeof setHwSubject !== 'function' ||
            !buildRunningExerciseUpdates ||
            !buildRunningExerciseConfirmMessage ||
            typeof setRunSelectedAbsentIds !== 'function' ||
            !buildHygieneUpdates ||
            !buildHygieneConfirmMessage ||
            !buildDisciplineUpdates ||
            !buildDisciplineConfirmMessage ||
            typeof getTodayStr !== 'function' ||
            typeof setHygieneSelectedIds !== 'function' ||
            typeof setDisciplineSelectedIds !== 'function'
        ) {
            throw new Error('Operation action dependencies are missing');
        }

        const toggleSelection = (id) => {
            setSelectedIds(prev => toggleIdInSet(prev, id));
        };

        const toggleSelectAll = () => {
            setSelectedIds(prev => toggleFilteredStudentsInSet({
                idSet: prev,
                filteredStudents,
                allFilteredSelected
            }));
        };

        const handleReasonClick = (reason) => {
            if (selectedIdsState.size === 0) return alert("请先选择学生");
            const modalStudents = buildModalStudents({
                selectedIds: selectedIdsState,
                studentMap,
                getInitialValue: () => (reason.isMulti ? 1 : Math.abs(reason.val))
            });
            if (modalStudents.length === 0) return alert("未找到有效的学生选择");
            setBatchAdjustModal({
                open: true,
                reason,
                students: modalStudents,
                type: opTabState,
                isMulti: reason.isMulti || false,
                factor: reason.factor || 1,
                isCustom: false,
                customReasonName: "",
                scene: normalizePointScene(reason.scene),
                category: normalizePointCategory(reason.category)
            });
        };

        const handleCustomReason = () => {
            if (selectedIdsState.size === 0) return alert("请先选择学生");
            const modalStudents = buildModalStudents({
                selectedIds: selectedIdsState,
                studentMap,
                getInitialValue: () => 0
            });
            if (modalStudents.length === 0) return alert("未找到有效的学生选择");
            setBatchAdjustModal({
                open: true,
                reason: { name: "", custom: true },
                students: modalStudents,
                type: opTabState,
                isMulti: false,
                factor: 1,
                isCustom: true,
                customReasonName: "",
                scene: "班级",
                category: "兑奖"
            });
        };

        const updateStudentBatchValue = (id, newVal) => {
            setBatchAdjustModal(prev => ({
                ...prev,
                students: prev.students.map(student => (
                    student.id === id ? { ...student, val: parseNumericInput(newVal) } : student
                ))
            }));
        };

        const updateAllBatchValues = (newVal) => {
            const numericValue = parseNumericInput(newVal);
            setBatchAdjustModal(prev => ({
                ...prev,
                students: prev.students.map(student => ({ ...student, val: numericValue }))
            }));
        };

        const handleBatchConfirm = () => {
            if (batchAdjustModal.isCustom && !batchAdjustModal.customReasonName) return alert("请输入理由");
            if (!batchAdjustModal.scene || !batchAdjustModal.category) return alert("请先选择场景与类别");

            const updates = buildBatchUpdates({
                modalState: batchAdjustModal,
                normalizePointScene,
                normalizePointCategory
            });

            batchUpdatePoints(updates);
            setBatchAdjustModal(prev => ({ ...prev, open: false }));
            setSelectedIds(new Set());
        };

        const toggleHomeworkSelection = (id) => {
            setHwSelectedIds(prev => toggleIdInSet(prev, id));
        };

        const handleHomeworkSubmit = () => {
            if (!hwSubject) return alert("请选择学科");
            const dateVal = hwDate || homeworkDates[0];
            if (!dateVal) return alert("请选择日期");

            const alreadySubmitted = (Array.isArray(historyList) ? historyList : []).some(item => (
                item.reason && item.reason.includes(`${hwSubject}作业`) && item.reason.includes(dateVal)
            ));
            if (alreadySubmitted) {
                return alert(`${hwSubject} ${dateVal} 已完成登记，每科每天只能登记一次`);
            }

            const subjectConfig = (Array.isArray(subjectsConfig) ? subjectsConfig : []).find(subject => subject.name === hwSubject);
            const representatives = subjectConfig?.representatives || [];
            const updates = buildHomeworkUpdates({
                hwSubject,
                dateVal,
                hwSelectedIds,
                representatives,
                studentMap
            });

            if (updates.length === 0) {
                return alert("没有需要登记的记录。请确保已设置课代表。");
            }

            const confirmMsg = buildHomeworkConfirmMessage({
                hwSubject,
                dateVal,
                hwSelectedIds,
                representatives,
                studentMap
            });

            if (!confirm(confirmMsg)) return;

            batchUpdatePoints(updates);
            setHwSelectedIds(new Set());
            setHwSubject("");
        };

        const toggleRunningExerciseSelection = (id) => {
            setRunSelectedAbsentIds(prev => toggleIdInSet(prev, id));
        };

        const toggleHygieneSelection = (id) => {
            setHygieneSelectedIds(prev => toggleIdInSet(prev, id));
        };

        const handleHygieneSubmit = () => {
            if (!hygieneSession) return alert("当前非卫生登记时段");
            const dateVal = getTodayStr();
            if (!dateVal) return alert("无法确定当前日期");

            const alreadySubmitted = (Array.isArray(historyList) ? historyList : []).some(item => (
                item.reason && (
                    item.reason.includes(`${dateVal} ${hygieneSession.name} 卫生登记`) ||
                    item.reason.includes(`${dateVal} ${hygieneSession.name} 卫生不达标`)
                )
            ));
            if (alreadySubmitted) {
                return alert(`${dateVal} ${hygieneSession.name} 已完成卫生登记，每个时段每天只能登记一次`);
            }

            const updates = buildHygieneUpdates({
                date: dateVal,
                sessionName: hygieneSession.name,
                inspectorStudentIds: hygieneInspectorStudentIds,
                selectedIds: hygieneSelectedIds,
                areaPenalty: hygieneAreaPenalty,
                inspectorBonus: hygieneInspectorBonus
            });

            if (updates.length === 0) {
                return alert("当前卫生登记不会产生积分变动，请检查专员是否已设置。");
            }

            const confirmMsg = buildHygieneConfirmMessage({
                date: dateVal,
                sessionName: hygieneSession.name,
                inspectorNames: hygieneInspectorNames,
                selectedIds: hygieneSelectedIds,
                studentMap,
                areaPenalty: hygieneAreaPenalty,
                inspectorBonus: hygieneInspectorBonus
            });
            if (!confirm(confirmMsg)) return;

            batchUpdatePoints(updates);
            setHygieneSelectedIds(new Set());
        };

        const toggleDisciplineSelection = (id) => {
            setDisciplineSelectedIds(prev => toggleIdInSet(prev, id));
        };

        const handleDisciplineSubmit = () => {
            const dateVal = disciplineDate;
            if (!dateVal) return alert("请选择日期");

            const tabConfig = disciplineConfig[disciplineActiveTab];
            if (!tabConfig) return alert("请选择登记理由");

            const reasonLabels = {
                noise: '学习时间讲话',
                desk: '桌面杂乱',
                tablet: '平板未归',
                outdoor: '晚自习外出'
            };
            const reasonLabel = reasonLabels[disciplineActiveTab];

            const alreadySubmitted = (Array.isArray(historyList) ? historyList : []).some(item => (
                item.reason && item.reason.includes(`${dateVal} ${reasonLabel}`)
            ));
            if (alreadySubmitted) {
                return alert(`${dateVal} ${reasonLabel} 已完成登记，每天同一理由只能登记一次`);
            }

            const commissionerIds = Array.isArray(disciplineCommissionerMap[disciplineActiveTab])
                ? disciplineCommissionerMap[disciplineActiveTab]
                : [];

            const updates = buildDisciplineUpdates({
                date: dateVal,
                reasonKey: disciplineActiveTab,
                reasonLabel,
                commissionerStudentIds: commissionerIds,
                selectedIds: disciplineSelectedIds,
                penalty: tabConfig.penalty,
                commissionerBonus: tabConfig.commissionerBonus
            });

            if (updates.length === 0) {
                return alert("当前纪律登记不会产生积分变动，请检查专员是否已设置。");
            }

            const confirmMsg = buildDisciplineConfirmMessage({
                date: dateVal,
                reasonLabel,
                commissionerNames: disciplineCommissionerNamesMap[disciplineActiveTab] || [],
                selectedIds: disciplineSelectedIds,
                studentMap,
                penalty: tabConfig.penalty,
                commissionerBonus: tabConfig.commissionerBonus
            });
            if (!confirm(confirmMsg)) return;

            batchUpdatePoints(updates);
            setDisciplineSelectedIds(new Set());
        };

        const handleRunningExerciseSubmit = () => {
            const dateVal = runDate || homeworkDates[0];
            if (!dateVal) return alert("请选择日期");

            const alreadySubmitted = (Array.isArray(historyList) ? historyList : []).some(item => (
                item.reason && item.reason.includes(dateVal) && item.reason.includes('跑操')
            ));
            if (alreadySubmitted) {
                return alert(`${dateVal} 已完成跑操登记，每天只能登记一次`);
            }

            const updates = buildRunningExerciseUpdates({
                students,
                dateVal,
                absentIds: runSelectedAbsentIds,
                absentPenalty: runningExerciseAbsentPenalty,
                presentBonus: runningExercisePresentBonus,
                commissionerId: runningExerciseCommissionerStudentId,
                commissionerBonus: runningExerciseCommissionerBonus
            });
            if (updates.length === 0) {
                return alert("当前跑操登记不会产生积分变动，请先在积分操作设置里调整跑操分值。");
            }

            const confirmMsg = buildRunningExerciseConfirmMessage({
                students,
                dateVal,
                absentIds: runSelectedAbsentIds,
                studentMap,
                absentPenalty: runningExerciseAbsentPenalty,
                presentBonus: runningExercisePresentBonus,
                commissionerId: runningExerciseCommissionerStudentId,
                commissionerBonus: runningExerciseCommissionerBonus
            });
            if (!confirm(confirmMsg)) return;

            batchUpdatePoints(updates);
            setRunSelectedAbsentIds(new Set());
        };

        return {
            toggleSelection,
            toggleSelectAll,
            handleReasonClick,
            handleCustomReason,
            updateStudentBatchValue,
            updateAllBatchValues,
            handleBatchConfirm,
            toggleHomeworkSelection,
            handleHomeworkSubmit,
            toggleRunningExerciseSelection,
            handleRunningExerciseSubmit,
            toggleHygieneSelection,
            handleHygieneSubmit,
            toggleDisciplineSelection,
            handleDisciplineSubmit
        };
    };
})();
