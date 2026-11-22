# Proposal: Improve Courier Role (RF-02, RF-16, RF-19)

## Intent
Close the ownership security hole on courier availability (`RF-02`), prevent suspended couriers from going online, and upgrade `CourierView.vue` to the delivery-app partner design with tri-state status (`En línea`, `Ocupado`, `Desconectado`) and complete pickup/delivery/item breakdown (`RF-19`).

## Scope
- **Backend (`backend/app/domains/delivery/{router,service}.py`)**:
  - Enforce `courier.user_id == current_user.user_id` for `UserRole.COURIER` on `PATCH /delivery/couriers/{code}/availability` (`403 Forbidden` for foreign/unlinked couriers; `ADMIN` allowed).
  - Reject setting `is_available=True` when `courier.affiliation_status != "activo"` (`400 Bad Request`).
- **Frontend (`src/views/courier/CourierView.vue`)**:
  - Delivery Partner dashboard design matching `MerchantView` and customer views (`max-w-4xl`, partner cover header, KPI strip).
  - Tri-state operational badge (`En línea`, `Ocupado`, `Desconectado`) computed from `yo.disponible` and whether an active order is `en_camino`.
  - Complete RF-19 order card: pickup merchant + zone, customer name + phone + address + frozen GPS coordinates badge (`lat, lng`), expandable/visible package items list (`cantidad × nombre` + item notes), order notes, and cash-on-delivery vs online payment badge.
