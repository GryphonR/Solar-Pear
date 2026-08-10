/**
 * @file PanelsGuideView.jsx
 * Guide to solar panel technology: cell types, front-side metallisation, glass construction and
 * bifaciality, each with the trade-offs that matter and live examples from the panel database.
 *
 * Published performance ranges quoted here are the industry consensus figures for each
 * architecture; the "in the database" figures beside them are computed from the app's own
 * catalogue at render time, so the two can be compared directly and neither goes stale.
 */

import React, { useMemo } from 'react';
import { useDataState, useUiState } from '../context/AppStateContext';
import {
    PANEL_TECH,
    GLASS_TYPE,
    groupPanelsByTechnology,
    groupPanelsByCellCount,
    summarisePanelGroup,
    summariseGlassBuilds,
    classifyGlassType,
} from '../lib/panelTechnology';
import {
    GuidePageHeader,
    GuideSection,
    GuideDetails,
    TechCard,
    ExampleChips,
    Takeaway,
    StatRow,
} from '../components/guide/GuideBlocks';
import { Layers } from '../components/Icons';

/**
 * Human-readable names for the glass constructions the comparison table can show. Builds with no
 * stated thickness are excluded from that table, so no label is needed for an unknown construction.
 */
const GLASS_LABELS = {
    [GLASS_TYPE.SINGLE]: 'Single glass + backsheet',
    [GLASS_TYPE.DUAL]: 'Glass-glass (dual glass)',
    [GLASS_TYPE.POLYMER]: 'Polymer laminate (no glass)',
};

/**
 * Formats a numeric range for display, collapsing a single-value range to one figure.
 *
 * @param {{ min: number, max: number } | null} range
 * @param {string} unit
 * @param {number} [dp=1]
 * @returns {string}
 */
function formatRange(range, unit, dp = 1) {
    if (!range) return '-';
    if (Math.abs(range.max - range.min) < 0.05) return `${range.min.toFixed(dp)}${unit}`;
    return `${range.min.toFixed(dp)}–${range.max.toFixed(dp)}${unit}`;
}

export default function PanelsGuideView() {
    const { panelsData } = useDataState();
    const { setInfoModalPanelId, setActiveTab } = useUiState();

    const techGroups = useMemo(() => groupPanelsByTechnology(panelsData), [panelsData]);
    // Require a few panels behind each row: one unusual module says nothing about a construction.
    const glassBuilds = useMemo(() => summariseGlassBuilds(panelsData, 3), [panelsData]);
    const cellFormats = useMemo(() => groupPanelsByCellCount(panelsData), [panelsData]);

    const bifacialPanels = useMemo(
        () => panelsData.filter((p) => p.bifacial === true),
        [panelsData]
    );

    /**
     * Summary plus ready-made example chips for one architecture.
     *
     * @param {string} tech A `PANEL_TECH` value.
     * @returns {{ summary: ReturnType<typeof summarisePanelGroup>, chips: import('react').ReactElement | null }}
     */
    const groupFor = (tech) => {
        const summary = summarisePanelGroup(techGroups[tech] || []);
        const chips = (
            <ExampleChips
                items={summary.examples.map((p) => ({
                    key: p.model,
                    name: p.name,
                    detail: p.efficiency ? `${p.efficiency}%` : undefined,
                }))}
                onSelect={setInfoModalPanelId}
                emptyNote="No panels in the database name this architecture yet."
            />
        );
        return { summary, chips };
    };

    /**
     * Builds the stat row shown on each architecture card: the published consensus range next to
     * what this catalogue actually holds.
     *
     * @param {ReturnType<typeof summarisePanelGroup>} summary
     * @param {string} publishedEfficiency
     * @param {string} publishedTempCoef
     * @returns {{ label: string, value: string }[]}
     */
    const statsFor = (summary, publishedEfficiency, publishedTempCoef) => {
        const stats = [
            { label: 'Module efficiency', value: publishedEfficiency },
            { label: 'Pmax temp. coefficient', value: publishedTempCoef },
        ];
        if (summary.count > 0) {
            stats.push({ label: 'In the database', value: `${summary.count} panels` });
            if (summary.efficiency) {
                stats.push({ label: 'Their efficiency', value: formatRange(summary.efficiency, '%') });
            }
            if (summary.avgTempCoefPmax != null) {
                stats.push({
                    label: 'Their avg. Pmax coef.',
                    value: `${summary.avgTempCoefPmax.toFixed(3)}%/°C`,
                });
            }
        }
        return stats;
    };

    const perc = groupFor(PANEL_TECH.PERC);
    const topcon = groupFor(PANEL_TECH.TOPCON);
    const hjt = groupFor(PANEL_TECH.HJT);
    const backContact = groupFor(PANEL_TECH.BACK_CONTACT);
    const monoGeneric = groupFor(PANEL_TECH.MONO_GENERIC);

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <GuidePageHeader eyebrow="Guide" title="Guide to panels">
                <p>
                    Every panel does the same job, so the differences come down to four things: how
                    many watts you get per square metre of roof, how much of that you keep on a hot
                    day, how long the module lasts before the weather gets into it, and what you pay
                    per watt for all of that. Cell architecture drives the first two, glass
                    construction drives the third, and manufacturing complexity drives the fourth -
                    which is why the newest, best-performing architectures also carry the biggest
                    price premium.
                </p>
                <p>
                    This page walks through the technologies you will meet on datasheets, oldest to
                    newest, with what each one is good and bad at. Every example is a panel in the
                    database - click one to open its full specification.
                </p>
            </GuidePageHeader>

            {/* ------------------------------------------------------- Monocrystalline vs poly */}
            <GuideSection
                title="Monocrystalline and polycrystalline"
                subtitle="The oldest distinction, and the one that has already been settled."
            >
                <p>
                    Both are silicon. The difference is how the ingot is grown before it is sawn into
                    wafers. <span className="font-semibold text-slate-800">Monocrystalline</span>{' '}
                    silicon is pulled from a single seed crystal, giving one continuous crystal
                    lattice with no internal grain boundaries for charge carriers to get lost at.
                    That uniformity is why mono cells look evenly dark, and why they convert more of
                    the light that hits them.
                </p>
                <p>
                    <span className="font-semibold text-slate-800">Polycrystalline</span> silicon is
                    cast rather than pulled, so it solidifies as many crystal grains pointing in
                    different directions. The boundaries between those grains trap charge carriers
                    and cost you efficiency, and they are what give poly panels their mottled blue
                    appearance. Poly modules typically reached 15–17% efficiency against 19–22% for
                    mono of the same era, and they lose more output per degree of heat.
                </p>
                <p>
                    Poly was cheaper to make, which kept it competitive into the late 2010s. Then
                    diamond wire sawing and larger furnaces collapsed the cost of mono wafers, and
                    the reason to accept the efficiency penalty disappeared with it. Poly is no
                    longer in mainstream production, so unless you are buying second-hand or working
                    on an array installed before about 2018, every panel you consider will be mono.
                    Everything below is a variation on the monocrystalline cell.
                </p>
                {monoGeneric.summary.count > 0 && (
                    <>
                        <p>
                            Some entries name only &quot;monocrystalline&quot; without saying which
                            architecture, which usually means an older or small-format module.
                        </p>
                        {monoGeneric.chips}
                    </>
                )}
            </GuideSection>

            {/* -------------------------------------------------- Half-cut cells and formats */}
            <GuideSection
                title="Half-cut cells and module format"
                subtitle="Why a modern panel says 108 cells when it holds 54 cells' worth of silicon."
            >
                <p>
                    Laser-cutting each cell in half halves the current flowing through it. Resistive
                    loss rises with the square of current, so halving current cuts that loss to a
                    quarter in the cell interconnect. A module described as{' '}
                    <span className="font-mono text-slate-800">108 Half-Cell</span> holds 54 full
                    cells&apos; worth of silicon, wired as six strings instead of three.
                </p>
                <p>
                    Splitting the module into two electrically independent halves also helps in
                    partial shade: shading the bottom row no longer drags down the top. Half-cut
                    construction is universal on modern panels, so it is a baseline rather than a
                    differentiator.
                </p>
                <p>
                    What does still vary is how many cells are in series, and that decides the
                    module&apos;s voltage and current profile - which in turn decides how many you
                    can put in a string. More cells in series means higher voltage per module, so
                    fewer modules fit under your controller&apos;s voltage ceiling. Larger wafers
                    push current up instead.
                </p>

                {cellFormats.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    <th className="py-1.5 pr-3">Format</th>
                                    <th className="py-1.5 pr-3">Full cells</th>
                                    <th className="py-1.5 pr-3">In the database</th>
                                    <th className="py-1.5 pr-3">Average Voc</th>
                                    <th className="py-1.5">Average Isc</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {cellFormats.map((format) => (
                                    <tr key={format.cellCount} className="border-t border-slate-200">
                                        <td className="py-2 pr-3 font-mono font-semibold text-slate-800">
                                            {format.cellCount} half-cell
                                        </td>
                                        <td className="py-2 pr-3 text-slate-500 tabular-nums">
                                            {format.cellCount / 2}
                                        </td>
                                        <td className="py-2 pr-3 text-slate-500 tabular-nums">
                                            {format.panels.length}
                                        </td>
                                        <td className="py-2 pr-3 text-slate-700 tabular-nums">
                                            {format.avgVoc != null ? `${format.avgVoc.toFixed(1)} V` : '-'}
                                        </td>
                                        <td className="py-2 text-slate-700 tabular-nums">
                                            {format.avgIsc != null ? `${format.avgIsc.toFixed(2)} A` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <Takeaway>
                    A 144 half-cell module runs at roughly twice the voltage of a 108, so barely half
                    as many will fit in a series string before you hit the controller&apos;s limit.
                    Large-format modules also push current hard enough to matter: a G12-wafer panel
                    can approach 16 A on its own, which will exhaust many trackers with a single
                    string in parallel.
                </Takeaway>
            </GuideSection>

            {/* ------------------------------------------------------------ P-type vs N-type */}
            <GuideSection
                title="P-type and n-type silicon"
                subtitle="The doping choice underneath every architecture below."
            >
                <p>
                    A solar cell needs two differently doped regions. The question is which one the
                    thick base wafer is.{' '}
                    <span className="font-semibold text-slate-800">P-type</span> wafers are doped
                    with boron and were standard for decades because they were cheaper to produce.{' '}
                    <span className="font-semibold text-slate-800">N-type</span> wafers are doped
                    with phosphorus.
                </p>
                <p>
                    Boron is the problem. In p-type silicon it pairs with residual oxygen to form
                    boron-oxygen complexes that trap charge carriers as soon as the panel first sees
                    strong light. That is light-induced degradation, and it costs a p-type module
                    roughly 1.5–2.5% of its output in year one. N-type wafers have no boron, so they
                    sidestep the mechanism entirely and typically lose under 1% in the first year.
                    N-type is also far more tolerant of the metal impurities that are impossible to
                    eliminate completely from production silicon.
                </p>
                <p>
                    N-type cells hold their voltage better as they heat up too, which is why every
                    modern architecture - TOPCon, HJT, back-contact - is built on an n-type wafer.
                    Long-term degradation follows the same pattern: around 0.5% a year for p-type
                    PERC against 0.25–0.4% for n-type designs, which compounds into roughly 5–10%
                    more output by year 25.
                </p>
                <Takeaway>
                    A gentler voltage temperature coefficient cuts both ways in your design. It means
                    less output lost on a hot day, but it also means less voltage spike on a freezing
                    morning - so an n-type panel often lets you put one more module in a series
                    string before the cold-voltage check fails.
                </Takeaway>
            </GuideSection>

            {/* --------------------------------------------------------- Cell architectures */}
            <GuideSection
                title="Cell architectures"
                subtitle="What the acronym in brackets on a datasheet actually buys you."
            >
                <TechCard
                    name="PERC"
                    alsoCalled="Passivated Emitter and Rear Cell, or Q.ANTUM in Q-Cells branding"
                    stats={statsFor(perc.summary, '20–22%', '−0.34 to −0.39%/°C')}
                    pros={[
                        'Cheapest silicon technology per watt, and widely available second-hand',
                        'Mature and thoroughly field-proven over a decade of deployment',
                        'Simplest supply chain, so replacements are easy to source',
                    ]}
                    cons={[
                        'Worst temperature coefficient of any current architecture',
                        'Suffers boron-oxygen light-induced degradation in year one',
                        'Also prone to LeTID, a slower heat-and-current degradation mode',
                        'Being retired from production, so it is now a legacy choice',
                    ]}
                    examples={perc.chips}
                >
                    <p>
                        PERC adds a dielectric passivation layer to the rear of a conventional p-type
                        cell, with laser-opened contact points through it. The layer does two jobs:
                        it stops charge carriers recombining at the rear surface, and it reflects
                        unabsorbed long-wavelength light back into the silicon for a second attempt.
                        That single change lifted module efficiency past 20% and made PERC the
                        default for most of the 2010s.
                    </p>
                </TechCard>

                <TechCard
                    name="TOPCon"
                    alsoCalled="i-TOPCon or N-TOPCon; Tunnel Oxide Passivated Contact"
                    stats={statsFor(topcon.summary, '22–24%', '−0.28 to −0.32%/°C')}
                    pros={[
                        'The current mainstream: around 65% of global cell production',
                        'Noticeably better temperature behaviour and degradation than PERC',
                        'Price premium over PERC has compressed to roughly 0–10%',
                        'Strong bifaciality, typically 75–85%',
                    ]}
                    cons={[
                        'Higher voltage per cell can shorten the maximum series string',
                        'Still beaten on temperature coefficient by HJT',
                        'Beaten on watts per square metre by back-contact designs',
                    ]}
                    examples={topcon.chips}
                >
                    <p>
                        TOPCon grows an ultra-thin silicon dioxide tunnel oxide on the rear of an
                        n-type wafer, then covers it with a doped polysilicon layer. The oxide is
                        thin enough for charge carriers to tunnel through, but it passivates the
                        surface far better than a directly metallised contact. The decisive advantage
                        was industrial rather than physical: TOPCon can be made by upgrading existing
                        PERC production lines, so the industry switched to it very quickly.
                    </p>
                </TechCard>

                <TechCard
                    name="HJT"
                    alsoCalled="Heterojunction, or HIT in Panasonic's original branding"
                    stats={statsFor(hjt.summary, '21.5–24%', '−0.24 to −0.27%/°C')}
                    pros={[
                        'Best temperature coefficient in mass production, so the least hot-day loss',
                        'Lowest degradation of any silicon technology, around 0.25–0.30% a year',
                        'Excellent low-light performance for early mornings and overcast days',
                        'Highest bifaciality, typically 85–95%',
                    ]}
                    cons={[
                        'Costs roughly 15–30% more per watt than TOPCon',
                        'Needs a purpose-built production line, so supply is a fraction of TOPCon',
                        'Low-temperature processing demands more silver and specialised pastes',
                        'Historically more sensitive to moisture ingress, so encapsulation matters',
                    ]}
                    examples={hjt.chips}
                >
                    <p>
                        HJT sandwiches a crystalline silicon wafer between ultra-thin layers of
                        amorphous silicon, one on each face. Those layers passivate the surfaces
                        superbly while also forming the junction, which is where the name comes from:
                        two different materials meeting rather than one material doped two ways. The
                        result is the flattest temperature response of any mass-produced silicon
                        cell, and a laboratory record of 26.7%.
                    </p>
                </TechCard>

                <TechCard
                    name="Back-contact"
                    alsoCalled="IBC by Maxeon, ABC by Aiko, HPBC by LONGi"
                    stats={statsFor(backContact.summary, '24–25.4%', '−0.25 to −0.29%/°C')}
                    pros={[
                        'Highest watts per square metre available, so best where roof space is the limit',
                        'A 3–5% optical gain from removing all front-side metal shading',
                        'Uniform all-black appearance with no visible silver lines',
                        'Better partial-shade behaviour, with far less localised overheating',
                    ]}
                    cons={[
                        'The most expensive silicon per watt, commonly 30–50% above TOPCon',
                        'More complex to manufacture, with fewer suppliers to choose from',
                        'Rarely bifacial, since the rear face is occupied by contacts',
                        'Repairs and matched replacements are harder years later',
                    ]}
                    examples={backContact.chips}
                >
                    <p>
                        Every architecture above puts some metal on the front of the cell to collect
                        current, and that metal casts a shadow on the silicon underneath it.
                        Back-contact designs move both the positive and negative contacts to the
                        rear, interleaved in a comb pattern, leaving the front face completely free
                        of metal. LONGi measures the resulting optical gain at 3–5%, with front
                        surface reflectance falling to about 1.5%.
                    </p>
                    <p>
                        The three names are the same idea from different manufacturers. IBC
                        (interdigitated back contact) is the original, which Maxeon has shipped for
                        two decades. Aiko&apos;s ABC (all back contact) is that concept taken to its
                        commercial extreme, and LONGi&apos;s HPBC (hybrid passivated back contact)
                        combines passivated contacts with the back-contact layout for easier
                        volume production. All three are the reason a modern premium panel can be
                        completely, evenly black.
                    </p>
                </TechCard>
            </GuideSection>

            {/* ---------------------------------------------------------------- Metallisation */}
            <GuideSection
                title="Busbars: the metal you can see on the front"
                subtitle="Why panels went from three fat silver lines to none at all."
            >
                <p>
                    Current generated across a cell has to be collected and carried away. Fine{' '}
                    <span className="font-semibold text-slate-800">fingers</span> gather it from the
                    silicon, and thicker <span className="font-semibold text-slate-800">busbars</span>{' '}
                    carry it to the ribbons that link one cell to the next. Every one of those lines
                    is opaque, so cell design is a straight fight between two losses: too few
                    busbars and the current travels too far through thin fingers, wasting power as
                    resistance; too many and the metal shades the silicon.
                </p>
                <p>
                    The industry has worked steadily down that trade-off. Cells went from two or
                    three wide flat busbars before 2016, to five, then to{' '}
                    <span className="font-semibold text-slate-800">multi-busbar</span> designs using
                    nine to sixteen thin round wires. Round wire matters: a 0.3 mm wire blocks less
                    than a flat ribbon of the same conductance, and its curved top scatters some
                    light sideways into the encapsulant where it can reflect back into the cell.
                    Effective shading from round wire is only about half to sixty percent of its
                    geometric shading.
                </p>
                <p>
                    The current end point is{' '}
                    <span className="font-semibold text-slate-800">zero busbar</span>, written 0BB,
                    which replaces the busbar strips with a dense matrix of solder pads bonded
                    directly to copper ribbons. Compared with an old three-busbar cell, 0BB is worth
                    roughly a full percentage point of absolute efficiency and uses 30–50% less
                    silver.
                </p>
                <p>
                    Combined with half-cut cells, this is where a large part of the last decade&apos;s
                    gains came from. A 12-busbar half-cell module cuts internal resistive losses by
                    around 75% against an older five-busbar full-cell design.
                </p>
                <Takeaway>
                    If you are after the panel with no visible silver lines and a completely uniform
                    black face, you are looking for either a zero-busbar module or a back-contact one
                    - back-contact goes furthest, because it has no front metal at all.
                </Takeaway>

                <GuideDetails title="Shingled cells: a different answer to the same problem">
                    <p>
                        Shingling cuts cells into narrow strips and overlaps them like roof tiles,
                        bonded with electrically conductive adhesive instead of ribbons. There are no
                        busbars or visible interconnects, the whole module face is active, and the
                        strips are wired into many short parallel groups, which makes the panel
                        unusually tolerant of partial shading. The trade-off is that the adhesive
                        joints are a long-term reliability question that soldered ribbons do not
                        have, and the approach never reached the scale of multi-busbar.
                    </p>
                </GuideDetails>
            </GuideSection>

            {/* ---------------------------------------------------------------------- Glass */}
            <GuideSection
                title="Glass and encapsulation"
                subtitle="What protects the cells, and what it costs you in weight."
            >
                <p>
                    A traditional module is glass on the front and a polymer backsheet on the rear,
                    with the cells laminated between them in encapsulant. The backsheet is the weak
                    point: polymers yellow, chalk and crack under decades of ultraviolet light and
                    thermal cycling, and they let water vapour through at a few grams per square
                    metre per day. That moisture is what drives delamination, corroded interconnects
                    and potential-induced degradation, where voltage stress drives sodium ions out of
                    the glass and into the cells.
                </p>
                <p>
                    A <span className="font-semibold text-slate-800">glass-glass</span> module
                    replaces the backsheet with a second pane. Glass is effectively impermeable, so
                    the moisture pathway closes: degradation typically falls from around 0.5–0.7% a
                    year to 0.3–0.5%, fire classification improves, and manufacturers back the
                    construction with 30-year rather than 25-year warranties. The panel is also
                    symmetrically stiff, which reduces the microcracking that a flexible rear face
                    permits.
                </p>
                <p>
                    Glass-glass is often described as heavy, but that depends entirely on total glass
                    thickness rather than on the number of panes. Glass masses about 2.5 kg per
                    square metre per millimetre, so a 1.6 mm + 1.6 mm laminate carries exactly as
                    much glass as one 3.2 mm pane - and can end up slightly lighter overall, since it
                    drops the backsheet. It is the 2.0 mm + 2.0 mm build that genuinely adds weight.
                    Comparing panels by weight per square metre rather than by kilograms removes the
                    effect of module size:
                </p>

                {glassBuilds.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    <th className="py-1.5 pr-3">Construction</th>
                                    <th className="py-1.5 pr-3">Total glass</th>
                                    <th className="py-1.5 pr-3">Panels</th>
                                    <th className="py-1.5">Median mass</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {glassBuilds.map((build) => (
                                    <tr key={build.key} className="border-t border-slate-200">
                                        <td className="py-2 pr-3 text-slate-700">
                                            {GLASS_LABELS[build.type]}
                                        </td>
                                        <td className="py-2 pr-3 text-slate-500 tabular-nums">
                                            {build.totalGlassMm != null
                                                ? `${build.totalGlassMm.toFixed(1)} mm`
                                                : 'not stated'}
                                        </td>
                                        <td className="py-2 pr-3 text-slate-500 tabular-nums">
                                            {build.count}
                                        </td>
                                        <td className="py-2 font-semibold text-slate-800 tabular-nums">
                                            {build.medianKgM2 != null
                                                ? `${build.medianKgM2.toFixed(1)} kg/m²`
                                                : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <p>
                    Two other coverings are worth knowing. An{' '}
                    <span className="font-semibold text-slate-800">anti-reflective coating</span> on
                    the front glass buys a couple of percent more transmission for almost nothing,
                    and is now near-universal on quality modules. At the other extreme,{' '}
                    <span className="font-semibold text-slate-800">ETFE polymer laminates</span> drop
                    glass altogether for a flexible module around a third of the mass, which is what
                    makes them viable on boats, vans and roofs that cannot take the load - at the
                    cost of a much shorter service life and a face that scratches and hazes.
                </p>

                <Takeaway>
                    Weight per square metre is the number to check against your roof, and it is what
                    the array&apos;s maximum panel weight limit is really protecting. In-roof GSE
                    trays and older roof structures are the usual constraints, so if you are close to
                    a limit, a 1.6 + 1.6 glass-glass panel gets you the durability without the weight
                    penalty of a 2.0 + 2.0 build.
                </Takeaway>
            </GuideSection>

            {/* --------------------------------------------------------- Why thickness matters */}
            <GuideSection
                title="Why you might want thicker or thinner glass"
                subtitle="One number decides both how well the panel survives a hailstone and how long its cells last."
            >
                <p>
                    There is a manufacturing fact behind this that datasheets never explain. Glass is
                    strengthened by heating it and then cooling the surfaces faster than the core, which
                    leaves the outside in compression. Do it hard and you get{' '}
                    <span className="font-semibold text-slate-800">fully tempered</span> glass, with a
                    surface compression of 90 MPa or more. Do it gently and you get{' '}
                    <span className="font-semibold text-slate-800">heat-strengthened</span> glass, at
                    roughly 24 to 69 MPa.
                </p>
                <p>
                    The catch is that you cannot establish a steep enough temperature gradient through
                    a pane much thinner than 3 mm. Below that, most production lines can only
                    heat-strengthen. So the 3.2 mm front pane on a conventional module is fully
                    tempered, while the 2.0 mm and 1.6 mm panes in a glass-glass module are only
                    heat-strengthened - typically about half as strong. Thickness and treatment work in
                    the same direction, and that compounds the difference.
                </p>
                <p>
                    It shows up clearly under impact. Independent hail testing puts a 3.2 mm tempered
                    front pane over a backsheet at roughly twice as resilient as a 2.0 + 2.0 mm
                    glass-glass module, measured at the energy where half the samples break. Struck by
                    50 mm hail, glass-glass breakage rates have reached 89% against 34% for fully
                    tempered single glass. Tempered glass also fails more safely, shattering into small
                    blunt fragments rather than large shards. This is why manufacturers selling into
                    hail-prone parts of the United States went back to 3.2 mm front glass for those
                    markets, accepting nearly 8 kg of extra weight per module to do it.
                </p>
                <p>
                    So why use thin glass at all? Partly cost and weight, but there is a real
                    engineering gain too, and it is about a completely different failure mode. In a
                    symmetric glass-glass laminate the cells sit exactly on the centreline, at what is
                    called the{' '}
                    <span className="font-semibold text-slate-800">neutral axis</span>. When the panel
                    flexes under wind or snow, material above the centreline goes into compression and
                    material below it into tension, but the centreline itself is stressed by neither.
                    Cells sitting there are barely loaded at all, so they microcrack far less. In a
                    single-glass module the cells sit well off the centreline and take tension every
                    time the laminate bends.
                </p>

                <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                <th className="py-2 px-3">Build</th>
                                <th className="py-2 px-3">Front pane</th>
                                <th className="py-2 px-3">Strongest at</th>
                                <th className="py-2 px-3">Weakest at</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {[
                                [
                                    'Single 3.2 mm + backsheet',
                                    'Fully tempered',
                                    'Impact: hail, falling branches, foot traffic',
                                    'Cell microcracks, and moisture over decades',
                                ],
                                [
                                    'Dual 1.6 + 1.6 mm',
                                    'Heat-strengthened',
                                    'Lightest build, cells at the neutral axis',
                                    'Impact resistance, and handling damage',
                                ],
                                [
                                    'Dual 2.0 + 2.0 mm',
                                    'Heat-strengthened',
                                    'Stiffness for large or frameless modules',
                                    'Heaviest build, still not tempered',
                                ],
                            ].map(([build, pane, strong, weak]) => (
                                <tr key={build} className="border-t border-slate-200">
                                    <td className="py-2 px-3 font-semibold text-slate-800">{build}</td>
                                    <td className="py-2 px-3 text-slate-600">{pane}</td>
                                    <td className="py-2 px-3 text-slate-600">{strong}</td>
                                    <td className="py-2 px-3 text-slate-600">{weak}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p>
                    Which risk dominates depends on where you are, and this is where advice written for
                    other markets misleads. The hail argument driving the American debate concerns
                    stones of 40 mm and up, which are effectively unknown in the United Kingdom. The
                    stresses a British roof actually applies are wind uplift, snow load and thirty years
                    of moisture - and those are precisely the three that a glass-glass laminate handles
                    better. One practical caveat pulls the other way: large thin-glass modules are
                    easier to damage while being carried and fitted, so breakages tend to happen on
                    installation day rather than in a storm.
                </p>

                <Takeaway>
                    On a normal UK roof, a 1.6 + 1.6 glass-glass panel is usually the better long-term
                    choice: same weight as conventional single glass, cells shielded from flexing
                    stress, and no backsheet for moisture to cross. Choose thick tempered single glass
                    when impact is the real threat - an exposed site, overhanging trees, or a roof that
                    will be walked on - and choose 2.0 + 2.0 only when a large or frameless module needs
                    the extra stiffness, since it costs weight without buying tempering.
                </Takeaway>
            </GuideSection>

            {/* -------------------------------------------------------------------- Bifacial */}
            <GuideSection
                title="Bifacial panels"
                subtitle="Real on the right mounting, close to worthless on the wrong one."
            >
                <p>
                    A bifacial module generates from both faces, so it needs a transparent rear  - 
                    which in practice means glass-glass construction. Its{' '}
                    <span className="font-semibold text-slate-800">bifaciality factor</span> is how
                    efficient the back is relative to the front: about 70% for PERC, 80% for TOPCon
                    and up to 90% for HJT. That figure caps the benefit; what you actually get
                    depends entirely on how much light reaches the rear face.
                </p>
                <p>
                    Two things govern that. <span className="font-semibold text-slate-800">Albedo</span>{' '}
                    is how reflective the surface beneath is, running from about 0.10 for dark asphalt
                    shingle through 0.20 for grass to 0.50 or more for white gravel and membrane. And{' '}
                    <span className="font-semibold text-slate-800">clearance</span> decides how much
                    of that reflected light the rear can see at all - the gain plateaus once a module
                    sits roughly its own width above the surface.
                </p>
                <p>
                    This is where roof-mounted bifacial falls down. A panel on standard L-feet sits
                    50 to 100 mm above a dark roof, and its rear mostly sees the roof plane rather
                    than sky or bright ground. Field measurements put the gain at 0–4% on a pitched
                    residential roof, against the 6–8% that proposals often quote. Flush in-roof
                    mounting removes the air gap entirely and with it any rear gain at all.
                </p>

                <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                <th className="py-2 px-3">Mounting</th>
                                <th className="py-2 px-3">Typical measured gain</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {[
                                ['In-roof (GSE) or flush on tile', 'Effectively none'],
                                ['Pitched roof, standard standoff', '0–4%'],
                                ['Flat roof, ballasted over white membrane', '5–12%'],
                                ['Ground mount, fixed tilt over grass', '5–12%'],
                                ['Carport or pergola over light concrete', '8–15%'],
                            ].map(([mounting, gain]) => (
                                <tr key={mounting} className="border-t border-slate-200">
                                    <td className="py-2 px-3 text-slate-700">{mounting}</td>
                                    <td className="py-2 px-3 font-semibold text-slate-800">{gain}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {bifacialPanels.length > 0 && (
                    <>
                        <StatRow
                            stats={[
                                {
                                    label: 'Bifacial in the database',
                                    value: `${bifacialPanels.length} of ${panelsData.length}`,
                                },
                                {
                                    label: 'Of those, glass-glass',
                                    value: `${
                                        bifacialPanels.filter(
                                            (p) => classifyGlassType(p) === GLASS_TYPE.DUAL
                                        ).length
                                    }`,
                                },
                            ]}
                        />
                        <ExampleChips
                            label="Bifacial examples"
                            items={bifacialPanels.slice(0, 4).map((p) => ({
                                key: p.model,
                                name: p.name,
                                detail: p.glass,
                            }))}
                            onSelect={setInfoModalPanelId}
                        />
                    </>
                )}

                <Takeaway>
                    On a typical house roof, buy the bifacial panel for its glass-glass durability if
                    you want it, not for its rear output. If the same money would buy a more
                    efficient front side or one extra module, that is almost always the better
                    trade. Bifacial earns its premium on carports, flat roofs with light membrane,
                    and ground mounts. Note too that your design is sized and costed from front-side
                    output at standard test conditions, so any rear gain is upside that does not
                    appear in the figures.
                </Takeaway>
            </GuideSection>

            {/* ------------------------------------------------------------------ Optimisers */}
            <GuideSection
                title="Optimisers and module-level electronics"
                subtitle="Not part of the panel, but they change what a string of panels has to obey."
            >
                <p>
                    Panels wired in series all carry the same current, so the weakest module sets the
                    pace for the whole string. Anything that makes one module differ from its
                    neighbours costs you output: a chimney shadow, a patch of moss, leaf litter, a
                    different roof orientation, or simply the spread in manufacturing tolerance and
                    ageing. Collectively this is called{' '}
                    <span className="font-semibold text-slate-800">mismatch</span>, and it can account
                    for around a tenth of a string&apos;s output.
                </p>
                <p>
                    Before reaching for extra hardware, it is worth knowing what your panels already
                    do about it. Every modern module has{' '}
                    <span className="font-semibold text-slate-800">bypass diodes</span>, typically
                    three, which let current route around a badly shaded group of cells instead of
                    being throttled by it. Half-cut construction adds to this by splitting the module
                    into two independent halves. A single shaded panel does not shut down a string,
                    and this baseline is exactly what makes optimiser marketing figures look larger
                    than the benefit you actually gain.
                </p>
                <p>
                    An <span className="font-semibold text-slate-800">optimiser</span> is a small
                    DC-to-DC converter fitted behind each panel, usually replacing its junction box.
                    It runs maximum power point tracking for that one module, so each panel works at
                    its own best voltage and current while still contributing to a shared string. The
                    shaded panel drops to whatever it can manage and the rest carry on at full output.
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                <th className="py-1.5 pr-3">Shading on the array</th>
                                <th className="py-1.5">Measured gain over a plain string inverter</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {[
                                ['None, clean and uniform', 'Nothing, and slightly negative is possible'],
                                ['Light', 'About 2 to 4%'],
                                ['Moderate', 'About 5 to 15%'],
                                ['Heavy or complex', 'About 15 to 22%'],
                            ].map(([condition, gain]) => (
                                <tr key={condition} className="border-t border-slate-200">
                                    <td className="py-2 pr-3 text-slate-700">{condition}</td>
                                    <td className="py-2 font-semibold text-slate-800">{gain}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p>
                    Those ranges are worth reading carefully. The largest study of the question
                    monitored 542 systems and found a median shading loss of 8.3% with optimisers
                    fitted, against 13% had the arrays relied on bypass diodes alone. In other words
                    optimisers recovered about 36% of the shading loss, not all of it. A single system
                    measured before and after retrofit gained 5.8% a year. Even SolarEdge&apos;s own
                    published comparison claims 1.9%, 5.0% and 8.4% for light, medium and heavy
                    shading. On a genuinely unshaded array the devices consume a little power of their
                    own, and testing at the University of Southern Denmark found total output can fall
                    slightly as a result.
                </p>

                <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 p-4">
                    <p className="text-sm font-bold text-slate-800">
                        This is where optimisers change the string rules
                    </p>
                    <p className="mt-1 text-sm text-slate-700 leading-relaxed">
                        The two common systems behave completely differently, and only one of them
                        leaves the compatibility checks in this app meaningful.
                    </p>
                    <ul className="mt-3 space-y-3 text-sm text-slate-700 leading-relaxed">
                        <li>
                            <span className="font-semibold text-slate-800">SolarEdge</span> requires an
                            optimiser on every module and its own inverter. The optimisers hold the
                            string at a fixed voltage, 380 V on a single-phase inverter, whatever the
                            string length, irradiance or temperature. SolarEdge state plainly that this
                            removes the temperature constraint that limits string length in
                            conventional systems, so there is no cold-Voc sum to check. Strings are
                            instead limited by optimiser count, at most 25 on a single-phase inverter,
                            and by power. Size these with SolarEdge&apos;s own tool rather than the
                            checks here.
                        </li>
                        <li>
                            <span className="font-semibold text-slate-800">Tigo</span> and similar
                            pass-through optimisers do not fix the string voltage. They work with any
                            string inverter, which keeps doing the tracking, so the string still
                            presents ordinary module voltages that rise in the cold. Every check in
                            this app applies exactly as it would without them.
                        </li>
                    </ul>
                </div>

                <p>
                    Two further differences matter in practice. Tigo can be deployed selectively, on
                    just the few shaded panels, and retrofitted to an existing array, whereas
                    SolarEdge is an all-or-nothing architecture chosen at design time. On the other
                    hand, because SolarEdge decouples each module from the string entirely, it will
                    happily run mismatched modules and several orientations on one string, and its
                    SafeDC behaviour drops each optimiser to 1 V when the inverter is off. That makes
                    a dormant string genuinely safe to work on, and gives it a neat property: string
                    voltage equals the module count, so a 16-module string reads about 16 V.
                </p>

                <GuideDetails title="What you give up">
                    <p>
                        Optimisers put electronics on the roof, one unit per panel, in the hottest and
                        wettest place in the system. Every one is a component that can fail, and
                        replacing it means lifting a panel. They add meaningful cost per module, and
                        with SolarEdge they tie you to one manufacturer for the inverter as well. The
                        counterweight is per-panel monitoring, which is genuinely useful and often the
                        best reason to fit them: without it, a single underperforming module in a
                        string is close to invisible.
                    </p>
                </GuideDetails>

                <Takeaway>
                    Fit optimisers to solve a shading problem you can actually point at, or to run one
                    string across several orientations. On a clean, single-orientation roof the money
                    buys more energy as an extra panel than as electronics behind the existing ones. If
                    your roof has distinct faces, note that this app already models each one as its own
                    array with its own controller or tracker, which addresses multiple orientations
                    without paying per panel.
                </Takeaway>
            </GuideSection>

            {/* ------------------------------------------------------------ Bridge back home */}
            <GuideSection
                title="How panel choice feeds the compatibility check"
                subtitle="The specifications behind the numbers on your array pages."
            >
                <p>
                    Four figures from everything above drive the compatibility checks.{' '}
                    <span className="font-semibold text-slate-800">Voc and its temperature
                    coefficient</span>{' '}
                    set how far voltage climbs on a freezing morning, which caps your series string
                    length.{' '}
                    <span className="font-semibold text-slate-800">Vmp and the Pmax coefficient</span>{' '}
                    set how far it sags on a hot afternoon, which decides whether the controller
                    still starts.{' '}
                    <span className="font-semibold text-slate-800">Isc</span> multiplied by your
                    parallel strings has to stay inside the tracker&apos;s current rating. And{' '}
                    <span className="font-semibold text-slate-800">physical size and weight per
                    square metre</span>{' '}
                    decide what fits the roof and the mounting system.
                </p>
                <p>
                    This is why the newer architectures are worth more than their efficiency headline
                    suggests: a gentler voltage coefficient widens the range of workable string
                    lengths, which often means a cheaper controller can do the job.
                </p>
                <button
                    type="button"
                    onClick={() => setActiveTab('GUIDE')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                >
                    <Layers size={16} />
                    See the three compatibility checks
                </button>
            </GuideSection>
        </div>
    );
}
