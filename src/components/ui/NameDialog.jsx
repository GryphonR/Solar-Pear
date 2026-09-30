import React, { useEffect, useRef, useState } from 'react';

/**
 * Small modal dialog that asks for a name (new project, rename project).
 * @param {{ open: boolean, title: string, label?: string, initialValue?: string, confirmLabel?: string, onConfirm: (name: string) => void, onCancel: () => void }} props
 */
export default function NameDialog({ open, title, label = 'Name', initialValue = '', confirmLabel = 'Save', onConfirm, onCancel }) {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        setValue(initialValue);
        const previous = document.activeElement;
        window.setTimeout(() => inputRef.current?.select(), 0);
        const onKey = (e) => {
            if (e.key === 'Escape') onCancel();
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            if (previous instanceof HTMLElement) previous.focus();
        };
    }, [open, initialValue]);

    if (!open) return null;
    const trimmed = value.trim();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 font-plex">
            <form
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onSubmit={(e) => {
                    e.preventDefault();
                    if (trimmed) onConfirm(trimmed);
                }}
                className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-line bg-white p-5 text-body shadow-xl"
            >
                <h2 className="text-lg font-semibold">{title}</h2>
                <label className="flex flex-col gap-1.5 text-sm">
                    <span className="text-subtle">{label}</span>
                    <input
                        ref={inputRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        maxLength={80}
                        className="h-10 rounded-lg border border-line-strong px-3 text-sm"
                    />
                </label>
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCancel} className="h-10 rounded-lg border border-line-strong px-4 text-sm font-semibold">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!trimmed}
                        className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-ink disabled:opacity-50"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </form>
        </div>
    );
}
