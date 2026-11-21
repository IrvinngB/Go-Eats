# Apply Progress: add-landing-page

## WU1: Testing infra (PR1 -> main) - COMPLETE
Tasks 1.1-1.6 done. WU2-WU5 not started.

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
