# Solar Pear – Launch & Monetisation Roadmap

A living plan for taking Solar Pear from a personal tool to a public, trusted, affiliate-funded product. Work through it phase by phase and tick items off as they land.

Created: 2026-09-25 (baseline commit `5507f6a`). Owner: Rowan.

---

## How to use this document

- **Tick a box** (`- [x]`) when the task is merged to `main`. Add the commit or PR reference at the end of the line, e.g. `(a1b2c3d)`.
- **Task IDs** (e.g. `1.3`) are stable. Refer to them in commit messages, branch names and PR titles, e.g. `fix(1.3): charger power check`.
- **Status markers** go in front of the task title when it isn't simply open or done:
  - 🚧 in progress
  - ⏸ parked (add a reason)
  - ❌ dropped (add a reason; never delete the task)
- **Acceptance** lines state what "done" means. A task isn't ticked until every acceptance point holds.
- **`KI-n`** refers to item *n* in [known-issues.md](known-issues.md). When a task fixes a known issue, mark that issue FIXED there too.
- **Decisions** that change direction go in the [Decision log](#decision-log) at the bottom, with a date.
- Update the [Progress overview](#progress-overview) table whenever you tick items.

### Priority key
- **P0**: blocks public launch (safety, correctness, legal).
- **P1**: needed for launch to succeed (revenue, discoverability, trust).
- **P2**: growth after launch.
- **P3**: nice to have.

---

## Progress overview

| Phase | Theme | Priority | Done / Total |
| ----- | ----- | -------- | ------------ |
| 0 | Housekeeping | P0 | 7 / 8 |
| 1 | Calculation correctness & safety | P0 | 11 / 12 |
| 2 | State, persistence & pricing integrity | P0 | 0 / 6 |
| 3 | Catalogue quality & coverage | P0/P1 | 0 / 12 |
| 4 | Affiliate infrastructure | P1 | 0 / 13 |
| 5 | Hosting, routing & SEO | P1 | 0 / 13 |
| 6 | Trust, legal & compliance | P0 | 0 / 11 |
| 7 | Product & UX improvements | P1/P2 | 0 / 15 |
| 8 | Analytics & measurement | P1 | 0 / 7 |
| 9 | Engineering, performance & CI | P1/P2 | 0 / 11 |
| 10 | Internationalisation | P2 | 0 / 8 |
| 11 | Launch | P1 | 0 / 10 |
| 12 | Growth & ongoing operations | P2 | 0 / 12 |
| **Total** | | | **18 / 138** |

### Milestones
- **M1 – "Safe to share"**: phases 0, 1, 2 and the P0 items in 3 and 6 are done. At this point the app gives correct advice and you can show it to friends and forums without risk.
- **M2 – "Revenue-ready"**: phases 4, 5, 8 and the rest of 6 are done. Affiliate links earn, pages are indexable, and clicks are measured.
- **M3 – "Public launch"**: phase 11 is complete.
- **M4 – "Growth"**: phases 7, 10 and 12 are underway.

---

## Phase 0 – Housekeeping (P0)

Quick wins that clean the repo before bigger work starts.

- [x] **0.1 Untrack stray logs** – Run `git rm --cached availability_check_log_*.txt` and delete the root `*_processing_log_*.txt` files and `.cursor/debug-*.log`. Check that `.gitignore` covers `.cursor/*.log`. *(KI-14)*
  - Acceptance: `git ls-files | grep -i log` shows only `logs/.gitkeep` and the intentional agent audit logs.
- [x] **0.2 Fix package metadata** – Set `description`, `author`, `homepage` and `repository` in `package.json`, and set `license` to `GPL-3.0-or-later` to match `LICENSE`. *(KI-15)*
- [x] **0.3 Prune merged branches** – Delete the remote `cursor/mobile-viewport-gate-963b` and `cursor/mobile-vertical-scroll-963b`, and the local `cursor/add-missing-uk-panels-61fc`. Decide whether `wip/preserved-pre-main-reset` still holds anything worth keeping. *(KI-17)*
  - Done 2026-09-25: all four branches deleted. `wip/preserved-pre-main-reset` was at `fc968c7` and can be restored with `git branch wip/preserved-pre-main-reset fc968c7` while the reflog lasts.
- [x] **0.4 Commit the memory bank** – Commit `memory-bank/` and `CLAUDE.md`, or decide to gitignore them.
- [x] **0.5 Remove dead code** – Remove the no-op ternary `pStrings = wiringValid ? pStringsRaw : pStringsRaw` and the unused `systemVoltage` param in `panelPassesControllerLimits` (`src/lib/arrayAnalysis.js`). *(KI-8)*
  - Note: the `systemVoltage` param is kept as `_systemVoltage` rather than removed, because task 1.5 will need it.
- [x] **0.6 Update the schema docs** – Add `dc-dc-charger` (and `inverter_charger`, if it's used) to the `type` list in `controllers/SCHEMA.md`. Change the `buyLinks` type from "object" to "array" in both schema docs. *(KI-13)*
- [ ] 🚧 **0.7 Improve the README** – Add a screenshot or GIF, a live-site link, a "How the checks work" link, and a contributing section.
  - Progress: live link, checks table, contributing section and the Node version fix (18+ → 20.19+) are done. The screenshot or GIF is still to do.
- [x] **0.8 Add issue and PR templates** – Create `.github/ISSUE_TEMPLATE/` with "data correction", "bug" and "missing product" templates, so public users can report bad specs in a structured way.

---

## Phase 1 – Calculation correctness & safety (P0)

The app's value and credibility, and liability, rest on these checks. Each task must add or extend unit tests in `src/lib/arrayAnalysis.test.js`.

### 1A. Single source of truth
- [x] **1.1 Unify the compatibility maths** – Extract one pure function, e.g. `evaluatePanelOnController(array, panel, controller, opts)`, that returns every metric and flag. Use it from both `analyzeArray` and `useValidPanels.js`. Remove the hard-coded `0.94` in favour of `VOC_WARN_FRACTION`. *(KI-7)*
  - Acceptance: `useValidPanels.js` contains no temperature or Voc arithmetic. A test asserts that both paths produce the same flags for a matrix of fixtures.
  - Done: `evaluateElectrical` in `arrayAnalysis.js`, used by the analysis, the panel ranking, the controller list, the area-controller cards and the planner. The Vmp temperature model also changed from √P to a linear Pmax-coefficient proxy, which is more conservative when hot.
- [x] **1.2 Guard against invalid wiring in the ranking** – When `count % parallelStrings !== 0`, the panel list must not compute fractional series lengths. Mark those rows as a wiring error instead.

### 1B. Controller model fixes
- [x] **1.3 Separate PV current from charge current** – Split the fields so that:
  - `maxIsc` is the maximum PV short-circuit current per tracker (a hard limit);
  - `maxPvOperatingI` is the maximum PV input current per tracker (the clipping threshold);
  - `maxChargeCurrent` is the battery-side current for chargers.

  Migrate the data, starting with the 12 records where `maxOperatingI > maxIsc`: Victron `ss150_*` and `ss250_*_can`, Renogy Rover 60, and Fangpusun FlexMax/VT. Fix Fangpusun VT-65/80, which have `maxIsc: 0`. *(KI-2)*
  - Acceptance: the review script flags any record where the PV operating current is greater than `maxIsc`. `getCurrentClipLimit` uses `maxPvOperatingI`.
  - Done differently: `maxOperatingI` was kept (it already meant PV input current per the schema) and a new `maxChargeCurrent` field was added. 28 records were migrated; the charge currents come from the model names. A zero or unknown `maxIsc` no longer produces a 0 A clip limit. A review-script rule for PV current > Isc is still to add (move to 3.2). Fangpusun VT and EasySolar-II data issues are logged as KI-18 and KI-19.
- [x] **1.4 Restore Isc as a hard check** – Make array Isc (hot, × parallel strings) above `maxIsc` an **error**, unless the datasheet says the input self-limits. Keep Imp above `maxPvOperatingI` as a clipping **warning**. Add an optional per-controller `iscSelfLimiting` flag for units that genuinely tolerate over-Isc. Record the decision in the Decision log. *(KI-5)*
  - Done: `iscRating` (Isc > maxIsc) is an error and `currentClip` (Imp > operating current) a warning. The optional `iscSelfLimiting` controller flag downgrades `iscRating` to a warning. The ControllersGuideView wording is still to fix (KI-20).
- [x] **1.5 Add a charger power check** – For `charger` and `dc-dc-charger` types, compute `maxChargeCurrent × systemVoltage` (using the charging voltage, about 1.2 × nominal, as the conservative case). Warn when array Wp is above it:
  - moderate overpanelling (for example up to 130%) is an info message;
  - beyond that it is a warning.

  For inverters, compare with `MaxDCPower`. *(KI-3)*
  - Acceptance: a 1 kW array on a 100/30 at 12 V shows "about 440 W max, about 56% of array power will be clipped".
  - Done: `evaluateControllerPower` sums every array on the controller instance. A 1 kW array on a 100/30 at 12 V gives 432 W and 57%. Verified in the browser.
- [x] **1.6 Check the MPPT window** – Flag hot Vmp below `mpptRangeMin` (the tracker leaves the MPP) and cold Vmp above `mpptRangeMax`. Both are warnings. *(KI-4)*
- [x] **1.7 Model microinverters properly** – Handle microinverters separately:
  - one unit per N panels (add `panelsPerUnit`: 1 for the IQ8, 2 or 4 for dual and quad micros);
  - per-panel Voc/Isc checks against the micro;
  - BoM quantity = ceil(panels ÷ panelsPerUnit);
  - hide the "parallel strings" selector;
  - a per-micro AC clipping estimate (panel W against the micro's continuous VA).

  *(KI-1)*
  - Acceptance: 10 × 430 W panels on an IQ8M shows 10 micros in the BoM, per-panel checks, and a clipping note.
  - Done and verified in the browser: 10 × IQ8M in the BoM (£1,400), with the wiring selector replaced by a one-panel-per-input note.
- [x] **1.8 Check panel system voltage** – Error when string cold Voc is above the panel's `maxSystemVoltage` (1000 V or 1500 V).
- [x] **1.9 Check string fusing** – With 3 or more parallel strings, warn that string fuses are required, and check `maxSeriesFuse` against (parallel − 1) × Isc × 1.25.

### 1C. Environmental assumptions
- [x] **1.10 Make design temperatures configurable** – Add per-site "design low" and "design high" settings (defaults −10 °C / 65 °C cell) to the project settings, and show them in every message ("at −10 °C"). Tighten the fallback cold-Voc factor from 1.084 to a conservative value (for example −0.30 %/°C ⇒ 1.105) and flag panels that have no coefficient. *(KI-6)*
  - Done as per-area settings (`designLowC`, `designHighC`, `strictCurrent`) on the Controller Selector tab, covered by backup/restore through area settings. All catalogue panels have `tempCoefVoc`, so no flag is shown; the fallback applies only to user-added panels.
- [ ] ⏸ **1.11 Add location-based temperature presets** – Offer a postcode or country picker that fills in the design low and high from a small bundled table (UK regions first). Later, use an open climate dataset. See 10.4.
  - Parked: shipping regional presets needs a sourced dataset (e.g. Met Office extremes or ASHRAE). Users can set the design low manually per area for now.
- [x] **1.12 Add an irradiance safety factor** – Offer an optional 1.25 × Isc factor (NEC/IEC practice for edge-of-cloud irradiance) as a "strict mode" toggle. Document it on the methodology page (6.5).

---

## Phase 2 – State, persistence & pricing integrity (P0)

- [ ] **2.1 Store only user overrides** – Stop persisting the whole catalogue. Keep `priceOverrides` / `panelOverrides` / `controllerOverrides` maps (by model or id) plus user-added custom items, and merge them over the bundled catalogue at load time. *(KI-9)*
  - Acceptance: after a catalogue price change, a returning user sees the new price unless they manually overrode it. There is a migration from the current `solar_panels`/`solar_chargers` keys that keeps a saved value as an override only where it differs from the bundled one.
- [ ] **2.2 Handle unknown prices** – Treat `price` 0 or missing as unknown: show "—" or "Price unavailable", exclude it from £/kWp sorting (sort last), and show "incomplete" on totals. *(KI-10)*
- [ ] **2.3 Show price age** – Show "Price checked: Aug 2026" from `priceCheckedAt` in tables, modals and the BoM. Flag prices older than 60 days.
- [ ] **2.4 Version the saved state** – Add a `schemaVersion` to both localStorage and backups, with a single migration pipeline, so future model changes (1.3, 1.7) migrate cleanly. Update `documentation/BACKUP_SCHEMA.md` and `LOCAL_STORAGE_KEYS.md`.
- [ ] **2.5 Handle removed and renamed products** – Add a `replacedBy` field so that a discontinued model id in a user's saved design maps to its successor, with a notice.
- [ ] **2.6 Handle a full localStorage** – Catch quota errors, which become more likely before 2.1 lands, and show a toast that suggests exporting a backup.

---

## Phase 3 – Catalogue quality & coverage (P0/P1)

Data accuracy is the product. Affiliate revenue depends on coverage and live links.

### 3A. Accuracy
- [ ] **3.1 Fix the known data errors** – *(KI-11, KI-12)*
  - [ ] Replace the Trina `dev.cclcomponents.com` category link with a product URL, or remove it.
  - [ ] Fix `VS-FL-200-M36-E` and `SGM2-180W` efficiency (stated about 22.5% against a calculated 19.2–19.5%).
  - [ ] Check the Viridian `PV16-*` efficiencies (about 0.8 pp high; possibly aperture area rather than module area).
  - [ ] Fix `GBS-Custom-350` (weight 0, price 0, custom product; consider `active: false`).
- [ ] **3.2 Add automated sanity rules** to `verification_scripts/lib/reviewCore.js`, and fail CI on errors:
  - Voc > Vmp and Isc > Imp;
  - |Vmp × Imp − P| / P < 3%;
  - |P / area − efficiency| < 0.6 pp;
  - temperature coefficients within expected ranges (Voc −0.20…−0.35, Isc 0…+0.08, Pmax −0.24…−0.45 %/°C);
  - weight between 5 and 40 kg;
  - controller PV operating current ≤ `maxIsc`, `mpptRangeMax` ≤ `maxV`, and startup voltage ≤ MPPT maximum;
  - no `dev.`, `staging.` or category-page URLs.
- [ ] **3.3 Build a human review programme** – Only 2 of 245 records are `reviewed`. Add `reviewedAt` and `reviewedBy`, and review the top sellers first: the 30 most-viewed panels and all Victron, Renogy, GivEnergy and Solis controllers. Show a "Verified against datasheet" badge in the UI.
  - Target for launch: ≥ 80% of products that have buy links are reviewed.
- [ ] **3.4 Archive datasheets** – Store a hash, or an archived copy, of each datasheet PDF, so spec disputes can be resolved and silent manufacturer revisions detected.
- [ ] **3.5 Replace AI notes where possible** – Rewrite the design notes for reviewed series, or mark AI notes clearly in the UI. The README already says they are AI-derived.

### 3B. Coverage (driven by affiliate availability and search demand)
- [ ] **3.6 Add off-grid and leisure products**, where the affiliate conversion is highest:
  - Victron SmartSolar small units (75/10 … 100/50), the Orion-Tr Smart DC-DC range and the Victron BlueSolar range;
  - Renogy Rover/Wanderer, EPEver Tracer and Votronic (vans).
- [ ] **3.7 Add small, portable and flexible panels** – 100–200 W rigid and flexible panels for vans, boats and campers (Renogy, Victron, Photonic Universe, Sunbeam). This probably needs a "small panel" form factor with no GSE.
- [ ] **3.8 Add batteries (catalogue v2)** – Add a battery category (Pylontech, Fogstar, GivEnergy, Victron, EcoFlow) with voltage and capacity. This lets the Summary propose a complete kit and multiplies the affiliate basket.
- [ ] **3.9 Add balance-of-system items** – Add MC4 connectors, PV cable, isolators, fuses and mounting as optional BoM line items with default quantities. The README currently says "harnesses and mounting are on you", which is lost revenue.
- [ ] **3.10 Add all-in-one kits and portable power stations** – EcoFlow, Anker, Jackery and Bluetti. These are high-ticket items with generous affiliate programmes, and they suit "simple mode" (7.2).
- [ ] **3.11 Add missing mainstream inverters** – Sunsynk, Growatt, Lux Power, SolarEdge, Fronius, SMA, Sigenergy, Tesla Powerwall 3 and the Hypontech micro.
- [ ] **3.12 Keep the catalogue fresh** – Run a scheduled GitHub Action weekly: the pricing scan plus a link check, which opens a PR with the diff (needs a `SERPER_API_KEY` repository secret). Dead links and price moves above 15% show up in the PR body.

---

## Phase 4 – Affiliate infrastructure (P1)

Currently 0 of 122 links are affiliate links, and 178 products have no link at all.

### 4A. Programmes
- [ ] **4.1 Apply to affiliate programmes** and record the status in the table below. Networks to check: Awin, CJ, Impact, Webgains, Amazon Associates UK, and direct/in-house schemes.

  | Retailer / brand | Network | Applied | Approved | Commission | Cookie | Notes |
  | ---------------- | ------- | ------- | -------- | ---------- | ------ | ----- |
  | Amazon UK | Associates | | | | 24 h | Strict price-display rules (see 6.4) |
  | Bimble Solar | ? | | | | | Off-grid specialist |
  | Midsummer Energy | ? | | | | | |
  | Tradesparky | ? | | | | | |
  | City Plumbing | ? | | | | | |
  | Segen / CCL / Waxman | trade | | | | | Trade only; possibly not affiliate-able |
  | Voltacon | ? | | | | | |
  | Renogy UK | ? | | | | | |
  | EcoFlow / Anker / Jackery | Awin / Impact | | | | | High ticket |
  | Victron (via retailers) | – | | | | | Victron has no direct sales |

- [ ] **4.2 Choose a retailer strategy** – Decide the order in which buy options appear: best price, affiliate first, or a mix. Record it in the Decision log. **Recommendation:** show the cheapest option honestly, and mark which links earn commission. Trust drives long-term revenue.

### 4B. Data model and tooling
- [ ] **4.3 Split link fields** – Extend `buyLinks[]` entries to `{ supplier, url (canonical), affiliateUrl?, network?, isAffiliate, price?, priceCheckedAt?, inStock?, checked }`. Keep the canonical URL for scanning and use `affiliateUrl` for clicks.
- [ ] **4.4 Keep affiliate tags safe from the scanner** – `stripTrackingParams` and `upsertBuyLinkByDomain` (`verification_scripts/lib/buyLinks.js`) must never overwrite an `affiliateUrl`, or drop an existing affiliate entry in favour of a non-affiliate one from the same domain. Add tests.
- [ ] **4.5 Build link rewrite rules** – Add a config file (e.g. `src/data/affiliates.json`) mapping a domain to its affiliate URL template, such as an Awin deeplink (`https://www.awin1.com/cread.php?awinmid=X&awinaffid=Y&ued={url}`) or an Amazon `?tag=`. Links are then generated at build time rather than stored by hand in 245 records.
- [ ] **4.6 Show a price per retailer** – Store the price for each retailer, and sort the BuyButton dropdown by price with the supplier name and "checked" date.
- [ ] **4.7 Fill the missing links** – Run the pricing scan for the 178 products without links, and prioritise those that have an affiliate-capable retailer.

### 4C. UX for conversion
- [ ] **4.8 Improve the buy button** – Replace the 28 px cart icon with a labelled "Buy from £X" button in the panel and controller tables and the info modals. Use a dropdown for multiple retailers that shows the price and a stock badge.
- [ ] **4.9 Add a "Buy this system" section** on the Summary: a per-retailer basket view ("Get everything from Bimble: £X, 6 of 7 items") plus individual links, with export to CSV/PDF.
- [ ] **4.10 Route clicks through `/go/` redirects** – Links point to `/go/<productId>/<retailer>`, which 302s to the affiliate URL. This centralises tag management, allows swapping networks, and gives click counts. It needs an edge host (see 5.1).
- [ ] **4.11 Check affiliate link health** – Run a weekly job that confirms affiliate redirects resolve to a product page, not a 404 or homepage bounce.
- [ ] **4.12 Label affiliate links** – Replace the `*` marker with a clear "Affiliate link" label or tooltip, and link to the disclosure page (6.2).
- [ ] **4.13 Add optional alternative revenue** – A "Get installer quotes" lead form for non-DIY users, sold to lead-generation partners; the UK has several MCS-installer lead marketplaces. A "Support the project" (Ko-fi) link is another option. These are higher revenue per user than product affiliate links.

---

## Phase 5 – Hosting, routing & SEO (P1)

The app is currently a single URL with no indexable content. Search is the main free acquisition channel for a tool like this.

### 5A. Hosting and domain
- [ ] **5.1 Choose a host** – Move to Cloudflare Pages or Netlify, which give redirects/functions for `/go/`, headers, preview deploys per PR and edge analytics. Alternatively stay on GitHub Pages and use a Cloudflare Worker just for `/go/`. Record the choice in the Decision log.
- [ ] **5.2 Custom domain** – The site is already live at `solarpear.echook.uk` (a GitHub Pages CNAME). Decide whether a standalone brand domain (e.g. `solarpear.co.uk`) is worth it for trust and SEO before launch. If so, set up HTTPS, a redirect from the old domain, and a `www` redirect.
- [ ] **5.3 Security headers** – Add a CSP, `Referrer-Policy: strict-origin-when-cross-origin` (affiliate networks sometimes need a referrer; check each one), and HSTS.

### 5B. Routing and pages
- [ ] **5.4 Add a router** – Introduce React Router, or TanStack Router, with real URLs: `/`, `/design`, `/design/:arrayId/(layout|panels|controllers)`, `/summary`, `/panels`, `/panels/:manufacturer/:series/:model`, `/controllers/:id`, `/guides/:slug`. Keep the existing tab state in sync with the URL, and make the back button work.
- [ ] **5.5 Pre-render static pages** – Pre-render every product, series, manufacturer and guide page at build time (vite-ssg, vite-plugin-ssr, or migrate to Astro with React islands). Each page needs a unique `<title>` and meta description, specs, compatible controllers or panels, price and buy buttons, and a "Design with this panel" call to action.
  - Acceptance: `curl` on a product URL returns full HTML content without JavaScript.
- [ ] **5.6 Comparison pages** – Generate `/compare/<a>-vs-<b>` pages for popular pairs (same wattage class across brands). These have high search intent and high affiliate conversion.
- [ ] **5.7 Compatibility pages** – Generate "Which MPPT for N × panel X?" pages from the engine, e.g. `/panels/<model>/compatible-controllers?battery=12`. These are long-tail SEO pages that the unique calculation engine can produce at scale.

### 5C. On-page SEO
- [ ] **5.8 Head tags** – Replace the generic "Find the best solar solution for your needs." meta description in `index.html`. Add Open Graph and Twitter cards, a social preview image, a canonical URL and a theme colour. *(KI-16)*
- [ ] **5.9 Structured data** – Add schema.org `Product` and `Offer` data (price, currency, availability, brand) on product pages, `FAQPage` on guides, and `BreadcrumbList`.
- [ ] **5.10 Sitemap and robots** – Generate `sitemap.xml` at build time from the catalogue and add `robots.txt`. Submit both to Google Search Console and Bing Webmaster Tools.
- [ ] **5.11 Content hub** – Turn `Guide.jsx`, `PanelsGuideView.jsx` and `ControllersGuideView.jsx` into indexable articles, and add evergreen articles:
  - "How to size an MPPT controller";
  - "Cold Voc explained";
  - "In-roof vs on-roof";
  - "G98 vs G99";
  - "Best panels for GSE in-roof 2026";
  - "Van solar setup guide".
- [ ] **5.12 Core Web Vitals** – Get Lighthouse at 90 or above on mobile for product and guide pages (depends on 9.1 and 9.2).
- [ ] **5.13 Shareable design links** – Encode a design into the URL (compressed JSON with lz-string, or a short id if a backend is added). The shared view is read-only with a "Copy to my designs" button. Forum sharing is a major growth loop.

---

## Phase 6 – Trust, legal & compliance (P0 before launch)

- [ ] **6.1 Disclaimer** – Show a persistent footer and first-run notice: the app is a component-compatibility aid, not an installation design; the user must follow the datasheets, BS 7671 and the manufacturer's instructions; a grid connection needs a G98/G99 notification by a competent person (MCS for SEG).
- [ ] **6.2 Affiliate disclosure** – A clear disclosure near the buy buttons and on a dedicated page, per ASA CAP Code and CMA guidance. Include the Amazon Associates wording if Amazon is used: "As an Amazon Associate I earn from qualifying purchases."
- [ ] **6.3 Privacy policy and cookies** – Required once analytics or affiliate cookies are involved (UK GDPR and PECR). Prefer cookieless analytics (8.1) to avoid a consent banner. Affiliate network cookies are set on the retailer's side, but still disclose them.
- [ ] **6.4 Amazon price rules** – Amazon's Operating Agreement restricts showing Amazon prices unless they come from the Product Advertising API and are refreshed within 24 hours. Either use the PA-API or show no Amazon price, just a "Check price on Amazon" link.
- [ ] **6.5 Methodology page** – Publish a public "How we check compatibility" page covering every rule, temperature assumption and severity, generated from, or kept in sync with, `domain-rules.md`. This is key for credibility with the expert forum audience.
- [ ] **6.6 Data sources and corrections** – Show a datasheet link on every spec view, a "Report a data error" link (GitHub issue template or form), and a public changelog of data corrections (the empty `changelogs/` folder could hold it).
- [ ] **6.7 Pricing and editorial independence statement** – Explain how prices are collected, how often, and that rankings are not influenced by commission, which should be true by design (4.2).
- [ ] **6.8 Licence strategy review** – The code is GPL-3.0, so anyone can fork and re-host it with their own affiliate tags. Options:
  - keep the GPL and compete on brand and data freshness;
  - license the **catalogue data** separately (e.g. CC BY-NC or proprietary) and treat it as the moat;
  - relicense, which is possible only if you hold copyright on all the code.

  Record the choice in the Decision log.
- [ ] **6.9 Trademark check** – Check that "Solar Pear" is clear to use in the UK and EU (UK IPO search), and consider registering it once there is traction.
- [ ] **6.10 Terms of use** – Add a limitation-of-liability clause. Consider product liability for electrical advice, and get a professional review if revenue becomes material.
- [ ] **6.11 Accessibility** – Aim for WCAG 2.2 AA: keyboard navigation of tables and modals, colour contrast on status pills, and screen-reader labels on the icon-only buttons (BuyButton).

---

## Phase 7 – Product & UX improvements (P1/P2)

- [ ] **7.1 Onboarding redesign** – Start from a "What are you building?" chooser: house roof (grid-tied), house with battery (hybrid), off-grid cabin, van/boat/leisure, or balcony/plug-in. Each preset sets the system type, voltage and sensible filters.
- [ ] **7.2 Simple mode, or kit recommender** – Ask three to five questions (space available, battery voltage, budget, use case) and return 3 recommended complete kits (good, better, best) with buy buttons. This is the highest-converting flow for non-experts. Advanced users keep the current designer.
- [ ] **7.3 Yield estimate** – Estimate annual kWh per array from orientation, tilt and location. PVGIS has a free API, or bundle a simplified model. Show a payback estimate (with the SEG rate and electricity price as inputs), £/kWh over 25 years, and CO₂ saved. Users care about savings far more than Voc.
- [ ] **7.4 Shading and clipping visualisation** – Extend `ArrayOverviewGraphs.jsx` to show the daily clipping expected from overpanelling (1.5) and micro AC limits (1.7).
- [ ] **7.5 Explain each warning** – Every warning and error gets a "Why?" expander with a short explanation, a link to the methodology section, and a suggested fix, e.g. "Try 2 strings of 5 instead of 1 of 10" or "Try the 150/35 instead".
- [ ] **7.6 Auto-suggest fixes** – When a combination fails, propose the nearest working alternatives: a different wiring (the `bestParallelStringsForController` logic already exists), the next controller up, or fewer panels.
- [ ] **7.7 Mobile experience** – Audit the mobile layout after the `cursor/mobile-*` merges. The planner canvas needs touch support, and the tables need a card view on narrow screens.
- [ ] **7.8 Printable and exportable BoM** – PDF and CSV export of the summary and BoM with wiring notes, for taking to an electrician or retailer.
- [ ] **7.9 Wiring diagram (basic)** – Generate a single-line schematic per array (panels → string → isolator → MPPT port). This adds perceived value and differentiates the product.
- [ ] **7.10 Favourites and comparison tray** – Pin panels or controllers, and compare them side by side.
- [ ] **7.11 Optional cloud save** – Store designs server-side via magic link or passkey. This depends on a backend decision and is also a route to email capture (12.5).
- [ ] **7.12 Balcony and plug-in solar** – Add a mode for the growing plug-in solar market (legal in Germany, with UK regulations evolving): 800 W micro, 2 panels. It's an easy, high-volume product category.
- [ ] **7.13 Price-drop alerts** – "Notify me when this panel drops below £X", which drives email capture and return visits.
- [ ] **7.14 Dark mode** – Using the Tailwind v4 theme tokens.
- [ ] **7.15 Empty and error states** – Review every view for helpful empty states, following the patterns described in the README.

---

## Phase 8 – Analytics & measurement (P1)

- [ ] **8.1 Privacy-friendly analytics** – Plausible, Umami (self-host) or Cloudflare Web Analytics. These are cookieless, so no consent banner is needed.
- [ ] **8.2 Funnel events** – Track the funnel: `design_started` → `array_created` → `panel_selected` → `controller_selected` → `summary_viewed` → `buy_click` (with product, retailer and affiliate flag) and `backup_exported`.
- [ ] **8.3 Click reporting** – Log `/go/` redirect clicks at the edge (4.10) and reconcile them monthly against network-reported conversions.
- [ ] **8.4 Revenue dashboard** – A monthly spreadsheet or dashboard: sessions, buy clicks, CTR, network conversions, EPC (earnings per click) by retailer, and revenue per 1,000 sessions.
- [ ] **8.5 Search Console tracking** – Monitor the queries driving traffic, and use them to prioritise catalogue additions (3.6–3.11) and content (5.11).
- [ ] **8.6 Error monitoring** – Sentry (free tier) or equivalent for front-end exceptions, especially localStorage migration failures.
- [ ] **8.7 Collect feedback** – Add an in-app "Was this helpful? / Something wrong?" widget.

---

## Phase 9 – Engineering, performance & CI (P1/P2)

- [ ] **9.1 Split the catalogue out of the bundle** – It is currently inlined into one 870 kB JavaScript chunk. Load it as separate hashed JSON (`fetch`), or per-manufacturer chunks, and lazy-load the planner and guide views.
  - Acceptance: initial JS under 250 kB gzipped, with no Vite chunk warning.
- [ ] **9.2 Code-split the large components** – `ArrayPlanner.jsx` (~2,000 lines) and `AppStateContext.jsx` (~1,000 lines). Split the context into catalogue, design and UI slices, or move it to Zustand, to reduce re-renders and improve maintainability.
- [ ] **9.3 CI on pull requests** – `deploy.yml` only runs on pushes to `main`. Add a `pull_request` workflow for tests, the build and the data sanity checks (3.2), plus preview deploys (5.1).
- [ ] **9.4 Separate test projects** – Split Vitest into projects: `app` (jsdom), `data-admin` and `scripts` (node). The scripts don't need jsdom, which dominates the 40 s run.
- [ ] **9.5 Add TypeScript, or JSDoc type-checking** – At least for `src/lib/*` and the data schemas (generate types from `data-admin/schema/*.schema.json`). Catalogue shape errors are the main source of bugs.
- [ ] **9.6 Golden test fixtures** – Hand-verified reference designs, e.g. "Victron 100/30, 12 V, 2 × 400 W in series, −10 °C ⇒ cold Voc 81.3 V, OK", covering each controller type. Every calculation change is checked against them.
- [ ] **9.7 End-to-end tests** – Playwright smoke tests: create an array, pick a panel, pick a controller, check the summary, click buy (which should go to `/go/`).
- [ ] **9.8 Dependency hygiene** – Add Renovate or Dependabot and `npm audit` in CI, and pin the Node version via `.nvmrc`.
- [ ] **9.9 Harden data-admin** – Make `DATA_ADMIN_TOKEN` mandatory, and document that it must never be deployed publicly.
- [ ] **9.10 Error boundaries** – Wrap each view in a React error boundary so that one broken record can't blank the whole app.
- [ ] **9.11 Offline and PWA** – Add an installable PWA with the catalogue cached. This is useful on site, in vans, and in places with poor signal.

---

## Phase 10 – Internationalisation (P2)

Only start once UK product-market fit and revenue are proven.

- [ ] **10.1 Region model** – Replace `availableUK` with a per-region availability and price map, e.g. `regions: { UK: {...}, IE: {...}, DE: {...}, US: {...} }`.
- [ ] **10.2 Currency and formatting** – Replace the hard-coded `£` throughout the views with `Intl.NumberFormat` for the selected region.
- [ ] **10.3 Regional compliance flags** – Generalise `g98_cert`/`g99_cert`/`g100_cert` into a per-region certification list (VDE-AR-N 4105, UL 1741, AS 4777, etc.).
- [ ] **10.4 Regional design temperatures** – Use a climate lookup by location (1.11), e.g. ASHRAE extreme minimum, or record lows from an open dataset.
- [ ] **10.5 Regional retailers and affiliates** – Per-region affiliate networks, e.g. Amazon.de/.com and US solar retailers (Signature Solar, altE, Renogy US).
- [ ] **10.6 US electrical rules** – Treat NEC 690 as a regional rule set in the engine (1.25 × 1.25 Isc factor, 600 V residential limit on older setups).
- [ ] **10.7 Units** – Offer metric and imperial display for panel dimensions and weight.
- [ ] **10.8 UI translation** – i18n framework (react-i18next) for German, Dutch and others, if EU markets are pursued.

---

## Phase 11 – Launch (P1)

### Pre-launch checklist
- [ ] **11.1 Milestone M1 complete** – phases 0–2, the P0 items of phase 3, and phase 6.
- [ ] **11.2 Milestone M2 complete** – phases 4, 5 and 8 are functional in production.
- [ ] **11.3 Beta group** – Recruit 10–20 users from UK DIY solar communities (Reddit r/SolarUK and r/vandwellers UK, the Navitron forum, DIY Solar Power forum, the Victron Community, Facebook UK solar groups). Collect feedback and fix the top issues.
- [ ] **11.4 Expert review** – Ask 1–2 qualified installers or electrical engineers to review the methodology page and a sample of results. Quote them, with permission, as social proof.
- [ ] **11.5 Launch assets** – Landing-page hero, a 60-second demo video or GIF, screenshots, a one-paragraph pitch, and an FAQ.

### Launch
- [ ] **11.6 Soft launch** – Post in 2–3 communities, respecting each one's self-promotion rules; lead with the free tool and disclose the affiliate links.
- [ ] **11.7 Show HN, Product Hunt and a launch blog post** – "I built a solar compatibility checker because spreadsheets were killing me."
- [ ] **11.8 Outreach** – Contact UK solar YouTubers and bloggers for review or embed opportunities (see 12.3).
- [ ] **11.9 Launch monitoring** – Watch error rates, analytics funnels and affiliate dashboards daily for 2 weeks.
- [ ] **11.10 Retrospective** – Two weeks after launch, record the learnings and re-prioritise this roadmap.

---

## Phase 12 – Growth & ongoing operations (P2)

### Growth
- [ ] **12.1 Content calendar** – Two articles a month targeting Search Console opportunities (8.5), e.g. seasonal "best panels 2027" updates and new-product reviews.
- [ ] **12.2 Embeddable widget** – A "compatibility checker" iframe or script for bloggers and retailers to embed, keeping your affiliate links (or offered white-label to retailers for a fee).
- [ ] **12.3 Creator partnerships** – Pre-built designs for popular YouTuber setups ("Build what X built"), shared via 5.13.
- [ ] **12.4 Retailer partnerships** – Once traffic is proven, negotiate higher commission tiers, sponsored (clearly labelled) placement, or data feeds for live prices and stock.
- [ ] **12.5 Email list** – Newsletter sign-up for price alerts (7.13), new guides and seasonal deals. This is an owned channel that doesn't depend on Google.
- [ ] **12.6 Referral and share incentives** – "Share your design" cards with an OG image generated per design.
- [ ] **12.7 Premium tier (optional)** – For installers: branded PDF quotes, unlimited cloud designs, and a client hand-off. A subscription diversifies revenue away from affiliates.

### Operations (recurring; don't tick, just track the last run)
- [ ] **12.8 Weekly** – Check the pricing/link-scan PR (3.12); review error monitoring. *Last run: —*
- [ ] **12.9 Monthly** – Revenue report (8.4); affiliate link health (4.11); review user-reported data errors (6.6). *Last run: —*
- [ ] **12.10 Quarterly** – Add new product releases from the main manufacturers; refresh the "best of" content; dependency upgrades. *Last run: —*
- [ ] **12.11 Yearly** – Legal page review; affiliate programme terms review; trademark and domain renewals. *Last run: —*
- [ ] **12.12 Keep the memory bank current** – Update the `memory-bank/` files after each phase completes.

---

## Decision log

Record direction-changing decisions here, newest first.

| Date | ID | Decision | Rationale | Related tasks |
| ---- | -- | -------- | --------- | ------------- |
| 2026-09-25 | D1 | Isc above a controller's max PV short-circuit rating is an **error**, reversing 5507f6a. Controllers can opt out with `iscSelfLimiting` | Victron and other manufacturers treat max PV Isc as a hardware limit; clipping (Imp over operating current) stays a warning | 1.4, KI-5, KI-20 |
| 2026-09-25 | D0 | Roadmap created from the full project review | Baseline for launch and monetisation planning | all |
| | D2 | *Pending:* Hosting platform (Cloudflare Pages / Netlify / GitHub Pages + Worker) | | 5.1, 4.10 |
| | D3 | *Pending:* Retailer ordering policy (cheapest-first vs affiliate-first) | | 4.2, 6.7 |
| | D4 | *Pending:* Licence strategy for code vs catalogue data | | 6.8 |
| | D5 | *Pending:* Stay a Vite SPA with pre-rendering vs migrate to Astro/Next | | 5.5 |
| | D6 | *Pending:* UK-only vs multi-region at launch | | Phase 10 |

---

## Ideas backlog (unprioritised)

Park ideas here, then promote them to a phase with an ID when they're committed to.

- A heat-pump and EV-charger load estimate to size the battery and inverter.
- Import a roof outline from satellite imagery or OS MasterMap.
- An API for retailers to push live price and stock.
- A community-submitted "as built" system gallery with real yield data.
- A battery-to-inverter compatibility matrix (CAN/RS485 protocol support).
