# Go Eats — Multi-Merchant Delivery Platform (PWA + Modular Monolith API)

Full-stack delivery platform for **Comercios Unidos del Istmo, S.A.** built as an installable Vue 3 Progressive Web App (PWA) backed by a 9-domain FastAPI modular monolith.

## Quick path

1. **Start the full stack (PWA + FastAPI + PostgreSQL 16 + MinIO)**:
   ```bash
   docker compose up -d --build
   ```
2. **Verify**:
   - Frontend PWA (Caddy): `http://localhost:5173`
   - FastAPI OpenAPI Docs: `http://localhost:8000/docs`
   - MinIO Console: `http://localhost:9001`
3. **Sign in** with any seeded user (password `demo1234`), e.g. `carlos@ejemplo.pa` (customer) or `admin@goeats.pa` (admin).

> Frontend-only hot reload while developing: `pnpm install && pnpm dev` (Vite proxies `/api/v1` to `localhost:8000`).

### Demo account switcher (build-time flag, local only)

The TopBar account switcher is gated by `VITE_ENABLE_DEMO_SWITCHER` (only the exact string `true` enables it; default OFF):

- `docker compose up` / `docker compose build` also load `docker-compose.override.yml`, which builds the web image with the switcher ON (local demo).
- `docker compose -f docker-compose.yml up --build` does NOT load the override: the switcher stays OFF (production / CI default).
- `pnpm dev`: put `VITE_ENABLE_DEMO_SWITCHER=true` in `.env.development` (or `.env.development.local`); `pnpm build` never reads development env files (OFF).

The flag is baked into the bundle at build time, so changing it requires rebuilding the web image.

### Demo catalog (opt-in, demo only)

The base seed creates 16 merchants, which looks empty next to real coverage. To fill the catalog with fictional demo data:

```bash
# local
cd backend && .venv/bin/python -m app.seed_demo_catalog --yes
# docker
docker compose exec api python -m app.seed_demo_catalog --yes
```

- Creates 150 fictional merchants (`DM-001`..) spread over the active zones (about 15 per zone) with about 10 products each (`DP-001-01`..): varied categories, open/closed and `en_revision` states, promo prices and sold-out items. Names are invented word-list combinations, not real businesses.
- Options: `--merchants N`, `--products-per-merchant M`, `--seed S` (default 2026), `--dry-run` (writes nothing). It prints the target database (password masked) and refuses to write without `--yes`.
- Idempotent and deterministic: re-running creates nothing new; a larger `--merchants` only adds the missing ones. It never modifies or deletes existing rows and never touches users, orders, payments or consent. Generated merchants have no owner account.
- Never runs automatically (not wired into startup, `init_db` or reseed). Demo and local use only: do not run it in production.
- The frontend loads all merchants and products in one request each, so keep the volume moderate (150 merchants is about 54 KB and 308 KB of JSON).

## Details

| Area | Decision |
|------|----------|
| **Frontend PWA** | Vue 3 (`<script setup>`), Vite, `vite-plugin-pwa` (Workbox Service Worker + `manifest.webmanifest`), Pinia, Vue Router 4, Tailwind CSS, `@lucide/vue` icons, and Axios JWT/refresh interceptors. |
| **Backend Architecture** | FastAPI modular monolith strictly layered (`Router -> Service -> Repository -> Model`) across 9 isolated domains: `auth`, `users`, `zones`, `merchants`, `catalog`, `delivery`, `orders`, `payments`, and `reports`. |
| **Data & Compliance** | 3NF relational schema in SQLAlchemy 2.x + Alembic, historical price/address snapshots on orders, append-only audit tables, and Panama Ley 81 consent + ARCO workflows. |
| **Offline Resilience** | Pinia store synchronizes with `/api/v1/*` when the backend is reachable and falls back seamlessly to local state and client-side PDF generation when offline. |

## Checklist

- [x] Package manager migrated to `pnpm` (`pnpm-lock.yaml`).
- [x] All UI emojis replaced with SVG icons via `@lucide/vue`.
- [x] Installable PWA generated with Service Worker (`sw.js`) and PNG/SVG icons.
- [x] 9 FastAPI domains with zero cross-domain service imports.
- [x] Full coverage of `RF-01` through `RF-20`.

## Next step

See [arquitectura_tech_stack_y_rf_go_eats.md](./arquitectura_tech_stack_y_rf_go_eats.md) for the complete functional requirements catalog and architectural specification.
