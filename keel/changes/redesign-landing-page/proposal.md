# Proposal: Redesign Landing Page (classic marketplace)

## Intent
Current landing reads as a six-card grid, not a marketplace. Replace it with a classic marketplace structure using only verified facts, fixed to light mode, and add real-browser verification (the prior change missed a cascade bug jsdom could not see).

## Scope

### In Scope
- Sticky landing nav with CTA and skip link.
- Hero with strong visual (CSS/SVG shapes + phone-UI mock behind existing `HeroVisual` slot).
- Category strip; 4 numbered "how it works" steps.
- Featured stores from `GET /merchants` with loading/error states and static fallback when backend is down.
- Coverage: zone chips from `GET /zones` + lazy-loaded `CoverageMap`.
- "For merchants" and "for couriers" panels, CTAs to `/login`.
- PWA install section reusing `PwaStatus` `beforeinstallprompt` logic, iOS text fallback.
- Accessible FAQ accordion (`aria-expanded`/`aria-controls`), final CTA band, rich footer.
- Light-only landing: remove `prefers-color-scheme`, `.dark`, `[data-theme]` blocks from `landing.css`.
- Image briefs (desing.md s8) committed for a later swap.
- Playwright (dev dependency) real-browser check: computed colors/cascade, 360px no overflow, focus ring, reduced-motion.
- Strict TDD: rewrite BentoGrid/LandingView/landing/tokens specs red-first; mocked `api.ts`.

### Out of Scope
- Backend, theme toggle (`add-theme-mode`), hardening, other views.
- Invented content: prices, ETAs, ratings, stats, testimonials, partner brands, Yappy/Paguelo Fácil, card payments, live-tracking claims.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `landing-page`: replace "Bento tiles" (exactly six) with the marketplace sections (nav, categories, steps, featured stores with fallback, coverage, role panels, install, FAQ, CTA band, footer); replace "Theme tokens" with fixed light mode; adjust "Accessibility" (light-only contrast, skip link, accordion semantics, no smooth scroll under reduced motion) and "Responsive grid" as needed. Kept: public route, CTA routing, flat style, Spanish copy.

## Approach
Approach 1 from exploration. One component per section under `src/components/landing/`, data via `api.ts` with static fallback. `CoverageMap` via `defineAsyncComponent` (Leaflet in its own chunk). Keep `tokens.ts` `dark` export and its contrast test; add new band colors to `pairsFor`. Playwright is dev-only: zero runtime and zero precache impact; cost is CI/dev time and browser download.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/views/LandingView.vue` | Modified | New section composition |
| `src/components/landing/*` (BentoGrid, HeroTile, HeroVisual, tiles.ts) | Modified/New/Removed | Section components; BentoGrid reduced to accent use or removed |
| `src/components/landing/landing.css`, `tokens.ts` | Modified | Light-only; new pairs |
| `src/components/PwaStatus.vue` | Modified | Extract install logic to composable |
| `*.spec.ts` (landing) | Modified | Rewritten red-first |
| `e2e/`, `playwright.config.ts`, `package.json` | New | Browser verification |
| `keel/specs/landing-page/spec.md`, `docs/landing-image-briefs.md` | Modified/New | Delta spec; briefs |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Invented/unverified copy | Med | Review vs RF list; copy checklist in verify |
| Leaflet bloats main bundle | Low | Async component; check build chunks |
| Contrast failures on new bands | Med | Add to `pairsFor`; computed-style check in browser |
| Global `.dark` recolors landing | Low | Playwright cascade test |
| API down breaks sections | Med | Static fallback + mocked tests |
| Playwright setup friction | Med | Dev-only, single chromium project |

## Rollback Plan
Revert the change's commits (single branch/PR); landing returns to the six-tile version. Playwright and briefs are additive, so removing them leaves no runtime effect. No backend or data migration.

## Dependencies
- `@playwright/test` (dev) plus chromium download; backend optional (mocked in tests).

## Success Criteria
- [ ] All sections render at `/`; CTAs route to `/tiendas` and `/login`.
- [ ] Featured stores and zones show API data; fallback shows when API fails.
- [ ] Leaflet is in a separate lazy chunk.
- [ ] Landing stays light under OS dark and `.dark` (browser-verified).
- [ ] Contrast >= 4.5:1; targets >= 44px; focus ring; no horizontal overflow at 360px; no smooth scroll under reduced motion.
- [ ] Accordion toggles `aria-expanded`; skip link works.
- [ ] No prohibited claims; all copy Spanish.
- [ ] Vitest, `pnpm exec vue-tsc -b`, `pnpm build` and Playwright pass.
