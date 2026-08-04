/**
 * @file ControllersGuideView.jsx
 * Guide to PV controllers: how MPPT tracking works, the device families you can connect panels
 * to, the ratings that decide compatibility, and the UK grid rules that narrow the choice.
 *
 * Device counts, voltage ranges and certification tallies are computed from the controller
 * database at render time, so the page describes the catalogue the user actually has.
 */

import React, { useMemo } from 'react';
import { useDataState, useUiState } from '../context/AppStateContext';
import {
    CONTROLLER_TYPE,
    CONTROLLER_TYPE_LABELS,
    groupControllersByType,
    summariseControllerGroup,
    summariseGridCapabilities,
    findCurrentHeadroomExamples,
} from '../lib/controllerTypes';
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

export default function ControllersGuideView() {
    const { chargersData } = useDataState();
    const { setInfoModalChargerId, setActiveTab } = useUiState();

    const typeGroups = useMemo(() => groupControllersByType(chargersData), [chargersData]);
    const grid = useMemo(() => summariseGridCapabilities(chargersData), [chargersData]);
    const currentHeadroom = useMemo(() => findCurrentHeadroomExamples(chargersData), [chargersData]);

    /**
     * Summary plus example chips for one device family.
     *
     * @param {string} type A `CONTROLLER_TYPE` value.
     */
    const groupFor = (type) => {
        const summary = summariseControllerGroup(typeGroups[type] || []);
        const chips = (
            <ExampleChips
                items={summary.examples.map((c) => ({
                    key: c.id,
                    name: c.manufacturer ? `${c.manufacturer} ${c.name}` : c.name,
                    detail: c.maxV > 0 ? `${c.maxV} V max` : undefined,
                }))}
                onSelect={setInfoModalChargerId}
                emptyNote="No controllers of this type in the database yet."
            />
        );
        return { summary, chips };
    };

    /**
     * Stat row for a device family, omitting figures the family does not have.
     *
     * @param {ReturnType<typeof summariseControllerGroup>} summary
     */
    const statsFor = (summary) => {
        const stats = [{ label: 'In the database', value: `${summary.count}` }];
        if (summary.maxV) {
            stats.push({
                label: 'Max PV input',
                value:
                    summary.maxV.min === summary.maxV.max
                        ? `${summary.maxV.max} V`
                        : `${summary.maxV.min}–${summary.maxV.max} V`,
            });
        }
        if (summary.trackers) {
            stats.push({
                label: 'Trackers',
                value:
                    summary.trackers.min === summary.trackers.max
                        ? `${summary.trackers.max}`
                        : `${summary.trackers.min}–${summary.trackers.max}`,
            });
        }
        if (summary.batteryVoltages.length > 0) {
            stats.push({
                label: 'Battery voltages',
                value: `${summary.batteryVoltages.join(', ')} V`,
            });
        }
        return stats;
    };

    const charger = groupFor(CONTROLLER_TYPE.CHARGER);
    const hybrid = groupFor(CONTROLLER_TYPE.HYBRID_INVERTER);
    const stringInv = groupFor(CONTROLLER_TYPE.STRING_INVERTER);
    const micro = groupFor(CONTROLLER_TYPE.MICROINVERTER);
    const acCoupled = groupFor(CONTROLLER_TYPE.AC_COUPLED_INVERTER);
    const inverterCharger = groupFor(CONTROLLER_TYPE.INVERTER_CHARGER);
    const dcdc = groupFor(CONTROLLER_TYPE.DC_DC_CHARGER);

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <GuidePageHeader eyebrow="Guide" title="Guide to controllers">
                <p>
                    Panels produce direct current at a voltage that swings with sunlight and
                    temperature, and nothing in your house or battery wants electricity in that form.
                    The controller is what converts it - and because it is the component with hard
                    limits, it is usually what decides whether a panel choice works.
                </p>
                <p>
                    There is less to learn here than with panels, but the consequences of getting it
                    wrong are more immediate: exceed a controller&apos;s voltage limit and you destroy
                    it. Every example below is a controller in the database - click one to open its
                    full specification.
                </p>
            </GuidePageHeader>

            {/* ------------------------------------------------------------- PWM versus MPPT */}
            <GuideSection
                title="PWM and MPPT"
                subtitle="The difference between a switch and a converter, and why it is worth 20–30%."
            >
                <p>
                    A <span className="font-semibold text-slate-800">PWM</span> controller is
                    essentially a fast switch between the array and the battery. Closing that switch
                    drags the panel down to roughly battery voltage, so a panel whose maximum power
                    point is 31 V ends up operating at about 13.5 V on a 12 V battery. The current is
                    passed through efficiently, but the voltage difference is simply not collected  - 
                    the panel never delivers the wattage on its label.
                </p>
                <p>
                    An <span className="font-semibold text-slate-800">MPPT</span> controller adds a
                    DC-to-DC converter, which decouples the two sides. The panel is free to sit at
                    whatever voltage produces maximum power while the converter steps that down to
                    what the battery needs, trading the surplus voltage for extra charging current.
                    A tracking algorithm hunts for the maximum power point continuously, re-finding
                    it as cloud and temperature move it around.
                </p>
                <p>
                    In practice MPPT harvests 20–30% more energy, and the gap widens exactly when it
                    matters. The bigger the mismatch between panel Vmp and battery voltage the more
                    PWM discards, and cold bright weather - when panel voltage rises and off-grid
                    demand peaks - is where MPPT pulls furthest ahead. The gap only narrows to 5–15%
                    in the one case PWM was designed for: a 36-cell panel matched deliberately to a
                    12 V battery.
                </p>
                <Takeaway>
                    PWM only makes sense on a small system built around voltage-matched panels. Any
                    modern 108-cell module has far too high a Vmp to waste on a PWM controller, and
                    every controller in the database is an MPPT design for that reason.
                </Takeaway>
            </GuideSection>

            {/* ---------------------------------------------------------------- Device types */}
            <GuideSection
                title="The device families"
                subtitle="Seven things a string of panels can plug into, and what each is for."
            >
                <TechCard
                    name={CONTROLLER_TYPE_LABELS[CONTROLLER_TYPE.CHARGER]}
                    stats={statsFor(charger.summary)}
                    pros={[
                        'Simplest and cheapest route from panels to a battery',
                        'Works entirely without a grid connection, so ideal off-grid',
                        'Easy to expand by adding another controller to the same bank',
                        'No grid paperwork when nothing is exported',
                    ]}
                    cons={[
                        'Produces no AC on its own; you need a separate inverter for mains loads',
                        'Low-voltage DC wiring means heavy cable for any distance',
                        'Battery voltage constrains the whole design',
                    ]}
                    examples={charger.chips}
                >
                    <p>
                        A dedicated DC device that takes a PV string and charges a battery bank at
                        12, 24 or 48 V. This is the classic off-grid building block, and the type
                        used in vans, boats, cabins and workshops. Because it only ever talks to the
                        battery, it is the easiest to reason about and the easiest to add to later.
                    </p>
                </TechCard>

                <TechCard
                    name={CONTROLLER_TYPE_LABELS[CONTROLLER_TYPE.HYBRID_INVERTER]}
                    stats={statsFor(hybrid.summary)}
                    pros={[
                        'One box handles panels, battery, grid and house loads',
                        'Usually the cheapest route to solar plus storage on a grid-connected house',
                        'High PV input voltages allow long strings and thin cable',
                        'Most offer some form of backup power when the grid fails',
                    ]}
                    cons={[
                        'A single point of failure for the whole system',
                        'Battery compatibility is often restricted to approved models',
                        'Needs DNO notification or approval before or after connection',
                        'Less modular: outgrowing it usually means replacing it',
                    ]}
                    examples={hybrid.chips}
                >
                    <p>
                        A hybrid inverter combines the MPPT tracker, the battery charger and a
                        grid-tied inverter in one unit. It is the default for a grid-connected home
                        adding storage, and the largest family in the database. The high maximum PV
                        voltages let you wire long strings, which keeps current and therefore cable
                        cost down.
                    </p>
                </TechCard>

                <TechCard
                    name={CONTROLLER_TYPE_LABELS[CONTROLLER_TYPE.STRING_INVERTER]}
                    stats={statsFor(stringInv.summary)}
                    pros={[
                        'Cheapest cost per watt for pure generation at scale',
                        'Very high PV voltages suit long strings and large arrays',
                        'Simple, mature and highly efficient',
                    ]}
                    cons={[
                        'No battery capability, so storage means adding an AC-coupled inverter later',
                        'No backup power: it shuts down when the grid does',
                        'One shaded panel affects its whole string',
                    ]}
                    examples={stringInv.chips}
                >
                    <p>
                        Panels in, AC out, nothing else. String inverters were the standard
                        residential product before storage became common, and remain the norm for
                        commercial rooftops where the goal is generation rather than resilience. The
                        units here reach far higher PV voltages than any battery-based device, which
                        is what makes very long strings possible.
                    </p>
                </TechCard>

                <TechCard
                    name={CONTROLLER_TYPE_LABELS[CONTROLLER_TYPE.MICROINVERTER]}
                    stats={statsFor(micro.summary)}
                    pros={[
                        'Per-panel tracking, so shading on one module costs you only that module',
                        'No high-voltage DC on the roof, which simplifies safety',
                        'Add panels one at a time, in any orientation, with no string maths',
                        'Per-panel monitoring makes faults obvious',
                    ]}
                    cons={[
                        'Highest cost per watt of any option',
                        'One unit per panel means many more devices to fail, all on the roof',
                        'Battery storage needs a separate AC-coupled inverter',
                        'Each unit takes one or two panels only, so nothing scales by stringing',
                    ]}
                    examples={micro.chips}
                >
                    <p>
                        A microinverter mounts behind a single panel and converts to AC there. The
                        low maximum PV voltages in the database reflect that: these devices expect
                        one module, not a string, so the series-string arithmetic that dominates every
                        other choice does not apply. They come into their own on complex or shaded
                        roofs with several orientations.
                    </p>
                </TechCard>

                <GuideDetails title="Three specialist types you may meet">
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-semibold text-slate-800">
                                {CONTROLLER_TYPE_LABELS[CONTROLLER_TYPE.AC_COUPLED_INVERTER]}
                            </p>
                            <p className="mt-1">
                                Has no PV input at all. It sits on the AC side and charges a battery
                                from whatever the house or an existing string inverter produces,
                                which is how you add storage to a solar installation that already
                                works without replacing the inverter.
                            </p>
                            {acCoupled.chips}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-800">
                                {CONTROLLER_TYPE_LABELS[CONTROLLER_TYPE.INVERTER_CHARGER]}
                            </p>
                            <p className="mt-1">
                                Combines a battery inverter with a mains charger and transfer switch,
                                but again has no solar tracker. Panels reach it through a separate
                                MPPT charge controller on the DC side. This is the usual backbone of
                                a larger off-grid or backup system.
                            </p>
                            {inverterCharger.chips}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-800">
                                {CONTROLLER_TYPE_LABELS[CONTROLLER_TYPE.DC_DC_CHARGER]}
                            </p>
                            <p className="mt-1">
                                Charges one battery from another, typically a vehicle&apos;s starter
                                battery to a leisure bank, sometimes with a small PV input alongside.
                                Its very low maximum PV voltage suits a single panel only.
                            </p>
                            {dcdc.chips}
                        </div>
                    </div>
                </GuideDetails>
            </GuideSection>

            {/* ------------------------------------------------------- The decisive numbers */}
            <GuideSection
                title="The ratings that decide compatibility"
                subtitle="Five numbers on a controller datasheet, and what each one rules out."
            >
                <div className="space-y-3">
                    <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
                        <p className="text-sm font-bold text-slate-800">
                            Maximum PV voltage - the one that destroys hardware
                        </p>
                        <p className="mt-1">
                            An absolute ceiling, not a guideline. Your string&apos;s open-circuit
                            voltage on the coldest morning of the year must stay below it, because
                            exceeding it breaks down the input stage. This is the single most common
                            way a home-designed array kills its controller, and it is why a
                            cold-voltage breach is treated as fatal rather than as a warning.
                        </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                        <p className="text-sm font-bold text-slate-800">
                            Startup voltage - often relative to your battery
                        </p>
                        <p className="mt-1">
                            The minimum input needed before the controller will begin converting.
                            Plenty of designs do not quote a fixed figure but need battery voltage
                            plus a margin, which means the same controller demands a different string
                            on a 24 V bank than on a 48 V one.
                        </p>
                        <StatRow
                            stats={[
                                {
                                    label: 'Battery-relative startup here',
                                    value: `${
                                        chargersData.filter((c) => c.v_start_vbat_dependent === true)
                                            .length
                                    } of ${chargersData.length}`,
                                },
                            ]}
                        />
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                        <p className="text-sm font-bold text-slate-800">
                            MPPT operating window - narrower than the absolute limit
                        </p>
                        <p className="mt-1">
                            Separate from the maximum, most controllers quote the voltage band inside
                            which tracking actually works. A string can be legal and still sit
                            outside that window, where the controller runs but never finds the
                            maximum power point. Aiming for the middle of the window rather than the
                            edge of the limit is what leaves room for both temperature extremes.
                        </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                        <p className="text-sm font-bold text-slate-800">
                            Current: two different ratings
                        </p>
                        <p className="mt-1">
                            Datasheets often quote both a maximum short-circuit current and a lower
                            maximum operating current. The first is the fault current the input can
                            survive; the second is what it will actually convert continuously.
                            Wiring an array whose current sits between the two will not damage
                            anything, but the controller will clip the excess and you will have paid
                            for panels you cannot use.
                        </p>
                        {currentHeadroom.length > 0 && (
                            <div className="mt-2">
                                <ExampleChips
                                    label="Controllers here where the two differ"
                                    items={currentHeadroom.map((c) => ({
                                        key: c.id,
                                        name: c.manufacturer ? `${c.manufacturer} ${c.name}` : c.name,
                                        detail: `${c.maxIsc} A fault / ${c.maxOperatingI} A working`,
                                    }))}
                                    onSelect={setInfoModalChargerId}
                                />
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                        <p className="text-sm font-bold text-slate-800">
                            Trackers - independent MPPT inputs
                        </p>
                        <p className="mt-1">
                            Each tracker optimises its own string, so two trackers let you run a
                            south roof and an east roof from one box without either dragging the
                            other down. Panels on different orientations, tilts or shading patterns
                            should never share a tracker. You can assign one physical controller to
                            several arrays, and the summary splits its cost between them rather than
                            counting it twice.
                        </p>
                    </div>
                </div>

                <Takeaway>
                    Voltage limits are absolute and current limits are usually just wasteful, so when
                    a design is marginal, get the cold-voltage margin right first. Then check that
                    your working voltage sits inside the tracking window at both temperature
                    extremes, and only then worry about current.
                </Takeaway>
            </GuideSection>

            {/* ------------------------------------------------------- UK grid and off-grid */}
            <GuideSection
                title="Grid connection and backup"
                subtitle="The UK rules that decide which controllers you are allowed to fit."
            >
                <p>
                    If a system can push power into the network, the network operator has a say. The
                    dividing line is <span className="font-semibold text-slate-800">16 A per
                    phase</span>, which is 3.68 kW on a normal single-phase supply and 11.04 kW on
                    three-phase. Crucially it is the aggregate capacity at the premises, batteries
                    included, not just the PV inverter.
                </p>
                <p>
                    Below that threshold, fully type-tested equipment connects under{' '}
                    <span className="font-semibold text-slate-800">G98</span>, where you notify the
                    operator and can generally do so after commissioning. Above it you are in{' '}
                    <span className="font-semibold text-slate-800">G99</span>, which means applying
                    for approval before connecting and accepting whatever conditions come back.{' '}
                    <span className="font-semibold text-slate-800">G100</span> is a separate thing
                    again: the standard for export limitation. It works alongside G99 rather than
                    instead of it, and capping export is often how a larger system gets approved
                    quickly on a constrained part of the network.
                </p>

                <StatRow
                    stats={[
                        { label: 'G98 certified', value: `${grid.g98} of ${grid.total}` },
                        { label: 'G99 certified', value: `${grid.g99} of ${grid.total}` },
                        { label: 'G100 capable', value: `${grid.g100} of ${grid.total}` },
                        { label: 'Three-phase', value: `${grid.threePhase} of ${grid.total}` },
                    ]}
                />

                <p>
                    Backup capability is where specifications get slippery, because two very
                    different things get marketed similarly. An{' '}
                    <span className="font-semibold text-slate-800">emergency power supply</span>{' '}
                    output is a single protected circuit, usually with a short break while the
                    inverter switches over and a modest power limit - enough for a fridge, a router
                    and some lights.{' '}
                    <span className="font-semibold text-slate-800">Whole-house backup</span> is a
                    different proposition: it needs a changeover arrangement at the consumer unit,
                    enough continuous output for real household loads, and enough surge capacity to
                    start motors. Far fewer units genuinely do it.
                </p>

                <StatRow
                    stats={[
                        { label: 'EPS output', value: `${grid.eps} of ${grid.total}` },
                        { label: 'Whole-house backup', value: `${grid.houseBackup} of ${grid.total}` },
                        { label: 'True off-grid capable', value: `${grid.offGridNative} of ${grid.total}` },
                    ]}
                />

                <p>
                    That last figure matters for anyone building without a grid connection. Most
                    grid-tied inverters are required to shut down when they cannot see a healthy
                    mains supply, an anti-islanding safety measure that protects anyone working on
                    the network. A unit that can form its own AC waveform and run indefinitely with
                    no grid present at all is a genuinely different design, and it is what the
                    off-grid filter in the controller selector is looking for.
                </p>

                <Takeaway>
                    Decide your system type before shortlisting controllers, because it eliminates
                    most of the catalogue immediately. The array&apos;s Controller Selector tab has
                    filters for exactly these fields - battery voltage, grid-connected against
                    off-grid, and whether you need emergency or whole-house backup - and they apply
                    across the whole area.
                </Takeaway>
            </GuideSection>

            {/* ------------------------------------------------------------ Bridge back home */}
            <GuideSection
                title="Putting it together"
                subtitle="From these specifications back to your arrays."
            >
                <p>
                    A workable choice comes down to four questions in order: does it suit your system
                    type and battery voltage, will your string stay under its voltage ceiling when
                    cold, will it still start when hot, and can its trackers take your current. The
                    first eliminates most candidates, and the remaining three are the checks Solar
                    Pear runs for you on every array.
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
