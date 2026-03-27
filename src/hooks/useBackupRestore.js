import { useAppState } from '../context/AppStateContext';

/** Backup file schema version for export/import. */
export const BACKUP_SCHEMA_VERSION = 4;

/**
 * Builds the backup payload object (for export). Pure function for testability.
 * @param {object} state - App state slice used for backup
 */
export function buildBackupPayload(state) {
    return {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        areasData: state.areasData,
        arraysData: state.arraysData,
        panelsData: state.panelsData,
        chargersData: state.chargersData,
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
 * @param {object} imported - Parsed backup JSON
 * @param {object} setters - Map of setter functions
 */
export function applyBackupData(imported, setters) {
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
    if (imported.areasData) setAreasData(imported.areasData);
    if (imported.arraysData) {
        const legacySelections = imported.selections;
        const arraysMerged =
            legacySelections && typeof legacySelections === 'object'
                ? imported.arraysData.map((a) => {
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
                : imported.arraysData;
        setArraysData(arraysMerged);
    }
    if (imported.panelsData) setPanelsData(imported.panelsData);
    if (imported.chargersData) setChargersData(imported.chargersData);
    if (imported.siteControllers) setSiteControllers(imported.siteControllers);
    if (imported.areaSettingsByArea !== undefined) {
        setAreaSettingsByArea(imported.areaSettingsByArea);
    } else if (imported.areasData) {
        const fallbackSettings = {
            systemVoltage: imported.systemVoltage !== undefined ? imported.systemVoltage : null,
            systemType: imported.systemType || 'any',
            filterEps: !!imported.filterEps,
            filterHouseBackup: !!imported.filterHouseBackup,
        };
        const generated = imported.areasData.reduce((acc, area) => {
            acc[area] = { ...fallbackSettings };
            return acc;
        }, {});
        setAreaSettingsByArea(generated);
    }
    if (imported.systemVoltage !== undefined) setSystemVoltage(imported.systemVoltage);
    if (imported.hiddenChargerMfr !== undefined) setHiddenChargerMfr(imported.hiddenChargerMfr);
    if (imported.hideHeavyPanels !== undefined) setHideHeavyPanels(imported.hideHeavyPanels);
    if (imported.hideMarginalPanels !== undefined) setHideMarginalPanels(imported.hideMarginalPanels);
    if (imported.userNotes) setUserNotes(imported.userNotes);
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
                        applyBackupData(imported, {
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
                        setNotification(
                            'Backup loaded successfully! You may need to refresh the page to see all changes.',
                            'success'
                        );
                    } catch (err) {
                        setNotification('Failed to parse the backup JSON file.', 'error');
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
