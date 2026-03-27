# How the array planner’s auto-fit algorithm works

This document describes the **panel packing logic** used by the Array Planner. The implementation lives in [`src/lib/plannerEngine.js`](../src/lib/plannerEngine.js) (`computePlannerLayouts`). The UI (roof shape, setbacks, exclusions, orientation choice) feeds that function; this page is about **what happens inside** the fitter, in plain language.

---

## What problem is it solving?

You draw a **roof outline** (a polygon) and optional **blocked areas** (exclusions). You have a list of **PV modules** with real width, height, and power. The planner answers:

> *If I lay panels in a regular grid on this roof—respecting gaps and staying inside the shape—which panel model and orientation give the most total power, and where do the rectangles go?*

Think of it as **tiling a floor**: same tile repeated on a grid, but the “room” is an arbitrary polygon and some tiles are forbidden zones.

---

## Inputs (in simple terms)

| Input | Role |
|--------|------|
| **Roof polygon** | Closed outline in metres. Only placements whose **whole panel rectangle** lies inside this shape count. |
| **Edge setback** | Extra clearance from the **actual roof edges** (not just the bounding box). Each panel’s **corners** must be at least this far from the roof boundary, measured perpendicular distance to the nearest edge. |
| **Panel gap** | Space left between adjacent panels in the grid (same gap on X and Y). |
| **Exclusions** | Axis-aligned “holes” (e.g. skylights). Any panel that overlaps an exclusion is rejected. |
| **Panel list** | Active modules with width, height, and power. Very low-powered or invalid sizes are skipped. |
| **Orientation** | Whether to try **portrait**, **landscape**, or **both** / **either** for that panel’s footprint (landscape = width and height swapped on the roof). The app’s *Either* option uses the same dual-orientation search as *both*. |
| **Top N** | Only the **highest-power** panel models (after sorting) are evaluated in depth, to keep runtime reasonable. |

---

## Step 1: Normalise geometry

- Roof and exclusions are converted to **integer millimetres** so grid math stays stable.
- A **usable rectangle** is derived from the roof’s **axis-aligned bounding box**, inset by the edge setback on all four sides. The scan loop only considers positions inside this rectangle—but a position still has to pass the real **polygon** tests below, so sloped or non-rectangular roofs are handled by clipping to the true shape, not by trusting the box alone.

---

## Step 2: Choose which panels to try

- Panels must be **active** (unless the engine is told otherwise), and have positive **width, height, and power**.
- They are sorted by **power (descending)** so the most capable modules are tried first.
- Only the first **N** entries in that sorted list are used (the app configures an upper cap, e.g. 200).

So the algorithm does **not** mix different panel models in one layout: each candidate result is “this model, this orientation, this grid.”

---

## Step 3: Regular grid + small search over “phase shifts”

For each panel model and allowed orientation:

1. **Footprint**  
   Portrait uses the panel’s catalogue width × height on the roof; landscape swaps them.

2. **Grid spacing**  
   Horizontal step = panel width + gap. Vertical step = panel height + gap.

3. **Starting offsets**  
   Instead of always starting the grid at the top-left corner of the usable area, the engine tries a **small set of alternative starting positions** (“offsets”) along X and Y. Offsets are derived from the panel step and from the **edges of exclusions**, so the grid can shift slightly and **pack better around obstacles** (similar in spirit to nudging a tile pattern so fewer tiles are “cut” by a vent).

4. **Placement rule**  
   For each offset pair, it walks the grid row by row, column by column. For each cell it proposes one rectangle. That rectangle is **kept** only if:
   - **All four corners** are **inside** the roof polygon (point-in-polygon test; on the boundary counts as inside).
   - If setback &gt; 0, **every corner** is at least **edge_mm** away from the roof polygon’s edges (shortest distance to any edge segment).
   - The rectangle does **not** overlap any exclusion.

5. **Best offset for this panel + orientation**  
   Among the tried offset pairs, the one that places the **largest number of panels** wins. Row/column counts recorded for that winner are approximate grid extents (useful for display), not a guarantee of a full rectangle of panels—corners of the roof often leave holes in the grid.

---

## Step 4: Score and rank layouts

For each successful combination (panel model × orientation × best offset), the engine computes:

- **Count** — number of rectangles placed.  
- **Total power** — count × panel STC power (simple model: same module everywhere).  
- **Utilisation** — share of the **usable bounding rectangle’s** area covered by panel area (informative; not the same as roof area on odd shapes).

All candidates are then **sorted**:

1. Higher **total power** first.  
2. If tied, higher **panel count**.  
3. If still tied, higher **utilisation**.

The ordered list is what the UI shows as ranked options.

---

## What this algorithm is *not*

- **Not** a global optimizer over mixed panel types in one array.  
- **Not** rotating panels to arbitrary angles—only **0° / 90°** via portrait vs landscape.  
- **Not** placing partial modules: a panel is either fully inside and valid, or omitted.  
- **Not** electrical stringing: Voc/Vmp/Isc limits are handled **outside** this file (e.g. optional filtering before panels are passed in).

---

## Mental model in one sentence

**Try the strongest panel models first; for each one, try a fixed-orientation rectangular grid at several smart starting positions; keep only full rectangles inside the roof, clear of exclusions and edge setback; rank by total watts.**

For implementation details (exact formulas, mm conversion, ray-casting), see [`plannerEngine.js`](../src/lib/plannerEngine.js).
