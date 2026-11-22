"""PR6: server-computed prices and fee, merchant and product validation, identity fields."""
import pytest
from sqlalchemy import func, select

from app.domains.orders.models import Order, OrderItem
from tests.factories import (
    auth_headers,
    make_merchant,
    make_product,
    make_user,
    make_zone,
)

URL = "/api/v1/orders/"


@pytest.fixture()
def shop(db):
    customer = make_user(db, "ana@t.com", "customer", full_name="Ana Real", phone="6000-1111")
    zone = make_zone(db, "zona-test", delivery_fee=2.5, distance_km=99.0)
    merchant = make_merchant(db, "M1", "Comercio Real", zone_slug=zone.slug)
    other = make_merchant(db, "M2", "Otro Comercio", zone_slug=zone.slug)
    make_product(db, "P1", "M1", "Plato Real", price=5.0)
    make_product(db, "P2", "M1", "Cafe Real", price=3.25)
    make_product(db, "PP", "M1", "Promo Real", price=5.0, promo_price=4.0)
    make_product(db, "P0", "M1", "Promo Cero", price=6.0, promo_price=0.0)
    make_product(db, "PX", "M1", "Agotado", price=2.0, is_available=False)
    make_product(db, "P3", "M2", "De otro", price=2.0)
    return dict(customer=customer, zone=zone, merchant=merchant, other=other)


def body(items, **extra):
    base = {
        "merchant_code": "M1",
        "zone_slug": "zona-test",
        "delivery_address": "Calle 45, Apto 2B",
        "payment_method": "contr_entrega",
        "items": items,
    }
    base.update(extra)
    return base


def post(client, shop, payload):
    return client.post(URL, json=payload, headers=auth_headers(shop["customer"]))


def order_count(db):
    return db.scalar(select(func.count()).select_from(Order))


def test_tampered_price_and_fee_are_ignored(client, db, shop):
    payload = body(
        [{"product_code": "P1", "name": "Gratis", "unit_price": 0.01, "quantity": 1}],
        delivery_fee=0,
        subtotal=0.01,
        total=0.01,
    )
    res = post(client, shop, payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["items"][0]["unit_price"] == 5.0
    assert data["items"][0]["name"] == "Plato Real"
    assert data["delivery_fee"] == 2.5
    assert data["subtotal"] == 5.0
    assert data["total"] == 7.5


def test_totals_are_consistent_for_multiple_items(client, shop):
    res = post(
        client,
        shop,
        body(
            [
                {"product_code": "P1", "quantity": 2},
                {"product_code": "P2", "quantity": 1},
            ]
        ),
    )
    data = res.json()
    assert res.status_code == 201, res.text
    assert data["subtotal"] == 13.25
    assert data["total"] == 15.75
    assert sum(i["unit_price"] * i["quantity"] for i in data["items"]) == 13.25


def test_promo_price_applies_when_positive(client, shop):
    res = post(client, shop, body([{"product_code": "PP", "quantity": 2, "unit_price": 99}]))
    assert res.status_code == 201, res.text
    assert res.json()["items"][0]["unit_price"] == 4.0
    assert res.json()["subtotal"] == 8.0


def test_zero_promo_price_falls_back_to_price(client, shop):
    res = post(client, shop, body([{"product_code": "P0", "quantity": 1}]))
    assert res.json()["items"][0]["unit_price"] == 6.0


def test_distance_is_not_used_for_the_fee(client, shop):
    res = post(client, shop, body([{"product_code": "P1", "quantity": 1}]))
    assert res.json()["delivery_fee"] == 2.5  # zone distance_km is 99.0


def test_price_change_does_not_alter_existing_order(client, db, shop):
    res = post(client, shop, body([{"product_code": "P1", "quantity": 1}]))
    from app.domains.catalog.models import Product

    db.scalars(select(Product).where(Product.code == "P1")).first().price = 6.0
    db.commit()
    got = client.get(f"{URL}{res.json()['code']}", headers=auth_headers(shop["customer"]))
    assert got.json()["items"][0]["unit_price"] == 5.0


def test_identity_fields_come_from_server(client, shop):
    res = post(
        client,
        shop,
        body(
            [{"product_code": "P1", "quantity": 1}],
            customer_name="Bob",
            customer_phone="000",
            merchant_name="Fake Name",
        ),
    )
    data = res.json()
    assert data["customer_name"] == "Ana Real"
    assert data["customer_phone"] == "6000-1111"
    assert data["merchant_name"] == "Comercio Real"
    assert data["customer_id"] == shop["customer"].id
    assert data["status"] == "pendiente"


def test_unavailable_product_is_400_and_creates_nothing(client, db, shop):
    res = post(client, shop, body([{"product_code": "PX", "quantity": 1}]))
    assert res.status_code == 400
    assert "PX" in res.json()["detail"]
    assert order_count(db) == 0


def test_product_of_another_merchant_is_400(client, db, shop):
    res = post(client, shop, body([{"product_code": "P3", "quantity": 1}]))
    assert res.status_code == 400
    assert order_count(db) == 0


def test_unknown_product_is_400(client, db, shop):
    res = post(client, shop, body([{"product_code": "NOPE", "quantity": 1}]))
    assert res.status_code == 400
    assert order_count(db) == 0


def test_closed_merchant_is_400_with_clear_message(client, db, shop):
    shop["merchant"].is_open = False
    db.commit()
    res = post(client, shop, body([{"product_code": "P1", "quantity": 1}]))
    assert res.status_code == 400
    assert res.json()["detail"] == "Merchant is not accepting orders (closed or not active)."
    assert order_count(db) == 0


@pytest.mark.parametrize("state", ["suspendido", "pendiente", "inactivo"])
def test_unaffiliated_merchant_is_400(client, db, shop, state):
    shop["merchant"].affiliation_status = state
    db.commit()
    res = post(client, shop, body([{"product_code": "P1", "quantity": 1}]))
    assert res.status_code == 400
    assert order_count(db) == 0


def test_open_merchant_schedule_is_not_evaluated(client, db, shop):
    shop["merchant"].opens_at = "03:00"
    shop["merchant"].closes_at = "03:01"
    db.commit()
    res = post(client, shop, body([{"product_code": "P1", "quantity": 1}]))
    assert res.status_code == 201


def test_unknown_merchant_is_400(client, db, shop):
    res = post(client, shop, body([{"product_code": "P1", "quantity": 1}], merchant_code="NOPE"))
    assert res.status_code == 400
    assert order_count(db) == 0


@pytest.mark.parametrize("slug", ["no-existe", "inactiva"])
def test_unknown_or_inactive_zone_is_400(client, db, shop, slug):
    make_zone(db, "inactiva", is_active=False)
    res = post(client, shop, body([{"product_code": "P1", "quantity": 1}], zone_slug=slug))
    assert res.status_code == 400
    assert order_count(db) == 0


@pytest.mark.parametrize("qty", [0, -1, 51])
def test_quantity_bounds_are_422(client, db, shop, qty):
    res = post(client, shop, body([{"product_code": "P1", "quantity": qty}]))
    assert res.status_code == 422
    assert order_count(db) == 0


def test_empty_items_is_422(client, shop):
    assert post(client, shop, body([])).status_code == 422


def test_stored_rows_match_response(client, db, shop):
    res = post(client, shop, body([{"product_code": "PP", "quantity": 3, "notes": "sin sal"}]))
    row = db.scalars(select(OrderItem)).first()
    assert (row.unit_price, row.quantity, row.notes, row.name) == (4.0, 3, "sin sal", "Promo Real")
    stored = db.scalars(select(Order)).first()
    assert (stored.subtotal, stored.delivery_fee, stored.total) == (12.0, 2.5, 14.5)
    assert res.json()["code"] == stored.code
