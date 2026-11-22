# Admin Platform Governance Specification

## Purpose
Provide live operational KPIs (`RF-17`), full user account activation/suspension management (`RF-18`), and merchant/courier affiliation approval and suspension (`RF-18`), alongside ARCO request resolution (`RF-09`).

## Requirements

### Requirement: User account status management (RF-18)
`PATCH /users/{user_id}/status` MUST allow an authenticated `admin` to activate or suspend (`is_active: bool`) any user account except their own (`400 Bad Request` on self-suspension), recording an audit log entry. Non-admin callers MUST be rejected with `403 Forbidden`.

#### Scenario: Admin suspends a user account
- GIVEN an active user account U1 and an authenticated admin A1 (`A1.id != U1.id`)
- WHEN A1 calls `PATCH /users/{U1.id}/status` with `{"is_active": false}`
- THEN the response is `200 OK` with `is_active: false`

#### Scenario: Admin cannot self-suspend
- GIVEN an authenticated admin A1
- WHEN A1 calls `PATCH /users/{A1.id}/status` with `{"is_active": false}`
- THEN the response is `400 Bad Request` and A1 remains active

### Requirement: Live KPIs and merchant/courier/user governance in AdminView (RF-17, RF-18)
`AdminView.vue` MUST fetch live KPIs from `GET /reports/kpis` and user accounts from `GET /users/`, and provide controls to approve/reject pending affiliations, suspend/reactivate both merchants and couriers, and suspend/reactivate user accounts with role and search filters.
