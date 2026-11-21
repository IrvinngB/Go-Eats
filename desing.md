# Design System — Friendly Bento
Visual references: Duolingo, Rappi, Uber Eats / DoorDash (tracking), Apple bento grids, Alegra (brand palette), Material 3 tonal surfaces.
Philosophy: **Friendly shape + Tonal color + Modular tiles + Tactile only where it helps**.
Every screen is a set of rounded tiles. Each tile has one job. Warmth comes from big radii, saturated color, round type and a mascot; clarity comes from the grid and from status color.

> Golden rule: if a screen feels crowded, split it into tiles. If it feels cold, add color or a mascot, not more decoration.

Built for a delivery product: mobile first, state driven (order → on the way → delivered), used one-handed and in a hurry. Works for the customer app, the courier app, the business panel and the landing page.

---

## 1. Visual philosophy

### What defines it
- **Bento layout**: content lives in rectangular tiles of different sizes on a strict grid. Size = importance.
- **Friendly shape**: large radii (16–32px), pill buttons, round terminals in type and icons.
- **Tonal color**: each tile has a solid tone from the palette (neutral, tint or brand). No gradients.
- **Tactile where it matters**: primary buttons have a solid "bottom lip"; the active-order tile and overlays get one soft shadow. Nothing else.
- **State first**: order status is always visible, always color + icon + text.
- **Mascot and illustration**: a simple character gives the brand a face (empty states, onboarding, delivered screen).
- **Generous touch targets**: nothing smaller than 44px, primary actions at thumb reach.

### Compared with the previous Flat system
| | Flat | Friendly Bento |
|---|---|---|
| Radius | 4–12px | 12–32px |
| Depth | zero | 3 controlled cases (button lip, active tile, overlays) |
| Layout | rows and cards | bento grid |
| Type | Poppins | Nunito (rounded) |
| Tone | neutral, serious | warm, energetic |
| Motion | no bounce | small, quick "pop" allowed |

### What it is NOT
- Not neumorphism, not glassmorphism: no blur, no translucency.
- Not "everything floats": depth appears in only three places (section 4).
- Not childish: the palette is short, the type is controlled, the mascot is simple.
- Not a dense dashboard: one primary idea per tile.

---

## 2. Color palette

Brand: turquoise (Alegra-like) + deep indigo + one warm accent for energy. Neutrals are slightly tinted toward the brand turquoise.

> Hex values are a proposal inspired by Alegra. Replace `--primary`, `--secondary` and `--accent` with the exact brand values and re-check contrast (section 10).

### Light theme

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FFFFFF` | Page background |
| `--surface` | `#F2F7F7` | Default tile, inputs at rest |
| `--surface-strong` | `#E3EEEE` | Hover, chips, nested elements |
| `--ink` | `#0B2B33` | Primary text |
| `--ink-soft` | `#44585E` | Secondary text |
| `--ink-faint` | `#5E7277` | Metadata, placeholders |
| `--border` | `#D5E0E0` | Inputs, overlays, dividers |
| `--primary` | `#00C2A8` | Main action fill (use with `--on-primary`) |
| `--primary-hover` | `#00AD96` | Primary hover |
| `--primary-lip` | `#008F7D` | Solid bottom edge of primary button |
| `--primary-text` | `#00796B` | Links and primary-colored text on light backgrounds |
| `--primary-tint` | `#D6F5F0` | Brand tile, selection, active nav |
| `--on-primary` | `#0B2B33` | Text on `--primary` (dark, not white) |
| `--secondary` | `#2E2A7A` | Deep indigo: brand tile, hero blocks, map pins |
| `--secondary-tint` | `#E4E3F6` | Secondary tonal tile |
| `--on-secondary` | `#FFFFFF` | Text on `--secondary` |
| `--accent` | `#FFB62E` | Energy: promos, ratings, courier highlights (not for actions) |
| `--accent-tint` | `#FFF1CF` | Accent tile |
| `--success` | `#15803D` | Delivered, confirmed |
| `--success-tint` | `#DDF3E4` | |
| `--warning` | `#B45309` | Delay, preparing (text/icon); fill uses `--accent` |
| `--warning-tint` | `#FDF1D6` | |
| `--danger` | `#DC2626` | Error, cancelled, destructive |
| `--danger-tint` | `#FBE4E4` | |

### Dark theme

| Token | Value |
|---|---|
| `--bg` | `#0A171B` |
| `--surface` | `#12262B` |
| `--surface-strong` | `#1B343A` |
| `--ink` | `#F0F7F7` |
| `--ink-soft` | `#B3C7CB` |
| `--ink-faint` | `#8AA2A7` |
| `--border` | `#264047` |
| `--primary` | `#2DE0C8` |
| `--primary-hover` | `#5BEAD6` |
| `--primary-lip` | `#14A895` |
| `--primary-text` | `#2DE0C8` |
| `--primary-tint` | `#10383B` |
| `--on-primary` | `#062A2F` |
| `--secondary` | `#8E8AF0` |
| `--secondary-tint` | `#24224F` |
| `--on-secondary` | `#0B0A2A` |
| `--accent` | `#FFC85C` |
| `--accent-tint` | `#3A2E10` |

Semantic colors lighten one step (`success #4ADE80`, `warning #FBBF24`, `danger #F87171`); their tints become dark versions at 15% over `--surface`.

### Color rules
- **Neutrals carry ~70%** of the interface; brand tonal tiles carry the rest.
- **One solid primary button per view.** It is the main action (Order, Confirm delivery, Track).
- **Tile tones have meaning**: `--surface` default, `--primary-tint` live or active info, `--secondary` brand or hero, `--accent-tint` promos and rewards, semantic tints for status.
- **`--accent` is never an action color** and never a semantic one; it is for delight and attention.
- **Text on color**: dark `--on-primary` on primary (turquoise fails with white), white on secondary, success and danger; `--ink` on accent and warning fills.
- Semantic colors only with meaning: green = delivered, amber = delay, red = problem.
- Minimum contrast: 4.5:1 normal text, 3:1 large text and UI components.

### Base tokens (CSS)

```css
:root {
  --bg: #FFFFFF;
  --surface: #F2F7F7;
  --surface-strong: #E3EEEE;
  --ink: #0B2B33;
  --ink-soft: #44585E;
  --ink-faint: #5E7277;
  --border: #D5E0E0;

  --primary: #00C2A8;
  --primary-hover: #00AD96;
  --primary-lip: #008F7D;
  --primary-text: #00796B;
  --primary-tint: #D6F5F0;
  --on-primary: #0B2B33;

  --secondary: #2E2A7A;
  --secondary-tint: #E4E3F6;
  --on-secondary: #FFFFFF;

  --accent: #FFB62E;
  --accent-tint: #FFF1CF;

  --success: #15803D;  --success-tint: #DDF3E4;
  --warning: #B45309;  --warning-tint: #FDF1D6;
  --danger:  #DC2626;  --danger-tint:  #FBE4E4;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;   /* bento tiles */
  --radius-2xl: 32px;  /* hero tiles, bottom sheets */
  --radius-full: 999px;

  --space-1: 4px;  --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
  --space-5: 24px; --space-6: 32px;  --space-7: 48px;  --space-8: 64px;

  /* The only two shadows in the system (section 4) */
  --shadow-active: 0 6px 20px rgba(11, 43, 51, 0.10);
  --shadow-overlay: 0 12px 32px rgba(11, 43, 51, 0.16);

  --scrim: rgba(11, 43, 51, 0.5);
}

[data-theme="dark"] {
  --bg: #0A171B;  --surface: #12262B;  --surface-strong: #1B343A;
  --ink: #F0F7F7; --ink-soft: #B3C7CB; --ink-faint: #8AA2A7;
  --border: #264047;
  --primary: #2DE0C8; --primary-hover: #5BEAD6; --primary-lip: #14A895;
  --primary-text: #2DE0C8; --primary-tint: #10383B; --on-primary: #062A2F;
  --secondary: #8E8AF0; --secondary-tint: #24224F; --on-secondary: #0B0A2A;
  --accent: #FFC85C; --accent-tint: #3A2E10;
  --shadow-active: 0 6px 20px rgba(0, 0, 0, 0.35);
  --shadow-overlay: 0 12px 32px rgba(0, 0, 0, 0.5);
  --scrim: rgba(0, 0, 0, 0.6);
}
```

---

## 3. Typography

Rounded geometric for headings, screen-optimized sans for reading, monospace for codes.

- **Nunito**: headings, big numbers, ETA, buttons. Rounded terminals give the friendly tone.
- **Inter**: body, forms, tables, dense UI.
- **JetBrains Mono**: order IDs, tracking codes, PINs, technical values.

Google Fonts: Nunito (700/800), Inter (400/500/600), JetBrains Mono (400/500).

| Class | Family | Size / line-height | Weight | Use |
|---|---|---|---|---|
| `.text-display` | Nunito | 48px / 1.1 | 800 | Landing hero |
| `.text-eta` | Nunito | 40px / 1.0 | 800 | Delivery time in tracking (tabular figures) |
| `.text-h1` | Nunito | 32px / 1.2 | 800 | Page title |
| `.text-h2` | Nunito | 24px / 1.25 | 700 | Section title |
| `.text-h3` | Nunito | 20px / 1.3 | 700 | Tile title |
| `.text-body-lg` | Inter | 18px / 1.6 | 400 | Intro text |
| `.text-body` | Inter | 16px / 1.6 | 400 | Base text |
| `.text-small` | Inter | 14px / 1.5 | 400 | Dense UI, help text |
| `.text-label` | Nunito | 16px / 1.2 | 700 | Buttons |
| `.text-field-label` | Inter | 14px / 1.2 | 500 | Form labels |
| `.text-caption` | Inter | 12px / 1.4 | 400 | Metadata, timestamps |
| `.text-overline` | Inter | 12px / 1.2 | 600 | Uppercase, `letter-spacing: 0.08em` |
| `.text-code` | JetBrains Mono | 14px / 1.5 | 500 | IDs, PIN, tracking code |

**Rules**
- Maximum 2 weights per screen besides regular (Nunito 700/800 counts as headings).
- Headings in `--ink`; secondary in `--ink-soft`; never lighter than `--ink-faint`.
- Numbers that change (ETA, price, distance) use `font-variant-numeric: tabular-nums`.
- Sentence case everywhere. No ALL CAPS except `.text-overline`.
- Left-aligned by default; centered only for heroes, empty states and the delivered screen.
- Body minimum 16px on mobile (inputs 16px to avoid iOS zoom).

---

## 4. Surfaces and depth

Depth comes from **tone first**, with three tightly controlled exceptions.

### Surface levels

| Level | Background | Use |
|---|---|---|
| 0 | `--bg` | Page |
| 1 | `--surface` | Default bento tile, inputs, sidebar |
| 2 | `--surface-strong` | Hover, chips, items inside a tile |
| Brand tile | `--primary-tint`, `--secondary`, `--accent-tint` | Live info, hero, promos |
| Overlay | `--bg` + 1px `--border` + `--shadow-overlay` | Modals, bottom sheets, menus, popovers |

### The only three places with depth
1. **Primary button lip**: a solid 4px bottom edge in `--primary-lip`. No blur. On press it collapses (translateY 2px, lip 2px). This is the "tactile" signature.
2. **Active-order tile**: the one tile the user must not miss (current delivery) uses `--shadow-active`. Only one per screen.
3. **Overlays**: modals, bottom sheets, dropdowns use `--shadow-overlay` plus a flat scrim `--scrim` (no blur).

### What is not used
- `backdrop-filter` or any blur or translucency.
- Gradients as fills (flat color only).
- Shadows on ordinary tiles, chips, inputs or list rows.
- Inner shadows, bevels, neumorphic relief.
- Textures and noise.

---

## 5. Shapes and borders

| Element | Background | Border | Radius |
|---|---|---|---|
| Bento tile (default) | `--surface` | none | `24px` |
| Hero / bottom sheet | `--bg` or brand tone | none / 1px overlay | `32px` |
| Compact tile (list item) | `--surface` | none | `16px` |
| Button | per variant | lip or 2px | `999px` (pill) |
| Input | `--surface` | `2px solid transparent` → `--primary-text` on focus | `16px` |
| Chip / badge | `--surface-strong` or tint | none | `999px` |
| Avatar | `--surface-strong` | none | `999px` |
| Courier photo / map | — | none | `16px` inside tile |
| Modal | `--bg` | `1px solid var(--border)` | `24px` |
| Tooltip | `--ink` with `--bg` text | none | `12px` |

**Rules**
- Radius scale: `8 / 12 / 16 / 24 / 32 / 999`. No in-between values.
- **Concentric rule**: child radius = parent radius − padding (for example a 24px tile with 8px padding holds a 16px image). Never a child with more radius than its parent.
- Tiles are defined by tone, not by border. Borders only on inputs and overlays.

---

## 6. Layout: the bento grid

### Grid
- Base unit 4px. **Tile gap: 12px on mobile, 16px on desktop.**
- Mobile: **2 columns**. Tablet `md`: **4 columns**. Desktop `lg`: **12 columns**.
- Max content width 1200px (panel 1440px; text 720px).
- Breakpoints: `sm 640` · `md 768` · `lg 1024` · `xl 1280`.
- Tile padding: 16px (small), 20px (default), 24px (large).

### Tile sizes (mobile 2-col / desktop 12-col)

| Tile | Mobile | Desktop | Use |
|---|---|---|---|
| `1x1` | 1 col | 3 col | Single stat, shortcut, category |
| `2x1` | 2 col | 6 col | ETA, courier, wide stat |
| `2x2` | 2 col, tall | 6 col, tall | Map, active order |
| `4x1` | full | 12 col | Banner, promo, search |

Rules:
- **Size = importance.** The largest tile is the thing the user came for (map in tracking, cart total in checkout).
- A screen has **one hero tile** and 3–6 supporting tiles. More than 8 tiles: scroll, don't shrink.
- Fill the grid without holes: tiles should add up to complete rows.
- Tones alternate with intent: no more than **two brand-tone tiles** per viewport.

### Page patterns

**Customer tracking (mobile)**
```
┌──────────────────────────────┐
│  ←  Order #A-2041        ⋯   │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │  MAP  (2x2, active)      │ │
│ │  courier pin + route     │ │
│ └──────────────────────────┘ │
│ ┌────────────┐ ┌───────────┐ │
│ │ ETA        │ │ Status    │ │
│ │ 12 min     │ │ On the way│ │
│ └────────────┘ └───────────┘ │
│ ┌──────────────────────────┐ │
│ │ Courier: Ana  ☎  💬      │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Timeline (steps)         │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ Home   Orders   Cart  Profile│
└──────────────────────────────┘
```

**Business / dispatcher panel (desktop)**
```
┌─────────┬──────────────────────────────────────────┐
│ SIDEBAR │ Today                         [New order]│
│ surface │ ┌──────┐┌──────┐┌──────┐┌──────┐        │
│         │ │Active││Late  ││Done  ││Avg   │  KPIs  │
│  • Live │ └──────┘└──────┘└──────┘└──────┘        │
│  • Orders│ ┌────────────────────┐┌──────────────┐ │
│  • Fleet│ │ Live map (6 col)    ││ Order queue  │ │
│  • Money│ │                     ││ (6 col)      │ │
│         │ └────────────────────┘└──────────────┘ │
└─────────┴──────────────────────────────────────────┘
```
- Sidebar 240px, `--surface`, radius 0 on the outer edge. Content `--bg`, 32px padding (16px mobile).
- Tiles on `--bg` use `--surface`; tiles inside a `--surface` panel use `--bg`.

**Landing**
- Hero in a large `--secondary` or `--primary-tint` tile (radius 32px) with `.text-display`, subtitle, one primary CTA, one secondary, and a real photo or mascot illustration.
- Below, a bento of 5–7 tiles: how it works, coverage, speed, tracking, pricing, app download. Mixed sizes.
- Sections with 64–96px vertical padding. Solid color tiles as separators, no gradients.

### Navigation
- **Mobile bottom bar**: 3–5 destinations, 64px tall, `--bg`, 1px top `--border`. Active item: `--primary-tint` pill behind icon + label in `--primary-text`. Labels always visible.
- **Top bar**: 64px, `--bg`, 1px bottom `--border`. Items in `.text-label`: hover `--surface`, active `--primary-tint` + `--primary-text`.
- **Sidebar**: same states, 20px icon on the left, items as 16px-radius pills.
- Primary action of a screen sits at the bottom, in thumb reach (sticky bar), not at the top.

---

## 7. Components

### Buttons

| Variant | Background | Text | Border / lip | Hover |
|---|---|---|---|---|
| Primary | `--primary` | `--on-primary` | `0 4px 0 var(--primary-lip)` (solid lip) | `--primary-hover` |
| Secondary | `--primary-tint` | `--primary-text` | none | `--surface-strong` |
| Outline | transparent | `--primary-text` | `2px solid var(--primary-text)` | `--primary-tint` |
| Ghost | transparent | `--ink` | none | `--surface` |
| Destructive | `--danger` | `#FFFFFF` | `0 4px 0` darker danger | darken 8% |
| Disabled | `--surface-strong` | `--ink-faint` | none | no change |

- Sizes: `sm` 36px · `md` 44px · `lg` 56px tall; pill radius; padding 16 / 24 / 32px.
- `lg` full-width is the default for the main mobile action (sticky bottom).
- **Press**: `transform: translateY(2px)` and lip shrinks to 2px, 80ms. Release returns.
- The lip is a solid `box-shadow` with zero blur, the only shadow allowed on buttons.
- One primary per view.

### Inputs and forms
- `--surface` background, `2px solid transparent`, 16px radius, 52px height on mobile (44px desktop), 0 16px padding.
- Hover: `--surface-strong`. Focus: `2px solid var(--primary-text)` + `--bg`.
- Error: `2px solid var(--danger)`, icon, message in `--danger` below (`.text-caption`).
- Visible label above every field. Placeholders are examples, never labels.
- Address fields: leading pin icon, autocomplete list as an overlay.
- Checkbox / radio / switch: rounded flat shapes; checked state `--primary`; switch is a pill.

### Bento tile (base component)
- `--surface`, radius 24px, padding 20px. No border, no shadow.
- Structure: overline (optional) → `.text-h3` or number → body or visual → action.
- Interactive tile: hover to `--surface-strong`, press `scale(0.98)`, 150ms.
- Variants by tone: `tile--brand` (`--primary-tint`), `tile--indigo` (`--secondary`, text `--on-secondary`), `tile--accent` (`--accent-tint`), `tile--status-*` (semantic tints).
- A tile never has more than one action.

### Chips and badges
- Pill, `4px 12px` padding, `.text-caption` weight 600, optional 16px icon.
- Neutral: `--surface-strong` + `--ink-soft`. Info / active: `--primary-tint` + `--primary-text`.
- Selectable chips (categories, filters): selected = `--primary` fill + `--on-primary`, plus a check icon.

### Status chips (delivery)
Always **icon + text + color**.

| Status | Icon | Background | Text color |
|---|---|---|---|
| Received | `receipt` | `--surface-strong` | `--ink-soft` |
| Preparing | `chef-hat` | `--warning-tint` | `--warning` |
| Courier assigned | `user-check` | `--secondary-tint` | `--secondary` |
| On the way | `bike` | `--primary-tint` | `--primary-text` |
| Arriving | `map-pin` | `--primary` | `--on-primary` |
| Delivered | `check-circle` | `--success-tint` | `--success` |
| Delayed | `clock-alert` | `--warning-tint` | `--warning` |
| Cancelled / failed | `x-circle` | `--danger-tint` | `--danger` |

### Active-order tile (delivery)
- `2x2` or `4x1`, `--bg` with `--shadow-active` (the only tile with depth), radius 24px.
- Contents: status chip, `.text-eta`, a progress bar, courier row, a primary action ("Track" / "Call").
- Progress bar: 8px tall, pill, track `--surface-strong`, fill `--primary`; steps are marked with dots so it does not depend on color.

### Status timeline (delivery)
- Vertical list: 24px circle per step connected by a 2px `--border` line.
- Done: `--primary` circle + check. Current: `--primary-tint` circle with `--primary` ring, and the step text in `--ink`. Pending: `--surface-strong` circle, text `--ink-faint`.
- Each step: title (`.text-small` 600), time (`.text-caption`).

### ETA tile
- `2x1`. `.text-eta` for the minutes, caption "estimated arrival" below, small range ("12–15 min").
- Late: tile switches to `--warning-tint` with a clock icon and updated time. Never silently.

### Courier tile
- Avatar 48px, name (`.text-h3`), vehicle + plate (`.text-code`), rating with `--accent` star, circular call and chat buttons (48px, `--primary-tint`).

### Map tile
- Radius 24px, map clipped inside. Route line 4px `--secondary`; courier pin `--primary` with dark icon; destination pin `--secondary`; store pin `--accent`.
- Map style: flat, desaturated neutrals (no 3D, no gradients). Controls as 44px pill buttons on `--bg`.

### Order summary and price rows
- Lines in `.text-body`, prices right aligned with tabular figures, total in `.text-h3`.
- Sticky checkout bar at the bottom: total on the left, large primary button on the right.

### Delivery confirmation (PIN)
- Code shown in `.text-code` at 32px inside a `--primary-tint` tile, letter-spaced, with a "Copy" ghost button. Courier side: 4 large OTP inputs (56×64px, 16px radius).

### Alerts and banners
- `*-tint` background, 16px radius, 16px padding, 20px icon in base color, text in `--ink`.
- Persistent alerts: 4px side bar in base color.

### Tables (business panel)
- No vertical borders. Header `.text-overline` in `--ink-faint` on `--surface` (top radius 16px).
- Rows 1px `--border`; hover `--surface`; selected `--primary-tint`. Cell padding 12px 16px; numbers right-aligned.
- On mobile, tables become lists of compact tiles.

### Modals and bottom sheets
- Scrim `--scrim`, no blur. Container `--bg`, 1px `--border`, `--shadow-overlay`.
- Modal: radius 24px, width 480 / 640px, padding 24px, actions bottom-right (secondary left of primary).
- **Bottom sheet (mobile)**: top radius 32px, 4×36px grab handle in `--border`, max height 90vh.

### Empty states
- Mascot or illustration (see section 8) in a `--primary-tint` or `--accent-tint` circle or tile, `.text-h3` title, one line of help, one primary button.

### Toasts
- `--ink` background, `--bg` text, 16px radius, bottom-center above the nav bar. 4–6s; errors stay until dismissed. Include an icon.

---

## 8. Iconography, illustration and imagery

### Icons
- One style: **Lucide, stroke, 2px weight, rounded caps and joins**. Sizes 16 / 20 / 24 / 32px. Inherit `currentColor`.
- Key tiles use a **48px icon inside a 56px circle** in `--primary-tint` or `--accent-tint`.
- Standalone icons need `aria-label` and a tooltip on desktop.

### Mascot and illustration
- A simple character (courier, parcel or bike mascot) with basic shapes, round proportions and a minimal face.
- Maximum 4–5 flat colors from the palette (`--primary`, `--secondary`, `--accent`, neutrals). No gradients, no shadows.
- Used in: onboarding, empty states, delivered screen, error pages, landing hero.
- **Production note:** use real illustrations or photos made by a designer or an image generator, not hand-coded SVG scenes. Image brief for each piece:
  - Format: PNG/WebP with transparent background (illustrations), 1:1 or 4:3.
  - Style: flat vector, rounded shapes, uniform line weight, 4–5 colors max.
  - Palette: `#00C2A8`, `#2E2A7A`, `#FFB62E`, `#0B2B33`, `#F2F7F7`.
  - Scenes: courier on bike (hero), parcel delivered with a check (delivered), empty cart, no orders yet, lost route / error, courier waiting at a door.

### Photography
- Real product and city photos, clean crops, radius coherent with the tile (concentric rule). No filters or frames.
- To tie a photo to the brand, use a flat solid-color overlay at fixed opacity, never a gradient.

### Data and charts
- Solid series: `--primary`, `--secondary`, `--accent`, neutrals for background series.
- Bars with 8px top radius; lines 3px with round caps; no gradient fills under curves.
- Grid in `--border`, labels `--ink-faint`. Don't encode information by color alone: add labels or shapes.
- KPI tile: big number (`.text-h1`), delta chip (up = `--success-tint`, down = `--danger-tint`, with arrow icon), optional sparkline.

---

## 9. Motion

Quick, springy-but-small, always tied to a state change. It should feel alive, not noisy.

| Animation | Duration | Easing | Use |
|---|---|---|---|
| Hover (color) | 150ms | ease-out | Buttons, tiles, items |
| Press | 80ms | ease-out | Button lip collapse; tile `scale(0.98)` |
| Pop | 220ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Chips selected, check marks, success badge, one-time only |
| Tile enter | 240ms | ease-out | `opacity` + `translateY(12px)→0`, 40ms stagger, max 6 tiles |
| Sheet / modal | 260ms | ease-out | Slide up (sheet) / fade + `translateY(8px)` (modal) |
| Progress / ETA update | 400ms | ease-in-out | Smooth bar movement and number change |
| Courier pin on map | 1000ms | linear | Interpolate between GPS updates |
| Skeleton | 1.2s | ease-in-out, infinite | Pulse `--surface` ↔ `--surface-strong` |
| Spinner | 0.8s | linear, infinite | Rotating arc |

**No** parallax, looping decorative animations, confetti on every action. A single confetti burst is allowed on "Delivered" only.

`@media (prefers-reduced-motion: reduce)`: remove movement and pop, keep instant color changes; the map pin may jump instead of glide.

---

## 10. Accessibility

- **Contrast**: 4.5:1 normal text, 3:1 large text and UI components. Turquoise `--primary` takes dark text (`--on-primary`); turquoise as text on white uses `--primary-text`. Re-check any new brand hex.
- **Focus**: `outline: 2px solid var(--primary-text); outline-offset: 2px;` on every interactive element. Never `outline: none` without replacement.
- **Not color alone**: status always icon + text; selected = check + fill; errors = icon + message.
- **Touch targets** at least 44×44px; 56px for the main action; 8px minimum gap between targets (the courier is often on the move).
- **One-handed use**: key actions in the bottom half of the screen.
- **Keyboard**: Tab, Enter, Space, Escape; logical focus order; sheets trap focus.
- **Semantics**: `button`, `nav`, `main`, `label`; tracking updates announced with `aria-live="polite"`.
- **Scalable text**: sizes in `rem`; layout tolerates 200% zoom (tiles reflow to one column).
- **Outdoor use**: couriers use the app in sunlight; keep ink/background contrast above 7:1 on courier screens.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.

---

## 11. Anti-patterns

| Don't | Do |
|---|---|
| Shadows on every card | Tone for tiles; shadow only on active order and overlays |
| Blur, glass, gradients | Flat solid tones and a flat scrim |
| White text on turquoise | `--on-primary` dark text, or `--primary-text` on light |
| Tiny radii on tiles (4–8px) | 24px tiles, concentric children |
| Child radius bigger than parent | Parent radius minus padding |
| Tile holes and ragged rows | Tiles that fill complete rows |
| 10 tiles of equal weight | One hero tile, size = importance |
| More than one primary button | One primary + outline/ghost |
| Status shown by color only | Color + icon + text |
| `--accent` as an action color | Accent only for delight, promos, ratings |
| Hand-coded SVG mascot scenes | Real illustration made with an image brief |
| Mixed icon styles | Lucide stroke 2px only |
| Arbitrary radii (10px, 14px, 20px) | `8 / 12 / 16 / 24 / 32 / 999` |
| Primary action at the top of mobile | Sticky bottom bar in thumb reach |
| Confetti and bounce everywhere | Pop on selection, confetti only on delivered |

---

## 12. Status

- ✅ Philosophy and principles (Friendly Rounded + Bento)
- ✅ Light + dark palette with CSS tokens (Alegra-inspired, hex to confirm)
- ✅ Typography (Nunito + Inter + JetBrains Mono)
- ✅ Surfaces, controlled depth and shadow tokens
- ✅ Radius scale, concentric rule and bento grid
- ✅ Base and delivery components (order tile, timeline, ETA, courier, map, PIN, status chips)
- ✅ Iconography, illustration brief and data
- ✅ Motion and accessibility
- ⏳ Exact brand hex values and contrast re-check
- ⏳ Mascot design and illustration set
- ⏳ Implemented components (Vue / React / Blade)
- ⏳ Tokens exported to Tailwind / CSS variables / JSON
- ⏳ Map style (flat, brand colors)
- ⏳ Courier app: detailed one-handed and sunlight version