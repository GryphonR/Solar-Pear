# LocalStorage keys – what gets stored and how

Most settings are persisted by the `useLocalStorage` hook (read on mount, written on every set). Two things are different:

- **The catalogue** (panels and controllers) lives in React state and is **not** stored in full. A save effect in `AppStateContext` stores only the user's edits in `solar_catalogue_overrides` (see `src/lib/catalogueOverrides.js`). Refreshed catalogue data, such as new prices, therefore reaches returning users unless they edited that field themselves.
- **A one-time load effect** runs on mount. It migrates arrays, selections and site controllers, loads the catalogue (migrating legacy keys if present), and moves designs off discontinued products (`src/data/replacements.json`).

If a write fails (storage full or blocked), `useLocalStorage` and the catalogue save effect dispatch a `solar-storage-error` window event. The app then shows a one-off notice asking the user to download a backup.

---

## Storage versions

| `solar_storage_version` | Layout |
| ----------------------- | ------ |
| missing (v1) | Full catalogue arrays in `solar_panels` / `solar_chargers` |
| `2` | Catalogue stored as overrides in `solar_catalogue_overrides`. Legacy keys are migrated once, then removed |

### v1 → v2 catalogue migration
The legacy arrays can't tell a user's price edit from a price that was stale when saved. A saved price that differs from the bundle is kept only when the bundled record still has the same `priceCheckedAt` as the snapshot, which means the difference must be a user edit. Otherwise the current price wins. Legacy `active` and `gseCompatibility` edits and custom items are always kept. Legacy controller `notes` differences are dropped (personal notes live in `user_notes`). The user sees a notice with the number of replaced values.

---

## Keys

| Key | Shape | Written by | Migrated on load? |
| --- | ----- | ---------- | ----------------- |
| `solar_arrays` | Array of arrays `{ id, name, area, orientation, count, parallelStrings, format, mounting, maxPanelHeight, maxPanelWidth, maxPanelWeight, panel, controllerInstanceId, controllerMppt, controller, planner }` | hook | Yes (`migrateArrays`, `applyReplacements`) |
| `solar_catalogue_overrides` | `{ panels: Diff, chargers: Diff }`, where `Diff = { overrides: { [id]: { field: value } }, custom: item[], removed: id[] }` | catalogue save effect | Created from legacy keys once |
| `solar_storage_version` | `"2"` | catalogue save effect | – |
| `solar_site_controllers` | `[{ id, modelId, area, name }]` | hook | Yes (`migrateSelectionsAndSiteControllers`, `applyReplacements`) |
| `solar_area_settings` | `{ [area]: { systemVoltage, systemType, filterEps, filterHouseBackup, designLowC, designHighC, strictCurrent } }` | hook | Sanitised with defaults |
| `solar_areas` | `string[]` | hook | No |
| `user_notes` | `{ [panel.model \| charger.id \| array_<id>]: string }` | hook | No |
| `solar_hide_heavy_panels`, `solar_hide_marginal_panels`, `solar_hide_incompatible_panels`, `solar_hide_incompatible_controllers` | boolean | hook | No |
| `solar_system_voltage`, `solar_system_type`, `solar_filter_eps`, `solar_filter_house_backup` | legacy global settings, used as the fallback for area settings | hook | No |
| `solar_active_array_content_tab` | `{ [arrayId]: tab }` | hook | No |

### Legacy keys (read once, never written)
- `solar_panels` / `solar_chargers`: full catalogue arrays (storage v1). Migrated to `solar_catalogue_overrides`, then removed.
- `solar_selections`: per-array selections from before selections moved into `solar_arrays`.

---

## Reset

`APP_STORAGE_KEYS` in `AppStateContext.jsx` lists every key the app writes. Reset (`performReset`) removes those keys and the legacy keys above, then sets state to defaults.
