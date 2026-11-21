# Customer Payments Specification

## Purpose
The frontend never calls `POST /payments`, sends `tarjeta` as the order payment method, and records payment outcome only locally (RF-10). Payments MUST be created through the API with a simulated provider, no card data handled, and a persisted status history.

## Requirements

### Requirement: Frontend creates payments through the API
After a successful order creation, the frontend MUST call `POST /payments/` for that order and show the outcome returned by the server. It MUST NOT compute or store a payment result locally.

#### Scenario: Cash on delivery
- GIVEN a customer checks out with cash on delivery
- WHEN the order is created
- THEN `POST /payments/` is called with method `contr_entrega`
- AND the payment status returned is `pendiente`

#### Scenario: Electronic approved
- GIVEN a customer checks out with the electronic option
- WHEN the simulated provider approves
- THEN the payment status is `pagado` and the UI shows the server's reference

#### Scenario: Electronic fails
- GIVEN the simulated provider declines
- WHEN the payment completes
- THEN the status is `fallido`, the UI shows a payment failure, and the user can retry or choose cash on delivery

### Requirement: Supported methods and no `tarjeta`
Both the order and payment create schemas MUST type the method as `Literal['contr_entrega','yappy']`; `yappy` is the internal channel id of the single simulated gateway. The frontend MUST NOT send `tarjeta`, and the backend MUST reject unsupported values (including `tarjeta`) with 422. The UI label MUST be "Pago electrónico (simulado)" with the no-card-data note, never naming Yappy or Paguelo Fácil. Fresh seed cycles only the two valid methods. Legacy stored `tarjeta` rows (orders, payments) MUST remain readable; read paths MUST NOT validate the method.

#### Scenario: Legacy value
- GIVEN a request with `payment_method: "tarjeta"`
- WHEN `POST /orders/` or `POST /payments/` is called
- THEN the response is 422 and nothing is stored

#### Scenario: Legacy rows readable
- GIVEN a stored payment with method `tarjeta`
- WHEN an accountant lists payments
- THEN it is returned with 200

### Requirement: Server-derived payment amounts
`POST /payments/` MUST compute amounts from the persisted order (subtotal, delivery_fee), taking `order_code` and method from the request, and MUST ignore client-supplied subtotal, delivery fee, merchant name and customer name. The caller MUST be the owning customer (non-owner customer: 404); admin gets 403 (Previously: admin allowed). Payment codes MUST be unique and collision-free (not derived from row count).

#### Scenario: Tampered amount
- GIVEN an order with total 15.75
- WHEN the request claims subtotal 1.00 and fee 0
- THEN the stored payment total is 15.75

#### Scenario: Another customer's order
- GIVEN order X owned by A
- WHEN customer B posts a payment for X
- THEN the response is 404

#### Scenario: Admin posts payment
- GIVEN an admin token
- WHEN `POST /payments/` is called
- THEN the response is 403

#### Scenario: Unique payment code
- GIVEN existing payments TX-9001..TX-9060 and one deleted
- WHEN a payment is created
- THEN its code does not collide with any existing code

### Requirement: Single active payment per order
An order MUST NOT receive a second payment while it has a `pagado` or `pendiente` payment; the attempt MUST return 409. A `fallido` payment MAY be followed by a retry.

#### Scenario: Duplicate
- GIVEN order X with a `pagado` payment
- WHEN another payment is posted for X
- THEN the response is 409

#### Scenario: Retry after failure
- GIVEN order X with only a `fallido` payment
- WHEN a new payment is posted
- THEN a new payment is created

### Requirement: Simulated failure is not client-controlled
The `simulate_failure` input MUST be honored only when the backend flag `DEV_SIMULATE_FAILURE` is on (default off, not enable-able by request); otherwise it is ignored.

#### Scenario: Flag off
- GIVEN `DEV_SIMULATE_FAILURE` is off
- WHEN a customer sends `simulate_failure: true`
- THEN the simulated provider approves normally

#### Scenario: Flag on
- GIVEN `DEV_SIMULATE_FAILURE` is on
- WHEN a customer sends `simulate_failure: true`
- THEN the payment status is `fallido`

### Requirement: No card data
The system MUST NOT accept, store, log or audit card numbers, CVV or expiry. The payment request schema MUST NOT contain card fields, and the UI MUST NOT collect them (the simulated provider returns a reference only).

#### Scenario: Card fields sent
- GIVEN a payload including `card_number`
- WHEN processed
- THEN the field is not persisted and does not appear in audit or log output

### Requirement: Payment status history
Every payment creation and status change MUST record an entry in the payment status history (previous status, new status, actor, timestamp), and reconciliation by accountant/admin MUST append to it.

#### Scenario: History on create and reconcile
- GIVEN a new payment with status `pagado`
- WHEN an accountant reconciles it to `pendiente`
- THEN the history has two entries in order, the second with the accountant as actor

### Requirement: Customer sees own payment status
A customer MUST be able to see the status of their own order's payment (from the creation response or an own-scoped read) without access to other customers' payments, and MAY download the receipt only for their own payment.

#### Scenario: Receipt of another customer
- GIVEN payment TX-1 of customer A
- WHEN customer B requests its receipt
- THEN the response is 404

#### Scenario: Customer list endpoint
- GIVEN a customer token
- WHEN `GET /payments/` is called
- THEN the response is 403
