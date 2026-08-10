# Verification scripts

Node tooling that keeps `src/data/panels/` and `src/data/controllers/` schema-clean and price/buy-link fresh. Agent workflows under `.agent/workflows/` handle live datasheet / hallucination audits; these scripts are the cheap, repeatable pre-steps.

## Intended run order

1. **Review** — fill missing schema fields, normalize `buyLinks`, reorder keys, report zeros / empty strings / non-PDF datasheets / broken links (report only; does not delete URLs).
2. **Pricing** — Serper shopping + whitelisted retailer search + optional page fetch; updates `price`, `buyLinks`, `priceCheckedAt`, `availableUK`.
3. **Agent verify workflow** — human/agent datasheet fidelity, 404 removal, hallucination policy (panels) / family-variant discovery (controllers).

Machine logs go under `logs/` (gitignored). Agent manufacturer `.log` files stay next to the JSON as an audit trail.

## Scripts

| Script | npm | Purpose |
| ------ | --- | ------- |
| `panel-review.js` | `npm run verify:panels:review` | Schema + link report for panels |
| `controller-review.js` | `npm run verify:controllers:review` | Schema + link report for controllers |
| `panel-pricing-scan.js` | `npm run verify:panels:pricing` | Price / buy-link refresh for panels |
| `controller-pricing-scan.js` | `npm run verify:controllers:pricing` | Price / buy-link refresh for controllers (searches by display `name`; relevance also accepts `modelNumber`) |

Shared helpers live in `lib/` (`paths`, `buyLinks`, `urlQuality`, `priceExtract`, `serper`, `pricingScan`, `reviewCore`, plus catalog-specific relevance modules).

## Environment

| Variable | Used by | Notes |
| -------- | ------- | ----- |
| `SERPER_API_KEY` | pricing scans | Required. Also accepted as `--api=KEY`. Root `.env` is loaded automatically. |
| `PRICE_STALE_DAYS` | pricing scans | Default `30`. Skip re-checking products checked more recently unless `--force`. |

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
npx vitest run verification_scripts/panel-pricing-scan.test.mjs verification_scripts/controller-pricing-scan.test.mjs
```

Pricing scans are **not** wired into CI (Serper cost + secrets). Run them locally when refreshing catalog prices.

## Agent workflows (intentional differences)

- **Panels** ([`verify-panels.md`](../.agent/workflows/verify-panels.md)): stronger delete-on-hallucination policy when the exact model cannot be found on the live web.
- **Controllers** ([`verify-controllers.md`](../.agent/workflows/verify-controllers.md)): datasheet-first audit that also **adds** family variants discovered on the same datasheet. Do not force the panel deletion policy onto controllers.
