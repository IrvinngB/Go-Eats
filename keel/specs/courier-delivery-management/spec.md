# Courier Delivery Management Specification

## Purpose
Enforce strict courier ownership (`user_id`) and active affiliation on availability updates (RF-02), expose tri-state operational status (`En línea`, `Ocupado`, `Desconectado`), and display complete pickup, delivery, order items, coordinates, and payment collection details to the assigned courier (RF-19, RF-16).

## Requirements

### Requirement: Courier availability ownership and active-affiliation guard (RF-02)
`PATCH /delivery/couriers/{code}/availability` MUST allow only the linked `courier` user (`courier.user_id == current_user.user_id`) or an `admin` user. Any other authenticated `courier` (foreign or unlinked) MUST be rejected with `403 Forbidden`. A courier whose `affiliation_status != "activo"` MUST NOT be allowed to set `is_available: true` (`400 Bad Request`).

#### Scenario: Foreign courier cannot toggle another courier's availability
- GIVEN courier K1 linked to user U1 and courier K2 linked to user U2
- WHEN U2 calls `PATCH /delivery/couriers/K1/availability`
- THEN the response is `403 Forbidden` and K1's `is_available` is unchanged

#### Scenario: Suspended courier cannot go online
- GIVEN courier K1 with `affiliation_status = "suspendido"`
- WHEN K1's linked user calls `PATCH /delivery/couriers/K1/availability` with `{"is_available": true}`
- THEN the response is `400 Bad Request` and `is_available` remains `false`

### Requirement: Tri-state operational indicator and full delivery details (RF-02, RF-19)
`CourierView.vue` MUST display the courier's operational state as:
- `Ocupado` when the courier is online (`disponible = true`) and has at least one active order in `en_camino`
- `En línea` when `disponible = true` and no order is currently `en_camino`
- `Desconectado` when `disponible = false`

For every assigned active order, `CourierView.vue` MUST display pickup merchant details, customer name, phone, delivery address, coordinates badge (when `lat`/`lng` exist), item breakdown (`cantidad × nombre` and item notes), order notes (`observaciones`), and collection instruction (`Cobrar B/ X.XX contra entrega` vs `Pagado en línea`).
