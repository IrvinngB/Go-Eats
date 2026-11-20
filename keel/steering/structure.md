# Structure
Last refreshed: 2026-11-20

## Tree
```
/                     frontend at repo root + infra
  src/
    views/<role>/     one view per role (customer, merchant, courier, accountant, admin); LoginView.vue at views/
    components/       shared UI (TopBar, StatusBadge, CommerceIcon, CoverageMap, PwaStatus)
    stores/           Pinia (useGoEatsStore.js)
    services/api.ts   axios client
    utils/            helpers (geo.js)
    router.ts, main.ts, App.vue, mockData.js, style.css
  public/             PWA icons, icon.svg
  backend/
    app/main.py       entry `app.main:app`, mounts routers at /api/v1, /health
    app/core/         config, database, rbac, security
    app/domains/<d>/  auth users merchants zones catalog orders delivery payments reports
    app/shared/       audit, geo, push, storage
    app/seed.py, reseed.py, init_db.py
    alembic/          env.py only (no versions yet)
  keel/               SDD workspace (config, specs, changes, steering)
  Dockerfile, Caddyfile, docker-compose.yml, vite.config.ts, tailwind.config.js
  arquitectura_tech_stack_y_rf_go_eats.md  (spec, Spanish)   desing.md (design system)
```

## Backend conventions
- Each domain: `router.py` (HTTP) > `service.py` (rules) > `repository.py` (SQLAlchemy) > `models.py`; `schemas.py` uses `XxxCreate/XxxRead/XxxUpdate`. Not every domain has all files (auth has no models/repository; reports has no models; payments adds `providers.py`).
- New business code goes in the owning domain; cross-cutting code in `core/` or `shared/`. No service-to-service imports across domains.
- New domain router must be added to the list in `app/main.py`.
- Tests (to be created): `backend/tests/` mirroring domains, pytest.

## Frontend conventions
- New role screens: `src/views/<role>/XxxView.vue` (PascalCase + `View`), lazy-loaded route in `router.ts`; routes are Spanish kebab-case (`/panel-comercio`).
- Reusable UI: `src/components/`; HTTP only via `src/services/api.ts`; state in Pinia. New code should be TypeScript (`.ts`, `<script setup lang="ts">`); do not grow `mockData.js`.
- Tests (to be created): vitest, colocated `*.spec.ts` or `src/__tests__/` (decide in first change).
- API/DB identifiers in English snake_case; domain state values snake_case Spanish (`en_preparacion`); UI copy Spanish.

## UI design system (from `desing.md`, "Friendly Bento")
- Mobile first, rounded tiles on a bento grid; radii 12-32px (tiles 24px); no gradients, blur or glass; depth only for the primary button lip, active-order tile, overlays.
- Type: Nunito (headings/buttons), Inter (body/forms), JetBrains Mono (IDs/codes). Icons: Lucide, stroke 2px, 16/20/24/32.
- Tokens as CSS variables (`--primary`, `--secondary`, `--accent`, semantic tints, light + dark themes); one solid primary button per view; order status always color + icon + text; touch targets >= 44px; contrast 4.5:1.
- Landing page guidance exists in `desing.md` (section "Landing"); mascot for empty/delivered states.
- Primary color value unresolved (`#00C2A8` design vs `#00B19D` spec): see `steering/tech` gap 9.
