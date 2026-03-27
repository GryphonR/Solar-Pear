import React, { useCallback, useEffect, useRef, useState } from 'react';
import { XIcon } from './Icons';

const variantStyles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const AUTO_DISMISS_MS = 5000;

/**
 * Fixed bottom overlay toast. Slides in/out; does not affect document flow.
 * Auto-dismiss after AUTO_DISMISS_MS with exit animation (caller clears on onClose).
 */
export default function Toast({ message, variant = 'info', onClose, autoDismissMs = AUTO_DISMISS_MS }) {
    const [entered, setEntered] = useState(false);
    const [exiting, setExiting] = useState(false);
    const dismissedRef = useRef(false);

    const finishDismiss = useCallback(() => {
        if (dismissedRef.current) return;
        dismissedRef.current = true;
        onClose?.();
    }, [onClose]);

    useEffect(() => {
        const id = requestAnimationFrame(() => setEntered(true));
        return () => cancelAnimationFrame(id);
    }, []);

    useEffect(() => {
        if (autoDismissMs <= 0 || exiting) return undefined;
        const t = setTimeout(() => setExiting(true), autoDismissMs);
        return () => clearTimeout(t);
    }, [autoDismissMs, exiting]);

    useEffect(() => {
        if (!exiting) return undefined;
        const t = setTimeout(finishDismiss, 360);
        return () => clearTimeout(t);
    }, [exiting, finishDismiss]);

    const requestClose = useCallback(() => setExiting(true), []);

    const handleTransitionEnd = useCallback(
        (e) => {
            if (!exiting || e.propertyName !== 'transform') return;
            finishDismiss();
        },
        [exiting, finishDismiss]
    );

    if (!message) return null;

    const styles = variantStyles[variant] || variantStyles.info;
    const offScreen = !entered || exiting;

    return (
        <div
            className="fixed inset-x-0 bottom-0 z-[200] flex justify-center px-4 pb-6 pointer-events-none"
            aria-live="polite"
        >
            <div
                role="alert"
                onTransitionEnd={handleTransitionEnd}
                className={`pointer-events-auto w-full max-w-md shadow-lg rounded-lg border transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${
                    offScreen ? 'translate-y-[calc(100%+2rem)] opacity-0' : 'translate-y-0 opacity-100'
                } ${styles}`}
            >
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <p className="text-sm font-medium flex-1 min-w-0">{message}</p>
                    <button
                        type="button"
                        onClick={requestClose}
                        className="p-1.5 rounded hover:opacity-80 transition-opacity flex-shrink-0"
                        aria-label="Dismiss"
                    >
                        <XIcon size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
