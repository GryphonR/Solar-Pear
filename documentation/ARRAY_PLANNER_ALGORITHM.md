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

## Step 3: Rows, each packed on its own

For each panel model and allowed orientation:

1. **Footprint**  
   Portrait uses the panel’s catalogue width × height on the roof; landscape swaps them. The layout depends only on the footprint, so panels of the same size share one packing (cached per footprint).

2. **Row spacing**  
   Rows are one panel height + gap apart. Within a row, panels are at least one panel width + gap apart.

3. **Vertical offsets**  
   The rows can start at a few different heights: flush with the top of the usable area, flush with the bottom (the eaves, where a hipped face is widest), a quarter, half and three quarters of a step down, and the heights that line a row up with the **top or bottom edge of each obstacle**.

4. **Packing a row**  
   Each row is packed independently, so a narrow row near a hip or an obstacle doesn't cost the other rows. The engine scans the row from the left in 25 mm steps (`ROW_SCAN_MM`) and puts a panel in the first place it fits, then continues one panel width + gap along; when a position overlaps an obstacle it jumps straight past it. It does the same from the right. When both scans place the same number of panels, the row is **centred** between them if every centred position still fits (on a symmetric hipped face this gives a symmetric layout). A position is **kept** only if:
   - Its **corners, edge midpoints and centre** are **inside** the roof polygon (point-in-polygon test; on the boundary counts as inside).
   - If setback &gt; 0, each of those points is at least **edge_mm** away from the roof polygon’s edges (shortest distance to any edge segment).
   - The rectangle does **not** overlap any exclusion.

5. **Best offset for this panel + orientation**  
   Among the vertical offsets, the one that places the **largest number of panels** wins. The result records `rowCounts` (panels in each non-empty row, from the top), `rows` (how many) and `cols` (the fullest row). Rows can hold different numbers of panels, which the planner shows as, for example, "rows of 2, 3, 4".

Why rows rather than one grid: with a single grid for the whole roof, every panel that doesn't fit near a hip or a chimney wastes a full panel's width in every row, which penalises large modules much more than small ones. Before this change, small leisure panels often out-ranked far more efficient house panels on hipped roofs and roofs with obstacles for that reason alone.

---

## Step 4: Score and rank layouts

For each successful combination (panel model × orientation × best offset), the engine computes:

- **Count** — number of rectangles placed.  
- **Total power** — count × panel STC power (simple model: same module everywhere).  
- **Utilisation** — share of the **usable bounding rectangle’s** area covered by panel area (informative; not the same as roof area on odd shapes).

All candidates are then **ranked** (`rankByPowerWithNearTies` in [`layoutRanking.js`](../src/lib/layoutRanking.js)):

1. Higher **total power** first.  
2. **Near-ties go to fewer panels.** A layout within 3% (`NEAR_TIE_FRACTION`) of the power of the layout leading its band ranks by panel count, fewest first: about the same power from fewer modules needs less mounting kit, fewer connectors and less labour. A layout more than 3% below the leader starts a new band, so the order is well defined. For example, 4 × 720 W and 16 × 180 W (both 2,880 W) rank the 4-panel layout first.  
3. If still tied, higher **utilisation**.

The ordered list is what the UI shows as ranked options. The planners' "Most power" sort uses the same rule.

---

## After the ranking: the redesigned planner (roadmap 13.8)

The new shell's Layout tab (`src/shell/planner/`) uses the same engine. The extra steps live in [`plannerLayouts.js`](../src/lib/plannerLayouts.js), which is pure and tested:

- **Roof shapes from the first-use card.** `plannerFromStart` turns three measurements into the planner's roof: a rectangle, a hipped face (a trapezoid whose ridge defaults to width − 2 × slope × cos(pitch), which holds when every face has the same pitch; the pitch comes from a map measurement, otherwise 35° is assumed and the UI says so; editable) or a rectangle to reshape by hand. A measurement from a map is corrected to the length along the slope with the pitch (`slopeLengthFromPlan`: depth ÷ cos pitch); the card links to SolarWizard for the pitch.
- **Layouts, not panels.** Many panels of about the same size give the same grid, so `groupLayouts` groups the ranked candidates by orientation, panels per row and panel count. Each group shows the band of panel sizes that produces it and expands to the panels in it. Sorted by panel size (largest first, so each band ends where the next layout takes over), by power, or by £/kWp (unknown prices last). With a controller assigned, the list can be limited to candidates that have a wiring the controller accepts (`bestParallelStringsForController`, the same helper as auto-wiring).
- **Empty slots.** The engine packs a full grid; the user can switch individual slots off (a vent, a shaded corner). `withEmptySlots` removes them by position key (`slotKey`, the slot's corner to the millimetre) and recomputes the count and power. Empty slots are stored per layout in `planner.emptySlots[layoutId]`.
- **Preview before apply.** Choosing a layout changes nothing. `layoutPatch` works out the array fields it would set (panel, count, parallel strings, maximum panel size swapped for landscape), and `analyzeArrayWith` in `AppStateContext` runs the normal `analyzeArray` on the array with that patch. `layoutChangeSummary` compares the two analyses: panels, wiring, power, and which checks it would clear or add. No check is re-implemented: the preview is the engine's own verdict.
- **Apply and undo.** "Use this layout" writes the patch with `updateArray` and records `planner.applied` (`{ id, panelModel, orientation, rects_m, emptyRects }`), so the drawing shows what is in the design. The toast offers Undo. If the roof is edited afterwards so the applied panels no longer fit, the planner says so.
- **Same panel as another array.** `samePanelArrays` flags layouts whose panel another array in the project already uses, since buying one model is simpler.
- **Setback line.** `insetPolygon` draws the edge setback as a dashed guide. It is exact for convex outlines; the engine still checks each panel against every edge itself.

The drawing (outline, obstacles, clearances) is saved on the array as the user works and has no effect on any check. On a phone the Layout tab shows the roof and the applied layout view only; the panel count can still be set by hand.

---

## What this algorithm is *not*

- **Not** a global optimizer over mixed panel types in one array.  
- **Not** rotating panels to arbitrary angles—only **0° / 90°** via portrait vs landscape.  
- **Not** placing partial modules: a panel is either fully inside and valid, or omitted.  
- **Not** electrical stringing: Voc/Vmp/Isc limits are handled **outside** this file (e.g. optional filtering before panels are passed in).

---

## Mental model in one sentence

**For each panel model and orientation, try rows at several heights and pack each row on its own, keeping only full rectangles inside the roof, clear of exclusions and edge setback; rank by total watts, with near-ties going to fewer panels.**

For implementation details (exact formulas, mm conversion, ray-casting), see [`plannerEngine.js`](../src/lib/plannerEngine.js).
