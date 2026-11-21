# Apply Progress: redesign-landing-page

## WU1: Playwright harness (branch feat/landing-redesign-wu1-playwright) - DONE
Tasks 1.1-1.5 complete. Not committed.

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.4 | e2e/smoke.spec.ts | e2e | pnpm test 86/86 | `pnpm test:e2e` -> script not found; then with config, fails "Executable doesn't exist" (no chromium) | `playwright install chromium` -> 1 passed | n/a (infra smoke, single behavior) | none needed |

### Files
- package.json: `@playwright/test` 1.65.1 (exact pin, engines node>=20), script `test:e2e`
- pnpm-lock.yaml updated; `pnpm install --frozen-lockfile` is up to date
- playwright.config.ts (new), e2e/smoke.spec.ts (new), .gitignore (+test-results/, playwright-report/)

### Commands that work
- `pnpm exec playwright install chromium` (one-time per machine; chromium_headless_shell-1255)
- `pnpm test:e2e` (builds, serves on 4173 strictPort, runs; ~7s). Fails if port 4173 is busy (reuseExistingServer false).
- Gates: `pnpm test` (11 files/86 tests), `pnpm exec vue-tsc -b`, `pnpm build` all green.

### Notes for later units
- Local Node is v26 (Dockerfile/target Node 22; Playwright needs >=20).
- `pnpm build` rewrites tracked tsconfig.app.tsbuildinfo: run `git checkout tsconfig.app.tsbuildinfo` before staging. Do not stage dist, test-results, playwright-report.
- e2e/ and playwright.config.ts are outside vitest include (`src/**/*.spec.ts`) and tsconfig includes (src only; node config includes vite.config.ts only), so no changes were needed.
- serviceWorkers are blocked in config (no SW interference); WU8.4 precache check must use build output, not e2e.
- Untracked public/go-eats-wordmark-svg-variantes/ pre-existed; belongs to WU2.5, not touched.

### Deviations
None.

## WU2: Tokens, assets, BrandLogo (branch feat/landing-redesign-wu2-tokens-brand) - DONE
Tasks 2.1-2.7 complete. Not committed.

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1/2.2 | src/components/landing/tokens.spec.ts | unit | pnpm test 86/86 | suite failed: `TypeError: bandPairsFor is not a function` | 55/55 pass | token values, dark lacks band keys, pairsFor has no band labels, label list, 4.5 vs 3 minimums, 8 pair ratios | none needed |
| 2.3/2.4 | src/components/landing/landing.spec.ts | unit | tokens 55 + landing 8 pass | 8 failed (light mirror lacks band tokens; dark rules present; no literal 16/12px radii; no band classes; no smooth-scroll media; no main:focus / scroll-padding) | 89/89 in components/landing | light mirror equality + band token presence + dark-value leak scan + three forbidden strings | reworded own CSS comment that tripped the `prefers-color-scheme` scan |
| 2.6 | src/components/landing/BrandLogo.spec.ts | component | n/a (new) | `Failed to resolve import ./BrandLogo.vue` | 4 pass | added aspect-ratio case (sobre-indigo viewBox 631x330, color 551x250) after finding sizes differ: 5 pass | none |
| 2.5/2.7 | n/a (assets/import) | build | n/a | n/a | build + e2e green | n/a | n/a |

### Final token values and ratios (no adjustment needed; thresholds untouched)
| Pair | Ratio | Min |
|------|-------|-----|
| ink #0B2B33 on amber-tint #FFF1D6 | 13.36 | 4.5 |
| ink-soft #44585E on amber-tint | 6.71 | 4.5 |
| ink-soft on primary-tint #D6F5F0 | 6.48 | 4.5 |
| primary-text #00796B on amber-tint | 4.76 | 4.5 |
| on-indigo #FFFFFF on indigo #2E2A7A | 12.15 | 4.5 |
| on-indigo-soft #C9C7F0 on indigo | 7.47 | 4.5 |
| primary #00B19D vs indigo (UI) | 4.50 | 3 |
| primary-lip #008F7D on primary-tint (UI) | 3.48 | 3 |
amber #FFB62E is decorative only; no band pair enforced for it.

### Files changed
- src/components/landing/tokens.ts: +5 light tokens, new `bandPairsFor`; `dark` and `pairsFor` untouched
- src/components/landing/tokens.spec.ts: +band describe; dark loop untouched
- src/components/landing/landing.css: removed prefers-color-scheme and .dark/[data-theme] blocks; added band tokens, `.lp-card` (16px), `.lp-band-{bg,surface,primary-tint,amber-tint,indigo}`, literal 12px button radius, smooth scroll under no-preference, `:root:has(.landing)` scroll-padding 5rem, `.landing main:focus` outline none
- src/components/landing/landing.spec.ts: dark tests replaced by light-only forbids; new rule tests
- src/components/landing/BrandLogo.vue + BrandLogo.spec.ts (new)
- src/views/landing/LandingView.vue: +`@fontsource/nunito/latin-400.css` import
- src/assets/brand/: color, color-sin-swoosh, sobre-indigo, sobre-turquesa, sobre-ambar (moved, untracked)
- docs/brand/wordmarks/: all 22 SVGs (copied first; 22 files, 202853 bytes, per-file byte sizes diffed identical before any mv). The 5 moved files also remain here as copies.
- public/go-eats-wordmark-svg-variantes/: removed (nothing under public/ remains)

### Build / precache
- Before (22 wordmarks in public/): 56 entries, 816.55 KiB
- After: 35 entries, 635.02 KiB; 0 wordmark files in dist (BrandLogo not yet used by LandingView, so its assets are tree-shaken; expect 2 once WU3 wires it). Nunito 400 woff2 emitted (16.32 kB).
- Gates: pnpm test 12 files/108 tests, vue-tsc -b OK, pnpm build OK, pnpm test:e2e 1 passed. tsconfig.app.tsbuildinfo restored.

### Deviations
- BrandLogo sets width/height per variant (631x330 for sobre-indigo): its viewBox differs from color; avoids layout shift.
- Added `.lp-band-bg` and `.lp-card` (16px) beyond the listed bands: needed for the bg band in the design order and the literal 16px radius.
- Old .lp-hero/.lp-tile/.lp-icon-chip rules kept (still used by HeroTile/Bento until WU3).

### Remaining
WU3-WU8.

## WU3: Nav, hero, view composition (branch feat/landing-redesign-wu3-nav-hero) - DONE
Tasks 3.1-3.6 complete. Not committed. Size exception (~600 added) user-approved.

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1 | src/components/landing/LandingNav.spec.ts | component | pnpm test 108/108 | suite failed: `Failed to resolve import ./LandingNav.vue` | 6 pass | skip link first + text, click focuses main, one nav/sticky header, colour wordmark, anchors + `hidden md:flex`, single secondary CTA | none |
| 3.2 | src/components/landing/HeroVisual.spec.ts | component | existing 3 specs | 6 of 7 failed (no aria-hidden root, no `.lp-phone-row`, no palette tokens, Bike icon present) | 7 pass | labels in order, one current row, frame+screen, tokens, no Bike/digits, slot override | typed `ESTADO_LABELS` via `src/mockData.d.ts` after vue-tsc TS7016 |
| 3.3 | src/components/landing/HeroSection.spec.ts (git mv from HeroTile.spec) | component | existing HeroTile spec | 3 of 7 failed (no `.lp-lead`, no band class, no `hero-note`) | 7 pass | h1/aria-labelledby, one primary /tiendas, secondary /login, router navigation, band + hidden visual, cash note | none |
| 3.4 | src/views/landing/LandingView.spec.ts + landing.spec.ts | view/css | existing view spec | view suite failed on import of deleted HeroTile path; landing.spec 3 failed (`.lp-phone`, retired classes, `.lp-lead`/`.lp-skip`) | 115/115 | one header/nav/main/footer, child order A-HEADER-MAIN-FOOTER, skip target `main#contenido[tabindex=-1]`, footer sobre-indigo on indigo band, no old tile content | removed retired `.lp-hero/.lp-tile/.lp-tile-brand/.lp-icon-chip` CSS (no users); `text-wrap: balance` and narrower mobile phone after visual review |
| 3.5 | n/a (deletion) | - | - | - | rg for Bento/HeroTile/tiles/lp-tile/lp-icon-chip finds only the two negative assertions | n/a | n/a |

### Files
- New: LandingNav.vue(+spec), src/mockData.d.ts (types ESTADO_LABELS only)
- Renamed+rewritten: HeroTile -> HeroSection (+spec); rewritten: HeroVisual (+spec), LandingView.vue (+spec)
- Modified: landing.css (+lp-lead, lp-phone*, lp-skip, lp-nav-link, text-wrap balance; -hero/tile/icon-chip), landing.spec.ts (+3 tests)
- Deleted: BentoGrid, BentoTile, tiles.ts and 2 specs
- `git diff --stat HEAD` (intent-to-add): 17 files, 399 insertions, 269 deletions

### Gates
pnpm test 11 files/115 tests; vue-tsc -b OK; pnpm build OK (dist wordmarks: color + sobre-indigo only; precache 36 entries 654 KiB); pnpm test:e2e 1 passed. tsconfig.app.tsbuildinfo restored.

### Visual self-review (throwaway Playwright script in scratchpad; preview on 4173 stopped)
360x800 and 1440x900: no horizontal overflow. Fixed: h1 widow via text-wrap balance; phone narrower on mobile so the primary circle shows. Remaining flaws: (1) ~60px white strip under the footer at 1440x900 until WU4+ add height; (2) display size 36/48px per design feels modest in the 1200px container; (3) sobre-indigo wordmark looks slightly indented in the footer (padded rect); (4) nav anchors #como-funciona, #cobertura, #preguntas are dead until WU4/5/7 add ids (md+ only); (5) hero art is shapes plus phone mock only, no mascot or photo. WU8 real-browser review still required.

### Deviations
- Added `src/mockData.d.ts`: vue-tsc TS7016 on importing mockData.js from a lang="ts" component; declares only `ESTADO_LABELS`.
- Hero adds an eyebrow pill and a cash-on-delivery note (RF-10); no digits, prices or times.
- App.spec.ts untouched: it stubs the landing, so `main#landing-main` there is independent of `main#contenido`.

### Remaining
WU4-WU8.

## WU4: Categories, steps, role panels (branch feat/landing-redesign-wu4-sections) - DONE
Tasks 4.1-4.5 complete. Not committed.

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.1 | src/components/landing/content.spec.ts | unit | pnpm test 115 | suite failed: `Failed to resolve import ./content` | pass | exact ENVIO_COPY, steps 1-4 order, 3 points per role, prohibited-claims + no-digit scan, no price words | test regex tightened to `\bvisa\b` ("revisa" false positive) |
| 4.2 | CategoryStrip.spec.ts | component | same | failed: cannot resolve `./CategoryStrip.vue` | pass | names in order, aria-hidden svg per chip, no digits, no a/button/tabindex, labelled section | none |
| 4.3 | StepsSection.spec.ts | component | same | failed: cannot resolve `./StepsSection.vue` | pass | id como-funciona, 4 li numbered 1-4, h3s, cash + shipping sentence, aria-hidden, no links/articles | none |
| 4.4 | RolePanels.spec.ts | component | same | failed: cannot resolve `./RolePanels.vue` | pass | two sections/ids/bands, one /login lp-btn-secondary each, router navigation (flushPromises), h3s, no digits | DOM order copy-first for mobile after visual review |
| 4.5 | LandingView.spec.ts + landing.spec.ts | view/css | same | new order/heading/one-primary tests | pass | section order, heading levels, one solid primary, anchor exists, hero-CTA test scoped to hero section | none |

### Files
New: content.ts, CategoryStrip.vue, StepsSection.vue, RolePanels.vue (+4 specs). Modified: landing.css (+.lp-title, .lp-eyebrow, .lp-chip, .lp-icon-disc, .lp-step*), landing.spec.ts (+2), LandingView.vue (+wiring), LandingView.spec.ts (+5, 1 scoped).
No new token pairs needed: ink/ink-soft/primary-text on surface/bg/amber-tint, on-indigo(-soft) on indigo, ink on bg (secondary CTA on bands), primary on indigo (icons) are all already covered.

### Gates
pnpm test 15 files/145 tests; vue-tsc -b OK; pnpm build OK; pnpm test:e2e 1 passed.

### Visual self-review (360x800, 1440x900; no horizontal overflow; preview stopped)
Fixed: couriers copy came after its list on mobile (reordered DOM). Remaining flaws: (1) 8 chips wrap 6+2 at desktop; (2) step icon above each title adds a little redundancy with the numeral; (3) band order is currently white, surface, indigo, amber, indigo footer until WU5 inserts stores/coverage; (4) no mascot/photo; (5) nav anchors #cobertura and #preguntas still dead until WU5/7.

## WU5a: Data layer and stores (branch feat/landing-redesign-wu5a-data-stores) - DONE
Tasks 5.1, 5.2 and the stores part of 5.6 complete. 5.3-5.5 and the coverage wiring remain for WU5b. Not committed.

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 5.1 | src/composables/useLandingData.spec.ts | unit | pnpm test 145/145 | suite failed: `Failed to resolve import ./useLandingData` | 10 pass | filter activo, cap 6 (8 in), `/merchants/` + `/zones/` with `timeout: 5000` and AbortSignal, empty + non-array payload, both fail => error + exactly one warn + no console.error, only zones fail => stores kept + slug label, abort on unmount silent, zone name lookup vs humanized slug, only 5 public keys | none |
| 5.2 | src/components/landing/StoresSection.spec.ts | component | same | suite failed: `Failed to resolve import ./StoresSection.vue` | 11 pass (one assertion rewritten: textContent concatenates block elements) | ready/loading/empty/error, icon resolver known/unknown/prototype names, no promo words in any state, no digits/price/ETA/fee/open claims, single secondary /tiendas link, no role=alert | none |
| 5.6 (stores) | src/views/landing/LandingView.spec.ts | view | same | 3 failed: section order lacked stores, h2 list lacked title, no fallback tile | 167/167 | order, headings, API-down fallback with a single warn and the other sections intact | mobile tiles made horizontal after visual review |

### Files
New: src/composables/useLandingData.ts (+spec), src/components/landing/StoresSection.vue (+spec), src/components/landing/storeIcons.ts. Modified: content.ts (+STORES_COPY), landing.css (+.lp-store-*), LandingView.vue (+composable and section), LandingView.spec.ts (api mock, +order/heading/fallback tests), tasks.md.

### Decisions
- `useLandingData()` returns `{ estado, loading, empty, error, tiendas, zonas, zonasError }`; WU5b reuses `zonas` (active only, `{id, slug, name}`). LandingView owns the single fetch and passes props to a presentational StoresSection (no duplicate requests).
- Section id is `tiendas` (the merchants panel already owns `comercios`).
- Stores failing and zones failing are independent; any failure logs one `console.warn`; aborted requests are silent.
- Gates: pnpm test 17 files/167 tests, vue-tsc -b OK, pnpm build OK, pnpm test:e2e 1 passed. tsconfig.app.tsbuildinfo restored.

### Visual self-review (API mocked via page.route, preview stopped; scratchpad outside repo)
360x800 and 1440x900, ok / error / pending: no horizontal overflow, 6 tiles (inactive and 7th+ dropped), error shows the static message with one warn. Fixed: stacked tall tiles on mobile became a horizontal icon+text row. Remaining flaws: 3-column grid has no photo/imagery per store; 1 icon per tile only (unknown icon falls back to Store); the browser logs `net::ERR_FAILED` for aborted requests (browser-level, not app code).
