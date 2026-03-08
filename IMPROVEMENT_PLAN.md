# Solar Selector – Critical Analysis & Improvement Plan

## Executive Summary

**Solar Pear** is a React (Vite + Tailwind) app for selecting solar panels and PV controllers against roof arrays, with compatibility checks (Voc, Vmp, Isc, format). The feature set is strong and domain logic is thoughtful, but the codebase suffers from a **single 2,700+ line `App.jsx`**, **inconsistent persistence**, **missing tests**, and **several correctness bugs**. This document summarizes the critical analysis and a phased plan to improve maintainability, reliability, and UX.

---

## 1. Critical Issues (Fix First)

### 1.1 Panels data not persisted to localStorage

- **Issue:** `panelsData` is held in plain `useState(initialPanels)`. The save `useEffect` (lines 307–318) only persists `arraysData`, `siteControllers`, `selections`, `userNotes`, and a few flags. It **never** writes `panelsData` (or `siteControllers` is there; `panelsData` is not). 
- **Impact:** Custom panels and edits (price, active, notes, etc.) are **lost on refresh** unless the user has restored from a backup.
- **Fix:** Persist panels the same way as chargers: either use `useLocalStorage('solar_panels', initialPanels)` for `panelsData`, or add `panelsData` (and ensure migration still runs) to the existing save effect. Prefer a single strategy (e.g. all DB-like state via one persistence layer).

### 1.2 Default selections reference non-existent panel IDs

- **Issue:** `initialSelections` uses panel IDs like `'trina430'`, while `panels.json` (and thus `panelsData`) uses `model` values like `'TSM-430NEG9R.28'`. So `getArrayAnalysis` does `panelsData.find(p => p.model === sel.panel)` and finds nothing for a fresh load with no localStorage.
- **Impact:** New users (or after a full reset) see “Please select both a Solar Panel and a PV Controller” for every array until they manually select; defaults do not match the shipped panel data.
- **Fix:** Either (a) change `initialSelections` to use `model` values that exist in `panels.json`, or (b) add a small mapping layer (e.g. `trina430` → `TSM-430NEG9R.28`) and use it when reading selections. Prefer (a) for a single source of truth.

### 1.3 `hiddenChargerMfr` referenced but not defined

- **Issue:** `handleDownload` exports `hiddenChargerMfr` and the upload handler calls `setHiddenChargerMfr(imported.hiddenChargerMfr)`, but there is no `useState` for `hiddenChargerMfr` in the component.
- **Impact:** Runtime error when importing a backup that contains `hiddenChargerMfr`; export may include `undefined`.
- **Fix:** Either add `const [hiddenChargerMfr, setHiddenChargerMfr] = useState(...)` and wire it into the UI, or remove `hiddenChargerMfr` from export/import and any UI that was intended to use it.

### 1.4 Inconsistent user notes key on import

- **Issue:** On backup import, user notes are written to `localStorage.setItem('victron_user_notes', ...)` (line 2546), while the rest of the app uses `'user_notes'` (load effect and save effect).
- **Impact:** Restored notes may not appear after refresh, or may live in a different key than the app expects.
- **Fix:** Use a single key everywhere, e.g. `'user_notes'`, for both save and load (and in the load-from-backup path).

### 1.5 Reset does not use app confirm modal and may leave keys behind

- **Issue:** `resetToDefaults()` uses the browser `confirm()` and does not use the app’s `confirmModal`. It also does not clear all app-related localStorage keys (e.g. `solar_chargers`, `solar_panels`, `solar_system_voltage`, `solar_filter_eps`, `solar_areas`, `solar_filter_house_backup`, `user_notes` / `victron_user_notes`).
- **Impact:** Inconsistent UX and “reset” that isn’t full; leftover keys can confuse migration or future logic.
- **Fix:** Use `openConfirm('Reset Application', ...)` (or the same pattern as “Reset” in the sidebar) and inside the action call `localStorage.clear()` (or explicitly remove every key with the `solar_` and notes prefix), then reload or reset state so the app is in a known default state.

---

## 2. Architecture & Maintainability

### 2.1 Monolithic App.jsx (~2,720 lines)

- **Issue:** One file contains: `BuyButton`, `useLocalStorage`, default data constants, entire `App` with 25+ state variables, six modal renderers, array/panel/charger DB views, summary, migration, import/export, and sidebar. This is hard to navigate, test, and change safely.
- **Recommendation:** Split in phases:
  - **Phase A – Extract hooks and pure logic:** Move `useLocalStorage` to e.g. `src/hooks/useLocalStorage.js`. Move `getArrayAnalysis`, `isCompatibleFormat`, and any other pure functions to e.g. `src/lib/arrayAnalysis.js` or `src/utils/compatibility.js`. Move migration logic to a single module (e.g. `src/lib/migration.js`) and call it once on load.
  - **Phase B – Extract modals:** One reusable `Modal` (backdrop, header, body, footer, close) and then `AddPanelModal`, `AddChargerModal`, `AddAreaModal`, `AddArrayModal`, `PanelInfoModal`, `ChargerInfoModal`, `ConfirmModal` as presentational/container components that receive props and callbacks.
  - **Phase C – Extract views:** Move `renderSummary`, `renderArraysDb`, `renderPanelsDb`, `renderChargersDb`, and `renderArrayTab` into components (e.g. `SummaryView`, `ArraysDbView`, `PanelsDbView`, `ChargersDbView`, `ArraySelectorView`). Pass down only the state and handlers they need.
  - **Phase D – State:** Consider a small context or a reducer for “app state” (tabs, arrays, panels, chargers, selections, filters) so that view components don’t all depend on a giant list of props from `App`. Alternatively, keep state in `App` but pass it via a few grouped props or a single “app state + actions” object.

### 2.2 Duplicated modal and form patterns

- **Issue:** Each modal repeats the same structure: fixed overlay, rounded card, header with title + X, scrollable body, footer with Cancel + primary button. Forms repeat the same label/input/className patterns.
- **Recommendation:** Introduce a shared `Modal` component and, if desired, small presentational components (e.g. `FormField`, `FormSection`) to reduce duplication and keep styling consistent.

### 2.3 Stale / misleading `extract.js`

- **Issue:** Script uses an old schema (`id`, `format` for panels) and writes to `mppts.json`. The app uses `panels.json` (with `model`, `gseCompatibility`) and `chargers.json`. Running the script could overwrite or create files that don’t match the app.
- **Recommendation:** Either remove `extract.js` or update it to output the same shape as `panels.json` / `chargers.json` and document that it’s for one-off data generation, not the source of truth for the app’s defaults.

---

## 3. Data & Persistence

### 3.1 Single source of truth for persistence

- **Issue:** Some state uses `useLocalStorage` (arrays, chargers, selections, filters, areas), while panels and user notes are loaded in a one-time `useEffect` and then either not persisted (panels) or persisted in a separate effect (user notes). Migration runs only on first load and rewrites state from raw localStorage.
- **Recommendation:** Decide on one approach: (1) everything that should survive refresh uses a single `useLocalStorage`-style hook and migration runs inside that hook or once at app init, or (2) one “load once from localStorage” and one “save when dirty” effect that explicitly lists every key. Avoid mixing “sync on every change” with “load once and never write” for the same data (e.g. panels).

### 3.2 Backup export/import contract

- **Issue:** Export includes `hiddenChargerMfr` (and possibly other undefined or legacy fields). Import uses `victron_user_notes`. Version or schema is not checked.
- **Recommendation:** Add a minimal `version` or `schemaVersion` field to the backup JSON. On import, branch by version and handle old backups (e.g. map old keys to new, or show “Unsupported backup version”). Use one consistent key for user notes in both export and import, and only export/import state that actually exists in the app.

---

## 4. Testing & Quality

### 4.1 No automated tests

- **Issue:** No test files found. Regression risk is high when refactoring or fixing bugs.
- **Recommendation:** Add a test runner (e.g. Vitest) and start with:
  - **Unit tests** for pure logic: `isCompatibleFormat`, `getArrayAnalysis` (with mocked arrays/panels/controllers), and migration helpers.
  - **Integration-style tests** for backup export/import (export default state, re-import, assert key state matches).
  - Optionally, one or two critical paths with React Testing Library (e.g. “render App, open Summary, expect no crash and key headings present”).

### 4.2 Error handling and loading

- **Issue:** Load effect catches errors and only logs; failed migration leaves app in an unclear state. No explicit “loading” or “error” UI for the initial load.
- **Recommendation:** Have migration return a result type (e.g. `{ ok: true, state } | { ok: false, error }`). On failure, set an error state and show a small “Failed to load saved data” message with an option to “Start fresh” (clear and reload). Optionally show a loading state until first load + migration have finished.

---

## 5. Accessibility & UX

### 5.1 Modals

- **Issue:** No focus trap, no `aria-modal`/`role="dialog"`, no `aria-labelledby`/`aria-describedby`. Escape key to close is not clearly implemented in one place.
- **Recommendation:** Implement focus trap and keyboard close (Escape) in the shared `Modal` component; set `role="dialog"`, `aria-modal="true"`, and appropriate labels.

### 5.2 Icon-only buttons

- **Issue:** Sidebar and table actions use icon-only buttons (e.g. Reset, Download, Upload) with only `title`. Screen reader users may not get a clear label.
- **Recommendation:** Use `aria-label` (and keep `title` for tooltips) for every icon-only button so that the action is announced.

### 5.3 Small copy fix

- **Issue:** In `Guide.jsx`, step 4 says “An Overview of your specified system…” which is grammatically odd (should be “View an overview…” or “The overview…”).
- **Recommendation:** Change to e.g. “View an overview of your specified system and a bill of materials (panels and controllers only).”

---

## 6. Performance & Bundle

### 6.1 Large JSON in bundle

- **Issue:** `panels.json` and `chargers.json` are imported at the top level, so they are always in the main bundle.
- **Recommendation:** Acceptable for now; if the files grow large, consider lazy-loading or loading from a public URL so the initial JS bundle stays smaller.

### 6.2 Re-renders

- **Issue:** With 25+ state variables in one component, any state update re-renders the whole tree. Heavy views (e.g. array selector with many panels/controllers) may re-render often.
- **Recommendation:** After splitting into views and possibly context, wrap heavy list components in `React.memo` and ensure callback props are stable (e.g. from `useCallback` or from a reducer/context) where it matters.

---

## 7. Suggested Implementation Order


| Priority | Item                                                                         | Effort | Impact                      |
| -------- | ---------------------------------------------------------------------------- | ------ | --------------------------- |
| P0       | Fix panels persistence (useLocalStorage or save effect)                      | Small  | High – data loss            |
| P0       | Fix initialSelections to use valid panel `model` values                      | Small  | High – broken defaults      |
| P0       | Fix or remove `hiddenChargerMfr` (define state or remove from export/import) | Small  | High – crash / wrong import |
| P0       | Use `user_notes` consistently on import (remove `victron_user_notes`)        | Tiny   | Medium                      |
| P1       | Unify reset: use confirm modal + clear all app keys                          | Small  | Medium                      |
| P1       | Extract `useLocalStorage` and pure analysis/migration into modules           | Medium | Maintainability             |
| P1       | Add Vitest + tests for compatibility and migration                           | Medium | Safety for refactors        |
| P2       | Extract shared `Modal` and then each modal component                         | Medium | Readability                 |
| P2       | Extract tab views (Summary, Arrays DB, Panels DB, Chargers DB, Array tab)    | Large  | Maintainability             |
| P2       | Modal a11y (focus trap, Escape, ARIA) and icon button `aria-label`           | Small  | Accessibility               |
| P3       | Update or remove `extract.js`; document backup schema/version                | Small  | Consistency                 |
| P3       | Loading/error UI for initial load and migration                              | Small  | UX                          |


---

## 8. Summary

- **Fix first:** Panels not persisted; wrong default panel IDs; `hiddenChargerMfr` undefined; user notes key inconsistency; reset behavior and completeness.
- **Then:** Extract hooks, pure logic, and migration; add tests; split modals and views; unify persistence and backup contract.
- **Then:** Accessibility (modals, labels), small copy/UX fixes, and optional performance tuning.

This order keeps data correct and the codebase stable before larger refactors, and makes future changes safer and easier to reason about.