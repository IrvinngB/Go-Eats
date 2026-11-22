"""PR10 (10.5): POST /orders is customer-only; admin is not a customer (clarification Q4)."""
import pytest
from sqlalchemy import func, select

from app.domains.orders.models import Order
from tests.factories import auth_headers, make_merchant, make_product, make_user, make_zone

URL = "/api/v1/orders/"


@pytest.fixture()
def shop(db):
    zone = make_zone(db, "zona-test", delivery_fee=2.5, distance_km=3.0)
    make_merchant(db, "M1", "Comercio Real", zone_slug=zone.slug)
    make_product(db, "P1", "M1", "Plato Real", price=5.0)
    return dict(
        customer=make_user(db, "ana@t.com", "customer"),
        admin=make_user(db, "ad@t.com", "admin"),
        merchant=make_user(db, "me@t.com", "merchant"),
        courier=make_user(db, "co@t.com", "courier"),
        accountant=make_user(db, "ac@t.com", "accountant"),
    )


PAYLOAD = {
    "merchant_code": "M1",
    "zone_slug": "zona-test",
    "delivery_address": "Calle 45, Apto 2B",
    "payment_method": "contr_entrega",
    "items": [{"product_code": "P1", "quantity": 1}],
}


def count(db):
    return db.scalar(select(func.count()).select_from(Order))


def test_customer_still_creates_an_order(client, db, shop):
    res = client.post(URL, json=PAYLOAD, headers=auth_headers(shop["customer"]))
    assert res.status_code == 201, res.text
    assert count(db) == 1


def test_admin_cannot_create_an_order(client, db, shop):
    res = client.post(URL, json=PAYLOAD, headers=auth_headers(shop["admin"]))
    assert res.status_code == 403
    assert count(db) == 0


@pytest.mark.parametrize("role", ["merchant", "courier", "accountant"])
def test_other_roles_still_forbidden(client, db, shop, role):
    res = client.post(URL, json=PAYLOAD, headers=auth_headers(shop[role]))
    assert res.status_code == 403
    assert count(db) == 0


def test_anonymous_gets_401(client, db, shop):
    assert client.post(URL, json=PAYLOAD).status_code == 401
    assert count(db) == 0
