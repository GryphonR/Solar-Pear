import React, { useEffect, useRef } from 'react';
import { XIcon } from '../Icons';

/**
 * Non-modal side panel (the diagram and the pickers open editors here rather than in a modal, so the
 * design stays visible). Escape closes it; focus moves to the panel on open and back on close.
 * @param {{ open: boolean, onClose: () => void, title: string, label?: string, children: React.ReactNode, footer?: React.ReactNode, className?: string }} props
 */
export default function SidePanel({ open, onClose, title, label, children, footer, className = '' }) {
    const ref = useRef(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!open) return undefined;
        const previous = document.activeElement;
        ref.current?.focus();
        const onKey = (e) => {
            if (e.key === 'Escape') onCloseRef.current?.();
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            if (previous instanceof HTMLElement) previous.focus();
        };
    }, [open]);

    if (!open) return null;

    return (
        <aside
            ref={ref}
            tabIndex={-1}
            aria-label={label || title}
            className={`flex w-[480px] max-w-full flex-shrink-0 flex-col border-l border-line bg-white shadow-[-8px_0_24px_rgba(20,24,31,0.06)] focus:outline-none ${className}`}
        >
            <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
                <h2 className="text-lg font-semibold text-body">{title}</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="flex h-9 w-9 items-center justify-center rounded-md text-body hover:bg-paper"
                >
                    <XIcon size={18} />
                </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer ? <div className="border-t border-line-soft px-5 py-3">{footer}</div> : null}
        </aside>
    );
}
