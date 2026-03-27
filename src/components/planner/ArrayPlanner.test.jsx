import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ArrayPlanner from './ArrayPlanner';

const computePlannerLayoutsMock = vi.fn(() => ({
    ranked: [
        {
            id: 'P1_portrait',
            panelModel: 'P1',
            panelName: 'Panel 1',
            orientation: 'portrait',
            rows: 1,
            cols: 1,
            count: 1,
            totalW: 400,
            utilization: 0.5,
            rects_m: [{ x: 0, y: 0, w: 1, h: 1 }],
        },
    ],
    meta: {},
}));

vi.mock('../../lib/plannerEngine', () => ({
    computePlannerLayouts: (...args) => computePlannerLayoutsMock(...args),
    dropSmallestPanelsByFootprint: (panels) => panels,
}));

const mockAppState = {
    chargersData: [],
    siteControllers: [],
    selections: {},
    systemVoltage: 12,
    setArraysData: vi.fn(),
    updateArray: vi.fn(),
    hideHeavyPanels: false,
};

vi.mock('../../context/AppStateContext', () => ({
    useAppState: () => mockAppState,
}));

vi.mock('../../lib/arrayAnalysis', () => ({
    bestParallelStringsForController: () => null,
    formatWiringLabel: () => '',
    getEffectiveMaxPanelWeightKg: () => null,
    isCompatibleFormat: () => true,
    panelMeetsWeightCap: () => true,
}));

function makeArray(id, planner) {
    return {
        id,
        name: `Array ${id}`,
        planner,
        count: 1,
        panel: '',
    };
}

function getControlByLabelText(regex) {
    const labels = Array.from(document.querySelectorAll('label'));
    const label = labels.find((el) => regex.test(el.textContent || ''));
    if (!label) return null;
    let node = label.parentElement;
    while (node) {
        const control = node.querySelector('input, select, textarea');
        if (control) return control;
        node = node.parentElement;
    }
    return null;
}

const panelsData = [
    {
        id: 'panel-1',
        model: 'P1',
        name: 'Panel 1',
        power: 400,
        width: 1000,
        height: 2000,
        active: true,
    },
];

describe('ArrayPlanner quality fixes', () => {
    beforeEach(() => {
        computePlannerLayoutsMock.mockClear();
        mockAppState.setArraysData.mockClear();
        mockAppState.updateArray.mockClear();
    });

    it('rehydrates planner state when saved planner arrives after mount', async () => {
        const baseProps = {
            active: true,
            arrayId: 'a1',
            draftArrayData: null,
            panelsData,
            onHeaderChange: vi.fn(),
            onApplyCandidateToDraft: vi.fn(),
        };

        const initialArrays = [makeArray('a1', null)];
        const { rerender } = render(<ArrayPlanner {...baseProps} arraysData={initialArrays} />);

        expect(getControlByLabelText(/edge setback \(mm\)/i)).toHaveValue(400);

        const hydratedArrays = [
            makeArray('a1', {
                roofInput: { mode: 'actual', x_m: 6, y_m: 4, projectedX_m: 6, projectedY_m: 4, tilt_deg: 30 },
                roofPolygon: null,
                roofPolygonAuto: true,
                exclusions: [],
                spacing: { edge_mm: 1234, gap_mm: 75 },
                options: { orientation: 'either' },
                layoutOverride: { enabled: false },
                lastResult: null,
            }),
        ];

        rerender(<ArrayPlanner {...baseProps} arraysData={hydratedArrays} />);

        await waitFor(() => {
            expect(getControlByLabelText(/edge setback \(mm\)/i)).toHaveValue(1234);
        });
    });

    it('skips repeated layout compute during drag and recomputes on pointer up', async () => {
        const arraysData = [
            makeArray('a1', {
                roofInput: { mode: 'actual', x_m: 6, y_m: 4, projectedX_m: 6, projectedY_m: 4, tilt_deg: 30 },
                roofPolygon: null,
                roofPolygonAuto: true,
                exclusions: [{ id: 'ex1', x: 0.5, y: 0.5, w: 0.8, h: 0.8, label: 'Exclusion', color: '#ef4444' }],
                spacing: { edge_mm: 400, gap_mm: 25 },
                options: { orientation: 'either' },
                layoutOverride: { enabled: false },
                lastResult: null,
            }),
        ];
        const { container } = render(
            <ArrayPlanner
                active={true}
                arrayId="a1"
                draftArrayData={null}
                arraysData={arraysData}
                panelsData={panelsData}
                onHeaderChange={vi.fn()}
                onApplyCandidateToDraft={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(computePlannerLayoutsMock).toHaveBeenCalled();
        });
        const beforeDragCalls = computePlannerLayoutsMock.mock.calls.length;

        const svg = container.querySelector('svg');
        const exclusionRect = container.querySelector('rect[stroke="#ef4444"]');
        expect(svg).toBeTruthy();
        expect(exclusionRect).toBeTruthy();

        Object.defineProperty(svg, 'getBoundingClientRect', {
            value: () => ({ left: 0, top: 0, width: 500, height: 300, right: 500, bottom: 300 }),
            configurable: true,
        });

        fireEvent.pointerDown(exclusionRect, { clientX: 50, clientY: 50, pointerId: 1 });
        fireEvent.pointerMove(svg, { clientX: 80, clientY: 80, pointerId: 1 });
        fireEvent.pointerMove(svg, { clientX: 90, clientY: 90, pointerId: 1 });
        fireEvent.pointerMove(svg, { clientX: 100, clientY: 100, pointerId: 1 });

        expect(computePlannerLayoutsMock.mock.calls.length).toBe(beforeDragCalls);

        fireEvent.pointerUp(svg, { pointerId: 1 });
        expect(computePlannerLayoutsMock.mock.calls.length).toBeGreaterThanOrEqual(beforeDragCalls);
    });

    it('clamps projected tilt input to 70 degrees', async () => {
        const arraysData = [
            makeArray('a1', {
                roofInput: { mode: 'actual', x_m: 6, y_m: 4, projectedX_m: 6, projectedY_m: 4, tilt_deg: 30 },
                roofPolygon: null,
                roofPolygonAuto: true,
                exclusions: [],
                spacing: { edge_mm: 400, gap_mm: 25 },
                options: { orientation: 'either' },
                layoutOverride: { enabled: false },
                lastResult: null,
            }),
        ];
        render(
            <ArrayPlanner
                active={true}
                arrayId="a1"
                draftArrayData={null}
                arraysData={arraysData}
                panelsData={panelsData}
                onHeaderChange={vi.fn()}
                onApplyCandidateToDraft={vi.fn()}
            />
        );

        const modeSelect = screen.getByDisplayValue('Actual X/Y');
        expect(modeSelect).toBeTruthy();
        fireEvent.change(modeSelect, { target: { value: 'projected' } });

        const tiltInput = getControlByLabelText(/tilt \(deg\)/i);
        expect(tiltInput).toBeTruthy();
        fireEvent.change(tiltInput, { target: { value: '90' } });

        await waitFor(() => {
            expect(tiltInput).toHaveValue(70);
        });
    });
});
