# LocalStorage keys – what gets stored and how

Persistence is **hooks-only**: every key is read and written by `useLocalStorage`. A **one-time migration effect** runs on mount and overwrites state for keys that need migration/merge (arrays, selections, siteControllers, chargers, panels). No save effect; no legacy keys.

---

## Keys (all use useLocalStorage)

### `solar_arrays`
- **Stored:** Array of roof array configs. Each item: `{ id, name, area, orientation, count, format, mounting, maxPanelHeight, maxPanelWidth }`.
- **Read/written by:** `useLocalStorage('solar_arrays', initialArrays)`. One-time effect overwrites with `migrateArrays(savedArrays, initialArrays)`.

### `solar_panels`
- **Stored:** Full list of panels (same shape as `panels.json` plus user `price`, `active`, `notes`). Merged with defaults in migration via `mergePanels`.
- **Read/written by:** `useLocalStorage('solar_panels', initialPanels)`. One-time effect overwrites with `mergePanels(initialPanels, savedPanels)` when key exists.

### `solar_chargers`
- **Stored:** Full list of PV controllers (same shape as `chargers.json` plus user `price`, `notes`, `active`).
- **Read/written by:** `useLocalStorage('solar_chargers', initialChargers)`. One-time effect overwrites with `mergeChargers(initialChargers, { savedChargersJson })`.

### `solar_site_controllers`
- **Stored:** Array of controller instances: `{ id, modelId, area, name }`.
- **Read/written by:** `useLocalStorage('solar_site_controllers', [])`. One-time effect overwrites with migrated result from `migrateSelectionsAndSiteControllers`.

### `solar_selections`
- **Stored:** Object keyed by array id. Value: `{ panel, controllerInstanceId?, controllerMppt? }` or legacy `{ panel, controller }`. Example: `{ "A1": { panel: "TSM-430NEG9R.28", controllerInstanceId: "inst_...", controllerMppt: 1 } }`.
- **Read/written by:** `useLocalStorage('solar_selections', initialSelections)`. One-time effect overwrites with migrated selections.

### `user_notes`
- **Stored:** Object keyed by entity id: `panel.model`, `charger.id`, `array_${array.id}` → note string.
- **Read/written by:** `useLocalStorage('user_notes', {})` only. No migration effect.

### `solar_hide_heavy_panels` / `solar_hide_marginal_panels`
- **Stored:** Booleans.
- **Read/written by:** Hook only.

### `solar_system_voltage` / `solar_system_type`
- **Stored:** Number (e.g. 48); string (`'dc-charger'` | `'grid-connected'` | `'off-grid-ac'`).
- **Read/written by:** Hook only.

### `solar_filter_eps` / `solar_filter_house_backup`
- **Stored:** Booleans.
- **Read/written by:** Hook only.

### `solar_areas`
- **Stored:** Array of area names, e.g. `["House"]`.
- **Read/written by:** Hook only.

---

## Summary table

| Key                       | Shape               | useLocalStorage | One-time migration overwrites? |
|---------------------------|---------------------|-----------------|---------------------------------|
| solar_arrays              | Array of arrays     | Yes             | Yes (migrateArrays)             |
| solar_panels              | Full panel list     | Yes             | Yes (mergePanels)              |
| solar_chargers            | Full charger list   | Yes             | Yes (mergeChargers)            |
| solar_site_controllers    | Instance list       | Yes             | Yes (migrateSelections...)     |
| solar_selections          | Per-array selections| Yes             | Yes (migrateSelections...)     |
| user_notes                | { [id]: string }    | Yes             | No                             |
| solar_hide_heavy_panels   | boolean             | Yes             | No                             |
| solar_hide_marginal_panels| boolean             | Yes             | No                             |
| solar_system_voltage      | number              | Yes             | No                             |
| solar_system_type         | string              | Yes             | No                             |
| solar_filter_eps          | boolean             | Yes             | No                             |
| solar_filter_house_backup | boolean             | Yes             | No                             |
| solar_areas               | string[]            | Yes             | No                             |

---

## What “one source of truth”, “only save effect”, and “only hooks” mean

### “Only hooks” (useLocalStorage for everything)

- **Idea:** Every piece of state that should survive refresh is backed by `useLocalStorage(key, initial)`. There is no separate load/save effect for that state.
- **Flow:** On mount, the hook reads from localStorage once. When you call the setter, the hook updates React state and immediately writes the new value to localStorage. No other code reads or writes that key.
- **Pros:** Simple mental model (one place reads, one place writes). No duplicate writes. Easy to see which state is persisted (it uses the hook).
- **Cons:** You can’t do a “load once, migrate, then use” pattern inside the hook without extra logic. Migration has to live elsewhere (e.g. a one-time effect that reads raw localStorage, migrates, then calls the hook’s setter).

### “Only save effect” (one load effect, one save effect)

- **Idea:** All persisted state lives in `useState`. A single **load effect** (runs once on mount) reads every key from localStorage, optionally migrates/merges, and calls the setters. A single **save effect** (runs when that state changes) writes every key to localStorage. No `useLocalStorage` for that state.
- **Flow:** First render uses initial state. After mount, the load effect runs and overwrites state from localStorage. Later, any state change triggers the save effect, which writes all listed keys. So “source of truth” is React state; localStorage is a mirror that’s updated in one place (the save effect).
- **Pros:** One place that defines *what* is persisted (the dependency array and the list of `setItem` calls). Migration and merging can live in the load effect. No duplicate writes.
- **Cons:** You must keep the list of keys and the dependency array in sync. If you add new state and forget to add it to both load and save, it won’t persist.

### “One source of truth”

- **Idea:** The app picks **one** of the above strategies and uses it for **all** persisted state. “One source of truth” here means: one consistent rule for *how* we persist (either “hooks only” or “effects only”), not two different patterns mixed together.
- **In practice:** Either (a) move everything to `useLocalStorage` (and do migration in a one-time effect that writes into that state), or (b) move everything to `useState` + one load effect + one save effect. Then there’s a single place to look to understand “what gets saved and when”.

Right now the app mixes both: some keys are hook-only, some are effect-only, and some are written by both (redundant). Unifying to one approach would remove that mix and make the table above uniform.

---

## Reset

`APP_STORAGE_KEYS` lists every key the app uses. Reset (performReset) removes only these keys and then sets state to defaults. Legacy keys (`solar_mppts`, `solar_inverters`, `victron_user_notes`) are no longer used or cleared.
