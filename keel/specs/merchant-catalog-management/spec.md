# Merchant Catalog and Schedule Management Specification

## Purpose
Enforce strict merchant ownership (`owner_user_id`) on schedule and catalog mutations, support full RF-13 catalog management (categories, promotional pricing, availability, product deletion, and manual store open/close toggle), and prevent invalid courier assignments on in-transit or terminal orders (RF-01).

## Requirements

### Requirement: Schedule ownership enforcement
`PUT /merchants/{code}/schedule` MUST allow only the owning `merchant` user (`merchant.owner_user_id == current_user.user_id`) or an `admin` user. Any other authenticated `merchant` (foreign or unlinked) MUST be rejected with `403 Forbidden`.

#### Scenario: Foreign merchant rejected
- GIVEN merchant M1 owned by user U1 and merchant M2 owned by user U2
- WHEN U2 calls `PUT /merchants/M1/schedule`
- THEN the response is `403 Forbidden` and M1's schedule and `is_open` remain unchanged

### Requirement: Catalog ownership and promotional price validation
`POST /catalog/merchants/{merchant_code}/products`, `PUT /catalog/products/{product_id}`, and `DELETE /catalog/products/{product_id}` MUST verify that the target merchant belongs to the authenticated `merchant` user (or that the caller is `admin`), returning `403 Forbidden` otherwise. When `promo_price` is provided and not `null`, it MUST satisfy `0 < promo_price < price` (regular price), returning `400`/`422` otherwise. Passing `promo_price: null` on `PUT` MUST clear the promotion.

#### Scenario: Promo price equal to or greater than regular price rejected
- GIVEN merchant M1 owned by user U1
- WHEN U1 submits a product with `price: 5.0` and `promo_price: 5.0`
- THEN the request is rejected with `400` or `422`

#### Scenario: Product deletion by owner
- GIVEN product `M1-P1` belonging to merchant M1
- WHEN owning user U1 calls `DELETE /catalog/products/M1-P1`
- THEN the response is `204 No Content` and subsequent `GET /catalog/products/M1-P1` returns `404`

### Requirement: Courier assignment state guard (RF-01)
`PATCH /orders/{code}/courier` MUST reject assigning a courier when the order is already `en_camino` or in a terminal state (`entregado`, `cancelado`, `rechazado`) with `400 Bad Request`.
