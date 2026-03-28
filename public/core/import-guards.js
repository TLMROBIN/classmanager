(function() {
    const KB = 1024;
    const MB = 1024 * KB;
    const DEFAULT_MAX_FILE_BYTES = 5 * MB;
    const DEFAULT_MAX_SHEETS = 4;
    const DEFAULT_MAX_ROWS = 1000;

    const formatFileSize = (bytes) => {
        if (!Number.isFinite(bytes) || bytes <= 0) return '0B';
        if (bytes >= MB) return `${(bytes / MB).toFixed(bytes % MB === 0 ? 0 : 1)}MB`;
        if (bytes >= KB) return `${(bytes / KB).toFixed(bytes % KB === 0 ? 0 : 1)}KB`;
        return `${bytes}B`;
    };

    const buildImportError = (label, message) => new Error(`${label}失败：${message}`);

    const validateSpreadsheetFile = ({ file, label = '导入 Excel', maxFileBytes = DEFAULT_MAX_FILE_BYTES }) => {
        if (!file) {
            throw buildImportError(label, '未选择文件');
        }
        if (!/\.(xlsx|xls)$/i.test(String(file.name || ''))) {
            throw buildImportError(label, '仅支持 .xlsx 或 .xls 文件');
        }
        if (Number(file.size) > maxFileBytes) {
            throw buildImportError(label, `文件过大，最多支持 ${formatFileSize(maxFileBytes)}`);
        }
    };

    const readWorkbookFromFile = ({
        file,
        xlsx,
        label = '导入 Excel',
        maxFileBytes = DEFAULT_MAX_FILE_BYTES,
        maxSheets = DEFAULT_MAX_SHEETS
    }) => new Promise((resolve, reject) => {
        try {
            validateSpreadsheetFile({ file, label, maxFileBytes });
        } catch (error) {
            reject(error);
            return;
        }

        if (!xlsx?.utils || typeof xlsx.read !== 'function') {
            reject(buildImportError(label, '导入组件未加载，请刷新后重试'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const workbook = xlsx.read(evt.target.result, { type: 'array' });
                const sheetNames = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];
                if (sheetNames.length === 0) {
                    throw buildImportError(label, 'Excel 中没有可读取的工作表');
                }
                if (sheetNames.length > maxSheets) {
                    throw buildImportError(label, `工作表过多，最多允许 ${maxSheets} 个`);
                }
                resolve(workbook);
            } catch (error) {
                reject(error instanceof Error ? error : buildImportError(label, 'Excel 解析失败'));
            }
        };
        reader.onerror = () => reject(buildImportError(label, '读取文件失败，请重试'));
        reader.readAsArrayBuffer(file);
    });

    const getFirstWorksheet = (workbook, label = '导入 Excel') => {
        const firstSheetName = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames[0] : null;
        const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
        if (!sheet) {
            throw buildImportError(label, '缺少可读取的首个工作表');
        }
        return sheet;
    };

    const assertWorksheetRows = (rows, options = {}) => {
        const {
            label = '导入 Excel',
            maxRows = DEFAULT_MAX_ROWS,
            allowEmpty = false,
            emptyMessage = `${label}失败：未解析到有效记录`
        } = options;
        const safeRows = Array.isArray(rows) ? rows : [];
        if (safeRows.length === 0) {
            if (allowEmpty) return safeRows;
            throw new Error(emptyMessage);
        }
        if (safeRows.length > maxRows) {
            throw buildImportError(label, `记录过多，最多允许 ${maxRows} 行`);
        }
        return safeRows;
    };

    window.ClassManagerImportGuards = {
        readWorkbookFromFile,
        getFirstWorksheet,
        assertWorksheetRows,
        formatFileSize
    };
})();
