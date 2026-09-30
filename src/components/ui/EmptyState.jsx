import React from 'react';

/**
 * Empty state with a next step. Dashed and neutral so an empty area never looks like a checked result.
 * @param {{ title: string, children?: React.ReactNode, action?: { label: string, onClick: () => void }, icon?: React.ReactNode, className?: string }} props
 */
export default function EmptyState({ title, children, action, icon, className = '' }) {
    return (
        <div
            className={`flex flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-placeholder p-6 text-center text-body ${className}`}
        >
            {icon ? <span className="mb-1 text-muted" aria-hidden="true">{icon}</span> : null}
            <h3 className="text-[15px] font-semibold">{title}</h3>
            {children ? <p className="max-w-[260px] text-[13px] text-muted">{children}</p> : null}
            {action ? (
                <button
                    type="button"
                    onClick={action.onClick}
                    className="mt-2 h-10 rounded-md bg-brand px-4 text-sm font-semibold text-ink"
                >
                    {action.label}
                </button>
            ) : null}
        </div>
    );
}
