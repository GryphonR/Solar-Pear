import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppState } from '../context/AppStateContext';
import { analyzeArray } from '../lib/arrayAnalysis';
import SummaryView from './SummaryView';

vi.mock('../context/AppStateContext', () => ({
    useAppState: vi.fn(),
}));

const minimalArray = {
    id: 'A1',
    name: 'Array 1',
    area: 'House',
    count: 6,
    parallelStrings: 1,
    format: 'Portrait',
    mounting: 'On Roof',
    maxPanelHeight: '',
    maxPanelWidth: '',
    maxPanelWeight: '',
};

const minimalPanel = {
    model: 'P_TEST',
    name: 'Test Panel 400W',
    power: 400,
    voc: 40,
    vmp: 34,
    isc: 12,
    price: 100,
    active: true,
    gseCompatibility: 'Both',
    height: 2000,
    width: 1000,
    weight: 20,
};

const minimalController = {
    id: 'C_TEST',
    name: 'Test Controller',
    manufacturer: 'Test Mfr',
    maxV: 150,
    maxIsc: 20,
    startupV: 30,
    systemVoltages: [12, 24, 48],
    price: 200,
};

const minimalInstance = {
    id: 'inst_C_TEST_1',
    modelId: 'C_TEST',
    area: 'House',
    name: 'Test Mfr Test Controller (#1)',
};

const minimalSelections = {
    A1: {
        panel: 'P_TEST',
        controllerInstanceId: 'inst_C_TEST_1',
        controllerMppt: 1,
    },
};

function buildMockAppState() {
    const arraysData = [minimalArray];
    const panelsData = [minimalPanel];
    const chargersData = [minimalController];
    const siteControllers = [minimalInstance];
    const selections = minimalSelections;

    const getArrayAnalysis = (arrayId) =>
        analyzeArray(arrayId, {
            arraysData,
            panelsData,
            chargersData,
            siteControllers,
            selections,
            systemVoltage: 24,
        });

    return {
        arraysData,
        areasData: ['House'],
        panelsData,
        chargersData,
        siteControllers,
        selections,
        getArrayAnalysis,
    };
}

describe('SummaryView', () => {
    beforeEach(() => {
        vi.mocked(useAppState).mockReturnValue(buildMockAppState());
    });

    it('renders System Summary and Bill of Materials with minimal state', () => {
        render(<SummaryView />);

        expect(screen.getByText(/System Summary/i)).toBeInTheDocument();
        expect(screen.getByText(/Bill of Materials \(BOM\)/i)).toBeInTheDocument();
    });

    it('shows array and panel in summary when state has one array with panel and controller', () => {
        render(<SummaryView />);

        expect(screen.getAllByText(minimalArray.name).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/Test Panel 400W/).length).toBeGreaterThanOrEqual(1);
    });
});
