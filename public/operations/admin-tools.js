(function() {
    window.createOperationAdminTools = function createOperationAdminTools(deps) {
        const { getTodayStr } = deps || {};

        if (!getTodayStr) {
            throw new Error('Operation admin tools dependencies are missing');
        }

        const exportScoreExcel = ({ students, groupsConfig, dormsConfig, scoreNames = {} }) => {
            const xlsx = window.XLSX;
            if (!xlsx?.utils || typeof xlsx.writeFile !== 'function') {
                alert("导出组件未加载，请刷新后重试");
                return;
            }

            const bonusHeader = scoreNames.bonus || "自在值";
            const penaltyHeader = scoreNames.penalty || "不自在值";
            const safeBonusHeader = ["姓名", "小组", "职位", "宿舍", "余额", penaltyHeader].includes(bonusHeader) ? `${bonusHeader}（加分）` : bonusHeader;
            const safePenaltyHeader = ["姓名", "小组", "职位", "宿舍", "余额", safeBonusHeader].includes(penaltyHeader) ? `${penaltyHeader}（扣分）` : penaltyHeader;
            const rows = (Array.isArray(students) ? students : []).map(student => ({
                "姓名": student.name,
                "小组": groupsConfig?.[student.group]?.name || student.group || "",
                "职位": student.role === 'leader' ? '组长' : '组员',
                "宿舍": dormsConfig?.[student.dorm] || student.dorm || "",
                [safeBonusHeader]: Number(student.zizai) || 0,
                "余额": Number(student.balance) || 0,
                [safePenaltyHeader]: Number(student.penalty) || 0
            }));
            const ws = xlsx.utils.json_to_sheet(rows);
            const wb = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(wb, ws, "积分表");
            xlsx.writeFile(wb, `积分表_${getTodayStr()}.xlsx`);
        };

        const fixScore = ({ students, applyStudents, scoreNames = {} }) => {
            const name = prompt("输入要修正积分的学生姓名（如：陈正岳）：");
            if (!name || !name.trim()) return { ok: false, message: "已取消" };

            const student = (Array.isArray(students) ? students : []).find(item => item.name.trim() === name.trim());
            if (!student) {
                alert("未找到该学生");
                return { ok: false, message: "未找到该学生" };
            }

            const zizaiStr = prompt(`${scoreNames.bonus || "自在值"}（直接回车则不修改）`, String(student.zizai ?? 0));
            const balanceStr = prompt("余额（直接回车则不修改）", String(student.balance ?? 0));
            const penaltyStr = prompt(`${scoreNames.penalty || "不自在值"}（直接回车则不修改）`, String(student.penalty ?? 0));
            const nextZizai = zizaiStr === "" || zizaiStr === null ? student.zizai : Number(zizaiStr);
            const nextBalance = balanceStr === "" || balanceStr === null ? student.balance : Number(balanceStr);
            const nextPenalty = penaltyStr === "" || penaltyStr === null ? student.penalty : Number(penaltyStr);
            if (Number.isNaN(nextZizai) || Number.isNaN(nextBalance) || Number.isNaN(nextPenalty)) {
                alert("请输入有效数字");
                return { ok: false, message: "输入无效" };
            }

            const nextStudents = students.map(item => (
                item.id !== student.id
                    ? item
                    : { ...item, zizai: nextZizai, balance: nextBalance, penalty: nextPenalty }
            ));

            const confirmApplied = () => {
                alert("已修正并保存");
                return { ok: true };
            };
            if (typeof applyStudents !== 'function') return { ok: false, message: "保存接口未就绪" };
            const applyResult = applyStudents(nextStudents);
            if (applyResult && typeof applyResult.then === 'function') {
                return Promise.resolve(applyResult).then(confirmApplied);
            }
            return confirmApplied();
        };

        return {
            exportScoreExcel,
            fixScore
        };
    };
})();
