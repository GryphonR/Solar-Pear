import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React, { useEffect, useRef } from 'react';
import { AppStateProvider, useAppState } from './AppStateContext';

function clearAppStorage() {
    const keys = [
        'user_notes',
        'solar_arrays',
        'solar_site_controllers',
        // Legacy migration key (read-only for app, but cleared for isolation).
        'solar_selections',
        'solar_chargers',
        'solar_panels',
        'solar_hide_heavy_panels',
        'solar_hide_marginal_panels',
        'solar_system_voltage',
        'solar_system_type',
        'solar_filter_eps',
        'solar_filter_house_backup',
        'solar_area_settings',
        'solar_areas',
        'solar_hide_incompatible_panels',
        'solar_hide_incompatible_controllers',
        'solar_active_array_content_tab',
    ];
    keys.forEach((k) => localStorage.removeItem(k));
}

function ContextIntegrationConsumer() {
    const {
        arraysData,
        panelsData,
        updateSelection,
        getArrayAnalysis,
    } = useAppState();
    const hasUpdated = useRef(false);

    useEffect(() => {
        if (hasUpdated.current || !arraysData?.length || !panelsData?.length) return;
        hasUpdated.current = true;
        updateSelection(arraysData[0].id, 'panel', panelsData[0].model);
    }, [arraysData, panelsData, updateSelection]);

    const arrayId = arraysData?.[0]?.id;
    const analysis = arrayId ? getArrayAnalysis(arrayId) : null;
    const panelModel = analysis?.panel?.model ?? 'none';

    return (
        <div data-testid="context-integration">
            <span data-testid="panel-model">{panelModel}</span>
            <span data-testid="array-id">{arrayId ?? 'none'}</span>
        </div>
    );
}

function AreaSettingsConsumer() {
    const { getAreaSettings, updateAreaSettings, areasData } = useAppState();
    const hasUpdated = useRef(false);

    useEffect(() => {
        if (hasUpdated.current || !areasData?.length) return;
        hasUpdated.current = true;
        updateAreaSettings(areasData[0], { systemVoltage: 24, systemType: 'dc-charger' });
    }, [areasData, updateAreaSettings]);

    const firstArea = areasData?.[0] || 'House';
    const settings = getAreaSettings(firstArea);

    return (
        <div data-testid="area-settings">
            <span data-testid="area-settings-voltage">{String(settings.systemVoltage)}</span>
            <span data-testid="area-settings-type">{settings.systemType}</span>
        </div>
    );
}

describe('AppStateContext integration', () => {
    beforeEach(() => {
        clearAppStorage();
    });

    it('updates selection and getArrayAnalysis returns the selected panel', async () => {
        render(
            <AppStateProvider>
                <ContextIntegrationConsumer />
            </AppStateProvider>
        );

        expect(screen.getByTestId('context-integration')).toBeInTheDocument();

        await waitFor(
            () => {
                const panelModel = screen.getByTestId('panel-model').textContent;
                expect(panelModel).not.toBe('none');
                expect(panelModel.length).toBeGreaterThan(0);
            },
            { timeout: 3000, interval: 50 }
        );

        const arrayId = screen.getByTestId('array-id').textContent;
        expect(arrayId).not.toBe('none');
    }, 5000);

    it('stores and reads per-area controller filter settings', async () => {
        render(
            <AppStateProvider>
                <AreaSettingsConsumer />
            </AppStateProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('area-settings-voltage').textContent).toBe('24');
            expect(screen.getByTestId('area-settings-type').textContent).toBe('dc-charger');
        });
    });
});
