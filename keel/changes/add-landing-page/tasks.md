# Tasks: Public Landing Page

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Estimated changed lines: ~850-1100 (excluding pnpm-lock.yaml, ~3-5k generated) · Delivery strategy: ask-on-risk

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| WU1 | Test infra | PR1 -> main (~60 + lock) | Standalone, revertable |
| WU2 | Router + App shell | PR2 -> main after PR1 (~150) | Needs WU1 |
| WU3 | Tokens + contrast | PR3 -> main after PR2 (~250) | tokens.ts, landing.css |
| WU4 | Components + view | PR4 -> main after PR3 (~450) | Largest; may split hero/bento |
| WU5 | Verification | no PR (gates on PR4) | Manual gates |

Each task is RED (failing test) then GREEN (minimal code). Tests import from `vitest` explicitly.

## WU1: Testing infra
- [x] 1.1 Run `pnpm view vitest@2 peerDependencies version`, plus `@vue/test-utils`, `jsdom`, `@fontsource/nunito`, `@fontsource/jetbrains-mono`; record the chosen pins (design versions are unverified).
- [x] 1.2 RED: create `src/smoke.spec.ts` mounting a trivial inline component; `pnpm test` fails (no script/runner).
- [x] 1.3 GREEN: `pnpm add -D vitest @vue/test-utils jsdom`; `pnpm add @fontsource/nunito @fontsource/jetbrains-mono`; add `"test": "vitest run"` to `package.json`.
- [x] 1.4 GREEN: `vite.config.ts` import `defineConfig` from `vitest/config`; add `test: { environment: 'jsdom', include: ['src/**/*.spec.ts'] }`; smoke passes.
- [x] 1.5 Check `pnpm-workspace.yaml` `allowBuilds` (only esbuild today); add entries if jsdom/vitest postinstall is blocked.
- [x] 1.6 Regenerate `pnpm-lock.yaml`; run `pnpm install --frozen-lockfile` to confirm; commit it with `package.json` (Dockerfile:6-9 BREAKS otherwise).

## WU2: Router + App shell
- [x] 2.1 RED: `src/router.spec.ts`: `/` named `landing`, no `redirect`; catch-all still `/tiendas`; `/tiendas` and `/login` resolve.
- [x] 2.2 GREEN: `src/router.ts:6` lazy landing route; add a stub `src/views/LandingView.vue` (div.landing).
- [x] 2.3 RED: `src/App.spec.ts` (`vi.mock` store, stub TopBar/PwaStatus): at `/` no TopBar and no `main` inside `main`; at `/tiendas` TopBar present.
- [x] 2.4 GREEN: `App.vue`: `esLanding = route.name === 'landing'`, `v-if="!esLogin && !esLanding"`, `<component :is="esLanding ? 'div' : 'main'">` wrapper.
- [x] 2.5 RED/GREEN: App test with the store mock whose `sincronizarConBackend` rejects; assert no notification at `/` (blast: store sync for anonymous).

## WU3: Tokens and contrast
- [x] 3.1 RED: `src/components/landing/tokens.spec.ts`: every light/dark pair >= 4.5 (button, hover, primary-text on tint); hover must pass (`#009C8A` rejected).
- [x] 3.2 GREEN: `tokens.ts` with `contrast()` and pairs from design.
- [x] 3.3 RED: `landing.spec.ts` reading `landing.css?raw`: hex sync with tokens.ts; dark blocks (media, `.dark`, `[data-theme="dark"]`) equal; no `gradient|backdrop-filter|blur`; reduced-motion block; `min-height:44px`/`min-width:44px`; `.lp-btn:focus-visible`.
- [x] 3.4 GREEN: create `landing.css` satisfying 3.3.

## WU4: Components and LandingView
- [x] 4.1 RED/GREEN: `HeroVisual.spec.ts` / `HeroVisual.vue`: slot fallback `Bike` icon, `aria-hidden`.
- [x] 4.2 RED/GREEN: `HeroTile.spec.ts` / `HeroTile.vue`: one `h1`; "Pedir ahora" -> `/tiendas` primary; "Iniciar sesión" -> `/login` secondary (memory router).
- [x] 4.3 RED/GREEN: `BentoTile.spec.ts` / `BentoTile.vue`: `h2`, `p`, icon `aria-hidden`.
- [x] 4.4 RED/GREEN: `BentoGrid.spec.ts` / `tiles.ts` + `BentoGrid.vue`: exactly six tiles, Spanish copy per clarify Q8, no invented numbers.
- [x] 4.5 RED/GREEN: `LandingView.spec.ts`: one `header`, `main`, `footer`; hero and tiles inside `main`; heading order; import `landing.css` and fontsource. Then rerun 2.3.

## WU5: Verification
- [ ] 5.1 `pnpm test` green; `pnpm exec vue-tsc -b` clean (specs type-checked).
- [ ] 5.2 `pnpm build`; inspect precache size for the fontsource woff2 (import only the needed weights/latin subsets if large).
- [ ] 5.3 `docker build` (or `pnpm install --frozen-lockfile`) with the committed lockfile.
- [ ] 5.4 Manual: visit `/` with backend down; confirm no toast, no TopBar.

## Flagged decisions for the user (not blocking tests)
Resolved 2026-11-20: user chose stacked-to-main (4 PRs) and defaults for D1-D5.
- [x] D1 PWA `start_url: /` (vite.config.ts:20-21): ACCEPTED, installed app opens the landing.
- [x] D2 `.page-enter` (style.css:45-54) 150ms transition: ACCEPTED, documented as outside the `.landing` reduced-motion rule.
- [x] D3 Q1: primary `#00B19D`, dark `--on-primary` text.
- [x] D4 Q5: dark via `.dark` plus `[data-theme="dark"]` aliasing.
- [x] D5 Q7: og:image and the Inter Google link left untouched.
