# Data pipeline (catalogue)

## Catalogue snapshot (2026-09-25)
- **Panels:** 181 across 20 manufacturers (Aiko, Canadian Solar, DMEGC, ET Solar, GB-Sol, JA, Jinko, LONGi, Maxeon, Meyer Burger, Q-Cells, REC, Renesola, Renogy, Risen, Trina, UKSOL, Victron, Viridian, Voltacon). Two are flexible (`flexible: true`). All are `active`.
- **Controllers:** 151 across 25 manufacturers (68 across 14 before task 3.11 added Sunsynk, Growatt, Lux Power, Fronius, SMA, Sigenergy, Tesla, Deye and Fogstar; task 3.6 added EPEver, Votronic and more Victron and Renogy units). Types include hybrid, charger, string, micro, AC-coupled and `dc-dc-charger`.
- **Reviewed:** 2 of 245 records have `reviewed: true`.
- **Discontinued:** every panel and controller has `discontinued` (boolean) and `discontinuedNote` (string, `""` unless discontinued). Discontinued products stay selectable, for people designing around existing or second-hand kit, and show a "Discontinued" badge (`src/components/DiscontinuedBadge.jsx`) in the selectors, databases, info modals, overview and BoM. The 6 GivEnergy controllers are discontinued (administration, April 2026). This differs from `active`, which is the user's own show/hide toggle, and from `replacements.json`, which moves saved designs to a successor.
- **Prices:** 46 panels have `price: 0`. All `priceCheckedAt` dates are from 2026-08.
- **Buy links:** 122 links in total, **0 affiliate**, and 178 products have no link. The top domains are voltaconsolar.com, tradesparky, bimblesolar, segen, cclcomponents, cityplumbing and midsummerwholesale.

## Schemas
- Human docs: `src/data/panels/SCHEMA.md` and `src/data/controllers/SCHEMA.md`.
- JSON Schemas for data-admin: `data-admin/schema/*.schema.json`.

## Tooling
- `npm run verify:{panels,controllers}:review` checks schema fill, key order, zeros and link report.
- `npm run verify:{panels,controllers}:pricing` scans Serper Google Shopping plus whitelisted retailers. It updates `price`, `buyLinks` (upserted by domain, tracking params stripped) and `priceCheckedAt`. It needs `SERPER_API_KEY` in `.env`.
- **Warning:** `stripTrackingParams` removes query strings. That would also strip affiliate tags (e.g. `?tag=`, `?aff=`) if affiliate URLs are ever fed through the scanner.
- `data-admin/` (`cd data-admin && npm run dev`) is a local browser/editor for the JSON with URL checks.
- `npm run verify:sanity` runs read-only physical/consistency rules (`verification_scripts/lib/sanityRules.js`). **The same rules run in Vitest over the shipped catalogue, so CI fails on data errors.**
- `npm run verify:review-queue` shows review coverage (target: 80% of products with buy links) and what to review next. A review is recorded with `reviewed`, `reviewedAt`, `reviewedBy` and `notesReviewed`. Review status is internal and is not shown in the app (owner decision, 2026-09-25). The only public effect is that notes are labelled as AI-generated unless `notesReviewed` is set.
- `npm run verify:datasheets` fingerprints every datasheet (SHA-256 in `verification_scripts/datasheet-hashes.json`) and reports changed or dead links.
- `.github/workflows/catalogue-refresh.yml` runs every Monday: datasheets and sanity checks, plus prices when the `SERPER_API_KEY` secret and `ENABLE_PRICE_REFRESH=true` variable are set. It opens a `bot/catalogue-refresh` PR.
- A panel weight of 0 means "not published". It fails any weight limit with a warning rather than passing.
- Agent workflows live in `.agent/workflows/*.md`.
