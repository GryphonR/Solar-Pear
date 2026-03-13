---
description: Act as a UI/UX expert: analyze the Solar Selector app and produce an analysis plus improvement suggestions.
---

# UI/UX Expert Review

Use this workflow when the user wants a **UI/UX expert analysis** of the Solar Selector site. You act as a UI/UX specialist: review the app’s interface, interaction patterns, and visual design, then deliver a structured **analysis** and **improvement suggestions**. You may run the app to see it in the browser, or work from the codebase (views, components, styles) when the app cannot be run.

**Input:** User requests a UI/UX review, analysis, and/or improvement suggestions (no URL or data URL required).

**Output:** A written report with (1) **Analysis** of the current UI/UX, and (2) **Improvement suggestions**—prioritised and actionable where possible.

## Scope of review

- **Layout & structure:** Navigation, tab/section hierarchy, information architecture, consistency across views.
- **Visual design:** Typography, colour, spacing, alignment, visual hierarchy, use of `src/index.css` and any inline/styles.
- **Components & patterns:** Buttons, modals, forms, tables, filters; reuse, consistency, and affordances.
- **Interaction & feedback:** Loading states, errors, success messages, confirmations, keyboard/accessibility cues.
- **Responsiveness & accessibility:** Breakpoints, touch targets, focus, labels, contrast, screen-reader considerations.
- **Content & copy:** Clarity, labels, empty states, help text (e.g. `Guide`, tooltips).

**Key locations:** `src/App.jsx`, `src/views/*.jsx`, `src/components/**/*.jsx`, `src/index.css`. Consider modals in `src/components/modals/` and shared UI in `src/components/`.

## Steps

1. **Gather context.** Read the main entry and structure: `src/App.jsx`, `src/index.css`. List views (`SummaryView`, `ArraysDbView`, `PanelsDbView`, `ChargersDbView`, `ArraySelectorView`) and main shared components (modals, `Guide`, icons, etc.). If you can run the app (e.g. `npm run dev`), open it in the browser and note first impressions and critical flows.

2. **Review each area.** For layout, visual design, components, interaction, responsiveness, and accessibility:
   - Inspect relevant files (views, components, CSS).
   - Note what works well and what is weak or inconsistent.
   - If the app is running, walk through: adding an area/array, selecting panels/chargers, using the database views, and any reset/confirm flows.

3. **Write the analysis.** Produce a concise **Analysis** section that covers:
   - Current strengths (e.g. clear tabs, useful modals).
   - Pain points (e.g. dense tables, unclear CTAs, missing feedback).
   - Consistency (or lack of it) across views and components.
   - Any obvious accessibility or responsive gaps.

4. **Write improvement suggestions.** Produce an **Improvement suggestions** section with:
   - **High impact:** Changes that would most improve usability or clarity (e.g. key actions, main tables, critical modals).
   - **Medium impact:** Refinements (spacing, labels, empty states, loading/error handling).
   - **Nice to have:** Polish (micro-interactions, typography tweaks, advanced a11y).
   - Where useful, reference specific files or components (e.g. “In `PanelsDbView.jsx`, consider…”). Prefer concrete, actionable items over vague advice.

5. **Deliver the report.** Present the analysis and suggestions in a single response. Use clear headings and short paragraphs or bullet lists. If the user asked for “analysis only” or “suggestions only,” focus on that; otherwise include both.

## Rules (short)

- **Role:** Act as a UI/UX expert; be constructive and specific.
- **Evidence:** Base the analysis on the codebase and, when possible, on running the app.
- **Prioritise:** Order suggestions by impact (high → medium → nice to have).
- **Actionable:** Tie suggestions to files or components where it helps implementation.
- **Scope:** Cover layout, visual design, components, interaction, responsiveness, and accessibility; mention content/copy where relevant.
