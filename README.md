# Solar Pear

**Pair the right panels with your roof. Pair the right controller with your panels.**

Solar Pear is a browser-based tool for designing solar PV setups: define your roof arrays, choose panels that fit (physically and electrically), match them with compatible PV controllers, and get a summary plus bill of materials. All compatibility checks—Voc, Vmp, Isc, format—run in the app so you can iterate without juggling spreadsheets or manufacturer tools.

*No fruit was harmed in the making of this app.*

---

## What it does

- **Arrays** — Model multiple roof areas (orientation, panel count, format, mounting). One place for your whole site.
- **Panels** — Browse a multi-brand panel database, filter by size/weight and in-roof (GSE) compatibility, and see peak power and cost per kWp per array.
- **PV controllers** — Pick controllers that match your strings. Voc, Vmp, and Isc are validated; system voltage and type (grid / off-grid / DC charger) are respected.
- **Summary & BoM** — Overview of your system and a bill of materials (panels and controllers; harnesses and mounting are on you).
- **Backup & restore** — Export your full configuration to a JSON file and import it elsewhere. Your data lives in the browser—the download button is the closest thing to a “save” button.

---

## Getting started

**Prerequisites:** Node.js 18+ and npm.

```bash
# Install dependencies
npm install

# Run the dev server (default: http://localhost:5173)
npm run dev

# Run tests (single run, CI-friendly)
npx vitest run

# Build for production
npm run build

# Preview production build locally
npm run preview
```

---

## Tech stack

- **Vite 7** — Build and dev server
- **React 19** — UI
- **Tailwind CSS v4** — Styling (theme in `src/index.css`, no `tailwind.config.js` by default)
- **Vitest** — Unit tests (with Testing Library and jsdom)

---

## Project structure (high level)


| Area                              | Purpose                                                  |
| --------------------------------- | -------------------------------------------------------- |
| `src/App.jsx`                     | Main app shell, tabs, backup/restore                     |
| `src/context/AppStateContext.jsx` | Shared state and persistence                             |
| `src/views/`                      | Summary, array selector, panels/chargers/arrays DB views |
| `src/components/`                 | Modals, guide, logo, icons                               |
| `src/lib/`                        | Array analysis, compatibility, migration                 |
| `src/data/`                       | Panels and controllers: one JSON file per manufacturer in `panels/` and `controllers/`; new files are picked up automatically (`loadData.js`). |


---

## Data and limitations

- **Storage:** All configuration is stored in your browser (localStorage). Clearing site data or switching devices means starting fresh—unless you’ve exported a backup. We recommend downloading a backup if the setup matters.
- **BoM scope:** The bill of materials covers panels and PV controllers only. No cables, connectors, or mounting; treat it as a component list, not a full quote.
- **Prices:** Pre-loaded prices are estimates. Override them with your own for a more realistic BoM.
- **AI-generated notes:** Panel and controller notes are AI-derived and may be imperfect. Use them as a starting point, not the final word.
- **Compatibility only:** The app checks electrical compatibility (Voc, Vmp, Isc, format). It does not produce wiring diagrams or installation instructions.

---

## Scripts reference


| Command                 | Description                          |
| ----------------------- | ------------------------------------ |
| `npm run dev`           | Start Vite dev server                |
| `npm run build`         | Production build (output in `dist/`) |
| `npm run preview`       | Serve the production build locally   |
| `npm run test`          | Run Vitest in watch mode             |
| `npx vitest run`        | Run tests once (e.g. in CI)          |
| `npm run test:coverage` | Run tests with coverage report       |


---

## License

ISC.