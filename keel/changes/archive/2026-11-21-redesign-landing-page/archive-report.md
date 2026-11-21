# Archive Report: Redesign Landing Page

- Verdict: PASS WITH WARNINGS (0 CRITICAL)
- Tasks: 44/45 complete (8.6 user visual review left unchecked; accepted by the user's decision to archive)
- Capabilities synced: `landing-page` -> `keel/specs/landing-page/spec.md`
  - ADDED: 17 (Marketplace sections, Responsive layout, Fixed light theme, Sticky navigation and skip link, Brand wordmark, Hero visual, Category strip, How it works steps, Featured stores, Coverage, Merchant and courier panels, App install section, FAQ accordion, CTA styles, Final CTA band and footer, Copy integrity, Real-browser verification)
  - MODIFIED: 1 (Accessibility)
  - REMOVED: 3 (Bento tiles, Responsive grid, Theme tokens)
  - Preserved untouched: Public root route, Hero tile, Call-to-action routing, Flat visual style, Spanish copy
- Artifacts: proposal, exploration, clarifications, blast-radius, design, specs/landing-page, tasks, apply-progress, verify-report, archive-report
- Completed: 2026-11-21

## Delivery
- Delivered as PRs #9-#17, plus map fix #18.
- PR #18 replaced the "OpenStreetMap / CARTO" caption with "© OpenStreetMap contributors" (`src/utils/mapTiles.ts`), because CARTO needs an API key. The delta's correction note was applied: the main spec's Coverage requirement now states the OpenStreetMap attribution.
- Later touched by #24 (HeroVisual status keys) and #43 (CoverageMap tracking honesty; does not affect the landing's `estatico` mode).

## Carried-over warnings
- 8.6: human visual review not recorded.
- 8.5: SW update for a returning visitor on an older build not observed end to end (only the mechanism was checked).

## Suggestions
- Production tile provider via `VITE_MAP_TILE_URL` (OSM public tiles policy: light, non-commercial use).
- Dead Caddy rule for `registerSW.js` (file not present in the build).

## Merge proof
- No `### Requirement: Bento tiles|Responsive grid|Theme tokens` headings remain in the main spec.
- Exactly one `### Requirement: Accessibility`.
- Each ADDED heading present exactly once (no duplicate requirement headings).
