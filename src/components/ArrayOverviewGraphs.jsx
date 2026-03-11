import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import uPlot from 'uplot';
import UplotReact from 'uplot-react';
import 'uplot/dist/uPlot.min.css';
import { Info } from './Icons';
import { computeTempSeries } from '../lib/tempSeries';

function getSplinePath() {
    if (typeof uPlot.paths?.spline !== 'function') return undefined;
    return uPlot.paths.spline();
}

const CHART_HEIGHT = 220;
const CHART_WIDTH_DEFAULT = 520;
/** Margin (px) each side so chart fits inside card */
const CHART_MARGIN = 16;
/** Reserve space for legend so live values wrapping to two lines don't push the next chart down */
const LEGEND_MIN_HEIGHT_PX = 44;
const MIN_CHART_WIDTH = 200;

const commonAxisStyle = {
    stroke: '#475569',
    font: '11px "JetBrains Mono", "SF Mono", Consolas, monospace',
};
const commonGrid = { show: true, stroke: '#cbd5e1', width: 1 };
const CURSOR_SYNC_KEY = 'array-overview-temp';

const commonCursor = {
    show: true,
    x: true,
    y: true,
    lock: false,
    points: { show: true, size: 4, width: 1, stroke: '#0f172a', fill: '#fff' },
    sync: {
        key: CURSOR_SYNC_KEY,
        scales: ['x', null],
    },
};

/** X-axis splits so scale min/max (-40°C, 85°C) are always labelled */
function tempAxisSplits(u, axisIdx, scaleMin, scaleMax) {
    const incr = 25;
    const out = [scaleMin];
    let v = Math.ceil(scaleMin / incr) * incr;
    if (v <= scaleMin) v += incr;
    for (; v < scaleMax; v += incr) out.push(v);
    if (scaleMax !== out[out.length - 1]) out.push(scaleMax);
    return out;
}

/** Extra y-axis padding so controller limit lines are not flush with top/bottom */
const Y_DOMAIN_PAD_FRACTION = 0.06;

/** Y-axis splits so scale min/max are always labelled */
function yAxisSplitsIncludeLimits(u, axisIdx, scaleMin, scaleMax) {
    const range = scaleMax - scaleMin;
    if (range <= 0) return [scaleMin];
    const n = 5;
    const out = [];
    for (let i = 0; i <= n; i++) {
        out.push(scaleMin + (range * i) / n);
    }
    return out;
}

function buildVocOptions(data, controllerMaxV, effectiveStartupV, width = CHART_WIDTH_DEFAULT) {
    const series = [
        { label: 'Temp', scale: 'x', value: (u, v) => (v != null ? `${v.toFixed(0)}°C` : '') },
        {
            label: 'String Voc',
            scale: 'y',
            stroke: '#0ea5e9',
            width: 2,
            paths: getSplinePath(),
            value: (u, v) => (v != null ? `${v.toFixed(1)} V` : ''),
        },
    ];
    const dataCols = [data.temps, data.vocSeries];
    if (controllerMaxV != null) {
        series.push({
            label: 'Controller max V',
            scale: 'y',
            stroke: '#dc2626',
            width: 1.5,
            dash: [6, 4],
            value: (u, v) => (v != null ? `${v.toFixed(0)} V` : ''),
        });
        dataCols.push(data.temps.map(() => controllerMaxV));
    }
    if (effectiveStartupV != null) {
        series.push({
            label: 'Startup V',
            scale: 'y',
            stroke: '#16a34a',
            width: 1.5,
            dash: [6, 4],
            value: (u, v) => (v != null ? `${v.toFixed(0)} V` : ''),
        });
        dataCols.push(data.temps.map(() => effectiveStartupV));
    }
    const yMin = Math.min(...data.vocSeries.filter((v) => v != null));
    const yMax = Math.max(...data.vocSeries.filter((v) => v != null));
    const refs = [controllerMaxV, effectiveStartupV].filter((v) => v != null);
    const pad = (yMax - yMin) * 0.08 || 5;
    let rangeMin = Math.min(yMin - pad, ...refs) - 2;
    let rangeMax = Math.max(yMax + pad, ...refs) + 2;
    const rangePad = (rangeMax - rangeMin) * Y_DOMAIN_PAD_FRACTION;
    rangeMin -= rangePad;
    rangeMax += rangePad;

    return {
        width,
        height: CHART_HEIGHT,
        series,
        scales: {
            x: { time: false, min: -40, max: 85 },
            y: { min: rangeMin, max: rangeMax },
        },
        axes: [
            { scale: 'x', show: true, stroke: commonAxisStyle.stroke, font: commonAxisStyle.font, gap: 4, grid: commonGrid, splits: tempAxisSplits, values: (u, splits) => splits.map((x) => `${x}°C`) },
            { scale: 'y', show: true, stroke: commonAxisStyle.stroke, font: commonAxisStyle.font, gap: 4, grid: commonGrid, splits: yAxisSplitsIncludeLimits },
        ],
        cursor: commonCursor,
        legend: { show: true, live: true },
    };
}

function buildIscOptions(data, controllerMaxIsc, width = CHART_WIDTH_DEFAULT) {
    const series = [
        { label: 'Temp', scale: 'x', value: (u, v) => (v != null ? `${v.toFixed(0)}°C` : '') },
        {
            label: 'Array Isc',
            scale: 'y',
            stroke: '#0ea5e9',
            width: 2,
            paths: getSplinePath(),
            value: (u, v) => (v != null ? `${v.toFixed(2)} A` : ''),
        },
    ];
    const dataCols = [data.temps, data.iscSeries];
    if (controllerMaxIsc != null) {
        series.push({
            label: 'Controller max Isc',
            scale: 'y',
            stroke: '#dc2626',
            width: 1.5,
            dash: [6, 4],
            value: (u, v) => (v != null ? `${v.toFixed(2)} A` : ''),
        });
        dataCols.push(data.temps.map(() => controllerMaxIsc));
    }
    const yMin = Math.min(...data.iscSeries.filter((v) => v != null));
    const yMax = Math.max(...data.iscSeries.filter((v) => v != null));
    const pad = (yMax - yMin) * 0.08 || 0.1;
    let rangeMin = controllerMaxIsc != null ? Math.min(yMin - pad, controllerMaxIsc) - 0.5 : yMin - pad;
    let rangeMax = controllerMaxIsc != null ? Math.max(yMax + pad, controllerMaxIsc) + 0.5 : yMax + pad;
    const rangePad = (rangeMax - rangeMin) * Y_DOMAIN_PAD_FRACTION;
    rangeMin -= rangePad;
    rangeMax += rangePad;

    return {
        width,
        height: CHART_HEIGHT,
        series,
        scales: {
            x: { time: false, min: -40, max: 85 },
            y: { min: rangeMin, max: rangeMax },
        },
        axes: [
            { scale: 'x', show: true, stroke: commonAxisStyle.stroke, font: commonAxisStyle.font, gap: 4, grid: commonGrid, splits: tempAxisSplits, values: (u, splits) => splits.map((x) => `${x}°C`) },
            { scale: 'y', show: true, stroke: commonAxisStyle.stroke, font: commonAxisStyle.font, gap: 4, grid: commonGrid, splits: yAxisSplitsIncludeLimits },
        ],
        cursor: commonCursor,
        legend: { show: true, live: true },
    };
}

function buildPmaxOptions(data, width = CHART_WIDTH_DEFAULT) {
    const yMin = Math.min(...data.pmaxSeries.filter((v) => v != null));
    const yMax = Math.max(...data.pmaxSeries.filter((v) => v != null));
    const pad = (yMax - yMin) * 0.08 || 10;
    let rangeMin = yMin - pad;
    let rangeMax = yMax + pad;
    const rangePad = (rangeMax - rangeMin) * Y_DOMAIN_PAD_FRACTION;
    rangeMin -= rangePad;
    rangeMax += rangePad;
    return {
        width,
        height: CHART_HEIGHT,
        series: [
            { label: 'Temp', scale: 'x', value: (u, v) => (v != null ? `${v.toFixed(0)}°C` : '') },
            {
                label: 'Array power',
                scale: 'y',
                stroke: '#0ea5e9',
                width: 2,
                paths: getSplinePath(),
                value: (u, v) => (v != null ? `${v.toFixed(0)} W` : ''),
            },
        ],
        scales: {
            x: { time: false, min: -40, max: 85 },
            y: { min: rangeMin, max: rangeMax },
        },
        axes: [
            { scale: 'x', show: true, stroke: commonAxisStyle.stroke, font: commonAxisStyle.font, gap: 4, grid: commonGrid, splits: tempAxisSplits, values: (u, splits) => splits.map((x) => `${x}°C`) },
            { scale: 'y', show: true, stroke: commonAxisStyle.stroke, font: commonAxisStyle.font, gap: 4, grid: commonGrid, splits: yAxisSplitsIncludeLimits },
        ],
        cursor: commonCursor,
        legend: { show: true, live: true },
    };
}

function ResponsiveChart({ getOptions, data, className = '' }) {
    const containerRef = useRef(null);
    const [chartWidth, setChartWidth] = useState(0);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect?.width;
            if (typeof w === 'number' && w > 0) {
                setChartWidth(Math.max(MIN_CHART_WIDTH, Math.floor(w) - CHART_MARGIN * 2));
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const options = chartWidth > 0 ? getOptions(chartWidth) : null;
    return (
        <div ref={containerRef} className={`w-full ${className}`} style={{ minHeight: CHART_HEIGHT + LEGEND_MIN_HEIGHT_PX }}>
            {options && data && <UplotReact options={options} data={data} />}
        </div>
    );
}

export default function ArrayOverviewGraphs({ panel, array, controller, effectiveStartupV }) {
    const seriesData = useMemo(
        () => computeTempSeries(panel, array, controller, effectiveStartupV),
        [panel, array, controller, effectiveStartupV]
    );

    const hasVoc = seriesData.vocSeries != null;
    const hasIsc = seriesData.iscSeries != null;
    const hasPmax = seriesData.pmaxSeries != null;
    const hasAny = hasVoc || hasIsc || hasPmax;

    if (!hasAny) return null;

    const vocData = hasVoc
        ? [
            seriesData.temps,
            seriesData.vocSeries,
            ...(seriesData.controllerMaxV != null ? [seriesData.temps.map(() => seriesData.controllerMaxV)] : []),
            ...(seriesData.effectiveStartupV != null ? [seriesData.temps.map(() => seriesData.effectiveStartupV)] : []),
        ]
        : null;
    const iscData = hasIsc
        ? [
            seriesData.temps,
            seriesData.iscSeries,
            ...(seriesData.controllerMaxIsc != null ? [seriesData.temps.map(() => seriesData.controllerMaxIsc)] : []),
        ]
        : null;
    const pmaxData = hasPmax ? [seriesData.temps, seriesData.pmaxSeries] : null;

    const getVocOptions = useCallback(
        (width) => buildVocOptions(seriesData, seriesData.controllerMaxV, seriesData.effectiveStartupV, width),
        [seriesData.temps, seriesData.vocSeries, seriesData.controllerMaxV, seriesData.effectiveStartupV]
    );
    const getIscOptions = useCallback(
        (width) => buildIscOptions(seriesData, seriesData.controllerMaxIsc, width),
        [seriesData.temps, seriesData.iscSeries, seriesData.controllerMaxIsc]
    );
    const getPmaxOptions = useCallback(
        (width) => buildPmaxOptions(seriesData, width),
        [seriesData.temps, seriesData.pmaxSeries]
    );

    return (
        <div className="array-overview-graphs bg-slate-50 p-6 rounded-lg border border-slate-200 mb-8">
            <style>{`
                .array-overview-graphs .u-legend { min-height: ${LEGEND_MIN_HEIGHT_PX}px !important; }
            `}</style>
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center">
                <Info size={16} className="mr-2 text-indigo-600" />
                Temperature Response
            </h3>
            <p className="text-xs text-slate-600 mb-4 max-w-4xl">
                Curves use this panel’s temperature coefficients (from its datasheet) to show string Voc, array Isc, and array power from −40°C to 85°C. They help you confirm cold Voc stays under the controller limit, hot Vmp stays above startup voltage, array Isc under max Isc, and how much power is lost at high temperatures.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center max-w-4xl mx-auto">
                {hasVoc && (
                    <div
                        className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 w-full max-w-[560px] flex flex-col"
                        style={{ minHeight: CHART_HEIGHT + LEGEND_MIN_HEIGHT_PX + 56 }}
                    >
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 text-center">
                            String Voc vs temperature
                        </p>
                        <div className="uplot-chart w-full">
                            <ResponsiveChart getOptions={getVocOptions} data={vocData} />
                        </div>
                    </div>
                )}
                {hasIsc && (
                    <div
                        className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 w-full max-w-[560px] flex flex-col"
                        style={{ minHeight: CHART_HEIGHT + LEGEND_MIN_HEIGHT_PX + 56 }}
                    >
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 text-center">
                            Array Isc vs temperature
                        </p>
                        <div className="uplot-chart w-full">
                            <ResponsiveChart getOptions={getIscOptions} data={iscData} />
                        </div>
                    </div>
                )}
                {hasPmax && (
                    <div
                        className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 w-full max-w-[560px] flex flex-col"
                        style={{ minHeight: CHART_HEIGHT + LEGEND_MIN_HEIGHT_PX + 56 }}
                    >
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 text-center">
                            Array power vs temperature
                        </p>
                        <div className="uplot-chart w-full">
                            <ResponsiveChart getOptions={getPmaxOptions} data={pmaxData} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
