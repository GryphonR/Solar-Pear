import React from 'react';

/**
 * Filter bar: a search box, filter buttons and a result count with "Clear filters".
 * Compose with `FilterButton`. The bar itself owns no state.
 * @param {{ search: string, onSearch: (v: string) => void, searchLabel: string, placeholder?: string,
 *   shown?: number, total?: number, onClear?: () => void, children?: React.ReactNode }} props
 */
export function FilterBar({ search, onSearch, searchLabel, placeholder, shown, total, onClear, children }) {
    return (
        <div role="search" className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 w-[260px] items-center gap-2 rounded-lg border border-line-strong bg-white px-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                    value={search}
                    onChange={(e) => onSearch(e.target.value)}
                    placeholder={placeholder}
                    aria-label={searchLabel}
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm"
                />
            </label>
            {children}
            {total != null ? (
                <span className="ml-auto flex items-center gap-3 text-[13px] text-subtle">
                    <span>
                        <b className="text-body">{shown ?? total}</b> of {total}
                    </span>
                    {onClear ? (
                        <button type="button" onClick={onClear} className="text-secondary hover:underline">
                            Clear filters
                        </button>
                    ) : null}
                </span>
            ) : null}
        </div>
    );
}

/**
 * A filter button. `active` is shown with a blue outline and bold text (not colour alone).
 * Pass `pressed` for a toggle (aria-pressed), or `popup` for a button that opens a filter dialog.
 */
export function FilterButton({ active = false, pressed, popup = false, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={pressed}
            aria-haspopup={popup ? 'dialog' : undefined}
            className={`h-10 rounded-lg px-3 text-sm ${
                active
                    ? 'border-[1.5px] border-secondary bg-select-bg font-semibold text-secondary'
                    : 'border border-line-strong bg-white text-body'
            }`}
        >
            {children}
        </button>
    );
}

export default FilterBar;
