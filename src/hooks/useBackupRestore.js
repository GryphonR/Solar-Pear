import { useAppState } from '../context/AppStateContext';
import { validateBackupPayload } from '../lib/backupValidation';
import { initialPanels, initialChargers } from '../data/loadData.js';
import {
    CATALOGUE_ID_KEY,
    applyCatalogue,
    buildCatalogueOverrides,
    migrateLegacyCatalogue,
} from '../lib/catalogueOverrides';

/**
 * Backup file schema version for export/import.
 * v5: the catalogue is exported as `catalogueOverrides` (user edits only) instead of full
 * `panelsData` / `chargersData` arrays, so restoring an old backup cannot pin stale prices.
 */
export const BACKUP_SCHEMA_VERSION = 5;

/**
 * Builds the backup payload object (for export). Pure function for testability.
 * @param {object} state - App state slice used for backup
 */
export function buildBackupPayload(state, bundled = { panels: initialPanels, chargers: initialChargers }) {
    return {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        areasData: state.areasData,
        arraysData: state.arraysData,
        catalogueOverrides: buildCatalogueOverrides(
            state.panelsData,
            state.chargersData,
            bundled.panels,
            bundled.chargers
        ),
        siteControllers: state.siteControllers,
        areaSettingsByArea: state.areaSettingsByArea,
        systemVoltage: state.systemVoltage,
        hiddenChargerMfr: state.hiddenChargerMfr,
        hideHeavyPanels: state.hideHeavyPanels,
        hideMarginalPanels: state.hideMarginalPanels,
        userNotes: state.userNotes,
    };
}

/**
 * Applies imported backup data to setters. Uses !== undefined so falsy values (0, false, null) are restored.
 * Does not call setNotification; caller handles success/error.
 * @param {object} imported - Parsed backup JSON (already validated/sanitized)
 * @param {object} setters - Map of setter functions
 * @param {{ panels: object[], chargers: object[] }} [bundled] - Catalogue shipped with this build
 * @returns {{ warnings: string[] }}
 */
export function applyBackupData(imported, setters, bundled = { panels: initialPanels, chargers: initialChargers }) {
    const {
        setAreasData,
        setArraysData,
        setPanelsData,
        setChargersData,
        setSiteControllers,
        setAreaSettingsByArea,
        setSystemVoltage,
        setHiddenChargerMfr,
        setHideHeavyPanels,
        setHideMarginalPanels,
        setUserNotes,
    } = setters;

    const validated = validateBackupPayload(imported);
    if (!validated.ok) {
        throw new Error(validated.error);
    }
    const data = validated.data;
    const warnings = validated.warnings || [];

    if (data.areasData) setAreasData(data.areasData);
    if (data.arraysData) {
        const legacySelections = data.selections;
        const arraysMerged =
            legacySelections && typeof legacySelections === 'object'
                ? data.arraysData.map((a) => {
                      const legacySel = legacySelections?.[a.id] || {};
                      return {
                          ...a,
                          ...legacySel,
                          // Ensure new selection fields always exist after merge.
                          panel: legacySel.panel ?? a.panel ?? '',
                          controllerInstanceId:
                              legacySel.controllerInstanceId ?? a.controllerInstanceId ?? '',
                          controllerMppt:
                              legacySel.controllerMppt !== undefined && Number.isFinite(Number(legacySel.controllerMppt))
                                  ? Number(legacySel.controllerMppt)
                                  : a.controllerMppt !== undefined && Number.isFinite(Number(a.controllerMppt))
                                    ? Number(a.controllerMppt)
                                    : 1,
                          controller: legacySel.controller ?? a.controller ?? '',
                      };
                  })
                : data.arraysData;
        setArraysData(arraysMerged);
    }
    if (data.catalogueOverrides) {
        setPanelsData(applyCatalogue(bundled.panels, data.catalogueOverrides.panels, CATALOGUE_ID_KEY.panels));
        setChargersData(
            applyCatalogue(bundled.chargers, data.catalogueOverrides.chargers, CATALOGUE_ID_KEY.chargers)
        );
    } else {
        // Backups up to v4 hold full catalogue snapshots; keep only genuine user edits.
        let droppedEdits = 0;
        if (data.panelsData) {
            const m = migrateLegacyCatalogue(data.panelsData, bundled.panels, 'panels');
            droppedEdits += m.droppedEdits;
            setPanelsData(applyCatalogue(bundled.panels, m.diff, CATALOGUE_ID_KEY.panels));
        }
        if (data.chargersData) {
            const m = migrateLegacyCatalogue(data.chargersData, bundled.chargers, 'chargers');
            droppedEdits += m.droppedEdits;
            setChargersData(applyCatalogue(bundled.chargers, m.diff, CATALOGUE_ID_KEY.chargers));
        }
        if (droppedEdits > 0) {
            warnings.push(
                `This backup is from an older version: ${droppedEdits} saved price or note ${
                    droppedEdits === 1 ? 'value was' : 'values were'
                } replaced with current catalogue data.`
            );
        }
    }
    if (data.siteControllers) setSiteControllers(data.siteControllers);
    if (data.areaSettingsByArea !== undefined) {
        setAreaSettingsByArea(data.areaSettingsByArea);
    } else if (data.areasData) {
        const fallbackSettings = {
            systemVoltage: data.systemVoltage !== undefined ? data.systemVoltage : null,
            systemType: data.systemType || 'any',
            filterEps: !!data.filterEps,
            filterHouseBackup: !!data.filterHouseBackup,
        };
        const generated = data.areasData.reduce((acc, area) => {
            acc[area] = { ...fallbackSettings };
            return acc;
        }, {});
        setAreaSettingsByArea(generated);
    }
    if (data.systemVoltage !== undefined) setSystemVoltage(data.systemVoltage);
    if (data.hiddenChargerMfr !== undefined) setHiddenChargerMfr(data.hiddenChargerMfr);
    if (data.hideHeavyPanels !== undefined) setHideHeavyPanels(data.hideHeavyPanels);
    if (data.hideMarginalPanels !== undefined) setHideMarginalPanels(data.hideMarginalPanels);
    // Apply even empty notes object (use !== undefined, not truthiness)
    if (data.userNotes !== undefined) setUserNotes(data.userNotes);

    return { warnings };
}

/**
 * Provides backup download, upload (restore), and reset handlers using app state.
 * @returns {{ handleDownload: () => void, handleUploadClick: (e: Event) => void, handleResetClick: () => void }}
 */
export function useBackupRestore() {
    const {
        areasData,
        arraysData,
        panelsData,
        chargersData,
        siteControllers,
        areaSettingsByArea,
        systemVoltage,
        hiddenChargerMfr,
        hideHeavyPanels,
        hideMarginalPanels,
        userNotes,
        setAreasData,
        setArraysData,
        setPanelsData,
        setChargersData,
        setSiteControllers,
        setAreaSettingsByArea,
        setSystemVoltage,
        setHiddenChargerMfr,
        setHideHeavyPanels,
        setHideMarginalPanels,
        setUserNotes,
        setNotification,
        openConfirm,
        performReset,
    } = useAppState();

    const handleDownload = () => {
        const exportData = buildBackupPayload({
            areasData,
            arraysData,
            panelsData,
            chargersData,
            siteControllers,
            areaSettingsByArea,
            systemVoltage,
            hiddenChargerMfr,
            hideHeavyPanels,
            hideMarginalPanels,
            userNotes,
        });
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `solar_pear_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleUploadClick = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        openConfirm(
            'Upload Backup File',
            'This will completely overwrite your CURRENT configuration with the loaded file. Do you wish to proceed?',
            () => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const imported = JSON.parse(event.target.result);
                        const version = imported.schemaVersion;
                        if (
                            typeof version === 'number' &&
                            version > BACKUP_SCHEMA_VERSION
                        ) {
                            setNotification(
                                `This backup was created with a newer schema (version ${version}). Some data may not load correctly. Consider updating the app.`,
                                'warning'
                            );
                        }
                        const { warnings } = applyBackupData(imported, {
                            setAreasData,
                            setArraysData,
                            setPanelsData,
                            setChargersData,
                            setSiteControllers,
                            setAreaSettingsByArea,
                            setSystemVoltage,
                            setHiddenChargerMfr,
                            setHideHeavyPanels,
                            setHideMarginalPanels,
                            setUserNotes,
                        });
                        if (warnings.length > 0) {
                            setNotification(
                                `Backup loaded with warnings: ${warnings.join(' ')}`,
                                'warning'
                            );
                        } else {
                            setNotification(
                                'Backup loaded successfully! You may need to refresh the page to see all changes.',
                                'success'
                            );
                        }
                    } catch (err) {
                        setNotification(
                            err?.message || 'Failed to parse or validate the backup JSON file.',
                            'error'
                        );
                    }
                };
                reader.readAsText(file);
            }
        );
        e.target.value = '';
    };

    const handleResetClick = () => {
        openConfirm(
            'Reset Application',
            'Are you sure you want to completely reset the application? All custom panels, PV controllers, arrays, and selections will be permanently lost.',
            performReset
        );
    };

    return { handleDownload, handleUploadClick, handleResetClick };
}
