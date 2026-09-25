# Domain rules (electrical and physical)

All maths lives in `src/lib/arrayAnalysis.js`. **`evaluateElectrical(panel, controller, { count, parallelStrings, systemVoltage, conditions })` is the single source of truth.** `analyzeArray`, the panel ranking (`useValidPanels.js`), the controller list (`ArraySelectorView.jsx`), the area-controller cards and the planner all call it. Don't re-implement any check elsewhere. It returns metrics, `flags`, `issues[]` (`{ code, severity: error|warning|info, message }`) and `hardOk`.

`evaluatePhysicalFit(array, panel, hideHeavyPanels)` covers GSE format, size and weight. `evaluateControllerPower(controller, totalWp, { systemVoltage, arrayCount })` covers the controller-level power check. `analyzeArray` sums every array on the same controller instance before calling it.

## Design conditions
These are per-area settings: `designLowC` (default −10 °C), `designHighC` (default 65 °C cell) and `strictCurrent` (default off). They're stored in `solar_area_settings`, edited on the Controller Selector tab, and converted with `conditionsFromAreaSettings()`. Every message states the temperature used.

| Constant | Value | Use |
| -------- | ----- | --- |
| `VOC_WARN_FRACTION` | 0.94 | Cold Voc above 94% of controller `maxV` produces a warning |
| `DEFAULT_TEMP_COEF_VOC` | −0.30 %/°C | Fallback when a panel has no `tempCoefVoc`. Conservative; all catalogue panels have one |
| `DEFAULT_TEMP_COEF_PMAX` | −0.35 %/°C | Fallback for the Vmp coefficient |
| Vmp coefficient | `tempCoefVmp`, else `tempCoefPmax` | Linear. It replaced the old √P approximation, which over-estimated hot Vmp |
| `STRICT_CURRENT_FACTOR` | 1.25 | Isc irradiance factor in strict mode (NEC 690.8 / IEC 62548) |
| `CHARGE_VOLTAGE_FACTOR` | 1.2 | Charger output W = charge A × Vbat × 1.2 (so a 100/30 at 12 V gives 432 W) |
| `CHARGER_OVERPANEL_TOLERANCE` | 1.3 | Chargers: up to 130% of the limit is info, above that it's a warning |
| `ISC_OVER_RATING_SEVERITY` | `'warning'` | **Pending decision D1.** Switch to `'error'` to make Isc > maxIsc a hard failure |

## Checks
| Code | Condition | Severity |
| ---- | --------- | -------- |
| `wiring` | count % parallelStrings ≠ 0 | error |
| `format` / `size` / `weight` | GSE tray orientation, max dimensions, max weight | error |
| `noPvInput` | controller `maxV` is 0 (e.g. AC-coupled) | error |
| `voc` | cold Voc > controller `maxV` | error |
| `panelSystemVoltage` | cold Voc > panel `maxSystemVoltage` | error |
| `vocMargin` | cold Voc > 94% of `maxV` | warning |
| `vmpStartup` | hot Vmp < effective startup (Vbat + startupV when `v_start_vbat_dependent`) | warning |
| `mpptMin` | hot Vmp < `mpptRangeMin` (skipped for Vbat-referenced chargers) | warning |
| `mpptMax` | cold Vmp > `mpptRangeMax` | warning |
| `iscRating` | hot Isc (× 1.25 in strict mode) > `maxIsc` | `ISC_OVER_RATING_SEVERITY` |
| `currentClip` | hot Imp > clip limit (`maxOperatingI` > 0, else `maxIsc`, else unknown) | warning (suppressed when `iscRating` fires) |
| `stringFuses` | ≥ 3 parallel strings and (P−1) × 1.25 × Isc > `maxSeriesFuse` | info (warning if no fuse fits between 1.5 × Isc and `maxSeriesFuse`) |
| `chargerPower` | Σ Wp on the instance > `maxChargeCurrent` × Vbat × 1.2 | info up to 130%, then warning |
| `dcPower` | Σ Wp on the instance > inverter `MaxDCPower` | warning |
| `microModulePower` / `microAcClip` | panel W > micro `MaxDCPower` / > `MaxACPower` | warning / info |

Status: any error gives `error`, else any warning gives `warning`, else `valid`. Info messages never change the status.

## Controller current fields
- `maxIsc`: max PV short-circuit current per tracker.
- `maxOperatingI`: max PV **input** operating current per tracker, or 0 if unpublished. **Never the battery charge current.**
- `maxChargeCurrent`: battery-side charge current for chargers (e.g. 30 for a Victron 100/30), or 0 for inverters.

## Microinverters (`type: 'microinverter'`)
Each panel has its own input, so the series length is 1 and the parallel-strings selector is hidden. Units = ceil(count ÷ `panelsPerUnit`), where `panelsPerUnit` is optional and defaults to 1. The array's cost and the BoM quantity use the unit count.

## Model assumptions (remaining limitations)
- One array = one MPPT port. Ports are exclusive, so arrays are never aggregated on a tracker, but the power check does aggregate per controller instance.
- The battery voltage for the charger power check falls back to the lowest `systemVoltages` entry (the message says "assuming a …V battery").
- There are no location-based temperature presets yet (roadmap 1.11, parked until there's a sourced climate dataset).
