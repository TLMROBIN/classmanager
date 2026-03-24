(function() {
    const buildModalStudents = ({ selectedIds, studentMap, getInitialValue }) => (
        Array.from(selectedIds || [])
            .map(id => studentMap.get(String(id)))
            .filter(Boolean)
            .map(student => ({
                id: student.id,
                name: student.name,
                val: getInitialValue(student)
            }))
    );

    const buildBatchUpdates = ({ modalState, normalizePointScene, normalizePointCategory }) => {
        const reasonName = modalState.isCustom ? modalState.customReasonName : modalState.reason.name;
        return (Array.isArray(modalState.students) ? modalState.students : []).map(student => {
            let finalVal = Number.isFinite(Number(student.val)) ? Number(student.val) : 0;
            let finalReason = reasonName;
            if (modalState.isMulti) {
                finalVal = finalVal * modalState.factor;
                finalReason = reasonName.includes("卫生")
                    ? `${reasonName} x${student.val}`
                    : `${reasonName} (值:${student.val})`;
            }
            if (modalState.type === 'penalty') finalVal = -Math.abs(finalVal);
            else finalVal = Math.abs(finalVal);
            return {
                id: student.id,
                val: finalVal,
                reason: finalReason,
                type: modalState.type,
                scene: normalizePointScene(modalState.scene),
                category: normalizePointCategory(modalState.category)
            };
        });
    };

    const buildHomeworkUpdates = ({ hwSubject, dateVal, hwSelectedIds, representatives, studentMap }) => {
        const updates = [];

        Array.from(hwSelectedIds || []).forEach(id => {
            updates.push({
                id,
                val: -1,
                reason: `${hwSubject}作业未交 ${dateVal}`,
                type: 'penalty',
                scene: "班级",
                category: "学业"
            });
        });

        (Array.isArray(representatives) ? representatives : []).forEach(repId => {
            if (!repId || !studentMap.has(String(repId))) return;
            updates.push({
                id: repId,
                val: 1,
                reason: `${hwSubject}作业登记 ${dateVal}`,
                type: 'bonus',
                scene: "班级",
                category: "班务"
            });
        });

        return updates;
    };

    const buildHomeworkConfirmMessage = ({ hwSubject, dateVal, hwSelectedIds, representatives, studentMap }) => {
        const repNames = (Array.isArray(representatives) ? representatives : [])
            .map(repId => studentMap.get(String(repId))?.name || '')
            .filter(Boolean)
            .join('、');

        let confirmMsg = `确认提交 ${hwSubject} ${dateVal} 的作业登记？\n\n`;
        confirmMsg += "⚠️ 提醒：每科每天只能登记一次，请确保无误再提交！\n\n";

        if ((hwSelectedIds || new Set()).size > 0) {
            const unsubmittedStudents = Array.from(hwSelectedIds)
                .map(id => studentMap.get(String(id))?.name || '')
                .filter(Boolean)
                .join('、');
            confirmMsg += `未交作业学生 (${hwSelectedIds.size}人)：\n${unsubmittedStudents}\n\n`;
        } else {
            confirmMsg += "✅ 无学生未交作业\n\n";
        }

        if (repNames) {
            confirmMsg += `课代表加分：${repNames} (+1分)`;
        }

        return confirmMsg;
    };

    window.OperationBuilders = {
        buildModalStudents,
        buildBatchUpdates,
        buildHomeworkUpdates,
        buildHomeworkConfirmMessage
    };
})();
