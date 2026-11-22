# Verification Report: Redesign Landing Page

Verified 2026-11-21 on `develop` (PRs #9-#17, map tiles fix #18).

## Completeness
| Task | Status |
|------|--------|
| 1.1-8.5 (39 core tasks) | [x] done |
| 8.6 user visual review | [ ] open (WARNING) |
| 9.1 archive merge | [ ] open (expected, sdd-archive) |

## Execution Evidence
- `pnpm test` -> 69 files, 1260 passed, 0 failed, exit 0
- `pnpm exec vue-tsc -b` -> exit 0
- `pnpm test:e2e` -> 177 passed, 0 failed, exit 0 (landing: 18 tests in `e2e/landing.spec.ts` and `e2e/landing-behavior.spec.ts`)
- Build output (from the e2e build): `dist/sw.js` precaches exactly 2 wordmarks (`color`, `sobre-indigo`); no Leaflet in `dist/assets/index-*.js`.
- `tsconfig.app.tsbuildinfo` restored; nothing staged.

## Spec Compliance Matrix (evidence by file)
| Requirement | Evidence | Status |
|---|---|---|
| Marketplace sections (order, neutral title, decorative icons) | LandingView.spec, StoresSection.spec, CategoryStrip.spec, RolePanels.spec | PASS |
| Responsive layout | e2e landing: no overflow 360x800 / 1440x900 | PASS |
| Fixed light theme | landing.spec (no dark rules, light block), e2e cascade (OS dark, html.dark) | PASS |
| Sticky nav and skip link | LandingNav.spec (single nav, `hidden md:flex`), e2e skip link, sticky, anchors | PASS |
| Brand wordmark | BrandLogo.spec, LandingFooter.spec (sobre-indigo), dist precache check | PASS |
| Hero visual | HeroVisual.spec, HeroSection.spec | PASS |
| Category strip | CategoryStrip.spec | PASS |
| How it works steps | StepsSection.spec | PASS |
| Featured stores | useLandingData.spec, StoresSection.spec, e2e API states (fulfilled, aborted, delayed) | PASS |
| Coverage | CoverageSection.spec, CoverageMap.spec, mapTiles.spec, e2e lazy map, caption, no geolocation/dialog | PASS |
| Merchant and courier panels | RolePanels.spec | PASS |
| App install section | useInstallPrompt.spec, InstallSection.spec, PwaStatus.spec, e2e install | PASS |
| FAQ accordion | FaqSection.spec, e2e FAQ keyboard | PASS |
| CTA styles | LandingView.spec ("one solid primary per viewport"), CtaBand.spec | PASS |
| Final CTA band and footer | CtaBand.spec, LandingFooter.spec, LandingView.spec (`router.resolve`, anchors) | PASS |
| Copy integrity | content.spec (exact shipping sentence), copy scan incl. aria-hidden | PASS |
| Real-browser verification | e2e/landing*.spec.ts, `serviceWorkers: 'block'`, `page.route` | PASS |
| Accessibility (MODIFIED) | tokens.spec (light + band pairs), landing.spec (44px, focus ring, reduced motion), e2e reduced motion, landmarks | PASS |
| REMOVED Bento tiles / grid / theme tokens | files deleted, superseded by the above | PASS |

Requirements with no automated proof: none. Two sub-scenarios rely on documented manual evidence instead of a test: Traceability to RFs (apply-progress 7.5 checklist) and "no SVG recolored" (BrandLogo.spec checks the imported asset only).

## Design Coherence
All Architecture Decisions hold (single `landing.css`, literal radii, `bandPairsFor`, `<img>` wordmark, reduced-motion-only smooth scroll, Bento code deleted). The CARTO caption was superseded by the documented correction (OSM, `src/utils/mapTiles.ts`).

## Security (security_review ON)
No `v-html`/`innerHTML` in landing sources; RouterLink and `href` targets come from static `content.ts` constants; no `window.location` redirects (no open redirect); no secrets; data calls are public GETs `/merchants/` and `/zones/` only. No findings.

## Observability
Matches the design: silent fallback with one `console.warn` per failed section (useLandingData.spec), no new endpoints.

## Issues
### CRITICAL
- None.
### WARNING
- Task 8.6: human visual review not recorded.
- 8.5: an SW update for a returning client on an older build was not observed end to end (only the mechanism was checked).
### SUGGESTION
- OSM public tiles are for light, non-commercial use; set `VITE_MAP_TILE_URL` to a keyed provider for production.
- The Caddy rule for `registerSW.js` is dead (that file does not exist in the build).

## Verdict: PASS WITH WARNINGS
