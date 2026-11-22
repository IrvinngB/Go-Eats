## Exploration: improve-courier-role (courier audit)

### Current State
`CourierView.vue` binds to `store.repartidorPropio` (`GET /delivery/couriers/me`) and handles canonical transitions (`listo_para_recoger -> en_camino -> entregado`, plus `cancelado` with mandatory reason for RF-16). However, backend availability mutation lacks ownership checks, and `CourierView.vue` lacks RF-02 tri-state status (`en línea / ocupado / desconectado`) and RF-19 item/pickup/coordinate details.

### RF coverage (courier: RF-02, RF-16, RF-19)
| RF | Status | Frontend | Backend | Gaps |
|---|---|---|---|---|
| **RF-02** Manage availability (`en línea / ocupado / desconectado`) | partial/insecure | `CourierView.vue:73-83` (binary switch) | `PATCH /delivery/couriers/{code}/availability` (`delivery/router.py:31-38`) | **Critical authz**: no ownership check (`courier.user_id == current_user.user_id`); suspended couriers can set `is_available=True`; UI only shows binary `Disponible`/`No disponible` instead of `En línea`/`Ocupado`/`Desconectado` |
| **RF-16** Update order status + push + mandatory reason on cancel | done | `CourierView.vue:31-49,156-200` | `PATCH /orders/{code}/status` (`orders/service.py:182-229`) | Already enforces `ROLE_TARGETS[COURIER] = {en_camino, entregado, cancelado}` and mandatory reason on `cancelado` |
| **RF-19** Consult pickup, delivery, items, and notes of assigned orders | partial | `CourierView.vue:106-153` | `GET /orders/` scoped to courier (`orders/service.py:86-90`) | `CourierView.vue` does not render the order's `items` (`cantidad × nombre` + item notes), delivery zone name, or frozen GPS coordinates (`lat`/`lng`) |
