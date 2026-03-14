# Implementation Plan: Addressing Codebase Issues

This plan addresses the critical issues from the codebase overview, in an order that minimizes rework and risk.

---

## Phase 0: Quick wins (1–2 hours)

### 0.1 Fix backup restore falsy handling

**Problem:** `if (imported.systemVoltage)` and similar checks skip restoring `0` or `null`.

**Tasks:**

- [x] In `src/App.jsx`, change backup restore to use explicit presence checks:
  - `if (imported.systemVoltage !== undefined) setSystemVoltage(imported.systemVoltage);`
  - Similarly for `hideHeavyPanels`, `hideMarginalPanels`, and any other optional/boolean fields that may be `false`.
- [x] For booleans, prefer `!== undefined` so `false` is restored; for numbers, allow `0` and `null` where valid.
- [ ] Add a simple test (or manual checklist) that a backup with `systemVoltage: 24` and `hideHeavyPanels: false` restores correctly.

**Files:** `src/App.jsx`

---

### 0.2 Resolve duplicate path / Git status noise

**Problem:** Git shows both `src/` and `src\` versions of files (Windows path normalization).

**Tasks:**

- [x] Run `git status` and confirm whether these are duplicates or the same file reported twice.
- [x] If duplicates exist: remove the duplicate files, keep a single canonical path (prefer forward slashes in imports). *(Confirmed: `git status` shows one path per file; no duplicate files in repo.)*
- [x] If it's display only: ensure `.gitattributes` or repo config doesn't create confusion; document in README or CONTRIBUTING that paths are normalized. *(No change needed; Git uses forward slashes.)*
- [x] Add or verify `.gitignore` so build artifacts and IDE files don't add noise. *(`.gitignore` already covers node_modules, dist, logs, editors.)*

**Files:** Repo root, `.gitattributes` (if needed)

---

## Phase 1: Split global state (2–4 hours)

**Goal:** Reduce re-renders and give views clear boundaries by splitting `AppStateContext` into smaller contexts or a single reducer with selectors.

### 1.1 Design the split

**Option A – Multiple contexts (simplest):**

- **DataContext:** `arraysData`, `areasData`, `panelsData`, `chargersData`, `siteControllers`, `selections`, `userNotes`, and their setters + derived helpers (`getArrayAnalysis`, `availableChargers`, etc.).
- **UIContext:** `activeTab`, `setActiveTab`, modal state (`addPanelModal`, `confirmModal`, …), `panelSort`, `controllerSort`, `activeSelectorTabs`, `activeArrayContentTab`, `hiddenChargerMfr`, `notification`, filter toggles (`hideHeavyPanels`, `hideMarginalPanels`, …), `systemVoltage`, `systemType`, `filterEps`, `filterHouseBackup`.

**Option B – Single reducer + selectors:**

- One `AppStateReducer` (or `useReducer`) with clear action types; multiple `useContext` consumers that use selectors (e.g. `useMemo` or a small `useAppSelector(selector)`) so components only re-render when their slice changes. Persistence (localStorage) can run in a `useEffect` that syncs from state to storage.

**Recommended:** Start with **Option A** (two contexts) to avoid a large refactor; you can later move to a reducer if needed.

**Tasks:**

- [ ] Create `src/context/DataContext.jsx`: move arrays, areas, panels, chargers, siteControllers, selections, userNotes, and all setters/updaters that only touch this data. Keep `useLocalStorage` for each key. Expose `getArrayAnalysis` and `availableChargers` (they depend on this data + systemVoltage; systemVoltage can stay in UIContext and be passed in, or you can keep a small "preferences" slice in DataContext for voltage/type).
- [ ] Create `src/context/UIContext.jsx`: active tab, all modal state, sort state, notification, filter toggles, systemVoltage, systemType, filterEps, filterHouseBackup. Persist only the keys that are already in `APP_STORAGE_KEYS`.
- [ ] Keep migration in one place: run it inside the provider that owns the persisted data (e.g. DataContext), and expose `loadStatus` / `startFresh` from there (or from a thin wrapper that composes both providers).
- [ ] Update `AppStateContext.jsx`: either (a) re-export both providers and a combined `useAppState` that returns `{ ...useDataContext(), ...useUIContext() }` for backward compatibility, or (b) replace `useAppState()` usages with `useDataContext()` / `useUIContext()` where each view only subscribes to what it needs.
- [ ] Ensure backup/restore in `App.jsx` still writes/reads the same keys and dispatches to both contexts (or to the combined setter surface).

**Files:** `src/context/DataContext.jsx` (new), `src/context/UIContext.jsx` (new), `src/context/AppStateContext.jsx` (refactor or wrap), `src/App.jsx`, all view files that use `useAppState`.

---

## Phase 2: Break up ArraySelectorView (4–8 hours)

**Goal:** Reduce the ~1,439-line component to a small orchestrator plus focused subcomponents and hooks.

### 2.1 Extract domain hook(s)

- [ ] Add `src/views/arraySelector/useValidPanels.js` (or `useValidPanels.js` in a shared hooks folder if you prefer):
  - Inputs: `arrayId`, and from context: `panelsData`, `arraysData`, `chargersData`, `siteControllers`, `selections`, `systemVoltage`, `hideHeavyPanels`, `hideMarginalPanels`, `hideIncompatiblePanels`, `panelSort`.
  - Move the `validPanels` computation (map + filter + sort) from `ArraySelectorView` into this hook. Return `{ validPanels, togglePanelSort }` (and any other panel-list API the view needs).
- [ ] Optionally add `useValidControllersForArray` (or equivalent) that encapsulates the controller filtering/compatibility logic used in the controller table, and returns the list plus "Add New Instance" behavior if needed.

**Files:** `src/views/arraySelector/useValidPanels.js` (new), `src/views/ArraySelectorView.jsx` (use the hook, remove inlined logic).

### 2.2 Extract presentational components

- [ ] **Panel table:** Create `src/views/arraySelector/PanelTable.jsx`. Props: `validPanels`, `array`, `arrayId`, `selectedPanel`, `onSelectPanel`, sort state + toggle, `onOpenInfo`. Move the panel table markup (and the small "bar" cell logic) here. Use a shared `BarCell` component if you want to avoid inline styles.
- [ ] **Controller table / section:** Create `src/views/arraySelector/ControllerTable.jsx` (or `ControllerSection.jsx`). Props: controllers list, array, arrayId, selection, `onSelectController`, `onAddInstance`, etc. Move the controller table and "Add New Instance" button.
- [ ] **Array params / summary block:** Create `src/views/arraySelector/ArrayParamsSection.jsx` for array name, area, orientation, count, format, mounting, and constraints (max height/width/weight). Use existing `updateArray` from context.
- [ ] **Parallel strings / divisors UI:** Extract to `src/views/arraySelector/ParallelStringsSelect.jsx` (or similar) so the main view only composes it.

**Files:** New files under `src/views/arraySelector/`, `ArraySelectorView.jsx` imports and composes them.

### 2.3 Optional: bar styling component

- [ ] Add `src/components/BarCell.jsx`: takes `value`, `max`, `variant` (e.g. for color), and optionally `formatter`. Renders the bar background and the text. Replace inline `style={{ width: ... }}` usages in panel/controller tables with `<BarCell />`.

**Files:** `src/components/BarCell.jsx`, `PanelTable.jsx`, `ControllerTable.jsx`.

### 2.4 Slim down ArraySelectorView

- [ ] `ArraySelectorView` should: (1) call `useValidPanels(arrayId)` and any controller hook, (2) get `analysis` from `getArrayAnalysis(arrayId)`, (3) render layout (tabs/sections) and compose `ArrayParamsSection`, `PanelTable`, `ControllerTable`, `ArrayOverviewGraphs`, and modals. Target: under ~200–300 lines.

**Files:** `src/views/ArraySelectorView.jsx`.

---

## Phase 3: Simplify App.jsx (1–2 hours)

- [ ] Extract **sidebar** to `src/components/AppSidebar.jsx`: nav items, per-area array list, Summary button, Reset/Backup/Upload. It receives `activeTab`, `setActiveTab`, `arraysData`, `areasData`, `getArrayAnalysis`, and handlers for reset/download/upload.
- [ ] Extract **backup/restore logic** to `src/hooks/useBackupRestore.js` (or `useBackup.js`): returns `handleDownload`, `handleUploadClick`, and optionally `BACKUP_SCHEMA_VERSION`. Uses state and setters from context (or from both Data + UI context). App or sidebar only wires these to buttons and file input.
- [ ] Leave in `App.jsx`: layout shell, both providers (if not already in `main.jsx`), Toast, sidebar, and the main content area that switches on `activeTab`. Reduce `App.jsx` to a thin shell and a small number of `useAppState()` or context calls.

**Files:** `src/components/AppSidebar.jsx`, `src/hooks/useBackupRestore.js`, `src/App.jsx`.

---

## Phase 4: Tests (2–4 hours)

### 4.1 Migration and data

- [ ] Add migration tests for: (1) backup with `systemVoltage: 0` or `null`, (2) selections with legacy `controller` and no `controllerInstanceId` (instance generation), (3) merge of panels/chargers with saved overrides.
- [ ] If you added `useBackupRestore`, add a test that export then import round-trips and restores booleans/numbers (e.g. `hideHeavyPanels: false`, `systemVoltage: 24`).

**Files:** `src/lib/migration.test.js`, optional `src/hooks/useBackupRestore.test.js`.

### 4.2 Context (optional but valuable)

- [ ] If using a reducer: test the reducer with actions for update selection, add array, reset, etc.
- [ ] If staying with contexts: consider a small integration test that renders `DataProvider` + `UIProvider` and a dummy consumer that updates selection and asserts `getArrayAnalysis` result.

**Files:** `src/context/AppStateContext.test.jsx` or `DataContext.test.jsx` / `UIContext.test.jsx`.

### 4.3 Views

- [ ] Add a test for `ArraySelectorView` (or the new `PanelTable`): given mock context, render with a fixed `arrayId`, assert that a compatible panel is listed and an incompatible one is excluded (or marked). Use Testing Library and mock the context.
- [ ] Optionally test `SummaryView` with a minimal state (one array, one panel, one controller) and assert BoM or summary text appears.

**Files:** `src/views/ArraySelectorView.test.jsx` or `src/views/arraySelector/PanelTable.test.jsx`, optionally `SummaryView.test.jsx`.

---

## Phase 5: Loading/error pattern (when you add async)

- [ ] When a view first loads data from an API, add: (1) loading state (spinner/skeleton), (2) error state with retry, (3) `aria-live` / `role="alert"` as in the README. Reuse the same pattern as the app load screen in `AppStateContext` (or the provider that holds `loadStatus`).
- [ ] Optionally extract a small `AsyncView` or `useAsyncData` helper so every async view uses the same UX and a11y.

**Files:** New when needed; document in README or a short "Frontend patterns" doc.

---

## Phase 6: TypeScript (optional, longer term)

- [ ] Migrate incrementally: (1) add `tsconfig.json` and allow JS + JSX alongside TS, (2) add types for `lib/` (arrayAnalysis, migration), (3) add types for data shapes (panel, controller, array) in `src/types/`, (4) migrate context and hooks, (5) migrate views. Use strict mode once core types are in place.

---

## Suggested order of execution

| Order | Phase        | Rationale |
|-------|--------------|-----------|
| 1     | Phase 0      | Low risk, fixes correctness and repo hygiene. |
| 2     | Phase 1      | Split state first so view extractions don't depend on one giant context. |
| 3     | Phase 2      | Largest maintainability win; hooks and components can be tested in isolation. |
| 4     | Phase 3      | Quick cleanup of App.jsx once state and view are clearer. |
| 5     | Phase 4      | Add tests in parallel or right after the refactors they cover. |
| 6     | Phase 5      | Only when you introduce async loading in a view. |
| 7     | Phase 6      | When you want better refactor safety and documentation. |

---

## Checklist summary

- [x] **0.1** Backup restore: fix falsy handling for `systemVoltage`, booleans.
- [x] **0.2** Git: resolve duplicate path display or real duplicates.
- [ ] **1.1** Split context into Data + UI (or reducer + selectors).
- [ ] **2.1** Extract `useValidPanels` (and optionally controller hook).
- [ ] **2.2** Extract PanelTable, ControllerTable, ArrayParamsSection, ParallelStringsSelect.
- [ ] **2.3** Optional: BarCell component.
- [ ] **2.4** Slim ArraySelectorView to &lt;~300 lines.
- [ ] **3** Extract AppSidebar and useBackupRestore; slim App.jsx.
- [ ] **4** Add tests for migration, backup round-trip, and at least one view or subcomponent.
- [ ] **5** When adding async: loading/error/retry and a11y.
- [ ] **6** Optional: incremental TypeScript.

You can implement Phase 0 and Phase 1 first for immediate benefit, then tackle Phase 2 in one or two sessions.
