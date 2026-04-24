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

    const buildRunningExerciseUpdates = ({
        students,
        dateVal,
        absentIds,
        absentPenalty,
        presentBonus,
        commissionerId,
        commissionerBonus
    }) => {
        const studentList = Array.isArray(students) ? students : [];
        const absentIdSet = absentIds instanceof Set ? absentIds : new Set(absentIds || []);
        const updates = [];
        const normalizedAbsentPenalty = Math.abs(Number(absentPenalty) || 0);
        const normalizedPresentBonus = Math.abs(Number(presentBonus) || 0);
        const normalizedCommissionerId = commissionerId == null || commissionerId === ''
            ? null
            : String(commissionerId);
        const normalizedCommissionerBonus = Math.abs(Number(commissionerBonus) || 0);

        studentList.forEach(student => {
            if (!student || student.id == null) return;
            if (absentIdSet.has(student.id)) {
                if (normalizedAbsentPenalty === 0) return;
                updates.push({
                    id: student.id,
                    val: -normalizedAbsentPenalty,
                    reason: `${dateVal} 跑操缺勤`,
                    type: 'penalty',
                    scene: '班级',
                    category: '出勤'
                });
                return;
            }

            if (normalizedPresentBonus === 0) return;
            updates.push({
                id: student.id,
                val: normalizedPresentBonus,
                reason: `${dateVal} 跑操出勤`,
                type: 'bonus',
                scene: '班级',
                category: '出勤'
            });
        });

        if (normalizedCommissionerId != null && normalizedCommissionerBonus > 0) {
            const commissioner = studentList.find(student => String(student?.id) === normalizedCommissionerId);
            if (commissioner) {
                updates.push({
                    id: commissioner.id,
                    val: normalizedCommissionerBonus,
                    reason: `${dateVal} 跑操体委登记`,
                    type: 'bonus',
                    scene: '班级',
                    category: '班务'
                });
            }
        }

        return updates;
    };

    const buildRunningExerciseConfirmMessage = ({
        students,
        dateVal,
        absentIds,
        studentMap,
        absentPenalty,
        presentBonus,
        commissionerId,
        commissionerBonus
    }) => {
        const studentList = Array.isArray(students) ? students : [];
        const absentIdSet = absentIds instanceof Set ? absentIds : new Set(absentIds || []);
        const absentStudents = Array.from(absentIdSet)
            .map(id => studentMap.get(String(id))?.name || '')
            .filter(Boolean);
        const presentCount = studentList.reduce((count, student) => (
            absentIdSet.has(student.id) ? count : count + 1
        ), 0);
        const normalizedAbsentPenalty = Math.abs(Number(absentPenalty) || 0);
        const normalizedPresentBonus = Math.abs(Number(presentBonus) || 0);
        const commissionerName = commissionerId == null || commissionerId === ''
            ? ''
            : (studentMap.get(String(commissionerId))?.name || '');
        const normalizedCommissionerBonus = Math.abs(Number(commissionerBonus) || 0);

        let confirmMsg = `确认提交 ${dateVal} 的跑操考勤登记？\n\n`;
        confirmMsg += "⚠️ 提醒：每天只能登记一次，请确认缺勤名单后再提交。\n\n";

        if (absentStudents.length > 0) {
            confirmMsg += `缺勤学生 (${absentStudents.length}人)：\n${absentStudents.join('、')}\n`;
        } else {
            confirmMsg += "缺勤学生：无\n";
        }

        if (normalizedAbsentPenalty > 0) {
            confirmMsg += `缺勤扣分：每人 -${normalizedAbsentPenalty} 分\n`;
        } else {
            confirmMsg += "缺勤扣分：已关闭\n";
        }

        if (normalizedPresentBonus > 0) {
            confirmMsg += `正常出勤加分：其余 ${presentCount} 人，每人 +${normalizedPresentBonus} 分\n`;
        } else {
            confirmMsg += `正常出勤加分：已关闭（${presentCount} 人不加分）\n`;
        }

        if (commissionerName && normalizedCommissionerBonus > 0) {
            confirmMsg += `体委额外加分：${commissionerName} +${normalizedCommissionerBonus} 分`;
        } else {
            confirmMsg += commissionerName ? '体委额外加分：已关闭' : '体委额外加分：未设置';
        }

        return confirmMsg;
    };

    const buildHygieneUpdates = ({ date, sessionName, inspectorStudentIds, selectedIds, areaPenalty, inspectorBonus }) => {
        const updates = [];
        const dateLabel = String(date || '').trim();
        const reasonPrefix = [dateLabel, sessionName || '卫生'].filter(Boolean).join(' ');
        const normalizedPenalty = Math.abs(Number(areaPenalty) || 0);
        const normalizedBonus = Math.abs(Number(inspectorBonus) || 0);
        const idSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
        const inspectorIdSet = new Set((Array.isArray(inspectorStudentIds) ? inspectorStudentIds : [])
            .map(id => String(id || '').trim())
            .filter(Boolean));

        Array.from(idSet).forEach(id => {
            if (!id) return;
            updates.push({
                id,
                val: -normalizedPenalty,
                reason: `${reasonPrefix} 卫生不达标`,
                type: 'penalty',
                scene: '班级',
                category: '班务'
            });
        });

        if (normalizedBonus > 0) {
            inspectorIdSet.forEach((inspectorId) => {
                updates.push({
                    id: inspectorId,
                    val: normalizedBonus,
                    reason: `${reasonPrefix} 卫生登记`,
                    type: 'bonus',
                    scene: '班级',
                    category: '班务'
                });
            });
        }

        return updates;
    };

    const buildHygieneConfirmMessage = ({ date, sessionName, inspectorNames, selectedIds, studentMap, areaPenalty, inspectorBonus }) => {
        const idSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
        const normalizedPenalty = Math.abs(Number(areaPenalty) || 0);
        const normalizedBonus = Math.abs(Number(inspectorBonus) || 0);
        const names = Array.isArray(inspectorNames) ? inspectorNames.filter(Boolean) : [];
        const badStudents = Array.from(idSet)
            .map(id => studentMap.get(String(id))?.name || '')
            .filter(Boolean);

        let msg = `确认提交 ${[date, sessionName || '卫生'].filter(Boolean).join(' ')} 卫生登记？\n\n`;
        if (badStudents.length > 0) {
            msg += `不合格学生 (${badStudents.length}人)：\n${badStudents.join('、')}\n`;
            msg += `每人扣分：-${normalizedPenalty} 分\n`;
        } else {
            msg += "✅ 今日无卫生问题\n";
        }
        if (names.length > 0 && normalizedBonus > 0) {
            msg += `\n卫生专员 ${names.join('、')} 加分：各 +${normalizedBonus} 分`;
        }
        return msg;
    };

    const buildDisciplineUpdates = ({ date, reasonKey, reasonLabel, commissionerStudentIds, selectedIds, penalty, commissionerBonus }) => {
        const updates = [];
        const normalizedPenalty = Math.abs(Number(penalty) || 0);
        const normalizedBonus = Math.abs(Number(commissionerBonus) || 0);
        const idSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
        const commissionerIdSet = new Set((Array.isArray(commissionerStudentIds) ? commissionerStudentIds : [])
            .map(id => String(id || '').trim())
            .filter(Boolean));

        Array.from(idSet).forEach(id => {
            if (!id) return;
            updates.push({
                id,
                val: -normalizedPenalty,
                reason: `${date} ${reasonLabel}`,
                type: 'penalty',
                scene: '班级',
                category: '纪律'
            });
        });

        if (normalizedBonus > 0) {
            commissionerIdSet.forEach((commissionerId) => {
                updates.push({
                    id: commissionerId,
                    val: normalizedBonus,
                    reason: `${date} ${reasonLabel} 登记`,
                    type: 'bonus',
                    scene: '班级',
                    category: '纪律'
                });
            });
        }

        return updates;
    };

    const buildDisciplineConfirmMessage = ({ date, reasonLabel, commissionerNames, selectedIds, studentMap, penalty, commissionerBonus }) => {
        const idSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
        const normalizedPenalty = Math.abs(Number(penalty) || 0);
        const normalizedBonus = Math.abs(Number(commissionerBonus) || 0);
        const names = Array.isArray(commissionerNames) ? commissionerNames.filter(Boolean) : [];
        const badStudents = Array.from(idSet)
            .map(id => studentMap.get(String(id))?.name || '')
            .filter(Boolean);

        let msg = `确认提交 ${date} ${reasonLabel} 纪律登记？\n\n`;
        if (badStudents.length > 0) {
            msg += `不合格学生 (${badStudents.length}人)：\n${badStudents.join('、')}\n`;
            msg += `每人扣分：-${normalizedPenalty} 分\n`;
        } else {
            msg += `✅ ${date} ${reasonLabel} 无问题\n`;
        }
        if (names.length > 0 && normalizedBonus > 0) {
            msg += `\n专员 ${names.join('、')} 加分：各 +${normalizedBonus} 分`;
        }
        return msg;
    };

    const api = {
        buildModalStudents,
        buildBatchUpdates,
        buildHomeworkUpdates,
        buildHomeworkConfirmMessage,
        buildRunningExerciseUpdates,
        buildRunningExerciseConfirmMessage,
        buildHygieneUpdates,
        buildHygieneConfirmMessage,
        buildDisciplineUpdates,
        buildDisciplineConfirmMessage
    };

    if (typeof window !== 'undefined') {
        window.OperationBuilders = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();
