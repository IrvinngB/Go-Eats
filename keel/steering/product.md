# Product
Last refreshed: 2026-11-20

Go Eats is a multi-merchant delivery marketplace delivered as a PWA (web + mobile from one codebase) plus a REST API, built for Comercios Unidos del Istmo, S.A. (Panama). It is an MVP for a test environment. Target capacity: 500 concurrent orders at peak with responses <= 4 s. Compliance: Panama Law 81 (versioned consents, ARCO rights) and basic PCI-DSS (no card data stored). Source of truth: `arquitectura_tech_stack_y_rf_go_eats.md` (Spanish).

## Roles (RBAC, 5)
| Role | Frontend view | Route |
|---|---|---|
| customer | `views/customer/{Stores,StoreDetail,Orders,Profile}View.vue` | `/tiendas`, `/tiendas/:id`, `/pedidos`, `/perfil` |
| merchant | `views/merchant/MerchantView.vue` | `/panel-comercio` |
| courier | `views/courier/CourierView.vue` | `/panel-repartidor` |
| accountant | `views/accountant/AccountingView.vue` | `/panel-contabilidad` |
| admin | `views/admin/AdminView.vue` | `/panel-admin` |

## Domain concepts
| Concept | Meaning |
|---|---|
| Zone | Coverage polygon with delivery tariff; drives merchant visibility and shipping cost (RF-04, RF-15) |
| Merchant | Affiliated store; admin approves/suspends affiliation |
| Courier | Delivery person; availability online/busy/offline; assigned by merchant (RF-01/02) |
| Order | Frozen snapshot (item prices, subtotal, fee, total, address); strict state machine |
| Order states | pendiente > confirmado > en_preparacion > listo_para_recoger > en_camino > entregado; any pre-delivery state > rechazado/cancelado with mandatory reason |
| Payment | Provider adapter (`PaymentProvider`): cash on delivery + simulated gateway (Paguelo Facil/Yappy only conceptual); PDF receipts |
| Audit | Append-only logs: audit_logs, auth_events, order_status_history, payment_status_history, data_access_log; 12-month retention |
| ARCO request | Data-rights request raised by a user, resolved by admin |

## Requirements (RF-01..RF-20, MoSCoW)
Must: RF-01..06, 08, 10..16, 18, 19. Should: RF-07, 09, 17, 20.
- Customer: zone-based store discovery (04), catalog + product detail (05/06), cart + checkout with notes/address (14), shipping cost (15), live tracking + courier data (03), rating (20, S).
- Merchant: assign ready orders to couriers (01), manage catalog/promos/schedule (13), update order status with push and mandatory cancel reason (16).
- Courier: availability (02), pickup/delivery details (19).
- Admin/accounting: user and affiliation management (18), KPIs (17, S), transaction history + commissions (11), PDF receipts (12).
- Cross-cutting: role registration with policy consent (07, S), RBAC login (08), profile + ARCO (09, S), payments (10).

## Current state (verified in code)
- Backend: all 9 domain routers exist and are mounted under `/api/v1`; seed data loads on startup.
- Frontend: all role views exist; the Pinia store calls the API (zones, merchants, couriers, products, orders, payments, ARCO, audit logs, receipt PDF) but still imports `mockData.js` (migration incomplete).
- Not verified: end-to-end behavior per RF (no tests exist), real-time tracking (RF-03), ratings (RF-20) coverage.
- Design system: see `steering/structure` (UI section) and `desing.md`.
