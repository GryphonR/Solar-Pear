# Active context

## Current state (2026-09-25)
- `main` is at `5507f6a` and in sync with origin. Tests are green (283) and the build succeeds.
- The most recent work was catalogue verification tooling, a UK panel expansion, faster UI tests, and softening the Isc/Vmp checks to warnings.

## Direction
The full plan lives in [roadmap.md](roadmap.md). The summary below is the short version.

The owner wants a **public launch monetised by affiliate links**. Priorities agreed in principle (not yet started):
1. Fix correctness issues that could cost users money or hardware (known-issues 1–5, 9–10) before driving traffic.
2. Affiliate plumbing: an affiliate-network-aware link model, disclosure, click tracking, and making sure the pricing scanner doesn't strip affiliate params.
3. Discoverability: URL routing, per-product SEO pages, meta/OG tags, and a custom domain.
4. Trust: reviewed-data badges, datasheet links, "prices checked on" dates, and a disclaimer/T&Cs.

## Open decisions
- Keep the UK-only focus, or add region/currency support (EU/US retailers and design temperatures)?
- Hosting: stay on GitHub Pages, or move to Cloudflare Pages/Netlify for redirects (`/go/<id>` affiliate redirects), analytics and headers?
- Isc overage severity (see domain-rules.md).
