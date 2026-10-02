/**
 * @file MethodologyView.jsx
 * Public "How we check compatibility" page (roadmap 6.5). Content comes from `lib/methodology.js`,
 * which reads its thresholds from the engine constants.
 */

import React from 'react';
import { GuidePageHeader, GuideSection } from '../components/guide/GuideBlocks';
import { CHECKS, DESIGN_ASSUMPTIONS, SEVERITY_LABELS } from '../lib/methodology';
import { ABOUT_SECTIONS, REPO_URL } from '../lib/siteInfo';

const SEVERITY_STYLES = {
    error: 'bg-red-100 text-red-800',
    warning: 'bg-amber-100 text-amber-800',
    info: 'bg-sky-100 text-sky-800',
};

const SeverityPill = ({ severity }) => (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_STYLES[severity]}`}>
        {SEVERITY_LABELS[severity]}
    </span>
);

export default function MethodologyView({ onOpenAbout }) {
    return (
        <div className="space-y-8 pb-8">
            <GuidePageHeader eyebrow="Methodology" title="How we check compatibility">
                <p>
                    Solar Pear checks whether a panel, a wiring layout and a controller work together. Each check
                    uses the worst case the array is likely to meet: voltage on a freezing morning, and voltage and
                    current on a hot afternoon. The figures come from manufacturer datasheets.
                </p>
                <p>
                    These are component compatibility checks, not an installation design. See the{' '}
                    <button
                        type="button"
                        onClick={() => onOpenAbout?.(ABOUT_SECTIONS.disclaimer)}
                        className="text-blue-700 underline hover:text-blue-900"
                    >
                        disclaimer
                    </button>{' '}
                    for what they do not cover.
                </p>
            </GuidePageHeader>

            <GuideSection
                title="Results"
                subtitle="Every message says which check failed and the temperature it used."
            >
                <ul className="space-y-2">
                    <li className="flex items-start gap-3">
                        <SeverityPill severity="error" />
                        <span>
                            The combination is unsafe or cannot work. It is excluded from “compatible” lists and
                            auto-wiring avoids it.
                        </span>
                    </li>
                    <li className="flex items-start gap-3">
                        <SeverityPill severity="warning" />
                        <span>It will work, but you lose power or have little safety margin. Worth a second look.</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <SeverityPill severity="info" />
                        <span>Something to know, such as normal overpanelling. Never changes the result.</span>
                    </li>
                </ul>
            </GuideSection>

            <GuideSection title="Design assumptions" subtitle="The defaults behind every check.">
                <dl className="divide-y divide-slate-100">
                    {DESIGN_ASSUMPTIONS.map((a) => (
                        <div key={a.name} className="py-3 grid grid-cols-1 md:grid-cols-[14rem_1fr] gap-1 md:gap-4">
                            <dt>
                                <span className="font-semibold text-slate-800">{a.name}</span>
                                <span className="block text-slate-500 font-mono text-xs mt-0.5">{a.value}</span>
                            </dt>
                            <dd>{a.detail}</dd>
                        </div>
                    ))}
                </dl>
            </GuideSection>

            <GuideSection title="The checks" subtitle="Run for every array against the controller port it is wired to.">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                                <th className="py-2 pr-4 font-semibold">Check</th>
                                <th className="py-2 pr-4 font-semibold">Rule</th>
                                <th className="py-2 font-semibold">Result</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {CHECKS.map((c) => (
                                <tr key={c.name} className="align-top">
                                    <td className="py-3 pr-4">
                                        <span className="font-semibold text-slate-800">{c.name}</span>
                                        <span className="block text-xs text-slate-500">{c.group}</span>
                                    </td>
                                    <td className="py-3 pr-4">{c.rule}</td>
                                    <td className="py-3">
                                        <SeverityPill severity={c.severity} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </GuideSection>

            <GuideSection title="Known limitations">
                <ul className="list-disc pl-5 space-y-2">
                    <li>
                        Each array connects to one MPPT tracker, and all trackers on a controller share the same
                        limits. Some inverters have trackers with different ratings; for those, the smaller limits
                        are used.
                    </li>
                    <li>
                        Design temperatures are not set from your location yet. The defaults suit most of the UK;
                        set a lower design temperature for exposed or high sites.
                    </li>
                    <li>
                        Optimiser-based systems (such as SolarEdge) and PWM charge controllers are not modelled.
                    </li>
                    <li>
                        Cable sizing, isolation, earthing, surge protection and mounting are not checked.
                    </li>
                </ul>
            </GuideSection>

            <p className="text-sm text-slate-600">
                Spot a mistake in a rule or a product’s figures? Use “Report a data error” on any product, or open
                an issue on{' '}
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline hover:text-blue-900">
                    GitHub
                </a>
                . The whole engine is open source.
            </p>
        </div>
    );
}
