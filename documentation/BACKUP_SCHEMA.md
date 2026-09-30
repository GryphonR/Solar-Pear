# Backup file schema (export/import)

The Download button exports a JSON backup of the user's design and settings. Upload restores it. The code is in `src/hooks/useBackupRestore.js` (build/apply) and `src/lib/backupValidation.js` (validation and URL sanitising).

---

## Schema version

- **Current version:** `6` (`BACKUP_SCHEMA_VERSION`).
- Every export includes a top-level `schemaVersion`. Older backups, including files without a version, are still accepted; all fields are optional on import, and missing fields leave current state unchanged.

| Version | Change |
| ------- | ------ |
| ≤ 4 | Catalogue exported as full `panelsData` / `chargersData` arrays |
| 5 | Catalogue exported as `catalogueOverrides` (user edits only), so restoring a backup never pins stale catalogue prices |
| 6 | The design is exported as `projects` (all of them, plus `activeProjectId`), each with its systems, arrays and controller instances, replacing the flat `areasData` / `arraysData` / `siteControllers` / `areaSettingsByArea` |

---

## Top-level fields (version 6)

Unchanged by the switch to the new UI (roadmap 13.9): the feature flag and the old controller-table filter were never exported.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `schemaVersion` | number | `6` |
| `projects` | array | Every project: `{ id, name, kind, createdAt, updatedAt, systems: [{ id, name, settings }], arrays, siteControllers }`. Arrays and controller instances point at a system by `systemId`; arrays carry their selections (`panel`, `controllerInstanceId`, `controllerMppt`). See below |
| `activeProjectId` | string | The project to open after restore; the first project if it is missing or unknown |
| `catalogueOverrides` | object | `{ panels: Diff, chargers: Diff }`. See below |
| `systemVoltage` | number \| null | Legacy global battery voltage |
| `hiddenChargerMfr` | string \| null | Optional hidden charger manufacturer |
| `hideHeavyPanels`, `hideMarginalPanels` | boolean | Filter flags |
| `userNotes` | object | Keyed by panel `model`, controller `id` or `array_<id>` |

### `projects`
Restoring a v6 backup replaces **all** projects with the ones in the file. Each project is validated (`sanitizeProject`): projects without an id or without any usable system are dropped with a warning, entries without an id are removed, and an array or controller pointing at an unknown system moves to the project's first system. A file with no usable project is rejected. Ids are kept as exported, so a backup restored on another device keeps the same project, system and array ids.

### Older backups (v5 and earlier)
They carry the flat `areasData` / `arraysData` / `siteControllers` / `areaSettingsByArea` fields. These are applied to the **active project only** (its name and id stay; its systems, arrays and controllers are replaced), which matches what "overwrite my current design" meant before projects existed. New system ids are created for the areas.

### `catalogueOverrides`
`Diff = { overrides: { [id]: { field: value } }, custom: item[], removed: id[] }`, with ids being panel `model` or controller `id`.

On import, the diff is applied over the catalogue bundled with the running app. Overrides for items no longer in the catalogue are ignored. Custom items whose id now matches a bundled item give way to the bundled record. URLs in overrides and custom items (`datasheetUrl`, `buyLinks`) are sanitised to http(s) only.

### Legacy `panelsData` / `chargersData` (≤ v4)
These are treated as snapshots and converted with the same rule as the localStorage v1 → v2 migration (see `LOCAL_STORAGE_KEYS.md`): only genuine user edits are kept, and the import reports how many stale values were replaced. A legacy top-level `selections` object is merged into `arraysData`.
