# Apply Progress: add-landing-page

## WU1: Testing infra (PR1 -> main) - COMPLETE
Tasks 1.1-1.6 done.

### Pins (task 1.1, verified with `pnpm view`)
- vitest ^2.1.9 (latest 5.1.1; 2.x depends on vite ^5.0.0, matches Vite 5.4)
- @vue/test-utils ^2.6.0
- jsdom ^26.1.0 (latest 31.0.1 needs node ^22.22.2||>=24.15; Dockerfile uses floating node:22-slim, so 26.x, node>=18, is safer)
- @fontsource/nunito ^5.3.0, @fontsource/jetbrains-mono ^5.3.0 (runtime deps)

### Files changed
- package.json: `test` script, 5 new deps (other package.json diffs are pre-existing uncommitted work)
- vite.config.ts: `defineConfig` from `vitest/config`, `test` block (jsdom, src/**/*.spec.ts)
- src/smoke.spec.ts: new, 13 lines
- pnpm-lock.yaml: regenerated (5439 lines, untracked in git)
- pnpm-workspace.yaml: unchanged; no allowBuilds needed (install clean, no ignored-build warning)

### Deviations
- jsdom 26 instead of latest (see above).
- 1.2 and 1.3 order: smoke written first, `pnpm test` failed (no script, exit 1); after script+config the first run failed `document is not defined` until the vite.config test block was added (1.4).

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----------|-----|-------|-------------|----------|
| 1.2-1.4 | src/smoke.spec.ts | Unit (infra) | N/A (no runner existed) | pnpm test exit 1 (no script); then "document is not defined" | 1 passed | 2 assertions (component text + jsdom global) | None needed |
| 1.5, 1.6 | n/a (config) | Config | N/A | n/a | frozen-lockfile "Already up to date"; vue-tsc -b exit 0 | n/a | n/a |

### Notes
- pnpm peers: pinia 4.1.0 wants @vue/devtools-api ^8.2.1 (pre-existing, unrelated).
- Not committed (user decides). Lockfile must be committed with package.json (Dockerfile:6-9).

## Remaining
WU2-WU5.

## WU2: Router + App shell (PR2 -> main) - COMPLETE
Tasks 2.1-2.5 done. Not committed.

### Files changed
- src/router.ts: `/` is now `{ name: 'landing', component: () => import('./views/landing/LandingView.vue') }`; catch-all kept (+1/-1)
- src/App.vue: `esLanding` computed, TopBar `v-if="!esLogin && !esLanding"`, wrapper `<component :is="esLanding ? 'div' : 'main'" class="flex-1">` (+4/-3)
- src/views/landing/LandingView.vue: new placeholder (11 lines) with own header/main/footer; real content is WU4
- src/router.spec.ts (31), src/App.spec.ts (57), src/App.sync.spec.ts (43): new

### Deviations
- Stub path is `src/views/landing/LandingView.vue` (per design/lead), not `src/views/LandingView.vue` as tasks 2.2 says.
- 2.5 lives in its own file `App.sync.spec.ts`: it needs the REAL store (a mocked store would make the no-toast assertion vacuous) with only `./services/api` mocked (get rejects). `vi.mock` is file-scoped, so it can't share App.spec.ts.
- App.sync.spec.ts uses one `@ts-expect-error` for importing the untyped JS store (vue-tsc TS7016).

### Blast-radius finding: anonymous `/` with backend down
No toast. `sincronizarConBackend` (useGoEatsStore.js:141-298) wraps everything in try/catch with a silent catch and never calls `notificar`; the axios response interceptor (services/api.ts:58) does not notify either. Confirmed by App.sync.spec.ts (get called, `store.notificacion` null, no toast element). No code change needed.

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----------|-----|-------|-------------|----------|
| 2.1-2.2 | src/router.spec.ts | Unit | smoke 1/1 | name 'stores' != 'landing' (redirect) | 3 passed | `/`, catch-all, `/tiendas`+`/login` | None |
| 2.3-2.4 | src/App.spec.ts | Component | smoke 1/1 | TopBar present on landing (expected absent) | 2 passed | landing vs /tiendas (TopBar, main count, tag of .flex-1) | None |
| 2.5 | src/App.sync.spec.ts | Component (real store) | n/a | Passes on first run: pins existing behavior (finding above), no production change needed | 1 passed | n/a (single guard) | None |

Verification: `pnpm test` 4 files / 7 tests pass; `pnpm exec vue-tsc -b` exit 0 (tsbuildinfo restored via git checkout).

## Remaining
WU3-WU5. PR boundary: WU2 = router.ts, App.vue, placeholder view, 3 specs.

## WU3: Tokens and contrast (PR3 -> main) - COMPLETE
Tasks 3.1-3.4 done. Not committed.

### Files changed
- src/components/landing/tokens.spec.ts (64), tokens.ts (78), landing.spec.ts (69), landing.css (109): new
- vite.config.ts: +2, `test.css.include: [/landing\.css/]`

### Final values and ratios (all design hexes passed; none adjusted)
Light: primary #00B19D, on-primary #0B2B33 (5.52), primary-hover #00A491 (4.77 with on-primary; #009C8A rejected, asserted < 4.5), primary-text #00796B (5.32 on white, 4.92 surface, 4.61 on tint #D6F5F0), lip #008F7D (4.02 vs bg, UI >= 3), ink 14.92 bg / 13.80 surface / 12.91 tint, ink-soft 7.49, ink-faint 5.06 bg / 4.68 surface.
Dark: bg #0A171B, primary #2DE0C8, on-primary #062A2F (9.14), hover #5BEAD6 (10.28), primary-text #2DE0C8 (10.95 bg, 7.64 on tint #10383B), lip #14A895 (6.14), ink 16.81 / 14.47 / 11.72, ink-soft 10.38, ink-faint 6.78.
Thresholds: 4.5 text, 3 UI. Not weakened.

### Deviations
- Design hover hex #00A491 kept (passes 4.77).
- `primary` fill on white (2.70) is NOT a required pair: it is a fill only; button edge is the lip (4.02) and label is dark. An initial "primary on bg >= 3" pair I added failed and was removed as out of spec (spec only demands text pairs + hover); documented in tokens.ts.
- vitest returns empty string for `*.css?raw` by default (css processing off), so vite.config.ts got `test.css.include` for landing.css. Without it landing.spec.ts cannot read source.
- Fonts: landing.css references 'Nunito' / 'JetBrains Mono' families only; the `@fontsource` imports go in LandingView (WU4) so they load only on the landing. Inter untouched. tailwind.config.js and style.css untouched.
- landing.css also ships `.lp-btn`/`.lp-btn-secondary` (lip, 44px, focus ring, 150ms transition) required by 3.3.

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----------|-----|-------|-------------|----------|
| 3.1-3.2 | src/components/landing/tokens.spec.ts | Unit | 7/7 existing | suite failed: ./tokens missing | 37 passed (after dropping out-of-spec pair) | light+dark x 13 pairs, WCAG refs (21, 1, 4.48), hover rejected #009C8A | None |
| 3.3-3.4 | src/components/landing/landing.spec.ts | Unit (CSS text) | 7/7 | 6 of 7 failed (css missing/empty) | 7 passed after landing.css + vite css.include | 3 theme blocks equal to tokens.ts, reduced-motion, 44px, focus, no gradient/blur, 150ms | None |

Verification: `pnpm test` 6 files / 49 tests pass; `pnpm exec vue-tsc -b` exit 0 (tsbuildinfo restored).

## Remaining
WU4-WU5. PR boundary: WU3 = components/landing/{tokens,landing}.{ts,css} + 2 specs + vite.config.ts css include.

## WU4: Components and LandingView (PR4 -> main) - COMPLETE
Tasks 4.1-4.5 done. Not committed. App specs (2.3) re-run green.

### Files changed
- src/components/landing/HeroVisual.vue (13), HeroTile.vue (20), BentoTile.vue (18), BentoGrid.vue (10), tiles.ts (64): new
- src/components/landing/landing.css: +56 (.lp-display, .lp-hero 32px, .lp-tile 24px, .lp-tile-brand, .lp-icon-chip, .lp-link; flat, no gradient)
- src/views/landing/LandingView.vue: placeholder replaced (28 lines); header (brand + nav aria-label "Principal"), one main, footer; imports landing.css and @fontsource latin-only Nunito 700/800, JetBrains Mono 400/500
- Specs: HeroVisual (22), HeroTile (62), BentoTile (25), BentoGrid (54), LandingView (69)

### Decisions / deviations
- Font imports use `latin-<weight>.css`: full imports pulled cyrillic/greek/vietnamese/latin-ext into precache (757.97 KiB, 48 entries). Latin-only: 618.39 KiB, 34 entries. Remaining font cost about 172 KiB (4 woff2 + 4 woff), roughly +38% over the pre-WU4 precache (~447 KiB). Dropping woff fallbacks needs a vite-plugin-pwa globPatterns change (out of scope).
- Class names `.lp-display`/`.lp-hero` instead of global `.text-display` (tokens are landing-scoped; style.css untouched).
- Brand tiles: how it works and app download (max two). Others use --lp-surface.
- Grid 2/4/12 cols, gap-3 / md:gap-4; desktop rows 5+4+3 and 3+4+5.
- Copy has no digits, amounts, minutes or payment brand names (asserted in BentoGrid.spec).
- Hero visual decorative (Bike, aria-hidden); slot allows `<img alt>`.
- jsdom has no layout: 44px/focus asserted at CSS-text level (landing.spec); 360px no-overflow is a manual gate.

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----------|-----|-------|-------------|----------|
| 4.1 | HeroVisual.spec.ts | Component | 7 files green | missing component | 3 passed | default icon vs slot img, no gradient | None |
| 4.2 | HeroTile.spec.ts | Component | same | missing component | 5 passed | one h1, primary href, secondary href, click navigation both ways | None |
| 4.3 | BentoTile.spec.ts | Component | same | missing component | 3 passed | neutral vs brand, span forward | None |
| 4.4 | BentoGrid.spec.ts | Component | same | missing component | 7 passed | six topics in order, columns, rows=12, brand<=2, copy guard | None |
| 4.5 | LandingView.spec.ts | Component | same | placeholder lacked nav/h1/tiles | 7 passed | landmarks, nav, containment, heading order, CTAs, aria-hidden | font imports narrowed to latin |

Verification: `pnpm test` 11 files / 74 tests pass; `pnpm exec vue-tsc -b` clean; `pnpm build` ok. Largest chunks: index 221.74 kB, CoverageMap 161.35 kB (unchanged); LandingView JS 6.14 kB, CSS 3.81 kB (lazy). tsbuildinfo restored.

## Remaining
WU5 (manual gates 5.3, 5.4).
