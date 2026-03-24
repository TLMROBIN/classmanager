(function() {
    const DEFAULT_UI_STATE = {
        selectedIds: [],
        filterGroup: 'all',
        filterDorm: 'all',
        opTab: 'bonus'
    };

    const getUiStore = () => {
        if (!window.__CM_OPERATIONS_UI_STATE__ || typeof window.__CM_OPERATIONS_UI_STATE__ !== 'object') {
            window.__CM_OPERATIONS_UI_STATE__ = { ...DEFAULT_UI_STATE };
        }
        return window.__CM_OPERATIONS_UI_STATE__;
    };

    const readUiState = () => {
        const store = getUiStore();
        return {
            selectedIds: Array.isArray(store.selectedIds) ? store.selectedIds : DEFAULT_UI_STATE.selectedIds,
            filterGroup: typeof store.filterGroup === 'string' && store.filterGroup ? store.filterGroup : DEFAULT_UI_STATE.filterGroup,
            filterDorm: typeof store.filterDorm === 'string' && store.filterDorm ? store.filterDorm : DEFAULT_UI_STATE.filterDorm,
            opTab: store.opTab === 'penalty' ? 'penalty' : DEFAULT_UI_STATE.opTab
        };
    };

    const writeUiState = (patch) => {
        window.__CM_OPERATIONS_UI_STATE__ = {
            ...readUiState(),
            ...(patch || {})
        };
    };

    const setsAreEqual = (left, right) => {
        if (left.size !== right.size) return false;
        for (const value of left) {
            if (!right.has(value)) return false;
        }
        return true;
    };

    const parseNumericInput = (value) => {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    window.OperationUiState = {
        DEFAULT_UI_STATE,
        readUiState,
        writeUiState,
        setsAreEqual,
        parseNumericInput
    };
})();
