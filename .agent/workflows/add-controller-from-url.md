---
description: Add controller(s) to the dataset from a single URL (website or datasheet). All data from that URL only; add every device found on the page or in the datasheet.
---

# Add Controller(s) from URL

Use this workflow **with a URL** provided by the user (website or datasheet). Add the controller(s) (charge controllers, inverters, etc.) described at that URL to `src/data/controllers/`, creating a new manufacturer file if needed. **All data must come only from the linked URL**—fetch it and read the content; do not use search or other sources. If the page or datasheet lists **multiple controllers or a family of inverters**, add **each one**.

**Input:** User supplies one URL (e.g. manufacturer product page, PDF datasheet, or supplier page that shows the same specs).

**Rules:** Fetch the URL with the browser/fetch tool. If it returns 404 or redirects to a generic/home page with no product content, stop and report. Otherwise extract every controller’s data from the fetched content only. Set each controller’s `datasheetUrl` to the **exact** URL you opened (final URL if redirected). Use `src/data/controllers/SCHEMA.md` for required fields; fill from the page, use neutral defaults (`0`, `""`, `false`, `[]`, `{}`) where not specified. The `id` field must be unique across all controller files. Do not set or change `reviewed` (leave as `false` for new entries if the schema requires it).

### Steps

1. **Get the URL** from the user (they run this workflow alongside a URL). **Fetch** it; confirm it loads and shows product/datasheet content (not 404, not redirect to home). If not, report and stop.

2. **Read** `src/data/controllers/SCHEMA.md`. From the **fetched** page or PDF, identify:
   - Manufacturer name (for filename and `manufacturer` field).
   - Every controller/inverter model listed (single product, comparison table, or “models in this range”). For **each** model: extract or infer all schema fields from the page only; use defaults where missing (e.g. `0` for N/A PV fields on AC-coupled inverters).

3. **Filename:** Lowercase, hyphenated from manufacturer (e.g. `Victron Energy` → `victron-energy.json`, `Solax Power` → `solax-power.json`). If `src/data/controllers/<filename>.json` does not exist, **create** it with a JSON array containing the new controller(s). If it exists, **append** the new controller(s) to the array. Skip any controller whose `id` already exists in that file (no duplicates).

4. **Each controller object:** Include every field from the schema. Set `datasheetUrl` to the exact URL you fetched. Ensure `id` is unique (slug from model name if needed). Use sensible `type` and `systemType` from the page; default booleans (certs, islanding, off_grid, etc.) to `false` if not stated. Do not modify `reviewed` when adding.

5. **Persistence:** Write the JSON file(s) to disk. Optionally create or update a `.<manufacturer>.log` in the same directory (e.g. date, controller id, ADDED, source URL).

6. **Report:** Summarize what was added (manufacturer, file, model(s)/id(s)), the source URL, and whether a new manufacturer file was created.

## Rules (short)
- **Single source:** All data from the **provided URL only**. Fetch it; no search, no other pages.
- **Multiple devices:** If the page/datasheet lists multiple controllers or a family of inverters, add **each one**.
- **New manufacturer:** If no `<manufacturer>.json` exists, create it (e.g. `victron-energy.json`).
- **Exact URL** in `datasheetUrl`; full schema; `id` unique across files. **Don’t modify `reviewed`.**
