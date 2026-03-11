---
description: Verify panel JSON against SCHEMA.md and live sources; remove hallucinated panels and all 404 links (every URL must be fetched).
---

# Solar Panel Verification Workflow

This workflow instructs the agent to perform a rigorous verification of all solar panel data files located in `src/data/panels/`. Accuracy is paramount; do not rely on internal knowledge.

**Priorities:** (1) **Identify and remove hallucinated panels** — any panel whose exact model cannot be found on the live web (official or tier-one reseller) must be deleted and logged. (2) **No 404 links** — every `datasheetUrl` and every `buyLinks` URL must be visited; any that return 404 or are unreachable must be removed from the JSON and logged.

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

3.  **Link Audit (MANDATORY — no link may remain without a successful fetch)**:
    -   **Every URL must be visited.** For each panel, use the browser/fetch tool to open:
        -   `datasheetUrl` (if non-empty),
        -   every URL in `buyLinks` (each key’s value).
    -   **404 or unreachable = remove.** If a URL returns 404, times out, or does not load:
        -   Set `datasheetUrl` to `""` (or remove the key from `buyLinks` for that entry).
        -   Log the removal: date, panel `model`, field (e.g. `datasheetUrl` or `buyLinks.<label>`), old URL, reason: "Removed: URL returned 404 (or unreachable)."
    -   **Never add a URL** you have not personally fetched with a successful (non-404) response. Do not assume a URL works from pattern or search snippets; always visit it.

4.  **Hallucination Check (identify panels that do not exist)**:
    -   **Search by exact identifier.** Using the **exact** `model` string (primary) and, if needed, the `name` string, search the web for the manufacturer + model (e.g. `"Trina" "TSM-430DE09.08"`).
    -   **Exhaustive search** means at least: (a) one search targeting the manufacturer’s official site or product/datasheet list, (b) two separate searches on tier-one reseller/distributor sites (e.g. Midsummer, Segen, Krannich, or similar) using the exact model. Use `search_web` and then **visit** the resulting pages; do not assume content from snippets.
    -   **If the exact model appears nowhere** (no official page, no tier-one reseller listing with matching model and specs), treat the panel as **hallucinated** and apply the Deletion Policy below.
    -   Verification must be against **live page content** (or PDF only if your tools can actually fetch and read the PDF). Do not trust "internal knowledge"; if the live web does not show the model, it is unverifiable.

5.  **Live Internet Verification (when the model is found)**:
    -   **Identify**: Use `manufacturer` and the **exact** `model` (and `name` only if needed to disambiguate).
    -   **Verify Links**: For any URL you intend to add or keep: **you MUST visit it** with the browser tool. If you get 404 or unreachable, do not add it; if it is already in the file, remove it (see Link Audit above).
    -   **Cross-Reference**: Prefer the manufacturer’s official product/datasheet page. If unavailable, use at least two tier-one reseller sites that show the same technical data for this exact model. If data is inconsistent or no reliable source lists this exact model, treat as unverifiable and apply the Deletion Policy.
    -   **Detailed Check**: Cross-reference these fields against the actual text/tables on the live page (or readable PDF): `power`, `voc`, `vmp`, `isc`, `imp`, `tempCoefPmax`, `tempCoefVoc`, `tempCoefIsc`, `efficiency`, `height`, `width`, `depth`, `weight`, `cells`, `glass`, `bifacial`, `maxSeriesFuse`, `maxSystemVoltage`. If a value is not found on the source, leave the existing value unchanged and log: "Field X: not found on source; kept existing value."

6.  **Correction & Safety Guards**:
    -   **Model = manufacturer's model:** The `model` field must be the **manufacturer's model number** (e.g. full part number from the manufacturer's datasheet), not a supplier's product code, SKU, or reseller reference. Check that the value matches what the manufacturer uses; if the source is a supplier page, confirm the manufacturer model and use that.
    -   **Model Alignment**: The `model` field must match the **exact string** on the manufacturer's datasheet (e.g. full part number). Do not shorten or guess.
    -   **Datasheet URL**: Set or update `datasheetUrl` only after a successful fetch that confirms the page contains this specific model’s data. If every link you find returns 404, set `datasheetUrl` to `""` and log the attempt; never leave a 404 URL in the file.
    -   **Notes**: Update `notes` only with user-helpful information (strengths/weaknesses, sentiment, application advice). If you keep a panel but have doubts (e.g. only one weak source), append to notes: "Unverified: [brief reason]." so it can be manually reviewed later.

7.  **Failure Handling (Deletion Policy — single source of truth)**:
    -   **Delete the panel entry** when: (i) the model cannot be confirmed after the exhaustive search above, or (ii) the exact model has no trace on official or tier-one sites (hallucination), or (iii) the only "sources" are broken links (all 404).
    -   Do **not** guess or invent data. If in doubt after exhaustive search, **delete** and log; do not leave unverifiable panels in the dataset.
    -   **Log every deletion**: In the manufacturer’s `.log`, add an entry: "DELETED - Model: <model> - Reason: Hallucinated/Unverifiable (no live source found for exact model). Search attempts: <brief summary of sites and queries tried>."

8.  **Logging**:
    -   For each manufacturer file updated, create or update the corresponding `.log` file in the same directory (e.g. `aiko.log`).
    -   **Log format** (one entry per change; use a consistent structure):
        -   Date (YYYY-MM-DD).
        -   Panel model (exact `model` string).
        -   Field changed (or "DELETED").
        -   Old value (or N/A for new/deleted).
        -   New value (or N/A for deleted).
        -   Reason (e.g. "Updated Voc to match datasheet", "Removed: URL returned 404", "DELETED: no live source for model").
        -   Resource link: one authoritative URL used for that change (if multiple sources, use the primary one for that field).

### 3. Reporting
-   After auditing a file, summarize the changes made or confirm that the data was already accurate.
-   Provide the URL of the primary source used for verification.
-   Mention if a new `.log` file was created or updated.

## Critical Rules
-   **Manufacturer's model only:** The `model` field must be the manufacturer's model number (from the manufacturer's datasheet or official spec), not a supplier's product code or SKU.
-   **Exact Model Matching**: Verification is against the **exact** `model` string (e.g. AIKO-A460-MAH54Mb), not the series or display name. The `model` in the JSON must match the manufacturer’s datasheet exactly.
-   **No 404 Links**: No URL may appear in `datasheetUrl` or `buyLinks` unless you have successfully fetched it (non-404). Visit every link before adding; visit every existing link and remove or clear any that return 404.
-   **No Hallucinations**: If the exact model cannot be found on the live web (official or tier-one reseller) after exhaustive search, **delete** the panel entry and log the deletion. Do not guess or leave unverifiable entries.
-   **Live Only**: Ignore pre-existing model knowledge. Only trust what you verify via live search and fetch; if the live web disagrees with internal memory, the live web wins.
