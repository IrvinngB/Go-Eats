# Clarifications: Public Landing Page (add-landing-page)

Mode: AUTOMATIC. No BLOCKERs raised; every item proceeds with the stated default. Items marked CONFIRM need the user's eventual sign-off but do not stop design.
open_questions: 3 CONFIRM (Q1, Q5, Q7) + 6 plain assumptions. 1 new finding (F1) that design MUST handle.

## BLOCKER — must answer before design
None.

## NEW FINDING (not in the brief; design must handle)
### F1: App shell conflicts with landing spec
- Evidence: `src/App.vue:11,21` renders `<TopBar v-if="!esLogin">` on every route except `/login`. `src/components/TopBar.vue:87` is a `<header class="sticky ... bg-white/95 backdrop-blur">` showing role/user/account-switcher UI.
- Conflicts: (a) spec "one `header`" landmark; (b) spec "No gradient/backdrop-filter/blur" (TopBar uses `backdrop-blur`); (c) an anonymous visitor would see the mock account switcher.
- Assumed default: extend `App.vue` to also hide TopBar on `/` (e.g. `route.name === 'landing'`), and LandingView owns its own `header`/`main`/`footer`. Do NOT touch TopBar's blur (out of scope, future design-system migration). Tests assert landmarks on LandingView mounted alone, plus one App-level test that TopBar is absent at `/`.

## ASSUMPTION — proceeding with default unless corrected

### Q1 (CONFIRM): Primary color #00B19D vs #00C2A8
- Targets: Requirement "Theme tokens" and "Accessibility" (landing-page/spec.md); proposal Open Decisions.
- Assumed: `--primary: #00B19D` (matches `vite.config.ts:23` theme_color and `index.html:8`, so no PWA chrome mismatch). Value is a one-line token swap if the user prefers #00C2A8.
- Contrast (computed WCAG relative luminance):
  - #00B19D on white: ~2.7:1 FAIL; #00C2A8 on white: ~2.26:1 FAIL. So neither may be used as text/link color or white-label background; both work only as a fill.
  - `--on-primary #0B2B33` on #00B19D: ~5.5:1 PASS; on #00C2A8: ~6.6:1 PASS. Primary button label MUST be dark, never white.
  - `--primary-text #00796B` on white: ~5.3:1 PASS; on `--primary-tint #D6F5F0`: ~4.6:1 PASS (thin margin; do not lighten).
- Note: `desing.md` `--primary-hover #00AD96` is almost identical to #00B19D, so hover would be invisible. Design should derive a darker hover (e.g. ~#009C8A) and re-check lip `#008F7D`.
- Dark theme values from `desing.md` (#2DE0C8 primary, #062A2F on-primary, tint #10383B) are assumed; the design phase must compute and unit-test every pair (spec scenario "Contrast").
- Evidence: desing.md:58-63,87-92,106; steering/tech gap 9.

### Q2: Which router is live
- Targets: Requirement "Public root route" (landing-page/spec.md).
- RESOLVED with evidence: no duplicate. `src/main.ts:7-12` imports `routes` from `./router` and calls `createRouter` once; `src/router.ts:6` holds the single `{ path: '/', redirect: '/tiendas' }`. Edit only `router.ts`. Proposal risk can be closed.
- Also: catch-all `router.ts:16` redirects unknown paths to `/tiendas`; keep as is (unknown URLs do not land on the landing page). Add route `name: 'landing'`, lazy import.

### Q3: Test file location
- Targets: Requirement "Spec discovery" (frontend-testing/spec.md); steering/structure leaves it open.
- Assumed: colocated `*.spec.ts` beside the unit, as the spec already states. vitest `include: ['src/**/*.spec.ts']`. Resolves steering "decide in first change".
- Build safety (verified): `tsconfig.app.json:23` includes `src/**/*.ts`, so specs ARE type-checked by `vue-tsc -b` (good) and must import `describe/it/expect` explicitly from `vitest` (no globals types needed). Vite only bundles imported modules, so specs never reach `dist`. `vite.config.ts` has no `test` key yet: use `import { defineConfig } from 'vitest/config'` (or a triple-slash reference) so tsc accepts it. `package.json` has no `test` script: add `"test": "vitest run"`.
- Evidence: package.json:6-10, vite.config.ts:1-5.

### Q4: CTA routing
- Targets: Requirement "Call-to-action routing".
- Assumed: primary "Pedir ahora" -> `/tiendas`; secondary "Iniciar sesión" -> `/login`, both rendered as `<RouterLink>` (real `<a href>`, not buttons with `router.push`), so they are keyboard/AT correct and testable via `href`. Exact label copy is a design detail.
- Evidence: both routes exist, `router.ts:7-8`; `/tiendas` has no auth guard (no `beforeEach` anywhere in `src`).

### Q5 (CONFIRM): Dark theme trigger
- Targets: Requirement "Theme tokens".
- Assumed: dark when OS prefers dark OR a `.dark` class on the root. Implementation: `:root` light tokens; `@media (prefers-color-scheme: dark) { :root:not(.light) {...} }` plus `.dark {...}` with same values. Nothing in the app sets the class yet, so only the OS path is user-visible now.
- Discrepancy: `desing.md:157` uses `[data-theme="dark"]`, the spec says "dark class". Follow the spec (class). Flag to confirm; trivial to alias both selectors.
- Scoping: tokens are namespaced to the landing (e.g. `.landing` scope or `--lp-*`) because existing views use Tailwind `brand/ink/line` colors; dark mode must not repaint the rest of the app (TopBar is white-hardcoded and would look broken).

### Q6: Reduced-motion strictness
- Targets: Requirement "Accessibility" (reduced motion).
- Assumed: strict. Under `prefers-reduced-motion: reduce`, `transition: none; animation: none` on all landing elements, including the button-press lip collapse and hover transitions. Default (no-preference) allows only short color/transform transitions (<=150ms). Verifiable by a CSS-text assertion in a spec (jsdom lacks `matchMedia` for CSS; test the source rule).

### Q7 (CONFIRM): Root lang and index.html
- Targets: Requirement "Spanish copy".
- RESOLVED with evidence: `index.html:2` already has `<html lang="es">`; manifest `lang: 'es'` (`vite.config.ts:29`). No index.html change needed for lang.
- Adjacent, flag only: `index.html:17-19` og:image/twitter:image point to `bolt.new` placeholder; fonts come from Google Fonts CDN (`index.html:13-15`) while the proposal says self-host via `@fontsource`. Assumed: add `@fontsource` for Nunito + JetBrains Mono, import in the landing entry, and leave the Inter Google link and og tags untouched (out of scope); mention for a later cleanup. Confirm whether you want og:image fixed in this change (default: no).

### Q8: Pricing and coverage tile content
- Targets: Requirement "Bento tiles" (pricing, coverage).
- Verified: `arquitectura_tech_stack_y_rf_go_eats.md` contains NO monetary amounts or named coverage areas. Facts available: RF-04 (stores per coverage polygon), RF-15 (shipping cost estimated from distance and zone tariff), Panama market, cash on delivery + simulated gateway.
- Assumed copy (no invented numbers, no named districts):
  - Coverage: "Comercios disponibles según tu zona de cobertura. Ingresa tu dirección y mira qué hay cerca."
  - Pricing: "El costo de envío se calcula según la distancia y la tarifa de tu zona. Lo ves antes de confirmar el pedido."
  - Payments mention only cash on delivery if at all; do not name Yappy/Paguelo Fácil (conceptual only per steering/product).
  - Speed: no minutes promised (the spec's 4 s is server latency, not delivery time); copy e.g. "Pedidos preparados y repartidos por comercios de tu zona."
  - Tracking: ties to RF-03 but real-time tracking is unverified in code (steering/product); copy stays generic ("Sigue el estado de tu pedido") and avoids "en tiempo real en el mapa".
- App download tile: PWA install, no store badges or links (no native apps exist). Assumed copy "Instálala desde tu navegador" with no fake store URLs; optionally wire to existing `PwaStatus.vue`/beforeinstallprompt later (out of scope).

### Q9: Already-logged-in users visiting `/`
- Targets: Requirement "Public root route" ("without authentication", "MUST NOT redirect").
- Verified: no route guard exists; session state is the Pinia store (`autenticado`, `rol` in `useGoEatsStore.js:34-35`), initialized in memory (mock/login flow), tokens in localStorage (`api.ts:3-17`). No session restoration on reload was found.
- Assumed: no redirect; landing renders for everyone (matches the spec literally). Primary CTA stays `/tiendas`. No auth-aware header in this change (keeps landing free of store coupling and testable without Pinia). Risk: a logged-in merchant/courier tapping "Pedir ahora" lands on the customer catalog; acceptable for the MVP. Flag for a future change if auth-aware landing is wanted.

### Q10: Hero image slot while no illustration exists
- Targets: Requirement "Hero tile" (image slot with alt text or decorative).
- Verified: `public/` has only `icon.svg`, `pwa-192x192.png`, `pwa-512x512.png`; no illustration or mascot asset.
- Assumed: slot is a flat-color tile (`--accent-tint`/`--primary-tint` circle) holding a large Lucide icon (e.g. `Bike` or `ShoppingBag` from `@lucide/vue`, `aria-hidden="true"`) inside a container marked `role="img"` with Spanish `aria-label`/alt text OR treated as decorative (`aria-hidden`). Pick decorative: the spec allows "marked decorative", so a placeholder carries no information. Component is an `<HeroVisual>` with a default slot so an `<img alt>` can replace it later without touching the hero.
- No gradients, no blur.

## Other verified discrepancies for design
- Icon package: proposal says install `lucide-vue-next`; the project already depends on `@lucide/vue ^1.73.0` (`package.json:12`). Assumed: use `@lucide/vue`, do NOT add `lucide-vue-next`. Update proposal Approach.
- Dependencies to add: `vitest`, `@vue/test-utils`, `jsdom` (dev), `@fontsource/nunito`, `@fontsource/jetbrains-mono`. Vite 5.4 -> use a vitest major compatible with Vite 5 (vitest 2.x/3.x); design must pin and verify since the manifest also lists unusual versions (pinia ^4.1.0, vite-plugin-pwa ^2.0.0) that `pnpm install` is expected to resolve per steering.
- `tailwind.config.js` exists (not read in detail); tokens map there per the proposal.

## Resolved
- R1 (Q2): single router, edit `src/router.ts` only, no duplicate in `main.ts`.
- R2 (Q7): root `lang="es"` already set; `index.html` lang needs no change.
- R3 (Q3, partial): colocated specs; verified type-check/bundle implications.
