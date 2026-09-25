# Domain rules (electrical and physical)

The rules are implemented in `src/lib/arrayAnalysis.js`. Constants:

| Constant | Value | Use |
| -------- | ----- | --- |
| `COLD_TEMP_C` | -10 °C | Cold Voc check (fixed; not location-aware) |
| `HOT_TEMP_C` | 65 °C cell | Hot Vmp and hot Isc |
| `STC_TEMP_C` | 25 °C | Datasheet reference |
| `VOC_WARN_FRACTION` | 0.94 | Cold Voc above 94% of controller `maxV` produces a warning (duplicated as a literal `0.94` in `useValidPanels.js`) |
| Fallback cold Voc factor | 1.084 | Used when `tempCoefVoc` is missing (implies about -0.24 %/°C, which is optimistic) |
| Fallback hot Vmp factor | 0.9 | Used when both `tempCoefVmp` and `tempCoefPmax` are missing. Otherwise the factor is √(Pmax factor) |

## Checks and their severity (as of commit 5507f6a)
- **Wiring**: `count % parallelStrings === 0`, otherwise an error. Series length = count / parallelStrings.
- **Cold Voc > `controller.maxV`**: an **error** (hardware destruction). Above 94% it is a warning.
- **Hot Vmp < effective startup V**: a **warning**. The effective startup voltage is `Vbat + startupV` when `v_start_vbat_dependent`.
- **Hot Isc × parallel strings > current clip limit**: a **warning**. The clip limit is `maxOperatingI` when it is above 0, otherwise `maxIsc`.
- **Physical**: GSE in-roof format compatibility and max height/width/weight produce errors.
- **Victron RS shared-tracker** SKU rule: `checkVictronRsSharedTrackerLimits`.

## Model assumptions (important limitations)
- **One array = one MPPT port.** Ports are exclusive, so arrays are never aggregated on a tracker.
- The app does **not** check `mpptRangeMin`/`mpptRangeMax`, `MaxDCPower`, controller total or battery charge current × Vbat, panel `maxSystemVoltage`, or `maxSeriesFuse` for 3+ parallel strings.
- Microinverters are modelled like any other single-tracker controller: one per array, with all panels in series. This is wrong for micros (see `known-issues.md`).
- Recent decision (commit 5507f6a): Isc overage and Vmp-below-startup were downgraded from fatal errors to warnings. Note that many manufacturers (e.g. Victron) treat **max PV short-circuit current** as a hard limit, so the downgrade is debatable for Isc > `maxIsc`, as opposed to Imp > operating current.
