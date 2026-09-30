/**
 * @file PlannerPhone.jsx
 * The layout planner below 960 px (roadmap 13.8, canvas board "PlannerPhone"): the roof and the applied
 * layout, view only. Drawing needs a larger screen; the panel count can still be set by hand.
 */

import React from 'react';
import RoofCanvas from './RoofCanvas';

export default function PlannerPhone({ array, geo, started, onManual }) {
    const applied = geo.applied?.rects_m?.length ? geo.applied : null;
    return (
        <section aria-label="Layout" className="flex flex-col gap-3">
            {started ? (
                <div className="overflow-hidden rounded-[10px] border border-line bg-[#ECEEE8] p-2">
                    <RoofCanvas
                        readOnly
                        height={260}
                        roofPolygon={geo.roofPolygon}
                        exclusions={geo.exclusions}
                        edgeSetback_m={geo.spacing.edge_mm / 1000}
                        tool="select"
                        onChange={() => {}}
                        layout={applied ? { rects: applied.rects_m, emptyRects: applied.emptyRects || [], addedKeys: new Set() } : null}
                    />
                </div>
            ) : null}
            <div className="flex flex-col gap-1 rounded-[10px] border border-line bg-white px-4 py-3">
                <span className="text-sm font-semibold">
                    {applied ? `${applied.rects_m.length} panel${applied.rects_m.length === 1 ? '' : 's'} on this roof` : array.count > 0 ? `${array.count} panels, set by hand` : 'No layout yet'}
                </span>
                <span className="text-[13px] text-subtle">
                    {started ? 'Drawing the roof and choosing a layout needs a wider screen. Open this page on a computer, or turn a tablet sideways, to edit it.' : 'Describe the roof on a computer, or a tablet turned sideways, to see which panels fit.'}
                </span>
            </div>
            <button type="button" onClick={onManual} className="self-start text-[13px] font-semibold text-secondary hover:underline">
                I know my panel count
            </button>
        </section>
    );
}
