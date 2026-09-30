import React from 'react';

const EYEBROW = 'text-xs font-semibold tracking-[0.08em] text-muted uppercase';

/**
 * A slot on the array hub (Layout, Panel, Controller). Three states:
 * - empty: dashed blue call to action; the whole card is the action
 * - filled: summary plus a change link
 * - attention: warning outline with the issue count and a "Why" link
 *
 * `onAction` is the card action when empty, and the "Change" / "Why" button otherwise.
 * @param {{
 *   eyebrow: string,
 *   state?: 'empty'|'filled'|'attention',
 *   title: string,
 *   detail?: React.ReactNode,
 *   onAction?: () => void,
 *   actionLabel?: string,
 *   className?: string,
 * }} props
 */
export default function SlotCard({ eyebrow, state = 'empty', title, detail, onAction, actionLabel, className = '' }) {
    if (state === 'empty') {
        return (
            <button
                type="button"
                onClick={onAction}
                className={`flex w-full flex-col items-start gap-2 rounded-[10px] border-[1.5px] border-dashed border-secondary bg-cta-bg p-4 text-left text-body ${className}`}
            >
                <span className={EYEBROW}>{eyebrow}</span>
                <span className="text-base font-semibold text-secondary">{title} →</span>
                {detail ? <span className="text-[13px] text-subtle">{detail}</span> : null}
            </button>
        );
    }

    const attention = state === 'attention';
    return (
        <div
            className={`flex flex-col gap-2 rounded-[10px] border bg-white p-4 ${attention ? 'border-status-warning-line' : 'border-line'} ${className}`}
        >
            <span className={EYEBROW}>{eyebrow}</span>
            <span className="text-base font-semibold text-body">{title}</span>
            <span className={`text-[13px] ${attention ? 'font-semibold text-status-warning-fg' : 'text-subtle'}`}>
                {detail}
                {onAction ? (
                    <>
                        {detail ? ' · ' : null}
                        <button type="button" onClick={onAction} className="font-semibold text-secondary underline-offset-2 hover:underline">
                            {actionLabel || (attention ? 'Why' : 'Change')}
                        </button>
                    </>
                ) : null}
            </span>
        </div>
    );
}
