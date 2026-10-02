/**
 * @file ArrayPage.jsx
 * Array page in the new shell (roadmap 13.6, canvas board "Array Overview hub"): header, Overview /
 * Layout / Panel tabs, and the Overview hub with the three slots, the checks and the temperature
 * response. Controllers are managed on the system's Controllers tab, so there is no controller tab here.
 * Layout is the planner (`shell/planner`), Panel the ranked panel table (`PanelChooser`).
 */

import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { EditableTitle, SlotCard, StatusPill } from '../../components/ui';
import PriceTag from '../../components/PriceTag';
import ArrayOverviewGraphs from '../../components/ArrayOverviewGraphs';
import { ResultsDisclaimer } from '../../components/TrustNotices';
import LayoutPlanner from '../planner/LayoutPlanner';
import PanelChooser from '../PanelChooser';
import ParallelStringsSelect from '../../views/arraySelector/ParallelStringsSelect';
import SystemSettingsSummary from '../SystemSettingsSummary';
import { isMicroinverter } from '../../lib/arrayAnalysis';
import { controllerTypeLabel } from '../../lib/controllerTypes';
import { buildPath } from '../../lib/routes';
import { formatMoney } from '../../lib/pricing';
import { freePorts, portName } from '../../lib/ports';
import { kWp } from './ProjectOverview';
import { useDataState, useUiState } from '../../context/AppStateContext';

const TABS = [
    ['overview', 'Overview'],
    ['layout', 'Layout'],
    ['panel', 'Panel'],
];

const round = (v) => Math.round(v);
const statusFor = (issues, codes) => {
    const hit = issues.filter((i) => codes.includes(i.code));
    if (hit.some((i) => i.severity === 'error')) return 'error';
    if (hit.some((i) => i.severity === 'warning')) return 'warning';
    return 'valid';
};

/**
 * Rows of the checks table, read from the analysis (values and the engine's own issue codes). Only rows
 * whose limit the controller publishes are shown.
 */
export function checkRows(a) {
    if (!a?.panel || !a?.controller) return [];
    const c = a.controller;
    const p = a.panel;
    const issues = a.issues || [];
    const rows = [
        { label: `Cold Voc (${a.conditions.coldTempC} °C)`, value: `${round(a.coldVoc)} / ${c.maxV} V`, status: statusFor(issues, ['voc', 'vocMargin', 'noPvInput']) },
    ];
    if (p.maxSystemVoltage) {
        rows.push({ label: 'Cold Voc vs panel rating', value: `${round(a.coldVoc)} / ${p.maxSystemVoltage} V`, status: statusFor(issues, ['panelSystemVoltage']) });
    }
    // The engine reports some findings only once: hot Vmp below startup is not raised when Voc already is,
    // MPPT-min is not raised when startup already fails, and clipping is not raised when Isc is over the
    // rating. Those rows take the covering check's status.
    const flags = a.flags || {};
    if (a.effectiveStartupV) {
        rows.push({ label: 'Voc vs startup (25 °C)', value: `${round(a.stcVoc)} / ${a.effectiveStartupV} V`, status: statusFor(issues, ['vocStartup']) });
        const startupCodes = flags.isVocStartupOk === false ? ['vmpStartup', 'vocStartup'] : ['vmpStartup'];
        rows.push({ label: `Hot Vmp vs startup (${a.conditions.hotTempC} °C)`, value: `${round(a.hotVmp)} / ${a.effectiveStartupV} V`, status: statusFor(issues, startupCodes) });
    }
    if (c.mpptRangeMin > 0 && c.v_start_vbat_dependent !== true) {
        const codes = flags.isVmpOk === false ? ['mpptMin', 'vmpStartup', 'vocStartup'] : ['mpptMin'];
        rows.push({ label: 'Hot Vmp vs MPPT min', value: `${round(a.hotVmp)} / ${c.mpptRangeMin} V`, status: statusFor(issues, codes) });
    }
    if (c.mpptRangeMax > 0) rows.push({ label: 'Cold Vmp vs MPPT max', value: `${round(a.coldVmp)} / ${c.mpptRangeMax} V`, status: statusFor(issues, ['mpptMax']) });
    if (c.maxIsc > 0) rows.push({ label: 'Hot Isc', value: `${a.arrayIscHot.toFixed(1)} / ${c.maxIsc} A`, status: statusFor(issues, ['iscRating']) });
    if (a.currentClipLimit > 0) {
        const codes = flags.isIscOverRating ? ['currentClip', 'iscRating'] : ['currentClip'];
        rows.push({ label: 'Hot Imp vs operating', value: `${a.arrayImpHot.toFixed(1)} / ${a.currentClipLimit} A`, status: statusFor(issues, codes) });
    }
    return rows;
}

function ControllerSlot({ entry, system, projectId, arraysData, siteControllers, chargersData, updateSelection }) {
    const a = entry.analysis;
    const navigate = useNavigate();
    const controllersTo = buildPath({ view: 'system', projectId, systemId: system.id, tab: 'controllers' });
    const instances = siteControllers.filter((sc) => sc.area === system.name);
    const systemArrays = arraysData.filter((x) => x.area === system.name);
    const free = freePorts(instances, systemArrays, chargersData);

    // Options carry full controller names, so the select gets a set width instead of sizing to the longest.
    const portPicker = (width) => free.length > 0 ? (
        <select
            aria-label={a?.controller ? 'Change port' : 'Assign a port'}
            value=""
            onChange={(e) => {
                const [instanceId, port] = e.target.value.split('|');
                if (instanceId) updateSelection(entry.id, 'controllerInstance', instanceId, Number(port));
            }}
            className={`h-8 min-w-0 rounded-md border border-line-strong bg-white px-2 text-xs ${width}`}
        >
            <option value="">{a?.controller ? 'Change port…' : 'Assign a free port…'}</option>
            {free.map((f) => (
                <option key={`${f.instanceId}|${f.port}`} value={`${f.instanceId}|${f.port}`}>
                    {f.instance.name} · {portName(f.model, f.port)}
                </option>
            ))}
        </select>
    ) : null;

    if (!a?.controller) {
        return (
            <div className="flex flex-col gap-2">
                <SlotCard
                    eyebrow="3 · Controller"
                    state="empty"
                    title={free.length ? 'Assign a controller port' : 'Add a controller'}
                    detail={`Controllers are managed on the ${system.name} system's Controllers tab.`}
                    onAction={() => navigate(controllersTo)}
                />
                {free.length > 0 ? <div className="text-[13px]">{portPicker('w-full')}</div> : null}
            </div>
        );
    }

    const c = a.controller;
    const shared = arraysData.filter((x) => x.id !== entry.id && x.controllerInstanceId && x.controllerInstanceId === a.controllerInstance?.id);
    const controllerIssue = (a.issues || []).find((i) => i.severity === 'error' || i.severity === 'warning');
    const attention = entry.status === 'error' || entry.status === 'warning';
    return (
        <article className={`flex flex-col gap-2 rounded-[10px] border bg-white p-4 ${attention ? 'border-status-warning-line' : 'border-line'}`}>
            <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-xs font-semibold tracking-[0.08em] whitespace-nowrap text-muted uppercase">3 · Controller</span>
                {portPicker('w-36')}
            </div>
            <span className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">
                {c.manufacturer} · {controllerTypeLabel(c.type, { short: true })}
            </span>
            <span className="text-base font-semibold">
                {c.name}
                {isMicroinverter(c) ? ` · ${a.controllerUnits} units` : ` · MPPT ${a.mpptIndex || 1}`}
            </span>
            {shared.length > 0 ? <span className="text-[13px] text-subtle">Shared with {shared.map((x) => x.name).join(', ')}</span> : null}
            {controllerIssue ? (
                <span className={`text-[13px] font-semibold ${controllerIssue.severity === 'error' ? 'text-status-error-fg' : 'text-status-warning-fg'}`}>
                    {controllerIssue.message}
                </span>
            ) : null}
            <Link to={controllersTo} className="text-[13px] text-secondary hover:underline">
                Controllers are managed on the {system.name} system
            </Link>
        </article>
    );
}

function ArrayHub({ entry, system, projectId, settings, setupTo }) {
    const { arraysData, siteControllers, chargersData, updateSelection, updateArray, userNotes, updateUserNote } = useDataState();
    const { setInfoModalPanelId } = useUiState();
    const a = entry.analysis;
    const array = a.array;
    const tabTo = (tab) => buildPath({ view: 'array', projectId, systemId: system.id, arrayId: entry.id, tab });
    const navigate = useNavigate();
    const rows = checkRows(a);
    const order = { error: 0, warning: 1, info: 2 };
    const issues = [...(a.issues || [])].sort((x, y) => order[x.severity] - order[y.severity]);
    const noteKey = `array_${array.id}`;

    return (
        <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <article className="flex flex-col gap-2 rounded-[10px] border border-line bg-white p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">1 · Layout</span>
                        <Link to={tabTo('layout')} className="text-[13px] font-semibold text-secondary hover:underline">
                            Edit layout
                        </Link>
                    </div>
                    <span className="text-base font-semibold">
                        {array.count} {array.count === 1 ? 'panel' : 'panels'}
                    </span>
                    <span className="text-[13px] text-subtle">
                        {array.mounting} · {array.format}
                        {array.planner ? ' · from the roof planner' : ''}
                    </span>
                </article>

                {a.panel ? (
                    <article className="flex flex-col gap-2 rounded-[10px] border border-line bg-white p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">2 · Panel</span>
                            <Link to={tabTo('panel')} className="text-[13px] font-semibold text-secondary hover:underline">
                                Change panel
                            </Link>
                        </div>
                        <span className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">{a.panel.manufacturer}</span>
                        <button type="button" onClick={() => setInfoModalPanelId(a.panel.model)} className="text-left text-base font-semibold hover:underline">
                            {a.panel.name}
                        </button>
                        <dl className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                                <dt className="text-muted">Size</dt>
                                <dd className="font-plex-mono">{a.panel.height && a.panel.width ? `${a.panel.height} × ${a.panel.width}` : '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-muted">Weight</dt>
                                <dd className="font-plex-mono">{a.panel.weight ? `${a.panel.weight} kg` : '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-muted">Voc coef</dt>
                                <dd className="font-plex-mono">{a.panel.tempCoefVoc != null ? `${a.panel.tempCoefVoc} %/°C` : '—'}</dd>
                            </div>
                        </dl>
                        <PriceTag item={a.panel} />
                    </article>
                ) : (
                    <SlotCard
                        eyebrow="2 · Panel"
                        state="empty"
                        title="Choose a panel"
                        detail="Ranked by fit on this roof and against the controller."
                        onAction={() => navigate(tabTo('panel'))}
                    />
                )}

                <ControllerSlot
                    entry={entry}
                    system={system}
                    projectId={projectId}
                    arraysData={arraysData}
                    siteControllers={siteControllers}
                    chargersData={chargersData}
                    updateSelection={updateSelection}
                />
            </div>

            <section aria-labelledby="array-checks" className="rounded-[10px] border border-line bg-white px-5 py-[18px]">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="array-checks" className="text-[15px] font-semibold">
                        Checks
                    </h2>
                    <SystemSettingsSummary systemName={system.name} settings={settings} setupTo={setupTo} />
                </div>
                {!isMicroinverter(a.controller) && a.controller ? (
                    <div className="mb-3 text-[13px]">
                        <ParallelStringsSelect array={array} arrayId={entry.id} updateArray={updateArray} />
                    </div>
                ) : null}
                {rows.length === 0 ? (
                    <p className="text-sm text-muted">
                        {a.panel ? 'Choose a controller port to check this array.' : 'Choose a panel and a controller port to check this array.'} Nothing is checked until both are set.
                    </p>
                ) : (
                    <table className="w-full text-left text-[13px]">
                        <thead className="text-xs text-muted">
                            <tr>
                                <th className="pb-2 font-medium">Check</th>
                                <th className="pb-2 text-right font-medium">Value / limit</th>
                                <th className="pb-2 text-right font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.label} className="border-t border-line-soft">
                                    <td className="py-2">{r.label}</td>
                                    <td className="py-2 text-right font-plex-mono">{r.value}</td>
                                    <td className="py-2 text-right">
                                        <StatusPill status={r.status} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {issues.length > 0 ? (
                    <ul aria-label="Issues" className="mt-4 flex flex-col gap-2">
                        {issues.map((i, n) => (
                            <li key={`${i.code}-${n}`} className="flex items-start gap-2 text-[13px]">
                                <StatusPill status={i.severity} />
                                <span className="pt-0.5">{i.message}</span>
                            </li>
                        ))}
                    </ul>
                ) : null}
                <ResultsDisclaimer className="mt-3" />
            </section>

            {a.panel ? (
                <section aria-label="Temperature response" className="rounded-[10px] border border-line bg-white px-5 py-[18px]">
                    <ArrayOverviewGraphs panel={a.panel} array={array} controller={a.controller} effectiveStartupV={a.effectiveStartupV ?? null} />
                </section>
            ) : null}

            <section className="rounded-[10px] border border-line bg-white px-5 py-[18px]">
                <label className="flex flex-col gap-2">
                    <span className="flex items-baseline justify-between text-[15px] font-semibold">
                        Notes on {array.name}
                        <span className="text-xs font-normal text-muted">Saved as you type</span>
                    </span>
                    <textarea
                        value={userNotes[noteKey] || ''}
                        onChange={(e) => updateUserNote(noteKey, e.target.value)}
                        placeholder="Installation notes, cable routes, shading…"
                        className="min-h-[80px] rounded-lg border border-line-strong p-3 text-sm"
                    />
                </label>
            </section>
        </div>
    );
}

export default function ArrayPage({ design, system, route }) {
    const { activeProject, getAreaSettings, updateArray } = useDataState();
    const projectId = activeProject.id;
    const entry = system.arrays.find((x) => x.id === route.arrayId);
    if (!entry?.analysis) return null;
    // Controllers moved to the system page (13.6); keep old links working.
    if (route.tab === 'controllers') {
        return <Navigate to={buildPath({ view: 'system', projectId, systemId: system.id, tab: 'controllers' })} replace />;
    }
    const a = entry.analysis;
    const tab = TABS.some(([key]) => key === route.tab) ? route.tab : 'overview';
    const settings = getAreaSettings(system.name);
    const setupTo = buildPath({ view: 'system', projectId, systemId: system.id, tab: 'setup' });
    const wiring = a.controller && !isMicroinverter(a.controller) ? ` · ${Math.round(a.array.count / (a.array.parallelStrings || 1))}S${a.array.parallelStrings || 1}P` : '';

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <EditableTitle value={entry.name} label={`Rename array ${entry.name}`} onRename={(name) => updateArray(entry.id, { name })} />
                        <span className="text-[13px] text-muted">Array in {system.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[13px] text-subtle">
                        <span>
                            {a.array.mounting} · {a.array.format.toLowerCase()}
                        </span>
                        <span>
                            {a.array.count} panels{wiring}
                        </span>
                        <StatusPill status={entry.status}>{entry.status === 'unset' ? `${entry.progress.done} of 3 done` : undefined}</StatusPill>
                    </div>
                </div>
                <dl className="flex flex-wrap gap-x-8 gap-y-2">
                    <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted">Peak power</dt>
                        <dd className="font-plex-mono text-[22px] font-semibold">{kWp(a.peakPower)}</dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted">Cost per kWp</dt>
                        <dd className="font-plex-mono text-[22px] font-semibold">{a.costPerKWp == null ? '—' : formatMoney(a.costPerKWp)}</dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted">Array cost</dt>
                        <dd className="font-plex-mono text-[22px] font-semibold">
                            {formatMoney(a.cost)}
                            {a.costIncomplete ? <span className="ml-1.5 font-plex text-xs font-medium text-status-warning-fg">incomplete</span> : null}
                        </dd>
                    </div>
                </dl>
            </div>

            <div role="tablist" aria-label={`${entry.name} sections`} className="flex gap-1 border-b border-line">
                {TABS.map(([key, label]) => (
                    <Link
                        key={key}
                        role="tab"
                        aria-selected={tab === key}
                        to={buildPath({ view: 'array', projectId, systemId: system.id, arrayId: entry.id, tab: key })}
                        className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === key ? 'border-brand text-body' : 'border-transparent text-muted hover:text-body'}`}
                    >
                        {label}
                    </Link>
                ))}
            </div>

            {tab === 'overview' ? (
                <ArrayHub entry={entry} system={system} projectId={projectId} settings={settings} setupTo={setupTo} />
            ) : tab === 'layout' ? (
                <LayoutPlanner arrayId={entry.id} />
            ) : (
                <PanelChooser arrayId={entry.id} />
            )}
        </div>
    );
}
