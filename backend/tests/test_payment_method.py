"""PR6: method Literal on order and payment create, legacy rows stay readable."""
import pytest

from app.domains.payments.models import Payment
from tests.factories import (
    auth_headers,
    make_merchant,
    make_order,
    make_product,
    make_user,
    make_zone,
)


def order_body(method):
    return {
        "merchant_code": "M1",
        "zone_slug": "zona-test",
        "delivery_address": "Calle 45",
        "payment_method": method,
        "items": [{"product_code": "P1", "quantity": 1}],
    }


@pytest.fixture()
def shop(db):
    customer = make_user(db, "ana@t.com", "customer")
    make_zone(db)
    make_merchant(db, "M1", "Uno", zone_slug="zona-test")
    make_product(db, "P1", "M1", price=5.0)
    return customer


@pytest.mark.parametrize("method", ["tarjeta", "paypal", "", "YAPPY"])
def test_order_rejects_unsupported_methods(client, db, shop, method):
    res = client.post("/api/v1/orders/", json=order_body(method), headers=auth_headers(shop))
    assert res.status_code == 422


@pytest.mark.parametrize("method", ["contr_entrega", "yappy"])
def test_order_accepts_supported_methods(client, shop, method):
    res = client.post("/api/v1/orders/", json=order_body(method), headers=auth_headers(shop))
    assert res.status_code == 201, res.text
    assert res.json()["payment_method"] == method


@pytest.mark.parametrize("method,ok", [("tarjeta", False), ("yappy", True), ("contr_entrega", True)])
def test_payment_create_method_literal(client, db, shop, method, ok):
    res = client.post(
        "/api/v1/payments/",
        json={
            "order_code": "PED-1", "merchant_name": "m", "customer_name": "c",
            "method": method, "subtotal": 5, "delivery_fee": 1,
        },
        headers=auth_headers(shop),
    )
    assert (res.status_code == 201) is ok, res.text
    if not ok:
        assert res.status_code == 422
        assert db.query(Payment).count() == 0


def test_legacy_tarjeta_rows_are_readable(client, db, shop):
    order = make_order(db, "PED-1", shop.id)
    order.payment_method = "tarjeta"
    db.add(
        Payment(
            code="TX-9001", order_code="PED-1", merchant_name="m", customer_name="c",
            method="tarjeta", subtotal=1.0, delivery_fee=1.0, commission=0.1, total=2.0,
        )
    )
    db.commit()
    acct = make_user(db, "ac@t.com", "accountant")
    pays = client.get("/api/v1/payments/", headers=auth_headers(acct))
    assert pays.status_code == 200
    assert pays.json()[0]["method"] == "tarjeta"
    got = client.get("/api/v1/orders/PED-1", headers=auth_headers(shop))
    assert got.status_code == 200
    assert got.json()["payment_method"] == "tarjeta"


def test_fresh_seed_has_no_tarjeta(db):
    from app import seed
    from app.domains.orders.models import Order

    seed.seed_initial_data(db)
    assert {m for (m,) in db.query(Order.payment_method).distinct()} == {"contr_entrega", "yappy"}
    assert {m for (m,) in db.query(Payment.method).distinct()} == {"contr_entrega", "yappy"}
