(function() {
    window.createClassManagerModal = function createClassManagerModal(deps) {
        const {
            h,
            Icon
        } = deps || {};

        if (!h || !Icon) {
            throw new Error('ClassManagerModal dependencies are missing');
        }

        return function ClassManagerModal({
            isOpen,
            title,
            children,
            onClose,
            onConfirm,
            confirmText = '确定',
            type = 'info'
        }) {
            if (!isOpen) return null;
            const colorClass = type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700';
            return h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in' },
                h('div', { className: 'bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-bounce-in flex flex-col max-h-[90vh]' },
                    h('div', { className: 'p-4 border-b flex justify-between items-center flex-shrink-0' },
                        h('h3', { className: 'font-bold text-lg' }, title),
                        h('button', { onClick: onClose, className: 'text-gray-400 hover:text-gray-600' }, h(Icon, { name: 'x' }))
                    ),
                    h('div', { className: 'p-6 overflow-y-auto flex-1' }, children),
                    h('div', { className: 'p-4 bg-gray-50 flex justify-end gap-3 flex-shrink-0' },
                        h('button', { onClick: onClose, className: 'px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg' }, '取消'),
                        onConfirm && h('button', { onClick: onConfirm, className: `px-4 py-2 text-white rounded-lg shadow-sm transition ${colorClass}` }, confirmText)
                    )
                )
            );
        };
    };
})();
