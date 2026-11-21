# Verification Report: Public Landing Page (add-landing-page)

Branch develop, WU1-4 merged. Date 2026-11-20. Mode: strict_tdd ON, security_review ON.

## Completeness
| Task group | Status |
|---|---|
| WU1 1.1-1.6, WU2 2.1-2.5, WU3 3.1-3.4, WU4 4.1-4.5 | 20/20 [x] |
| WU5 5.1-5.4 | 4/4 marked [x] by this verify (evidence below) |
| D1-D5 | accepted |

## Execution Evidence
- `pnpm test` -> 11 files, 74 passed, 0 failed, exit 0.
- `pnpm exec vue-tsc -b` -> exit 0 (tsbuildinfo restored with git checkout; `pnpm build` re-dirties it, restored again; tree clean).
- `pnpm build` -> exit 0. PWA precache 34 entries, 618.39 KiB. LandingView chunk 6.14 kB JS + 3.81 kB CSS (lazy). Index 221.74 kB unchanged. No spec files in dist. dist is gitignored, nothing staged.
- Fonts: 4 woff2 + 4 woff (latin only) ~172 KiB of the precache (+38% over ~447 KiB). Acceptable, noted as SUGGESTION.
- `pnpm install --frozen-lockfile` -> "Already up to date", exit 0 (lockfile is tracked).
- `docker build .` (daemon available) -> succeeded, exit 0 (frozen-lockfile + pnpm build inside node:22-slim). Temp image removed.
- 5.4: `pnpm exec vite preview` served `/` 200 and `/sw.js` 200. curl cannot execute the SPA, so no-toast/no-TopBar is proven by tests: `src/App.sync.spec.ts` (real store, api.get rejects, `notificacion` null, no toast element) and `src/App.spec.ts` (no TopBar and no nested main at `/`, TopBar at `/tiendas`). Not a real browser visit.

## Spec Compliance Matrix
### frontend-testing
| Requirement | Scenario | Implementation | Test / evidence | Status |
|---|---|---|---|---|
| Tooling installed | Dependencies present | package.json, lockfile | frozen-lockfile exit 0 (run) + docker build | PASS |
| Single command | Passing suite | `test: vitest run` | pnpm test exit 0 | PASS |
| Single command | Failing suite | vitest default | No dedicated test; RED runs recorded in apply-progress (exit 1). Not re-run | PASS (evidence-only, WARNING) |
| DOM environment | Mounting | jsdom in vite.config.ts | smoke.spec.ts + all component specs | PASS |
| Spec discovery | Colocated spec | include `src/**/*.spec.ts` | colocated specs executed (11 files) | PASS |
| Smoke spec | Smoke passes | src/smoke.spec.ts | passes | PASS |
| Strict TDD usable | Red then green | runner | RED/GREEN tables in apply-progress for every task | PASS |
| Coexistence | Build unaffected | tsconfig, vite config | vue-tsc and build exit 0, no spec in dist | PASS |

### landing-page
| Requirement | Scenario | Implementation | Test | Status |
|---|---|---|---|---|
| Public root | Anonymous visit | router.ts `/` name landing | router.spec.ts, App.spec.ts, preview `/` 200 | PASS |
| Public root | Existing routes | catch-all kept | router.spec.ts (`/tiendas`, `/login`, catch-all) | PASS |
| Hero | Hero content | HeroTile, HeroVisual | HeroTile.spec, HeroVisual.spec, LandingView.spec (one h1, two CTAs, decorative visual) | PASS |
| CTA routing | Primary | RouterLink /tiendas | HeroTile.spec (href + click) | PASS |
| CTA routing | Secondary | RouterLink /login | HeroTile.spec (href + click) | PASS |
| Bento | Six tiles | tiles.ts, BentoGrid | BentoGrid.spec | PASS |
| Bento | Decorative icons | aria-hidden | BentoTile.spec, LandingView.spec | PASS |
| Responsive | Mobile 360px | grid-cols-2 | Column classes asserted in BentoGrid.spec; no-overflow at 360px NOT tested (jsdom has no layout) | UNTESTED (partial) |
| Responsive | Tablet/desktop | md:4, lg:12 | BentoGrid.spec (2/4/12, rows sum 12) | PASS |
| Theme tokens | Dark preference | media block | landing.spec (CSS text, equal to tokens.ts) | PASS (static) |
| Theme tokens | Class override | .dark, [data-theme] | landing.spec | PASS (static) |
| Flat style | No effects | landing.css | landing.spec, BentoGrid.spec, HeroVisual.spec | PASS |
| A11y | Contrast | tokens.ts | tokens.spec (35 tests, light+dark) | PASS |
| A11y | Targets and focus | .lp-btn, .lp-link 44px, :focus-visible | landing.spec on .lp-btn (CSS text). .lp-link has min 44px in CSS (lines 152-162) but landing.spec only covers .lp-btn | PASS (static, see WARNING) |
| A11y | Reduced motion | media block | landing.spec | PASS (static) |
| A11y | Landmarks | LandingView | LandingView.spec, App.spec (no nested main) | PASS |
| Spanish copy | Language | copy, index.html lang="es" | LandingView.spec "Spanish copy" (copy); `lang="es"` verified by reading index.html, no spec | PASS (lang untested, WARNING) |

Scenarios with no runtime proof: 360px no horizontal overflow (UNTESTED, layout needs a browser); real-browser 4.5:1 / focus ring / dark rendering are static-only by design (jsdom limits).

## Design Coherence
- Lazy landing route, App shell `esLanding` + `<component :is>` wrapper, scoped `--lp-*` tokens, tokens.ts as source of truth, vitest config: all as designed.
- Deviations (all documented in apply-progress, no spec break): view at `src/views/landing/LandingView.vue` (design said `src/views/`); jsdom ^26 and vitest ^2.1.9 instead of design pins; `test.css.include` for landing.css; latin-only font imports; hover #00A491 kept, #009C8A rejected as designed; `.lp-display` instead of `.text-display`. -> SUGGESTION: update design.md paths.
- Observability: client-only, no new error paths. No gap.
- Design test table said `lang="es"` spec; none exists.

## Security review (diff 7088dfc..HEAD for src, package.json, vite.config.ts, lockfile)
- XSS: no `v-html`, `innerHTML`, `eval`, `window.location` in the changed files. All copy is static template text. PASS.
- Open redirects: four RouterLinks, all static literals `/tiendas` and `/login`; no user-controlled `to`/query. PASS.
- Dependencies: package.json and lockfile had no diff in this range (added in WU1, already merged). New runtime deps are `@fontsource/*` (static font CSS/files, no scripts); dev deps vitest 2.1.9, @vue/test-utils, jsdom 26 are not in the bundle. Fonts are self-hosted (no new third-party origin). vitest 2.x is not latest (5.x): no `pnpm audit` was run -> SUGGESTION.
- CSP/service worker: no CSP in index.html or Caddyfile, so nothing is broken by new fonts; self-hosted fonts would be CSP-friendly. SW precaches the landing chunk, `/` start_url (D1 accepted); `/sw.js` served no-cache by Caddy. Precache +172 KiB, no security impact.
- Secrets in diff: none.
- Pre-existing, OUT of scope, not fixed: (a) `backend/app/core/config.py:9` default `JWT_SECRET_KEY="dev-secret-key-change-in-prod-goeats"` and `docker-compose.yml:39` `change-me-in-production-goeats-secret`; (b) default DB/MinIO creds in docker-compose.yml (`goeats_password`, `minioadmin_password`) and config.py:16; (c) `backend/app/main.py:35-39` CORS `allow_origins=["*"]` with `allow_credentials=True` plus wildcard methods/headers; (d) index.html loads Inter from Google Fonts with no CSP/SRI (D5, left untouched). Recommend a separate hardening change.

## Issues
### CRITICAL
- None.
### WARNING
- 360px no-horizontal-overflow scenario has no executable proof (jsdom). Needs a browser/Playwright check or manual verification before release.
- Dark theme, contrast, 44px and focus scenarios are proven only by CSS-text and token math, not rendered.
- `.lp-link` 44px target and focus ring are not asserted by landing.spec (only `.lp-btn`).
- `lang="es"` and "Failing suite" scenarios have no dedicated spec.
- 5.4 was proven by component tests, not a real browser visit with the backend down.
- Remaining task flags in state.yaml still say `ready-for-apply`; update state.
### SUGGESTION
- Update design.md file paths/versions to match what shipped.
- Drop woff fallbacks via globPatterns (already woff2-only glob? verify) to cut ~85 KiB precache.
- Run `pnpm audit`; consider bumping vitest later.
- Add a tiny spec asserting index.html `lang="es"` and `.lp-link` 44px.

## Verdict: PASS WITH WARNINGS
