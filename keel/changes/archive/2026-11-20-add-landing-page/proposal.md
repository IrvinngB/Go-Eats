# Proposal: Public Landing Page

## Intent
The PWA has no public entry point: `/` redirects straight to `/tiendas`. Visitors get no explanation of Go Eats, coverage, pricing or the app. Add a landing page in the "Friendly Bento" style (`desing.md`). Strict TDD is ON but no runner exists, so test tooling comes first.

## Scope

### In Scope
- WU1: add vitest + @vue/test-utils + jsdom (pnpm), `test` script, config in `vite.config.ts`; one smoke spec.
- Landing route at `/` (replaces redirect to `/tiendas`).
- Hero tile (`--secondary`/`--primary-tint`, `.text-display`, subtitle, 1 primary + 1 secondary CTA, photo/mascot slot).
- Bento of 6 tiles: how it works, coverage, speed, tracking, pricing, app download.
- Light + dark CSS-variable tokens, Nunito/Inter/JetBrains Mono, Lucide icons, flat colors, mobile-first, a11y (44px targets, 4.5:1 contrast, landmarks, alt text).
- Spanish UI copy.

### Out of Scope
- Backend changes.
- Migrating other views to the design system (future change).
- Real photography/mascot art (placeholder slot only).

## Capabilities

### New Capabilities
- `landing-page`: public route, hero, bento tiles, CTAs, theming, accessibility.
- `frontend-testing`: vitest + Vue Test Utils setup and conventions.

### Modified Capabilities
- None (no existing specs; routing change is covered by `landing-page`).

## Approach
- Install `lucide-vue-next`, `vitest`, `@vue/test-utils`, `jsdom`; fonts via `@fontsource` (self-hosted, PWA-friendly).
- `src/views/LandingView.vue` (TS, lazy route) composed of small tiles in `src/components/landing/`.
- Tokens as CSS variables in `src/style.css`, mapped in `tailwind.config.js`; dark via `prefers-color-scheme` plus class.
- Tests colocated `*.spec.ts`: route renders, CTAs link to `/tiendas` and `/login`, tiles present, a11y basics.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json`, `pnpm-lock.yaml` | Modified | test + icon + font deps |
| `vite.config.ts` | Modified | vitest config |
| `src/router.ts` | Modified | `/` -> landing; check duplicate router in `src/main.ts` |
| `src/views/LandingView.vue` | New | page |
| `src/components/landing/*` | New | tiles |
| `src/style.css`, `tailwind.config.js` | Modified | tokens, fonts |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Primary color conflict (#00B19D vs #00C2A8) | High | Decide before design; tokens make it a one-line swap |
| `main.ts` also calls `createRouter` (possible dup of `router.ts`) | Medium | Verify in design |
| New deps bloat PWA bundle | Low | Per-icon imports, lazy route |
| Tokens scoped only to landing diverge from app | Medium | Namespace; future migration change |

## Rollback Plan
Revert the commit(s): restore `redirect: '/tiendas'` in `src/router.ts`, delete `LandingView.vue` and `components/landing/`, remove added deps via `pnpm remove`. Test tooling (WU1) is independent and can stay.

## Dependencies
- None.

## Open Decisions
- Primary color: #00B19D (spec) vs #00C2A8 (design). Contrast on white must be checked for 4.5:1.
- Icon library: Lucide only (confirmed per design).

## Success Criteria
- [ ] `pnpm test` runs and passes; written before the landing code (TDD).
- [ ] `/` renders landing; CTAs reach `/tiendas` and `/login`.
- [ ] `pnpm exec vue-tsc -b` and `pnpm build` pass.
- [ ] No gradients/blur; light and dark both meet 4.5:1.
