---
description: Go through all panel JSONs; fill missing fields and price from datasheetUrl, then look further if needed; prices from large suppliers only, not eBay.
---

# Fill Panel Missing Fields

Go through **all** panel JSON files in `src/data/panels/`. For each panel object, if any schema field is **missing** or the **price** field is **0**, fill it. **Do not verify or change any existing data**—only add values where a field is missing or price is 0; leave all other fields unchanged. Use the entry's `datasheetUrl` first (fetch and extract); if data is not available there, **look further** (e.g. manufacturer product page, supplier spec pages—fetch URLs and use only fetched content, not search snippets). **Price:** Prefer large suppliers (e.g. Midsummer, Segen, Krannich, other major distributors) and **do not use prices from eBay**. Persist changes to the JSON files.

**Rules:** Do not verify or change any existing data—only fill missing fields and price when 0. All filled data must come from **fetched** pages only (no search snippets). If the datasheet URL doesn't have a value, search to find other URLs (manufacturer/supplier), then fetch and read those. For price, use large supplier sites only; **never use eBay** as a price source. Do not invent data.

### Steps

0. **.gitignore:** At the start, comment out `*.log` in `.gitignore` (e.g. `*.log` → `# *.log`).

1. **Schema:** Read `src/data/panels/SCHEMA.md`. List all `*.json` in `src/data/panels/`.

2. **Per file:** For each JSON file, iterate every panel object. For each object:
   - **Detect gaps:** Compare to schema—note any missing fields. Note if `price === 0` (or missing).
   - **Fill from datasheet URL first:** If `datasheetUrl` is non-empty, fetch it. If it loads and shows product/datasheet content, extract values from the fetched page **only for the missing fields and/or price** (when price is 0). Update the object with those values only; do not overwrite or verify existing non-empty data.
   - **Look further if still missing:** If data (or price) is not available on the datasheet page, use search to find other URLs (manufacturer product page, supplier pages). **Fetch** those URLs and extract from the fetched content only (no search snippets). Fill missing fields from the first reliable fetched page that has the value.
   - **Price (special case):** For price, prefer **large suppliers** (e.g. Midsummer, Segen, Krannich, other major solar distributors). **Do not use prices from eBay.** Fetch the supplier product page and use the price from that page only. If no large-supplier price is found, leave price as 0.
   - **Defaults:** For any non-price field still missing after the above, set schema defaults (`0`, `""`, `false`, `{}`). Do not invent data.

3. **Persist:** Write updated JSON back to each modified file. Optionally log changes per file (e.g. `.<manufacturer>.log`: date, model, field, old → new, source URL if used).

4. **Report:** Summarize how many files/panels were updated, which fields were filled, and how many had no usable `datasheetUrl` for price/missing data.

5. **Restore .gitignore:** Last thing before finishing, uncomment `*.log` in `.gitignore`.

## Rules (short)
- **All panel JSONs:** Process every `*.json` in `src/data/panels/`.
- **Fill only gaps:** Add data only for missing fields or when price is 0. **Do not verify or change existing data**; leave all other values unchanged.
- **Price:** Use large suppliers (e.g. Midsummer, Segen, Krannich); **do not use prices from eBay.** Leave 0 if no suitable source.
- **Data source:** Only from fetched pages or schema defaults; do not invent data.
