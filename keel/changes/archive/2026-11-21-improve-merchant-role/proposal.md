# Proposal: Improve Merchant Role (RF-01, RF-13, RF-16)

## Intent
Close all security, functional, and UX gaps for the `merchant` role (`RF-01`, `RF-13`, `RF-16`) following the delivery-app aesthetic established in the customer views.

## Scope

### In Scope
- **Backend Ownership & AuthZ (RF-08 / RF-13)**:
  - `PUT /merchants/{code}/schedule`: enforce `merchant.owner_user_id == current_user.user_id` for `UserRole.MERCHANT` (403 on foreign/unlinked merchant; `ADMIN` allowed).
  - `POST /catalog/merchants/{merchant_code}/products`, `PUT /catalog/products/{product_id}`, and new `DELETE /catalog/products/{product_id}`: enforce merchant ownership for `UserRole.MERCHANT` (403 on foreign merchant, 404 on unknown merchant/product; `ADMIN` allowed).
- **Catalog Promo & Category Validation (RF-13)**:
  - Validate `promo_price`: when present, must satisfy `0 < promo_price < price` (on create and update); allow clearing `promo_price = null`.
  - Normalize `category` (trimmed, defaults to `"General"` when blank).
- **Courier Assignment State Guard (RF-01)**:
  - `PATCH /orders/{code}/courier`: reject assigning a courier when the order is already `en_camino` or in a terminal state (`entregado`, `cancelado`, `rechazado`).
- **Merchant Panel UI & Store Actions (`MerchantView.vue`, `useGoEatsStore.js`)**:
  - Delivery-app manager header with store cover, KPIs, and 1-click manual `is_open` toggle (`Tienda abierta` / `Tienda cerrada`).
  - Full RF-13 catalog management: `categoria`, `precioRegular`, `precioPromo` (with live validation and `-X%` promo badge), product delete (`DELETE /catalog/products/{id}`), and catalog search + category filter chips.
  - Proper async write handling: await `rechazarPedido`, `guardarProducto`, `eliminarProducto`, `guardarHorarioComercio`, and `cambiarAperturaComercio` so success toasts only fire when the API succeeds.
