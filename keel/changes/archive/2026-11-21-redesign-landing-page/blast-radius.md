# Blast Radius: Redesign Landing Page

| Surface | Consumers (rg-proved) | Class | Handling |
|---|---|---|---|
| landing/BentoGrid, BentoTile, tiles.ts + 2 specs | only LandingView.vue:9,22 and own specs (BentoGrid.spec.ts:3-4, BentoTile.spec.ts:4) | INTERNAL | delete with LandingView rewrite |
| HeroTile(+spec), HeroVisual(+spec) | LandingView.vue:8,21; specs only | INTERNAL | rename/rewrite |
| tokens.ts / landing.css | tokens.spec.ts:2, landing.spec.ts:2-3 (`?raw`), LandingView.vue:7; vite.config.ts:10 `css.include /landing\.css/` | AFFECTED | keep single landing.css filename; specs updated first (TDD) |
| LandingView.vue | router.ts:6 lazy import; App.spec.ts:43 asserts "exactly one main" on landing | AFFECTED | keep one `main`; App.vue shell renders `div` on landing (App.vue:23) |
| PwaStatus.vue | App.vue:5,21; stubbed in App.spec.ts:33, App.sync.spec.ts:35; no own spec | AFFECTED | stubs unaffected; add useInstallPrompt spec; manual check banner |
| CoverageMap.vue | StoresView.vue:83 (coverage), OrdersView.vue:126, CourierView.vue:139 (tracking). StoreDetailView/admin: no usage | AFFECTED (low) | all callers pass no `estatico`; Boolean default false = unchanged. No CoverageMap spec exists, so no regression net: manual check 3 callers |
| api.ts `/merchants/`, `/zones/` | store useGoEatsStore.js:153-154 uses identical paths; backend routers prefix + `"/"` (merchants/router.py:12,15; zones/router.py:7,10) so slash form is canonical (no redirect); CORS `*` (main.py:36); Caddy `handle /api/*` proxies to api:8000 | AFFECTED (none) | duplicate calls accepted; keep trailing slash |
| package.json / lock | Dockerfile:8-9 `pnpm install --frozen-lockfile` installs devDeps; lock has no playwright entry | BREAKS if lock not committed | commit updated pnpm-lock.yaml. `@playwright/test` install does NOT download browsers (only `playwright install` does), so no image bloat; devDep is only in build stage |
| vitest/tsconfig vs e2e/, playwright.config.ts | vitest include `src/**/*.spec.ts`; tsconfig.app include `src/**`; tsconfig.node `vite.config.ts` only | AFFECTED | e2e files outside every project: not typechecked; optionally add playwright.config.ts to tsconfig.node. `vue-tsc -b` still checks new src specs (strict, noUnusedLocals) |
| vite PWA globPatterns | vite.config.ts:62 includes svg, woff2; `public/` copied to dist | AFFECTED | wordmarks must leave `public/` (22 files would precache); Nunito 400 adds woff2 |
| Wordmark move | refs to `go-eats-wordmark` only inside the dir itself; `.gitignore`/`.dockerignore` do not ignore docs/ or public/ (docs/ does not exist yet); Docker `COPY . .` copies public/ | INTERNAL | mkdir docs/brand/wordmarks, copy before mv |
| App.vue / router.ts | esLanding App.vue:12,22; routes `/tiendas` (router.ts:8), `/login` (:7) exist before catch-all (:16 redirects to /tiendas) | AFFECTED | footer link spec via router.resolve must assert `name`, not just no-throw |
| Service worker | `registerType: 'autoUpdate'`; Caddy `no-cache` for sw.js, registerSW.js, manifest | INTERNAL | returning users self-heal on next load; web container needs `docker compose build web` |
| index.html | Inter loaded from Google CDN; landing fonts imported in LandingView.vue:3-6 | INTERNAL | add latin-400 import in LandingView |

## Must-handle list
- Commit updated pnpm-lock.yaml with @playwright/test (frozen-lockfile).
- Keep one `<main>` in LandingView (App.spec.ts:43).
- Keep `landing.css` name (vitest css.include).
- Move wordmarks out of public/ first (copy to docs/brand/wordmarks, then src/assets/brand).
- Add `.gitignore` entries test-results/, playwright-report/; add e2e `.dockerignore` not needed (no browsers).
- Manual check CoverageMap in StoresView, OrdersView, CourierView.
- Footer link spec asserts route names `stores`, `login`.
- Rebuild web container; verify SW update.

## Published surfaces & compatibility
None (no API or exported package changes; estatico additive).

## Verdict: CONTAINED
