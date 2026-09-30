import React, { useEffect, useId, useRef, useState } from 'react';

/**
 * Menu button with a popup menu (project switcher, "more" menu). Escape or a click outside closes it and
 * returns focus to the button; arrow keys move between items.
 *
 * `children` is a render function `(close) => items`, so an item can close the menu before acting.
 * @param {{ label: React.ReactNode, ariaLabel?: string, buttonClassName?: string, align?: 'left'|'right', menuLabel: string, children: (close: () => void) => React.ReactNode }} props
 */
export default function Menu({ label, ariaLabel, buttonClassName = '', align = 'left', menuLabel, children }) {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    const id = useId();

    const close = () => {
        setOpen(false);
        buttonRef.current?.focus();
    };

    useEffect(() => {
        if (!open) return undefined;
        const items = () => [...(menuRef.current?.querySelectorAll('[role^="menuitem"]') || [])];
        items()[0]?.focus();
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
                return;
            }
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault();
            const list = items();
            const i = list.indexOf(document.activeElement);
            const next = e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
            list[next]?.focus();
        };
        const onPointer = (e) => {
            if (!menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onPointer);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onPointer);
        };
    }, [open]);

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? id : undefined}
                aria-label={ariaLabel}
                onClick={() => setOpen((v) => !v)}
                className={buttonClassName}
            >
                {label}
            </button>
            {open ? (
                <div
                    ref={menuRef}
                    id={id}
                    role="menu"
                    aria-label={menuLabel}
                    className={`absolute top-[calc(100%+6px)] z-40 flex w-[340px] flex-col rounded-[10px] border border-line bg-white p-1.5 font-plex text-body shadow-[0_12px_32px_rgba(20,24,31,0.16)] ${align === 'right' ? 'right-0' : 'left-0'}`}
                >
                    {children(close)}
                </div>
            ) : null}
        </div>
    );
}

const ITEM = 'flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-paper focus:bg-paper focus:outline-none';

/** A plain menu item. `tone="danger"` for destructive actions. */
export function MenuItem({ onSelect, children, tone, hint }) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onSelect}
            className={`${ITEM} justify-between ${tone === 'danger' ? 'text-status-error-edge' : ''}`}
        >
            <span>{children}</span>
            {hint ? <span className="text-xs text-muted">{hint}</span> : null}
        </button>
    );
}

/** A selectable menu item (e.g. a project in the switcher). */
export function MenuRadioItem({ checked, onSelect, children }) {
    return (
        <button
            type="button"
            role="menuitemradio"
            aria-checked={checked}
            onClick={onSelect}
            className={`${ITEM} ${checked ? 'bg-select-bg' : ''}`}
        >
            {children}
        </button>
    );
}

export function MenuHeading({ children }) {
    return <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{children}</div>;
}

export function MenuDivider() {
    return <div role="separator" className="mx-1 my-1.5 h-px bg-line-soft" />;
}
