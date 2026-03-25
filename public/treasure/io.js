(function() {
    window.createTreasureIo = function createTreasureIo(deps) {
        const { getTodayStr } = deps || {};

        if (!getTodayStr) {
            throw new Error('Treasure IO dependencies are missing');
        }

        const sameId = (left, right) => String(left) === String(right);
        const hasValue = (value) => value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');
        const getCell = (row, keys) => {
            const source = row || {};
            for (const key of keys) {
                if (Object.prototype.hasOwnProperty.call(source, key) && hasValue(source[key])) {
                    return source[key];
                }
            }
            return undefined;
        };
        const toNumber = (value, fallback = 0) => {
            const parsed = parseFloat(value);
            return Number.isNaN(parsed) ? fallback : parsed;
        };
        const toInteger = (value, fallback = 0) => {
            const parsed = parseInt(value, 10);
            return Number.isNaN(parsed) ? fallback : parsed;
        };
        const parseLadderPrices = (value) => {
            if (Array.isArray(value)) {
                return value
                    .map(item => toNumber(item, NaN))
                    .filter(item => !Number.isNaN(item));
            }
            if (!hasValue(value)) return [];
            if (typeof value === 'number') return Number.isNaN(value) ? [] : [value];

            const text = String(value).trim();
            if (!text) return [];

            if (text.startsWith('[') && text.endsWith(']')) {
                try {
                    const parsed = JSON.parse(text);
                    if (Array.isArray(parsed)) return parseLadderPrices(parsed);
                } catch (err) {
                    console.warn('解析阶梯价格 JSON 失败:', err);
                }
            }

            return text
                .split(/[,\uFF0C\u3001\s]+/)
                .map(item => toNumber(item.trim(), NaN))
                .filter(item => !Number.isNaN(item));
        };
        const serializeLadderPrices = (value) => parseLadderPrices(value).join(',');
        const TREASURE_EXPORT_HEADERS = ["宝物ID", "名称", "稀有度", "基础价格", "阶梯价格", "库存", "单日使用上限", "描述"];
        const STORAGE_EXPORT_HEADERS = ["学生ID", "学生", "宝物ID", "物品", "数量"];

        const exportTreasureExcel = ({ treasures, storage, students }) => {
            const xlsx = window.XLSX;
            if (!xlsx?.utils || typeof xlsx.writeFile !== 'function') {
                alert("导出组件未加载，请刷新后重试");
                return;
            }

            const treasureRows = (Array.isArray(treasures) ? treasures : []).map(item => ({
                "宝物ID": item.id,
                "名称": item.name || "",
                "稀有度": item.rarity || "N",
                "基础价格": toNumber(item.price, 0),
                "阶梯价格": serializeLadderPrices(item.ladderPrices),
                "库存": toInteger(item.stock, 0),
                "单日使用上限": toInteger(item.dailyLimit, 0),
                "描述": item.desc || ""
            }));
            const storageRows = [];
            Object.entries(storage || {}).forEach(([studentId, studentStorage]) => {
                const student = (students || []).find(item => sameId(item.id, studentId));
                Object.entries(studentStorage || {}).forEach(([itemId, count]) => {
                    if (toInteger(count, 0) <= 0) return;
                    const treasure = (treasures || []).find(item => sameId(item.id, itemId));
                    storageRows.push({
                        "学生ID": student?.id ?? studentId,
                        "学生": student?.name || "",
                        "宝物ID": treasure?.id ?? itemId,
                        "物品": treasure?.name || "",
                        "数量": toInteger(count, 0)
                    });
                });
            });

            const workbook = xlsx.utils.book_new();
            const treasureSheet = xlsx.utils.json_to_sheet(treasureRows, { header: TREASURE_EXPORT_HEADERS });
            const storageSheet = xlsx.utils.json_to_sheet(storageRows, { header: STORAGE_EXPORT_HEADERS });
            treasureSheet["!cols"] = [
                { wch: 16 },
                { wch: 18 },
                { wch: 10 },
                { wch: 12 },
                { wch: 18 },
                { wch: 10 },
                { wch: 14 },
                { wch: 28 }
            ];
            storageSheet["!cols"] = [
                { wch: 16 },
                { wch: 14 },
                { wch: 16 },
                { wch: 18 },
                { wch: 10 }
            ];
            xlsx.utils.book_append_sheet(workbook, treasureSheet, "宝物库存");
            xlsx.utils.book_append_sheet(workbook, storageSheet, "学生储物箱");
            xlsx.writeFile(workbook, `藏宝阁数据_${getTodayStr()}.xlsx`);
        };

        const importTreasureExcel = ({ event, students, onImportTreasureData }) => {
            const file = event?.target?.files?.[0];
            if (!file) return;
            if (typeof onImportTreasureData !== 'function') {
                alert("导入功能不可用");
                event.target.value = '';
                return;
            }

            const xlsx = window.XLSX;
            if (!xlsx?.utils || typeof xlsx.read !== 'function') {
                alert("导入组件未加载，请刷新后重试");
                event.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const workbook = xlsx.read(evt.target.result, { type: 'array' });
                    if (!workbook.SheetNames.includes("宝物库存")) {
                        throw new Error('缺少“宝物库存”工作表');
                    }

                    const rawTreasureRows = xlsx.utils.sheet_to_json(workbook.Sheets["宝物库存"], { defval: "" });
                    const importedTreasures = rawTreasureRows.map((row, index) => {
                        const idCell = getCell(row, ["宝物ID", "物品ID", "id", "ID"]);
                        const priceCell = getCell(row, ["基础价格", "价格", "price"]);
                        const stockCell = getCell(row, ["库存", "stock"]);
                        const dailyLimitCell = getCell(row, ["单日使用上限", "dailyLimit"]);
                        const descCell = getCell(row, ["描述", "desc"]);
                        const ladderPricesCell = getCell(row, ["阶梯价格", "ladderPrices"]);
                        const name = String(getCell(row, ["名称", "name"]) || "").trim();
                        const rarity = String(getCell(row, ["稀有度", "rarity"]) || "N").trim() || "N";
                        const price = toNumber(priceCell, 0);
                        const stock = toInteger(stockCell, 0);
                        const dailyLimit = toInteger(dailyLimitCell, 0);
                        const desc = String(descCell || "").trim();
                        const ladderPrices = parseLadderPrices(ladderPricesCell);
                        const isBlankRow = !name && !hasValue(idCell) && !hasValue(priceCell) && !hasValue(stockCell) && !hasValue(dailyLimitCell) && !hasValue(descCell) && !hasValue(ladderPricesCell);
                        if (isBlankRow) return null;

                        return {
                            id: hasValue(idCell) ? idCell : `${Date.now()}_${index}`,
                            name,
                            rarity,
                            price,
                            stock,
                            desc,
                            ladderPrices,
                            dailyLimit
                        };
                    }).filter(item => item && item.name);

                    if (importedTreasures.length === 0) {
                        throw new Error('未解析到有效的宝物记录');
                    }

                    const rawStorageRows = workbook.SheetNames.includes("学生储物箱")
                        ? xlsx.utils.sheet_to_json(workbook.Sheets["学生储物箱"], { defval: "" })
                        : [];
                    const nextStorage = {};
                    let skippedStorageRows = 0;

                    rawStorageRows.forEach((row) => {
                        const count = toInteger(getCell(row, ["数量", "count"]), 0);
                        if (count <= 0) return;

                        const studentIdCell = getCell(row, ["学生ID", "studentId"]);
                        const studentName = String(getCell(row, ["学生", "student", "studentName", "姓名"]) || "").trim();
                        const student = (students || []).find(item => {
                            if (hasValue(studentIdCell) && sameId(item.id, studentIdCell)) return true;
                            return studentName && item.name === studentName;
                        });
                        if (!student) {
                            skippedStorageRows += 1;
                            return;
                        }

                        const itemIdCell = getCell(row, ["宝物ID", "物品ID", "itemId", "id"]);
                        const itemName = String(getCell(row, ["物品", "名称", "itemName", "name"]) || "").trim();
                        let treasure = null;
                        if (hasValue(itemIdCell)) {
                            treasure = importedTreasures.find(item => sameId(item.id, itemIdCell)) || null;
                        }
                        if (!treasure && itemName) {
                            treasure = importedTreasures.find(item => item.name === itemName) || null;
                        }
                        if (!treasure) {
                            skippedStorageRows += 1;
                            return;
                        }

                        if (!nextStorage[student.id]) nextStorage[student.id] = {};
                        nextStorage[student.id][treasure.id] = (nextStorage[student.id][treasure.id] || 0) + count;
                    });

                    const result = onImportTreasureData({
                        treasures: importedTreasures,
                        storage: nextStorage
                    });
                    if (!result?.ok) {
                        throw new Error(result?.message || '藏宝阁数据导入失败');
                    }

                    const storageStudentCount = Object.keys(nextStorage).length;
                    const skipSuffix = skippedStorageRows > 0 ? `，跳过 ${skippedStorageRows} 条无法匹配学生或宝物的储物箱记录` : "";
                    alert(`已导入 ${importedTreasures.length} 条宝物记录，更新 ${storageStudentCount} 名学生的储物箱${skipSuffix}`);
                } catch (err) {
                    console.error('导入藏宝阁数据失败:', err);
                    alert(err?.message || '导入失败，请检查 Excel 格式');
                } finally {
                    event.target.value = '';
                }
            };
            reader.onerror = () => {
                alert("读取文件失败，请重试");
                event.target.value = '';
            };
            reader.readAsArrayBuffer(file);
        };

        return {
            exportTreasureExcel,
            importTreasureExcel
        };
    };
})();
