---
description: Add panel(s) to the dataset from a single URL (website or datasheet). All data from that URL only; add every device found on the page or in the datasheet.
---

# Add Panel(s) from URL

Use this workflow **with a URL** provided by the user (website or datasheet). Add the panel(s) described at that URL to `src/data/panels/`, creating a new manufacturer file if needed. **All data must come only from the linked URL**—fetch it and read the content; do not use search or other sources. If the page or datasheet lists **multiple panels**, add **all of them**.

**Input:** User supplies one URL (e.g. manufacturer product page, PDF datasheet, or supplier page that shows the same specs).

**Rules:** Fetch the URL with the browser/fetch tool. If it returns 404 or redirects to a generic/home page with no product content, stop and report. Otherwise extract every panel’s data from the fetched content only. Set each panel’s `datasheetUrl` to the **exact** URL you opened (final URL if redirected). Use `src/data/panels/SCHEMA.md` for required fields; fill from the page, use neutral defaults (`0`, `""`, `false`, `{}`) where not specified. The `model` field must be unique across all panel files.

### Steps

1. **Get the URL** from the user (they run this workflow alongside a URL). **Fetch** it; confirm it loads and shows product/datasheet content (not 404, not redirect to home). If not, report and stop.

2. **Read** `src/data/panels/SCHEMA.md`. From the **fetched** page or PDF, identify:
   - Manufacturer name (for filename and `manufacturer` field).
   - Every panel/model listed (single product, comparison table, or “models in this series”). For **each** panel: extract or infer all schema fields from the page only; use defaults where missing.

3. **Filename:** Lowercase, hyphenated from manufacturer (e.g. `Trina` → `trina.json`, `Canadian Solar` → `canadian-solar.json`). If `src/data/panels/<filename>.json` does not exist, **create** it with a JSON array containing the new panel(s). If it exists, **append** the new panel(s) to the array. Skip any panel whose `model` already exists in that file (no duplicates).

4. **Each panel object:** Include every field from the schema. Set `datasheetUrl` to the exact URL you fetched. Ensure `model` is unique (if the same manufacturer file has that model already, skip or deduplicate). Use `active: true` unless otherwise specified.

5. **Persistence:** Write the JSON file(s) to disk. Optionally create or update a `.<manufacturer>.log` in the same directory (e.g. date, model, ADDED, source URL).

6. **Report:** Summarize what was added (manufacturer, file, model(s)), the source URL, and whether a new manufacturer file was created.

## Rules (short)
- **Single source:** All data from the **provided URL only**. Fetch it; no search, no other pages.
- **Multiple panels:** If the page/datasheet lists more than one panel, add **all** of them.
- **New manufacturer:** If no `<manufacturer>.json` exists, create it (e.g. `canadian-solar.json`).
- **Exact URL** in `datasheetUrl`; full schema; `model` unique across files.
