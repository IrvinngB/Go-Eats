# Proposal & Apply Summary: improve-accountant-role (RF-11, RF-12)

## Gaps Closed
1. **RF-11 Transaction Reconciliation in UI & Store**: Wired `conciliarTransaccion` (`Conciliar` -> `pagado`, `Fallido` -> `fallido`) into `AccountingView.vue` for pending transactions, added search by TX/Order/Customer/Merchant/Reference, and added `Neto a comercios` KPI card.
2. **RF-11 Strict Status Validation**: Tightened `PaymentStatusUpdate.status` to `Literal["pagado", "pendiente", "fallido"]` in `backend/app/domains/payments/schemas.py`.
3. **RF-12 Direct PDF Download & Digital Receipt**: Added direct `PDF` download action alongside the receipt modal in `AccountingView.vue`, covered by `AccountingView.spec.ts` and `backend/tests/test_accountant_role.py`.
