# Customer Authorization Specification

## Purpose
Close the critical access-control holes found in the audit: client-chosen login role, self-registration as admin, anonymous reads of orders/PII/finance, and missing ownership checks. Other role panels must keep working.

## Requirements

### Requirement: Login ignores client-supplied role
`POST /auth/login` MUST issue tokens (access and refresh) and a user payload carrying the role stored for the user, and MUST ignore any `role` in the request body, unless the dev role-override flag is on.

#### Scenario: Role in body ignored
- GIVEN a customer user with valid credentials
- WHEN login is sent with `role: "admin"` and the flag is off
- THEN the response succeeds with role `customer` in the token and user payload
- AND the issued token is rejected by admin-only endpoints with 403

#### Scenario: Refresh keeps stored role
- GIVEN a refresh token issued while the flag was off
- WHEN `POST /auth/refresh` is called
- THEN the new tokens carry the user's stored role

#### Scenario: Refresh ignores token role claim
- GIVEN a refresh token whose `role` claim differs from the user's stored role
- WHEN `POST /auth/refresh` is called
- THEN the new tokens and user payload carry the stored `user.role`, never the claim

### Requirement: Dev role-override flag
The role override MUST be controlled by the runtime backend flag `DEV_ROLE_OVERRIDE` (env, default OFF; true only for `1/true/yes`, case-insensitive) and MUST NOT be enable-able by any request (body, header, query, or token claim). When ON, the override MAY be honored for demo use. A separate flag `DEV_SIMULATE_FAILURE` (same rules) governs simulated payment failure (see customer-payments); the two flags are independent.

#### Scenario: Default off
- GIVEN the application started with no override setting
- WHEN login is sent with a different role
- THEN the override is not applied

#### Scenario: Request cannot enable
- GIVEN the flag is off
- WHEN a request supplies a header, query or body field named like the flag
- THEN the override is not applied

#### Scenario: Flag on
- GIVEN the flag is explicitly enabled in server configuration
- WHEN login is sent with a role
- THEN that role is honored

### Requirement: Registration forces customer role
`POST /auth/register` MUST always create the user with role `customer`. A privileged `role` in the body MUST NOT take effect; the request SHALL either be rejected with 422 or have the field ignored (decision: ignored, user created as customer).

#### Scenario: Admin role requested
- GIVEN an unauthenticated visitor
- WHEN register is sent with `role: "admin"`
- THEN the created user and returned token have role `customer`

### Requirement: Role-scoped order listing
`GET /orders/` MUST require authentication and return only the orders visible to the caller's role: customer, own orders; merchant, orders of the merchant associated with that user; courier, orders assigned to the courier associated with that user; admin and accountant, all orders. The same scope MUST apply to `PATCH /orders/{code}/courier` (merchant only for own merchant's orders) and to status updates (merchant/courier only within scope; out of scope gets 404).

#### Scenario: Merchant assigns courier on foreign order
- GIVEN an order of merchant M2
- WHEN merchant M1 calls `PATCH /orders/{code}/courier`
- THEN the response is 404 and the order is unchanged

#### Scenario: Anonymous
- GIVEN no token
- WHEN `GET /orders/` is called
- THEN the response is 401

#### Scenario: Customer sees own only
- GIVEN orders for customers A and B
- WHEN customer A lists orders
- THEN only A's orders are returned

#### Scenario: Merchant and courier scoping
- GIVEN orders across two merchants and two couriers
- WHEN a merchant (or courier) lists orders
- THEN only that merchant's (or courier's assigned) orders are returned

#### Scenario: Admin and accountant
- GIVEN any orders
- WHEN admin or accountant lists
- THEN all orders are returned

#### Scenario: Query filters cannot widen scope
- GIVEN customer A
- WHEN A passes `merchant_code` or `courier_code` of other parties
- THEN results never include orders outside A's scope

### Requirement: User-entity link
A merchant user MUST be linked to a merchant via nullable, unique `merchants.owner_user_id`, and a courier user to a courier via nullable, unique `couriers.user_id` (both referencing users). One user per entity. Seed mapping MUST be explicit by email: hector.endara->c1, patricia.motta->c2, arturo.melo->c3, monica.aleman->c4; javier.morales->r1, maria.cedeno->r2, luis.gomez->r3, pedro.abrego->r4. A merchant/courier user with no linked entity MUST get an empty order list (not 500, not all orders). Scoping is resolved server-side.

#### Scenario: Linked merchant
- GIVEN user hector.endara linked to c1
- WHEN he lists orders
- THEN only c1's orders are returned

#### Scenario: Unlinked user
- GIVEN a merchant user with no merchant
- WHEN they list orders
- THEN the response is 200 with an empty list

#### Scenario: Second link rejected
- GIVEN user U already owns merchant c1
- WHEN U is set as owner of c2
- THEN the database rejects it (uniqueness)

### Requirement: Order ownership on read and rate
`GET /orders/{code}` and `POST /orders/{code}/rating` MUST enforce ownership. Policy: a role not permitted for the action gets 403; a permitted role requesting an order outside its scope gets 404 (existence not disclosed). Admin and accountant may read any order; rating is limited to the owning customer (admin is NOT allowed).

### Requirement: Admin is not a customer
`POST /orders/`, `POST /orders/{code}/rating` and `POST /payments/` MUST be limited to the owning customer; admin gets 403. Admin keeps read access to any order, status changes, courier assignment and payment reconciliation.

#### Scenario: Admin creates order
- GIVEN an admin token
- WHEN `POST /orders/` is called
- THEN the response is 403 and no order exists

#### Scenario: Admin keeps oversight
- GIVEN an admin token
- WHEN reading any order, changing status, assigning a courier or reconciling a payment
- THEN each succeeds

#### Scenario: Other customer's order
- GIVEN order X owned by customer A
- WHEN customer B calls GET or POST rating on X
- THEN the response is 404 and nothing is modified

#### Scenario: Wrong role rating
- GIVEN a delivered order
- WHEN a courier posts a rating
- THEN the response is 403

#### Scenario: Owner rates
- GIVEN delivered order X owned by A
- WHEN A posts a valid rating
- THEN the response is 200 with the rating stored

### Requirement: Locked finance and privacy endpoints
`GET /payments/` MUST be limited to admin and accountant; `GET /users/arco` to admin; `GET /reports/kpis`, `/reports/financial` and `/reports/audit-logs` to admin and accountant. Anonymous callers get 401; authenticated callers of other roles get 403.

#### Scenario: Anonymous
- GIVEN no token
- WHEN any of these endpoints (including kpis and financial) is called
- THEN the response is 401

#### Scenario: Customer
- GIVEN a customer token
- WHEN any of these endpoints is called
- THEN the response is 403

#### Scenario: Permitted roles
- GIVEN an accountant token
- WHEN payments, kpis, financial and audit-logs are requested
- THEN all return 200; AND `GET /users/arco` returns 403

### Requirement: Other panels keep working
The frontend store sync MUST tolerate a 403 (or 401 handled separately) from any single call without discarding data from the successful calls, so each role still loads its permitted data.

#### Scenario: Customer sync
- GIVEN a customer session where payments, arco and audit-logs return 403
- WHEN the store syncs
- THEN zones, merchants, catalog and the customer's own orders are loaded and no error blocks the UI

#### Scenario: Role smoke
- GIVEN each of the five roles
- WHEN that role's panel data endpoints are requested
- THEN each returns 200 for the data its panel needs
