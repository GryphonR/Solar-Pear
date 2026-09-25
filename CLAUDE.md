# Solar Pear

Project context lives in `memory-bank/`. Work is planned in `memory-bank/roadmap.md`: reference task IDs in commits (e.g. `fix(1.3): ...`), tick tasks off when merged, and update the progress table. Keep `known-issues.md` and `active-context.md` current.

@memory-bank/README.md
@memory-bank/project-brief.md
@memory-bank/architecture.md
@memory-bank/domain-rules.md
@memory-bank/known-issues.md
@memory-bank/active-context.md
@memory-bank/roadmap.md

## Commands
- `npm run dev` starts the dev server. `npx vitest run` runs all tests, including data-admin and verification_scripts. `npm run build` does the production build.
- Data tooling: `npm run verify:panels:review`, `npm run verify:panels:pricing` (needs `SERPER_API_KEY` in `.env`).
