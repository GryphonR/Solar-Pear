/**
 * @file SystemControllers.jsx
 * System Controllers tab (roadmap 13.6, canvas board "System Controllers"): a card per controller unit
 * with its ports, what's on each and that array's key figures, a load meter, and actions to add, replace
 * and remove units and to assign free ports. Every figure comes from the engine's analysis.
 */

import React, { useState } from 'react';
import { Link } from 'react-router';
import { Meter, StatusPill, EmptyState } from '../../components/ui';
import { Plus } from '../../components/Icons';
import ControllerPicker from '../ControllerPicker';
import { buildPath } from '../../lib/routes';
import { controllerTypeLabel } from '../../lib/controllerTypes';
import { formatMoney, knownPrice } from '../../lib/pricing';
import { freePorts, portLimitsLabel, unassignedArrays, unitPorts } from '../../lib/ports';
import { useDataState, useUiState } from '../../context/AppStateContext';
import { useIsPhone } from '../../hooks/useIsSmallScreen';

const round = (v) => (Number.isFinite(v) ? Math.round(v) : '—');
const wiringOf = (a) => (a?.array ? `${Math.round((a.array.count || 0) / (a.array.parallelStrings || 1))}S${a.array.parallelStrings || 1}P` : '');

function AssignSelect({ port, unassigned, onAssign }) {
    return unassigned.length > 0 ? (
        <select
            aria-label={`Assign an array to MPPT ${port}`}
            value=""
            onChange={(e) => e.target.value && onAssign(e.target.value)}
            className="h-8 rounded-md border border-line-strong bg-white px-2 text-xs"
        >
            <option value="">Assign an array…</option>
            {unassigned.map((x) => (
                <option key={x.id} value={x.id}>
                    {x.name}
                </option>
            ))}
        </select>
    ) : (
        <span className="text-xs text-muted">No array waiting</span>
    );
}

/** A port as a card, for phones (13.9): the same content as a table row, stacked. */
function PortCard({ port, model, arrayEntry, projectId, systemId, unassigned, onAssign, onUnassign }) {
    const a = arrayEntry?.analysis;
    const c = a?.controller;
    const tone = arrayEntry?.status === 'warning' ? 'bg-[#FFF9EE]' : arrayEntry?.status === 'error' ? 'bg-status-error-bg/60' : '';
    return (
        <li className={`flex flex-col gap-2 border-t border-line-soft px-4 py-3 text-[13px] ${tone}`}>
            <div className="flex items-center justify-between gap-2">
                <span className="font-plex-mono font-semibold">
                    MPPT {port}
                    {portLimitsLabel(model, port) ? <span className="ml-2 font-normal text-muted">{portLimitsLabel(model, port)}</span> : null}
                </span>
                {arrayEntry ? <StatusPill status={arrayEntry.status}>{arrayEntry.status === 'unset' ? 'Not checked' : undefined}</StatusPill> : null}
            </div>
            {arrayEntry ? (
                <>
                    <div>
                        <Link to={buildPath({ view: 'array', projectId, systemId, arrayId: arrayEntry.id, tab: 'overview' })} className="font-medium text-secondary hover:underline">
                            {arrayEntry.name}
                        </Link>{' '}
                        <span className="text-muted">{a?.panel ? wiringOf(a) : 'no panel yet'}</span>
                    </div>
                    {a?.panel ? (
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                            <dt className="text-muted">Cold Voc / max</dt>
                            <dd className="text-right font-plex-mono">{`${round(a.coldVoc)} / ${c?.maxV ?? '—'} V`}</dd>
                            <dt className="text-muted">Hot Vmp / MPPT</dt>
                            <dd className="text-right font-plex-mono">{`${round(a.hotVmp)} / ${c?.mpptRangeMin && c?.mpptRangeMax ? `${c.mpptRangeMin}–${c.mpptRangeMax}` : '—'} V`}</dd>
                            <dt className="text-muted">Hot Isc / max</dt>
                            <dd className="text-right font-plex-mono">{`${a.arrayIscHot.toFixed(1)} / ${c?.maxIsc || '—'} A`}</dd>
                        </dl>
                    ) : null}
                    <button type="button" onClick={onUnassign} className="self-start text-xs font-semibold text-secondary hover:underline">
                        Unassign
                    </button>
                </>
            ) : (
                <div className="flex items-center justify-between gap-2">
                    <span className="text-muted">Free</span>
                    <AssignSelect port={port} unassigned={unassigned} onAssign={onAssign} />
                </div>
            )}
        </li>
    );
}

function PortRow({ port, model, arrayEntry, projectId, systemId, unassigned, onAssign, onUnassign }) {
    const a = arrayEntry?.analysis;
    const c = a?.controller;
    const tone = arrayEntry?.status === 'warning' ? 'bg-[#FFF9EE]' : arrayEntry?.status === 'error' ? 'bg-status-error-bg/60' : '';
    return (
        <tr className={`border-t border-line-soft ${tone}`}>
            <th scope="row" className="px-5 py-3 text-left font-plex-mono font-semibold">
                MPPT {port}
                {portLimitsLabel(model, port) ? <span className="block text-[11px] font-normal text-muted">{portLimitsLabel(model, port)}</span> : null}
            </th>
            {arrayEntry ? (
                <>
                    <td className="py-3">
                        <Link
                            to={buildPath({ view: 'array', projectId, systemId, arrayId: arrayEntry.id, tab: 'overview' })}
                            className="font-medium text-secondary hover:underline"
                        >
                            {arrayEntry.name}
                        </Link>{' '}
                        <span className="text-muted">{a?.panel ? wiringOf(a) : 'no panel yet'}</span>
                    </td>
                    <td className="py-3 text-right font-plex-mono">{a?.panel ? `${round(a.coldVoc)} / ${c?.maxV ?? '—'} V` : '—'}</td>
                    <td className="py-3 text-right font-plex-mono">
                        {a?.panel ? `${round(a.hotVmp)} / ${c?.mpptRangeMin && c?.mpptRangeMax ? `${c.mpptRangeMin}–${c.mpptRangeMax}` : '—'} V` : '—'}
                    </td>
                    <td className="py-3 text-right font-plex-mono">{a?.panel ? `${a.arrayIscHot.toFixed(1)} / ${c?.maxIsc || '—'} A` : '—'}</td>
                    <td className="py-3 pr-2 text-right">
                        <StatusPill status={arrayEntry.status}>{arrayEntry.status === 'unset' ? 'Not checked' : undefined}</StatusPill>
                    </td>
                    <td className="py-3 pr-5 text-right">
                        <button type="button" onClick={onUnassign} className="text-xs font-semibold text-secondary hover:underline">
                            Unassign
                        </button>
                    </td>
                </>
            ) : (
                <>
                    <td className="py-3 text-muted" colSpan={4}>
                        Free
                    </td>
                    <td className="py-3 pr-5 text-right" colSpan={2}>
                        <AssignSelect port={port} unassigned={unassigned} onAssign={onAssign} />
                    </td>
                </>
            )}
        </tr>
    );
}

export default function SystemControllers({ design, system }) {
    const {
        activeProject,
        arraysData,
        siteControllers,
        chargersData,
        availableChargers,
        getAreaSettings,
        createControllerInstance,
        replaceControllerInstance,
        deleteControllerInstance,
        updateSelection,
    } = useDataState();
    const { setInfoModalChargerId, setNotification } = useUiState();
    const [picker, setPicker] = useState(null); // { mode: 'add' | 'replace', arrayId?, instanceId? }
    const phone = useIsPhone();

    const projectId = activeProject.id;
    const settings = getAreaSettings(system.name);
    const setupTo = buildPath({ view: 'system', projectId, systemId: system.id, tab: 'setup' });
    const instances = siteControllers.filter((sc) => sc.area === system.name);
    const systemArrays = arraysData.filter((a) => a.area === system.name);
    const entryOf = (arrayId) => system.arrays.find((x) => x.id === arrayId);
    const units = unitPorts(instances, systemArrays, chargersData);
    const waiting = unassignedArrays(systemArrays, instances).map((a) => entryOf(a.id)).filter(Boolean);
    const free = freePorts(instances, systemArrays, chargersData);

    const targetsFor = (p) => {
        if (!p) return [];
        const ids = p.mode === 'replace' ? systemArrays.filter((a) => a.controllerInstanceId === p.instanceId).map((a) => a.id) : p.arrayId ? [p.arrayId] : [];
        return ids
            .map((id) => entryOf(id))
            .filter(Boolean)
            .map((x) => ({ array: x.analysis?.array, panel: x.analysis?.panel }))
            .filter((t) => t.array);
    };

    const nameOf = (model) => `${model.manufacturer ? `${model.manufacturer} ` : ''}${model.name}`;
    const onPick = (model) => {
        if (picker?.mode === 'replace') {
            const dropped = replaceControllerInstance(picker.instanceId, model.id);
            setNotification(
                `Replaced with ${nameOf(model)}.${dropped ? ` ${dropped} ${dropped === 1 ? 'array was' : 'arrays were'} on a port the new unit doesn't have and ${dropped === 1 ? 'needs' : 'need'} a new one.` : ''}`,
                'success'
            );
        } else {
            const id = createControllerInstance(model.id, system.name);
            if (id && picker?.arrayId) updateSelection(picker.arrayId, 'controllerInstance', id, 1);
            setNotification(`Added ${nameOf(model)}${picker?.arrayId ? ` for ${entryOf(picker.arrayId)?.name}` : ''}.`, 'success');
        }
        setPicker(null);
    };

    const pickerArray = picker?.arrayId ? entryOf(picker.arrayId) : null;
    const pickerUnit = picker?.instanceId ? units.find((u) => u.instance.id === picker.instanceId) : null;

    return (
        <div className="flex gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[13px] text-muted">
                        Each array uses one MPPT port. Arrays on the same unit share its power limit.
                    </p>
                    <button
                        type="button"
                        onClick={() => setPicker({ mode: 'add' })}
                        className="flex h-10 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-brand px-4 text-sm font-semibold text-ink"
                    >
                        <Plus size={16} />
                        Add a controller
                    </button>
                </div>

                {units.length === 0 ? (
                    <EmptyState title={`No controllers in ${system.name} yet`} action={{ label: 'Add a controller', onClick: () => setPicker({ mode: 'add' }) }}>
                        Add an MPPT charger or inverter, then give each array a port.
                    </EmptyState>
                ) : null}

                {units.map(({ instance, model, ports }, index) => {
                    const onUnit = ports.filter((p) => p.arrayId).map((p) => entryOf(p.arrayId)).filter(Boolean);
                    const power = onUnit.map((x) => x.analysis?.power).find((p) => p && p.basis);
                    const totalWp = onUnit.reduce((sum, x) => sum + (x.analysis?.peakPower || 0), 0);
                    const unitLabel = model?.type === 'charger' || model?.type === 'dc-dc-charger' ? 'Charger' : 'Controller';
                    return (
                        <article key={instance.id} aria-label={instance.name} className="flex flex-col rounded-[10px] border border-line bg-white">
                            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line-soft px-4 py-[18px] sm:px-5">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
                                        {unitLabel} {index + 1} · {model?.manufacturer || 'Unknown'} · {model ? controllerTypeLabel(model.type, { short: true }) : 'not in catalogue'}
                                    </span>
                                    <h3 className="text-xl font-semibold">{model?.name || instance.name}</h3>
                                    {model ? (
                                        <span className="text-[13px] text-muted">
                                            {ports.length} MPPT {ports.length === 1 ? 'port' : 'ports'} · {(model.systemVoltages || []).join('/')} V
                                            {model.eps ? ' · EPS' : ''}
                                            {model.g99_cert ? ' · G99' : model.g98_cert ? ' · G98' : ''} · price{' '}
                                            <span className="font-plex-mono">{formatMoney(knownPrice(model), '—')}</span>
                                        </span>
                                    ) : null}
                                </div>
                                <div className="flex gap-2">
                                    {model ? (
                                        <button type="button" onClick={() => setInfoModalChargerId(model.id)} className="h-9 rounded-md border border-line px-3 text-[13px] font-medium">
                                            Info
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => setPicker({ mode: 'replace', instanceId: instance.id })}
                                        className="h-9 rounded-md border border-line px-3 text-[13px] font-medium"
                                    >
                                        Replace…
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            deleteControllerInstance(instance.id);
                                            setNotification(`Removed ${instance.name}.`, 'success');
                                        }}
                                        disabled={onUnit.length > 0}
                                        title={onUnit.length > 0 ? 'Move or unassign its arrays first' : undefined}
                                        className="h-9 rounded-md border border-line px-3 text-[13px] font-medium disabled:cursor-not-allowed disabled:border-line-soft disabled:bg-[#F7F8F5] disabled:text-[#8A919A]"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                            {phone ? (
                                <ul aria-label={`${instance.name} ports`}>
                                    {ports.map((p) => (
                                        <PortCard
                                            key={p.port}
                                            port={p.port}
                                            model={model}
                                            arrayEntry={p.arrayId ? entryOf(p.arrayId) : null}
                                            projectId={projectId}
                                            systemId={system.id}
                                            unassigned={waiting}
                                            onAssign={(arrayId) => updateSelection(arrayId, 'controllerInstance', instance.id, p.port)}
                                            onUnassign={() => updateSelection(p.arrayId, 'clearController')}
                                        />
                                    ))}
                                </ul>
                            ) : (
                            <table className="w-full border-collapse text-[13px]">
                                <thead>
                                    <tr className="bg-placeholder-bg text-left text-xs text-muted">
                                        <th className="px-5 py-2 font-medium">Port</th>
                                        <th className="font-medium">Array</th>
                                        <th className="text-right font-medium">Cold Voc / max</th>
                                        <th className="text-right font-medium">Hot Vmp / MPPT</th>
                                        <th className="text-right font-medium">Hot Isc / max</th>
                                        <th className="pr-2 text-right font-medium">Status</th>
                                        <th className="pr-5">
                                            <span className="sr-only">Actions</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ports.map((p) => (
                                        <PortRow
                                            key={p.port}
                                            port={p.port}
                                            model={model}
                                            arrayEntry={p.arrayId ? entryOf(p.arrayId) : null}
                                            projectId={projectId}
                                            systemId={system.id}
                                            unassigned={waiting}
                                            onAssign={(arrayId) => updateSelection(arrayId, 'controllerInstance', instance.id, p.port)}
                                            onUnassign={() => updateSelection(p.arrayId, 'clearController')}
                                        />
                                    ))}
                                </tbody>
                            </table>
                            )}
                            <div className="border-t border-line-soft px-5 py-4">
                                <Meter
                                    label={power?.basis === 'charge' ? `Charge power, all ports (at ${power.batteryV} V)` : 'DC input power, all ports'}
                                    value={totalWp}
                                    max={power?.limitW || 0}
                                />
                            </div>
                        </article>
                    );
                })}

                {waiting.map((x) => (
                    <article
                        key={x.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border-[1.5px] border-dashed border-secondary bg-cta-bg px-5 py-[18px]"
                    >
                        <span className="flex flex-col gap-0.5">
                            <span className="text-[15px] font-semibold">{x.name} has no port</span>
                            <span className="text-[13px] text-subtle">
                                {free.length > 0
                                    ? 'Assign it to a free port above, or add another controller.'
                                    : units.length > 0
                                      ? 'Every port is in use. Add another controller, or replace one with a model that has more ports.'
                                      : 'Add a controller for it.'}
                            </span>
                        </span>
                        <button type="button" onClick={() => setPicker({ mode: 'add', arrayId: x.id })} className="text-[13px] font-semibold text-secondary hover:underline">
                            Add a controller for {x.name}
                        </button>
                    </article>
                ))}
            </div>

            <ControllerPicker
                key={picker ? `${picker.mode}:${picker.arrayId || picker.instanceId || ''}` : 'closed'}
                open={!!picker}
                onClose={() => setPicker(null)}
                title={
                    picker?.mode === 'replace'
                        ? `Replace ${pickerUnit?.model?.name || 'controller'}`
                        : pickerArray
                          ? `Add a controller for ${pickerArray.name}`
                          : 'Add a controller'
                }
                system={system}
                settings={settings}
                setupTo={setupTo}
                targets={targetsFor(picker)}
                chargers={availableChargers}
                currentModelId={picker?.mode === 'replace' ? pickerUnit?.model?.id : undefined}
                pickLabel={picker?.mode === 'replace' ? 'Use' : 'Add'}
                onPick={onPick}
            />
        </div>
    );
}
