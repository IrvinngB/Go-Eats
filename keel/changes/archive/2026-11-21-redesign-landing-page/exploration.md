## Exploration: redesign-landing-page

### Current State
- `LandingView.vue`: plain header (logo + "Iniciar sesión"), `HeroTile` (h1, 2 CTAs, `HeroVisual` = one Lucide `Bike` in a circle), `BentoGrid` of 6 text+icon tiles (`tiles.ts`), one-line footer. Everything is cards on one grid, so it reads as a card grid. App.vue hides TopBar on `route.name === 'landing'`.
- Spec (add-landing-page) mandates: exactly 6 tiles, 2/4/12 col grid, hero+tiles in main, one h1, no gradient/blur, light AND dark tokens.
- No images exist anywhere: `public/` has only icon.svg, vite.svg, PWA icons. seed.py, backend models and CoverageMap have no image/photo fields (rg: 0 hits in backend/app). Merchants use Lucide icon names only.

### Dark-mode encoding (scope out, preserve for `add-theme-mode`)
| Where | What |
|---|---|
| spec.md "Theme tokens" + Dark preference/Class override scenarios; "Contrast ... in both themes" | requirements to drop/modify (delta) |
| `tokens.ts` `dark` export, `pairsFor` | keep the `dark` export untouched for the future change |
| `landing.css` L22-54 | `@media (prefers-color-scheme: dark) .landing:not(.light)` and `.dark .landing, .landing.dark, [data-theme="dark"] .landing` blocks: remove from landing (or leave unreachable) |
| `landing.spec.ts` L30-42; `tokens.spec.ts` dark loops (L18, L68) | tests asserting dark sync/contrast; must be rewritten, not just deleted |
Safest scoping: landing gets a fixed-light class (e.g. `.landing` only light vars, plus a test asserting no `prefers-color-scheme` in landing.css); keep `dark` in tokens.ts with its contrast test so future work has a verified palette. Beware: global `.dark` on `<html>` must not recolor the landing.

### Verified data available
| Source | Usable facts |
|---|---|
| seed.py zones | 10 Panama City zones (San Francisco, Costa del Este, Bella Vista, Condado del Rey, El Cangrejo, Punta Pacífica, Obarrio, Marbella, Clayton, Brisas del Golf); `GET /zones` is public |
| seed.py merchants | 16 (14 `activo`, 2 `en_revision`), with category_type, zone, description, Lucide icon; categories: típica, café/panadería, japonesa, súper, pizza, pollo, saludable, snacks/postres, ceviche, parrilla, pastas, orgánico, pastelería, cantonesa. `GET /merchants` public. These are DEMO seed names, not real partners |
| Products | ~29+ items with names/descriptions, no photos |
| CoverageMap.vue | Leaflet, CARTO tiles (online), props `modo='coverage'`, zone circles from `COORDENADAS_ZONAS`; reusable but needs network; check it is lazy-loaded |
| PwaStatus.vue | has `beforeinstallprompt` logic to reuse for an install button |
| Roles | customer, merchant, courier (public CTAs); admin/accountant not marketed |
| Claimable RFs | 04 zone discovery, 05/06 catalog, 14 cart+notes, 15 shipping cost (distance+zone tariff), 03 tracking (product.md: NOT verified), 13 merchant catalog/promos/schedule, 16 merchant status updates, 01 assign couriers, 02 courier availability, 19 pickup/delivery details, 07 role registration, 10 cash on delivery + simulated gateway only |
Do NOT claim: prices, ETAs (seed `delivery_time` is demo), ratings, real brands, real-time tracking as proven, card payments, "Yappy/Paguelo Fácil" (conceptual), stats/testimonials. Seed counts (10 zones, 16 stores) must come from the API at runtime, not be hardcoded.

### Standard marketplace landing, feasibility
| Section | Feasible? | Source |
|---|---|---|
| Sticky nav + CTA | Yes | static; links `/login`, `/tiendas`, anchors |
| Hero w/ strong visual | Yes (visual limited, see imagery) | static |
| Category strip | Yes | `category_type` from API or static Lucide chips (names only, no counts) |
| How it works, big numbered steps | Yes | Static: choose store, build cart, confirm (cash on delivery), follow status (state machine states are verified) |
| Featured stores | Partial | `GET /merchants` live (names, category, zone, Lucide icon; no photo, no rating/ETA). Needs loading/empty/error state; falls back to hidden |
| Coverage map | Yes | CoverageMap `coverage` mode or zone chips list (cheaper, offline-safe) |
| For merchants / for couriers | Yes | static copy from RF-13/16/01 and RF-02/19; CTAs to `/login` (no public register route verified; RF-07 says role registration exists, check LoginView) |
| App install | Yes | reuse PwaStatus prompt; fallback text for iOS |
| FAQ accordion | Yes | static; native `<details>`/button+aria-expanded; answers only from verified facts |
| Final CTA band + rich footer | Yes | static; no social/legal links unless routes exist (Ley 81 policy page not verified) |

### Imagery options
| Option | Pros | Cons |
|---|---|---|
| A. Geometric flat CSS/SVG compositions (circles, rounded rects, Lucide glyphs at large scale, phone-frame mock of the status timeline) | zero bytes of precache, flat, on-brand, ships now | desing.md s8 says production art should NOT be hand-coded SVG scenes; weaker "wow"; keep to abstract shapes/UI mockups, not a character |
| B. Image briefs for designer/generator (s8: courier on bike hero, flat vector, `#00C2A8 #2E2A7A #FFB62E #0B2B33 #F2F7F7`, WebP/PNG transparent 1:1/4:3) | matches design doc, best result | blocks on external asset; precache grows (globPatterns includes png/svg, not webp) |
| C. Real photos from seed | none exist; would have to be sourced/licensed | cannot ship now |
Hybrid: build with A behind a single `<HeroVisual>` slot (already exists), commit briefs for B and swap later.

### Approaches (page structures)
1. **Classic marketplace (recommended)**: sticky nav+CTA > hero (split, CTA pair, A-visual) > category strip (API/static chips) > "Cómo funciona" 4 large numbered steps > featured stores (live) > coverage (zone chips + lazy map) > for merchants | for couriers (2 wide panels) > install > FAQ (6 Q) > final CTA band > rich footer. Effort: Medium-High.
2. **Story/scroll bands**: alternating full-width solid-color bands (tint / surface / primary), each with one idea; bento only for features inside "why Go Eats". Fewer data calls (static). Effort: Medium.
3. **Lean**: nav, hero, steps, coverage, roles, FAQ, CTA, footer; no live stores, no map. Effort: Low. Weakest "real marketplace" feel.

### Recommendation
Approach 1, with featured stores and map lazy/optional (graceful fallback to static), visuals via A now + briefs for B. This replaces the "exactly six tiles" requirement, so the spec needs a MODIFIED delta: keep route/CTA/a11y/flat/Spanish; replace Bento tiles and Theme tokens (light only). Reuse `.lp-btn`, tokens, light palette. Keep bento only as accent inside sections (desing.md s6 allows 5-7 tiles in landing; band separators "solid color", 64-96px section padding).

### Risks
- Precache: `globPatterns` has png/svg not webp/jpg; big images bloat SW; Leaflet chunk must be lazy (`defineAsyncComponent`) and map tiles are external/uncached.
- A11y: accordion needs aria-expanded/controls or `<details>`; single h1, ordered h2/h3; sticky nav needs skip link, 44px targets, focus ring; anchors vs reduced-motion (no smooth scroll).
- Copy: Spanish only; must be reviewed against RF list (tracking unverified; cash on delivery only). Ley 81 footer links need a real page.
- Contrast: new band colors must be added to `pairsFor` and tested; `primary` fill fails as text.
- Tests (Strict TDD): current tests parse landing.css and tokens.ts and assert exactly 6 tiles (BentoGrid.spec, LandingView.spec); these need rewriting first (red) for the new structure; API-backed sections need mocked `api.ts`.
- TopBar shell: App.vue already hides TopBar for landing; the landing needs its own nav; verify `/` flows for authed users still behave.
- Palette conflict (#00B19D vs #00C2A8) still open; landing uses #00B19D.
- Design-doc conflict: s6 says "5-7 tiles" and s8 discourages hand-coded SVG scenes.

### Ready for Proposal
Yes. Open decisions for the user: (1) accept Approach 1; (2) hybrid imagery (A now, B later) vs wait for assets; (3) live merchants fetch vs static; (4) whether merchant/courier CTAs go to `/login` (verify a registration route exists).
