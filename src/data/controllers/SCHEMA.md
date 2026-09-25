# Controller data schema

Each JSON file in this folder is a **single array of controller objects** (PV charge controllers, hybrid inverters, string inverters, etc.) for one manufacturer. The app loads all `*.json` files in this folder via `loadData.js`; add a new file to include another manufacturer - no code changes needed.

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
| `type` | string | One of: `charger`, `hybrid_inverter`, `ac_coupled_inverter`, `microinverter`, `string_inverter`, `inverter_charger`, `dc-dc-charger` (see `CONTROLLER_TYPE` in `src/lib/controllerTypes.js`). Note that `dc-dc-charger` uses hyphens, unlike the other values. |
| `systemType` | string | e.g. `dc-charger`, `grid-connected`, `off-grid`, `grid-interactive`. |
| `systemVoltages` | number[] | Supported battery voltages (e.g. `[12, 24, 48]`). Used for battery voltage compatibility. |
| `maxV` | number | Max PV input voltage (V). String cold Voc must not exceed this. Use `0` if N/A (e.g. AC-coupled). |
| `maxIsc` | number | Max PV short-circuit current per tracker (A), as quoted on the datasheet. Use `0` if not published. |
| `maxOperatingI` | number | Max PV **input** operating current per tracker (A). This is the clipping threshold when positive; otherwise `maxIsc` is used. Use `0` when the datasheet doesn't publish a separate PV input current. **Never put the battery charge current here** (e.g. the "30" in a Victron 100/30). That goes in `maxChargeCurrent`. |
| `iscSelfLimiting` | boolean | *Optional.* Set `true` only when the datasheet says the PV input safely limits current above `maxIsc`. Array Isc above `maxIsc` is then a warning rather than an error. |
| `maxChargeCurrent` | number | Max battery charge current (A) for battery-side MPPT chargers and DC-DC chargers, e.g. `30` for a Victron 100/30. Used with the battery voltage to work out the charger's real power limit. Use `0` for inverters or if unknown. |
| `mpptRangeMin` | number | Min MPPT voltage (V). String Vmp (hot) must stay above this. |
| `mpptRangeMax` | number | Max MPPT voltage (V). |
| `vNominal` | number | Nominal PV voltage (V). Use `0` if N/A. |
| `startupV` | number | Minimum voltage to start MPPT (V). If hot Vmp falls below this the controller will not track during peak heat (harvest loss warning, not hard incompatibility). |
| `v_start_vbat_dependent` | boolean | If `true`, startup voltage is relative to battery (e.g. Vbat + 5V). |
| `trackers` | number | Number of MPPT trackers. Used in UI and compatibility. |
| `price` | number | Estimated unit price (user can override in app). |
| `priceCheckedAt` | string | ISO date (`YYYY-MM-DD`) the `price`/`buyLinks` were last verified by `verification_scripts/controller-pricing-scan.js`. Blank (`""`) if never checked. |
| `MaxACPower` | number | Max AC output power (W). Use `0` for DC-only chargers. |
| `MaxDCPower` | number | Max DC charge/PV power (W). Use `0` when N/A. |
| `islanding` | boolean | Whether unit supports islanding / backup. |
| `notes` | string | Engineering or selection notes. |
| `datasheetUrl` | string | URL to datasheet. |
| `buyLinks` | array | Array of vendor objects, each object with keys `"Supplier"`, `"URL"`, `"isAffiliate"`, `"Checked"` |
| `availableUK` | boolean | True if the controller is readily available in the UK|
| `g98_cert` | boolean | UK G98 certified. |
| `g99_cert` | boolean | UK G99 certified. |
| `g100_cert` | boolean | UK G100 certified. |
| `off_grid` | boolean | Suitable for off-grid use. |
| `pure_off_grid_native` | boolean | Native off-grid (no grid connection). |
| `eps` | boolean | Emergency power supply / backup capable. |
| `house_backup` | boolean | Whole-house backup capable. |
| `three_phase` | boolean | Three-phase unit. |
| `reviewed` | boolean | `true` once a person has checked every spec against the manufacturer datasheet. Internal only: review status is not shown in the app. |
| `reviewedAt` | string | ISO date (`YYYY-MM-DD`) of that review, or `""`. |
| `reviewedBy` | string | Who reviewed it, or `""`. |
| `notesReviewed` | boolean | `true` once a person has checked or rewritten the `notes`. Otherwise notes are labelled as AI-generated. |

All fields listed above are required for the app to function properly. When adding a new controller, include every field; for units with no PV input (e.g. AC-coupled inverters), use `0` for PV-related numeric fields while keeping the same object shape as existing entries.
