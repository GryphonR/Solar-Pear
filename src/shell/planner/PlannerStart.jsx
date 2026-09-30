/**
 * @file PlannerStart.jsx
 * First use of the layout planner (roadmap 13.8, canvas board "PlannerStart"): three measurements are
 * enough to see which panels fit. Corners and obstacles are added on the drawing afterwards.
 */

import React, { useState } from 'react';
import { ASSUMED_PITCH_DEG, ROOF_SHAPES, estimatedRidge, plannerFromStart, slopeLengthFromPlan } from '../../lib/plannerLayouts';
import { NumberField, ShapeIcon, SOLARWIZARD } from './plannerUi';

export default function PlannerStart({ arrayName, onStart, onSkip }) {
    const [start, setStart] = useState({ shape: 'rectangle', measure: 'tape', width: '', length: '', depth: '', pitch: '', ridge: '' });
    const set = (patch) => setStart((s) => ({ ...s, ...patch }));
    const planner = plannerFromStart(start);
    const map = start.measure === 'map';
    const slope = map ? slopeLengthFromPlan(start.depth, start.pitch) : Number(start.length);
    const ridgeEstimate = Number(start.width) > 0 && slope > 0 ? `≈ ${estimatedRidge(start.width, slope, map ? start.pitch : null).toFixed(2)}` : undefined;
    const missing = !(Number(start.width) > 0)
        ? 'Add the width to continue'
        : map && !(Number(start.depth) > 0)
          ? 'Add the depth to continue'
          : map && !(slopeLengthFromPlan(start.depth, start.pitch) > 0)
            ? 'Add the pitch to continue'
            : !map && !(Number(start.length) > 0)
              ? 'Add the length to continue'
              : null;

    return (
        <section aria-labelledby="planner-start-title" className="mx-auto flex w-full max-w-[720px] flex-col gap-6 rounded-[10px] border border-line bg-white p-5 sm:p-8">
            <div className="flex flex-col gap-1.5">
                <h2 id="planner-start-title" className="text-xl font-semibold">
                    Describe this roof section
                </h2>
                <p className="text-sm text-subtle">
                    Three measurements are enough to see which panels fit {arrayName}. You can add corners and obstacles on the drawing afterwards.
                </p>
            </div>

            <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2.5 text-sm font-semibold">1 · Shape</legend>
                <div role="radiogroup" aria-label="Roof shape" className="grid grid-cols-3 gap-2.5">
                    {ROOF_SHAPES.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            role="radio"
                            aria-checked={start.shape === s.id}
                            onClick={() => set({ shape: s.id })}
                            className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm font-semibold ${start.shape === s.id ? 'border-secondary bg-select-bg ring-1 ring-secondary' : 'border-line-strong hover:bg-paper'}`}
                        >
                            <ShapeIcon shape={s.id} />
                            {s.label}
                            <span className="text-xs font-normal text-muted">{s.hint}</span>
                        </button>
                    ))}
                </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
                <legend className="mb-2.5 text-sm font-semibold">2 · How did you measure it?</legend>
                {[
                    ['tape', 'On the roof, with a tape', 'Length measured up the slope.'],
                    ['map', 'From a map or plan', 'Seen from above, so we need the pitch.'],
                ].map(([id, label, hint]) => (
                    <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${start.measure === id ? 'border-secondary bg-select-bg' : 'border-line-strong'}`}>
                        <input type="radio" name="planner-measure" checked={start.measure === id} onChange={() => set({ measure: id })} className="mt-1" />
                        <span className="flex flex-col">
                            <span className="text-sm font-semibold">{label}</span>
                            <span className="text-xs text-muted">{hint}</span>
                        </span>
                    </label>
                ))}
            </fieldset>

            <fieldset className="flex flex-col gap-3">
                <legend className="mb-2.5 text-sm font-semibold">3 · Size</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <NumberField label="Width" unit="m" value={start.width} onChange={(v) => set({ width: v })} aria="Width in metres" />
                    {map ? (
                        <>
                            <NumberField label="Depth, seen from above" unit="m" value={start.depth} onChange={(v) => set({ depth: v })} aria="Depth seen from above in metres" />
                            <NumberField label="Pitch" unit="°" value={start.pitch} placeholder="e.g. 35" onChange={(v) => set({ pitch: v })} aria="Roof pitch in degrees" />
                        </>
                    ) : (
                        <NumberField label="Length up the slope" unit="m" value={start.length} onChange={(v) => set({ length: v })} aria="Length up the slope in metres" />
                    )}
                    {start.shape === 'hipped' ? (
                        <NumberField label="Ridge length (optional)" unit="m" value={start.ridge} placeholder={ridgeEstimate} onChange={(v) => set({ ridge: v })} aria="Ridge length in metres" />
                    ) : null}
                </div>
                {map ? (
                    <p className="text-[13px] text-subtle">
                        Don&apos;t know the pitch? Look up your address on{' '}
                        <a href={SOLARWIZARD} target="_blank" rel="noopener noreferrer" className="text-secondary underline">
                            SolarWizard
                        </a>{' '}
                        to find it. A wrong pitch changes how many rows fit.
                    </p>
                ) : null}
                {start.shape === 'hipped' && !start.ridge ? (
                    <p className="text-[13px] text-subtle">
                        Leave the ridge blank and we&apos;ll estimate it{map ? ' from the pitch' : ` for a ${ASSUMED_PITCH_DEG}° pitch`}. You can change it on the next screen.
                    </p>
                ) : null}
                {start.shape === 'draw' ? <p className="text-[13px] text-subtle">We&apos;ll start from a rectangle this size. Add and drag corners on the drawing to match your roof.</p> : null}
            </fieldset>

            <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-5">
                <button type="button" onClick={onSkip} className="text-sm font-semibold text-secondary hover:underline">
                    Skip, I know how many panels
                </button>
                <button
                    type="button"
                    disabled={!planner}
                    onClick={() => planner && onStart(planner)}
                    className="h-10 rounded-md bg-brand px-5 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:bg-line-soft disabled:text-muted"
                >
                    {missing || 'See which panels fit'}
                </button>
            </div>
        </section>
    );
}
