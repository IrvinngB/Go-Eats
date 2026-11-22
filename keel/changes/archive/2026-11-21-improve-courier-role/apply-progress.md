# Apply Progress: improve-courier-role

## Work Unit: Courier Ownership AuthZ (RF-02), Tri-State Availability & RF-19 Delivery View — DONE

Branch `feat/improve-courier-role`.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----------|-----|-------|-------------|----------|
| 1.1/1.2 | backend/tests/test_courier_role.py | backend API | 413 passed | foreign/unlinked courier could toggle another courier's availability; suspended courier could go online | 2 passed in test_courier_role.py (415 total backend) | owner vs foreign vs unlinked vs admin, suspended vs active affiliation | none |
| 2.1 | src/views/courier/CourierView.spec.ts | component | 8 passed | missing tri-state `Ocupado`/`En línea`/`Desconectado`, missing order items & coords rendering in CourierView | 11 passed in CourierView.spec.ts | `En línea` (idle), `Ocupado` (`en_camino` order), `Desconectado` (`disponible: false`), RF-19 items + notes + coords | delivery-partner header & KPI strip |
