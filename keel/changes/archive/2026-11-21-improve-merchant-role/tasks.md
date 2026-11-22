# Tasks: Improve Merchant Role

- [x] 1.1 RED `backend/tests/test_merchant_role.py`: ownership checks on `PUT /merchants/{code}/schedule`, `POST /catalog/merchants/{code}/products`, `PUT /catalog/products/{id}`, `DELETE /catalog/products/{id}`; `promo_price < price` validation and clearing `promo_price=None`; `assign_courier` rejects `en_camino`/terminal orders.
- [x] 1.2 GREEN `backend/app/domains/merchants/{router,service}.py`, `backend/app/domains/catalog/{router,service,schemas,repository}.py`, `backend/app/domains/orders/service.py`.
- [x] 2.1 RED `src/views/merchant/MerchantView.spec.ts` & `src/stores/useGoEatsStore.writes.spec.ts`: manual `is_open` toggle, product create/edit with `categoria` and `precioPromo`, product delete with rollback, catalog search/category filter, and no false-positive toast on failed writes.
- [x] 2.2 GREEN `src/stores/useGoEatsStore.js` & `src/views/merchant/MerchantView.vue` (with delivery-app manager redesign).
