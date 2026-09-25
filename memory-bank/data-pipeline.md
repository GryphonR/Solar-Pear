# Data pipeline (catalogue)

## Catalogue snapshot (2026-09-25)
- **Panels:** 177 across 19 manufacturers (Aiko, Canadian Solar, DMEGC, ET Solar, GB-Sol, JA, Jinko, LONGi, Maxeon, Meyer Burger, Q-Cells, REC, Renesola, Risen, Trina, UKSOL, Victron, Viridian, Voltacon). All are `active`.
- **Controllers:** 68 across 14 manufacturers. By type: 29 hybrid, 25 charger, 6 string, 6 micro, 1 AC-coupled, 1 `dc-dc-charger` (the last type is missing from `controllers/SCHEMA.md`).
- **Reviewed:** 2 of 245 records have `reviewed: true`.
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
- Agent workflows live in `.agent/workflows/*.md`.
