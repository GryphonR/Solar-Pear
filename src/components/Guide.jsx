/**
 * @file Guide.jsx
 * Onboarding launchpad for Solar Pear, shown as the default tab on first load.
 *
 * The page is deliberately action-first rather than a reference document:
 *   1. three entry routes (roof / panel / controller) wired to the real controls,
 *   2. live progress for the array those routes act on,
 *   3. one explainer for the compatibility maths the whole app is built around,
 *   4. reference material collapsed out of the way.
 *
 * Worked-example figures are derived from the same helpers as the analysis engine, so the
 * numbers printed here cannot drift away from what the app actually calculates.
 */

import React from 'react';
import SolarPearLogo from './SolarPearLogo';
import {
    Layers,
    Server,
    Database,
    LayoutDashboard,
    AlertTriangle,
    CheckCircle,
    ChevronDown,
    Info,
    Download,
    Upload,
    RotateCcw,
} from './Icons';
import { useDataState, useUiState } from '../context/AppStateContext';
import {
    coldVocFactor,
    hotVmpFactor,
    hotIscFactor,
    getEffectiveStartupV,
    COLD_TEMP_C,
    HOT_TEMP_C,
    STC_TEMP_C,
    VOC_WARN_FRACTION,
} from '../lib/arrayAnalysis';

/**
 * Panel used by the worked example. Real specs, taken from the Jinko Tiger Neo 430W in the
 * bundled database, so the derived voltages are representative of a genuine choice.
 */
const EXAMPLE_PANEL = {
    name: 'Jinko Tiger Neo 430W',
    voc: 38.52,
    vmp: 31.88,
    isc: 14.23,
    tempCoefVoc: -0.25,
    tempCoefPmax: -0.29,
    tempCoefIsc: 0.045,
};

/**
 * Controller used by the worked example. Real specs, taken from the Victron EasySolar-II
 * 48/3000. Its startup voltage is battery-relative, which is why the example shows
 * `battery + 5 V` rather than a flat figure.
 */
export const EXAMPLE_CONTROLLER = {
    name: 'Victron EasySolar-II 48/3000',
    maxV: 250,
    maxIsc: 50,
    startupV: 5,
    v_start_vbat_dependent: true,
};

/** Battery voltage assumed by the worked example. */
const EXAMPLE_SYSTEM_VOLTAGE = 48;

/**
 * Total panels in the worked example. Twelve is chosen deliberately: of its possible wirings
 * exactly one clears every limit, and the two that fail do so for opposite reasons and by
 * margins small enough that neither is obvious from the datasheet.
 */
const EXAMPLE_PANEL_COUNT = 12;

/** Effective startup voltage for the example controller on a 48 V battery. */
const EXAMPLE_STARTUP_V = getEffectiveStartupV(EXAMPLE_CONTROLLER, EXAMPLE_SYSTEM_VOLTAGE);

/**
 * Evaluates the three compatibility figures for one wiring of the example array.
 * Mirrors `analyzeArray`: series length drives voltage, parallel strings drive current.
 *
 * @param {number} parallelStrings How many strings the panels are split across.
 * @returns {{
 *   label: string,
 *   stcVoc: number,
 *   coldVoc: number, vocOk: boolean,
 *   hotVmp: number, vmpOk: boolean,
 *   hotIsc: number, iscOk: boolean,
 *   passes: boolean
 * }}
 */
function evaluateExampleWiring(parallelStrings) {
    const series = EXAMPLE_PANEL_COUNT / parallelStrings;

    // Datasheet (STC) string voltage - the figure that makes an unsafe string look safe.
    const stcVoc = EXAMPLE_PANEL.voc * series;
    const coldVoc = stcVoc * coldVocFactor(EXAMPLE_PANEL);
    const hotVmp = EXAMPLE_PANEL.vmp * series * hotVmpFactor(EXAMPLE_PANEL);
    const hotIsc = EXAMPLE_PANEL.isc * parallelStrings * hotIscFactor(EXAMPLE_PANEL);

    const vocOk = coldVoc <= EXAMPLE_CONTROLLER.maxV;
    const vmpOk = hotVmp >= EXAMPLE_STARTUP_V;
    const iscOk = hotIsc <= EXAMPLE_CONTROLLER.maxIsc;

    return {
        label: `${series}S${parallelStrings}P`,
        stcVoc,
        coldVoc,
        vocOk,
        hotVmp,
        vmpOk,
        hotIsc,
        iscOk,
        // Voc is the only hard safety gate; Vmp below startup and Isc overage are operational warnings.
        passes: vocOk,
        lowStartup: !vmpOk,
        clips: !iscOk,
    };
}

/**
 * The three adjacent wirings of 12 panels, in order of decreasing string length. Voltage falls
 * and current rises down the list, so the viable option sits between a voltage failure above
 * it and a current failure below it.
 *
 * Exported so `Guide.test.jsx` can assert the properties that make the example teach the right
 * lesson, chiefly that no row fails for a reason a reader could misattribute.
 */
export const EXAMPLE_WIRINGS = [2, 3, 4].map(evaluateExampleWiring);
/** 6S2P - fails on cold voltage despite a datasheet figure well inside the limit. */
const EXAMPLE_TOO_SERIES = EXAMPLE_WIRINGS[0];
/** 4S3P - the only wiring of the three that clears every limit. */
const EXAMPLE_WORKS = EXAMPLE_WIRINGS[1];
/** 3S4P - fails on hot current after one split too many. */
const EXAMPLE_TOO_PARALLEL = EXAMPLE_WIRINGS[2];

/**
 * A single numbered entry route on the launchpad.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.icon Leading glyph.
 * @param {string} props.accent Tailwind classes for the icon chip colour.
 * @param {string} props.title Route name.
 * @param {string} props.forWho Who this route suits, shown as the lead-in line.
 * @param {import('react').ReactNode} props.children Body copy.
 * @param {string} props.action Button label.
 * @param {() => void} props.onAction Invoked when the route is chosen.
 */
const EntryRoute = ({ icon, accent, title, forWho, children, action, onAction }) => (
    <div className="flex flex-col bg-white p-5 rounded-xl shadow-sm border border-slate-200/80 hover:border-blue-300 transition-colors">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mb-3 ${accent}`}>
            {icon}
        </div>
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-1">{forWho}</p>
        <p className="text-slate-600 leading-relaxed text-sm mt-2 flex-1">{children}</p>
        <button
            type="button"
            onClick={onAction}
            className="mt-4 w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
            {action}
        </button>
    </div>
);

/**
 * Progress pill for one of the three things every array needs. Doubles as a shortcut back
 * to the relevant tab, so a returning user can resume without re-reading the page.
 *
 * @param {object} props
 * @param {boolean} props.done Whether the step is satisfied for the target array.
 * @param {string} props.label Step name.
 * @param {string} [props.detail] What was chosen, shown once the step is done.
 * @param {() => void} props.onClick Jumps to the step's tab.
 */
const ProgressPill = ({ done, label, detail, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors min-w-0 ${
            done
                ? 'bg-green-50 border-green-200 hover:border-green-300'
                : 'bg-white border-slate-200 hover:border-slate-300'
        }`}
    >
        {done ? (
            <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
        ) : (
            <span
                className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0"
                aria-hidden
            />
        )}
        <span className="min-w-0">
            <span className={`block text-sm font-semibold ${done ? 'text-green-800' : 'text-slate-700'}`}>
                {label}
            </span>
            {done && detail && (
                <span className="block text-xs text-green-700 truncate">{detail}</span>
            )}
        </span>
    </button>
);

/**
 * Collapsible reference section. Closed by default so the launchpad stays the focus.
 *
 * @param {object} props
 * @param {string} props.title Section heading.
 * @param {import('react').ReactNode} props.children Section body.
 */
const ReferenceSection = ({ title, children }) => (
    <details className="group border-b border-slate-200 last:border-b-0">
        <summary className="flex items-center justify-between gap-3 py-3.5 px-5 cursor-pointer list-none hover:bg-slate-50/80 transition-colors">
            <span className="text-sm font-semibold text-slate-800">{title}</span>
            <ChevronDown
                size={16}
                className="text-slate-400 flex-shrink-0 transition-transform group-open:rotate-180"
            />
        </summary>
        <div className="px-5 pb-5 pt-1 text-sm text-slate-600 leading-relaxed space-y-3">
            {children}
        </div>
    </details>
);

/**
 * Guide / launchpad page.
 *
 * @returns {import('react').ReactElement}
 */
const Guide = () => {
    const { arraysData, areasData, getArrayAnalysis } = useDataState();
    const { setActiveTab, setActiveArrayContentTab, openAddArrayModal } = useUiState();

    // Every route acts on a concrete array. The app seeds one, so this is normally present;
    // if the user has deleted them all, the routes offer to create one instead.
    const targetArray = arraysData?.[0] ?? null;
    const analysis = targetArray ? getArrayAnalysis(targetArray.id) : null;

    // A saved planner object is what "Apply Array" writes, so it marks the layout as defined.
    const hasLayout = !!targetArray?.planner;
    const chosenPanel = analysis?.panel ?? null;
    const chosenController = analysis?.controller ?? null;

    /**
     * Opens a specific tab of the target array, creating an array first if none exist.
     *
     * @param {'overview' | 'layout' | 'panels' | 'controllers'} contentTab
     */
    const openArrayTab = (contentTab) => {
        if (!targetArray) {
            openAddArrayModal({ area: areasData[0] || 'House' });
            return;
        }
        setActiveArrayContentTab((prev) => ({ ...prev, [targetArray.id]: contentTab }));
        setActiveTab(targetArray.id);
    };

    /** Name of the array the routes below will open, for use in body copy. */
    const targetName = targetArray?.name ?? 'a new array';

    return (
        <div className="max-w-4xl mx-auto space-y-8 py-8 px-4">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-200/80 py-2.5 px-4 text-amber-800 text-sm font-medium tracking-wide">
                <span className="inline-flex items-center rounded-md bg-amber-200/60 px-2 py-0.5 font-semibold uppercase tracking-wider text-amber-900 text-xs">
                    Beta
                </span>
                <span>This tool is in beta. Data and features may change. We welcome feedback.</span>
            </div>

            <header className="text-center space-y-4 pt-2">
                <SolarPearLogo className="w-56 h-auto text-slate-900 mx-auto" />
                <p className="text-lg text-slate-600 max-w-xl mx-auto leading-relaxed">
                    Free roofspace, panel, and controller matching. Check that the panels you want
                    physically fit your roof and stay electrically safe with the controller driving
                    them.
                </p>
            </header>

            {/* ---------------------------------------------------------------- Start here */}
            <section
                aria-labelledby="guide-start-here"
                className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
            >
                <div className="p-5 border-b border-slate-100 bg-slate-50/80">
                    <h2 id="guide-start-here" className="text-lg font-bold text-slate-800">
                        Start here
                    </h2>
                    <p className="text-slate-600 text-sm mt-1">
                        Pick whichever you already know. All three routes lead to the same place, and
                        you can switch between them at any time.
                    </p>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <EntryRoute
                        icon={<Layers size={18} />}
                        accent="bg-blue-100 text-blue-600"
                        title="Start from the roof"
                        forWho="You know your roof"
                        action="Draw the roof"
                        onAction={() => openArrayTab('layout')}
                    >
                        Draw the outline, mark obstructions, and the planner works out how many panels
                        fit. Applying a layout sets the panel count, orientation, and size limits on{' '}
                        {targetName} for you.
                    </EntryRoute>

                    <EntryRoute
                        icon={<Database size={18} />}
                        accent="bg-amber-100 text-amber-600"
                        title="Start from a panel"
                        forWho="You have a module in mind"
                        action="Choose a panel"
                        onAction={() => openArrayTab('panels')}
                    >
                        Already own panels, or been quoted a specific model? Select it and the
                        controller list narrows to units that can safely drive it.
                    </EntryRoute>

                    <EntryRoute
                        icon={<Server size={18} />}
                        accent="bg-purple-100 text-purple-600"
                        title="Start from a controller"
                        forWho="You own the electronics"
                        action="Choose a controller"
                        onAction={() => openArrayTab('controllers')}
                    >
                        Already have an MPPT charge controller or hybrid inverter? Pick it first, set
                        your battery voltage and system type, and the panel list narrows to fit.
                    </EntryRoute>
                </div>

                <div className="px-5 pb-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        {targetArray ? `${targetArray.name} needs all three` : 'Every array needs all three'}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <ProgressPill
                            done={hasLayout}
                            label="Layout"
                            detail={
                                targetArray
                                    ? `${targetArray.count} panel${targetArray.count === 1 ? '' : 's'}`
                                    : undefined
                            }
                            onClick={() => openArrayTab('layout')}
                        />
                        <ProgressPill
                            done={!!chosenPanel}
                            label="Panel"
                            detail={chosenPanel?.name}
                            onClick={() => openArrayTab('panels')}
                        />
                        <ProgressPill
                            done={!!chosenController}
                            label="Controller"
                            detail={chosenController?.name}
                            onClick={() => openArrayTab('controllers')}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setActiveTab('SUMMARY')}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                    >
                        <LayoutDashboard size={16} />
                        View System Summary and costs
                    </button>
                </div>
            </section>

            {/* ------------------------------------------------- The compatibility explainer */}
            <section
                aria-labelledby="guide-three-checks"
                className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
            >
                <div className="p-5 border-b border-slate-100 bg-slate-50/80">
                    <h2 id="guide-three-checks" className="text-lg font-bold text-slate-800">
                        The three checks that decide compatibility
                    </h2>
                    <p className="text-slate-600 text-sm mt-1">
                        This is what turns an array green or red. Panels behave differently when hot
                        and cold, so each check uses the worst case rather than the datasheet figure.
                    </p>
                </div>

                <div className="p-5 space-y-3">
                    <div className="rounded-lg border border-slate-200 p-4">
                        <p className="text-sm font-bold text-slate-800">
                            1. Cold voltage must stay under the controller&apos;s limit
                        </p>
                        <p className="text-sm text-slate-600 leading-relaxed mt-1">
                            Panel voltage <span className="font-semibold">rises</span> as it gets
                            colder, so the danger point is a freezing, bright morning. This check adds
                            up the open-circuit voltage (Voc) of every panel in a series string at{' '}
                            {COLD_TEMP_C}&nbsp;°C. Exceed the controller&apos;s maximum PV input and you
                            destroy it, which is why this failure is fatal rather than a warning. Come
                            within {Math.round((1 - VOC_WARN_FRACTION) * 100)}% of the limit and you
                            get a warning that the margin is too tight.
                        </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                        <p className="text-sm font-bold text-slate-800">
                            2. Hot voltage and the startup threshold
                        </p>
                        <p className="text-sm text-slate-600 leading-relaxed mt-1">
                            Voltage <span className="font-semibold">falls</span> as panels heat up, so
                            the concern is a hot afternoon. If the string&apos;s working voltage
                            (Vmp) at {HOT_TEMP_C}&nbsp;°C drops below what the controller needs to wake
                            up, the MPPT will not start during peak heat — causing temporary harvest
                            loss. This is not a hardware risk: the controller simply waits until the
                            panels cool enough to exceed its startup threshold again. Note that many
                            controllers need battery voltage plus a margin, so the threshold moves with
                            your battery bank.
                        </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                        <p className="text-sm font-bold text-slate-800">
                            3. Hot current and clipping
                        </p>
                        <p className="text-sm text-slate-600 leading-relaxed mt-1">
                            Current rises slightly with heat, and adding strings in{' '}
                            <span className="font-semibold">parallel</span> multiplies it. If the
                            combined short-circuit current (Isc) at {HOT_TEMP_C}&nbsp;°C exceeds the
                            controller&apos;s current rating, the MPPT shifts off the maximum power
                            point to cap output current. This wastes panel capacity but does not damage
                            hardware — unlike a voltage overage.
                        </p>
                    </div>

                    {/* Worked example: figures computed with the engine's own helpers. */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                        <p className="text-sm font-bold text-slate-800">
                            Worked example: why wiring matters as much as the parts
                        </p>
                        <p className="text-sm text-slate-600 leading-relaxed mt-1">
                            Take {EXAMPLE_PANEL_COUNT}&nbsp;× {EXAMPLE_PANEL.name} on a{' '}
                            {EXAMPLE_CONTROLLER.name}: {EXAMPLE_CONTROLLER.maxV}&nbsp;V maximum PV
                            input, {EXAMPLE_CONTROLLER.maxIsc}&nbsp;A maximum current, and a{' '}
                            {EXAMPLE_SYSTEM_VOLTAGE}&nbsp;V battery putting startup at{' '}
                            {EXAMPLE_STARTUP_V}&nbsp;V. The panels and the controller never change
                            below - only how they are wired.
                        </p>

                        <div className="mt-3 overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        <th className="py-1.5 pr-3 font-bold">Wiring</th>
                                        <th className="py-1.5 pr-3 font-bold">
                                            Datasheet Voc
                                            <span className="block font-medium normal-case tracking-normal text-slate-400">
                                                at {STC_TEMP_C}&nbsp;°C
                                            </span>
                                        </th>
                                        <th className="py-1.5 pr-3 font-bold">
                                            Cold Voc
                                            <span className="block font-medium normal-case tracking-normal text-slate-400">
                                                max {EXAMPLE_CONTROLLER.maxV}&nbsp;V
                                            </span>
                                        </th>
                                        <th className="py-1.5 pr-3 font-bold">
                                            Hot Vmp
                                            <span className="block font-medium normal-case tracking-normal text-slate-400">
                                                min {EXAMPLE_STARTUP_V}&nbsp;V
                                            </span>
                                        </th>
                                        <th className="py-1.5 font-bold">
                                            Hot Isc
                                            <span className="block font-medium normal-case tracking-normal text-slate-400">
                                                max {EXAMPLE_CONTROLLER.maxIsc}&nbsp;A
                                            </span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {EXAMPLE_WIRINGS.map((w) => (
                                        <tr key={w.label} className="border-t border-blue-200/70">
                                            <td className="py-2 pr-3">
                                                <span className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                                                    {!w.passes ? (
                                                        <AlertTriangle
                                                            size={14}
                                                            className="text-red-500 flex-shrink-0"
                                                        />
                                                    ) : (w.lowStartup || w.clips) ? (
                                                        <AlertTriangle
                                                            size={14}
                                                            className="text-orange-500 flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <CheckCircle
                                                            size={14}
                                                            className="text-green-600 flex-shrink-0"
                                                        />
                                                    )}
                                                    {w.label}
                                                </span>
                                            </td>
                                            <td className="py-2 pr-3 text-slate-500 tabular-nums">
                                                {w.stcVoc.toFixed(1)} V
                                            </td>
                                            <td
                                                className={`py-2 pr-3 tabular-nums ${
                                                    w.vocOk ? 'text-slate-700' : 'text-red-600 font-bold'
                                                }`}
                                            >
                                                {w.coldVoc.toFixed(1)} V
                                            </td>
                                            <td
                                                className={`py-2 pr-3 tabular-nums ${
                                                    w.vmpOk ? 'text-slate-700' : 'text-orange-500 font-bold'
                                                }`}
                                            >
                                                {w.hotVmp.toFixed(1)} V
                                            </td>
                                            <td
                                                className={`py-2 tabular-nums ${
                                                    w.iscOk ? 'text-slate-700' : 'text-orange-500 font-bold'
                                                }`}
                                            >
                                                {w.hotIsc.toFixed(1)} A
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <p className="text-sm text-slate-600 leading-relaxed mt-3">
                            <span className="font-mono font-semibold text-slate-800">
                                {EXAMPLE_TOO_SERIES.label}
                            </span>{' '}
                            looks fine on paper: {EXAMPLE_TOO_SERIES.stcVoc.toFixed(1)}&nbsp;V of
                            datasheet voltage against a {EXAMPLE_CONTROLLER.maxV}&nbsp;V input, nearly{' '}
                            {Math.round(EXAMPLE_CONTROLLER.maxV - EXAMPLE_TOO_SERIES.stcVoc)}&nbsp;V
                            spare. Correct it to {COLD_TEMP_C}&nbsp;°C, though, and it reaches{' '}
                            {EXAMPLE_TOO_SERIES.coldVoc.toFixed(1)}&nbsp;V - over the limit by{' '}
                            {(EXAMPLE_TOO_SERIES.coldVoc - EXAMPLE_CONTROLLER.maxV).toFixed(1)}&nbsp;V,
                            on the coldest mornings only, which is exactly the kind of failure a
                            datasheet comparison misses.
                        </p>
                        <p className="text-sm text-slate-600 leading-relaxed mt-2">
                            Spreading the same {EXAMPLE_PANEL_COUNT} panels across another string
                            shortens each one, so{' '}
                            <span className="font-mono font-semibold text-slate-800">
                                {EXAMPLE_WORKS.label}
                            </span>{' '}
                            drops to {EXAMPLE_WORKS.coldVoc.toFixed(1)}&nbsp;V and passes - but current
                            climbs to {EXAMPLE_WORKS.hotIsc.toFixed(1)}&nbsp;A of the{' '}
                            {EXAMPLE_CONTROLLER.maxIsc}&nbsp;A budget. Split once more and{' '}
                            <span className="font-mono font-semibold text-slate-800">
                                {EXAMPLE_TOO_PARALLEL.label}
                            </span>{' '}
                            exceeds that at {EXAMPLE_TOO_PARALLEL.hotIsc.toFixed(1)}&nbsp;A — the
                            controller will clip, wasting the extra capacity. Voltage limits are hard
                            (hardware destruction); current limits cost efficiency. The Parallel Strings
                            selector picks the wiring that avoids both.
                        </p>
                    </div>
                </div>
            </section>

            {/* ------------------------------------------------------ Technology deep dives */}
            <section
                aria-labelledby="guide-technology"
                className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
            >
                <div className="p-5 border-b border-slate-100 bg-slate-50/80">
                    <h2 id="guide-technology" className="text-lg font-bold text-slate-800">
                        Understand the hardware
                    </h2>
                    <p className="text-slate-600 text-sm mt-1">
                        Longer explainers on what actually differs between the parts you are choosing
                        between.
                    </p>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => setActiveTab('GUIDE_PANELS')}
                        className="flex flex-col text-left bg-white p-4 rounded-xl border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
                            <Database size={18} />
                        </div>
                        <h3 className="text-base font-bold text-slate-800">Guide to panels</h3>
                        <p className="text-slate-600 leading-relaxed text-sm mt-1">
                            Mono and poly, PERC through TOPCon and HJT to back-contact, busbars, glass
                            construction, and whether bifacial is worth it on a roof.
                        </p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('GUIDE_CONTROLLERS')}
                        className="flex flex-col text-left bg-white p-4 rounded-xl border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
                            <Server size={18} />
                        </div>
                        <h3 className="text-base font-bold text-slate-800">Guide to controllers</h3>
                        <p className="text-slate-600 leading-relaxed text-sm mt-1">
                            PWM against MPPT, the seven device families, the ratings that decide
                            compatibility, and the UK grid rules that narrow your options.
                        </p>
                    </button>
                </div>
            </section>

            {/* -------------------------------------------------------- Collapsed reference */}
            <section
                aria-labelledby="guide-reference"
                className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
            >
                <div className="p-5 border-b border-slate-100 bg-slate-50/80">
                    <h2 id="guide-reference" className="text-lg font-bold text-slate-800">
                        Reference
                    </h2>
                    <p className="text-slate-600 text-sm mt-1">
                        Open any of these when you need them. You do not need them to get started.
                    </p>
                </div>

                <div>
                    <ReferenceSection title="Areas and Arrays - how a project is organised">
                        <p>
                            An <span className="font-semibold text-slate-800">Area</span> is a named
                            part of your site, such as House, Garage, or Outbuilding. It groups arrays
                            that share one electrical system, so the battery voltage and system type
                            you choose apply to every array in that Area.
                        </p>
                        <p>
                            An <span className="font-semibold text-slate-800">Array</span> is one
                            physical group of panels inside an Area, with its own roof layout, panel
                            choice, and controller. Add and rename both from the sidebar; the app
                            starts you off with a House area containing one array.
                        </p>
                        <p>
                            Battery voltage and system type are set in an array&apos;s{' '}
                            <span className="font-semibold text-slate-800">Controller Selector</span>{' '}
                            tab, alongside the controller filters they drive, and apply to the whole
                            Area.
                        </p>
                    </ReferenceSection>

                    <ReferenceSection title="Controllers, MPPTs, and hybrid inverters">
                        <p>
                            &quot;PV controller&quot; covers both kinds of device that a panel string
                            can connect to: a standalone{' '}
                            <span className="font-semibold text-slate-800">MPPT charge controller</span>{' '}
                            feeding a battery, and a{' '}
                            <span className="font-semibold text-slate-800">hybrid inverter</span> that
                            combines charging, battery management, and AC output. Both are listed
                            together and checked against the same three limits.
                        </p>
                        <p>
                            One physical controller often has several independent MPPT inputs, so you
                            can assign the same unit to more than one array. When you do, the Summary
                            splits its cost between them rather than counting it twice.
                        </p>
                    </ReferenceSection>

                    <ReferenceSection title="Series and parallel strings (what 5S2P means)">
                        <p>
                            Panels wired in <span className="font-semibold text-slate-800">series</span>{' '}
                            add their voltages; strings wired in{' '}
                            <span className="font-semibold text-slate-800">parallel</span> add their
                            currents. A label like{' '}
                            <span className="font-mono text-slate-800">5S2P</span> means two parallel
                            strings of five panels in series, so ten panels in total.
                        </p>
                        <p>
                            Because every string must contain the same number of panels, the parallel
                            string count has to divide the panel count exactly. The wiring selector
                            only offers valid divisors and flags an invalid combination as a fatal
                            wiring error.
                        </p>
                    </ReferenceSection>

                    <ReferenceSection title="The two databases">
                        <p>
                            <span className="font-semibold text-slate-800">Panels</span> and{' '}
                            <span className="font-semibold text-slate-800">PV Controllers</span> in the
                            sidebar are your catalogue, not where you pick parts for an array. Use them
                            to add your own models, record prices, and untick anything you cannot buy  - 
                            for instance limiting panels to those available in the UK.
                        </p>
                        <p>
                            Deactivated entries stop appearing in the per-array selectors, which is the
                            quickest way to cut a long list down to what your supplier actually stocks.
                        </p>
                    </ReferenceSection>

                    <ReferenceSection title="What the status icons mean">
                        <p className="flex items-start gap-2">
                            <CheckCircle size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                            <span>
                                <span className="font-semibold text-slate-800">Green</span> - the
                                combination fits physically and stays within every electrical limit.
                            </span>
                        </p>
                        <p className="flex items-start gap-2">
                            <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                            <span>
                                <span className="font-semibold text-slate-800">Amber</span> - either
                                something is still unselected, or a limit is met with too little margin
                                to be comfortable.
                            </span>
                        </p>
                        <p className="flex items-start gap-2">
                            <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                            <span>
                                <span className="font-semibold text-slate-800">Red</span> - a hard
                                failure: a broken limit, invalid wiring, or a panel that will not
                                physically fit the array&apos;s constraints. The message says which.
                            </span>
                        </p>
                    </ReferenceSection>

                    <ReferenceSection title="Temperature and physical assumptions">
                        <p>
                            Voltage headroom is checked at {COLD_TEMP_C}&nbsp;°C and startup and current
                            at {HOT_TEMP_C}&nbsp;°C, both cell temperatures rather than air
                            temperatures. Figures come from each panel&apos;s published temperature
                            coefficients; where a datasheet omits one, a conservative typical value is
                            used instead.
                        </p>
                        <p>
                            For in-roof (GSE) mounting, panels are additionally checked against tray
                            orientation, since some modules only suit portrait or only landscape trays.
                            On-roof mounting has no such restriction.
                        </p>
                    </ReferenceSection>
                </div>
            </section>

            {/* ------------------------------------------------------------- Saving your work */}
            <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/80">
                    <h2 className="text-lg font-bold text-slate-800">Saving your work</h2>
                    <p className="text-slate-600 text-sm mt-1">
                        Projects live in this browser only. Clearing site data loses them, so export a
                        backup once you have something worth keeping.
                    </p>
                </div>
                <div className="p-5 grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                            <Download size={16} className="flex-shrink-0" />
                            <span>Save</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Export the whole project to a{' '}
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                                .json
                            </span>{' '}
                            file from the sidebar.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                            <Upload size={16} className="flex-shrink-0" />
                            <span>Restore</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Import a backup to pick up on another device, or after clearing browser
                            data.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-red-600 font-semibold text-sm">
                            <RotateCcw size={16} className="flex-shrink-0" />
                            <span>Reset</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Clears local project data and returns the app to defaults. Back up first.
                        </p>
                    </div>
                </div>
            </section>

            {/* ------------------------------------------------------------------- Limitations */}
            <section className="bg-slate-900 rounded-xl p-6 text-slate-300 border border-slate-700/80 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <Info className="text-amber-400 flex-shrink-0" size={22} />
                    <h2 className="text-lg font-bold text-white">What this tool does not do</h2>
                </div>
                <ul className="space-y-3 text-sm list-disc list-inside">
                    <li>
                        <span className="text-white font-medium">Prices are placeholders:</span> enter
                        your own quotes before trusting any budget figure.
                    </li>
                    <li>
                        <span className="text-white font-medium">The BoM covers panels and controllers only:</span>{' '}
                        not mounting, cabling, isolators, or labour.
                    </li>
                    <li>
                        <span className="text-white font-medium">Compatibility, not design:</span> it
                        validates electrical and physical limits, and does not produce wiring diagrams,
                        yield estimates, or shading analysis.
                    </li>
                    <li>
                        <span className="text-white font-medium">Always check the datasheet:</span>{' '}
                        database figures and generated notes can contain errors. Confirm anything you
                        are about to buy.
                    </li>
                </ul>
            </section>
        </div>
    );
};

export default Guide;
