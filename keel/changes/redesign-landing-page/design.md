# Design: Redesign Landing Page

## Technical Approach
One component per section in `src/components/landing/`, composed by `src/views/landing/LandingView.vue`. Static copy lives in `content.ts`; API data via two composables on `api.ts` (never Pinia). Light-only tokens in `landing.css`. Install state is a shared singleton composable. Playwright covers what jsdom cannot (cascade, overflow, focus).

## Architecture Decisions

| Decision | Choice | Rejected | Why |
|---|---|---|---|
| Six-tile code | Delete `BentoGrid`, `BentoTile`, `tiles.ts` + 2 specs; `HeroTile` becomes `HeroSection` | Keep as accent | No consumer; specs encode "exactly six" and a `\d` ban |
| CSS | Single `landing.css` (Tailwind for layout, `.lp-*` for color/bands) | Split files | vitest `css.include` is `/landing\.css/` (vite.config.ts L10); a split file would not match |
| Radii | Literal 32/24/16/12px, no `--lp-r-*` vars | CSS vars | `landing.spec` requires the `.landing {` block to hold exactly the `light` tokens |
| Band pairs | New `bandPairsFor(light)`; `pairsFor` unchanged | Add to `pairsFor` | `pairsFor(dark)` would read missing keys and crash `luminance` (`dark` must stay untouched) |
| Wordmark | `<img alt="Go Eats">` inside `RouterLink to="/"`, plain default `.svg` import | Inline SVG, `?url` | vite/client already types `*.svg` as `string` (node_modules/vite/client.d.ts L89), so `vue-tsc` needs no change |
| Smooth scroll | `scroll-behavior: smooth` only under `prefers-reduced-motion: no-preference` | Never smooth | Makes the reduced-motion e2e meaningful |

## Components (all `src/components/landing/`)
| File | Action | Notes |
|---|---|---|
| `LandingNav.vue` | Create | skip link `<a href="#contenido">` first in `.landing`, `@click.prevent` focuses `main`; sticky `header` (solid `--lp-bg`, 64px) with one `nav[aria-label=Principal]`; anchors `hidden md:flex`; login CTA secondary |
| `BrandLogo.vue` | Create | prop `variant: 'color' \| 'sobre-indigo'` |
| `HeroSection.vue` (from `HeroTile`) | Rename+rewrite | `aria-labelledby`, h1, primary `/tiendas` + secondary `/login`, `HeroVisual` |
| `HeroVisual.vue` | Rewrite | slot kept; default: `aria-hidden` flat circles (primary, indigo, `amber`) + phone mock (frame 32px, screen 24px, rows 16px, concentric) with labels Confirmado / En preparación / En camino / Entregado (`ESTADO_LABELS`, mockData.js L22-28); Lucide `Bike` removed |
| `CategoryStrip`, `StepsSection`, `StoresSection`, `CoverageSection`, `RolePanels` (two `section`s), `InstallSection`, `FaqSection`, `CtaBand`, `LandingFooter` | Create | footer = `ul` of `<a href>` (no `nav`); h2 per section, h3 for steps/stores/FAQ |
| `content.ts` | Create | typed copy: categories, steps, FAQ, fallback stores/zones text, footer links, `ENVIO_COPY` |

Band order: hero `primary-tint` / categories `bg` / steps `surface` / stores `bg` / coverage `surface` / merchants `amber-tint` / couriers `bg` / install `surface` / FAQ `bg` / CTA band `primary-tint` / footer `indigo`. Section padding 64px, 80px `md`, 96px `lg`; container 1200px. Type: display 36/48px 800; section title 32/40px 800 (landing-only step up from desing.md `.text-h1`); step numerals 48px 800 tabular-nums; body-lg 18px.

## Tokens and contrast
Add to `light` only: `indigo #2E2A7A`, `on-indigo #FFFFFF`, `on-indigo-soft #C9C7F0`, `amber-tint #FFF1D6`, `amber #FFB62E` (decorative; pair `ink on amber`). `bandPairsFor`: ink and ink-soft on amber-tint, ink-soft on primary-tint, primary-text on amber-tint, on-indigo and on-indigo-soft on indigo, primary vs indigo (UI, 3), primary-lip on primary-tint (UI, 3). Hand-computed 4.5+ (primary-text on amber-tint ~4.76 is the tightest); the test decides. Focus ring on indigo uses `--lp-on-indigo` (`primary-text` is ~2:1 there).

## Wordmark and precache
`mv` (untracked) `color`, `color-sin-swoosh`, `sobre-indigo`, `sobre-turquesa`, `sobre-ambar` to `src/assets/brand/`; import only `color` and `sobre-indigo`. Move the other 17 to `docs/brand/wordmarks/` (outside `public` and `src`). Why: `public/` is copied to `dist` and `globPatterns` has `svg` (vite.config.ts L62), so all 22 (~7 KB each, estimated) would be precached (~150 KB vs ~14 KB). Each file exceeds the 4 KB inline limit, so it is emitted as a hashed asset. Finding: `sobre-*` files embed a rounded rect (turquoise `#00C2A8`, not the landing `#00B19D`; amber `#FFB62E`), so they only blend on a band of that exact color. Only indigo is used, so `sobre-turquesa`/`sobre-ambar` are parked, unimported. Verify sizes from `pnpm build` output (not measurable here). Add `@fontsource/nunito/latin-400.css` (only 700/800 load today, so body text renders at 700), one more woff2.

## Data layer: `src/composables/useLandingData.ts`
`useFeaturedStores()` and `useCoverageZones()` return `{ status: 'loading'|'ready'|'empty'|'error', items }`. Call `api.get('/merchants/', { timeout: 5000, signal })`, `/zones/`; abort on unmount; pure `selectFeatured` (activo, first 6, `{id,name,category,zoneName,icon}` only). Empty/error render static fallback from `content.ts`, no toast. Icons via `CommerceIcon`.

## Install: `src/composables/useInstallPrompt.ts`
Module-level `shallowRef` deferred event, `ref installed`; listeners (`beforeinstallprompt` with `preventDefault`, `appinstalled`) registered on import, guarded by `typeof window`. Since `App.vue` statically imports `PwaStatus`, the module loads before the lazy landing, which fixes the missed event. Exports `{ canInstall, installed, isIos, install }`. iOS: UA `iPad|iPhone|iPod` or Mac UA with `maxTouchPoints > 1`. Standalone: `matchMedia?.('(display-mode: standalone)').matches` or `navigator.standalone` (jsdom has no matchMedia). `PwaStatus.vue`: consume it; local `dismissed` ref; banner `v-else-if="canInstall && !dismissed && route.name !== 'landing'"`. Offline and update banners stay.

## CoverageMap (additive)
Prop `estatico` (Boolean, default false). When true: dragging/touchZoom/scrollWheelZoom/doubleClickZoom/boxZoom/keyboard off (Leaflet adds `touch-action` classes only when drag+zoom are on, leaflet.css L68-80, so the page scrolls); no zoom control, no control bar, no geolocation path; `fitBounds` over zone circles, `animate:false`; caption "© OpenStreetMap contributors © CARTO". `CoverageSection`: `defineAsyncComponent(() => import('../CoverageMap.vue'))` rendered when an `IntersectionObserver` (rootMargin 200px) fires; wrapper `role="img"` with label; no observer means chips only.

## A11y mechanics
- `main#contenido[tabindex=-1]`; `main:focus { outline: none }` (non-interactive programmatic target, deliberate exception).
- `:root:has(.landing) { scroll-padding-top: 5rem }` (scoped; no global change). Never `overflow-x: hidden` on ancestors (breaks sticky); `clip` only if needed.
- FAQ: `openId: string|null`; `button[aria-expanded][aria-controls]` inside h3; panels `role="region"`, `hidden`, always in DOM; no key handlers.
- Reduced motion: existing `.landing *` kill block stays.

## Playwright
`pnpm add -D @playwright/test`; `pnpm exec playwright install chromium`. `playwright.config.ts`: `testDir: './e2e'`, one chromium project, `use: { serviceWorkers: 'block', baseURL }`, `webServer: { command: 'pnpm build && pnpm preview --port 4173 --strictPort', url, reuseExistingServer: true }`, no `process.env`. Script `"test:e2e": "playwright test"`. Verified excludes: vitest `include: ['src/**/*.spec.ts']`; `tsconfig.app.json` includes only `src/**`; `tsconfig.node.json` only `vite.config.ts`. Add `test-results/`, `playwright-report/` to `.gitignore`. Note `pnpm build` runs `vue-tsc -b` over `src` specs, so they must typecheck (strict, noUnusedLocals).

| e2e test | Asserts |
|---|---|
| Cascade | `colorScheme:'dark'` plus `html.dark`: h1/h2 computed color = `rgb(11,43,51)`, `.landing` bg = white, band bg = tokens |
| Overflow 360x800 | `scrollWidth <= innerWidth` |
| Landmarks | 1 header, 1 nav, 1 main, 1 footer, 1 h1 |
| Skip link | Tab, Enter, `activeElement === main` |
| Sticky and anchors | nav visible after scroll; anchor target top >= header bottom |
| Reduced motion | `reducedMotion:'reduce'`: root `scroll-behavior: auto`, no running animation |
| API states | `page.route('**/api/v1/**')`: fulfill (inactive filtered, max 6), abort (fallback, other sections render), 6 s delay (loading) |
| Map | no map chunk request before scroll; caption visible; no dialog event |

## Strict TDD order (red first)
1. `tokens.spec` (band pairs, `dark` loop unchanged) then `tokens.ts`.
2. `landing.spec` (no `prefers-color-scheme`/`.dark`/`data-theme`; new light mirror; flat scan) then `landing.css`.
3. `useInstallPrompt.spec` (`vi.resetModules`, dispatch events) then composable; PwaStatus manual check.
4. `useLandingData.spec` (`vi.mock` api: filter, cap, timeout arg, errors).
5. Section specs, one per component (Vue Test Utils, stub `CoverageMap`, stub `IntersectionObserver`).
6. `LandingView.spec` (landmarks, order of 9 sections, heading levels, `router.resolve` on footer links, copy scan including `aria-hidden`, exact shipping sentence) then view.
7. Delete Bento files; CoverageMap `estatico` (manual plus e2e). 8. e2e last.

## File Changes (lines are rough estimates)
| File | Action | ~Lines |
|---|---|---|
| 12 section/brand components + 11 specs | Create | 560 + 460 |
| `content.ts` (+spec) | Create | 150 + 40 |
| `useLandingData.ts`, `useInstallPrompt.ts` (+specs) | Create | 130 + 180 |
| `HeroTile.vue`/spec, `HeroVisual.vue`/spec | Rename / Rewrite | 150 |
| `LandingView.vue` (+spec) | Rewrite | 60 + 110 |
| `landing.css` | Modify | +260 -35 |
| `tokens.ts`, `tokens.spec.ts`, `landing.spec.ts` | Modify | 25, 40, 60 |
| `PwaStatus.vue`, `CoverageMap.vue` | Modify | 25, 30 |
| `BentoGrid`, `BentoTile`, `tiles.ts` + 2 specs | Delete | -240 |
| `playwright.config.ts`, `e2e/landing.spec.ts`, `package.json`, `.gitignore` | Create/Modify | 25, 200, 3, 2 |
| `src/assets/brand/*.svg` x5; `docs/brand/wordmarks/` x17; `docs/landing-image-briefs.md` | Move/Create | n/a, 60 |
| `keel/specs/landing-page/spec.md` | Modify (archive merge) | n/a |
Total about 2,500 added, 275 deleted.

## Rollback & Reversibility
- No migrations or data; no flag. Revert the PR (`git revert <merge>`) restores the six tiles.
- Late revert loses nothing: additive `estatico` prop, composable and Playwright are inert. After revert, remove the `@playwright/test` lockfile entries and verify `pnpm test`, `pnpm build`, and that `/` renders.
- Service worker: clients on the new build hold cached assets until `autoUpdate` swaps; the revert deploy self-heals.
- Moved wordmarks are untracked; `mv` is irreversible by git, so copy them to `docs/brand/wordmarks/` first.

## Observability
- Frontend only: API failure is silent to the user (fallback) and logged once per section via `console.warn('landing: merchants fetch failed', code)`; no PII, no toast.
- No new endpoints; duplicated `/merchants/` and `/zones/` calls (also in `sincronizarConBackend`) accepted.
- Success signal: all e2e green; build output shows Leaflet in its own chunk, not in the entry chunk; precache list contains 2 wordmarks, not 22.

## Open Questions
- [ ] Footer/CTA wordmark variants `sobre-turquesa`/`sobre-ambar` are parked: their rect color (`#00C2A8`) conflicts with landing `#00B19D` (steering gap 9). Confirm.
- [ ] Add Nunito 400 (offline-safe) or keep Inter body from the Google Fonts CDN per desing.md?
- [ ] Section title scale (32/40px) deviates from desing.md; confirm.
