---
description: Verify panel JSON against SCHEMA.md and fetched pages only (no search snippets/AI summaries); remove hallucinated panels and invalid/404 links.
---

# Solar Panel Verification Workflow

This workflow instructs the agent to perform a rigorous verification of all solar panel data files located in `src/data/panels/`. Accuracy is paramount; do not rely on internal knowledge.

**Data source rule (anti-hallucination):** You may use web search **only to discover URLs** (e.g. to find the manufacturer product page or a reseller link). You must **never** use text from the search results themselves—including Google (or any search engine) result snippets, titles, “AI overviews”, “People also ask” answers, or featured snippets—as a source for panel data. Search result text is not verified and can be wrong or hallucinated. **All** panel data (model name, power, Voc, Vmp, specs, etc.) must come **only** from pages (or PDFs) you have **actually fetched** with the browser/fetch tool and read directly. If you did not open the URL and read the page content yourself, that content is not an allowed source.

**Priorities:** (0) **Fetched page only** — never use search result text (Google snippets, AI overviews, featured snippets) as data; use search only to find URLs, then fetch and read the page. (0a) **Existing `datasheetUrl` first** — for each panel, fetch the existing `datasheetUrl` first; if it works and has all required data, use it as the sole source and do not search further. (0b) **Persist and exact URLs** — write all new panels to the `.json` files (do not only log them), and set every panel’s `datasheetUrl` to the **exact** URL you visited and used for that panel’s data. (1) **Identify and remove hallucinated panels** — any panel whose exact model cannot be found on a page you fetched must be deleted and logged. (2) **No 404 links** — every `datasheetUrl` and every `buyLinks` URL must be visited; any that return 404 or are unreachable must be removed from the JSON and logged. (3) **Full model numbers only** — no prefix-only entries; when the source lists multiple variants (different suffixes or power ratings), use one entry per full model and **add all variants** to the dataset as you find them.

### 0. Before Starting — .gitignore (log file access)
-   **At the start of the workflow**, open `.gitignore` and **comment out** the line that ignores panel log files (e.g. `*.log`). Prepend `# ` so the rule is disabled (e.g. change `*.log` to `# *.log`). This ensures log files in `src/data/panels/` are not ignored and can be created, written, and read during the audit.
-   **At the end of the workflow** (after Reporting, step 3), **uncomment** that line again: remove the `# ` so the ignore rule is restored (e.g. change `# *.log` back to `*.log`). Leave `.gitignore` in its original state when done.

## Prerequisites
-   Access to the `src/data/panels/` directory.
-   Access to `src/data/panels/SCHEMA.md`.
-   Browser and search tools enabled.
-   **Backup**: Ensure the repo has a clean commit or backup before running. Schema drift and deletion are destructive; do not proceed without a restorable state.

## Steps

### 1. Initialize and Validate Schema
-   Read `src/data/panels/SCHEMA.md` to understand the required fields, types, and constraints.
-   **Schema Drift Check**: Compare the required fields in `SCHEMA.md` against the existing structure in the JSON files.
    -   **New fields**: If the schema has added fields, update every panel object across all JSON files (sensible defaults: `0` for numbers, `false` for booleans, `""` for strings, `{}` for `buyLinks`), or derive from live sources during the audit.
    -   **Removed fields**: If a field was removed from the schema, remove that field from every panel object in all JSON files.
    -   **Extra fields**: If a panel object contains a field not listed in `SCHEMA.md`, remove that field so the file conforms to the schema.
-   List all JSON files in `src/data/panels/`.

### 2. Systematic Panel Audit
For each JSON file (e.g., `aiko.json`, `jinko.json`, etc.):

1.  **Iterate** through every panel object in the array (use a stable order, e.g. array index, for reproducible logs).

2.  **Schema Check**:
    -   Verify that every field listed in `SCHEMA.md` is present and that types match (e.g., `number` for `power`, `boolean` for `bifacial`).

3.  **First port of call: existing `datasheetUrl`**:
    -   For each panel, the **first source to use** is the existing `datasheetUrl` (if non-empty). Fetch it with the browser/fetch tool before doing any web search.
    -   If the URL loads successfully (non-404, no redirect to home/generic), and the fetched page contains **this panel’s model** and **all the data required** for verification (key specs: power, Voc, Vmp, Isc, Imp, and other schema fields as available), then **use that page as the sole verification source**—no need to search further. The research is already done; cross-reference the JSON against this page, correct any discrepancies, and move on.
    -   Only if `datasheetUrl` is missing, broken (404 or redirect), or does not contain the required data should you proceed to web search and the full Hallucination Check / Live Verification flow below.

4.  **Link Audit (MANDATORY — no link may remain without a successful, content-valid fetch)**:
    -   **Every URL must be visited.** For each panel, use the browser/fetch tool to open:
        -   `datasheetUrl` (if non-empty),
        -   every URL in `buyLinks` (each key’s value).
    -   **404 or unreachable = remove.** If a URL returns 404, times out, or does not load:
        -   Set `datasheetUrl` to `""` (or remove the key from `buyLinks` for that entry).
        -   Log the removal: date, panel `model`, field (e.g. `datasheetUrl` or `buyLinks.<label>`), old URL, reason: "Removed: URL returned 404 (or unreachable)."
    -   **Redirect to generic/home page = remove.** After fetching, check that the final page is **not** a generic landing page (e.g. site home, “page not found” with 200, or a login wall). If the URL redirects (e.g. 301/302) to the site’s root or a generic page and the content does not contain the panel/datasheet in question, treat the link as **invalid**: remove it from the JSON and log the removal (reason: "Removed: URL redirects to home/generic page; no product/datasheet content.").
    -   **Never add a URL** you have not personally fetched with a successful (non-404) response and confirmed that the final page shows the expected content (datasheet or product page), not a redirect to home or a generic page. Do not assume a URL works from pattern or search snippets; always visit it.

5.  **Hallucination Check (identify panels that do not exist)** — *Skip if the existing `datasheetUrl` already provided all required data (see First port of call above). Otherwise:*
    -   **Search is for finding URLs only.** Using the **exact** `model` string (primary) and, if needed, the `name` string, search the web for the manufacturer + model (e.g. `"Trina" "TSM-430DE09.08"`) to get **candidate URLs**. Do **not** use any text from the search results (snippets, AI summaries, featured snippets) to confirm the model or to read specs—that would be unverified and can be hallucinated. Use search only to decide which links to open.
    -   **Exhaustive search** means at least: (a) one search targeting the manufacturer’s official site or product/datasheet list, (b) two separate searches on tier-one reseller/distributor sites (e.g. Midsummer, Segen, Krannich, or similar) using the exact model. Then **visit** each resulting URL with the browser/fetch tool and verify using **only the content of the fetched page**. If you have not opened a URL and read its content, you have not verified the model.
    -   **If the exact model appears nowhere** on any page you have **actually fetched** (no official page, no tier-one reseller listing with matching model and specs on the opened page), treat the panel as **hallucinated** and apply the Deletion Policy below.
    -   Verification must be against **live page content** (or PDF only if your tools can actually fetch and read the PDF). Do not trust internal knowledge, and **do not trust search result text** (snippets, AI overviews, summaries)—only the body of a page you fetched counts as a source.

5a. **Full model number — prefix vs suffix (no prefix-only entries)**:
    -   Many product lines use a **shared prefix** and **suffixes** to define distinct models (e.g. TSM-430DE09.08, TSM-430DE09.09, TSM-435DE09.08). The `model` field must always be the **full** model/part number as on the datasheet, never only the series or prefix.
    -   **Check whether the current entry is prefix-only.** When you land on a manufacturer or reseller page that lists one product line with **multiple model numbers** (different suffixes, or different power ratings with different part numbers), ask: "Is the dataset entry’s `model` the full identifier, or only a prefix?" If the source shows many variants (e.g. 400W, 415W, 430W, 445W) each with a distinct full model string, a single dataset entry whose `model` is just "TSM-430" or "Vertex S+ 430" (without the full suffix) is **invalid**.
    -   **Correct prefix-only entries:** Replace or remove the prefix-only entry. Create one panel object per **full** model number listed on the source, each with the exact `model` string (including suffix) and the specs for that variant. Do not keep a single "catch-all" entry when the source defines multiple distinct models.

5b. **Adding all variants as you find them**:
    -   When verifying a panel or browsing a manufacturer product/datasheet page, you will often see **multiple variants** of the same series (e.g. same product name, different power: 400W, 415W, 430W, 445W, or different suffixes). **Add all of these variants** to the dataset.
    -   **Where to look:** Product tables, "Models in this series" lists, datasheet comparison pages, and tier-one reseller listings that show the full model number and key specs per variant.
    -   **For each variant to add:** (i) Use the **exact full model number** from the source (including suffix), not a shortened or guessed form. (ii) Fill all schema fields from the source; use sensible defaults only where the source does not specify. (iii) Set `datasheetUrl` to the **exact URL you fetched** and used to get this variant’s data (the precise URL you opened in the browser/fetch tool—see “datasheetUrl = exact URL” below). (iv) Ensure the variant is not already in the file (by matching full `model`).
    -   **You MUST persist new panels to the JSON file.** For each new variant you identify, **edit the manufacturer’s `.json` file** and append the new panel object to the array. Do not only log or list new panels—the `.json` file must be updated on disk. If you add panels in memory or in a log but do not write them to the file, the workflow is incomplete.
    -   **Do not invent variants.** Only add a variant when the live source explicitly lists that full model and at least key specs (e.g. power, Voc, Vmp, Isc, Imp). Log each addition: date, model, "ADDED", reason "Variant found on [URL]; full model and specs from source", and resource link.

6.  **Live Internet Verification (when the model is found)**:
    -   **Identify**: Use `manufacturer` and the **exact** `model` (and `name` only if needed to disambiguate).
    -   **Verify Links**: For any URL you intend to add or keep: **you MUST visit it** with the browser tool. If you get 404, unreachable, or the page redirects to a home/generic page with no product/datasheet content, do not add it; if it is already in the file, remove it (see Link Audit above).
    -   **Cross-Reference**: Prefer the manufacturer’s official product/datasheet page. If unavailable, use at least two tier-one reseller sites that show the same technical data for this exact model. If data is inconsistent or no reliable source lists this exact model, treat as unverifiable and apply the Deletion Policy.
    -   **Detailed Check**: Cross-reference these fields against the actual text/tables on the **fetched** page (or readable PDF you opened)—**not** from search snippets or any AI summary. Use only content you see on the page after fetching its URL: `power`, `voc`, `vmp`, `isc`, `imp`, `tempCoefPmax`, `tempCoefVoc`, `tempCoefIsc`, `efficiency`, `height`, `width`, `depth`, `weight`, `cells`, `glass`, `bifacial`, `maxSeriesFuse`, `maxSystemVoltage`. If a value is not found on the fetched source, leave the existing value unchanged and log: "Field X: not found on source; kept existing value."

7.  **Correction & Safety Guards**:
    -   **Model Alignment**: The `model` field must match the **exact string** on the manufacturer’s datasheet (e.g. full part number). Do not shorten or guess.
    -   **datasheetUrl = exact URL you visited**: For every panel (existing or new), `datasheetUrl` must be the **exact** URL you fetched and used to obtain that panel’s data—the precise address you opened in the browser/fetch tool and from which you read the specs. Do not use a similar URL, the manufacturer home page, or a reconstructed link. If you used a redirected URL, use the final URL that actually served the content. Copy the URL from the response or browser; do not guess or abbreviate. If you did not visit a URL for this panel, set `datasheetUrl` to `""`. Update the JSON so the stored value matches the URL you actually used.
    -   **Datasheet URL (when to set)**: Set or update `datasheetUrl` only after a successful fetch that confirms the page contains this specific model’s data and does not redirect to a home or generic page. If every link you find returns 404 or redirects to non-content, set `datasheetUrl` to `""` and log the attempt; never leave a 404 or redirect-to-home URL in the file.
    -   **Notes**: Update `notes` only with user-helpful information (strengths/weaknesses, sentiment, application advice). If you keep a panel but have doubts (e.g. only one weak source), append to notes: "Unverified: [brief reason]." so it can be manually reviewed later.

8.  **Failure Handling (Deletion Policy — single source of truth)**:
    -   **Delete the panel entry** when: (i) the model cannot be confirmed after the exhaustive search above, or (ii) the exact model has no trace on official or tier-one sites (hallucination), or (iii) the only "sources" are broken links (all 404 or redirect to home/generic with no content).
    -   Do **not** guess or invent data. If in doubt after exhaustive search, **delete** and log; do not leave unverifiable panels in the dataset.
    -   **Log every deletion**: In the manufacturer’s `.log`, add an entry: "DELETED - Model: <model> - Reason: Hallucinated/Unverifiable (no live source found for exact model). Search attempts: <brief summary of sites and queries tried>."

9.  **Logging**:
    -   For each manufacturer file updated, create or update the corresponding `.log` file in the same directory (e.g. `aiko.log`).
    -   **Log format** (one entry per change; use a consistent structure):
        -   Date (YYYY-MM-DD).
        -   Panel model (exact `model` string).
        -   Field changed (or "DELETED" or "ADDED" for new variants).
        -   Old value (or N/A for new/deleted).
        -   New value (or N/A for deleted).
        -   Reason (e.g. "Updated Voc to match datasheet", "Removed: URL returned 404", "DELETED: no live source for model").
        -   Resource link: one authoritative URL used for that change (if multiple sources, use the primary one for that field).

10. **Persistence and final check (MANDATORY before Reporting)**:
    -   **New panels in JSON**: Confirm that every new panel you identified (variants, added models) has been **written to the correct manufacturer `.json` file**—i.e. the panel object has been appended to the array in that file. If you only logged or described new panels without editing the `.json` file, do so now. The dataset is the JSON files on disk, not logs or notes.
    -   **datasheetUrl = exact URL visited**: For every panel in the JSON (including ones you added), ensure `datasheetUrl` is set to the **exact URL you fetched** and used to get that panel’s data. If you obtained data from a different URL than what is currently stored, update `datasheetUrl` to that URL. Do not leave a panel with an empty or wrong URL when you have a working source you visited.
    -   Only after both checks are done should you proceed to Reporting.

### 3. Reporting
-   After auditing a file, summarize the changes made or confirm that the data was already accurate.
-   Confirm that all new panels were written to the relevant `.json` file(s) and that every panel’s `datasheetUrl` is the exact URL you visited for that panel’s data.
-   Provide the URL of the primary source used for verification.
-   Mention if a new `.log` file was created or updated.

### 4. After Reporting — Restore .gitignore
-   **Uncomment** the log-ignore line in `.gitignore` (e.g. change `# *.log` back to `*.log`) so panel log files are ignored again. Leave the repo in its original state.

## Critical Rules
-   **Persist to JSON**: All new panels must be written to the manufacturer’s `.json` file (append to the array). All corrections (updated specs, removed links, etc.) must be saved to the JSON. Logging alone is not enough—the JSON files must reflect the final state.
-   **datasheetUrl = exact URL visited**: Every panel’s `datasheetUrl` must be the **exact** URL you fetched and used to get that panel’s data (the precise address you opened). If you used a different URL than what is stored, update it. Do not leave a generic or wrong URL.
-   **Datasheet first**: For each panel, the existing `datasheetUrl` is the first port of call. If it fetches successfully and contains the model and required specs, use it as the sole verification source and do not search further.
-   **Fetched page only — no search-result data**: Do **not** use Google (or any search engine) result text as a source for panel data. That includes snippets, titles, “AI overviews”, “People also ask”, and featured snippets—they are not verified and can be hallucinated. Use search **only to find URLs**. All specs and model information must come from pages (or PDFs) you have **actually fetched** with the browser/fetch tool. If you did not open the URL and read the page, that content is not an allowed source.
-   **Exact Model Matching**: Verification is against the **exact** `model` string (e.g. AIKO-A460-MAH54Mb), not the series or display name. The `model` in the JSON must match the manufacturer’s datasheet exactly.
-   **Full model only (no prefix-only)**: The `model` field must be the full part number including any suffix. If the source lists many variants distinguished by suffix (e.g. TSM-430DE09.08, TSM-430DE09.09), do not keep a single entry with `model` equal to the shared prefix; use one entry per full model and add all variants.
-   **Add all variants**: When a live source lists multiple variants of the same product (e.g. 400W, 415W, 430W), add every variant that has a full model number and specs on that source; do not add only one and ignore the rest.
-   **No 404 or redirect-to-home links**: No URL may appear in `datasheetUrl` or `buyLinks` unless you have successfully fetched it (non-404) and confirmed the final page shows the expected content (not a redirect to the site home or a generic page). Visit every link; remove or clear any that return 404 or redirect to home/generic content.
-   **No Hallucinations**: If the exact model cannot be found on the live web (official or tier-one reseller) after exhaustive search, **delete** the panel entry and log the deletion. Do not guess or leave unverifiable entries.
-   **Live Only**: Ignore pre-existing model knowledge. Only trust what you verify by **fetching a URL and reading the page content**; do not trust search result text or internal memory.
