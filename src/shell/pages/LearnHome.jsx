/**
 * @file LearnHome.jsx
 * Learn home (roadmap 13.4, canvas board "Learn · home"): the guides and the methodology as one section.
 */

import React from 'react';
import { Link } from 'react-router';

const GUIDES = [
    {
        slug: 'guide',
        eyebrow: 'Start here',
        title: 'How Solar Pear works',
        text: 'Where to start, the three checks every design goes through, and what the status icons mean.',
    },
    {
        slug: 'panels',
        eyebrow: 'Panels',
        title: 'Guide to panels',
        text: 'Cell types, busbars, glass and bifacial panels, with the trade-offs that matter and which catalogue series use each.',
    },
    {
        slug: 'controllers',
        eyebrow: 'Controllers',
        title: 'Guide to controllers',
        text: 'PWM and MPPT, the device families, and the datasheet ratings that decide compatibility.',
    },
];

export default function LearnHome() {
    return (
        <div className="flex flex-col gap-11">
            <div className="flex max-w-[760px] flex-col gap-3">
                <span className="text-xs font-semibold tracking-[0.12em] text-muted">LEARN</span>
                <h1 className="text-[40px] font-semibold leading-[48px] tracking-[-0.01em]">
                    Understand what you&apos;re choosing, and why it&apos;s checked
                </h1>
                <p className="text-[17px] leading-[27px] text-subtle">
                    Guides for people who&apos;d rather know than guess, and the rules every design is checked against.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {GUIDES.map((g) => (
                    <Link
                        key={g.slug}
                        to={`/learn/${g.slug}`}
                        className="flex flex-col gap-3.5 rounded-xl border border-line bg-white p-6 text-body hover:border-line-strong"
                    >
                        <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">{g.eyebrow}</span>
                        <span className="text-2xl font-semibold leading-[30px]">{g.title}</span>
                        <span className="text-sm leading-[21px] text-subtle">{g.text}</span>
                    </Link>
                ))}
            </div>

            <Link
                to="/learn/methodology"
                className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-white p-[18px] text-body hover:border-line-strong"
            >
                <span className="text-[15px] font-semibold">How we check compatibility</span>
                <span className="text-[13px] leading-[19px] text-subtle">
                    Every rule, threshold and temperature assumption the checks use, and how severe each one is.
                </span>
            </Link>

            <p className="text-xs text-muted">
                Guides explain component compatibility. They aren&apos;t installation instructions: follow the
                manufacturer&apos;s datasheets and BS 7671.
            </p>
        </div>
    );
}
