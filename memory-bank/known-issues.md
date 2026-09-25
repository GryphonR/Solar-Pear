# Known issues (from the 2026-09-25 review)

Status key: OPEN / FIXED. Update this file as issues are resolved.

## Calculation and logic
1. **FIXED – Microinverters mis-modelled.** Micros (`enphase_iq8*`, 1 tracker, maxV 60) are treated as one unit per array, with all panels on one input. A multi-panel array either fails Voc, or with NP wiring "passes" with 1 micro for N panels, and the BoM counts 1 micro. Micros need one unit per panel (or per 2/4 panels), a per-panel Voc check, and BoM qty = panel count.
2. **FIXED – `maxOperatingI` holds battery charge current for MPPT chargers.** Examples: `ss150_70` has opI 70 / maxIsc 50, `renogy_rover_60` has 60/50, and `fangpusun_flexmax_*` and `ss250_*_can` are similar (12 records where opI > maxIsc). `getCurrentClipLimit` prefers `maxOperatingI`, so the PV current check uses the battery-side amps. Fangpusun VT-65/80 have `maxIsc: 0`.
3. **FIXED – No charger power/charge-current check.** A 100/30 charger at 12 V caps at about 440 W, but `MaxDCPower` and `systemVoltage × charge current` are never compared with array Wp. This is the most common DIY/off-grid sizing mistake.
4. **FIXED – MPPT window unused.** `mpptRangeMin`/`mpptRangeMax` are never checked. Hot Vmp below the MPPT minimum and cold Vmp above the MPPT maximum are not flagged.
5. **PARTLY FIXED – Isc severity.** Isc above `maxIsc` is now a separate check (`iscRating`) from clipping (Imp above operating current). Its severity is `ISC_OVER_RATING_SEVERITY`, still `warning` pending decision D1. Since 5507f6a, Isc above `maxIsc` is only a warning. Many datasheets treat max PV Isc as a hardware limit. Consider distinguishing Isc > maxIsc (error) from Imp > operating current (clipping warning).
6. **FIXED – Fixed −10 °C design low.** This is not suitable outside mild climates, and marginal for UK record lows. The 1.084 fallback factor is optimistic.
7. **FIXED – Duplicated maths.** `useValidPanels.js` recomputes Voc/Vmp/Isc separately from `analyzeArray`, hard-codes 0.94, and computes fractional series lengths when wiring is invalid.
8. **FIXED – Dead code:** `const pStrings = wiringValid ? pStringsRaw : pStringsRaw;` in `arrayAnalysis.js`. The `systemVoltage` param of `panelPassesControllerLimits` is unused.

18. **OPEN** – Fangpusun VarioTrack VT-65/VT-80 have `maxIsc: 0` (unpublished in the data), so their current checks are skipped. Needs datasheet values.
19. **OPEN** – Victron EasySolar-II records look inconsistent with their built-in MPPTs. The 24/3000/70 and 48/3000/35 have `maxIsc`/`maxOperatingI` 50/50, but `MaxDCPower` implies a 250/70 (35 A Isc). None has `maxChargeCurrent`. Verify against datasheets.
20. **OPEN** – `ControllersGuideView.jsx` (the "maximum short-circuit current vs operating current" card) still says exceeding either rating "does not damage the controller". Update it once D1 is decided. It was left alone in the phase 1 PR because the file had concurrent edits.

## State and persistence
9. **OPEN – Stale prices for returning users.** `mergePanels`/`mergeChargers` (`src/lib/migration.js`) always keep the saved `price` (and charger `notes`) from localStorage. Because the full catalogue is persisted on first visit, refreshed catalogue prices never reach returning users. Only store user **overrides**, e.g. a `priceOverrides` map.
10. **OPEN – Zero-price panels rank as cheapest.** 46 panels have `price: 0`, which gives £0/kWp in rankings and totals. Treat 0 or missing as "unknown".

## Data quality
11. **OPEN** – A Trina buy link points to `https://dev.cclcomponents.com/new/solar-pv-modules`, which is a dev subdomain and a category page (`src/data/panels/trina.json` ~line 296).
12. **OPEN** – Efficiency mismatches (stated vs power/area): `VS-FL-200-M36-E` (22.42 vs 19.2), `SGM2-180W` (22.7 vs 19.5), and several Viridian `PV16-*` about 0.8 pp high. `GBS-Custom-350` has weight 0 and price 0.
13. **FIXED** – The `dc-dc-charger` type is used in data but not documented in `controllers/SCHEMA.md`. The panel `buyLinks` type is documented as "object" but is an array.

## Repo hygiene
14. **FIXED** – `availability_check_log_1773331249255.txt` is tracked despite `.gitignore`. Several `*_processing_log_*.txt` files and `.cursor/debug-*.log` sit untracked in the root.
15. **FIXED** – `package.json` has an empty description/author and a licence of `ISC` that conflicts with the GPL-3.0 `LICENSE`.
16. **OPEN** – `index.html` has a generic meta description and no OG/Twitter tags, canonical, sitemap, or analytics. The SPA has no routes, so there is nothing indexable per panel or controller.
17. **FIXED** – Merged remote branches `cursor/mobile-*-963b` and the local branches `cursor/add-missing-uk-panels-61fc` and `wip/preserved-pre-main-reset` can be pruned.
