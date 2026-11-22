# Proposal & Apply Summary: improve-admin-role (RF-17, RF-18, RF-09)

## Gaps Closed
1. **RF-17 Live KPIs**: Replaced static `mockData.kpis` in `AdminView.vue` with live `GET /reports/kpis` (`store.cargarPanelAdmin`) and dynamic store fallback.
2. **RF-18 User Account Management**: Added `PATCH /users/{user_id}/status` (`is_active: bool` with self-suspension guard and audit log) and the `Usuarios` tab in `AdminView.vue` with search, role chips, and suspend/reactivate actions.
3. **RF-18 Courier & Merchant Affiliation Governance**: Added the platform couriers table (`PATCH /delivery/couriers/{code}/affiliation` via `store.cambiarEstadoRepartidor`) alongside merchants in `AdminView.vue`.
