# Tasks: Improve Courier Role

- [x] 1.1 RED `backend/tests/test_courier_role.py`: ownership check on `PATCH /delivery/couriers/{code}/availability` (owner 200, foreign 403, unlinked 403, admin 200) and active-affiliation check (suspended courier cannot set `is_available=True` -> 400).
- [x] 1.2 GREEN `backend/app/domains/delivery/{router,service}.py`.
- [x] 2.1 RED/GREEN `src/views/courier/CourierView.spec.ts` & `src/views/courier/CourierView.vue`: tri-state operational badge (`En línea`, `Ocupado`, `Desconectado`), RF-19 item list + notes + GPS coordinates display, and delivery-partner UI redesign.
