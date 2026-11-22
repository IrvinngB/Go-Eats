## Exploration: improve-merchant-role (merchant audit)

Revision 2 (2026-11-21). Revision 1 (2026-11-20) was written before improve-customer-role, improve-customer-checkout, the customer Friendly Bento redesign and the demo catalog generator landed. Static reading only (`file:line`); no code changed.

### What is now STALE from revision 1
- "Base dependency: assumes improve-customer-role lands owner_user_id, GET /merchants/mine, canonical states, pytest" -> LANDED (archived; specs in `keel/specs/customer-authorization`, `order-status-normalization`; harness `backend/tests/`, `cd backend && .venv/bin/pytest -q`).
- Gap 6 "optimistic UI shows success regardless of API failure" -> FIXED. All merchant writes go through `escribir` (`src/stores/useGoEatsStore.js:185-201`, snapshot rollback + persistent error toast); view awaits `r.ok` (`src/views/merchant/MerchantView.vue:28,41-45,60-63,67-70`).
- RF-16 "UI fires without awaiting/showing errors" -> FIXED (same reason).
- Line numbers of revision 1 for `MerchantView.vue` and `orders/service.py` are outdated.

### Current State
- Panel: `src/views/merchant/MerchantView.vue` (292 lines), route `/panel-comercio` (`src/router.ts:12`, guards `src/guards.ts:9,21`). Binds to `store.comercioPropio` (`GET /merchants/mine`, `useGoEatsStore.js:308,411-412`). Unlinked -> empty state "Cuenta sin comercio asignado" (`MerchantView.vue:76-79`), tested (`MerchantView.spec.ts:31-41`).
- Look: still old global classes (`.card`, `.btn-primary`, `.input`, `.th/.td`) under the shared TopBar; tabs + tables; no sidebar, KPIs, map, or `.cx` tokens.
- Data: real API after login (`sincronizarConBackend`, `useGoEatsStore.js:298-420`); initial state is mockData (`useGoEatsStore.js:17,120-128`) until sync. Sync runs only on app mount/login (`src/App.vue:24`, `useGoEatsStore.js:260`). No polling anywhere (only `setInterval` is a map animation, `CoverageMap.vue:385`).
- Orders backend: role scope, `ROLE_TARGETS`, `VALID_TRANSITIONS`, `REASON_REQUIRED` enforced (`backend/app/domains/orders/service.py:25-46,182-229`), well tested (`backend/tests/test_status.py`, `test_orders_scope.py`).

### RF coverage
| RF | Status | Frontend | Backend | Tests |
|---|---|---|---|---|
| RF-01 assign ready orders to available couriers | partial | picker only at `listo_para_recoger` (`MerchantView.vue:139-154`); list = `repartidoresDisponibles` from login-time sync, never refreshed (`store:142`) | `assign_courier` checks scope + courier available/activo but NOT order status, allows reassignment, does not mark courier busy (`orders/service.py:231-246`, `orders/repository.py:140-143`) | pytest scope/400 (`test_status.py:247-278`, all assign in `confirmado`); vitest picker render |
| RF-13 catalog (products, categories, prices, promos, schedules, availability) | partial + INSECURE | name/price/description/available toggle, opens/closes (`MerchantView.vue:20,193-274`); no category, promo, is_open, delete | no ownership on schedule/products (below); `promo_price` unvalidated; `category` free text | none (pytest or vitest) |
| RF-16 status + push + mandatory reason | partial | confirm/prepare/ready/reject with reason modal (`MerchantView.vue:129-162,276-289`) | done server-side; push is a log-only stub (`backend/app/shared/push.py:7-9`) and only targets the customer; merchant never notified of new orders | pytest matrix; vitest buttons/reject |
| RF-08 login/RBAC (merchant part) | done | guards + redirect to panel (`guards.spec.ts`) | `require_roles` on writes, `/merchants/mine` 401/403/404 tested (`test_linked_entity_and_locks.py:21-49`) | yes |
| RF-18 (merchant view while `en_revision`) | missing | panel never shows `estadoAfiliacion`; an en_revision merchant sees a normal panel with "Tienda cerrada" (`MerchantView.vue:86-90`) | writes (schedule, products, `is_open=true`) not gated by affiliation (`merchants/service.py:29-43`); order creation is gated (`orders/service.py:136`) | none |

### Re-verified findings
| Check | Result | Evidence |
|---|---|---|
| PUT `/merchants/{code}/schedule` ownership | STILL OPEN: any merchant can edit any merchant (incl. `is_open`); customer 403, anon 401 | `merchants/router.py:36-43`, `merchants/service.py:29-43` |
| POST `/catalog/merchants/{code}/products` | STILL OPEN for any merchant; also no check the merchant exists (orphan products) | `catalog/router.py:28-35`, `catalog/repository.py:34-50` |
| PUT `/catalog/products/{id}` | STILL OPEN for any merchant; customer 403, anon 401 | `catalog/router.py:38-45`, `catalog/service.py:38-47` |
| assign_courier requires `listo_para_recoger` | NO. Note: existing tests assign in `confirmado` (`test_status.py:248-275`) and no spec fixes the allowed states -> needs a decision | `orders/service.py:231-239` |
| is_open toggle | backend supports it (`MerchantScheduleUpdate.is_open`, `merchants/schemas.py:19`); UI has none and never sends it (`store:649`) | `MerchantView.vue:86-90` |
| Misleading copy | "Fuera de este horario la tienda aparece cerrada" but hours are not evaluated | `MerchantView.vue:260` vs `orders/service.py:135` |
| Product delete/archive | missing (no DELETE route) | `catalog/router.py` |
| promo_price < price | not validated; `ProductUpdate.promo_price` has no bound (negative accepted) | `catalog/schemas.py:9,18` |
| NEW bug: edit overwrites price with promo | store maps `precio` = effective promo price (`store:376`); edit form copies it and PUTs it as `price` (`MerchantView.vue:55`, `store:616`) | latent until promos are used |
| NEW bug: new product keeps local id | create has no `exito` to adopt server `code`; toggling/editing it before resync PUTs `/catalog/products/P-n` -> 404 toast | `store:627-639` |
| Schedule format | `opens_at`/`closes_at` only `min_length=4` | `merchants/schemas.py:17-18` |
| Polling | none | see Current State |
| a11y | toggle has no name/`aria-pressed` (`MerchantView.vue:212-218`); labels not bound (`141,235-244,263-268`); modals lack role=dialog/Esc/focus trap, `useDialogo` unused (`229-253,277-289`); tabs not tablist (`94-104`); no `aria-live` for orders | |
| Mobile | tables only scroll (`MerchantView.vue:171,201`); desing.md:426 wants tiles | |

### Prioritized gaps
1. Critical: cross-merchant writes on schedule/is_open and products (3 endpoints).
2. High: assign_courier status guard + reassignment + courier busy flag (decide rule).
3. High: no polling -> merchant never sees new orders without reload.
4. Med: is_open toggle missing; misleading schedule copy; en_revision/suspendido not surfaced nor gated.
5. Med: price/promo edit bug; new-product id bug; promo/category not editable; no archive.
6. Low: a11y, mobile tiles, Friendly Bento layout; schedule format validation.

### Approaches
| Scope | Work units | Size | Tests |
|---|---|---|---|
| Small: security + correctness | U1 ownership helper (merchant owns code, admin bypass) on 3 endpoints + merchant-exists check; U2 assign guard; U3 store fixes (adopt server code, edit regular price) | S/M | pytest matrix (own/foreign/unlinked/customer/anon/admin); vitest store writes |
| Medium (Small +) | U4 is_open toggle + affiliation banner + gate writes for non-activo; U5 category + promo (0 < promo < price, server and form) + archive (`is_available=false`/soft delete); U6 order polling while panel visible (visibilitychange, interval ~15s) | M | + vitest panel, fake timers; Playwright mocked API |
| Medium + redesign | Medium + U7 Friendly Bento panel (sidebar 240, KPI tiles, order queue, tables->tiles on mobile, `.cx`-style scoped system, `useDialogo`, a11y), merchant legacy-class scan spec | M/L | + e2e design specs, real-browser check on throwaway backend |

### Dependencies on other roles
- Courier: `PATCH /delivery/couriers/{code}/availability` has no ownership either (`delivery/router.py:31-38`); `GET /delivery/couriers` is public and returns phones (`delivery/router.py:15-20`). Courier busy/release lifecycle affects RF-01.
- Admin: affiliation (RF-18) and linking users to merchants (`seed.py:136`, DM- merchants unlinked `seed_demo_catalog.py:251`); no admin UI to link.
- Push (FCM) is cross-role infra; keep stub, out of scope.

### Recommendation
Medium, delivered as small PRs: security first (U1-U3, pytest), then U4-U6. Redesign (U7) as a follow-up change once the shared bento tokens are promoted beyond `.cx`, to avoid mixing a security fix with a visual rewrite.

### Risks
- Changing assign rule breaks 5 existing pytest cases; needs explicit spec decision.
- Polling + optimistic writes can race (resync overwriting a pending write).
- Gating writes for `en_revision` may block onboarding (merchant preparing catalog before approval): decide.

### Ready for Proposal
Yes, pending 3 decisions: allowed states for assignment (only `listo_para_recoger` vs any pre-`en_camino`), whether en_revision merchants may edit catalog, archive = soft delete vs availability flag.
