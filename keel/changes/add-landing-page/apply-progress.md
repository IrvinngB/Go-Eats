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
