# Accountant Financial Reconciliation and Receipts Specification

## Purpose
Fulfill `RF-11` (historical financial transactions, commissions, and payment reconciliation) and `RF-12` (digital receipt preview and PDF download) for the `accountant` role.

## Requirements

### Requirement: Strict payment reconciliation status validation (RF-11)
`PATCH /payments/{code}/status` MUST accept only `"pagado"`, `"pendiente"`, or `"fallido"` (`422 Unprocessable Entity` on any other value) and MUST be restricted to `accountant` and `admin` roles (`403 Forbidden` otherwise).

### Requirement: Transaction reconciliation, search, and PDF receipts in AccountingView (RF-11, RF-12)
`AccountingView.vue` MUST display approved volume, 12% platform commissions, net merchant payout, and pending volume; support filtering by search query, status, and payment method; provide reconciliation controls (`Conciliar` -> `pagado`, `Fallido` -> `fallido`) on pending transactions; and offer both digital receipt preview and PDF download (`GET /payments/{code}/receipt.pdf`) on approved transactions.
