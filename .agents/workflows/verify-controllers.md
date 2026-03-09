---
description: Fastidiously check all solar controller JSON files against SCHEMA.md and live manufacturer/reseller data.
---

# Solar Controller Verification Workflow

This workflow instructs the agent to perform a rigorous verification of all solar controller data files located in `src/data/controllers/`. Accuracy is paramount; do not rely on internal knowledge.

## Prerequisites
-   Access to the `src/data/controllers/` directory.
-   Access to `src/data/controllers/SCHEMA.md`.
-   Browser and search tools enabled.

## Steps

### 1. Initialize and Validate Schema
-   Read `src/data/controllers/SCHEMA.md` to understand the required fields, types, and constraints.
-   **Schema Drift Check**: Compare the required fields in `SCHEMA.md` against the existing structure in the JSON files. 
    -   If new fields have been added to the schema, **intelligently update every controller object** across all JSON files to include these fields.
    -   Use sensible defaults (e.g., `0` for new numeric fields, `false` for booleans, `""` for strings) or derive values from existing data/online sources if possible.
-   List all JSON files in `src/data/controllers/`.

### 2. Systematic Controller Audit
For each JSON file (e.g., `victron-energy.json`, `solis.json`, etc.):
1.  **Iterate** through every controller object in the array.
2.  **Schema Check**:
    -   Verify that every field listed in `SCHEMA.md` is present.
    -   Ensure types match (e.g., `number[]` for `systemVoltages`, `boolean` for `islanding`).
3.  **Live Internet Verification**:
    -   Identify the `manufacturer` and the **exact** `modelNumber` or `name`.
    -   **Search**: Use the `search_web` tool to find the official manufacturer's product page or a tier-one reseller's website (e.g., official brand sites, major solar distributors).
    -   **Source**: Only use live internet data. **NEVER** use local LLM training data or "internal knowledge" for technical specifications.
    -   **Detailed Check**: Cross-reference **every data point** in the JSON object against the datasheet/product page:
        -   `maxV` (Maximum PV Voltage)
        -   `maxIsc` (Max Short Circuit Current)
        -   `maxOperatingI` (Max Operating Current)
        -   `mpptRangeMin` / `mpptRangeMax`
        -   `startupV` and `v_start_vbat_dependent`
        -   `systemVoltages` (Check all supported battery voltages)
        -   `MaxACPower` / `MaxDCPower`
        -   `g98_cert`, `g99_cert`, `g100_cert` (Verify certifications for the specific region if applicable)
        -   `islanding`, `off_grid`, `eps`, `house_backup`
4.  **Correction**:
    -   If a value is incorrect, update it to match the authoritative live source.
    -   If a value is missing but found online, populate it.
    -   **Notes Update**: Update the `notes` field ONLY with information that would be helpful to a user in deciding whether to use the controller. Focus on:
        -   Particular strengths or weaknesses.
        -   Online sentiment or common user feedback.
        -   Practical application advice (e.g., "Excellent for low-light but lacks quiet fan mode").
    -   **DO NOT** modify the `reviewed` field.
5.  **Logging**:
    -   For each manufacturer file updated (e.g., `victron-energy.json`), create or update a corresponding log file in the same directory (e.g., `victron-energy.log`).
    -   Each log entry must include:
        -   Date of change.
        -   Controller ID.
        -   Field changed.
        -   Old Value.
        -   New Value.
        -   Reason for the change (e.g., "Updated MaxV to match 2024 revised datasheet").

### 3. Reporting
-   After auditing a file, summarize the changes made or confirm that the data was already accurate.
-   Provide the URL of the primary source used for verification.
-   Mention if a new `.log` file was created or updated.

## Critical Rules
-   **Exact Model Matching**: Ensure the verification is against the exact `modelNumber` (e.g., SCC075010060R) not just the general family (e.g., MPPT 75/10).
-   **No Hallucinations**: If data cannot be found on a tier-one site, mark it for manual review instead of guessing.
-   **Live Only**: Explicitly ignore any pre-existing model knowledge. If the internet says one thing and your internal memory says another, the internet wins.
