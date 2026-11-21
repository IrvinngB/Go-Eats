# Order Status Normalization Specification

## Purpose
Order states exist in two spellings (UI/seed use `en preparación`, API allows `en_preparacion`), and `rechazado` renders wrongly in the customer timeline. One canonical set MUST be used across API, seed and UI, following the state machine in section 3.3 of the architecture document.

## Requirements

### Requirement: Canonical states
The only valid order states MUST be `pendiente`, `confirmado`, `en_preparacion`, `listo_para_recoger`, `en_camino`, `entregado`, `rechazado`, `cancelado`.

#### Scenario: Stored and returned values
- GIVEN any order returned by the API
- WHEN its status is read
- THEN it is one of the eight canonical values (no spaces, no accents)

### Requirement: Spaced variants rejected at the API boundary
Decision: the API MUST reject non-canonical spellings (e.g. `en preparación`, `en camino`, `listo para recoger`) in status updates with 422/400 and MUST NOT silently normalize them. The transition table MUST contain canonical keys only.

#### Scenario: Spaced status
- GIVEN an order in `confirmado`
- WHEN `PATCH /orders/{code}/status` sends `en preparación`
- THEN the response is 400 or 422 and the status is unchanged

#### Scenario: Canonical status
- GIVEN an order in `confirmado`
- WHEN `en_preparacion` is sent by the merchant
- THEN the update succeeds

### Requirement: State machine transitions
Allowed transitions MUST be: pendiente to confirmado; confirmado to en_preparacion; en_preparacion to listo_para_recoger; listo_para_recoger to en_camino; en_camino to entregado; and from any non-terminal state to `cancelado` or `rechazado` with a mandatory reason (widening per section 3.3; the current code allows `rechazado` only from `pendiente`/`confirmado`); `entregado`, `cancelado` and `rechazado` are terminal. Any other transition MUST return 400.

#### Scenario: Skipping a step
- GIVEN an order in `pendiente`
- WHEN `entregado` is requested
- THEN the response is 400 and the status is unchanged

#### Scenario: Reject late
- GIVEN an order in `en_preparacion`
- WHEN `rechazado` is sent with reason "Sin insumos"
- THEN the update succeeds and the reason is recorded

#### Scenario: Terminal state
- GIVEN an order in `entregado`
- WHEN any status is requested
- THEN the response is 400

#### Scenario: Full happy path
- GIVEN a new order
- WHEN merchant and courier advance it step by step to `entregado`
- THEN each step succeeds and each is recorded in the status history

### Requirement: Mandatory reason
A transition to `cancelado` or `rechazado` MUST include a non-blank `reason`; otherwise 400. The reason MUST be stored and recorded in the status history.

#### Scenario: Missing reason
- GIVEN an order in `pendiente`
- WHEN `rechazado` is sent with a blank reason
- THEN the response is 400 and the status is unchanged

#### Scenario: Reason stored
- GIVEN `cancelado` with reason "Sin stock"
- WHEN applied
- THEN `cancellation_reason` and the history entry contain "Sin stock"

### Requirement: Who may change status
Status updates MUST be limited to merchant, courier and admin, and a merchant or courier MUST only update orders within their scope (as in customer-authorization). A customer MUST NOT update status through `PATCH /orders/{code}/status`.

#### Scenario: Customer attempt
- GIVEN a customer token
- WHEN they patch their own order to `cancelado`
- THEN the response is 403

### Requirement: Seed uses canonical states
Seed data (orders and history entries, including the courier-assignment status set) MUST use only canonical states, including at least one `rechazado` order with a reason. On an existing database no `rechazado` demo row is inserted by migration.
(Previously: seed/init rewrote legacy rows)

#### Scenario: Seed audit
- GIVEN a freshly seeded database
- WHEN all order and history statuses are listed
- THEN every value is canonical and at least one is `rechazado`

### Requirement: Idempotent startup migration
A function `run_startup_migrations`, called from both the application lifespan and `init_db.init`, MUST run on every startup independently of the seed's early return and MUST: (a) add missing columns (`merchants.owner_user_id`, `couriers.user_id`) via schema inspection, then `CREATE UNIQUE INDEX IF NOT EXISTS`; (b) backfill owner/user links (seed email mapping, see customer-authorization) only where NULL; (c) rewrite legacy statuses in `orders.status`, `order_status_history.previous_status` and `.new_status` via the map `en preparación`->`en_preparacion`, `listo para recoger`->`listo_para_recoger`, `en camino`->`en_camino`. It MUST be safe on SQLite and PostgreSQL and tolerate concurrent gunicorn workers (an "already exists" error from a racing worker is not fatal).

#### Scenario: Pre-change schema upgraded
- GIVEN a database with old tables, spaced statuses and no link columns
- WHEN the migration runs
- THEN the columns and unique indexes exist, links are backfilled and all statuses are canonical

#### Scenario: Second run is a no-op
- GIVEN the migration already ran
- WHEN it runs again (second startup)
- THEN no data changes and no error occurs; manually set links are not overwritten

#### Scenario: Racing worker
- GIVEN another worker already added a column
- WHEN this worker attempts the same step
- THEN it re-inspects and continues without failing

#### Scenario: Seed skipped
- GIVEN a database with 40 or more orders
- WHEN the application starts
- THEN the migration still runs

### Requirement: UI labels consistent
The UI MUST use canonical values internally and map each to a single Spanish display label (e.g. `en_preparacion` shown as "En preparación") in customer, merchant and courier views; no view may compare against spaced values.

#### Scenario: Label rendering
- GIVEN an order in `listo_para_recoger`
- WHEN shown in any panel
- THEN the label is the same in all panels

### Requirement: Rejected state in customer timeline
The customer timeline MUST render `rechazado` (and `cancelado`) as a terminal state with its reason, and MUST NOT show 0% progress or an unknown step for it.

#### Scenario: Rejected order
- GIVEN an order `rechazado` with reason "Cerrado"
- WHEN the customer opens "Mis pedidos"
- THEN the timeline shows Rechazado and the reason, with no active progress step

#### Scenario: Underscored state progress
- GIVEN an order `en_preparacion`
- WHEN the timeline renders
- THEN the matching step is highlighted and earlier steps are complete
