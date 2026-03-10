---
description: Verify controller JSON against SCHEMA.md using the manufacturer's datasheet (PDF or, if unavailable, manufacturer website); data must come from that fetched page only.
---

# Solar Controller Verification Workflow

Verify all controller JSON files in `src/data/controllers/` against the **manufacturer's datasheet** (or, if a PDF isn’t available, data from the manufacturer’s website is acceptable). Single source: find the PDF or the manufacturer’s product/spec page (from manufacturer or supplier), **fetch** it, and ensure all JSON data comes **only** from that fetched document. Never use search snippets or AI overviews as data—search only to find the URL, then open and read it. First try existing `datasheetUrl`; if it works and has the data, use it and skip search. Persist all new controllers to the `.json` file; set every `datasheetUrl` to the **exact** URL you visited. If you find further solar controllers during search (same manufacturer), add them. If there is a family of inverters or controllers, add **each one** in the family. No datasheet found ⇒ delete entry and log. Do not modify `reviewed`.

**Prerequisites:** `src/data/controllers/`, `SCHEMA.md`, browser/fetch. Backup before running.

### 0. .gitignore
- **Start:** Comment out `*.log` in `.gitignore` (e.g. `# *.log`) so logs in `src/data/controllers/` can be written.
- **End:** Uncomment to restore.

### 1. Schema
- Read `SCHEMA.md`. Sync JSON: add new schema fields (defaults), remove removed/extra fields. List all `*.json` in `src/data/controllers/`.

### 2. Per-file audit
For each JSON file:

1. **Iterate** each controller (stable order). **Schema check:** all fields present, types match.
2. **First:** Fetch existing `datasheetUrl` (if set). If it loads (no 404/redirect) and has this model + required specs, use it as sole source and skip to step 6.
3. **Links:** Visit `datasheetUrl` and every `buyLinks` URL. 404 or redirect to home/generic ⇒ remove from JSON and log. Never add a URL you haven’t fetched successfully.
4. **Find datasheet** (if step 2 didn’t suffice): Search for manufacturer’s PDF or product/spec page (manufacturer or supplier). If no PDF is available, the manufacturer’s website (product/spec page) is acceptable. Fetch candidate URL; do not use search result text as data. If no working source (PDF or manufacturer page) or model not in it ⇒ delete entry, log "DELETED - no datasheet found", and continue.
5. **From datasheet or manufacturer page only:** Cross-check JSON against fetched doc or page (maxV, maxIsc, maxOperatingI, MPPT range, systemVoltages, MaxACPower/MaxDCPower, type, certs, etc.). Use full `id`/`modelNumber` (no prefix-only). If the source lists multiple variants (e.g. 75/10, 75/15) or a **family of inverters/controllers**, add **each one**. If you discover further solar controllers for the same manufacturer during search, add them too. Set each `datasheetUrl` to exact URL fetched; **append new controllers to the `.json` file**; don’t change `reviewed`. Log additions.
6. **datasheetUrl = exact URL** you opened for this controller’s data. If none, `""`. Update JSON.
7. **Before reporting:** Confirm every new controller is in the `.json`; every `datasheetUrl` is the exact URL you used.

### 3. Logging
Per manufacturer file: create/update `.<manufacturer>.log` in same dir. Each entry: date, controller `id`, field (or DELETED/ADDED), old/new value, reason, resource URL.

### 4. Reporting
Summarize changes; confirm new controllers in JSON and exact `datasheetUrl`s; primary source URL; mention new/updated `.log`.

### 5. Restore .gitignore
Uncomment `*.log`.

## Rules (short)
- **Single source:** Manufacturer’s PDF datasheet or, if not available, manufacturer’s website (product/spec page); from manufacturer or supplier. Fetch it; all data from that only. No search-result text.
- **Existing datasheetUrl first;** then search only to find URL.
- **Exact URL** in `datasheetUrl`; no 404/redirect links.
- **Persist** new controllers to JSON; full `id`/`modelNumber`; add all variants on datasheet; add any further controllers found in search; for a family of inverters/controllers, add each one.
- **No datasheet ⇒ delete** and log. **Don’t modify `reviewed`.**
