# Controller data schema

Each JSON file in this folder is a **single array of controller objects** (PV charge controllers, hybrid inverters, string inverters, etc.) for one manufacturer. The app loads all `*.json` files in this folder via `loadData.js`; add a new file to include another manufacturer—no code changes needed.

**Filename convention:** lowercase, hyphenated from manufacturer name (e.g. `victron-energy.json`, `solax-power.json`).

---

## File format

- **Root:** JSON array `[ ... ]`
- **Each element:** One controller object (see below). The `id` field is the unique identifier used by the app.

---

## Controller object fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `id` | string | **Unique ID** for this controller. Used in selections and site controller references. Must be unique across all controller files. |
| `name` | string | Display name (e.g. "SmartSolar MPPT 75/10"). |
| `manufacturer` | string | Manufacturer name (e.g. "Victron Energy"). Used for grouping in the UI. |
| `modelNumber` | string | Official model/order code. Shown in Summary BoM as model reference. |
| `type` | string | One of: `charger`, `mppt`, `inverter_charger`, `hybrid_inverter`, `dc-dc-charger`, `ac_coupled_inverter`, `microinverter`, `string_inverter`. |
| `systemType` | string | e.g. `dc-charger`, `grid-connected`, `off-grid`, `grid-interactive`. |
| `systemVoltages` | number[] | Supported battery/system voltages (e.g. `[12, 24, 48]`). Used for system voltage compatibility. |
| `maxV` | number | Max PV input voltage (V). String cold Voc must not exceed this. Use `0` if N/A (e.g. AC-coupled). |
| `maxIsc` | number | Max short-circuit current per input (A). Panel Isc is checked against this. |
| `maxOperatingI` | number | Max operating current (A). Used for compatibility with panel current. |
| `mpptRangeMin` | number | Min MPPT voltage (V). String Vmp (hot) must stay above this. |
| `mpptRangeMax` | number | Max MPPT voltage (V). |
| `vNominal` | number | Nominal PV voltage (V). Use `0` if N/A. |
| `startupV` | number | Minimum voltage to start MPPT (V). String cold Voc must meet or exceed this for RS-type units. |
| `v_start_vbat_dependent` | boolean | If `true`, startup voltage is relative to battery (e.g. Vbat + 5V). |
| `trackers` | number | Number of MPPT trackers. Used in UI and compatibility. |
| `price` | number | Estimated unit price (user can override in app). |
| `MaxACPower` | number | Max AC output power (W). Use `0` for DC-only chargers. |
| `MaxDCPower` | number | Max DC charge/PV power (W). Use `0` when N/A. |
| `islanding` | boolean | Whether unit supports islanding / backup. |
| `notes` | string | Engineering or selection notes. |
| `datasheetUrl` | string | URL to datasheet. |
| `buyLinks` | object | Key-value map of retailer labels to URLs. Can be `{}`. |
| `g98_cert` | boolean | UK G98 certified. |
| `g99_cert` | boolean | UK G99 certified. |
| `g100_cert` | boolean | UK G100 certified. |
| `off_grid` | boolean | Suitable for off-grid use. |
| `pure_off_grid_native` | boolean | Native off-grid (no grid connection). |
| `eps` | boolean | Emergency power supply / backup capable. |
| `house_backup` | boolean | Whole-house backup capable. |
| `three_phase` | boolean | Three-phase unit. |
| `reviewed` | boolean | Data reviewed flag. |

All fields listed above are required for the app to function properly. When adding a new controller, include every field; for units with no PV input (e.g. AC-coupled inverters), use `0` for PV-related numeric fields while keeping the same object shape as existing entries.
