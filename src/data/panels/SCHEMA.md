# Panel data schema

Each JSON file in this folder is a **single array of panel objects** for one manufacturer. The app loads all `*.json` files in this folder via `loadData.js`; add a new file (e.g. `sunpower.json`) to include another manufacturer - no code changes needed.

**Filename convention:** lowercase, hyphenated from manufacturer name (e.g. `ja-solar.json`, `canadian-solar.json`).

---

## File format

- **Root:** JSON array `[ ... ]`
- **Each element:** One panel object (see below). The `model` field is the unique identifier used by the app.

---

## Panel object fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `name` | string | Display name (e.g. "Trina Vertex S+ 430W"). |
| `model` | string | **Unique ID** for this panel. Used in selections and compatibility logic. Must be unique across all panel files. |
| `manufacturer` | string | Manufacturer name (e.g. "Trina", "JA Solar"). Top-level grouping key in Panels DB and Array Selector. |
| `panel-series` | string | Product series (e.g. "Vertex S+", "Hi-MO X6 Max Artist"). With manufacturer and power, forms the UI hierarchy manufacturer → series → power. Blank values group as "(no series)". |
| `height` | number | Panel height in mm. Used for physical fit and filters. |
| `width` | number | Panel width in mm. |
| `depth` | number | Depth in mm. |
| `weight` | number | Weight in kg. Used for "hide panels over 25kg" filter. |
| `glass` | string | Glass type (e.g. "Dual (1.6mm + 1.6mm)"). |
| `bifacial` | boolean | Whether the panel is bifacial. |
| `power` | number | Nominal power in watts (e.g. 430). |
| `voc` | number | Open-circuit voltage (V). Used for string voltage and cold-temperature checks. |
| `vmp` | number | Voltage at max power (V). Used for MPPT range and hot-temperature checks. |
| `isc` | number | Short-circuit current (A). Checked against controller `maxIsc` / `maxOperatingI`. |
| `imp` | number | Current at max power (A). |
| `price` | number | Estimated unit price (user can override in app). |
| `efficiency` | number | Module efficiency (%). |
| `tempCoefPmax` | number | Temperature coefficient of Pmax (%/°C). Used for Pmax temp sweeps and as √P fallback for hot Vmp when `tempCoefVmp` is absent. |
| `tempCoefVoc` | number | Temperature coefficient of Voc (%/°C). Used for cold Voc checks. |
| `tempCoefVmp` | number | Optional temperature coefficient of Vmp (%/°C). Preferred for hot Vmp when present. |
| `tempCoefIsc` | number | Temperature coefficient of Isc (%/°C). |
| `maxSeriesFuse` | number | Max series fuse rating (A). |
| `maxSystemVoltage` | number | Max system voltage (V). |
| `cells` | string | Cell description (e.g. "144 Half-Cell (i-TOPCon)"). |
| `gseCompatibility` | string | In-roof (GSE) format: `"Both"`, `"None"`, `"Portrait Only"`, or `"Landscape Only"`. |
| `datasheetUrl` | string | URL to datasheet. |
| `notes` | string | **Design Notes** — see [Design notes](#design-notes-notes) below. Shown to users as "Design Notes" in the app. |
| `buyLinks` | object | Array of vendor objects, each object with keys `"Supplier"`, `"URL"`, `"isAffiliate"`, `"Checked"` |
| `active` | boolean | If `true`, panel appears in selectors. |
| `availableUK` | boolean | True if panel is readily available in the UK|
| `reviewed` | bool | Confirmation of human review of the data|

All fields listed above are required for the app to function properly. When adding a new panel, include every field; use neutral values (e.g. `0`, `""`, `false`, `{}`) where a value is not applicable.

---

## Design notes (`notes`)

`notes` is a **per-series** field, not a per-panel one: every panel that shares the same `manufacturer` and `panel-series` must carry the **exact same** `notes` text, in the same way that `height`, `width`, `depth`, `weight` and the `tempCoef*` fields are already shared across a series. Write it as a short paragraph about the series as a whole — what it is, how it's built, and where it sits relative to other series — covering three things:

1. **Technology** — the cell architecture (PERC, TOPCon, HJT, ABC, HPBC, IBC, etc.), whether it's monofacial or bifacial, and the glass construction.
2. **Pros / Cons** — the series' real strengths and trade-offs (price, aesthetics, warranty, temperature behaviour, physical size, etc.), not just a restatement of the spec sheet.
3. **Notable power outputs within the series** — the highest/lowest bin, a bin with a materially different Voc/Isc, a bin needing a wider series fuse, etc.

Use plain sentences with `Technology:`, `Pros:` and `Cons:` as inline lead-ins (the note renders as plain text, not markdown, so avoid bullet characters or headings that need formatting to read correctly).

When editing a series' panels, update `notes` on every member together (the data-admin Panels browser has an "Edit design notes" action per series that does this in one step) so the series never drifts out of sync.

**Edge case — panels with no series:** panels with a blank or missing `panel-series` (grouped in the UI as `"(no series)"`) have no series to share a note with, so for these `notes` stays **per-panel**: write it about that specific model, and say plainly that it has no documented series (e.g. because the manufacturer sells it as a one-off, or names it inconsistently). `allowedEmptyStrings` in the panels schema permits `notes` to be blank, but prefer writing something over leaving it empty.
