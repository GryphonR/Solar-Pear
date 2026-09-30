/**
 * @file SystemSetup.jsx
 * System Setup (roadmap 13.5, canvas board "System Setup"): install type, grid mode, the controller filter,
 * battery voltage and design conditions for one system. These apply to every array in the system, so they
 * are edited only here. After a change a toast says how many arrays were re-checked, with Undo.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { StatusPill } from '../../components/ui';
import { BATTERY_VOLTAGES, CONTROLLER_FILTERS, GRID_MODES, INSTALL_TYPES, labelOf } from '../../lib/presets';
import { projectDefaults } from '../../lib/projects';
import { STRICT_CURRENT_FACTOR } from '../../lib/arrayAnalysis';
import { useDataState, useUiState } from '../../context/AppStateContext';

const LEGEND = 'mb-3 text-[15px] font-semibold text-body';
const FIELDSET = 'rounded-[10px] border border-line bg-white px-5 py-[18px]';
const HINT = 'text-[13px] leading-5 text-muted';

function Segmented({ label, options, value, onChange }) {
    return (
        <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap overflow-hidden rounded-lg border border-line-strong">
            {options.map((o, i) => (
                <button
                    key={String(o.value)}
                    type="button"
                    role="radio"
                    aria-checked={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={`h-10 px-4 text-sm font-medium ${i > 0 ? 'border-l border-line-strong' : ''} ${value === o.value ? 'bg-ink text-white' : 'bg-white text-body hover:bg-paper'}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function Toggle({ label, hint, checked, onChange }) {
    return (
        <label className="flex cursor-pointer items-start justify-between gap-6 py-2">
            <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-body">{label}</span>
                {hint ? <span className={HINT}>{hint}</span> : null}
            </span>
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 flex-shrink-0" />
        </label>
    );
}

/** Temperature input that commits on blur or Enter, so one edit gives one re-check. */
function TemperatureField({ label, ariaLabel, value, projectDefault, onCommit, min, max }) {
    const [draft, setDraft] = useState(String(value));
    useEffect(() => setDraft(String(value)), [value]);
    const commit = () => {
        const n = Number(draft);
        if (draft.trim() === '' || !Number.isFinite(n)) {
            setDraft(String(value));
            return;
        }
        const clamped = Math.min(max, Math.max(min, Math.round(n)));
        setDraft(String(clamped));
        if (clamped !== value) onCommit(clamped);
    };
    const overridden = value !== projectDefault;
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-subtle">{label}</span>
            <span className="flex items-center gap-2">
                <input
                    type="number"
                    inputMode="numeric"
                    aria-label={ariaLabel}
                    value={draft}
                    min={min}
                    max={max}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commit();
                        }
                    }}
                    className="h-10 w-24 rounded-lg border border-line-strong px-3 font-plex-mono text-sm"
                />
                <span className="text-sm text-subtle">°C</span>
            </span>
            <span className="text-xs text-muted">
                {overridden ? (
                    <>
                        <span className="mr-1.5 rounded bg-status-info-bg px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-status-info-fg">
                            OVERRIDDEN
                        </span>
                        Project default {projectDefault} °C ·{' '}
                        <button type="button" onClick={() => onCommit(projectDefault)} className="font-semibold text-secondary hover:underline">
                            Reset
                        </button>
                    </>
                ) : (
                    'Same as project default'
                )}
            </span>
        </label>
    );
}

const fmtV = (v) => (Number.isFinite(v) && v > 0 ? `${v.toFixed(0)} V` : '—');

export default function SystemSetup({ design, system }) {
    const { activeProject, getAreaSettings, updateAreaSettings, deleteArea } = useDataState();
    const { setNotification } = useUiState();
    const settings = getAreaSettings(system.name);
    const defaults = projectDefaults(activeProject);
    const otherSystems = design.systems.filter((s) => s.id !== system.id);
    const pending = useRef(null);

    /**
     * Applies a settings change, then (after the re-render re-runs the checks) reports how many arrays
     * were re-checked and whether anything got worse, with Undo.
     */
    const apply = (patch, describe) => {
        const previous = Object.fromEntries(Object.keys(patch).map((k) => [k, settings[k]]));
        pending.current = {
            describe,
            previous,
            before: new Map(system.arrays.map((a) => [a.id, a.status])),
        };
        updateAreaSettings(system.name, patch);
    };

    useEffect(() => {
        const change = pending.current;
        if (!change) return;
        pending.current = null;
        const rank = { valid: 0, unset: 0, warning: 1, error: 2 };
        const checked = system.arrays.filter((a) => a.status !== 'unset');
        const worse = checked.filter((a) => rank[a.status] > rank[change.before.get(a.id) ?? 'valid']).length;
        const better = checked.filter((a) => rank[a.status] < rank[change.before.get(a.id) ?? 'valid']).length;
        const n = checked.length;
        const rechecked = n === 0 ? 'No arrays to re-check yet' : `${n} ${n === 1 ? 'array' : 'arrays'} re-checked`;
        const outcome = n === 0 ? '' : worse ? `, ${worse} now ${worse === 1 ? 'has' : 'have'} more issues` : better ? `, ${better} improved` : ', no new issues';
        setNotification(`${change.describe}. ${rechecked}${outcome}.`, 'dark', {
            label: 'Undo',
            onClick: () => updateAreaSettings(system.name, change.previous),
        });
    });

    const gridMode = GRID_MODES.find((m) => m.id === settings.gridMode);

    return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
                <fieldset className={FIELDSET}>
                    <legend className="sr-only">Install type</legend>
                    <div className={LEGEND} aria-hidden="true">Install type</div>
                    <div role="radiogroup" aria-label="Install type" className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {INSTALL_TYPES.map((t) => (
                            <label
                                key={t.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 ${settings.installType === t.id ? 'border-ink bg-paper' : 'border-line'}`}
                            >
                                <input
                                    type="radio"
                                    name={`install-${system.id}`}
                                    checked={settings.installType === t.id}
                                    onChange={() => apply({ installType: t.id }, `Install type set to ${t.label.toLowerCase()}`)}
                                    className="mt-1"
                                />
                                <span className="flex flex-col gap-0.5">
                                    <span className="text-sm font-semibold">{t.label}</span>
                                    <span className={HINT}>{t.text}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                <fieldset className={FIELDSET}>
                    <legend className="sr-only">Grid mode</legend>
                    <div className={LEGEND} aria-hidden="true">Grid mode</div>
                    <Segmented
                        label="Grid mode"
                        value={settings.gridMode}
                        options={GRID_MODES.map((m) => ({ value: m.id, label: m.label }))}
                        onChange={(id) => {
                            const mode = GRID_MODES.find((m) => m.id === id);
                            apply(
                                {
                                    gridMode: id,
                                    systemType: mode.systemType,
                                    filterEps: mode.systemType === 'grid-connected' ? settings.filterEps : false,
                                    filterHouseBackup: mode.systemType === 'grid-connected' ? settings.filterHouseBackup : false,
                                },
                                `Grid mode set to ${mode.label.toLowerCase()}`
                            );
                        }}
                    />
                    <div className="mt-4 flex flex-col gap-1.5">
                        <label className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="font-medium">Controllers shown</span>
                            <select
                                value={settings.systemType}
                                onChange={(e) =>
                                    apply(
                                        {
                                            systemType: e.target.value,
                                            filterEps: e.target.value === 'grid-connected' ? settings.filterEps : false,
                                            filterHouseBackup: e.target.value === 'grid-connected' ? settings.filterHouseBackup : false,
                                        },
                                        `Showing ${labelOf(CONTROLLER_FILTERS, e.target.value).toLowerCase()}`
                                    )
                                }
                                className="h-10 rounded-lg border border-line-strong bg-white px-3 text-sm"
                            >
                                {CONTROLLER_FILTERS.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <span className={HINT}>
                            {gridMode ? `Set by the grid mode; change it if you need to. ` : ''}Only changes which controllers are
                            listed, never the checks.
                        </span>
                    </div>
                    {settings.systemType === 'grid-connected' ? (
                        <div className="mt-3 divide-y divide-line-soft border-t border-line-soft">
                            <Toggle
                                label="EPS / backup output"
                                hint="Only show controllers that keep some circuits on in a power cut."
                                checked={!!settings.filterEps}
                                onChange={(v) => apply({ filterEps: v }, v ? 'Showing only controllers with EPS' : 'EPS filter off')}
                            />
                            <Toggle
                                label="Whole-house backup"
                                hint="Only show controllers that can back up the whole consumer unit."
                                checked={!!settings.filterHouseBackup}
                                onChange={(v) =>
                                    apply({ filterHouseBackup: v }, v ? 'Showing only whole-house backup controllers' : 'Whole-house backup filter off')
                                }
                            />
                        </div>
                    ) : null}
                </fieldset>

                <fieldset className={FIELDSET}>
                    <legend className="sr-only">Battery voltage</legend>
                    <div className={LEGEND} aria-hidden="true">Battery voltage</div>
                    <Segmented
                        label="Battery voltage"
                        value={settings.systemVoltage ?? null}
                        options={[{ value: null, label: 'Not set' }, ...BATTERY_VOLTAGES.map((v) => ({ value: v, label: `${v} V` }))]}
                        onChange={(v) => apply({ systemVoltage: v }, v ? `Battery voltage set to ${v} V` : 'Battery voltage cleared')}
                    />
                    <p className={`mt-2 ${HINT}`}>Filters controllers and sets the charger power check.</p>
                </fieldset>

                <fieldset className={FIELDSET}>
                    <legend className="sr-only">Design conditions</legend>
                    <div className={LEGEND} aria-hidden="true">Design conditions</div>
                    <p className="mb-4 rounded-md bg-status-info-bg px-3 py-2 text-[13px] text-status-info-fg">
                        Applies to all {system.arrays.length} {system.arrays.length === 1 ? 'array' : 'arrays'} in {system.name}.
                        {otherSystems.length > 0
                            ? ` ${otherSystems.map((s) => s.name).join(', ')} ${otherSystems.length === 1 ? 'keeps its' : 'keep their'} own values.`
                            : ''}
                    </p>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <TemperatureField
                            label="Design low (coldest ambient)"
                            ariaLabel="Design low in degrees Celsius"
                            value={settings.designLowC}
                            projectDefault={defaults.designLowC}
                            min={-50}
                            max={15}
                            onCommit={(v) => apply({ designLowC: v }, `Design low set to ${v} °C`)}
                        />
                        <TemperatureField
                            label="Design high (hottest cell)"
                            ariaLabel="Design high cell temperature in degrees Celsius"
                            value={settings.designHighC}
                            projectDefault={defaults.designHighC}
                            min={30}
                            max={95}
                            onCommit={(v) => apply({ designHighC: v }, `Design high set to ${v} °C`)}
                        />
                    </div>
                    <div className="mt-4 border-t border-line-soft pt-2">
                        <Toggle
                            label={`Strict current (${STRICT_CURRENT_FACTOR} × Isc)`}
                            hint={
                                <>
                                    Adds the NEC 690.8 / IEC 62548 irradiance factor to the Isc check.{' '}
                                    <Link to="/learn/methodology" className="text-secondary hover:underline">
                                        How the checks work
                                    </Link>
                                </>
                            }
                            checked={!!settings.strictCurrent}
                            onChange={(v) => apply({ strictCurrent: v }, v ? 'Strict current on' : 'Strict current off')}
                        />
                    </div>
                </fieldset>

                <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-status-error-bg bg-white px-5 py-4">
                    <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold">Delete this system</span>
                        <span className={HINT}>
                            Removes {system.name}, its {system.arrays.length} {system.arrays.length === 1 ? 'array' : 'arrays'} and its controllers.
                        </span>
                    </span>
                    <button
                        type="button"
                        onClick={() => deleteArea(system.name)}
                        disabled={design.systems.length <= 1}
                        title={design.systems.length <= 1 ? 'A project needs at least one system' : undefined}
                        className="h-10 rounded-lg border border-status-error-edge px-4 text-sm font-semibold text-status-error-edge disabled:opacity-50"
                    >
                        Delete system…
                    </button>
                </div>
            </form>

            <aside className="flex flex-col gap-4">
                <section aria-labelledby="setup-checks" className="rounded-[10px] border border-line bg-white px-5 py-[18px]">
                    <h2 id="setup-checks" className="mb-3 text-[15px] font-semibold">
                        Checks at these settings
                    </h2>
                    {system.arrays.length === 0 ? (
                        <p className={HINT}>No arrays in this system yet.</p>
                    ) : (
                        <table className="w-full text-left text-[13px]">
                            <thead className="text-xs text-muted">
                                <tr>
                                    <th className="pb-2 font-medium">Array</th>
                                    <th className="pb-2 font-medium">Cold Voc</th>
                                    <th className="pb-2 font-medium">Hot Vmp</th>
                                    <th className="pb-2 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {system.arrays.map((a) => (
                                    <tr key={a.id} className="border-t border-line-soft">
                                        <td className="py-2 pr-2">{a.name}</td>
                                        <td className="py-2 pr-2 font-plex-mono">{a.status === 'unset' ? '—' : fmtV(a.analysis?.coldVoc)}</td>
                                        <td className="py-2 pr-2 font-plex-mono">{a.status === 'unset' ? '—' : fmtV(a.analysis?.hotVmp)}</td>
                                        <td className="py-2">
                                            <StatusPill status={a.status}>{a.status === 'unset' ? 'Not checked' : undefined}</StatusPill>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>
                <section className="rounded-[10px] border border-line bg-white px-5 py-[18px]">
                    <h2 className="mb-2 text-[15px] font-semibold">Where do these come from?</h2>
                    <p className="text-[13px] leading-5 text-subtle">
                        The coldest morning at your site sets the highest string voltage. The hottest cell temperature
                        sets the lowest. UK installers commonly use −10 °C; exposed or upland sites may need colder.
                        New systems start from the project defaults on the project overview.
                    </p>
                </section>
            </aside>
        </div>
    );
}
