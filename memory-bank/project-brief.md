# Project brief

**Name:** Solar Pear (npm package `solar-selector`). Repo: `GryphonR/Solar-Pear` on GitHub. Licence: GPL-3.0.

**Tagline:** "Pair the right panels with your roof. Pair the right controller with your panels."

## What it does
A client-only React single-page app for designing small solar PV systems:
1. **Areas → Arrays**: the user models roof areas (House, Garage, …) and the arrays in each one (panel count, orientation/format, mounting type such as In-Roof GSE or On Roof, maximum panel size and weight).
2. **Array Planner**: the user draws a roof polygon with exclusions, and an auto-fit packs panels to maximise power (`src/lib/plannerEngine.js`).
3. **Panel selector**: filters and ranks about 177 panels by physical fit, GSE tray compatibility, Voc against the chosen controller, and cost per kWp.
4. **Controller selector**: about 68 controllers (MPPT chargers, hybrid/string inverters, micros). Each array is bound to one MPPT port on a "site controller instance". Instances can be shared across arrays within an area.
5. **Summary / BoM**: a list of panels and controllers with estimated prices and buy links.
6. **Guides**: editorial pages explaining panel and controller choice (`Guide.jsx`, `PanelsGuideView.jsx`, `ControllersGuideView.jsx`).
7. **Backup/restore**: the user can export and import JSON. All state lives in localStorage and there is no backend.

## Audience and market
- The product is currently **UK-centric**. Prices are in £, there is an `availableUK` flag, G98/G99/G100 cert flags, GSE in-roof trays, and the retailers are UK solar wholesalers.
- Target users are DIY/self-build homeowners, off-grid users (vans, boats, cabins) and small installers.

## Business goal
The owner intends to release the app to a wider audience and **monetise via affiliate links** on the buy buttons (`buyLinks[].isAffiliate`). As of the last review, no affiliate links exist yet.

## Constraints and principles
- Voc over the controller limit is the only hard electrical gate, because it can destroy hardware. Vmp below startup and current overage are warnings (see `domain-rules.md`; this is under review).
- Catalogue data is partly AI-derived (notes, some specs). Only 2 of 245 records are marked `reviewed: true`.
- The app has no user accounts and no server. The data-admin tool is local-only.
