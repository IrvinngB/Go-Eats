# Landing image briefs

Briefs for a designer or an image generator, derived from `desing.md` section 8 ("Iconography, illustration and imagery"). Today the hero art is a coded set of flat circles and a phone mock (`src/components/landing/HeroVisual.vue`). These briefs are for a later swap; nothing here blocks the current landing.

## Common spec

| Item | Value |
|---|---|
| Format | PNG or WebP, transparent background, no baked-in shadow |
| Aspect ratio | 1:1 (hero, empty states) or 4:3 (wide scenes). Hero: 1:1 |
| Style | Flat vector look, rounded shapes, round proportions, uniform line weight, minimal face on characters |
| Colors | 4 to 5 flat colors from the palette below. No gradients, no shadows, no textures |
| Text | None inside the image (copy stays in HTML) |
| Delivery | Master at 1600 px on the long side (hero) and 800 px (spot illustrations). Also deliver the editable vector source (SVG or Figma) |

### Palette

| Role | Hex | Note |
|---|---|---|
| Primary turquoise | `#00B19D` | What the product ships today (`--lp-primary`, `tokens.ts`) |
| Indigo | `#2E2A7A` | Secondary, indigo bands |
| Amber | `#FFB62E` | Accent |
| Ink | `#0B2B33` | Outlines and dark details |
| Surface | `#F2F7F7` | Neutral backgrounds and highlights |

Palette mismatches to resolve before commissioning (decide once, then brief the designer with the final hex):

- `desing.md` section 8 lists primary as `#00C2A8`. The shipped primary is `#00B19D`. The parked wordmarks `sobre-turquesa` and `sobre-ambar` still carry a `#00C2A8` rect. This brief uses `#00B19D` because it is what the UI renders; the illustration must sit next to the UI buttons without a visible tone gap.
- The wordmark art uses other turquoise shades: `#008F7D` (`--lp-primary-lip`, button lip) and `#00A58E`-range tones inside the color wordmark. These are acceptable as shading of the same family, but the illustration should stay with the single primary plus ink and not add them as extra colors.

## Scenes

Same character in all scenes: round courier with a turquoise jacket, indigo bag or parcel, amber accent, ink outline.

1. **Courier on a bike (landing hero).** 1:1. Courier riding to the right with a parcel on the back. Calm, friendly pose. Leave empty margin around the figure so it can sit on a primary-tint circle. Used in: `HeroVisual` slot.
2. **Parcel delivered with a check.** 1:1. Closed parcel with a large check badge in primary. Used in: delivered screen, order status "Entregado".
3. **Empty cart.** 1:1. Open cart with nothing inside, small amber spark. Used in: customer cart empty state.
4. **No orders yet.** 4:3. Empty shelf or tray with a single small bag, neutral and inviting (not sad). Used in: orders list empty state.
5. **Lost route / error.** 4:3. Courier with a map and a dotted route that ends in a loop, confused but friendly face. Used in: not-found and error pages.
6. **Courier waiting at a door.** 4:3. Courier holding a parcel in front of a closed door with an indigo frame. Used in: delivery waiting state.

## Integration notes

- **Hero swap.** `HeroVisual.vue` exposes a default `<slot>` around the coded art. Replace through the slot from `HeroSection.vue` with an `<img>`: `<HeroVisual><img src="..." alt="..." width="..." height="..." /></HeroVisual>`. Use a real `alt` only if the image carries meaning (for example "Repartidor en bicicleta llevando un pedido"). If it is decoration beside the headline, use `alt=""`. Always set `width` and `height` to avoid layout shift, and `loading="eager"` plus `fetchpriority="high"` for the hero (it is above the fold); spot illustrations use `loading="lazy"`.
- **Import from `src/assets/`** so Vite hashes the file, like the wordmarks. Do not put it in `public/`.
- **Sizes.** Hero displays at most about 480 px wide on desktop and 300 px on mobile. Ship 1x and 2x (960 px) at most. Target under 60 KB for WebP and under 120 KB for PNG.
- **WebP and AVIF.** Prefer WebP (transparent, broadly supported). AVIF is optional through `<picture>` with a WebP fallback.
- **PWA precache implication.** `vite.config.ts` has `workbox.globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']`. PNG and SVG imported by the app are precached (counted in the install size). **WebP and JPG are not matched**, so a WebP hero would not be available offline on first load unless a runtime caching rule or the pattern is extended. Decide deliberately:
  - Hero needed offline: add `webp` to `globPatterns` (cost: its size in every install and update), or keep PNG for the hero only.
  - Hero not needed offline: leave WebP out of the precache; the browser fetches it on demand and the landing degrades to the empty circle if offline.
  - Current precache is 39 entries, about 689 KiB; budget the added bytes against that.
- **Do not recolor** the final art in CSS. Any palette change goes back to the designer.
