# Landing Page Specification

## Purpose
Give visitors a public entry point at `/` that explains Go Eats and routes them to login or the store catalog, in the "Friendly Bento" style.

## Requirements

### Requirement: Public root route
The system MUST render the landing page at `/` without authentication and MUST NOT redirect `/` to `/tiendas`.

#### Scenario: Anonymous visit
- GIVEN a visitor with no session
- WHEN they navigate to `/`
- THEN the landing page is shown and the URL remains `/`

#### Scenario: Existing routes unaffected
- GIVEN the landing route exists
- WHEN a visitor navigates to `/tiendas` or `/login`
- THEN those views render as before

### Requirement: Hero tile
The page MUST show a hero tile with a display-size heading, a subtitle, exactly one primary CTA, one secondary CTA, and an image slot with alt text.

#### Scenario: Hero content
- GIVEN the landing page is rendered
- WHEN the hero is inspected
- THEN it contains one `h1`, a subtitle, one primary CTA, one secondary CTA and an image slot with non-empty alt text (or marked decorative)

### Requirement: Call-to-action routing
The primary CTA MUST navigate to `/tiendas`; the secondary CTA MUST navigate to `/login`.

#### Scenario: Primary CTA
- GIVEN the landing page is rendered
- WHEN the visitor activates the primary CTA
- THEN the router navigates to `/tiendas`

#### Scenario: Secondary CTA
- GIVEN the landing page is rendered
- WHEN the visitor activates the secondary CTA
- THEN the router navigates to `/login`

### Requirement: Bento tiles
Below the hero the page MUST show exactly six tiles: how it works, coverage, speed, tracking, pricing, and app download. Each tile MUST have a heading, short text and a Lucide icon.

#### Scenario: Six tiles present
- GIVEN the landing page is rendered
- WHEN tiles are counted
- THEN exactly six exist, each with a heading, text and icon, covering the six topics

#### Scenario: Decorative icons
- GIVEN a tile icon accompanies visible text
- WHEN assistive technology reads the tile
- THEN the icon is hidden from it

### Requirement: Responsive grid
The layout MUST be mobile-first and use 2 columns on mobile, 4 on tablet and 12 on desktop, with no horizontal scroll.

#### Scenario: Mobile
- GIVEN a 360px-wide viewport
- WHEN the page renders
- THEN tiles use a 2-column grid and the page has no horizontal overflow

#### Scenario: Tablet and desktop
- GIVEN tablet and desktop viewports
- WHEN the page renders
- THEN the grid uses 4 and 12 columns respectively

### Requirement: Theme tokens
Colors MUST come from CSS variable tokens defined for light and dark themes. The dark theme MUST apply when the OS prefers dark or when the dark class is set.

#### Scenario: Dark preference
- GIVEN the OS prefers dark
- WHEN the page renders
- THEN dark token values apply

#### Scenario: Class override
- GIVEN the dark class is set on the root
- WHEN the page renders
- THEN dark token values apply regardless of OS preference

### Requirement: Flat visual style
The page MUST NOT use gradients, blur or glass effects.

#### Scenario: No prohibited effects
- GIVEN the landing styles
- WHEN they are scanned
- THEN no gradient, `backdrop-filter` or blur declarations are present

### Requirement: Accessibility
Text and interactive-component contrast MUST be at least 4.5:1 in both themes. Interactive elements MUST have a hit area of at least 44x44px and a visible focus ring. Animations MUST be disabled or minimized under `prefers-reduced-motion: reduce`. The page MUST use semantic landmarks (`header`, `main`, `footer`) with a single `h1` and ordered headings.

#### Scenario: Contrast
- GIVEN each text/background token pair in light and dark
- WHEN contrast is computed
- THEN every pair is >= 4.5:1 (including the primary button label)

#### Scenario: Targets and focus
- GIVEN the CTAs and links
- WHEN measured and keyboard-focused
- THEN each is >= 44px tall and wide and shows a visible focus ring

#### Scenario: Reduced motion
- GIVEN `prefers-reduced-motion: reduce`
- WHEN the page renders
- THEN no transition or animation runs

#### Scenario: Landmarks
- GIVEN the rendered page
- WHEN landmarks are queried
- THEN one `header`, one `main` and one `footer` exist and `main` holds the hero and tiles

### Requirement: Spanish copy
All visible text MUST be in Spanish.

#### Scenario: Language
- GIVEN the rendered page
- WHEN visible text and alt text are reviewed
- THEN all are Spanish and the root document language is `es`
