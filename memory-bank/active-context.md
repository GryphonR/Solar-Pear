# Active context

## Current state (2026-10-02)
- `main` holds phases 0–2, phase 6 (trust and legal, PR #12), the 4.14 supplier research (PR #13) and **all of phase 13, the UX overhaul**. Phase 13 was pushed to `origin` on 2026-10-02, so the new shell is live. See the roadmap progress table (48 / 153).
- Phase 13 summary: storage v3 projects (`solar_projects`, backup v6), URL routing (`src/lib/routes.js`), the app shell (`src/shell/`), System Setup and the "What are you building?" chooser (delivers 7.1), the array hub and the system Controllers tab, the single line diagram and Issues list (delivers 7.9), the layout planner redesign (`src/shell/planner/`), and the switch-over: the flag and the classic UI are gone, and the app works from phone width (drawer navigation, cards for ports and panels, a view-only planner below 960 px).
- Planner packing fix (KI-23): rows are packed independently and near-tied layouts rank by fewer panels (`src/lib/layoutRanking.js`), so small leisure panels no longer out-rank efficient modules.
- Phase 6 legal text is a draft without legal advice. The operator is given as "eChook" and the only contact route is GitHub; a private contact address is still needed.
- 4.14: desk research is in `affiliate-research.md` and the 4.1 table is filled. Apply order: Renogy UK (Awin), Bimble, Voltacon (Paid On Results), Sunstore, Butler Technik (Awin, Victron), City Plumbing. Grid-tied and hybrid gear has few affiliate-able consumer retailers, which strengthens the case for the installer-quote lead form (4.13) and for portable power stations (3.10).
- Catalogue: 3.11 mainstream inverters, 3.6 off-grid chargers and 3.7 small and flexible panels are in. The Hypontech micro is still outstanding. SolarEdge is out of scope (D7). Photonic Universe and Sunbeam are left out until they publish full datasheets (D8). Plug-in solar is out of scope (D11).
- Catalogue review (3.3) is human work and stands at 2 of 66 sellable products. Review status stays internal.
- The weekly catalogue refresh (3.12) runs but can't open its PR: the repository needs "Allow GitHub Actions to create and approve pull requests" enabled (Settings → Actions → General). The stale `bot/catalogue-refresh` branch from 2026-09-28 holds only datasheet fingerprints.

## Next up
- M1 ("Safe to share"): the 3.3 reviews toward the 80% target (the main blocker), the README screenshot (0.7), and the owner's phase 6 items: 6.8 licence strategy, 6.9 trademark check, 6.4 Amazon rules (decided through 4.14) and 6.11 accessibility.
- 1.13 per-MPPT input limits (the Fronius GEN24 records understate the larger tracker).
- Finish 4.14 (trust signals, Bimble T&Cs, Voltacon's current rate, emails to TradeSparky, Fogstar and 12 Volt Planet), then the owner applies to programmes in the ranked order (4.1).
- Phase 13 leftovers: computed fixes in the Issues list (7.6), planner touch editing and card views for the summary, BoM and Library tables (7.7).

## Open decisions
- Keep the UK-only focus, or add region/currency support (D6)?
- Retailer ordering policy (D3) and licence strategy (D4).
- Vite SPA with pre-rendering vs Astro/Next (D5).
- Hosting is decided (D10: Cloudflare, resolving D2) but not yet built.
