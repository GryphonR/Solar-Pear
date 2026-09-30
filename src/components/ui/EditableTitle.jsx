import React, { useEffect, useRef, useState } from 'react';
import { Pencil } from '../Icons';

/**
 * A page heading that can be renamed in place: a visible Rename button turns it into a text field.
 * Enter or leaving the field saves, Escape cancels. `validate(name)` may return a message to block a name.
 * @param {{ value: string, onRename: (name: string) => void, label: string, validate?: (name: string) => string|null, className?: string }} props
 */
export default function EditableTitle({ value, onRename, label, validate, className = 'text-[30px] font-semibold leading-9' }) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(value);
    const inputRef = useRef(null);
    const buttonRef = useRef(null);

    useEffect(() => {
        if (editing) inputRef.current?.select();
    }, [editing]);

    const trimmed = text.trim();
    const error = trimmed && trimmed !== value ? validate?.(trimmed) || null : null;

    const finish = (save) => {
        if (save && trimmed && trimmed !== value && !error) onRename(trimmed);
        setEditing(false);
        window.setTimeout(() => buttonRef.current?.focus(), 0);
    };

    if (editing) {
        return (
            <div className="flex flex-col gap-1">
                <input
                    ref={inputRef}
                    aria-label={label}
                    aria-invalid={!!error}
                    value={text}
                    maxLength={80}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={() => finish(true)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') finish(true);
                        if (e.key === 'Escape') finish(false);
                    }}
                    className={`-mx-2 min-w-[240px] rounded-md border border-secondary bg-white px-2 outline-none ring-2 ring-secondary/30 ${className}`}
                />
                <span className={`text-xs ${error ? 'text-status-error-fg' : 'text-muted'}`}>{error || 'Enter to save, Esc to cancel'}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <h1 className={className}>{value}</h1>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => {
                    setText(value);
                    setEditing(true);
                }}
                aria-label={label}
                title={label}
                className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-semibold text-secondary hover:bg-select-bg"
            >
                <Pencil size={14} />
                Rename
            </button>
        </div>
    );
}
