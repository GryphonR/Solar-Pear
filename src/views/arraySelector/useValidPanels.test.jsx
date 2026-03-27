import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useValidPanels } from './useValidPanels';

function TestHarness({ arrayId, options }) {
    const { validPanels, togglePanelSort } = useValidPanels(arrayId, options);
    return (
        <div>
            <span data-testid="count">{validPanels.length}</span>
            <span data-testid="names">{validPanels.map((p) => p.model).join(',')}</span>
            <button type="button" onClick={() => togglePanelSort('peakPower')}>
                Sort
            </button>
        </div>
    );
}

describe('useValidPanels', () => {
    const baseArray = {
        id: 'A1',
        name: 'Array 1',
        area: 'House',
        count: 2,
        parallelStrings: 1,
        format: 'Portrait',
        mounting: 'On Roof',
        maxPanelHeight: '',
        maxPanelWidth: '',
        maxPanelWeight: '',
    };

    const controllerMaxV100 = {
        id: 'C1',
        maxV: 100,
        maxIsc: 20,
        startupV: 30,
        systemVoltages: [12, 24, 48],
        v_start_vbat_dependent: true,
    };

    it('returns empty when arrayId not found', () => {
        const options = {
            panelsData: [],
            arraysData: [],
            chargersData: [],
            siteControllers: [],
            selections: {},
            systemVoltage: 24,
            hideHeavyPanels: false,
            hideMarginalPanels: false,
            hideIncompatiblePanels: true,
            panelSort: { key: 'peakPower', dir: 'desc' },
            setPanelSort: () => {},
        };
        render(<TestHarness arrayId="MISSING" options={options} />);
        expect(screen.getByTestId('count').textContent).toBe('0');
    });

    it('includes panels that pass physical and electrical limits when controller set', () => {
        const panelOk = {
            model: 'P_OK',
            name: 'Panel OK',
            power: 400,
            voc: 40,
            vmp: 34,
            isc: 12,
            weight: 20,
            height: 2000,
            width: 1000,
            active: true,
            gseCompatibility: 'Both',
            price: 100,
        };
        const panelVocTooHigh = {
            model: 'P_HIGH_VOC',
            name: 'Panel High Voc',
            power: 450,
            voc: 60,
            vmp: 50,
            isc: 12,
            weight: 22,
            height: 2100,
            width: 1000,
            active: true,
            gseCompatibility: 'Both',
            price: 120,
        };
        const options = {
            panelsData: [panelOk, panelVocTooHigh],
            arraysData: [baseArray],
            chargersData: [controllerMaxV100],
            siteControllers: [],
            selections: { A1: { panel: 'P_OK', controllerInstanceId: '', controller: 'C1' } },
            systemVoltage: 24,
            hideHeavyPanels: false,
            hideMarginalPanels: false,
            hideIncompatiblePanels: true,
            panelSort: { key: 'peakPower', dir: 'desc' },
            setPanelSort: () => {},
        };
        render(<TestHarness arrayId="A1" options={options} />);
        const count = screen.getByTestId('count').textContent;
        const names = screen.getByTestId('names').textContent;
        expect(Number(count)).toBeGreaterThanOrEqual(1);
        expect(names).toContain('P_OK');
        expect(names).not.toContain('P_HIGH_VOC');
    });

    it('returns both panels when hideIncompatiblePanels is false', () => {
        const panelOk = {
            model: 'P1',
            name: 'Panel 1',
            power: 400,
            voc: 40,
            vmp: 34,
            isc: 12,
            weight: 20,
            height: 2000,
            width: 1000,
            active: true,
            gseCompatibility: 'Both',
            price: 100,
        };
        const panelBad = {
            model: 'P2',
            name: 'Panel 2',
            power: 500,
            voc: 70,
            vmp: 60,
            isc: 14,
            weight: 25,
            height: 2200,
            width: 1100,
            active: true,
            gseCompatibility: 'Both',
            price: 130,
        };
        const options = {
            panelsData: [panelOk, panelBad],
            arraysData: [baseArray],
            chargersData: [controllerMaxV100],
            siteControllers: [],
            selections: { A1: { controller: 'C1' } },
            systemVoltage: 24,
            hideHeavyPanels: false,
            hideMarginalPanels: false,
            hideIncompatiblePanels: false,
            panelSort: { key: 'peakPower', dir: 'desc' },
            setPanelSort: () => {},
        };
        render(<TestHarness arrayId="A1" options={options} />);
        expect(screen.getByTestId('count').textContent).toBe('2');
        expect(screen.getByTestId('names').textContent).toContain('P1');
        expect(screen.getByTestId('names').textContent).toContain('P2');
    });

    it('filters out None-compatible panels for in-roof GSE arrays', () => {
        const gseArray = { ...baseArray, mounting: 'In-Roof (GSE)', format: 'Portrait' };
        const panelOk = {
            model: 'P_OK_GSE',
            name: 'Panel OK GSE',
            power: 400,
            voc: 40,
            vmp: 34,
            isc: 12,
            weight: 20,
            height: 2000,
            width: 1000,
            active: true,
            gseCompatibility: 'Both',
            price: 100,
        };
        const panelNone = {
            model: 'P_NONE',
            name: 'Panel None',
            power: 420,
            voc: 40,
            vmp: 34,
            isc: 12,
            weight: 20,
            height: 2000,
            width: 1000,
            active: true,
            gseCompatibility: 'None',
            price: 110,
        };
        const options = {
            panelsData: [panelOk, panelNone],
            arraysData: [gseArray],
            chargersData: [],
            siteControllers: [],
            selections: { A1: {} },
            systemVoltage: 24,
            hideHeavyPanels: false,
            hideMarginalPanels: false,
            hideIncompatiblePanels: false,
            panelSort: { key: 'peakPower', dir: 'desc' },
            setPanelSort: () => {},
        };
        render(<TestHarness arrayId="A1" options={options} />);
        expect(screen.getByTestId('names').textContent).toContain('P_OK_GSE');
        expect(screen.getByTestId('names').textContent).not.toContain('P_NONE');
    });
});
