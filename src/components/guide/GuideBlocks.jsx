/**
 * @file GuideBlocks.jsx
 * Shared presentation pieces for the technology guide pages (panels and controllers).
 *
 * Kept deliberately small and generic: each page supplies the words, these components supply a
 * consistent shape so the two guides read as one family.
 */

import React from 'react';
import { CheckCircle, XIcon, ChevronDown, Info } from '../Icons';

/**
 * Page title block for a guide page.
 *
 * @param {object} props
 * @param {string} props.eyebrow Small label above the title.
 * @param {string} props.title Page title.
 * @param {import('react').ReactNode} props.children Lead paragraph.
 */
export const GuidePageHeader = ({ eyebrow, title, children }) => (
    <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{eyebrow}</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        <div className="text-base text-slate-600 leading-relaxed space-y-3 max-w-3xl">{children}</div>
    </header>
);

/**
 * A titled card section.
 *
 * @param {object} props
 * @param {string} props.title Section heading.
 * @param {string} [props.subtitle] One-line description under the heading.
 * @param {import('react').ReactNode} props.children Section body.
 */
export const GuideSection = ({ title, subtitle, children }) => (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/80">
            <h2 className="text-lg font-bold text-slate-800">{title}</h2>
            {subtitle && <p className="text-slate-600 text-sm mt-1">{subtitle}</p>}
        </div>
        <div className="p-5 space-y-4 text-sm text-slate-600 leading-relaxed">{children}</div>
    </section>
);

/**
 * Collapsible sub-section, for detail that would otherwise bury the main thread.
 *
 * @param {object} props
 * @param {string} props.title Summary line.
 * @param {import('react').ReactNode} props.children Body.
 */
export const GuideDetails = ({ title, children }) => (
    <details className="group rounded-lg border border-slate-200 bg-slate-50/50">
        <summary className="flex items-center justify-between gap-3 py-3 px-4 cursor-pointer list-none hover:bg-slate-100/70 transition-colors rounded-lg">
            <span className="text-sm font-semibold text-slate-800">{title}</span>
            <ChevronDown
                size={16}
                className="text-slate-400 flex-shrink-0 transition-transform group-open:rotate-180"
            />
        </summary>
        <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>
    </details>
);

/**
 * Side-by-side strengths and weaknesses.
 *
 * @param {object} props
 * @param {string[]} props.pros
 * @param {string[]} props.cons
 */
export const ProsCons = ({ pros, cons }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-green-800 mb-2">Strengths</p>
            <ul className="space-y-1.5">
                {pros.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                        <CheckCircle size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-orange-800 mb-2">
                Trade-offs
            </p>
            <ul className="space-y-1.5">
                {cons.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                        <XIcon size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

/**
 * Row of small figures drawn from the database.
 *
 * @param {object} props
 * @param {{ label: string, value: string }[]} props.stats Omit entries you have no data for.
 */
export const StatRow = ({ stats }) => (
    <div className="flex flex-wrap gap-2">
        {stats.map((stat) => (
            <div
                key={stat.label}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 min-w-0"
            >
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {stat.label}
                </span>
                <span className="block text-sm font-semibold text-slate-800 tabular-nums">
                    {stat.value}
                </span>
            </div>
        ))}
    </div>
);

/**
 * Clickable examples pulled from the database. Selecting one opens its full specification in the
 * existing info modal, so the guide leads into the real data rather than dead-ending.
 *
 * @param {object} props
 * @param {string} [props.label='In the database'] Lead-in label.
 * @param {{ key: string, name: string, detail?: string }[]} props.items
 * @param {(key: string) => void} props.onSelect Receives the item key (panel model or charger id).
 * @param {string} [props.emptyNote] Shown when there are no examples to cite.
 */
export const ExampleChips = ({ label = 'In the database', items, onSelect, emptyNote }) => {
    if (!items || items.length === 0) {
        return emptyNote ? <p className="text-sm text-slate-500 italic">{emptyNote}</p> : null;
    }

    return (
        <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {label}
            </p>
            <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => onSelect(item.key)}
                        title="Open full specification"
                        className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left hover:border-blue-300 hover:bg-blue-50/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        <Info size={13} className="text-slate-400 group-hover:text-blue-600 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                        {item.detail && (
                            <span className="text-xs text-slate-400 tabular-nums">{item.detail}</span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

/**
 * Highlighted practical conclusion, for the "so what should I do" line that ends a section.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 */
export const Takeaway = ({ children }) => (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800 mb-1">
            What this means for your build
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">{children}</p>
    </div>
);

/**
 * One technology or device family: heading, database figures, explanation, trade-offs, examples.
 *
 * @param {object} props
 * @param {string} props.name Technology name.
 * @param {string} [props.alsoCalled] Alternative names users will meet on datasheets.
 * @param {{ label: string, value: string }[]} [props.stats]
 * @param {import('react').ReactNode} props.children Explanation.
 * @param {string[]} [props.pros]
 * @param {string[]} [props.cons]
 * @param {import('react').ReactNode} [props.examples] Rendered `ExampleChips`.
 */
export const TechCard = ({ name, alsoCalled, stats, children, pros, cons, examples }) => (
    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
        <div>
            <h3 className="text-base font-bold text-slate-800">{name}</h3>
            {alsoCalled && (
                <p className="text-xs text-slate-500 mt-0.5">Also sold as {alsoCalled}</p>
            )}
        </div>
        {stats && stats.length > 0 && <StatRow stats={stats} />}
        <div className="space-y-3">{children}</div>
        {pros && cons && <ProsCons pros={pros} cons={cons} />}
        {examples}
    </div>
);
