# Design: Public Landing Page

## Technical Approach
Add a lazy `landing` route at `/` (replacing the redirect), a self-contained `LandingView` that owns `header`/`main`/`footer`, and landing-scoped CSS tokens. First deliver WU1 (vitest tooling + smoke spec), then each requirement test-first (red, green). `App.vue` is adapted (F1) so the shell does not wrap or duplicate landmarks. Only `src/router.ts` is edited for routing (`main.ts:7-12` calls `createRouter` once with these routes; verified).

## Architecture Decisions

### Decision: Router edit
**Choice**: In `src/router.ts` replace line 6 with `{ path: '/', name: 'landing', component: () => import('./views/LandingView.vue') }`. Keep catch-all (line 16) to `/tiendas`.
**Alternatives**: eager import; redirect catch-all to landing.
**Rationale**: Lazy keeps the PWA main bundle small; unknown URLs keep current behavior (spec "existing routes unaffected").

### Decision: App shell (F1) including nested `<main>`
**Choice**: `App.vue:11` becomes `esLanding = route.name === 'landing'`; `<TopBar v-if="!esLogin && !esLanding">`. Also, `App.vue:22` wraps `router-view` in `<main class="flex-1">`, which would nest a second `main` inside LandingView. Render that wrapper as `<component :is="esLanding ? 'div' : 'main'" class="flex-1">`.
**Alternatives**: LandingView without `main` (violates spec); remove the wrapper globally (touches every view).
**Rationale**: Minimal, other routes unchanged. TopBar `backdrop-blur` and mock account switcher never reach anonymous visitors. Residual: the global `.page-enter` 150ms transition (style.css:44) still wraps the route; it is outside landing scope, noted as risk.

### Decision: Icons
**Choice**: Per-icon imports from `@lucide/vue` (`package.json:12`), `aria-hidden="true"`. No `lucide-vue-next`. (Proposal Approach to be corrected.)
**Rationale**: Already installed; tree-shakeable.

### Decision: Tokens scoped to `.landing`, not Tailwind theme
**Choice**: `src/components/landing/landing.css` (imported by LandingView) defines `--lp-*` variables on `.landing`; layout uses Tailwind utilities (`grid-cols-2 md:grid-cols-4 lg:grid-cols-12`), colors via `var(--lp-*)` classes. `tailwind.config.js` and `style.css` untouched.
**Alternatives**: global `:root` tokens + Tailwind mapping (proposal).
**Rationale**: Existing views use `brand/ink/line`; global dark tokens would repaint the white-hardcoded app (Q5). Scoping leaves migration for a future change.

Light: `--lp-primary #00B19D`, `--lp-on-primary #0B2B33`, `--lp-primary-hover #00A491`, `--lp-primary-text #00796B`, `--lp-primary-tint #D6F5F0`, lip `#008F7D`. Hover is hand-computed ~4.8:1 against on-primary; the clarify suggestion `#009C8A` computes to ~4.3:1 and FAILS, so it is rejected (the unit test is the authority). Dark (from `desing.md`): `#2DE0C8`, on-primary `#062A2F`, tint `#10383B`; hover and text derived and tested.
Dark selectors: `@media (prefers-color-scheme: dark){ .landing:not(.light){...} }`, `.dark .landing, .landing.dark, [data-theme="dark"] .landing {...}` (alias covers `desing.md:157`).

### Decision: Token source of truth in TS
**Choice**: `src/components/landing/tokens.ts` exports `{light, dark}` pair lists (fg, bg, min ratio) and a `contrast()` helper; a spec checks every pair and that `landing.css` contains the same hex values.
**Rationale**: Contrast is testable without a browser; the sync check prevents drift.

### Decision: Test tooling
**Choice**: `vite.config.ts` imports `defineConfig` from `vitest/config` and adds `test: { environment: 'jsdom', include: ['src/**/*.spec.ts'] }`; script `"test": "vitest run"`. Specs import `describe/it/expect` from `vitest` (tsconfig.app.json:23 type-checks `src/**/*.ts`; no globals).
**Versions**: vitest `~2.1.9` (Vite 5 native range), `@vue/test-utils ^2.4.6`, `jsdom ^25`, `@fontsource/nunito`, `@fontsource/jetbrains-mono`. NOT verified against the registry (no shell in this phase). WU1 task MUST run `pnpm view vitest@2 peerDependencies version` (and the others) before pinning and adjust; lockfile resolved vite is 5.4.21.
**Rationale**: vitest 2.x targets Vite 5; avoids the vite 6/7 requirement of newer majors.

## Components (`src/components/landing/`, PascalCase, `<script setup lang="ts">`)
- `src/views/LandingView.vue`: `div.landing` > `header` (brand + login link), `main` (HeroTile, BentoGrid), `footer`.
- `HeroTile.vue`: single `h1`, subtitle, two `RouterLink` CTAs ("Pedir ahora" to `/tiendas`, primary; "Iniciar sesión" to `/login`, secondary), `<HeroVisual>`.
- `HeroVisual.vue`: default slot; fallback is a tint circle with `Bike` icon, `aria-hidden="true"` (decorative; Q10).
- `BentoTile.vue`: props `{ title, text, icon }`, renders `h2`, `p`, icon `aria-hidden`.
- `BentoGrid.vue` + `tiles.ts` (six static entries: how it works, coverage, speed, tracking, pricing, app; Spanish copy per Q8, no invented numbers).
- `landing.css`: tokens, 44px min targets, focus ring, `.lp-btn` with lip, `@media (prefers-reduced-motion: reduce){ .landing *{transition:none!important;animation:none!important} }`. No gradients/blur.

## Data Flow
```
/ -> router (name 'landing', lazy) -> App.vue (no TopBar, div wrapper)
   -> LandingView: header | main[HeroTile -> RouterLink /tiendas, /login ; BentoGrid -> 6 BentoTile] | footer
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json`, `pnpm-lock.yaml` | Modify | dev deps vitest, @vue/test-utils, jsdom; deps fontsource; `test` script |
| `vite.config.ts` | Modify | `vitest/config` import, `test` block |
| `src/smoke.spec.ts` | Create | mounts trivial component (WU1) |
| `src/router.ts` | Modify | landing route |
| `src/router.spec.ts` | Create | route table |
| `src/App.vue` | Modify | hide TopBar, div wrapper on landing |
| `src/App.spec.ts` | Create | TopBar absent at `/`, present at `/tiendas` |
| `src/views/LandingView.vue` (+ `.spec.ts`) | Create | page, landmarks |
| `src/components/landing/*` (+ specs, `tokens.ts`, `landing.css`) | Create | tiles, tokens |

## Testing Strategy (Strict TDD: red first, per requirement)

| Requirement | Test |
|---|---|
| Tooling | smoke spec red (missing component) then green |
| Public root | `routes` has `/` named `landing`, no `redirect`; catch-all still `/tiendas`; resolve `/tiendas`,`/login` |
| Hero/CTA | mount with `createRouter(memory)`; one `h1`; exactly one primary, one secondary; `href` `/tiendas` and `/login`; visual slot decorative or alt non-empty |
| Tiles | exactly six `h2`, each with text and `svg[aria-hidden=true]` |
| Contrast | every light/dark pair >= 4.5 incl. primary button, hover, primary-text on tint |
| Flat style | CSS (`?raw`) has no `gradient`, `backdrop-filter`, `blur` |
| Theme | CSS contains media-dark, `.dark`, `[data-theme="dark"]` blocks with equal values |
| Reduced motion | CSS text contains the reduce block |
| Landmarks | one `header`, `main`, `footer`; `main` contains hero and tiles; headings ordered; `ProfileView`-style nesting: no `main` inside `main` in App at `/` |
| Targets | CSS asserts `min-height:44px`/`min-width:44px` and `:focus-visible` on `.lp-btn` (jsdom has no layout) |
| Spanish | tile/CTA copy fixtures; `index.html` has `lang="es"` |
| Build | `pnpm exec vue-tsc -b`, `pnpm build` (manual gate) |

App test uses `vi.mock` for the Pinia store and stubs `TopBar`/`PwaStatus`.

## Migration / Rollout
No migration required. No flag; route swap ships with the commit.

## Rollback & Reversibility
- No DB migrations. Revert restores `redirect: '/tiendas'` in `src/router.ts` and the `App.vue` edits; delete landing files; `pnpm remove` fonts. WU1 tooling can stay.
- No data loss on revert (stateless, static).
- Service worker caches assets (`autoUpdate`): after a revert, clients refresh on next load. Verify by `pnpm build` and visiting `/`.

## Observability
- No new runtime error paths or endpoints; client-only. No logging added.
- Success: `pnpm test` green; `/` served 200 in Caddy access logs, with clicks on `/tiendas` and `/login` as follow-on requests. No analytics exists (out of scope).

## Open Questions
- [ ] Confirm primary #00B19D (Q1), `.dark` + `[data-theme]` aliasing (Q5), og:image left untouched (Q7).
- [ ] Package versions unverified against the registry (no shell here); WU1 must `pnpm view` before pinning.
