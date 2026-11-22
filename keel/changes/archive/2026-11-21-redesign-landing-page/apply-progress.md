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

## WU5b: Coverage (branch feat/landing-redesign-wu5b-coverage) - DONE (5.3, 5.4, 5.5, coverage wiring of 5.6)

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 5.4 pre (characterization) | src/components/CoverageMap.spec.ts | component (real Leaflet in jsdom, `L.map` spied) | none existed | n/a: written against UNEDITED component, 14 pass (one wrong zoom assertion fixed: mount flyTo jumps zoom to 14 in jsdom, so setView args are pinned instead) | 14/14 | coverage and tracking modes, buttons, flyTo/fitBounds args, geolocation ok + alert paths, zone re-render, interval + unmount | none |
| 5.4 | same, `estatico` block | component | 14 pass | 4 failed for the right reason (interactions still on, zoom control and buttons present, no caption, fitBounds never called) | 19/19 | all 6 interactions, controls, caption, fit with animate:false covering every zone center, no fly, default false unchanged | dropped a vacuous "never geolocates" test |
| 5.3 | src/components/landing/CoverageSection.spec.ts | component | n/a (new) | file failed to resolve `./CoverageSection.vue`; then 3 observer tests failed (watcher arms the observer one tick after mount; tests await it) | 15/15 | chips, empty, error, loading, no observer, intersect/no-intersect, zones arriving late, unmount | fallback goes single-column after visual review |
| 5.6 (coverage) | src/views/landing/LandingView.spec.ts | view | 11 pass | 5 failed: order lacked cobertura, h2 list, anchor, fallback, chips | 16/16 | order, h2, anchor + nav link, API-down fallback, single `/zones/` call with inactive zone filtered | none |

### Files
New: CoverageMap.spec.ts (242), CoverageSection.vue (90), CoverageSection.spec.ts (206). Modified: CoverageMap.vue (+prop `estatico`, +leaflet.css import), main.ts (-leaflet.css import), content.ts (+COVERAGE_COPY), landing.css (+chips/frame/fallback modifiers), LandingView.vue (+CoverageSection after stores), LandingView.spec.ts, tasks.md.

### Decisions and deviations
- `estatico` diff is additive: default branch code paths are untouched (`...(props.estatico && {...})` spreads nothing when false; the caption uses a new `v-if` and the old `v-if` became `v-else-if`, same chain semantics). Circles get `interactive: !estatico` (Leaflet default is true).
- Leaflet CSS moved from `main.ts` to `import 'leaflet/dist/leaflet.css'` in CoverageMap.vue (spec asks for Leaflet CSS in the lazy chunk). All three other consumers import CoverageMap, so they still get it. Initial CSS 50.67 -> 36.03 kB; CoverageMap css chunk 0.31 -> 15.34 kB.
- CoverageSection props: `zonas`, `zonasError`, `cargando` (= `loading` from the single composable). Map only renders when there are zones AND the observer fired; zones error/empty hide the map (the map draws hardcoded `COORDENADAS_ZONAS`, so with no API zones it would claim coverage the API did not confirm).
- Known gap: map circles come from the static `COORDENADAS_ZONAS` (10 slugs), chips from the API; if the API activates/deactivates zones the two can differ. Not filtered (would need another CoverageMap prop).
- Wrapper `role="img"` also swallows the attribution caption for assistive tech (children of role=img are presentational); the caption is visible text for sighted users, which is what the licence needs.
- No resize refit: static map is fitted once on mount.

### Chunks (pnpm build)
Initial: index-BPwiIs0G.js 223.75 kB (no Leaflet: `leaflet-container` only in CoverageMap chunk), index-Dc1T-LNk.css 36.03 kB. Lazy: CoverageMap-Bm9eef-8.js 161.88 kB (48.01 gz), CoverageMap-Dk73cH-a.css 15.34 kB, LandingView-Bv_8ksWi.js 23.39 kB. index.html has no modulepreload for it. Precached by the PWA glob (`**/*.{js,css,...}`): sw.js lists both CoverageMap files; precache 39 entries, 677.84 KiB (was 38 / 671.51 KiB). Browser proof: landing at 4173, 0 requests for CoverageMap or tiles before scrolling to #cobertura, then the js + css and 6 tiles.
Note: CoverageMap was ALREADY its own chunk on develop (all consumers are lazy routes); the real change for the landing is that nothing on `/` requests it until the section nears the viewport.

### 5.5 Manual verification (real Chromium, throwaway script outside the repo)
Baseline = `git worktree add --detach` of HEAD (== develop, dca2951) built with vite, vs this branch build. API aborted via page.route (store falls back to mockData), tiles fulfilled with a fixed PNG, session faked by patching the Pinia `goeats` store (`usuario.nombre`; the router has no guards). Views: StoresView map tab (1280x900 and 390x844), OrdersView tracking (Roberto Kim, ORD-1044), CourierView route map (Ókil Tuñón). Result: element screenshots are byte-identical (same sha256) before vs after in all 4 cases, and also stable across two baseline runs; DOM metrics identical (touch-action none, leaflet-grab/touch-drag/touch-zoom classes, tabindex 0, 1 zoom control, buttons `Mi ubicación`+`Centrar` / `Centrar`, 10 circles + 8 markers coverage, 2 paths + 3 markers tracking, root radius/border/shadow, tile request counts), no dialogs. Not verified: the geolocation click paths in a real browser (covered by the jsdom characterization instead), real CARTO tiles (mocked), authenticated flows against a live API.
Worktree removed; screenshots and scripts live in the scratchpad.

### Gates
pnpm test 19 files / 203 tests, vue-tsc -b OK, pnpm build OK, pnpm test:e2e 1 passed. tsconfig.app.tsbuildinfo restored.

### Visual self-review (360x800 and 1440x900, API mocked, ok / error / empty; previews stopped)
No horizontal overflow, 8 chips, static map with caption visible, touch-action auto (no scroll trap), no dialogs, no controls, map in a 32px flat frame around a 24px map. Fixed: with the fallback the right half was an empty grid column; the section now collapses to one column. Remaining flaws: the real CARTO basemap was replaced by a plain mock tile in screenshots; zone circles cluster in the south-west because the coordinates are real; the lead leaves a one-word orphan ("tuya.") at 1440 in the fallback layout; no imagery beyond the map.

## WU6: Install prompt (6.1-6.4) DONE

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 6.1 | src/composables/useInstallPrompt.spec.ts | unit (jsdom, `vi.resetModules`) | n/a (new) | file failed to resolve `./useInstallPrompt`; after the composable, 3 tests failed on a test-helper bug (jsdom has no `maxTouchPoints`, `spyOn` threw), fixed in the test | 15/15 | event before consumer, singleton, prompt once, accepted/dismissed/unavailable, re-arm, appinstalled, iPhone/iPadOS/Mac/Android UA, matchMedia + navigator.standalone | none |
| 6.3 pre (characterization) | src/components/PwaStatus.spec.ts | component | none existed | n/a: written against the UNEDITED component, 11 pass | 11/11 | install (show, prevent default, prompt once, dismissed outcome, close), offline (mount, events, unmount), update (apply, close, precedence) | none |
| 6.3 | same, `on the landing route` block | component | 11 pass | 2 failed for the right reason (banner still shown on `landing`, and the "reappears after leaving landing" case) | 15/15, plus App.spec and App.sync.spec 3/3 | landing hides only install; offline and update stay; banner returns on /tiendas | none |
| 6.2 | src/components/landing/InstallSection.spec.ts | component | n/a (new) | file failed to resolve `./InstallSection.vue` | 11/11 | prompt, none, iOS, standalone, appinstalled, event before mount, copy scan, no img/a | phone visual redone after visual review (looked like a squat box) |
| 6.2 wiring | src/views/landing/LandingView.spec.ts, content.spec.ts | view | 16 pass | 3 failed with the wiring stashed (order, h2 list, section count 8) | 16/16 | n/a | none |

### Files
New: useInstallPrompt.ts (57), useInstallPrompt.spec.ts (156), PwaStatus.spec.ts (182), InstallSection.vue (62), InstallSection.spec.ts (137).
Modified: PwaStatus.vue (script only, template same except the install `v-else-if` and close handler), content.ts (+INSTALL_COPY), content.spec.ts (INSTALL_COPY in the prohibited-claims scan), LandingView.vue (+InstallSection after RolePanels), LandingView.spec.ts, tasks.md.

### Decisions and deviations
- Composable exports `{ canInstall, installed, isIos, install }`. `install()` returns `'accepted' | 'dismissed' | 'unavailable'` and clears the deferred event always (prompt() is single use).
- `canInstall` = event present AND not installed. iOS has no event, so iOS shows instructions; a real prompt event still wins over the instructions.
- PwaStatus: the module-level listener replaced the component-level one. Behavior difference, deliberate: `dismissed` is local and sticky for the component lifetime, so a second `beforeinstallprompt` after a close no longer re-shows the banner (old code re-showed it). Browsers rarely fire it twice per page load.
- Section hides entirely when installed (standalone or `appinstalled`). Neutral copy deliberately does not claim the browser "cannot" install (it also shows after the user dismissed the dialog).
- Band: `lp-band-surface` per the design band order (install `surface`); sits after RolePanels (merchants indigo, couriers amber-tint in the as-built page, so the design's "couriers bg" differs from WU4; not touched).
- Install CTA is `lp-btn lp-btn-secondary` with a white background override (the secondary default equals the surface band, same trick RolePanels uses). Still exactly one solid primary on the page (hero).
- iOS instruction rendered as "Compartir > Agregar a pantalla de inicio" with a chevron icon (labelled "y luego" for assistive tech).

### 6.4 Manual verification (real Chromium, throwaway script in scratchpad, `pnpm preview --port 4173`, API mocked/aborted, SW blocked)
Synthetic `beforeinstallprompt` dispatched via `addInitScript` on `DOMContentLoaded` (after the app module registered, before the lazy landing mounted; a dispatch at timeout 0 fires BEFORE the module script exists and is lost, which a real browser does not do since the event needs the page loaded):
- `/`: install button present (1), neutral text absent, floating banner absent, 1 `main`, button 161x44, focus ring solid 3px, click -> `prompt()` called once and the button disappears.
- `/tiendas` (hard load with the event): floating banner shown as before. SPA navigation `/tiendas` -> `/`: banner gone, section button shown.
- Offline on `/`: "Sin conexión" banner still shows.
- iPhone 13 emulation: iOS text "Compartir > Agregar a pantalla de inicio", 0 buttons.
- 360x800: scrollWidth 360 == innerWidth. Screenshots (360/1440, iOS, neutral) reviewed. Fixed: the first phone visual was a squat box; now a tall phone with a 3x3 home screen, the Go Eats tile and a dock.
Not verifiable here: the real browser install prompt (Playwright cannot trigger it; `prompt()` was a stub, `appinstalled` after a real install and standalone mode in an installed PWA were only covered by jsdom), iOS Safari itself (only UA emulation in Chromium), and the SW-controlled path (SW blocked).
Preview server stopped; tsconfig.app.tsbuildinfo restored.

### Gates
pnpm test 22 files / 244 tests, vue-tsc -b OK, pnpm build OK (precache 39 entries, 682.61 KiB), pnpm test:e2e 1 passed.

## WU7: FAQ, CTA band, footer, copy (7.1-7.5) DONE

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 7.1 | src/components/landing/FaqSection.spec.ts | component | n/a (new) | file failed to resolve `./FaqSection.vue` (also `FAQ_ITEMS` missing from content) | 9/9 | open, switch (one open), close open, none open, collapsed start, aria-controls/labelledby, no key handlers, unique ids | none |
| 7.2 | CtaBand.spec.ts, LandingFooter.spec.ts | component | n/a (new) | both files failed to resolve their component | 3/3 and 6/6 | primary vs secondary, hrefs only /tiendas, /login, #anchors, no nav/headings, no legal/social/contact, no digits | footer /tiendas and /login use RouterLink (no full reload), anchors plain `<a>` |
| 7.3, 7.4 | src/views/landing/LandingView.spec.ts | view | 16 pass | 11 failed with the view unwired (order, h2 list, 10 sections, primaries, route names, anchors, copy scan, shipping x2) | 22/22 | router.resolve names against the real `routes`, anchors of nav and footer, copy scan with API down and with API data, digits only in step numerals | 3 test-side fixes (`visa` matched `revisa`; `contenido` is the skip link, not header/footer; the FAQ question names "costo de envío") |

### Files
New: FaqSection.vue (50), FaqSection.spec.ts (79), CtaBand.vue (22), CtaBand.spec.ts (45), LandingFooter.vue (40), LandingFooter.spec.ts (70). Modified: content.ts (+FAQ, CTA, footer copy), landing.css (+FAQ and footer rules), LandingView.vue (+FaqSection, CtaBand, LandingFooter; minimal footer and WU comment removed), LandingView.spec.ts, tasks.md.

### Decisions and deviations
- Footer copyright is `© Go Eats`: no year (digit rule) and no legal entity (the S.A. is the client, ownership not verified).
- Footer does not link `#instalar` (the section hides itself once installed, so the anchor could be dead). Footer groups use `p` labels with `aria-labelledby` lists, no headings and no nav.
- Two solid primaries exist in the DOM (hero, band), never in the same viewport; the previous "only hero" test now asserts exactly hero + band, both `/tiendas`.
- FAQ: single-open, panels in the DOM with `hidden`, 64px triggers, no transition, icon flips when open. Left column sticky on lg.
- Shipping sentence appears exactly twice (step 3 and FAQ); the scan asserts nothing else talks about cost.

### 7.5 Copy checklist (every claim on the page)
| Claim | RF |
|---|---|
| Hero: "Pide a los comercios de tu zona", tiendas que llegan a tu dirección | RF-04 |
| Hero: elige lo que necesitas, sigue el estado | RF-05, RF-16 |
| Hero note: "Pagas en efectivo al recibir tu pedido" | RF-10 |
| Phone mock states Confirmado, En preparación, En camino, Entregado | RF-16 |
| Category chips (tipos de comercio) | RF-04 (catalogue types of the app) |
| Step 1 Elige un comercio | RF-04 |
| Step 2 Arma tu carrito, catálogo, productos | RF-05, RF-06, RF-14 |
| Step 3 Confirma y paga al recibir | RF-14, RF-10 |
| Shipping sentence (step 3 and FAQ) | RF-15 (qualitative only; distance not claimed) |
| Step 4 Sigue el estado | RF-16 |
| Stores section: names, category and zone from the API | RF-04 |
| Coverage: zones from the API, static map, "trabaja por zonas" | RF-04 |
| Merchants: catálogo, horarios, disponibilidad, promociones | RF-13 |
| Merchants: asignar pedido listo a repartidor | RF-01 |
| Merchants/couriers: actualizar estado y notificación | RF-16 |
| Couriers: disponibilidad en línea, ocupado, desconectado | RF-02 |
| Couriers: datos de recogida, entrega y observaciones | RF-19 |
| Install section and FAQ "instalar" (PWA from the browser) | none (PWA stack fact, no RF) |
| FAQ cómo pedir (comercio, carrito, dirección de entrega) | RF-04, RF-05, RF-14 |
| FAQ cómo se paga (contra entrega) | RF-10 |
| FAQ estado del pedido (sección de pedidos, 4 estados) | RF-16 |
| FAQ unirse como comercio o repartidor (crear cuenta o iniciar sesión en la página de ingreso) | RF-01/RF-13 (merchant), RF-02/RF-19 (courier); registration itself is LoginView `modoRegistro` (verified in clarifications Q5) |
| FAQ zona (comercios que llegan a tu zona) | RF-04 |
| CTA band "Elige un comercio... paga al recibir" | RF-04, RF-10 |
| Footer tagline "Comercios de tu zona, en tu puerta" | RF-04 (positioning; no measurable claim) |

Unmapped, flagged: (1) the install/PWA claims have no RF (stack fact, vite-plugin-pwa); (2) the tagline and hero eyebrow "Delivery de comercios locales" are positioning copy, not a functional claim; (3) "el comercio avisa al cliente con una notificación" relies on RF-16 push, whose live end-to-end behaviour is unverified per steering/product.md. Nothing on the page states prices, ETAs, ratings, stats, testimonials, partner brands, gateways, card payments, live tracking or contact data.

### Visual self-review (360x800 and 1440x900, API mocked, throwaway script in scratchpad)
No horizontal overflow, no dead anchors. Keyboard walk on the accordion: Enter opens, Tab then Space opens the next and closes the previous, Space closes, 3px focus ring, triggers 64-79px high. Page top to bottom: rhythm 64/96px consistent, bands alternate flat tones, FAQ is hairline rows (no cards), CTA band centered with one primary, footer 3 columns on desktop and stacked on mobile. Remaining: the lg footer wordmark sits 8px right of the text edge (padding baked into the sobre-indigo SVG, not recolored or cropped); the stores tiles and the install visual are still the "tile" look from earlier units. Preview server stopped; tsconfig.app.tsbuildinfo restored.

### Gates
pnpm test 25 files / 268 tests, vue-tsc -b OK, pnpm build OK (precache 39 entries, 688.78 KiB), pnpm test:e2e 1 passed.

## WU8: Real-browser verification (8.1-8.5; 8.6 is the user's visual review, unchecked)

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 8.1 cascade | e2e/landing.spec.ts | e2e | pnpm test 268 pass, e2e smoke 1 pass | Rule `.landing :is(h1,h2,h3,h4)` commented out in landing.css (throwaway): both cascade specs FAIL, h1 `Received rgb(44, 62, 80)`, `Expected rgb(11, 43, 51)` (the global `h1..h4 text-ink` bug) | Rule restored (`git checkout landing.css`, diff empty): passes | dark scheme emulation AND `html.dark` class; h1 plus every h2 (more than 3), `.landing` bg white, `#cobertura` band bg surface | none |
| 8.1 other | e2e/landing.spec.ts | e2e | n/a (new) | n/a: these guard existing behavior, so they pass on first run (no production change in WU8; documented, not a TDD failure) | 360x800 and 1440x900 overflow, landmarks, skip link Tab+Enter, sticky header y=0 after scroll, 3 anchors below header | two viewports, three anchors | none |
| 8.2 | e2e/landing-behavior.spec.ts | e2e | as above | n/a (guards) | reduced motion, API fulfilled/aborted/delayed, map lazy + caption + no dialog + geolocation spy, FAQ keyboard, install event | fulfilled vs aborted vs delayed states; before vs after scroll for map | 2 test-side fixes (see below) |

### Files
New: e2e/landing.spec.ts (~150 lines), e2e/landing-behavior.spec.ts (~195), docs/landing-image-briefs.md (~65). Modified: keel tasks.md, this file. landing.css untouched (git diff empty). 19 e2e tests total (1 smoke + 18 new).

### Commands that work
`pnpm test:e2e` (builds, serves on 4173 strictPort, reuseExistingServer false: port 4173 must be free; whole suite ~15 s). Single spec: `pnpm test:e2e e2e/landing.spec.ts -g cascade`.

### Deviations and notes
- Two spec files, not one: `landing.spec.ts` (8.1) and `landing-behavior.spec.ts` (8.2 and the FAQ and install specs), to keep each readable.
- The `/api/v1/*` calls hit the preview server (relative baseURL), so every spec mocks them via `page.route`; no real network. CARTO tiles are fulfilled with a 1x1 PNG.
- Geolocation: no prompt can be observed headless, so the spec spies on `getCurrentPosition` and `watchPosition` and asserts 0 calls.
- Test-side fixes: install spec first matched the FAQ trigger "Como instalar..." (name regex now `^Instalar`), and a too-broad "no banner" selector was replaced by "exactly one Instalar button".
- The delayed-response test leaves 6 s route handlers pending at teardown (fulfill errors are swallowed); harmless.

### 8.4 Precache
`pnpm build`: precache 39 entries (688.78 KiB). Wordmarks in dist: exactly `go-eats-wordmark-color-82xTpC8z.svg` and `go-eats-wordmark-sobre-indigo-Bo8LfcSZ.svg` (4 SVG in dist overall: those two plus icon.svg and vite.svg). The 22 are not shipped; originals live in docs/brand/wordmarks/. Map chunk is separate (`CoverageMap-*.js` and `.css`).

### 8.5 Docker
`docker compose build web` OK, `docker compose up -d web` recreated `goeats-web` (5173->80). Served HTML references `assets/index-vpEFDn4-.js` (200). The string 'Preguntas frecuentes' lives in the lazy chunk `LandingView-Btlmthc3.js` (served 200, 1 match, same hash as local dist), not in the index chunk. Headers (curl -I): `sw.js`, `manifest.webmanifest` -> `Cache-Control: no-cache`; `index.html` has no Cache-Control. `registerSW.js` does not exist in this build (vite-plugin-pwa registers from the main bundle via `virtual:pwa-register`), so Caddy returns the SPA fallback (text/html, no-cache): harmless but the Caddy rule for it is dead. `registerType: 'autoUpdate'` confirmed in vite.config. One-off script (scratchpad/sw-check.mjs, SW not blocked): SW registers at scope `/`, activates, precache `workbox-precache-v2-http://localhost:5173/` created, page controlled, new landing rendered.
Not verified: an actual update from the previous build on a returning client (needs the old build served first, then the new one, observing skipWaiting/clientsClaim and reload). Only the mechanism (autoUpdate + no-cache sw.js) is verified. Index.html having no Cache-Control means heuristic caching is possible, but the SW precache revalidates by hash.

### Gates
pnpm test 25 files / 268 tests; vue-tsc -b OK; pnpm build OK (39 entries, 688.78 KiB); pnpm test:e2e 19 passed (~15 s). tsconfig.app.tsbuildinfo restored; dist, test-results, playwright-report not staged.

## Map tiles fix

Correction: earlier notes in this file saying CARTO tiles need no API key (and "real CARTO tiles (mocked)" / "CARTO tiles are fulfilled with a 1x1 PNG") were wrong. `basemaps.cartocdn.com` now returns HTTP 200 with a 2049-byte "API KEY REQUIRED" placeholder for every tile, which broke every map (landing CoverageSection, StoresView, OrdersView, CourierView). Mocked tiles hid it.

Fix (strict TDD, specs first, red for the right reason, then green): new `src/utils/mapTiles.ts` (`TILE_URL`, `TILE_ATTRIBUTION`, default OSM `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, overridable via `VITE_MAP_TILE_URL` / `VITE_MAP_TILE_ATTRIBUTION`, typed in `src/vite-env.d.ts`; no `.env.example` exists so none created). `CoverageMap.vue` uses the constants for the tile layer (maxZoom 19, `attribution` kept consistent) and the static caption (CARTO credit dropped). Specs: `src/utils/mapTiles.spec.ts` (defaults, override, empty-string fallback), `CoverageMap.spec.ts` (URL, caption, no `cartocdn`), e2e now routes `tile.openstreetmap.org` and asserts every requested tile host is exactly `tile.openstreetmap.org`.

Real-network verification (tiles NOT mocked; only `/merchants` and `/zones` mocked, throwaway script in the session scratchpad, preview on :4180, stopped by PID): landing `#cobertura` at 1440x900 and 360x800 loaded 6 tiles each from tile.openstreetmap.org, all HTTP 200; screenshots show a real OSM map (street names, Panama sea and land, "Panama" label, zone circles, caption "© OpenStreetMap contributors") and no "API KEY REQUIRED" watermark. `/tiendas` "Mapa en Vivo" (API aborted, store falls back to mockData, no session needed) at both widths: all tile responses 200, real street/sea labels (Corredor Sur, San Francisco, Bella Vista), no watermark. Screenshots: scratchpad `real-landing-1440.png`, `real-landing-360.png`, `real-tiendas-1440.png`, `real-tiendas-360.png`. Not verified: OrdersView and CourierView in a real browser (same component and layer code path).
