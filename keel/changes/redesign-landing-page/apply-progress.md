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

### Remaining
WU2-WU8.
