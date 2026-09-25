# Architecture

## Stack
Vite 7, React 19, Tailwind v4 (theme in `src/index.css`), uPlot for graphs, and Vitest with Testing Library and jsdom. It needs Node 20.19+ (Vite 7) and runs on Node 20 in CI.

## Layout
| Path | Role |
| ---- | ---- |
| `src/App.jsx` | Shell, sidebar, tab switching (state-driven, **no router / no URLs per view**) |
| `src/context/AppStateContext.jsx` (~1000 lines) | All app state, localStorage load/migrate, CRUD for areas/arrays/controllers, `getArrayAnalysis` |
| `src/lib/arrayAnalysis.js` | Core compatibility maths (`analyzeArray`, temp factors, wiring helpers) |
| `src/views/arraySelector/useValidPanels.js` | Per-panel ranking. **Re-implements** parts of `analyzeArray` (drift risk) |
| `src/views/arraySelector/ControllerSection.jsx` | Controller picker and MPPT port assignment |
| `src/components/planner/ArrayPlanner.jsx` (~2000 lines) + `src/lib/plannerEngine.js` | Roof drawing and auto-fit packing (see `documentation/ARRAY_PLANNER_ALGORITHM.md`) |
| `src/views/SummaryView.jsx` | Totals and BoM |
| `src/components/BuyButton.jsx` | Renders `buyLinks`. Uses `rel="noopener noreferrer sponsored"` and marks affiliate links with `*` |
| `src/lib/migration.js` | Legacy localStorage migrations plus `mergePanels`/`mergeChargers` (bundled catalogue merged with the user's saved copy) |
| `src/lib/backupValidation.js`, `src/hooks/useBackupRestore.js` | JSON import/export (`documentation/BACKUP_SCHEMA.md`) |
| `src/data/loadData.js` | `import.meta.glob` eager-loads every `panels/*.json` and `controllers/*.json` into the bundle |
| `data-admin/` | Separate local Express and React app for editing the catalogue JSON (binds to 127.0.0.1, optional `DATA_ADMIN_TOKEN`) |
| `verification_scripts/` | Node scripts for schema review and Serper-based price/buy-link scans |
| `.agent/workflows/` | Agent prompts for adding and verifying panels/controllers from datasheets |

## Persistence
localStorage keys are listed in `documentation/LOCAL_STORAGE_KEYS.md`. **The whole panel and controller catalogue is persisted** (`solar_panels`, `solar_chargers`). On load it is merged with the bundled catalogue, but the user's saved `price` (and, for chargers, `notes`) wins. See `known-issues.md`.

## Build and deploy
- `.github/workflows/deploy.yml`: on every push to `main` it runs the root tests, then data-admin install, test and build, then the root build, then deploys to **GitHub Pages** with `BASE_PATH=/`. The live site is **https://solarpear.echook.uk/** (a custom-domain CNAME on the Pages site).
- The bundle is a single chunk of about 870 kB (about 200 kB gzipped) because the catalogue is inlined. The build warns about the chunk size.
- The root `vitest run` also picks up `data-admin/**` and `verification_scripts/**` tests. At the last review there were 22 files and 283 tests, all passing, taking about 40 s.

## Conventions
- One JSON file per manufacturer. `model` (panels) and `id` (controllers) must be unique across all files.
- `notes` on panels is **per series** and identical across a series (see `src/data/panels/SCHEMA.md`).
- Git branches: `main` is deployed. `cursor/*` branches come from Cursor cloud agents.
