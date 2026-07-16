(function() {
    window.createClassManagerModal = function createClassManagerModal(deps) {
        const {
            h,
            Icon,
            useEffect,
            useRef
        } = deps || {};

        if (!h || !Icon || !useEffect || !useRef) {
            throw new Error('ClassManagerModal dependencies are missing');
        }

        return function ClassManagerModal({
            isOpen,
            title,
            children,
            onClose,
            onConfirm,
            confirmText = '确定',
            type = 'info',
            panelClassName = '',
            headerClassName = '',
            bodyClassName = '',
            footerClassName = '',
            titleClassName = '',
            closeButtonClassName = '',
            overlayClassName = '',
            cancelButtonClassName = '',
            confirmButtonClassName = '',
            overlayStyle = null,
            panelStyle = null,
            headerStyle = null,
            bodyStyle = null,
            footerStyle = null,
            confirmDisabled = false,
            confirmBusy = false,
            dismissDisabled = false
        }) {
            const panelRef = useRef(null);
            const previousFocusRef = useRef(null);
            const onCloseRef = useRef(onClose);
            const dismissDisabledRef = useRef(dismissDisabled);
            const titleIdRef = useRef(`classmanager-modal-title-${Math.random().toString(36).slice(2)}`);
            onCloseRef.current = onClose;
            dismissDisabledRef.current = dismissDisabled;

            useEffect(() => {
                if (!isOpen) return undefined;
                previousFocusRef.current = document.activeElement;
                const panel = panelRef.current;
                const focusableSelector = [
                    'button:not([disabled])',
                    'input:not([disabled])',
                    'select:not([disabled])',
                    'textarea:not([disabled])',
                    '[href]',
                    '[tabindex]:not([tabindex="-1"])'
                ].join(',');
                const focusable = panel ? Array.from(panel.querySelectorAll(focusableSelector)) : [];
                (focusable[0] || panel)?.focus();

                const handleKeyDown = (event) => {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        if (!dismissDisabledRef.current) onCloseRef.current?.();
                        return;
                    }
                    if (event.key !== 'Tab' || !panel) return;
                    const currentFocusable = Array.from(panel.querySelectorAll(focusableSelector));
                    if (currentFocusable.length === 0) {
                        event.preventDefault();
                        panel.focus();
                        return;
                    }
                    const first = currentFocusable[0];
                    const last = currentFocusable[currentFocusable.length - 1];
                    if (event.shiftKey && document.activeElement === first) {
                        event.preventDefault();
                        last.focus();
                    } else if (!event.shiftKey && document.activeElement === last) {
                        event.preventDefault();
                        first.focus();
                    }
                };

                document.addEventListener('keydown', handleKeyDown);
                return () => {
                    document.removeEventListener('keydown', handleKeyDown);
                    const previous = previousFocusRef.current;
                    if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
                        previous.focus();
                    }
                };
            }, [isOpen]);

            if (!isOpen) return null;
            const colorClass = type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700';
            return h('div', {
                className: `fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in ${overlayClassName}`.trim(),
                style: overlayStyle || undefined,
                onMouseDown: (event) => {
                    if (!dismissDisabled && event.target === event.currentTarget) onClose?.();
                }
            },
                h('div', {
                    ref: panelRef,
                    role: 'dialog',
                    'aria-modal': 'true',
                    'aria-labelledby': titleIdRef.current,
                    tabIndex: -1,
                    className: `bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-dialog-in flex flex-col max-h-[90vh] focus:outline-none ${panelClassName}`.trim(),
                    style: panelStyle || undefined
                },
                    h('div', { className: `p-4 border-b flex justify-between items-center flex-shrink-0 ${headerClassName}`.trim(), style: headerStyle || undefined },
                        h('h3', { id: titleIdRef.current, className: `font-bold text-lg ${titleClassName}`.trim() }, title),
                        h('button', { onClick: onClose, disabled: dismissDisabled, 'aria-label': '关闭对话框', className: `min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 ${closeButtonClassName}`.trim() }, h(Icon, { name: 'x' }))
                    ),
                    h('div', { className: `p-6 overflow-y-auto flex-1 ${bodyClassName}`.trim(), style: bodyStyle || undefined }, children),
                    h('div', { className: `p-4 bg-gray-50 flex justify-end gap-3 flex-shrink-0 ${footerClassName}`.trim(), style: footerStyle || undefined },
                        h('button', { onClick: onClose, disabled: dismissDisabled, className: `min-h-11 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:cursor-not-allowed disabled:opacity-50 ${cancelButtonClassName}`.trim() }, '取消'),
                        onConfirm && h('button', {
                            onClick: onConfirm,
                            disabled: confirmDisabled,
                            'aria-busy': confirmBusy ? 'true' : undefined,
                            className: `min-h-11 px-4 py-2 text-white rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${colorClass} ${confirmButtonClassName}`.trim()
                        }, confirmText)
                    )
                )
            );
        };
    };
})();
