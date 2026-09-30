/**
 * @file AboutView.jsx
 * About & legal page (roadmap phase 6): disclaimer (6.1), affiliate disclosure (6.2), pricing and
 * editorial independence (6.7), data sources and corrections (6.6), privacy (6.3) and terms (6.10).
 *
 * Section ids come from `ABOUT_SECTIONS` so the footer and other pages can link straight to one.
 */

import React from 'react';
import { GuidePageHeader, GuideSection } from '../components/guide/GuideBlocks';
import {
    ABOUT_SECTIONS,
    DATA_CHANGELOG_URL,
    LEGAL_LAST_UPDATED,
    OPERATOR_NAME,
    REPO_URL,
} from '../lib/siteInfo';
import { PRICE_STALE_DAYS } from '../lib/pricing';

const ExtLink = ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline hover:text-blue-900">
        {children}
    </a>
);

const TOC = [
    [ABOUT_SECTIONS.disclaimer, 'Disclaimer'],
    [ABOUT_SECTIONS.affiliates, 'Affiliate links'],
    [ABOUT_SECTIONS.pricing, 'Prices and independence'],
    [ABOUT_SECTIONS.data, 'Data sources and corrections'],
    [ABOUT_SECTIONS.privacy, 'Privacy'],
    [ABOUT_SECTIONS.terms, 'Terms of use'],
];

export default function AboutView({ onOpenMethodology }) {
    return (
        <div className="space-y-8 pb-8">
            <GuidePageHeader eyebrow="About & legal" title="How Solar Pear works, and the small print">
                <p>
                    Solar Pear is a free, open-source tool run by {OPERATOR_NAME}. It helps you choose solar panels
                    and controllers that work together. This page explains what it can and cannot tell you, how it
                    is funded, and what happens to your data.
                </p>
                <p className="text-sm text-slate-500">Last updated {LEGAL_LAST_UPDATED}.</p>
            </GuidePageHeader>

            <nav aria-label="On this page" className="flex flex-wrap gap-2">
                {TOC.map(([id, label]) => (
                    <a
                        key={id}
                        href={`#${id}`}
                        onClick={(e) => {
                            e.preventDefault();
                            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
                    >
                        {label}
                    </a>
                ))}
            </nav>

            <div id={ABOUT_SECTIONS.disclaimer} className="scroll-mt-6">
                <GuideSection title="Disclaimer" subtitle="A compatibility aid, not an installation design.">
                    <p>
                        Solar Pear checks whether components are electrically and physically compatible, using
                        manufacturer datasheet figures and the assumptions set out on the{' '}
                        <button
                            type="button"
                            onClick={() => onOpenMethodology?.()}
                            className="text-blue-700 underline hover:text-blue-900"
                        >
                            methodology page
                        </button>
                        . It does not design your installation, and a “compatible” result is not a guarantee that a
                        system is safe, legal or suitable for your property.
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            Always check the final design against each manufacturer’s datasheet and installation
                            manual. Where they differ from this tool, the manufacturer is right.
                        </li>
                        <li>
                            Electrical work in the UK must comply with BS 7671 (the IET Wiring Regulations). Cable
                            sizing, isolation, protection, earthing and roof fixings are not checked here.
                        </li>
                        <li>
                            Anything connected to the grid must be notified to, or approved by, your distribution
                            network operator under G98 or G99 before or after installation as those rules require.
                            Export payments under the Smart Export Guarantee usually need an MCS-certified
                            installation.
                        </li>
                        <li>
                            If you are not competent to do the work, use a qualified installer. Solar arrays produce
                            dangerous DC voltages whenever light falls on them.
                        </li>
                    </ul>
                    <p>
                        Specifications and prices are collected with care but can be wrong or out of date. Some
                        product notes are generated with AI assistance and are labelled as such.
                    </p>
                </GuideSection>
            </div>

            <div id={ABOUT_SECTIONS.affiliates} className="scroll-mt-6">
                <GuideSection title="Affiliate links" subtitle="How Solar Pear is funded.">
                    <p>
                        Solar Pear is free to use. Some “buy” links may be affiliate links: if you click one and
                        then buy something, the retailer may pay us a commission. It costs you nothing extra, and
                        you are never obliged to use our links.
                    </p>
                    <p>
                        Affiliate links are marked with an asterisk (*) in buy menus and tooltips. Links without
                        the mark earn us nothing. Buy links open the retailer’s own site; your purchase, delivery,
                        returns and warranty are between you and that retailer.
                    </p>
                </GuideSection>
            </div>

            <div id={ABOUT_SECTIONS.pricing} className="scroll-mt-6">
                <GuideSection title="Prices and independence" subtitle="Commission never decides what we recommend.">
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            Products are ranked only on compatibility, fit and cost per kWp. Whether a product has
                            an affiliate link, or how much commission it pays, plays no part in any check, filter or
                            ranking.
                        </li>
                        <li>
                            No manufacturer or retailer pays to be listed or to be placed higher.
                        </li>
                        <li>
                            Prices are gathered from UK retailer websites by a mix of automated searches and manual
                            checks, and each one shows the month it was last checked. A price older than{' '}
                            {PRICE_STALE_DAYS} days is flagged as possibly out of date. Prices do not include delivery,
                            and may be shown with or without VAT depending on how the retailer lists them (trade
                            suppliers usually quote ex-VAT).
                        </li>
                        <li>
                            Products with no known price are shown with a dash and left out of totals rather than
                            counted as free. You can enter your own supplier’s prices at any time.
                        </li>
                        <li>
                            Always check the price and stock on the retailer’s site before you buy.
                        </li>
                    </ul>
                </GuideSection>
            </div>

            <div id={ABOUT_SECTIONS.data} className="scroll-mt-6">
                <GuideSection title="Data sources and corrections">
                    <p>
                        Product specifications come from manufacturers’ published datasheets. Every product with a
                        known datasheet links to it from its information panel. Products are only listed when their
                        datasheet publishes every figure the safety checks need, such as the temperature
                        coefficients; gaps are never filled with guesses.
                    </p>
                    <p>
                        Found a wrong figure, a dead link or a missing product? Use “Report a data error” in any
                        product’s information panel, or{' '}
                        <ExtLink href={`${REPO_URL}/issues/new/choose`}>open an issue on GitHub</ExtLink>. Please
                        include a link to the datasheet. Corrections are listed in the public{' '}
                        <ExtLink href={DATA_CHANGELOG_URL}>data corrections log</ExtLink>.
                    </p>
                </GuideSection>
            </div>

            <div id={ABOUT_SECTIONS.privacy} className="scroll-mt-6">
                <GuideSection title="Privacy" subtitle="Your designs stay on your device.">
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <span className="font-semibold text-slate-800">No accounts, no tracking.</span> Solar
                            Pear has no server-side database, sets no cookies, and does not use analytics or
                            advertising trackers.
                        </li>
                        <li>
                            <span className="font-semibold text-slate-800">Browser storage.</span> Your areas,
                            arrays, notes, settings and price edits are saved in your browser’s local storage so
                            they are there next time. They never leave your device unless you download a backup
                            file and share it yourself. The reset button, or clearing this site’s data in your
                            browser, deletes them.
                        </li>
                        <li>
                            <span className="font-semibold text-slate-800">Hosting.</span> The site is hosted on
                            GitHub Pages. Like any web host, GitHub receives your IP address and browser details to
                            serve the page and may keep them in its logs for security; see the{' '}
                            <ExtLink href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">
                                GitHub privacy statement
                            </ExtLink>
                            . We do not receive or keep these logs.
                        </li>
                        <li>
                            <span className="font-semibold text-slate-800">Retailer sites.</span> When you follow a
                            buy link, the retailer’s site, and for affiliate links the affiliate network, may set
                            cookies to record that you came from Solar Pear. Their own privacy and cookie policies
                            apply.
                        </li>
                        <li>
                            <span className="font-semibold text-slate-800">Reports.</span> If you report an error on
                            GitHub, what you write is public and is covered by GitHub’s terms.
                        </li>
                    </ul>
                    <p>
                        If we ever add analytics or other data collection, this section will be updated first.
                    </p>
                </GuideSection>
            </div>

            <div id={ABOUT_SECTIONS.terms} className="scroll-mt-6">
                <GuideSection title="Terms of use">
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>
                            By using Solar Pear you accept these terms. If you do not, please do not use the site.
                        </li>
                        <li>
                            Solar Pear is provided free of charge, “as is”, for information only. It is not
                            professional engineering or electrical advice. We do not promise that it is accurate,
                            complete, available or suitable for any particular purpose.
                        </li>
                        <li>
                            You are responsible for checking any design against the manufacturers’ documentation and
                            the regulations that apply to you, and for having electrical work carried out by a
                            competent person.
                        </li>
                        <li>
                            To the extent the law allows, we are not liable for any loss or damage arising from use
                            of the site or reliance on its results, including damage to equipment or property, lost
                            savings or lost income. Nothing in these terms limits liability for death or personal
                            injury caused by negligence, for fraud, or for anything else that cannot be limited by
                            law, and nothing affects your statutory rights.
                        </li>
                        <li>
                            Products are sold by the retailers you buy from, not by us. We are not responsible for
                            their prices, stock, delivery, returns or warranties.
                        </li>
                        <li>
                            The source code is licensed under the{' '}
                            <ExtLink href={`${REPO_URL}/blob/main/LICENSE`}>GNU GPL v3.0</ExtLink>. Product names and
                            trademarks belong to their owners and are used only to identify products.
                        </li>
                        <li>
                            We may change these terms; the date at the top of this page shows when they last
                            changed. These terms are governed by the law of England and Wales.
                        </li>
                    </ol>
                </GuideSection>
            </div>
        </div>
    );
}
