# Clarifications: Redesign Landing Page

Status: no BLOCKERs. 10 ASSUMPTIONS (one per item the orchestrator listed, so above the usual cap of 7), each verified in code where possible. Date: 2026-11-20.
Note: this executor had no shell, so Q9 (Playwright install) is NOT executed, only inspected.

## BLOCKER — must answer before design
None. Nothing found that would force rework if the default is wrong and cannot be checked in code.

## ASSUMPTION — proceeding with default unless corrected

### Q1: Does the unchanged "Responsive grid" requirement (2/4/12 tile columns) survive?
- Targets: Requirement "Responsive grid" (keel/specs/landing-page/spec.md L55-66)
- Assumed: NO, it must be MODIFIED. Its scenarios say "tiles use a 2-column grid" and "grid uses 4 and 12 columns"; the redesign removes the six-tile grid (BentoGrid.spec asserts `grid-cols-2 md:grid-cols-4 lg:grid-cols-12`). Left as is it is either false or a hidden mandate to keep BentoGrid. Default: MODIFIED to "Responsive layout": mobile-first, no horizontal overflow at 360px, sections stack in one column on mobile and may use multi-column at md/lg; 2/4/12 applies only IF a bento accent grid is kept (design decision, not a spec MUST).
- Evidence: src/components/landing/BentoGrid.spec.ts L30-33; proposal "Modified Capabilities" says "Responsive grid as needed".

### Q2: `nav` landmark: one or several?
- Targets: Requirement "Accessibility" Landmarks scenario, "Sticky navigation and skip link" (delta spec)
- Assumed: exactly ONE `nav` (aria-label "Principal") inside the sticky `header`, outside `main`. Footer links are a plain `ul`, NOT a second `nav` (otherwise the "one nav" scenario fails). Skip link is the first focusable element, placed BEFORE the `header`; `main` gets `id` + `tabindex="-1"` and the skip link focuses it explicitly (do not rely on fragment navigation alone). The nav is solid-colored (no blur; flat rule). Below `md` the nav shows brand + login CTA only (7 anchors do not fit at 360px, no hamburger); section anchors show from `md`. Sticky header needs `scroll-padding-top` so anchored headings and focused elements are not hidden under it.
- Evidence: current LandingView.vue L14-19 already has `<nav aria-label="Principal">` in `header`; App.vue L23 renders the landing inside a `div` (not `main`), so no nested `main`.

### Q3: FAQ single-open or multi-open?
- Targets: Requirement "FAQ accordion"
- Assumed: single-open as the spec says, with button + `aria-expanded` + `aria-controls` + `role="region"` panel; state `openId: string | null`; activating the open item closes it (zero open allowed); initial state all closed; panels stay in the DOM (`hidden`) so `aria-controls` always resolves. Native Enter/Space on `<button>`, no custom key handling. Do NOT use `<details name>` (spec requires `aria-expanded`).
- Evidence: spec L173-184; no existing accordion in repo.

### Q4: RF-15 "shipping cost" claim: what may the copy say?
- Targets: Requirement "Copy integrity", steps/FAQ copy
- Assumed: allowed sentence: "El costo de envío depende de tu zona y lo ves antes de confirmar el pedido." No amount, no "barato/gratis", NO distance claim. Why: the fee is per-zone tariff only. `ZoneRead.delivery_fee` feeds `store.zonaActual.tarifa` (useGoEatsStore.js L166, L336), shown in StoresView L66/L76 and in checkout "Envío (zona)" (StoreDetailView.vue L205). `distance_km` is never used in any fee computation (orders/repository.py L40 just adds the client-sent `delivery_fee`), so "distance + zone tariff" from the exploration is NOT claimable. Live end-to-end is still unverified per steering/product.md, so keep the sentence qualitative.
- Related verified claim: payment default is "Pago contra entrega" (StoreDetailView L18, L183) and a simulated electronic option exists (L187-191). Step 3 may say "confirma y paga contra entrega"; do NOT say "solo efectivo" and do not name any gateway.
- Related: RF-03 tracking is unverified; step 4 must say "consulta el estado de tu pedido" (state machine states are verified), never "en vivo/tiempo real/rastrea".

### Q5: Footer and final-CTA link targets; legal links?
- Targets: Requirement "Final CTA band and footer"
- Assumed: CTA band: `/tiendas` (primary) and `/login` (secondary). Footer: brand text, same-page anchors (`#como-funciona`, `#tiendas`, `#cobertura`, `#comercios`, `#repartidores`, `#app`, `#preguntas`), `/tiendas`, `/login`. NO legal/privacy/terms links (no policy page exists; the Ley 81 "link" in LoginView.vue L132 is a dead `<button>`), no social, no email/phone (unverified). Company line may reuse "Comercios Unidos del Istmo, S.A." (steering/product.md; LoginView L86); year via `new Date().getFullYear()` or omitted.
- Implementation notes: router has NO `scrollBehavior` (src/main.ts L9-12), so use plain `<a href="#id">`, not `RouterLink` with hash. The catch-all `/:pathMatch(.*)*` redirects to `/tiendas` (router.ts L16), so a typo'd footer link would not 404; the test must resolve each footer `to` with `router.resolve` and assert it does not match the catch-all record. Merchant/courier panel CTAs go to `/login` only: LoginView has a register toggle (`modoRegistro`) and role selector but reads no query/route param (L24-25), so the role cannot be preselected without touching LoginView (out of scope). Label them "Crear cuenta o iniciar sesión", not "Registra tu comercio".

### Q6: Are GET /merchants and GET /zones public, and what do they return?
- Targets: Requirements "Featured stores", "Coverage"
- Verified: both PUBLIC (no auth dependency): merchants/router.py L15-20, zones/router.py L10-12. Call them WITH trailing slash, `api.get('/merchants/')`, `api.get('/zones/')` (same as the store, useGoEatsStore.js L153-154; router prefix + "/" means no-slash triggers a FastAPI redirect behind Caddy).
- Merchant shape (MerchantRead): `id, code, name, category_type, zone_slug, rating, delivery_time, is_open, affiliation_status, opens_at, closes_at, description, icon`. Returns ALL statuses (repository.py L10-14, no filter, incl. `en_revision`). Optional `?zone=<slug>`.
- Zone shape (ZoneRead): `id, slug, name, delivery_fee, distance_km, is_active`; service returns active zones only (`list_active`).
- Assumed design: client-filter `affiliation_status === 'activo'`, take first 6 (API order is by id, so it is NOT a ranking: title the section "Comercios en Go Eats", never "Destacados/Populares/Mejor valorados"). Render only `name`, `category_type`, zone name, and `icon` via the existing `CommerceIcon.vue` (whitelisted Lucide icons, falls back to `Store`; do not `import *` Lucide). NEVER render `rating`, `delivery_time`, `delivery_fee`, `distance_km`, `opens_at/closes_at`, `is_open`, `description` (seed demo data). Zone chips: `name` only, no fee. Map zone slug to display name via the zone list (zone_slug on merchant == zone slug).
- Use `api.ts` directly from a landing composable, NOT the Pinia store: the store is initialised from `mockData.js` (useGoEatsStore.js L14, L37-39) and would leak mock ratings/ETAs when the API is down. api.ts never toasts (toasts come from `store.notificacion`), which satisfies "no toast". api.ts timeout is 10 s (L23): pass a per-request `timeout: 5000` so the loading state does not hang. App.vue L14 already triggers `sincronizarConBackend` (same two endpoints), so requests are duplicated once; accepted.
- Category strip: STATIC generic chips (labels only, non-interactive, icons from CommerceIcon's set, no counts) because `category_type` is free text of seed demo values ("Comida típica panameña").

### Q7: CoverageMap: lazy, API key, tiles, cost?
- Targets: Requirement "Coverage"
- Verified: no API key. Tiles are CARTO Voyager raster `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/...` (CoverageMap.vue L104). No CSP anywhere (Caddyfile, index.html have none), so nothing blocks it today; if a CSP is added later it needs `img-src https://*.basemaps.cartocdn.com`. Tiles are not precached (no runtimeCaching rule), so the map is blank offline. Leaflet CSS is already global (main.ts L4), so lazy loading only moves the JS. `defineAsyncComponent(() => import(...))` works; CoverageMap is also imported statically by CourierView/OrdersView/StoresView (lazy routes), so Rollup will emit a shared chunk, never the entry chunk. Precache: lazy is NOT free, `globPatterns **/*.{js,...}` (vite.config.ts L62) still precaches the Leaflet chunk (~150 KB class) into the service worker. The proposal's "zero precache impact" is true only for Playwright. Accept, or exclude it with `globIgnores` (not recommended: offline landing would lose nothing since tiles are offline-dead anyway; leave default).
- Zone circles are hardcoded in `utils/geo.js` (10 slugs identical to seed), independent of the API. So the map still renders when zones fail; chips fall back to text.
- Defects for the landing (default: one additive, default-off-safe prop on CoverageMap, e.g. `estatico`, default `false`, so other views are unchanged): (a) the control bar uses `backdrop-blur` and `bg-white/95` (L390) which contradicts the flat rule; (b) "Mi ubicación" triggers a geolocation permission prompt and `alert()` on landing (L255-259); (c) default map captures one-finger drag and wheel, trapping page scroll on mobile; (d) `attributionControl:false` (L98) while CARTO/OSM require attribution: render a visible caption "© OpenStreetMap contributors © CARTO" next to the map. With `estatico` true: hide controls, disable dragging/scrollWheelZoom/touchZoom/keyboard. If the user rejects touching CoverageMap, fall back to the chips-only coverage with the map behind a "Ver mapa" button (still needs (d)).
- Load trigger: mount the async map only when the section nears the viewport (IntersectionObserver, rootMargin ~200px) so every landing visit does not hit a third-party host and the Leaflet chunk (also relevant to Ley 81 third-party disclosure). jsdom has no IntersectionObserver: guard/stub it in specs; stub CoverageMap in unit tests.

### Q8: PwaStatus install logic: reusable or extract?
- Targets: Requirement "App install section"; Affected area `src/components/PwaStatus.vue`
- Verified: logic is inline in `<script setup>` (PwaStatus.vue L8-44), per-instance refs, mounted once globally in App.vue L21. Two problems if the landing just adds its own listener: (1) timing: PwaStatus listens from App mount, the landing is a lazy route that may mount AFTER `beforeinstallprompt` already fired, so the landing would miss the event; (2) the event's `prompt()` can only be called once, and the global banner and the landing button would both claim it, plus a duplicate banner would show on the landing.
- Assumed: extract a module-level singleton composable `src/composables/useInstallPrompt.ts` (shared refs `canInstall`, `isInstalled`, `isIos`; `install()`; `appinstalled` handler; standalone via `matchMedia('(display-mode: standalone)')` or `navigator.standalone`; iOS via UA + `maxTouchPoints`), registered once; PwaStatus consumes it with a mechanical edit (same template/behavior), and hides its floating banner when `route.name === 'landing'`. PwaStatus has no tests, so TDD covers the composable (red-first) and a manual check covers PwaStatus. If the orchestrator wants PwaStatus untouched: accept duplicate banner plus a landing-own listener, and the missed-event risk.

### Q9: Playwright feasibility
- Targets: Requirement "Real-browser verification"
- Verified: `@playwright/test` is NOT installed (no node_modules entry), no `playwright.config.*`, no `e2e/`, no browser cache at ~/Library/Caches/ms-playwright. Install is not verified (no shell here); this must be the first apply task.
- Assumed: `pnpm add -D @playwright/test`, then `pnpm exec playwright install chromium` (~150 MB download; add `--with-deps` only on Linux/CI; fallback if blocked: `channel: 'chrome'` using system Chrome). pnpm 11 `allowBuilds` (pnpm-workspace.yaml) lists only esbuild; Playwright has no install script needing approval. Single `chromium` project.
- Layout: `playwright.config.ts` at root, specs in `e2e/landing.spec.ts` (outside `src`, deviation from structure.md "colocated specs", justified by vitest `include: ['src/**/*.spec.ts']` in vite.config.ts L8, so `pnpm test` never picks them up). Add script `"e2e": "playwright test"`. `tsconfig.app.json` includes only `src/**`; `tsconfig.node.json` only `vite.config.ts`; so `e2e/` and `playwright.config.ts` are outside `vue-tsc -b` and cannot break it. Do not add a `tsconfig` reference (it would pull `@types/node` needs); optional `e2e/tsconfig.json` unreferenced. Avoid `process.env` in config or guard it.
- Run: `webServer: { command: 'pnpm build && pnpm preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true }`; `E2E_BASE_URL` env to point at the docker web container instead (`docker compose up` serves Caddy on http://localhost:5173, see docker-compose.yml L57-58). `vite preview` inherits `server.proxy` for `/api/v1`, but tests must `page.route('**/api/v1/**')` to mock or abort so results do not depend on the backend (abort path exercises the fallback). Set `use: { serviceWorkers: 'block' }` to avoid the PWA service worker caching between runs. Emulate with `page.emulateMedia({ colorScheme: 'dark' })` and `document.documentElement.classList.add('dark')` for the cascade check; `reducedMotion: 'reduce'` for the motion check; viewport 360x800 for overflow. Cost: dev-only, zero runtime/precache; ~150 MB browser, CI does not exist.

### Q10: Palette conflict (#00B19D vs #00C2A8)
- Targets: tokens.ts / landing.css; steering/tech gap 9
- Assumed: keep `#00B19D` for the landing (tokens.ts L12, landing.css L10, vite manifest `theme_color` L29, CoverageMap L50, LoginView L130 accent). The conflict with `desing.md` `#00C2A8` stays open at the project level and does not block this change because the landing owns its tokens with contrast proofs (primary fill needs the dark `on-primary` label; white on it fails). The image briefs (design doc s8 palette cites `#00C2A8`) MUST state `#00B19D` and flag the mismatch for the designer so a later image swap does not clash.

## Other findings (no question needed)
- Proposal path error: `src/views/LandingView.vue` is actually `src/views/landing/LandingView.vue` (router.ts L6).
- Steering cross-check: structure.md says "one solid primary button per view": default is hero + final band use `.lp-btn` primary (never on screen together); nav CTA, merchant/courier panel CTAs and install button use the secondary/link style.
- Steering cross-check: payment claim (RF-10) is not in the spec's traceability list but step 3 claims cash on delivery; add RF-10. Step 4 maps to the order state machine (RF-16).
- config.yaml `testing.full/focused: none` is stale (`pnpm test` = `vitest run` exists, package.json L10) and steering/tech still says "No test runner exists yet"; recommend refreshing (orchestrator housekeeping, not part of this change).
- Existing tests that must be rewritten red-first: BentoGrid.spec (six tiles, `\d` ban), landing.spec L30-43 (dark blocks), tokens.spec dark loops. The new "prohibited content" scan must NOT ban all digits (steps are numbered 1-4 and zone counts come from the API); ban currency (`$`, `B/`), minutes (`min`), stars/rating, `%`, brand names, "Yappy|Paguelo|tarjeta", "en vivo|tiempo real".
- Phone-UI mock in the hero is `aria-hidden` but its text is still rendered text, so it must obey copy integrity (no prices, ETAs, store names, ratings; use only state names from the state machine).
- Contrast: new bands must be added to `pairsFor` (tokens.ts L60); keep the `dark` export untouched for `add-theme-mode`.

## Resolved
(none yet; no user answers required)

## Correction (map tiles provider)

The statement above, "Verified: no API key" for CARTO Voyager, was wrong: it was never checked at runtime. CARTO now serves a 2049-byte "API KEY REQUIRED" placeholder for every tile (HTTP 200). Replaced by OpenStreetMap standard tiles via `src/utils/mapTiles.ts` (env-overridable with `VITE_MAP_TILE_URL` / `VITE_MAP_TILE_ATTRIBUTION`); caption is now "© OpenStreetMap contributors". A CSP, if added, needs `img-src https://tile.openstreetmap.org` (or the configured provider).
