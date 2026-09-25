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

    it('rejects non-array panelsData with a warning and strips malicious buyLinks', () => {
        let panels = null;
        const setters = {
            setAreasData: () => {},
            setArraysData: () => {},
            setPanelsData: (v) => {
                panels = v;
            },
            setChargersData: () => {},
            setSiteControllers: () => {},
            setAreaSettingsByArea: () => {},
            setSystemVoltage: () => {},
            setHiddenChargerMfr: () => {},
            setHideHeavyPanels: () => {},
            setHideMarginalPanels: () => {},
            setUserNotes: () => {},
        };
        const { warnings } = applyBackupData(
            {
                panelsData: [
                    {
                        model: 'P1',
                        name: 'Ok',
                        datasheetUrl: 'javascript:alert(1)',
                        buyLinks: [{ Supplier: 'Bad', URL: 'javascript:evil()' }, { Supplier: 'Good', URL: 'https://example.com/buy' }],
                    },
                ],
            },
            setters
        );
        // Legacy (≤ v4) backups: a custom panel is kept, sanitised, after the bundled catalogue.
        const p1 = panels.find((p) => p.model === 'P1');
        expect(p1.datasheetUrl).toBe('');
        expect(p1.buyLinks).toHaveLength(1);
        expect(p1.buyLinks[0].URL).toMatch(/^https:\/\/example\.com/);
        expect(warnings).toEqual([]);
    });

    const captureSetters = () => {
        const out = {};
        const setters = {
            setAreasData: () => {},
            setArraysData: () => {},
            setPanelsData: (v) => {
                out.panels = v;
            },
            setChargersData: (v) => {
                out.chargers = v;
            },
            setSiteControllers: () => {},
            setAreaSettingsByArea: () => {},
            setSystemVoltage: () => {},
            setHiddenChargerMfr: () => {},
            setHideHeavyPanels: () => {},
            setHideMarginalPanels: () => {},
            setUserNotes: () => {},
        };
        return { out, setters };
    };
    const bundled = {
        panels: [
            { model: 'A', price: 100, priceCheckedAt: '2026-08-01' },
            { model: 'B', price: 120, priceCheckedAt: '2026-08-01' },
        ],
        chargers: [{ id: 'C', price: 90, priceCheckedAt: '2026-08-01' }],
    };

    it('v5 backups export only user edits and restore them over the current catalogue', () => {
        const payload = buildBackupPayload(
            {
                areasData: ['House'],
                arraysData: [],
                panelsData: [{ ...bundled.panels[0], price: 95 }, bundled.panels[1], { model: 'MINE', price: 10 }],
                chargersData: bundled.chargers,
                siteControllers: [],
            },
            bundled
        );
        expect(payload.panelsData).toBeUndefined();
        expect(payload.catalogueOverrides.panels).toEqual({
            overrides: { A: { price: 95 } },
            custom: [{ model: 'MINE', price: 10 }],
            removed: [],
        });

        // Restore against a refreshed catalogue: the edit survives, the untouched price refreshes.
        const refreshed = {
            panels: [
                { model: 'A', price: 80, priceCheckedAt: '2026-09-20' },
                { model: 'B', price: 110, priceCheckedAt: '2026-09-20' },
            ],
            chargers: bundled.chargers,
        };
        const { out, setters } = captureSetters();
        applyBackupData(JSON.parse(JSON.stringify(payload)), setters, refreshed);
        expect(out.panels.map((p) => [p.model, p.price])).toEqual([
            ['A', 95],
            ['B', 110],
            ['MINE', 10],
        ]);
    });

    it('legacy backups drop stale prices and say so', () => {
        const { out, setters } = captureSetters();
        const { warnings } = applyBackupData(
            { panelsData: [{ model: 'A', price: 150, priceCheckedAt: '2026-01-01' }, bundled.panels[1]] },
            setters,
            bundled
        );
        expect(out.panels[0].price).toBe(100);
        expect(warnings.join(' ')).toMatch(/1 saved price or note value was replaced/);
    });

    it('sanitises URLs inside v5 overrides and custom items', () => {
        const { out, setters } = captureSetters();
        applyBackupData(
            {
                catalogueOverrides: {
                    panels: {
                        overrides: { A: { datasheetUrl: 'javascript:alert(1)' } },
                        custom: [{ model: 'X', buyLinks: [{ Supplier: 'Bad', URL: 'javascript:evil()' }] }],
                        removed: [],
                    },
                },
            },
            setters,
            bundled
        );
        expect(out.panels.find((p) => p.model === 'A').datasheetUrl).toBe('');
        expect(out.panels.find((p) => p.model === 'X').buyLinks).toEqual([]);
    });

    it('throws when root is not an object', () => {
        const setters = {
            setAreasData: () => {},
            setArraysData: () => {},
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
        expect(() => applyBackupData([], setters)).toThrow(/JSON object/);
    });

    it('applies empty userNotes when key is present', () => {
        let notes = 'unset';
        const setters = {
            setAreasData: () => {},
            setArraysData: () => {},
            setPanelsData: () => {},
            setChargersData: () => {},
            setSiteControllers: () => {},
            setAreaSettingsByArea: () => {},
            setSystemVoltage: () => {},
            setHiddenChargerMfr: () => {},
            setHideHeavyPanels: () => {},
            setHideMarginalPanels: () => {},
            setUserNotes: (v) => {
                notes = v;
            },
        };
        applyBackupData({ userNotes: {} }, setters);
        expect(notes).toEqual({});
    });
});
