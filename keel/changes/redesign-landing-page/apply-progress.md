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
