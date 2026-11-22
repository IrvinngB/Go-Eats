# Customer Orders and Pricing Specification

## Purpose
The server currently trusts client-supplied `unit_price`, `delivery_fee`, `merchant_name` and `customer_name`, and the store fakes success on failed writes. Order amounts MUST be computed by the server, and failures MUST be visible to the customer (RF-14, RF-15).

## Requirements

### Requirement: Server-computed item prices
On `POST /orders/`, the server MUST set each item's `unit_price` and `name` from the catalog product identified by `product_code`, ignoring any client-supplied price or name. A product with a `promo_price` (not null and > 0) is priced at the promo price. The stored order item freezes that price. The frontend MUST map `promo_price` from the catalog and display the effective price, so the UI never shows a price different from what the server charges.

#### Scenario: Promo price
- GIVEN product P with price 5.00 and promo_price 4.00
- WHEN a customer orders P (with any client `unit_price`)
- THEN unit_price is 4.00 and the UI displayed 4.00

#### Scenario: Tampered price
- GIVEN product P1 priced 5.00 in the catalog
- WHEN a customer posts an item for P1 with `unit_price: 0.01`
- THEN the created order item has unit_price 5.00 and subtotal reflects 5.00

#### Scenario: Price changes later
- GIVEN an order created at 5.00
- WHEN the catalog price changes to 6.00
- THEN the existing order still shows 5.00

### Requirement: Server-computed delivery fee
The server MUST set `delivery_fee` from the tariff of the order's zone and MUST ignore the client value. Distance (`distance_km`) MUST NOT be used in the fee, and the product MUST NOT claim distance-based pricing.

#### Scenario: Tampered fee
- GIVEN zone Z with tariff 2.50
- WHEN a customer posts `delivery_fee: 0` for zone Z
- THEN the order's delivery_fee is 2.50

#### Scenario: Unknown or inactive zone
- GIVEN a `zone_slug` that does not exist or is inactive
- WHEN the order is posted
- THEN the response is 400 and no order is created

### Requirement: Consistent totals
`subtotal` MUST equal the sum of `unit_price x quantity` over items, and `total` MUST equal `subtotal + delivery_fee`, both rounded to two decimals.

#### Scenario: Multiple items
- GIVEN items 5.00 x2 and 3.25 x1 and fee 2.50
- WHEN the order is created
- THEN subtotal is 13.25 and total is 15.75

### Requirement: Product validation
The server MUST reject an order (400, no order created) when any product does not exist, does not belong to the order's merchant, or is unavailable (`is_available` false), or when the merchant does not exist, is not `affiliation_status == "activo"`, or is not `is_open`. `opens_at`/`closes_at` MUST NOT be evaluated.

#### Scenario: Closed merchant
- GIVEN merchant M with `is_open` false
- WHEN an order for M is posted
- THEN the response is 400 and no order exists

#### Scenario: Unaffiliated merchant
- GIVEN merchant M whose affiliation is not `activo`
- WHEN an order for M is posted
- THEN the response is 400

#### Scenario: Unavailable product
- GIVEN product P2 with is_available false
- WHEN an order including P2 is posted
- THEN the response is 400 naming the problem and no order exists

#### Scenario: Product of another merchant
- GIVEN P3 belongs to merchant M2
- WHEN an order for merchant M1 includes P3
- THEN the response is 400

### Requirement: Server-derived identity fields
`merchant_name` MUST come from the merchant record and `customer_name` from the authenticated user's profile. Client-supplied values MUST be ignored (not rejected, for client compatibility). The order's `customer_id` MUST be the authenticated user.

#### Scenario: Spoofed names
- GIVEN customer "Ana"
- WHEN the payload has `customer_name: "Bob"` and a fake merchant name
- THEN the stored order shows "Ana" and the real merchant name

### Requirement: Unique order codes
Order code generation MUST be collision-free against existing orders (including seeded PED-1040..PED-1099), e.g. max numeric suffix + 1 with retry on uniqueness conflict. It MUST NOT derive from the row count. Payment codes follow the same rule (see customer-payments).

#### Scenario: First order on seeded database
- GIVEN a database seeded with 60 orders
- WHEN a customer creates an order
- THEN the response is 201 with a code not previously used (not 500)

#### Scenario: After deletion
- GIVEN orders were deleted so the count is lower than the highest code
- WHEN an order is created
- THEN its code is still unique

### Requirement: Anonymous checkout
Checkout by an anonymous user MUST NOT call the API; it follows the redirect rule in session-and-route-guards and the cart is retained.

#### Scenario: Anonymous confirms
- GIVEN an anonymous user with a cart
- WHEN they confirm checkout
- THEN no `POST /orders/` is sent and they are sent to `/login`

### Requirement: Input bounds
Quantities MUST be integers of at least 1, items MUST be non-empty, and the order MUST be created with status `pendiente`.

#### Scenario: Zero quantity
- GIVEN an item with quantity 0
- WHEN posted
- THEN the response is 422

### Requirement: Write failures surface to the user
Store actions that write to the backend (create order, rate, ARCO, profile, and other writes in the store) MUST be awaited and MUST NOT swallow errors (no fire-and-forget empty catch). On failure the UI MUST show a user-readable error message and MUST NOT present success.

#### Scenario: Order creation fails
- GIVEN `POST /orders/` returns 400 or the network fails
- WHEN the customer confirms checkout
- THEN an error message is shown, no success confirmation appears, and the cart is retained

#### Scenario: Server messages
- GIVEN the API returns an English `detail`
- WHEN it is displayed
- THEN the user sees a readable message (translated or generic fallback), not a raw stack or empty text

### Requirement: Optimistic rollback
Any optimistic local mutation MUST be reverted when its write fails, restoring the prior state.

#### Scenario: Rating fails
- GIVEN a customer rates a delivered order optimistically
- WHEN `POST /orders/{code}/rating` fails
- THEN the local rating is removed and an error is shown

#### Scenario: Success path
- GIVEN the write succeeds
- WHEN the response arrives
- THEN local state reflects the server response (including server-computed prices)

### Requirement: Orders matched by identity
The customer's order list MUST come from the role-scoped API (own orders), not from matching name strings client-side.

#### Scenario: Name collision
- GIVEN two customers with the same display name
- WHEN each opens "Mis pedidos"
- THEN each sees only their own orders
