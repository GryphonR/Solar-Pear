import React, { useRef, useEffect } from 'react';
import { XIcon } from './Icons';

const FOCUSABLE_SELECTOR =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Reusable modal: backdrop, optional header (title or custom content + close), scrollable body, optional footer.
 * Implements focus trap, Escape to close, and ARIA dialog attributes.
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {string} [title] - Simple header title (ignored if header is provided)
 * @param {React.ReactNode} [header] - Custom header content (e.g. panel name + badges); close button is still shown
 * @param {React.ReactNode} children - Body content
 * @param {React.ReactNode} [footer] - Footer (e.g. Cancel + primary button)
 * @param {string} [maxWidth='max-w-2xl'] - Tailwind max-width class
 * @param {boolean} [bodyScrollable=true] - Allow body to scroll when content is long
 * @param {number} [zIndex=50] - z-index for overlay (Confirm uses 100 to sit above others)
 * @param {'center'|'start'} [headerAlign='center'] - Header alignment (start for info modals with badges)
 */
export default function Modal({
    open,
    onClose,
    title,
    header,
    children,
    footer,
    maxWidth = 'max-w-2xl',
    bodyScrollable = true,
    zIndex = 50,
    headerAlign = 'center',
}) {
    const dialogRef = useRef(null);
    const previousActiveElement = useRef(null);

    // Focus trap and Escape key
    useEffect(() => {
        if (!open) return;
        previousActiveElement.current = document.activeElement;
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusables = dialog.querySelectorAll(FOCUSABLE_SELECTOR);
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (first && typeof first.focus === 'function') first.focus();

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key !== 'Tab') return;
            if (focusables.length === 0) return;
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    if (last && typeof last.focus === 'function') last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    if (first && typeof first.focus === 'function') first.focus();
                }
            }
        };

        dialog.addEventListener('keydown', handleKeyDown);
        return () => {
            dialog.removeEventListener('keydown', handleKeyDown);
            if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
                previousActiveElement.current.focus();
            }
        };
    }, [open, onClose]);

    if (!open) return null;

    const headerContent = header !== undefined ? (
        <>
            <div className="flex-1 min-w-0">{header}</div>
            <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 bg-white rounded-full shadow-sm border border-slate-200 transition-colors flex-shrink-0 ml-2"
                aria-label="Close"
            >
                <XIcon size={20} />
            </button>
        </>
    ) : title ? (
        <>
            <h2 id="modal-title" className="text-xl font-bold text-slate-800">
                {title}
            </h2>
            <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 bg-white rounded-full shadow-sm border border-slate-200 transition-colors"
                aria-label="Close"
            >
                <XIcon size={20} />
            </button>
        </>
    ) : null;

    return (
        <div
            className="fixed inset-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
            style={{ zIndex }}
            role="presentation"
        >
            <div
                ref={dialogRef}
                className={`bg-white rounded-xl shadow-2xl w-full flex flex-col ${maxWidth} ${bodyScrollable ? 'max-h-[90vh]' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? 'modal-title' : undefined}
            >
                {headerContent && (
                    <div className={`flex justify-between ${headerAlign === 'start' ? 'items-start' : 'items-center'} p-6 border-b border-slate-100 bg-slate-50 rounded-t-xl`}>
                        {headerContent}
                    </div>
                )}
                <div
                    className={`p-6 bg-white ${bodyScrollable ? 'overflow-y-auto flex-1' : ''}`}
                >
                    {children}
                </div>
                {footer != null && (
                    <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
