# Tasks: Redesign Landing Page

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Estimated changed lines: ~2,500 added, ~275 deleted · Delivery strategy: ask-on-risk

Note: ~700 words on purpose, given the scope. Stacked means each PR targets `develop` (or the previous unit's branch until merged), merge commits, one PR per unit. Every unit must pass `pnpm test`, `pnpm exec vue-tsc -b`, `pnpm build` on its own. Strict TDD: in every task write the failing spec first (RED), then the code (GREEN), then tidy.

### Suggested Work Units

| Unit | Goal | Forecast | Budget |
|------|------|----------|--------|
| WU1 | Playwright harness | ~60 + lockfile | Low |
| WU2 | Tokens, assets, BrandLogo | ~400 | Medium |
| WU3 | Nav, hero, view, Bento removal | ~600 added, -240 | High (accepted; deletions are mechanical) |
| WU4 | Categories, steps, role panels | ~420 | Medium |
| WU5 | Data layer, stores, coverage | ~520 | High (split off CoverageMap if over) |
| WU6 | Install prompt and section | ~330 | Low |
| WU7 | FAQ, CTA band, footer, copy scan | ~420 | Medium |
| WU8 | e2e specs, docs, verification | ~300 | Medium |

## WU1: Playwright harness (base: develop)
- [x] 1.1 `pnpm add -D @playwright/test`; commit the updated `pnpm-lock.yaml` (Dockerfile uses `--frozen-lockfile`).
- [x] 1.2 Create `playwright.config.ts` (testDir `./e2e`, chromium, `serviceWorkers: 'block'`, webServer `pnpm build && pnpm preview --port 4173 --strictPort`, no `process.env`); add script `test:e2e`.
- [x] 1.3 Add `test-results/` and `playwright-report/` to `.gitignore`.
- [x] 1.4 RED/GREEN: smoke `e2e/smoke.spec.ts` (`/` loads, title present); `pnpm exec playwright install chromium`.
- [x] 1.5 Confirm vitest and tsc ignore `e2e/`: `pnpm test`, `vue-tsc -b`, `pnpm build` green.

## WU2: Tokens, assets, BrandLogo (base: WU1)
- [x] 2.1 RED: `tokens.spec.ts` band pairs (ink and ink-soft on amber-tint, ink-soft on primary-tint, primary-text on amber-tint, on-indigo and on-indigo-soft on indigo, primary vs indigo and primary-lip on primary-tint at 3.0); `dark` loop unchanged.
- [x] 2.2 GREEN: `tokens.ts` add `indigo, on-indigo, on-indigo-soft, amber-tint, amber` to `light` only; new `bandPairsFor(light)`, `pairsFor` untouched.
- [x] 2.3 RED: `landing.spec.ts` forbids `prefers-color-scheme`, `.dark`, `data-theme`; `.landing {` block mirrors `light` tokens; flat scan.
- [x] 2.4 GREEN: `landing.css` drop dark rules, add tokens, `.lp-band-*`, literal 32/24/16/12px radii (no `--lp-r-*`), reduced-motion-only smooth scroll, `main:focus` outline none, `:root:has(.landing)` scroll-padding 5rem. Keep filename (vitest `css.include`).
- [x] 2.5 Create `docs/brand/wordmarks/`, COPY all 22 SVGs there first, then `mv` `color`, `color-sin-swoosh`, `sobre-indigo`, `sobre-turquesa`, `sobre-ambar` to `src/assets/brand/`; remove the remaining 17 from `public/`. `sobre-turquesa` and `sobre-ambar` stay parked, unimported (default; rect `#00C2A8` is not `#00B19D`).
- [x] 2.6 RED/GREEN: `BrandLogo.spec.ts` then `BrandLogo.vue` (`variant` color or sobre-indigo; img alt "Go Eats"; RouterLink to `/`; not recolored).
- [x] 2.7 Add `@fontsource/nunito/latin-400.css` import in `LandingView.vue` (default: add 400; body currently renders 700). Keep 32/40px title scale (default).

## WU3: Nav, hero, view composition (base: WU2)
- [x] 3.1 RED/GREEN: `LandingNav.spec.ts` then `LandingNav.vue` (skip link first, focuses `main`; one `nav[aria-label=Principal]`; anchors `hidden md:flex`; login CTA secondary).
- [x] 3.2 RED/GREEN: `HeroVisual.spec.ts` then rewrite (aria-hidden circles and phone mock, `ESTADO_LABELS` four labels, no `Bike`).
- [x] 3.3 RED/GREEN: rename `HeroTile` to `HeroSection` + spec (aria-labelledby, one h1, primary `/tiendas`, secondary `/login`).
- [x] 3.4 RED/GREEN: `LandingView.spec.ts` (one header/nav/main/footer, one h1, section order) then rewrite `LandingView.vue` with exactly one `main#contenido[tabindex=-1]` (App.spec.ts:43).
- [x] 3.5 Delete `BentoGrid`, `BentoTile`, `tiles.ts` and both specs; `rg` confirms no references.
- [x] 3.6 Run the three gates.

## WU4: Categories, steps, role panels (base: WU3)
- [x] 4.1 Create `content.ts` (typed categories, steps, `ENVIO_COPY` exact sentence) + spec for the sentence.
- [x] 4.2 RED/GREEN: `CategoryStrip` spec (names with icons, no digits, no link or button) then component.
- [x] 4.3 RED/GREEN: `StepsSection` spec (exactly 4, numbered 1-4, h3, cash on delivery) then component.
- [x] 4.4 RED/GREEN: `RolePanels` spec (two separate `section`s, CTAs `/login` secondary) then component.
- [x] 4.5 Wire into `LandingView`; update its order spec.

## WU5: Data layer, stores, coverage (base: WU4)
- [ ] 5.1 RED/GREEN: `useLandingData.spec.ts` (`vi.mock` api: filter `activo`, cap 6, `/merchants/` and `/zones/` with `timeout: 5000`, abort on unmount, errors, one `console.warn`) then `useLandingData.ts`.
- [ ] 5.2 RED/GREEN: `StoresSection` spec (title "Comercios en Go Eats", loading/empty/error fallback, no toast, no price/rating/ETA) then component.
- [ ] 5.3 RED/GREEN: `CoverageSection` spec (chips, stubbed `CoverageMap`, stubbed `IntersectionObserver`, no observer means chips only, fallback) then component with `defineAsyncComponent`.
- [ ] 5.4 Add `estatico` Boolean prop (default false) to `CoverageMap.vue`: interactions off, no controls or geolocation, `fitBounds` animate false, attribution caption.
- [ ] 5.5 Manual check CoverageMap unchanged in `StoresView`, `OrdersView`, `CourierView` (no spec exists).
- [ ] 5.6 Wire into `LandingView`; three gates; confirm Leaflet in its own chunk.

## WU6: Install prompt (base: WU5)
- [ ] 6.1 RED/GREEN: `useInstallPrompt.spec.ts` (`vi.resetModules`; event before mount, iOS UA, standalone, `install()`) then composable.
- [ ] 6.2 RED/GREEN: `InstallSection` spec (button, neutral text, iOS text, hidden when installed) then component.
- [ ] 6.3 Modify `PwaStatus.vue`: consume composable, local `dismissed`, hide on route `landing`; offline and update banners stay.
- [ ] 6.4 Manual check PwaStatus banner on non-landing routes; stubs in `App.spec.ts` and `App.sync.spec.ts` still pass.

## WU7: FAQ, CTA band, footer, copy (base: WU6)
- [ ] 7.1 RED/GREEN: `FaqSection` spec (`aria-expanded`, `aria-controls`, one open, close open, Enter/Space) then component.
- [ ] 7.2 RED/GREEN: `CtaBand` and `LandingFooter` specs (only `/tiendas`, `/login`, anchors; no `nav`; no legal/social/contact) then components.
- [ ] 7.3 `LandingView.spec.ts`: `router.resolve` asserts route names `stores` and `login` (not catch-all); anchor ids exist.
- [ ] 7.4 Copy-integrity scan including `aria-hidden` text (no currency, minutes, stars, %, brands, Yappy, Paguelo Fácil, card, "en vivo", "tiempo real", distance); exact shipping sentence.
- [ ] 7.5 Copy checklist: each claim mapped to RF-01/02/04/05/06/10/13/14/15/16/19 (cash to RF-10, status to RF-16); no prices, ETAs, ratings, stats, testimonials, partner brands, live-tracking wording.

## WU8: Real-browser verification (base: WU7)
- [ ] 8.1 `e2e/landing.spec.ts`: cascade (dark scheme plus `html.dark`, h1/h2 `rgb(11,43,51)`, white bg, band bg), 360x800 `scrollWidth <= innerWidth`, landmarks, skip-link Tab/Enter, sticky nav and anchor offset.
- [ ] 8.2 Reduced motion (`scroll-behavior: auto`, no running animation); API states via `page.route` (fulfill filter/cap, abort fallback, 6 s delay loading); map (no chunk before scroll, caption visible, no dialog).
- [ ] 8.3 Create `docs/landing-image-briefs.md`.
- [ ] 8.4 Verify precache: 2 wordmarks (not 22) in `pnpm build` output.
- [ ] 8.5 `docker compose build web`, then confirm SW update on a returning client.
- [ ] 8.6 User visual review in a real browser at 360px and desktop.

## Cleanup
- [ ] 9.1 Archive merge into `keel/specs/landing-page/spec.md` (sdd-archive).
Resolved 2026-11-20: user accepted stacked PRs into develop (merge commits), WU3 as size-exception (~600 added), WU5 split with CoverageMap in its own PR. Auto mode: run WU1..WU8 in order.
