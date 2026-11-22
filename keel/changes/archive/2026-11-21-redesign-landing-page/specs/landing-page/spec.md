# Delta for Landing Page

## ADDED Requirements

### Requirement: Marketplace sections

Below the hero the page MUST show nine sections, in order: category strip, how it works, featured stores, coverage, merchants, couriers, app install, FAQ and final CTA band (original: "exactly six tiles: how it works, coverage, speed, tracking, pricing, and app download"). Merchants and couriers MUST be two separate `section`s. The featured stores section MUST be titled neutrally "Comercios en Go Eats" (no "destacados" or "populares"). Each section MUST have a heading, short Spanish text and, where an icon is used, a Lucide icon (original: "Each tile MUST have a heading, short text and a Lucide icon"). Decorative icons MUST be hidden from assistive technology.
(Previously: "Bento tiles" required exactly six tiles, each with heading, short text and a Lucide icon, covering how it works, coverage, speed, tracking, pricing and app download; merchants and couriers were one panels item and the stores title was unspecified)

#### Scenario: Six tiles present
(Original scenario name, now: nine sections present)
- GIVEN the landing page is rendered
- WHEN the sections inside `main` are listed
- THEN the hero is followed by the nine sections above in that order, each with a heading and text, merchants and couriers being separate sections
(Previously: GIVEN the page is rendered WHEN tiles are counted THEN exactly six exist, each with a heading, text and icon, covering the six topics)

#### Scenario: Neutral stores title
- GIVEN the featured stores section is rendered
- WHEN its heading is read
- THEN it is "Comercios en Go Eats" and no text says "destacados" or "populares"

#### Scenario: Decorative icons
- GIVEN an icon accompanies visible text
- WHEN assistive technology reads the section
- THEN the icon is hidden from it
(Previously: "a tile icon ... reads the tile")

### Requirement: Responsive layout

The layout MUST be mobile-first with no horizontal scroll or overflow at 360px (original: "use 2 columns on mobile, 4 on tablet and 12 on desktop, with no horizontal scroll"). Sections MUST stack in one column on mobile and MAY use multiple columns from `md` and `lg`. The 2/4/12 column scheme applies only to an optional bento accent grid.
(Previously: "Responsive grid" required 2 columns on mobile, 4 on tablet and 12 on desktop for tiles)

#### Scenario: Mobile
- GIVEN a 360px-wide viewport
- WHEN the page renders
- THEN sections stack in one column and the page has no horizontal overflow
(Previously: tiles use a 2-column grid)

#### Scenario: Tablet and desktop
- GIVEN tablet (`md`) and desktop (`lg`) viewports
- WHEN the page renders
- THEN sections may use multiple columns and, if a bento accent grid exists, it uses 4 and 12 columns respectively
(Previously: the grid uses 4 and 12 columns respectively)

### Requirement: Fixed light theme

Colors MUST come from CSS variable tokens; the landing MUST use light-theme tokens only (original: "defined for light and dark themes. The dark theme MUST apply when the OS prefers dark or when the dark class is set"). Nothing global (the `dark` class on the root, `prefers-color-scheme`, a theme attribute) MUST recolor it.
(Previously: "Theme tokens" defined light and dark tokens, applying dark on OS preference or the dark class)

#### Scenario: Dark preference
- GIVEN the OS prefers dark
- WHEN the landing renders
- THEN its computed colors equal the light token values
(Previously: dark token values apply)

#### Scenario: Class override
- GIVEN the dark class is set on the root element
- WHEN the landing renders
- THEN its computed colors equal the light token values
(Previously: dark token values apply regardless of OS preference)

#### Scenario: No dark rules in landing styles
- GIVEN the landing styles
- WHEN they are scanned
- THEN no `prefers-color-scheme`, dark-class or theme-attribute rules target the landing

### Requirement: Sticky navigation and skip link
The page MUST have exactly one `nav` (aria-label "Principal"), inside the sticky `header`, with the brand, section anchors and a login CTA to `/login`. Anchors MUST show from `md` up; below `md` only the brand and login CTA show. A skip link MUST precede the header, be the first focusable element and move focus to `main` (`tabindex="-1"`). Footer links MUST NOT be wrapped in a `nav`. The sticky header MUST NOT hide anchored or focused content (scroll-padding-top).

#### Scenario: Skip link
- GIVEN a keyboard user on a fresh page load
- WHEN they press Tab once and activate the focused control
- THEN the skip link is focused and `document.activeElement === main`

#### Scenario: Nav stays visible
- GIVEN the page is scrolled down
- WHEN the viewport is inspected
- THEN the navigation and its CTA remain visible

#### Scenario: Mobile nav
- GIVEN a viewport below `md`
- WHEN the nav is inspected
- THEN only the brand and the login CTA are visible

#### Scenario: Single nav
- GIVEN the rendered page including the footer
- WHEN `nav` elements are counted
- THEN exactly one exists, labelled "Principal", and the footer link list is not inside a `nav`

### Requirement: Brand wordmark
The Go Eats wordmark MUST appear in the nav (variant `color`, or `color-sin-swoosh` where compact) and on colored bands and the footer using the matching `sobre-indigo`, `sobre-turquesa` or `sobre-ambar` variant. SVG files MUST live under `src/assets/brand/` and be imported individually so only used variants are bundled and the 22 variants are never all in the PWA precache. The wordmark MUST have the accessible name "Go Eats" (role `img` with aria-label, or alt) and link to `/`. SVGs MUST NOT be recolored.

#### Scenario: Nav wordmark
- GIVEN the landing is rendered
- WHEN the nav brand is inspected
- THEN it shows the `color` (or `color-sin-swoosh`) variant, is named "Go Eats" and links to `/`

#### Scenario: Matching variant on bands
- GIVEN the footer or a colored band shows the wordmark
- WHEN its variant is inspected
- THEN it is the `sobre-*` variant matching the band background

#### Scenario: Bundle scope
- GIVEN the production build
- WHEN the output and precache manifest are inspected
- THEN only the used variants appear, not all 22, and no SVG was recolored

### Requirement: Hero visual
The hero MUST render its visual in a `HeroVisual` slot made of CSS/SVG geometric shapes and a phone-UI mock, marked decorative (`aria-hidden`), with no raster image required.

#### Scenario: Decorative visual
- GIVEN the hero is rendered
- WHEN assistive technology reads it
- THEN the visual is hidden from it and no text inside it is announced

### Requirement: Category strip
The page MUST show a strip of static, non-interactive category chips with icons and no counts.

#### Scenario: Categories
- GIVEN the landing page is rendered
- WHEN the strip is inspected
- THEN it lists category names with icons, no numeric counts, and no chip is a link or button

### Requirement: How it works steps
The page MUST show exactly four numbered steps: choose a store, build the cart, confirm (cash on delivery), follow order status.

#### Scenario: Four steps
- GIVEN the section is rendered
- WHEN steps are counted
- THEN four exist, numbered 1 to 4 in order

### Requirement: Featured stores
The page MUST fetch stores through `api.ts` (not the Pinia store) from `/merchants/` with trailing slash and a 5 s timeout, keep only `affiliation_status === 'activo'`, cap at 6, and show name, category, zone and icon only. It MUST have loading, empty and error states; on empty or error it MUST show static fallback content, no toast, and not break the page.

#### Scenario: Loaded
- GIVEN the API returns stores
- WHEN the section renders
- THEN at most 6 active stores appear with name, category, zone and icon, and no price, rating, ETA or fee

#### Scenario: Inactive filtered
- GIVEN the API returns stores with other affiliation statuses
- WHEN the section renders
- THEN only `activo` stores appear

#### Scenario: Loading
- GIVEN the request is pending
- WHEN the section renders
- THEN a loading indicator is shown

#### Scenario: Empty
- GIVEN the API returns no active stores
- WHEN the section renders
- THEN the static fallback content is shown

#### Scenario: Backend down
- GIVEN the request fails or exceeds 5 s
- WHEN the section renders
- THEN static fallback content is shown, no toast appears and all other sections render

### Requirement: Coverage
The page MUST show zone chips from active zones fetched from `/zones/` (trailing slash) and a map loaded lazily (`defineAsyncComponent`) only when the section nears the viewport (IntersectionObserver), so the map library is not in the initial chunk (the chunk is still precached). The map MUST show a visible "OpenStreetMap / CARTO" attribution caption, MUST NOT trigger a geolocation prompt or `alert()`, and MUST NOT trap page scroll. If zones fail it MUST show static fallback text without a toast.

#### Scenario: Zone chips
- GIVEN the API returns zones
- WHEN the section renders
- THEN one chip per active zone is shown

#### Scenario: Lazy map
- GIVEN the production build and the section far from the viewport
- WHEN the initial chunk is inspected
- THEN it lacks the map library, which sits in a separate chunk not requested until the section nears the viewport

#### Scenario: Attribution and no prompts
- GIVEN the map is rendered on the landing
- WHEN it is inspected and the page is used
- THEN the attribution caption is visible and no geolocation prompt or `alert()` occurs

#### Scenario: Zones fail
- GIVEN the zones request fails
- WHEN the section renders
- THEN fallback text is shown and the page does not crash

### Requirement: Merchant and courier panels
The page MUST show a merchants section and a couriers section, each with a secondary-style CTA navigating to `/login`.

#### Scenario: Panel CTAs
- GIVEN the panels are rendered
- WHEN each CTA is activated
- THEN the router navigates to `/login`

### Requirement: App install section
The section and the PwaStatus banner MUST share one singleton composable (`useInstallPrompt`). The section MUST offer an install button when `beforeinstallprompt` is available (even if it fired before mount), a neutral text when not, and an iOS text fallback (Share, Add to Home Screen) on iOS. When installed it MUST be hidden or neutral. The floating PwaStatus banner MUST be hidden on the landing.

#### Scenario: Prompt available
- GIVEN `beforeinstallprompt` fired
- WHEN the section renders
- THEN an install button is shown and activating it triggers the prompt

#### Scenario: Event fired before mount
- GIVEN the event fired before the landing mounted
- WHEN the section renders
- THEN the install button is still shown

#### Scenario: Prompt unavailable
- GIVEN no prompt event and a non-iOS browser
- WHEN the section renders
- THEN no install button is shown and neutral text appears

#### Scenario: iOS
- GIVEN an iOS browser
- WHEN the section renders
- THEN text instructions are shown instead of a button

#### Scenario: Already installed
- GIVEN the app runs in standalone mode
- WHEN the section renders
- THEN it is hidden or shows no install action

#### Scenario: No duplicate banner
- GIVEN the route is the landing
- WHEN the page renders
- THEN the floating PwaStatus banner is not shown

### Requirement: FAQ accordion
The FAQ MUST be an accordion whose triggers are `button`s exposing `aria-expanded` and `aria-controls`, operable by keyboard (Enter and Space). Only one item MAY be open at a time; activating the open item MUST close it.

#### Scenario: Toggle
- GIVEN a collapsed item
- WHEN activated by click or keyboard
- THEN `aria-expanded` becomes `true` and the answer is visible

#### Scenario: One open
- GIVEN item A is open
- WHEN item B is opened
- THEN A closes and only B is open

#### Scenario: Close open item
- GIVEN item A is open
- WHEN A is activated
- THEN A closes and none is open

### Requirement: CTA styles
The hero and the final CTA band MUST use the primary `.lp-btn`. The nav, panels and install CTAs MUST use secondary or link styles, so one solid primary appears per view.

#### Scenario: One primary
- GIVEN any viewport position
- WHEN solid primary buttons in view are counted
- THEN at most one exists

### Requirement: Final CTA band and footer
The page MUST end with a CTA band linking to `/tiendas` and `/login`, followed by a footer with the wordmark and links. Footer and band targets MUST be only `/tiendas`, `/login` and same-page anchors (plain `<a href="#id">`). Each non-anchor link MUST resolve via `router.resolve` to a non-catch-all record. There MUST be no legal, social or contact links.

#### Scenario: Band and footer
- GIVEN the page is rendered
- WHEN the end of `main` and the footer are inspected
- THEN the CTA band has both links and every footer link is `/tiendas`, `/login` or an anchor

#### Scenario: Targets resolve
- GIVEN each footer and band route link
- WHEN resolved with `router.resolve`
- THEN none matches the catch-all record and each anchor id exists on the page

#### Scenario: No prohibited links
- GIVEN the footer
- WHEN its links are listed
- THEN none is legal, social, email or phone

### Requirement: Copy integrity
Copy MUST NOT contain prices, delivery times, ratings, statistics, testimonials, partner brands, Yappy or Paguelo Fácil, card payments, "en vivo", "tiempo real" or tracking-live wording, or distance-based shipping claims. Claims MUST be traceable to RF-04, 05, 06, 10, 13, 14, 15, 16, 19, 01 and 02. Shipping copy MUST be exactly "El costo de envío depende de tu zona y lo ves antes de confirmar el pedido." Counts MUST come from the API. Digits are allowed for steps 1-4 and API counts. The scan MUST include `aria-hidden` phone-mock text.

#### Scenario: Prohibited content
- GIVEN the rendered text including `aria-hidden` content
- WHEN scanned for currency, minutes, stars, percentages, brand names, payment, live/real-time and distance terms
- THEN none appear

#### Scenario: Shipping sentence
- GIVEN the shipping claim in the copy
- WHEN compared with the approved text
- THEN it equals the sentence exactly

#### Scenario: Traceability
- GIVEN the copy checklist
- WHEN each claim is reviewed
- THEN each maps to a listed RF, cash on delivery to RF-10 and order status to RF-16

### Requirement: Real-browser verification
Playwright specs in `e2e/` MUST verify in a real browser, with `serviceWorkers: 'block'` and the API mocked via `page.route`: computed heading and key text/background colors match light tokens under OS dark and the dark root class; no horizontal overflow at 360px; landmarks; skip-link focus; and reduced-motion behavior with `reducedMotion: 'reduce'`.

#### Scenario: Cascade
- GIVEN OS dark and the dark root class
- WHEN computed styles of headings and key pairs are read
- THEN they equal the light tokens

#### Scenario: Mobile overflow
- GIVEN a 360px viewport
- WHEN the page loads
- THEN document scroll width does not exceed the viewport width

#### Scenario: Skip link in browser
- GIVEN a fresh load
- WHEN Tab then Enter are pressed
- THEN `document.activeElement` is `main`

#### Scenario: Reduced motion in browser
- GIVEN `reducedMotion: 'reduce'`
- WHEN an anchor is activated
- THEN no smooth scroll or running animation occurs

#### Scenario: Mocked API
- GIVEN the API is mocked or aborted via `page.route`
- WHEN the page loads
- THEN results do not depend on the backend and the fallback renders on abort

## MODIFIED Requirements

### Requirement: Accessibility
Text and interactive-component contrast MUST be at least 4.5:1 in the light theme only, for every pair including new band colors. Interactive elements MUST have a hit area of at least 44x44px and a visible focus ring. Animations MUST be disabled or minimized under `prefers-reduced-motion: reduce`, and anchor navigation MUST NOT scroll smoothly under it. The page MUST use semantic landmarks (`header`, one `nav`, `main`, `footer`) with a single `h1` and ordered headings.
(Previously: contrast was required in both themes; landmarks were header, main, footer only; no single-nav or smooth-scroll rule)

#### Scenario: Contrast
- GIVEN each text/background token pair in the light theme
- WHEN contrast is computed
- THEN every pair is >= 4.5:1 (including the primary button label)
(Previously: each token pair in light and dark)

#### Scenario: Targets and focus
- GIVEN the CTAs and links
- WHEN measured and keyboard-focused
- THEN each is >= 44px tall and wide and shows a visible focus ring

#### Scenario: Reduced motion
- GIVEN `prefers-reduced-motion: reduce`
- WHEN the page renders
- THEN no transition or animation runs
(Previously: also covers activating an anchor link, where scrolling MUST NOT be smooth)

#### Scenario: Landmarks
- GIVEN the rendered page
- WHEN landmarks are queried
- THEN one `header`, one `nav`, one `main` and one `footer` exist and `main` holds the hero and all sections
(Previously: one `header`, one `main` and one `footer`; `main` held the hero and tiles)

## REMOVED Requirements

### Requirement: Bento tiles
(Reason: replaced by the ADDED requirement "Marketplace sections")

### Requirement: Responsive grid
(Reason: replaced by the ADDED requirement "Responsive layout")

### Requirement: Theme tokens
(Reason: replaced by the ADDED requirement "Fixed light theme")

> Correction: the "OpenStreetMap / CARTO" caption requirement above is superseded. CARTO needs an API key (see design.md, Correction); the caption is now "© OpenStreetMap contributors" from `src/utils/mapTiles.ts`.
