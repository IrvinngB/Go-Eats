# Blast Radius: Public Landing Page

| Surface | Consumers found | Class | Locations | Required handling |
|---|---|---|---|---|
| `/` redirect (router.ts:6) | No `push('/')`/`to="/"` anywhere in src. Only `/` users: PWA manifest `start_url`/`scope` | AFFECTED | vite.config.ts:20-21 | Installed PWA now opens landing, not `/tiendas`; accept or note |
| Catch-all (router.ts:16) | Unchanged | INTERNAL | router.ts:16 | Keep; pin in router.spec |
| Role redirects / logout | `router.push('/login')`, `rutaPorRol[...]`, `/tiendas` fallback; none target `/` | INTERNAL | TopBar.vue:73,82,90; LoginView.vue:62 | None; logout still lands on `/login` |
| `App.vue` TopBar/`<main>` | `esLogin` uses `route.path`; `<main>` wraps router-view; TopBar has its own `header` | BREAKS (nested `main`/dup header if unedited) | App.vue:11,20,22 | F1 edit; script is plain JS, so `route.name` ok |
| `store.sincronizarConBackend` on mount | Runs for anonymous visitors at `/`, 8 parallel API GETs | AFFECTED | App.vue:13-15; useGoEatsStore.js:141 | Accept; failures are caught (try/catch); verify no toast on landing |
| `.page-enter` | Global transition names are `page-*` and wrap every route | AFFECTED | style.css:45-54; App.vue:23 | Reduced-motion rule scoped to `.landing` does not cover it; noted risk |
| package.json / lockfile | `pnpm-lock.yaml` is untracked; workspace has `allowBuilds: esbuild` only | AFFECTED | package.json; pnpm-workspace.yaml | jsdom/vitest postinstall may be blocked; verify `pnpm install` |
| Dockerfile | `pnpm install --frozen-lockfile` pins pnpm@11.2.2 | BREAKS if lockfile not regenerated and committed | Dockerfile:6-9 | Commit the lockfile with package.json |
| `pnpm build` (`vue-tsc -b`) | tsconfig.app.json includes `src/**/*.ts`, so specs are type-checked; vite.config.ts is in tsconfig.node | BREAKS if spec types fail | tsconfig.app.json:23; tsconfig.node.json | Explicit vitest imports; confirm `vitest/config` types resolve |
| vite.config.ts | PWA `globPatterns` include css/html; no `navigateFallback` set | AFFECTED | vite.config.ts:55 | Default fallback serves `/` index.html (ok); fontsource woff2 are precached (`woff2` is in the glob), so check precache size |
| Caddyfile | `try_files {path} /index.html` serves `/` | INTERNAL | Caddyfile:19 | None |
| index.html | `lang="es"` ok; Inter loaded via Google Fonts; og:image bolt.new | AFFECTED | index.html:2,13,17 | Nunito/JetBrains are fontsource, with no conflict; og untouched |
| Existing tests | None (`fd *.spec.ts` empty) | INTERNAL | n/a | None |

## Must-handle list
- WU1: `pnpm view` versions, then add vitest/test-utils/jsdom/fontsource, `test` script, and `vitest/config` import.
- Regenerate and commit `pnpm-lock.yaml`; run `docker build` or `pnpm install --frozen-lockfile`.
- Check whether `pnpm-workspace.yaml` needs `allowBuilds` for new packages.
- Edit `App.vue` (esLanding, TopBar `v-if`, `div`/`main` wrapper) with `App.spec.ts`.
- Run `pnpm exec vue-tsc -b` and `pnpm build` after specs exist.
- Decide and record the PWA `start_url` effect (landing on launch).
- Decide whether `.page-enter` needs a reduced-motion override (outside `.landing`) or is accepted.
- Verify that the precache size is acceptable with fontsource woff2.
- Check that an anonymous `/` produces no store notification toast when the backend is down.

## Published surfaces & compatibility
None API-wise. The PWA manifest is user-facing (`start_url: /`); the behavior change is intended.

## Verdict: CONTAINED
