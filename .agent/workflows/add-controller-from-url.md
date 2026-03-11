---
description: Add controller(s) to the dataset from a single URL (website or datasheet). All data from that URL only; add every device found on the page or in the datasheet.
---

# Add Controller(s) from URL

Use this workflow **with a URL** provided by the user (website or datasheet). Add the controller(s) (charge controllers, inverters, etc.) described at that URL to `src/data/controllers/`, creating a new manufacturer file if needed. **All data must come only from the linked URL**—fetch it and read the content; do not use search or other sources. If the page or datasheet lists **multiple controllers or a family of inverters**, add **each one**.

**Input:** User supplies one URL (e.g. manufacturer product page, PDF datasheet, or supplier page that shows the same specs).

**Rules:** Fetch the URL with the browser/fetch tool. If it returns 404 or redirects to a generic/home page with no product content, stop and report. Otherwise extract every controller’s data from the fetched content only. Set each controller’s `datasheetUrl` to the **exact** URL you opened (final URL if redirected). When you find product pages (supplier/shop where the controller can be bought), add them to `buyLinks`: supplier name as key, product page URL as value (e.g. `buyLinks: { "Midsummer": "https://..." }`); only URLs you have fetched for this product. Use `src/data/controllers/SCHEMA.md` for required fields; fill from the page only. **If data cannot be found, leave the field blank** (use empty value for that type: `""`, `0`, `false`, `[]`, `{}` as applicable); do not use defaults or assumptions to infer or invent content. The `id` and `modelNumber` fields must be the **manufacturer's model/order code** (from the manufacturer's datasheet or product spec), not a supplier's product code or SKU; `id` must be unique across all controller files. Do not set or change `reviewed` (leave as `false` for new entries if the schema requires it).

### Steps

1. **Get the URL** from the user (they run this workflow alongside a URL). **Fetch** it; confirm it loads and shows product/datasheet content (not 404, not redirect to home). If not, report and stop.

2. **Read** `src/data/controllers/SCHEMA.md`. From the **fetched** page or PDF, identify:
   - Manufacturer name (for filename and `manufacturer` field).
   - Every controller/inverter model listed (single product, comparison table, or “models in this range”). For **each** model: extract schema fields from the page only. **Use the manufacturer's model/order code** for `id` and `modelNumber` (e.g. from datasheet or manufacturer spec on the page), not a supplier's product code or SKU. If data cannot be found for a field, leave it blank; do not use defaults or assumptions.

3. **Filename:** Lowercase, hyphenated from manufacturer (e.g. `Victron Energy` → `victron-energy.json`, `Solax Power` → `solax-power.json`). If `src/data/controllers/<filename>.json` does not exist, **create** it with a JSON array containing the new controller(s). If it exists, **append** the new controller(s) to the array. Skip any controller whose `id` already exists in that file (no duplicates).

4. **Each controller object:** Include every field from the schema. Set `datasheetUrl` to the exact URL you fetched. **Buy links:** If the page (or linked pages you fetch) shows product pages where this controller can be bought, add them to `buyLinks` as an object: key = supplier/site name (e.g. `"Midsummer"`), value = product page URL. Only add URLs you have fetched for this specific model. Ensure `id` and `modelNumber` are the manufacturer's model/order code, not a supplier's; `id` unique (slug from manufacturer model if needed). Use `type` and `systemType` only if stated on the page; if not found, leave blank. Do not assume or default other fields. Do not modify `reviewed` when adding.

5. **Persistence:** Write the JSON file(s) to disk. Optionally create or update a `.<manufacturer>.log` in the same directory (e.g. date, controller id, ADDED, source URL).

6. **Report:** Summarize what was added (manufacturer, file, model(s)/id(s)), the source URL, and whether a new manufacturer file was created.

## Rules (short)
- **Single source:** All data from the **provided URL only**. Fetch it; no search, no other pages.
- **Multiple devices:** If the page/datasheet lists multiple controllers or a family of inverters, add **each one**.
- **New manufacturer:** If no `<manufacturer>.json` exists, create it (e.g. `victron-energy.json`).
- **Exact URL** in `datasheetUrl`; full schema; **`id`/`modelNumber` = manufacturer's model**, not supplier's product code; `id` unique across files. **If data cannot be found, leave blank**—no defaults or assumptions. **Buy links:** When you find product pages, add to `buyLinks` (supplier name as key, URL as value). **Don’t modify `reviewed`.**
