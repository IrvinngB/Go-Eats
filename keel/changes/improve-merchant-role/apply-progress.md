# Apply Progress: improve-merchant-role

## Work Unit: Merchant Role Ownership, Catalog RF-13, Courier RF-01 & UI Redesign — DONE

Branch `feat/improve-merchant-role`.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----------|-----|-------|-------------|----------|
| 1.1/1.2 | backend/tests/test_merchant_role.py | backend API | 405 passed | foreign merchant could edit schedule/catalog; promo >= price allowed; courier assignable to terminal orders | 8 passed in test_merchant_role.py, 149 in merchant+status suite | owner vs foreign vs unlinked vs admin on schedule, product create/update/delete, promo validation, clearing promo=None, 4 bad statuses on assign_courier | extracted `_ensure_merchant_access` in `CatalogService` |
| 2.1/2.2 | src/views/merchant/MerchantView.spec.ts | component + store | 641 passed | missing `toggle-store-open`, `categoria`/`precioPromo` fields, product delete action, catalog search/category chips | 13 passed in MerchantView.spec.ts | 1-click store open/close toggle, product create with category+promo, promo >= price form block, category chip filtering, DELETE product | delivery-app manager header & KPI strip |

### Files
- `backend/app/domains/merchants/{router,service}.py`
- `backend/app/domains/catalog/{router,service,schemas,repository}.py`
- `backend/app/domains/orders/service.py`
- `backend/tests/test_merchant_role.py` (new)
- `src/stores/useGoEatsStore.js`
- `src/views/merchant/MerchantView.vue`
- `src/views/merchant/MerchantView.spec.ts`
