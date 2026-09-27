# Active context

## Current state (2026-09-26)
- `main` is at `adb2294` (phases 0–2 done, phase 3 mostly done; see the roadmap progress table).
- Branch `feat/uk-inverters` adds 42 mainstream UK inverters for task 3.11 (Sunsynk, Growatt, Lux Power, Fronius, SMA, Sigenergy, Tesla Powerwall 3), plus 14 Deye and Fogstar models. SolarEdge and the Hypontech micro are still outstanding.
- Catalogue review (3.3) is human work and stands at 2 of 66 sellable products. Review status stays internal.

## Direction
The full plan lives in [roadmap.md](roadmap.md). The summary below is the short version.

The owner wants a **public launch monetised by affiliate links**. Priorities agreed in principle (not yet started):
1. Fix correctness issues that could cost users money or hardware (known-issues 1–5, 9–10) before driving traffic.
2. Affiliate plumbing: an affiliate-network-aware link model, disclosure, click tracking, and making sure the pricing scanner doesn't strip affiliate params.
3. Discoverability: URL routing, per-product SEO pages, meta/OG tags, and a custom domain.
4. Trust: datasheet links, "prices checked on" dates, a methodology page, and a disclaimer/T&Cs. Review status stays internal and is not shown to users.

## Open decisions
- Keep the UK-only focus, or add region/currency support (EU/US retailers and design temperatures)?
- Hosting: stay on GitHub Pages, or move to Cloudflare Pages/Netlify for redirects (`/go/<id>` affiliate redirects), analytics and headers?
- Isc overage severity (see domain-rules.md).
