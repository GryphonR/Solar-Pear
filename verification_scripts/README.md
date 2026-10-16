# Verification scripts

Node tooling that keeps `src/data/panels/` and `src/data/controllers/` schema-clean and price/buy-link fresh. Agent workflows under `.agent/workflows/` handle live datasheet / hallucination audits; these scripts are the cheap, repeatable pre-steps.

## Intended run order

1. **Review** — fill missing schema fields, normalize `buyLinks`, reorder keys, report zeros / empty strings / non-PDF datasheets / broken links (report only; does not delete URLs).
2. **Pricing** — Serper shopping + whitelisted retailer search + page checks; updates `price` (inc VAT), `buyLinks` (with each retailer's `price` and `inStock`), `priceCheckedAt`, `availableUK`. Then read `logs/<panel|controller>-pricing-review.md`: it lists only the products that need a human or agent to look.
3. **Agent verify workflow** — human/agent datasheet fidelity, 404 removal, hallucination policy (panels) / family-variant discovery (controllers).

Machine logs go under `logs/` (gitignored). Agent manufacturer `.log` files stay next to the JSON as an audit trail.

## Scripts

| Script | npm | Purpose |
| ------ | --- | ------- |
| `panel-review.js` | `npm run verify:panels:review` | Schema + link report for panels |
| `controller-review.js` | `npm run verify:controllers:review` | Schema + link report for controllers |
| `panel-pricing-scan.js` | `npm run verify:panels:pricing` | Price / buy-link refresh for panels |
| `controller-pricing-scan.js` | `npm run verify:controllers:pricing` | Price / buy-link refresh for controllers (searches by display `name`; relevance also accepts `modelNumber`) |
| `catalogue-sanity.js` | `npm run verify:sanity` | Read-only physical/consistency rules (Voc > Vmp, Vmp × Imp ≈ P, module efficiency vs area, temperature coefficient ranges, PV current ≤ Isc rating, MPPT window, non-production links). Exits 1 on errors. The same rules run in Vitest over the shipped catalogue, so CI fails on data errors. |
| `review-queue.js` | `npm run verify:review-queue` | Review coverage (launch target: 80% of sellable products) and a prioritised list of unreviewed products with datasheet links. Record a review with `reviewed`, `reviewedAt`, `reviewedBy` (and `notesReviewed`). |
| `datasheet-hashes.js` | `npm run verify:datasheets` | Downloads every datasheet and records its SHA-256 in `datasheet-hashes.json`. Reports CHANGED (silent revision: re-check those products), FAILED (dead link) and NEW. Exits 1 on changes or failures. |

Shared helpers live in `lib/` (`paths`, `buyLinks`, `urlQuality`, `priceExtract`, `serper`, `pricingScan`, `reviewCore`, `listingMatch`, plus catalog-specific relevance modules).

## How the pricing scan decides

1. **Is it this product?** (`listingMatch`, `panelRelevance`, `controllerRelevance`) Title and URL are both checked. Our model number or order code decides. A listing naming a sibling instead, or quoting another order code from our family, is rejected. Panels without the model need manufacturer + wattage, and also a series name only they have when another panel from the brand shares the wattage. Controllers without the code need the display name's words and every number, and must not be a conflicting variant (Tr vs MC4, an added VE.Can/GX/isolated). Pallets, multipacks, kits, battery bundles, accessories, clearance stock and marketplaces are skipped.
2. **Candidates.** Google Shopping gives a consensus price over every matching listing (outliers more than 1.6× from the median dropped). The whitelist (`data-admin/config/serper-sites.json`) is searched 8 sites per query, because Google ignores anything past the 32nd word.
3. **Page checks** (skipped with `--nofetch`). Each candidate page must show this product in its title, `<h1>` or JSON-LD. Dead or discontinued pages are dropped. Blocked pages keep their link but give no price. The price comes from the matching JSON-LD Product, cross-checked against a visible "£X + VAT" headline (read from the `<h1>` on, skipping delivery thresholds and "from" prices).
4. **Price.** **Everything is inc VAT** (ex-VAT × 1.2). The median of retailer pages wins. Otherwise the Shopping consensus is used, but only with a retailer link, or (panels) 3 agreeing listings. Then the bands: panels £0.08–0.60/W (premium brands up to £1.00, under 300 W £0.20–2.00) and within 1.8× of their series' £/W; chargers £1–12 per charge amp; fixed bands for each other type.
5. **Bookkeeping.** `priceCheckedAt` changes only when a price is written. Every scan is logged in `pricing-scan-state.json` (committed), so a product that wasn't found waits `PRICE_STALE_DAYS` before it is searched again.
6. **Review list.** `logs/<panel|controller>-pricing-review.md` flags: a price move over 25%, a single source, retailer pages disagreeing with Shopping, an unclear VAT basis, a rejected price, a page for a different product, and siblings that came out at the same price. The weekly PR includes it.

## Environment

| Variable | Used by | Notes |
| -------- | ------- | ----- |
| `SERPER_API_KEY` | pricing scans | Required. Also accepted as `--api=KEY`. Root `.env` is loaded automatically. |
| `PRICE_STALE_DAYS` | pricing scans | Default `30`. Skip products priced or scanned more recently unless `--force`. |

See `.env.example` for the Serper key placeholder.

## CLI flags (pricing)

```bash
npm run verify:panels:pricing -- --force --nofetch --manufacturer=Trina
npm run verify:controllers:pricing -- -f --manufacturer=Victron
```

- `--force` / `-f` — ignore staleness; re-check every product with a model id
- `--nofetch` — skip stage 2 (page fetch); Serper-only
- `--manufacturer=<name>` — case-insensitive substring filter

Review scripts accept `--nourl` to skip live HTTP link checks:

```bash
npm run verify:panels:review -- --nourl
npm run verify:controllers:review -- --nourl
```

## Config / schema

- Retailer whitelist: `data-admin/config/serper-sites.json` (`panels` / `controllers` lists)
- Machine schemas: `data-admin/schema/panels.schema.json`, `controllers.schema.json`
- Human schemas: `src/data/panels/SCHEMA.md`, `src/data/controllers/SCHEMA.md`

## Tests

```bash
npx vitest run verification_scripts/panel-pricing-scan.test.mjs verification_scripts/controller-pricing-scan.test.mjs verification_scripts/pricingQuality.test.mjs
```

Pricing scans are **not** part of the test/deploy CI (Serper cost + secrets). The weekly `.github/workflows/catalogue-refresh.yml` job runs the datasheet and sanity checks and opens a PR with any data changes. It runs the pricing scans too only when the repository has the `SERPER_API_KEY` secret **and** the variable `ENABLE_PRICE_REFRESH=true`.

## Agent workflows (intentional differences)

- **Panels** ([`verify-panels.md`](../.agent/workflows/verify-panels.md)): stronger delete-on-hallucination policy when the exact model cannot be found on the live web.
- **Controllers** ([`verify-controllers.md`](../.agent/workflows/verify-controllers.md)): datasheet-first audit that also **adds** family variants discovered on the same datasheet. Do not force the panel deletion policy onto controllers.
