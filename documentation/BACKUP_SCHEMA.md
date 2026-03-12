# Backup file schema (export/import)

The app can export and import a JSON backup of all persisted configuration. This document describes the backup file format and versioning.

---

## Schema version

- **Current version:** `1`
- Backup files include a top-level `schemaVersion` field (number). The app exports with `schemaVersion: 1`.
- On import, if the file’s `schemaVersion` is greater than the version the app supports, the app may show a warning; import still proceeds and known fields are applied.

---

## Top-level fields (version 1)


| Field                | Type          | Description                                                                                         |
| -------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| `schemaVersion`      | number        | Backup schema version (e.g. `1`).                                                                   |
| `areasData`          | string[]      | List of area names (e.g. `["House"]`).                                                              |
| `arraysData`         | array         | Roof array configs. See [Arrays](#arrays).                                                          |
| `panelsData`         | array         | Solar panels (same shape as the app’s built-in panel objects in `src/data/panels/*.json`, plus user overrides). |
| `chargersData`       | array         | PV controllers (same shape as the app’s built-in controller objects in `src/data/controllers/*.json`, plus user overrides). |
| `selections`         | object        | Per-array selections. Key = array id, value = `{ panel?, controllerInstanceId?, controllerMppt? }`. |
| `systemVoltage`      | number        | System voltage (e.g. 48).                                                                           |
| `hiddenChargerMfr`   | string | null | Optional hidden charger manufacturer.                                                               |
| `hideHeavyPanels`    | boolean       | Filter flag.                                                                                        |
| `hideMarginalPanels` | boolean       | Filter flag.                                                                                        |
| `userNotes`          | object        | Keyed by entity id (e.g. panel `model`, charger `id`) → note string.                                |


---

## Arrays

Each item in `arraysData` has:

- `id` (string), `name`, `area`, `orientation`, `count` (number), `format`, `mounting`
- Optional: `maxPanelHeight`, `maxPanelWidth` (strings)

---

## Notes

- The backup contains the same logical state as the app’s localStorage keys (see `LOCAL_STORAGE_KEYS.md`). Export is a single JSON snapshot; import overwrites current in-memory and persisted state for the listed keys.
- User notes use the key `user_notes` in the app; the backup field is `userNotes` (camelCase) in JSON.
- Legacy backups without `schemaVersion` are treated as version 1; all current fields are optional on import (missing fields leave existing state unchanged).

