---
description: Check each controller JSON for missing data first, then look for that data; fill only gaps. No defaults or assumptions; prices from large suppliers only, not eBay.
---

# Fill Controller Missing Fields

Go through **all** controller JSON files in `src/data/controllers/`. **Operate in two phases: (1) Check each controller JSON for missing data first**—identify which fields are missing or blank and where price is 0; **(2) Then look for that data**—only after you know what's missing, fetch datasheet URLs or search and fill those specific gaps. Do not look for data first and then check if it's missing. **Do not verify or change any existing data**—only add values where a field is missing or price is 0. For price, use large suppliers only; **do not use prices from eBay**. If data cannot be found, leave the field blank (no defaults or assumptions). Do not modify the `reviewed` field. Persist changes to the JSON files.

**Rules:** Check for missing data first; only then look for that data. Do not fetch or search until you have a list of what's missing. All filled data must come from **fetched** pages only (no search snippets). For price, large supplier sites only; **never eBay**. Do not invent data.

### Steps

0. **.gitignore:** At the start, comment out `*.log` in `.gitignore` (e.g. `*.log` → `# *.log`).

1. **Schema:** Read `src/data/controllers/SCHEMA.md`. List all `*.json` in `src/data/controllers/`.

2. **Phase 1 – Check for missing data (no fetching yet):** For each JSON file, iterate every controller object. For each object, compare to schema and **record only what is missing**: list which fields are missing or blank, and whether `price === 0` (or missing). Build a clear list of gaps (e.g. file X, id Y: missing notes; price 0). Do not fetch any URLs or look up any data in this phase.

3. **Phase 2 – Then look for that data:** For each file/object that has at least one gap from Phase 1, **now** look for the missing data:
   - **Fill from datasheet URL:** If the entry's `datasheetUrl` is non-empty, fetch it. Extract from the fetched page **only** the values for the fields you identified as missing and/or price (if price was 0). Update the object with those values only. If filling `id` or `modelNumber`, use the **manufacturer's model/order code**, not a supplier's product code or SKU. Do not change `reviewed`.
   - **Look further if still missing:** If a missing field (or price) was not on the datasheet page, search to find other URLs (manufacturer/supplier), **fetch** them, and extract only the values for the missing fields. Do not overwrite existing non-empty data.
   - **Price (special case):** For price, use **large suppliers** only (e.g. Midsummer, Segen, Krannich). **Do not use prices from eBay.** If no large-supplier price found, leave price as 0.
   - **If data cannot be found:** Leave the field blank (empty value for type: `""`, `0`, `false`, `[]`, `{}`); no defaults or assumptions.

4. **Persist:** Write updated JSON back to each modified file. Optionally log changes per file (e.g. `.<manufacturer>.log`: date, controller id, field, old → new, source URL if used).

5. **Report:** Summarize how many files/controllers were updated, which fields were filled, and how many had no usable source for price/missing data.

6. **Restore .gitignore:** Last thing before finishing, uncomment `*.log` in `.gitignore`.

## Rules (short)
- **Check first, then look:** Check each controller JSON for missing data; build a list of gaps. **Then** look for that data (fetch/search). Do not look for data first and then check if it's missing.
- **Fill only gaps:** Add data only for the missing fields and price when 0. **Do not verify or change existing data.** **Don't modify `reviewed`.**
- **Price:** Large suppliers only; **not eBay.** Leave 0 if no suitable source. If data cannot be found, leave field blank—no defaults or assumptions.
