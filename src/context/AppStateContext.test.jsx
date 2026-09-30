import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React, { useEffect, useRef } from 'react';
import { AppStateProvider, useAppState } from './AppStateContext';

function clearAppStorage() {
    const keys = [
        'user_notes',
        'solar_projects',
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

function ProjectProbe() {
    const { arraysData, areasData, siteControllers, areaSettingsByArea, activeProject, loadStatus } = useAppState();
    return (
        <div data-testid="probe">
            {JSON.stringify({ loadStatus, arraysData, areasData, siteControllers, areaSettingsByArea, project: activeProject.name })}
        </div>
    );
}

const readProbe = () => JSON.parse(screen.getByTestId('probe').textContent);

describe('storage v2 -> v3 (roadmap 13.2)', () => {
    beforeEach(() => {
        clearAppStorage();
    });

    const seedV2 = () => {
        const arrays = [
            { id: 'A1', name: 'South roof', area: 'House', orientation: 'South', count: 8, format: 'Portrait', mounting: 'On Roof', panel: 'p1', controllerInstanceId: 'inst_1', controllerMppt: 2, controller: '' },
            { id: 'array_77', name: 'Garage roof', area: 'Garage', orientation: 'East', count: 4, format: 'Portrait', mounting: 'On Roof', panel: '', controllerInstanceId: '', controllerMppt: 1, controller: '' },
        ];
        localStorage.setItem('solar_arrays', JSON.stringify(arrays));
        localStorage.setItem('solar_areas', JSON.stringify(['House', 'Garage']));
        localStorage.setItem('solar_site_controllers', JSON.stringify([{ id: 'inst_1', modelId: 'no_such_model', area: 'House', name: 'Test (#1)' }]));
        localStorage.setItem('solar_area_settings', JSON.stringify({ House: { systemVoltage: 48, designLowC: -15 }, Garage: { systemVoltage: 12 } }));
        localStorage.setItem('solar_storage_version', '2');
        return arrays;
    };

    it('moves an existing design into one Local project called "My design" without losing anything', async () => {
        const arrays = seedV2();
        render(
            <AppStateProvider>
                <ProjectProbe />
            </AppStateProvider>
        );
        await waitFor(() => expect(readProbe().loadStatus).toBe('ok'));

        const state = readProbe();
        expect(state.project).toBe('My design');
        expect(state.areasData).toEqual(['House', 'Garage']);
        expect(state.arraysData.map((a) => [a.id, a.name, a.area, a.count, a.panel, a.controllerMppt])).toEqual(
            arrays.map((a) => [a.id, a.name, a.area, a.count, a.panel, a.controllerMppt])
        );
        expect(state.siteControllers[0]).toMatchObject({ id: 'inst_1', area: 'House' });
        expect(state.areaSettingsByArea.House).toMatchObject({ systemVoltage: 48, designLowC: -15 });
        expect(state.areaSettingsByArea.Garage).toMatchObject({ systemVoltage: 12 });

        // Saved as v3, with stable ids, and the v2 keys are gone.
        const stored = JSON.parse(localStorage.getItem('solar_projects'));
        expect(stored.projects).toHaveLength(1);
        expect(stored.projects[0].kind).toBe('local');
        expect(stored.projects[0].systems.map((s) => s.id)).toEqual([expect.stringMatching(/^sys_/), expect.stringMatching(/^sys_/)]);
        expect(stored.projects[0].arrays.every((a) => !('area' in a) && a.systemId)).toBe(true);
        for (const key of ['solar_arrays', 'solar_areas', 'solar_site_controllers', 'solar_area_settings']) {
            expect(localStorage.getItem(key)).toBeNull();
        }
        expect(localStorage.getItem('solar_storage_version')).toBe('3');
    });

    it('keeps the same project and ids when the app is reloaded', async () => {
        seedV2();
        const first = render(
            <AppStateProvider>
                <ProjectProbe />
            </AppStateProvider>
        );
        await waitFor(() => expect(readProbe().loadStatus).toBe('ok'));
        const before = JSON.parse(localStorage.getItem('solar_projects'));
        first.unmount();

        render(
            <AppStateProvider>
                <ProjectProbe />
            </AppStateProvider>
        );
        await waitFor(() => expect(readProbe().loadStatus).toBe('ok'));
        expect(JSON.parse(localStorage.getItem('solar_projects')).projects.map((p) => [p.id, p.systems.map((s) => s.id)])).toEqual(
            before.projects.map((p) => [p.id, p.systems.map((s) => s.id)])
        );
        expect(readProbe().arraysData).toHaveLength(2);
    });

    it('a fresh visitor gets one empty "My design" project', async () => {
        render(
            <AppStateProvider>
                <ProjectProbe />
            </AppStateProvider>
        );
        await waitFor(() => expect(readProbe().loadStatus).toBe('ok'));
        expect(readProbe().project).toBe('My design');
        expect(readProbe().areasData).toEqual(['House']);
        expect(JSON.parse(localStorage.getItem('solar_projects')).projects).toHaveLength(1);
    });
});

function SystemActionsProbe() {
    const app = useAppState();
    return (
        <div>
            <button onClick={() => app.openEditAreaModal('House')}>open-edit</button>
            <button onClick={() => app.handleAreaModalSave('Main house')}>save-edit</button>
            <button onClick={() => { app.openAddAreaModal(); }}>open-add</button>
            <button onClick={() => app.handleAreaModalSave('Barn')}>save-add</button>
            <button onClick={() => app.deleteArea('Garage')}>delete-garage</button>
            <button onClick={() => app.confirmModal.action(false)}>confirm</button>
            <ProjectProbe />
        </div>
    );
}

describe('system actions keep ids (roadmap 13.2)', () => {
    beforeEach(() => {
        clearAppStorage();
    });

    it('renaming a system keeps its arrays and settings attached, adding works, and deleting moves arrays', async () => {
        localStorage.setItem('solar_arrays', JSON.stringify([
            { id: 'A1', name: 'South', area: 'House', count: 8, panel: '', controllerInstanceId: '', controllerMppt: 1, controller: '' },
            { id: 'A2', name: 'Roof', area: 'Garage', count: 4, panel: '', controllerInstanceId: '', controllerMppt: 1, controller: '' },
        ]));
        localStorage.setItem('solar_areas', JSON.stringify(['House', 'Garage']));
        localStorage.setItem('solar_area_settings', JSON.stringify({ House: { systemVoltage: 48 }, Garage: { systemVoltage: 12 } }));
        const { default: userEvent } = await import('@testing-library/user-event');
        render(
            <AppStateProvider>
                <SystemActionsProbe />
            </AppStateProvider>
        );
        await waitFor(() => expect(readProbe().loadStatus).toBe('ok'));
        const idsBefore = JSON.parse(localStorage.getItem('solar_projects')).projects[0].systems.map((s) => s.id);

        await userEvent.click(screen.getByText('open-edit'));
        await userEvent.click(screen.getByText('save-edit'));
        await waitFor(() => expect(readProbe().areasData).toEqual(['Main house', 'Garage']));
        expect(readProbe().arraysData.map((a) => a.area)).toEqual(['Main house', 'Garage']);
        expect(readProbe().areaSettingsByArea['Main house'].systemVoltage).toBe(48);
        expect(JSON.parse(localStorage.getItem('solar_projects')).projects[0].systems.map((s) => s.id)).toEqual(idsBefore);

        await userEvent.click(screen.getByText('open-add'));
        await userEvent.click(screen.getByText('save-add'));
        await waitFor(() => expect(readProbe().areasData).toEqual(['Main house', 'Garage', 'Barn']));

        await userEvent.click(screen.getByText('delete-garage'));
        await userEvent.click(screen.getByText('confirm'));
        await waitFor(() => expect(readProbe().areasData).toEqual(['Main house', 'Barn']));
        expect(readProbe().arraysData.map((a) => [a.id, a.area])).toEqual([['A1', 'Main house'], ['A2', 'Main house']]);
    });
});

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
