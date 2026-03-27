import { describe, it, expect } from 'vitest';
import {
    BACKUP_SCHEMA_VERSION,
    buildBackupPayload,
    applyBackupData,
} from './useBackupRestore';

describe('buildBackupPayload', () => {
    it('includes schemaVersion', () => {
        const state = {
            areasData: ['House'],
            arraysData: [],
            panelsData: [],
            chargersData: [],
            siteControllers: [],
            areaSettingsByArea: { House: { systemVoltage: 48, systemType: 'any', filterEps: false, filterHouseBackup: false } },
            systemVoltage: null,
            hiddenChargerMfr: null,
            hideHeavyPanels: false,
            hideMarginalPanels: false,
            userNotes: {},
        };
        const payload = buildBackupPayload(state);
        expect(payload.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
        expect(payload).not.toHaveProperty('selections');
    });

    it('includes falsy values so they round-trip on restore', () => {
        const state = {
            areasData: ['House'],
            arraysData: [],
            panelsData: [],
            chargersData: [],
            siteControllers: [],
            areaSettingsByArea: { House: { systemVoltage: 24, systemType: 'dc-charger', filterEps: false, filterHouseBackup: false } },
            systemVoltage: 24,
            hiddenChargerMfr: null,
            hideHeavyPanels: false,
            hideMarginalPanels: true,
            userNotes: {},
        };
        const payload = buildBackupPayload(state);
        expect(payload.systemVoltage).toBe(24);
        expect(payload.hideHeavyPanels).toBe(false);
        expect(payload.hideMarginalPanels).toBe(true);
    });

    it('includes systemVoltage 0 and null when present', () => {
        const state = {
            areasData: ['House'],
            arraysData: [],
            panelsData: [],
            chargersData: [],
            siteControllers: [],
            areaSettingsByArea: { House: { systemVoltage: 0, systemType: 'any', filterEps: false, filterHouseBackup: false } },
            systemVoltage: 0,
            hiddenChargerMfr: null,
            hideHeavyPanels: false,
            hideMarginalPanels: false,
            userNotes: {},
        };
        const payload = buildBackupPayload(state);
        expect(payload.systemVoltage).toBe(0);
    });
});

describe('applyBackupData', () => {
    it('calls setters with restored values including falsy', () => {
        const setters = {
            setAreasData: () => {},
            setArraysData: () => {},
            setPanelsData: () => {},
            setChargersData: () => {},
            setSiteControllers: () => {},
            setAreaSettingsByArea: (v) => captured.areaSettingsByArea = v,
            setSystemVoltage: (v) => captured.systemVoltage = v,
            setHiddenChargerMfr: (v) => captured.hiddenChargerMfr = v,
            setHideHeavyPanels: (v) => captured.hideHeavyPanels = v,
            setHideMarginalPanels: (v) => captured.hideMarginalPanels = v,
            setUserNotes: () => {},
        };
        const captured = {};
        const imported = {
            areasData: ['House', 'Garage'],
            arraysData: [],
            panelsData: [],
            chargersData: [],
            siteControllers: [],
            areaSettingsByArea: {
                House: { systemVoltage: 24, systemType: 'grid-connected', filterEps: true, filterHouseBackup: false },
            },
            systemVoltage: 24,
            hiddenChargerMfr: null,
            hideHeavyPanels: false,
            hideMarginalPanels: true,
            userNotes: {},
        };
        applyBackupData(imported, setters);
        expect(captured.systemVoltage).toBe(24);
        expect(captured.areaSettingsByArea).toEqual({
            House: {
                systemVoltage: 24,
                systemType: 'grid-connected',
                filterEps: true,
                filterHouseBackup: false,
            },
        });
        expect(captured.hideHeavyPanels).toBe(false);
        expect(captured.hideMarginalPanels).toBe(true);
    });

    it('restores systemVoltage 0 when in backup', () => {
        const captured = {};
        const setters = {
            setAreasData: () => {},
            setArraysData: () => {},
            setPanelsData: () => {},
            setChargersData: () => {},
            setSiteControllers: () => {},
            setAreaSettingsByArea: () => {},
            setSystemVoltage: (v) => captured.systemVoltage = v,
            setHiddenChargerMfr: () => {},
            setHideHeavyPanels: () => {},
            setHideMarginalPanels: () => {},
            setUserNotes: () => {},
        };
        applyBackupData({ systemVoltage: 0 }, setters);
        expect(captured.systemVoltage).toBe(0);
    });

    it('restores systemVoltage null when in backup', () => {
        const captured = {};
        const setters = {
            setAreasData: () => {},
            setArraysData: () => {},
            setPanelsData: () => {},
            setChargersData: () => {},
            setSiteControllers: () => {},
            setAreaSettingsByArea: () => {},
            setSystemVoltage: (v) => captured.systemVoltage = v,
            setHiddenChargerMfr: () => {},
            setHideHeavyPanels: () => {},
            setHideMarginalPanels: () => {},
            setUserNotes: () => {},
        };
        applyBackupData({ systemVoltage: null }, setters);
        expect(captured.systemVoltage).toBe(null);
    });

    it('does not call setSystemVoltage when key is absent', () => {
        let called = false;
        const setters = {
            setAreasData: () => {},
            setArraysData: () => {},
            setPanelsData: () => {},
            setChargersData: () => {},
            setSiteControllers: () => {},
            setAreaSettingsByArea: () => {},
            setSystemVoltage: () => { called = true; },
            setHiddenChargerMfr: () => {},
            setHideHeavyPanels: () => {},
            setHideMarginalPanels: () => {},
            setUserNotes: () => {},
        };
        applyBackupData({}, setters);
        expect(called).toBe(false);
    });

    it('merges legacy imported.selections into arraysData', () => {
        let capturedArrays = null;
        const setters = {
            setAreasData: () => {},
            setArraysData: (v) => {
                capturedArrays = v;
            },
            setPanelsData: () => {},
            setChargersData: () => {},
            setSiteControllers: () => {},
            setAreaSettingsByArea: () => {},
            setSystemVoltage: () => {},
            setHiddenChargerMfr: () => {},
            setHideHeavyPanels: () => {},
            setHideMarginalPanels: () => {},
            setUserNotes: () => {},
        };

        applyBackupData(
            {
                arraysData: [{ id: 'A1', name: 'Array 1' }],
                selections: {
                    A1: {
                        panel: 'PANEL_X',
                        controllerInstanceId: 'inst_123',
                        controllerMppt: 2,
                        controller: 'CTRL_MODEL',
                    },
                },
            },
            setters
        );

        expect(capturedArrays).toEqual([
            {
                id: 'A1',
                name: 'Array 1',
                panel: 'PANEL_X',
                controllerInstanceId: 'inst_123',
                controllerMppt: 2,
                controller: 'CTRL_MODEL',
            },
        ]);
    });

    it('derives per-area settings from legacy global filter fields when areaSettingsByArea is absent', () => {
        const captured = {};
        const setters = {
            setAreasData: () => {},
            setArraysData: () => {},
            setPanelsData: () => {},
            setChargersData: () => {},
            setSiteControllers: () => {},
            setAreaSettingsByArea: (v) => {
                captured.areaSettingsByArea = v;
            },
            setSystemVoltage: () => {},
            setHiddenChargerMfr: () => {},
            setHideHeavyPanels: () => {},
            setHideMarginalPanels: () => {},
            setUserNotes: () => {},
        };
        applyBackupData(
            {
                areasData: ['House', 'Garage'],
                systemVoltage: 48,
                systemType: 'grid-connected',
                filterEps: true,
                filterHouseBackup: true,
            },
            setters
        );
        expect(captured.areaSettingsByArea).toEqual({
            House: {
                systemVoltage: 48,
                systemType: 'grid-connected',
                filterEps: true,
                filterHouseBackup: true,
            },
            Garage: {
                systemVoltage: 48,
                systemType: 'grid-connected',
                filterEps: true,
                filterHouseBackup: true,
            },
        });
    });
});
