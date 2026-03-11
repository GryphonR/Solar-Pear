---
description: Add panel(s) to the dataset from a single URL (website or datasheet). All data from that URL only; add every device found on the page or in the datasheet.
---

# Add Panel(s) from URL

Use this workflow **with a URL** provided by the user (website or datasheet). Add the panel(s) described at that URL to `src/data/panels/`, creating a new manufacturer file if needed. **All data must come only from the linked URL**—fetch it and read the content; do not use search or other sources. If the page or datasheet lists **multiple panels**, add **all of them**. **Ignore multibuy deals** (packs, pallets, multi-panel bundles)—only add individual panel products; do not add listings that are sold as packs or pallets.

**Input:** User supplies one URL (e.g. manufacturer product page, PDF datasheet, or supplier page that shows the same specs).

**Rules:** Fetch the URL with the browser/fetch tool. If it returns 404 or redirects to a generic/home page with no product content, stop and report. Otherwise extract every panel’s data from the fetched content only. Set each panel’s `datasheetUrl` to the **exact** URL you opened (final URL if redirected). When you find product pages (supplier/shop where the panel can be bought), add them to `buyLinks`: supplier name as key, product page URL as value (e.g. `buyLinks: { "Midsummer": "https://..." }`); only URLs you have fetched for this product. Use `src/data/panels/SCHEMA.md` for required fields; fill from the page only. **If data cannot be found, leave the field blank** (use empty value for that type: `""`, `0`, `false`, `{}` as applicable); do not use defaults or assumptions to infer or invent content. The `model` field must be the **manufacturer's model number** (from the manufacturer's datasheet or product spec), not a supplier's product code, SKU, or reseller reference; and must be unique across all panel files.

### Steps

1. **Get the URL** from the user (they run this workflow alongside a URL). **Fetch** it; confirm it loads and shows product/datasheet content (not 404, not redirect to home). If not, report and stop.

2. **Read** `src/data/panels/SCHEMA.md`. From the **fetched** page or PDF, identify:
   - Manufacturer name (for filename and `manufacturer` field).
   - Every panel/model listed (single product, comparison table, or “models in this series”). For **each** panel: extract schema fields from the page only. **Use the manufacturer's model number** for `model` (e.g. from datasheet or manufacturer spec on the page), not a supplier's product code or SKU. If data cannot be found for a field, leave it blank; do not use defaults or assumptions.
   - **Ignore multibuy deals:** Do not add packs, pallets, or multi-panel bundles—only individual panel products.

3. **Filename:** Lowercase, hyphenated from manufacturer (e.g. `Trina` → `trina.json`, `Canadian Solar` → `canadian-solar.json`). If `src/data/panels/<filename>.json` does not exist, **create** it with a JSON array containing the new panel(s). If it exists, **append** the new panel(s) to the array. Skip any panel whose `model` already exists in that file (no duplicates).

4. **Each panel object:** Include every field from the schema. Set `datasheetUrl` to the exact URL you fetched. **Buy links:** If the page (or linked pages you fetch) shows product pages where this panel can be bought, add them to `buyLinks` as an object: key = supplier/site name (e.g. `"Midsummer"`), value = product page URL. Only add URLs you have fetched for this specific model. Ensure `model` is unique (if the same manufacturer file has that model already, skip or deduplicate). Use `active: true` unless otherwise specified.

5. **Persistence:** Write the JSON file(s) to disk. Optionally create or update a `.<manufacturer>.log` in the same directory (e.g. date, model, ADDED, source URL).

6. **Report:** Summarize what was added (manufacturer, file, model(s)), the source URL, and whether a new manufacturer file was created.

## Rules (short)
- **Single source:** All data from the **provided URL only**. Fetch it; no search, no other pages.
- **Multiple panels:** If the page/datasheet lists more than one panel, add **all** of them. **Ignore multibuy deals** (packs, pallets, bundles); add only individual panel products.
- **New manufacturer:** If no `<manufacturer>.json` exists, create it (e.g. `canadian-solar.json`).
- **Exact URL** in `datasheetUrl`; full schema; **`model` = manufacturer's model**, not supplier's product code; `model` unique across files. **If data cannot be found, leave blank**—no defaults or assumptions. **Buy links:** When you find product pages (supplier/shop), add to `buyLinks` with supplier name as key and URL as value.
