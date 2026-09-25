# Backup file schema (export/import)

The Download button exports a JSON backup of the user's design and settings. Upload restores it. The code is in `src/hooks/useBackupRestore.js` (build/apply) and `src/lib/backupValidation.js` (validation and URL sanitising).

---

## Schema version

- **Current version:** `5` (`BACKUP_SCHEMA_VERSION`).
- Every export includes a top-level `schemaVersion`. Older backups, including files without a version, are still accepted; all fields are optional on import, and missing fields leave current state unchanged.

| Version | Change |
| ------- | ------ |
| ≤ 4 | Catalogue exported as full `panelsData` / `chargersData` arrays |
| 5 | Catalogue exported as `catalogueOverrides` (user edits only), so restoring a backup never pins stale catalogue prices |

---

## Top-level fields (version 5)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `schemaVersion` | number | `5` |
| `areasData` | string[] | Area names, e.g. `["House"]` |
| `arraysData` | array | Arrays including their selections (`panel`, `controllerInstanceId`, `controllerMppt`) |
| `catalogueOverrides` | object | `{ panels: Diff, chargers: Diff }`. See below |
| `siteControllers` | array | Controller instances `{ id, modelId, area, name }` |
| `areaSettingsByArea` | object | Per-area settings, including `designLowC`, `designHighC` and `strictCurrent` |
| `systemVoltage` | number \| null | Legacy global battery voltage |
| `hiddenChargerMfr` | string \| null | Optional hidden charger manufacturer |
| `hideHeavyPanels`, `hideMarginalPanels` | boolean | Filter flags |
| `userNotes` | object | Keyed by panel `model`, controller `id` or `array_<id>` |

### `catalogueOverrides`
`Diff = { overrides: { [id]: { field: value } }, custom: item[], removed: id[] }`, with ids being panel `model` or controller `id`.

On import, the diff is applied over the catalogue bundled with the running app. Overrides for items no longer in the catalogue are ignored. Custom items whose id now matches a bundled item give way to the bundled record. URLs in overrides and custom items (`datasheetUrl`, `buyLinks`) are sanitised to http(s) only.

### Legacy `panelsData` / `chargersData` (≤ v4)
These are treated as snapshots and converted with the same rule as the localStorage v1 → v2 migration (see `LOCAL_STORAGE_KEYS.md`): only genuine user edits are kept, and the import reports how many stale values were replaced. A legacy top-level `selections` object is merged into `arraysData`.
