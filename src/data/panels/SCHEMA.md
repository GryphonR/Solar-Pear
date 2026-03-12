# Panel data schema

Each JSON file in this folder is a **single array of panel objects** for one manufacturer. The app loads all `*.json` files in this folder via `loadData.js`; add a new file (e.g. `sunpower.json`) to include another manufacturer—no code changes needed.

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
| `manufacturer` | string | Manufacturer name (e.g. "Trina", "JA Solar"). Used for grouping in the UI. |
| `panel-series` | string | The series of panels that this panel belongs to (e.g. "Infinitiy RT", "Hi-MO X6 Max Artist")  Used for grouping in the UI. |
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
| `tempCoefPmax` | number | Temperature coefficient of Pmax (%/°C). Used for cold Voc / hot Vmp. |
| `tempCoefVoc` | number | Temperature coefficient of Voc (%/°C). |
| `tempCoefIsc` | number | Temperature coefficient of Isc (%/°C). |
| `maxSeriesFuse` | number | Max series fuse rating (A). |
| `maxSystemVoltage` | number | Max system voltage (V). |
| `cells` | string | Cell description (e.g. "144 Half-Cell (i-TOPCon)"). |
| `gseCompatibility` | string | In-roof (GSE) format: `"Both"`, `"None"`, `"Portrait Only"`, or `"Landscape Only"`. |
| `datasheetUrl` | string | URL to datasheet. |
| `notes` | string | Engineering or selection notes. |
| `buyLinks` | object | Array of vendor objects, each object with keys `"Supplier"`, `"URL"`, `"isAffiliate"`, `"Checked"` |
| `active` | boolean | If `true`, panel appears in selectors. |
| `availableUK` | boolean | True if panel is readily available in the UK|
| `reviewed` | bool | Confirmation of human review of the data|

All fields listed above are required for the app to function properly. When adding a new panel, include every field; use neutral values (e.g. `0`, `""`, `false`, `{}`) where a value is not applicable.
