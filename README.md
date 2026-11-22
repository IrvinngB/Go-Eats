# Go Eats — Multi-Merchant Delivery Platform (PWA + Modular Monolith API)

Full-stack delivery platform for **Comercios Unidos del Istmo, S.A.** built as an installable Vue 3 Progressive Web App (PWA) backed by a 9-domain FastAPI modular monolith, engineered and verified with **Keel Spec-Driven Development (SDD)** and **Strict TDD**.

## Quick path

1. **Start the full stack (PWA + FastAPI + PostgreSQL 16 + MinIO)**:
   ```bash
   docker compose up -d --build
   ```
2. **Verify services**:
   - Frontend PWA (Caddy): `http://localhost:5173`
   - FastAPI OpenAPI Docs: `http://localhost:8000/docs`
   - MinIO Console: `http://localhost:9001`
3. **Sign in** with any seeded role account (all use password `demo1234`):
   - **Customer**: `carlos@ejemplo.pa`
   - **Merchant**: `hector.endara@ejemplo.pa` (Restaurante Diablicos) / `patricia.motta@ejemplo.pa` (Verde Bistro)
   - **Courier**: `javier.morales@ejemplo.pa` / `maria.cedeno@ejemplo.pa`
   - **Accountant**: `contabilidad@goeats.pa`
   - **Administrator**: `admin@goeats.pa`

> For the complete **RF-01 to RF-20 QA Traceability Matrix** and role-by-role verification checklist, see [**docs/rf-compliance-report.md**](./docs/rf-compliance-report.md).

---

## Spec-Driven Development (SDD) with Keel — QA Review Guide

This repository uses **Keel** (`keel/`, git-tracked `files` artifact store) to govern architecture, specifications, security reviews, and work-unit execution. Every feature and role enhancement followed a structured SDD lifecycle before merging to `develop` and `main`.

### 1. Keel Workspace Structure

| Path | Purpose |
|------|---------|
| [`keel/config.yaml`](./keel/config.yaml) | SDD schema (`spec-driven`), stack definition, verified test/build commands, `strict_tdd: true`, and `security_review: true`. |
| [`keel/steering/`](./keel/steering/) | Living project context: [`product.md`](./keel/steering/product.md) (domain & RFs), [`structure.md`](./keel/steering/structure.md) (conventions & design system), and [`tech.md`](./keel/steering/tech.md) (architectural decisions). |
| [`keel/specs/`](./keel/specs/) | Canonical RFC-2119 specifications (`MUST` / `SHALL` + `GIVEN / WHEN / THEN` scenarios) consolidated from completed changes. |
| [`keel/changes/archive/`](./keel/changes/archive/) | Immutable audit trail of every completed SDD change (`exploration.md`, `proposal.md`, `clarifications.md`, `design.md`, `blast-radius.md`, `tasks.md`, `apply-progress.md`, `state.yaml`). |

### 2. SDD Workflow & Quality Gates Applied

1. **Exploration & Blast Radius (`explore` -> `blast-radius`)**: Audited existing endpoints, frontend views, and cross-role dependencies (`file:line` evidence) to prevent regressions across shared modules (`useGoEatsStore.js`, `router.ts`, startup migrations).
2. **Specification & Clarification (`proposal` -> `spec` -> `clarify` -> `design`)**: Defined explicit capabilities, security boundaries (JWT role enforcement, entity ownership via `owner_user_id` / `user_id`, Ley 81 consent gates, zero card-data leakage), and PR slicing plans.
3. **Strict TDD Application (`tasks` -> `apply`)**: Every task recorded its `RED -> GREEN -> TRIANGULATE -> REFACTOR` cycle in `apply-progress.md`, verified across:
   - **Backend (`pytest`)**: 416 API, RBAC, ownership, pricing, payment, and idempotent migration tests (`backend/tests/`).
   - **Frontend (`Vitest`)**: 50 unit, store, component, and build-gating test suites (`src/**/*.spec.ts`, `tests/build/`).
   - **End-to-End (`Playwright`)**: 33 real-browser Chromium tests against the production build (`e2e/`).
4. **Archival & Spec Consolidation (`archive`)**: Once merged, each change was moved to `keel/changes/archive/YYYY-MM-DD-<change-name>/` and its delta merged into `keel/specs/`.

### 3. Archived SDD Changes & Canonical Specs

| Archived Change | Scope & RFs Covered | Canonical Specs Updated |
|-----------------|---------------------|-------------------------|
| [`2026-11-20-add-landing-page`](./keel/changes/archive/2026-11-20-add-landing-page/) | Public landing page at `/` & frontend Vitest harness | [`landing-page`](./keel/specs/landing-page/spec.md), [`frontend-testing`](./keel/specs/frontend-testing/spec.md) |
| [`2026-11-21-redesign-landing-page`](./keel/changes/archive/2026-11-21-redesign-landing-page/) | Classic marketplace landing redesign, live API stores/zones, Playwright E2E | [`landing-page`](./keel/specs/landing-page/spec.md) |
| [`2026-11-21-improve-customer-role`](./keel/changes/archive/2026-11-21-improve-customer-role/) | Pytest harness, RBAC & ownership locks, route guards, server-side pricing (`RF-14/15`), payments (`RF-10`), Ley 81 consent & ARCO (`RF-07/09`), canonical snake_case states (`RF-16/20`) | [`backend-testing`](./keel/specs/backend-testing/spec.md), [`customer-authorization`](./keel/specs/customer-authorization/spec.md), [`customer-consent-arco`](./keel/specs/customer-consent-arco/spec.md), [`customer-orders-pricing`](./keel/specs/customer-orders-pricing/spec.md), [`customer-payments`](./keel/specs/customer-payments/spec.md), [`order-status-normalization`](./keel/specs/order-status-normalization/spec.md), [`session-and-route-guards`](./keel/specs/session-and-route-guards/spec.md) |
| [`2026-11-21-improve-customer-checkout`](./keel/changes/archive/2026-11-21-improve-customer-checkout/) | Profile & checkout map delivery address (`RF-09/14`), 3-D Secure simulated payment gateway (`RF-10`), customer catalog search/filters/promos (`RF-04/05/06`) | [`customer-orders-pricing`](./keel/specs/customer-orders-pricing/spec.md), [`customer-payments`](./keel/specs/customer-payments/spec.md) |
| [`2026-11-21-improve-merchant-role`](./keel/changes/archive/2026-11-21-improve-merchant-role/) | Schedule & catalog ownership authz, promo validation, product delete, 1-click store open/close, courier assignment state guard (`RF-01`, `RF-13`, `RF-16`) | [`merchant-catalog-management`](./keel/specs/merchant-catalog-management/spec.md) |
| [`2026-11-21-improve-courier-role`](./keel/changes/archive/2026-11-21-improve-courier-role/) | Availability ownership & active-affiliation guard, tri-state operational badge (`En línea`, `Ocupado`, `Desconectado`), full package items & GPS view (`RF-02`, `RF-16`, `RF-19`) | [`courier-delivery-management`](./keel/specs/courier-delivery-management/spec.md) |
| [`2026-11-21-improve-admin-role`](./keel/changes/archive/2026-11-21-improve-admin-role/) | Live `/reports/kpis` dashboard, user account activation/suspension (`PATCH /users/{id}/status`), merchant & courier affiliation governance (`RF-17`, `RF-18`, `RF-09`) | [`admin-platform-governance`](./keel/specs/admin-platform-governance/spec.md) |
| [`2026-11-22-improve-accountant-role`](./keel/changes/archive/2026-11-22-improve-accountant-role/) | Financial KPIs, strict payment status validation, transaction search & reconciliation (`Conciliar` / `Fallido`), digital receipt & PDF download (`RF-11`, `RF-12`) | [`accountant-financial-reconciliation`](./keel/specs/accountant-financial-reconciliation/spec.md) |

---

## Development & Demo Flags

### Demo account switcher (build-time flag, local only)

The TopBar account switcher is gated by `VITE_ENABLE_DEMO_SWITCHER` (only the exact string `true` enables it; default OFF):

- `docker compose up` / `docker compose build` also load `docker-compose.override.yml`, which builds the web image with the switcher ON (local demo).
- `docker compose -f docker-compose.yml up --build` does NOT load the override: the switcher stays OFF (production / CI default).
- `pnpm dev`: put `VITE_ENABLE_DEMO_SWITCHER=true` in `.env.development` (or `.env.development.local`); `pnpm build` never reads development env files (OFF).

### Demo catalog generator (opt-in, demo only)

The base seed creates 16 merchants. To populate 150 additional fictional merchants (`DM-001`..) across active zones with varied categories, promo prices, and open/closed states:

```bash
# local
cd backend && .venv/bin/python -m app.seed_demo_catalog --yes
# docker
docker compose exec api python -m app.seed_demo_catalog --yes
```

---

## Details

| Area | Decision |
|------|----------|
| **Frontend PWA** | Vue 3 (`<script setup>`), Vite, `vite-plugin-pwa` (Workbox Service Worker + `manifest.webmanifest`), Pinia, Vue Router 4, Tailwind CSS, Leaflet + OpenStreetMap, `@lucide/vue` icons, and Axios JWT/refresh interceptors. |
| **Backend Architecture** | FastAPI modular monolith strictly layered (`Router -> Service -> Repository -> Model`) across 9 isolated domains: `auth`, `users`, `zones`, `merchants`, `catalog`, `delivery`, `orders`, `payments`, and `reports`. |
| **Data & Compliance** | 3NF relational schema in SQLAlchemy 2.x + idempotent startup migrations (`app/core/migrations.py`), historical price/address/coordinate snapshots on orders, append-only audit tables, and Panama Ley 81 consent + ARCO workflows. |

## Checklist

- [x] Package manager migrated to `pnpm` (`pnpm-lock.yaml`).
- [x] Installable PWA generated with Service Worker (`sw.js`) and PNG/SVG icons.
- [x] 9 FastAPI domains with zero cross-domain service imports.
- [x] Full coverage of `RF-01` through `RF-20` documented in [`docs/rf-compliance-report.md`](./docs/rf-compliance-report.md).
- [x] All SDD changes archived in [`keel/changes/archive/`](./keel/changes/archive/) and consolidated in [`keel/specs/`](./keel/specs/).

## Next step

Review [`docs/rf-compliance-report.md`](./docs/rf-compliance-report.md) for the QA test plan and [`arquitectura_tech_stack_y_rf_go_eats.md`](./arquitectura_tech_stack_y_rf_go_eats.md) for the architectural specification.
