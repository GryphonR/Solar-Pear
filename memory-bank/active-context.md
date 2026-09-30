# Active context

## Current state (2026-09-30)
- `main` is at `448946c`: phases 0–2 are done and phase 3 is in progress (see the roadmap progress table).
- Recent merges: 3.11 mainstream UK inverters (PR #8, 56 records), 3.6 off-grid and leisure chargers (PR #10, 27 records), 3.7 small and flexible panels (PR #11). The Hypontech micro is still outstanding. SolarEdge is out of scope (D7). Photonic Universe and Sunbeam are left out until they publish full datasheets (D8).
- Branch `feat/phase-6-trust` (phase 6) adds:
  - a "How We Check" methodology page generated from the engine constants (6.5);
  - an About & legal page with the disclaimer, affiliate disclosure, pricing independence, data sources, privacy and terms (6.1, 6.2, 6.3, 6.7, 6.10);
  - a one-line disclaimer beside each array's verdict and on the Summary (no first-run banner: too intrusive), an affiliate notice by the buy buttons, footer links, "Report a data error" links in the info modals, and `changelogs/data-corrections.md` (6.6).
  - The legal text is a draft without legal advice. The operator is given as "eChook" and the only contact route is GitHub; a private contact address is still needed.
- Branch `claude/4-14-supplier-research-*` (on top of phase 6) records the 4.14 desk research in `affiliate-research.md` and fills the 4.1 table. Apply order: Renogy UK (Awin), Bimble, Voltacon (Paid On Results), Sunstore, Butler Technik (Awin, Victron), City Plumbing. Grid-tied and hybrid gear has few affiliate-able consumer retailers, which strengthens the case for the installer-quote lead form (4.13) and for portable power stations (3.10).
- UX overhaul (2026-09-30): the redesign is planned as roadmap phase 13 (tasks 13.1–13.9), built incrementally behind a feature flag. The design lives in the Design canvas "Solar Pear UX Overhaul" (https://claude.ai/artifact/7o6URUudKricDigHW4hAuX). New related tasks: 3.14 (ENA Type Test references) and 7.17 (DNO pack). Plug-in solar is out of scope (D11).
  - 13.1 is done (tokens, IBM Plex, shared components in `src/components/ui/`, approved logo lockup, `?ui=kit` gallery, `src/lib/uiFlag.js`). 13.2 is done too (storage v3 `solar_projects`, backup v6, `src/lib/projects.js`; the old views still read derived flat shapes). Next in phase 13: 13.3 (routing) and 13.4 (shell behind the flag).
- Branch `claude/plan-point-13-3-*` (on top of 13.1/13.2): 13.3 done, real URLs with project, system and array ids (`src/lib/routes.js`), Back/Forward and refresh working, `404.html` fallback for GitHub Pages. Phase 13 continues on this branch.
- Catalogue review (3.3) is human work and stands at 2 of 66 sellable products. Review status stays internal.

## Next up
- Merge phase 6. The rest of the phase needs the owner: 6.8 licence strategy, 6.9 trademark check, 6.4 Amazon rules (decided through 4.14), and 6.11 accessibility.
- Finish 4.14 (trust signals, Bimble T&Cs, Voltacon's current rate, emails to TradeSparky, Fogstar and 12 Volt Planet), then the owner applies to programmes in the ranked order (4.1).
- Keep the 3.3 reviews going toward the 80% launch target.

## Open decisions
- Keep the UK-only focus, or add region/currency support (D6)?
- Hosting: stay on GitHub Pages, or move to Cloudflare Pages/Netlify for `/go/<id>` affiliate redirects, analytics and headers (D2)?
- Retailer ordering policy (D3) and licence strategy (D4).
