# Solar Pear – UI/UX overhaul brief

Audience: a design agent (Claude Design) and the developers who will implement its output. Written 2026-09-30 against `main` at `448946c`. This brief describes the product as it is, what is wrong with it, and the structure and behaviour we want. It does not prescribe pixels: visual design is yours to propose, within the constraints in section 9.

---

## 1. Product in one paragraph

Solar Pear is today a client-only web app (React 19, Tailwind v4, no backend, all state in localStorage) that helps DIY builders and small installers, mainly in the UK, design small solar PV systems. The user describes where panels go, picks panels and a controller (MPPT charger, hybrid or string inverter, microinverter), and the app checks that the pairing is electrically safe (cold Voc against the controller limit, hot Vmp against startup, Isc and current clipping, MPPT window, charger power limits, string fusing) and physically fits (size, weight, GSE in-roof trays). It ends in a costed bill of materials with affiliate buy links. The catalogue holds about 180 panels and 190 controllers. This overhaul also moves the product from client-only to an **account-based web app that keeps a free, local-only mode** (section 5.4). Audiences: self-build homeowners, off-grid cabin owners, van and boat owners, small installers.

## 2. Why we are restructuring

Findings from a walkthrough of the current app (desktop, 1440 wide):

1. **The sidebar mixes four different things**: docs (Guide, Guide to Panels, Guide to Controllers), catalogue browsing (PV Controllers, Panels), the design itself (Areas and arrays) and the output (System Summary). The app opens on the Guide every time, even for returning users with a design.
2. **System-wide settings are buried in an array tab.** Design temperatures, DC bus voltage and system type live on an array's "Controller Selector" tab but change results for every array in that area. Nothing says so.
3. **The Controller Selector tab does four jobs**: assign MPPT ports on existing controllers, set area conditions, filter the catalogue, and add new controllers.
4. **The array tabs are not a workflow.** Overview, Layout, Panel Selector and Controller Selector are peers with no order or progress. Empty Panel and Controller slots on the overview are not calls to action.
5. **The user cannot see the system.** Nothing shows how arrays, strings, controllers, battery and grid connect. Experts think in single line diagrams; beginners have no mental model.
6. **There is one design per browser.** No way to keep alternative designs or different global conditions, and no way to reach a design from another device. The only persistence is localStorage plus manual JSON backup files, so clearing site data loses everything.
7. **No URLs.** State-driven tabs mean Back leaves the app and nothing is linkable.
8. **Small issues**: "Add Area" and "Add Array" are 11px text links; Reset sits next to Backup and Restore as unlabelled icons; a controller card can read "Selected" and "Incompatible" together; manufacturer names repeat ("SMA SMA Sunny Boy 4.0"); Guide to Panels and Panels use the same icon; below 960 px the whole app is replaced by an apology screen.

## 3. Goals and non-goals

**Goals**
- A user can tell where they are, what is done, and what to do next, at every point.
- Model the real world: one project holds several systems, each an independent electrical installation.
- Make the system visible with a live single line diagram (SLD) that doubles as navigation and status.
- Keep the expert audience's trust: every check is explainable, every number traceable to a datasheet field and a stated temperature.
- Serve beginners without dumbing down: presets and guided defaults, with all controls still reachable.
- Add optional accounts so designs follow the user across devices and can be shared, **without taking anything away from the free local-only experience**. Signing in is never required to design, check or price a system.

**Non-goals (for this overhaul)**
- No payments or premium tier in this pass, and no team or multi-user collaboration (leave room for both, section 5.4).
- No new electrical rules. The engine in `src/lib/arrayAnalysis.js` stays the single source of truth; the UI reads its output.
- No yield or payback modelling, batteries as catalogue items, or balance-of-system items (roadmap 7.3, 3.8, 3.9). The SLD must leave visible, tasteful placeholders for them.
- No re-theming of the guide articles' content.

## 4. Domain model (authoritative)

```
Project
 └─ System  (called "Area" in the current code and UI: rename to System in the UI only)
     ├─ Site settings: install type, grid mode, battery voltage, design temperatures, strict-current
     ├─ Controller units (site controllers): a catalogue controller placed in this system
     │     └─ MPPT ports (a controller has 1..n)
     └─ Arrays: a group of identical panels on one mounting surface
           └─ bound to exactly one MPPT port of one controller unit in the same system
```

Rules the design must respect:
- **A System is a complete electrical installation.** All controllers in a system are in the same place, so arrays in the system can share them. If a house has two controller locations, each with its own arrays, that is two Systems. A barn that is off-grid is one System and a house that is grid-tied is another.
- **An Array is a roof section, not a system.** Several arrays can feed different MPPT ports of the same controller, or (for a multi-MPPT unit) different ports of one inverter. Arrays cannot be moved between systems without clearing their controller binding (warn the user).
- **One array = one MPPT port. Ports are exclusive.** The power check (charger limit or inverter DC limit) sums every array on the controller unit.
- **Microinverters** have one input per panel: series length is 1, the parallel-strings control does not apply, and unit count is ceil(panels ÷ panelsPerUnit).
- **The Project** holds a name, an optional location, and default design temperatures copied into new systems (each system can override them). A project has 1..n systems.
- The internal storage key `areas` can stay. Only user-facing labels change from Area to System.

### Install type (per System)
This is a preset that sets defaults and hides irrelevant options. Every default stays editable.

| | Mobile (van, boat, caravan) | Static (house, barn, cabin) |
| --- | --- | --- |
| Grid mode options | Off-grid only (optionally shore power, out of scope now) | Grid-tied (G98/G99), Hybrid (with battery, optional EPS/backup), Off-grid |
| Default system type (existing `systemType` values) | `dc-charger` | `grid-connected`, or `off-grid` for off-grid AC |
| Default battery voltage | 12 V (24 V offered) | unset for grid-tied, 48 V for hybrid and off-grid |
| Design temperatures | wider range by default (suggest −15 °C cold, 75 °C cell) | project defaults (−10 °C cold, 65 °C cell) |
| Panel emphasis | small and flexible panels surfaced, weight prominent, no GSE trays | GSE in-roof and standard rigid panels |
| Controller emphasis | MPPT chargers, DC-DC chargers, compact hybrids | hybrid, string, micro inverters and chargers |
| Grid-only filters (EPS, house backup) | hidden | shown for grid modes |

## 5. Information architecture

### 5.1 Global structure
```
Top bar:   [Project switcher ▾]   [Save state ●]   [Library]  [Learn]   [Account / Sign in]  [⋯]
Sidebar:   Project
             Overview
             Systems
               Barn         [Static · Off-grid]   ● status
                 South roof (array)               ● status
                 East roof  (array)               ● status
                 + Add array
               House        [Static · Grid-tied]  ● status
                 ...
               + Add system
             Summary / BoM
Library ▸ Panels, Controllers (catalogue browsing)
Learn   ▸ Guide, Guide to Panels, Guide to Controllers
Account  Sign in / Create account (local mode) · Profile, Sync status, Sign out, Export all data, Delete account (signed in)
⋯ menu   Backup, Restore, Reset (destructive, labelled, with confirmation), About and disclosures
```
The catalogue and guides move out of the main design tree into their own top-level places so the tree is only "my design".

### 5.2 Routing
Introduce real URLs (roadmap 5.4), because projects and systems must be linkable and Back must work:
`/`, `/p/:project`, `/p/:project/s/:system/(overview|setup|controllers|bom)`, `/p/:project/s/:system/a/:array/(overview|layout|panel)`, `/p/:project/summary`, `/library/panels`, `/library/controllers`, `/learn/:slug`. Hosting is GitHub Pages today; the design must not depend on server routes (assume hash or history fallback).

### 5.3 Landing and first run
- **First run (no projects):** the user goes straight into the tool in **local mode**, with no sign-in gate. A "What are you building?" chooser (house roof grid-tied, house with battery, off-grid cabin, van or boat, plug-in balcony as a future tile). It creates a Project with one System with the right install type and presets, then drops the user on the System Overview with the SLD showing empty slots. Skippable.
- **Returning user:** open the last project's Overview. Never the Guide.
- **Guidance stays in context.** The owner dislikes intrusive first-view banners. The beta notice, disclaimer and affiliate disclosure go in the footer, near buy buttons and in the ⋯ menu, not in modals or top banners.

### 5.4 Accounts, sync and local-only mode

**Principle: the local-only mode is a first-class product, not a degraded one.** A visitor can design, check, price and export a full multi-project design with no account, exactly as today. An account adds convenience (cross-device access, safety from cleared browser data, sharing). It never gates the compatibility checks, the catalogue or the buy links.

**Two storage modes**

| | Local mode (default) | Account mode (signed in) |
| --- | --- | --- |
| Where projects live | This browser only (localStorage) | The user's account on a server, with a local cache |
| Cost to user | Free | Free forever (decision D10). The product is funded by affiliate links, so there is no paid tier, no upgrade prompt and no plan-comparison UI |
| Cross-device | No (manual backup file only) | Yes |
| Survives clearing site data | No, so keep prompting for backup | Yes |
| Sharing | Export file | Read-only share link (roadmap 5.13); a viewer can copy it into their own editable project |
| Works offline | Yes | Yes: edits are cached and queued, then synced |

**What syncs and what does not**
- Synced per account: projects (with systems, arrays, controller units, planner data, settings), the user's catalogue edits and custom products, user notes, and preferences.
- Not synced, always public and bundled with the app: the product catalogue, guides, and all calculations. The compatibility engine keeps running in the browser, so the server stores user data only and there is no server-side calculation.

**Sign-in**
- **Decided methods: email magic link, plus social sign-in** (**Google only at launch**; design the sign-in sheet so further providers can be added later without rework). There are **no passwords**, so no password fields, resets or strength meters. Passkeys are a possible later addition, so leave room in the sign-in sheet.
- Magic-link flow to design: enter email, "check your inbox" state with resend and change-email, link opens the app already signed in (including when the link opens in a different browser or device from the one that asked), expired or reused link state, and rate-limit messaging.
- Bot protection on sign-in (for example an invisible challenge) must not add a visible step for normal users, and needs a fallback state if it fails.
- Signing in with a social provider and with a magic link for the same email must lead to the same account. Design the "this email already has an account" case.
- Sign-in is offered in context and never as a banner or blocking modal: a persistent but quiet "Save to your account" entry in the account menu and project menu, a soft prompt at natural moments (creating a second project, exporting a backup, the storage-full notice, sharing), and dismissible for good. The owner dislikes intrusive first-view banners, so no sign-in wall or top-of-page nag on first visit.

**Upgrading from local to account (the most important flow)**
- On first sign-in, if local projects exist, show a clear choice: "Move these N projects to your account", "Keep them on this device only", or "Decide per project". Default to moving them. Show what will be uploaded before it is.
- If the account already has projects (signing in on a second device), merge by project identity, never silently overwrite. Duplicate or conflicting projects are offered as "keep both".
- A project is either **Local** or **Synced**. This is visible on the project card and in the switcher. A user can move a project either way (upload, or "download and remove from account").

**Signed-in behaviour to design**
- A persistent **save state** indicator in the top bar: "Saved on this device", "Saved to your account", "Syncing…", "Offline, will sync", "Sync problem". It must be calm and unobtrusive when everything is fine.
- **Conflicts:** the same project edited on two devices. Default to non-destructive: keep a copy of the losing version and tell the user, with a compare-and-choose view for the rare cases that need it. No silent data loss.
- **Sign out:** ask whether to keep a local copy of synced projects on this device or clear them (shared computers). Sign-out on a shared device must be able to wipe the local cache.
- **Delete account** and **export all data** are always reachable, with plain-language confirmation of what is deleted. Deletion is scheduled with a 7-day undo window (D10h): design the confirmation, the "scheduled for deletion on <date>, cancel" banner shown on sign-in during the window, and the final "deleted" email. Design the inactivity-warning email and the state a user lands in after clicking its "keep my account" link.
- The existing storage errors (`solar-storage-error`, a full or blocked localStorage) remain and are extended: in account mode they show "Couldn't save on this device, but your account copy is up to date".

**Trust, privacy and legal surfaces to design**
- Privacy notice and terms links at sign-up, in the account menu and in the footer, in plain language. Data collected is limited to email address and design data. Analytics stay cookieless where possible (roadmap 8.1, 6.3).
- Affiliate disclosure and disclaimers are unchanged and stay in context.
- Make it explicit that the app never asks for payment or sensitive personal details.
- **Email and marketing consent (decided: the account email may also be the newsletter and price-alert channel).** Consent is **separate, explicit and opt-in**: an unticked checkbox at sign-up and a toggle in account settings, never bundled with accepting the terms. Product emails (magic links, security notices) are distinct from marketing emails (newsletter, price-drop alerts, roadmap 12.5 and 7.13), and every marketing email has a one-click unsubscribe that is also reflected in account settings. Design the preferences UI and the unsubscribe landing state.
- **Free forever, affiliate supported (decided).** The account experience contains no upsell, feature gating or usage-limit meter. A fair-use cap of 25 synced projects per account and 1 MB per project (D10i) exists to prevent abuse. Design only a plain, non-alarming "limit reached" state for it, and make sure the user can still export and use local mode when it triggers. Affiliate disclosure stays near buy buttons and is never hidden behind sign-in.

**Forward compatibility (design for it, do not build it)**
- Read-only sharing with "Copy to my projects" is the decided model (D10f). Editable collaborators (an installer sharing a design with a client) are a possible later addition, so keep share permissions extensible.
- Organisation or installer accounts. (A premium tier is not planned: the product is free forever and affiliate supported.)
- Multi-region (roadmap phase 10).
- A stable, opaque id for every project, system and array, so that merging, sharing and sync work across devices.

## 6. Screens and behaviour

### 6.1 Projects
- **Project switcher** in the top bar: current name, list of projects, "New project", "Duplicate project" (for what-if variants with different temperatures), "Rename", "Delete" (confirm).
- **Project Overview:** systems as cards (install type, grid mode, voltage, peak Wp, cost, status), project-level defaults (location, design low and high), total cost, and a checklist of unresolved issues across all systems, each linking to the offending array.
- Migration: existing data becomes one **Local** project named "My design". Catalogue edits, user notes and hide-filter preferences stay global (per user), not per project.
- Each project card and switcher row shows its storage state (Local or Synced) and last-saved time; the project menu has "Save to account" or "Keep on this device only".

### 6.2 System page (tabs)
Tabs: **Overview** (default) · **Setup** · **Controllers** · **Bill of materials**.

- **Overview**: the SLD hero (section 7), then a status strip (errors, warnings, info counts) and an issue list grouped by component. Each issue has a one-line "why", the datasheet fields and temperature used, and a suggested fix (roadmap 7.5 and 7.6).
- **Setup**: install type, grid mode (with EPS and house-backup toggles for grid modes), battery voltage, design low and high temperature (with the note "applies to all N arrays in this system"), strict-current toggle. Changing a value shows the effect immediately in the SLD and a small "3 arrays re-checked" confirmation.
- **Controllers**: the units in this system. Each shown as a card with its MPPT ports, the array on each port, port limits, and a load meter (summed Wp against charge or DC limit). Actions: add controller (opens the catalogue picker filtered by this system's voltage, grid mode and install type, ranked by compatibility with the arrays already present), replace, remove (only when empty), open info.
- **Bill of materials**: this system's line items, quantities, price and price age, buy links, with export.

### 6.3 Array page
Tabs: **Overview** · **Layout** · **Panel**. There is no controller-selection table on an array page any more: the array shows a slim slot, "Controller: Inverter 1 · MPPT 2 [change]", which opens a small picker of free ports in this system, or "add a controller" that jumps to the system Controllers tab.
- **Overview is the hub.** Three slot cards in order: Layout (roof outline and count), Panel, Controller. Empty slots are calls to action ("Choose a panel →"). Filled slots show a summary and a change action. A mini SLD shows only this array's path (panels, strings, port, controller) with its metrics on the edges.
- Header keeps: name, panel count, mounting, wiring configuration (series × parallel), peak power, cost per kWp, cost.
- Users may start from any slot. The order is a suggestion, not enforced. Off-grid and mobile users usually start from the controller and battery, roof users from the layout.
- Progress: each array shows three dots (layout, panel, controller) in the sidebar and headers.
- Layout tab is the existing roof planner (see `documentation/ARRAY_PLANNER_ALGORITHM.md`). Redesign only its chrome and entry; do not redesign the packing UI in this pass.

### 6.4 Library and Learn
- **Library:** the current panels and controllers database tables, unchanged in function, with a consistent filter bar and a "use in a system" action that pre-selects the item when a system and array are chosen. Distinct icons for panels and controllers.
- **Learn:** the three guide pages as one section with a sidebar of articles.

### 6.5 Account and settings
- **Account menu:** signed out shows "Sign in / Create account" with a one-line benefit. Signed in shows email, sync status, "Export all data", "Sign out", "Delete account".
- **Sign-in and sign-up:** a lightweight sheet or page reached from the menu, with passwordless options, a link to the privacy notice and terms, and a visible "Continue without an account".
- **Local-to-account upload sheet** (5.4) and **conflict view**.
- **Share dialog** for a synced project: create or revoke a read-only link, and preview what the viewer sees.
- **Shared-project view** (someone opens a link): read-only rendering of the Project, System overview and SLD, with "Copy to my projects" (works in local mode too).

### 6.6 Summary / BoM
Project-level: per-system subtotals, all-project totals, unpriced items listed, price age flagged over 60 days, buy links per line, CSV and print export (roadmap 7.8).

## 7. The single line diagram (SLD)

The SLD is the centrepiece of the System Overview. It is generated from the model, not drawn by the user.

### 7.1 Purpose
1. Show how the components connect, in the conventional left-to-right power flow.
2. Show live compatibility status on every link and component.
3. Serve as navigation: click any part to open its editor.
4. Show what is missing (empty slots) so the next step is obvious.

### 7.2 Layout and topology
Left to right: **PV arrays → DC protection → controller → storage → loads and grid**. One row per array on the left, converging on the controller ports. The layout is automatic and must be stable as items are added.

Topology by controller type (all existing values of `type`):
- **`charger` (MPPT)**: arrays → MPPT port → DC bus / battery → DC loads.
- **`dc-dc-charger`**: alternator or starter battery → DC-DC charger → leisure battery. Some models also take a solar input, so a PV branch can be present.
- **`hybrid_inverter`**: arrays → MPPT ports → inverter → battery on the DC side; AC side to loads, grid, and an EPS/backup output if the model has one.
- **`string_inverter`**: arrays → inverter → AC → consumer unit → grid. No battery.
- **`microinverter`**: each panel (or group of `panelsPerUnit`) → micro → AC trunk → consumer unit → grid. Show "10 panels → 10 micros", not ten drawn nodes; expand on demand.
- **`ac_coupled_inverter`**: no PV input; not a valid PV controller in a PV path (the engine raises `noPvInput`), so draw it only on the AC side if ever supported.

### 7.3 Nodes
| Node | Shows | Source |
| --- | --- | --- |
| Array | name, count × panel, wiring (e.g. 6S2P), Wp | array and selected panel |
| String group | series × parallel, cold Voc, hot Vmp | analysis |
| Combiner / fuses | shown when 3 or more parallel strings, with fuse note | `stringFuses` check |
| DC isolator | placeholder, "not specified" | not in catalogue |
| Controller unit | model, ports, load meter | site controller |
| MPPT port | port number, limits (maxV, Isc, MPPT window) | controller data |
| Battery | voltage, "not specified" placeholder until catalogue v2 | system setup |
| AC output, EPS, grid | grid mode, G98/G99 flag, EPS availability | controller flags |
| Loads | placeholder | none |

Placeholder nodes (isolators, batteries, loads) use a dashed outline and a neutral style so they never read as "checked and OK".

### 7.4 Edges and live metrics
- Each PV-to-port edge carries the key numbers with the temperature stated: cold Voc / limit, hot Vmp / startup, hot Isc / rating, and Wp against the summed limit at the controller.
- Edge and node status uses the engine's states: `error`, `warning`, `info`, `valid`. Never colour alone: pair colour with an icon and text, for accessibility.
- Hover or focus on any status shows the message and its fix. The user can open the full issue from there.
- Info messages do not change status.

### 7.5 Interaction
- Click a node to open a side panel (not a modal) with its editor: change panel, wiring, controller, and so on.
- Click an empty slot to open the appropriate picker with candidates filtered by the system's settings.
- Click a free MPPT port to assign an array to it; a port in use shows which array holds it.
- No free-form dragging or wiring by hand in this pass. Reordering arrays is optional.
- Keyboard navigable, with a logical tab order following power flow, and a text equivalent of the diagram (list view) for screen readers.
- Export as SVG and PNG, and include in the print/PDF BoM (roadmap 7.8 and 7.9).

### 7.6 Scale and states
- 1 to about 6 arrays and 1 to 3 controllers is the normal case; design for up to 12 arrays gracefully (grouping and collapse).
- States to design: empty system (all placeholders), partially filled, fully valid, error, warning, unknown price, microinverter expansion, narrow width.

## 8. Cross-cutting UX requirements

- **Status language:** one consistent system for error, warning, info, valid across sidebar, headers, SLD, tables and the BoM. Errors are hard limits (for example Voc over the controller maximum); warnings are advisory (for example clipping).
- **Explain everything:** every message answers "why", cites the temperature used and datasheet field, and suggests a fix.
- **Prices:** unknown price is shown as "—", never £0; totals say "incomplete"; price age shown, amber after 60 days.
- **Review status is internal.** Do not show any "verified" or "reviewed" badge to users. Notes flagged as AI-generated do keep their existing label.
- **Notices in context:** no first-view banners or blocking modals for beta, disclaimer or affiliate text. Disclosure sits beside buy buttons and in the footer. Affiliate links are labelled as such.
- **Destructive actions** (reset, delete project, delete system) are labelled, separated from routine actions, and confirmed.
- **Undo** for delete and reassign actions where feasible (toast with undo).
- **Empty, loading and error states** for every view, with a next step.
- **Responsive:** the current app is blocked below 960 px. Van and boat users often work on phones and tablets. Design for desktop first, but define tablet and phone layouts: sidebar collapses to a drawer, tables become cards, the SLD becomes a scrollable, pan and zoom view plus the list alternative. The planner canvas may stay desktop and tablet only, with a clear message on phone.
- **Accessibility:** target WCAG 2.2 AA: keyboard operation, visible focus (the current focus ring is `#0044cc`), contrast on status pills, labelled icon-only buttons, no colour-only meaning, reduced motion respected.
- **Performance:** analysis is synchronous and cheap; all views must stay responsive with 180+ panels and 190+ controllers in tables (virtualise if needed).

## 9. Constraints and current visual language

- **Stack:** Vite 7, React 19, Tailwind v4 (theme tokens in `src/index.css`), uPlot for charts, Inter font. Deliverables should map onto Tailwind utilities and design tokens. No new UI framework unless justified.
- **Current identity:** dark slate sidebar (`slate-900`), light slate content background (`slate-100`), white cards with `slate-200` borders, brand yellow `#ffcc00`, secondary blue `#0044cc`. The logo is a yellow pear with "SOLAR PEAR". You may propose evolving the palette, but keep the brand yellow and logo.
- **State and backend:** today localStorage only (see `documentation/LOCAL_STORAGE_KEYS.md`, `documentation/BACKUP_SCHEMA.md`). The target is offline-first: local storage stays the working copy in both modes and the server is a sync target for signed-in users. The backend is **Cloudflare: a Worker (API and auth) with a Cloudflare database (D1)**, and the site moves to Cloudflare hosting (decision D10, resolving D2). Design consequences: (1) synced data is stored as one versioned JSON document per project with a revision number, not as fine-grained rows, so sync is per project and conflicts are detected per project; (2) requests are small and edge-fast, but the database has size limits, so projects have a sensible size ceiling (the planner geometry is the largest part); (3) magic-link email needs a transactional email sender, so expect a short delay and design the "check your inbox" state for it; (4) affiliate redirects (`/go/<id>`, roadmap 4.10) and cookieless analytics can run at the same edge, so the design can assume outbound buy links go through the site's own redirect. Do not design anything that depends on other vendor features. Backup files must stay importable, so assume a versioned schema (v6 adds projects, with stable ids and a storage-mode flag) and a migration on import.
- **The product must keep working with no server reachable** (local mode, and signed-in users offline).
- **Compatibility engine outputs** that the UI can use per array: `status`, `issues[]` (`code`, `severity`, `message`), `flags`, `coldVoc`, `hotVmp`, `arrayIscHot`, `peakPower`, `cost`, `costPerKWp`, `costIncomplete`, `controllerUnits`, and per-controller power aggregation across arrays.
- **UK-first:** £, G98/G99/G100, GSE trays and UK retailers. Do not design out multi-region support (roadmap phase 10), but do not build it now.
- **Desktop app wrapper:** none; it is a website.
- **Free and open source context:** the code is GPL-3.0, so anyone can self-host the client. Decided (D10g): the local-only build stays fully functional with no backend configured. When no backend is present, all account, sync and share UI is hidden rather than shown disabled.

## 10. Deliverables requested from Claude Design

1. **Information architecture and navigation model** (sitemap, sidebar tree, top bar, breadcrumb rules, routing table), with rationale for any deviation from section 5.
2. **Key flows**, each as annotated screens: (a) first run to a first checked system, with no account; (b) add a second system to a project; (c) duplicate a project to try different temperatures; (d) start from the controller (off-grid van); (e) start from the roof (house, grid-tied); (f) fix an error from the SLD; (g) create an account and move local projects into it; (h) sign in on a second device that already holds a local project (merge); (i) go offline, edit, reconnect, and resolve a sync conflict; (j) sign out on a shared computer; (k) share a read-only link and open it as a viewer; (l) delete the account and export all data.
3. **High-fidelity screens** for: the account menu, sign-in and sign-up, the local-to-account upload sheet, the save-state indicator in all its states, the conflict view, the share dialog and shared view, Project Overview, System Overview with SLD (empty, partial, valid, error), System Setup, System Controllers, Array Overview hub, Panel and controller pickers, Summary/BoM, Library, and the "What are you building?" chooser. Desktop, tablet and phone.
4. **SLD specification**: node and edge visual grammar, status states, placeholder style, per-topology templates (section 7.2), microinverter collapse and expand, 12-array scaling, interaction spec, and the accessible list alternative.
5. **Design system**: tokens (colour, type, spacing, elevation), status colour and icon set, component inventory (cards, slot cards, pills, meters, tables, side panels, toasts with undo, pickers, empty states) with states and Tailwind mapping.
6. **Content and microcopy guidelines**: naming (System, Array, Controller, Port), error and warning message style, and how "why" and "fix" text is laid out.
7. **Migration and rollout notes**: what changes for existing users, in what order it can ship (suggested: projects model and migration, IA and sidebar, system setup and presets, array hub and controller relocation, SLD, routing, then accounts and sync), and anything that should be feature-flagged. Existing local users must lose nothing and be asked nothing on upgrade.
8. **Open questions** you need answered before final design (section 13 lists those already known).

## 11. Acceptance criteria for the design

- A new user reaches a first checked system, with an SLD showing at least one array on a controller, in under two minutes and without reading the Guide.
- System-wide settings are never editable from inside an array page.
- Every status shown anywhere can be traced to a message with a cause and a fix.
- The SLD is understandable without labels for the topology (charger, hybrid, string, micro, DC-DC), and every node is reachable by keyboard.
- A visitor never has to create an account to design, check, price or export. Nothing about local mode is paywalled, degraded or nagged, and sign-in prompts appear only in context and can be dismissed permanently.
- The save location of every project (this device or the account) is visible at all times, and no flow can move or delete a project's data without saying so first.
- Signing in on a new device with local projects present never overwrites either side without an explicit choice.
- A user can always export all their data and delete their account from the UI, in plain language.
- Two systems in one project can have different install types, grid modes, voltages and temperatures without any UI ambiguity about which one is being edited.
- The design leaves room, without rework, for batteries, balance-of-system items, yield estimates and price-drop alerts (roadmap 3.8, 3.9, 7.3, 7.13).

## 12. Related documents

`memory-bank/roadmap.md` (7.1 onboarding, 7.11 optional cloud save and 12.5 email capture (both superseded in scope by 5.4 here), 5.1 hosting, 6.3 privacy, 8.1 analytics, 5.13 shareable links, 7.5 explain warnings, 7.6 auto-suggest fixes, 7.7 mobile, 7.8 export, 7.9 wiring diagram, 5.4 router), `memory-bank/domain-rules.md` (checks, severities and constants), `documentation/LOCAL_STORAGE_KEYS.md`, `documentation/BACKUP_SCHEMA.md`, `src/data/controllers/SCHEMA.md`, `src/data/panels/SCHEMA.md`.

## 13. Decisions and open questions

### Decided (owner, 2026-09-30)
| ID | Decision |
| -- | -------- |
| D9 | The UI says **System** where the code says "area". |
| D10a | **Backend and hosting:** Cloudflare Worker plus Cloudflare database (D1), with the site on Cloudflare hosting. Resolves roadmap D2. |
| D10b | **Cost model:** free forever, funded by affiliate links. No paid tier, upgrade prompts or feature gating. |
| D10c | **Sign-in:** email magic link plus social sign-in. No passwords. |
| D10d | **Email:** the account email may also be the newsletter and price-alert channel, with separate, explicit, opt-in consent. |
| D10e | **Social providers:** Google only at launch. |
| D10f | **Sharing:** read-only links only. A viewer can "Copy to my projects", which creates a new, independent, editable project in their own local storage or account. There is no link-based editing and no live collaboration. |
| D10g | **Local mode and the licence:** the local-only build must stay fully functional with the backend removed, so self-hosting the GPL client works. |

| D10h | **Data retention** (recommended defaults, owner to confirm; UK GDPR requires only that data is kept no longer than necessary, with erasure on request without undue delay and within one month): (1) **Deletion on request:** the account and all its projects are deleted from the live database after a **7-day undo window**, shown as "Scheduled for deletion on <date>, cancel"; signing back in cancels it. Deletion completes well inside the one-month legal limit. (2) **Inactivity:** after **24 months** without sign-in, send a warning email (and a second one a month before), then delete. (3) **Marketing suppression:** an unsubscribed email address is kept as a one-way hash so the opt-out is honoured, and nothing else. (4) **Shared links** die with the project. (5) The privacy notice states all of the above, including that database backups roll off within their retention period. |
| D10i | **Fair-use cap** (recommended): **25 synced projects per account, 1 MB per project**. A typical project is far below this; the planner geometry is the only large part. At the cap the user sees one plain message ("You've reached the limit of 25 synced projects. Delete one, or keep this one on this device only") and local mode and export are never affected. |

### Still open
None. D10h and D10i are recommendations awaiting the owner's confirmation.
