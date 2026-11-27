"""Abuse limits: pending-order cap, idempotent order creation, rate limits, stale unpaid Yappy
orders, one open ARCO request per type, product cap per merchant and customer cancellation."""
from datetime import datetime, timedelta, timezone

import pytest

from app.domains.catalog.models import Product
from app.domains.orders.models import Order
from app.domains.orders.service import PENDING_ORDERS_LIMIT, PREPAID_PAYMENT_WINDOW
from app.domains.catalog.service import PRODUCTS_PER_MERCHANT_LIMIT
from tests.factories import (
    auth_headers,
    link_merchant,
    make_merchant,
    make_order,
    make_product,
    make_user,
    make_zone,
)

ORDERS = "/api/v1/orders/"
PAYMENTS = "/api/v1/payments/"
LOGIN = "/api/v1/auth/login"
REGISTER = "/api/v1/auth/register"
ARCO = "/api/v1/users/me/arco"


@pytest.fixture()
def shop(db):
    customer = make_user(db, "cli@t.com", "customer")
    owner = make_user(db, "dueno@t.com", "merchant")
    link_merchant(db, make_merchant(db, "M-TEST"), owner)
    make_zone(db)
    make_product(db)
    return {"customer": customer, "owner": owner}


def order_body(method="contr_entrega"):
    return {
        "merchant_code": "M-TEST", "zone_slug": "zona-test", "delivery_address": "Calle 50",
        "payment_method": method, "items": [{"product_code": "P-TEST", "quantity": 1}],
    }


def create(client, user, key=None, method="contr_entrega"):
    headers = auth_headers(user)
    if key:
        headers["Idempotency-Key"] = key
    return client.post(ORDERS, json=order_body(method), headers=headers)


# --- 1. A customer cannot pile up unlimited pending orders ---

def test_pending_orders_are_capped_per_customer(client, db, shop):
    for _ in range(PENDING_ORDERS_LIMIT):
        assert create(client, shop["customer"]).status_code == 201
    res = create(client, shop["customer"])
    assert res.status_code == 409, res.text
    assert db.query(Order).count() == PENDING_ORDERS_LIMIT


def test_orders_that_moved_on_do_not_count_toward_the_cap(client, db, shop):
    for i in range(PENDING_ORDERS_LIMIT):
        make_order(db, f"PED-{i}", shop["customer"].id, status="entregado")
    assert create(client, shop["customer"]).status_code == 201


def test_the_cap_is_per_customer(client, db, shop):
    other = make_user(db, "otro@t.com", "customer")
    for i in range(PENDING_ORDERS_LIMIT):
        make_order(db, f"PED-{i}", other.id)
    assert create(client, shop["customer"]).status_code == 201


# --- 2. Idempotency-Key: a double tap creates one order ---

def test_same_idempotency_key_returns_the_same_order(client, db, shop):
    first = create(client, shop["customer"], key="checkout-abc")
    second = create(client, shop["customer"], key="checkout-abc")
    assert first.status_code == 201
    assert second.status_code == 200, second.text
    assert second.json()["code"] == first.json()["code"]
    assert db.query(Order).count() == 1


def test_different_keys_create_different_orders(client, db, shop):
    a = create(client, shop["customer"], key="k-1")
    b = create(client, shop["customer"], key="k-2")
    assert a.json()["code"] != b.json()["code"]


def test_keys_are_scoped_per_customer(client, db, shop):
    other = make_user(db, "otro@t.com", "customer")
    a = create(client, shop["customer"], key="same")
    b = create(client, other, key="same")
    assert b.status_code == 201
    assert a.json()["code"] != b.json()["code"]


def test_replay_does_not_count_toward_the_pending_cap(client, db, shop):
    for i in range(PENDING_ORDERS_LIMIT):
        assert create(client, shop["customer"], key=f"k-{i}").status_code == 201
    assert create(client, shop["customer"], key="k-0").status_code == 200


def test_overlong_idempotency_key_is_422(client, shop):
    assert create(client, shop["customer"], key="x" * 65).status_code == 422


# --- 3. Rate limits ---

def test_login_is_rate_limited_per_ip(client, db):
    make_user(db, "ana@t.com")
    codes = [
        client.post(LOGIN, json={"email": "ana@t.com", "password": "mala1234"}).status_code
        for _ in range(11)
    ]
    assert codes[:10] == [401] * 10
    assert codes[10] == 429


def test_rate_limited_response_has_retry_after(client, db):
    for _ in range(10):
        client.post(LOGIN, json={"email": "x@t.com", "password": "mala1234"})
    res = client.post(LOGIN, json={"email": "x@t.com", "password": "mala1234"})
    assert res.status_code == 429
    assert int(res.headers["Retry-After"]) > 0


def test_login_limit_is_per_client_ip(client, db):
    for _ in range(10):
        client.post(LOGIN, json={"email": "x@t.com", "password": "mala1234"},
                    headers={"X-Forwarded-For": "1.1.1.1"})
    res = client.post(LOGIN, json={"email": "x@t.com", "password": "mala1234"},
                      headers={"X-Forwarded-For": "2.2.2.2"})
    assert res.status_code == 401


def test_register_is_rate_limited(client):
    codes = []
    for i in range(6):
        codes.append(client.post(REGISTER, json={
            "full_name": "Usuario", "email": f"u{i}@t.com", "phone": "6000-0000",
            "password": "secreta1", "accepts_privacy_policy": True,
        }).status_code)
    assert codes[:5] == [201] * 5
    assert codes[5] == 429


def test_order_creation_is_rate_limited_per_user(client, db, shop):
    # Cancelled right away so the pending cap never triggers: only the rate limit can.
    codes = []
    for _ in range(11):
        res = create(client, shop["customer"])
        codes.append(res.status_code)
        if res.status_code == 201:
            db.query(Order).filter(Order.code == res.json()["code"]).update({"status": "cancelado"})
            db.commit()
    assert codes[:10] == [201] * 10
    assert codes[10] == 429


# --- 4. Unpaid Yappy orders expire instead of staying pending forever ---

def age(db, code, delta):
    order = db.query(Order).filter(Order.code == code).one()
    order.created_at = datetime.now(timezone.utc) - delta
    db.commit()


def test_stale_unpaid_yappy_order_is_cancelled(client, db, shop):
    code = create(client, shop["customer"], method="yappy").json()["code"]
    age(db, code, PREPAID_PAYMENT_WINDOW + timedelta(minutes=1))
    res = client.get(f"{ORDERS}{code}", headers=auth_headers(shop["customer"]))
    assert res.json()["status"] == "cancelado"
    assert "pago" in res.json()["cancellation_reason"].lower()


def test_recent_unpaid_yappy_order_stays_pending(client, db, shop):
    code = create(client, shop["customer"], method="yappy").json()["code"]
    age(db, code, PREPAID_PAYMENT_WINDOW - timedelta(minutes=1))
    res = client.get(f"{ORDERS}{code}", headers=auth_headers(shop["customer"]))
    assert res.json()["status"] == "pendiente"


def test_paid_yappy_order_never_expires(client, db, shop):
    code = create(client, shop["customer"], method="yappy").json()["code"]
    client.post(PAYMENTS, json={"order_code": code, "method": "yappy"},
                headers=auth_headers(shop["customer"]))
    age(db, code, PREPAID_PAYMENT_WINDOW * 4)
    res = client.get(ORDERS, headers=auth_headers(shop["owner"]))
    assert res.json()[0]["status"] == "pendiente"


def test_stale_cash_order_is_left_alone(client, db, shop):
    code = create(client, shop["customer"]).json()["code"]
    age(db, code, PREPAID_PAYMENT_WINDOW * 4)
    res = client.get(ORDERS, headers=auth_headers(shop["owner"]))
    assert res.json()[0]["status"] == "pendiente"


def test_expired_orders_free_the_pending_cap(client, db, shop):
    codes = [create(client, shop["customer"], method="yappy").json()["code"]
             for _ in range(PENDING_ORDERS_LIMIT)]
    for code in codes:
        age(db, code, PREPAID_PAYMENT_WINDOW + timedelta(minutes=1))
    assert create(client, shop["customer"]).status_code == 201


# --- 5. One open ARCO request per type ---

def arco(client, user, kind="Acceso"):
    return client.post(ARCO, json={"request_type": kind, "detail": "Quiero mis datos"},
                       headers=auth_headers(user))


def test_second_open_arco_request_of_same_type_is_409(client, db, shop):
    assert arco(client, shop["customer"]).status_code == 201
    assert arco(client, shop["customer"]).status_code == 409


def test_other_arco_types_are_still_allowed(client, db, shop):
    assert arco(client, shop["customer"], "Acceso").status_code == 201
    assert arco(client, shop["customer"], "Rectificación").status_code == 201


# --- 6. Product cap per merchant ---

def new_product(client, owner, name="Nuevo"):
    return client.post("/api/v1/catalog/merchants/M-TEST/products",
                       json={"name": name, "price": 3.5, "category": "General"},
                       headers=auth_headers(owner))


def test_products_are_capped_per_merchant(client, db, shop):
    existing = db.query(Product).filter(Product.merchant_code == "M-TEST").count()
    db.add_all([
        Product(code=f"P-{i}", merchant_code="M-TEST", name=f"Prod {i}", price=1.0,
                category="General", is_available=True)
        for i in range(PRODUCTS_PER_MERCHANT_LIMIT - existing)
    ])
    db.commit()
    res = new_product(client, shop["owner"])
    assert res.status_code == 409, res.text


def test_under_the_product_cap_creation_works(client, db, shop):
    assert new_product(client, shop["owner"]).status_code == 201


# --- 7. A customer can cancel their own order while it is still pending ---

def cancel(client, user, code, reason="Me equivoqué de dirección"):
    return client.post(f"{ORDERS}{code}/cancel", json={"reason": reason},
                       headers=auth_headers(user))


def test_customer_cancels_own_pending_order(client, db, shop):
    make_order(db, "PED-1", shop["customer"].id)
    res = cancel(client, shop["customer"], "PED-1")
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "cancelado"
    assert res.json()["cancellation_reason"] == "Me equivoqué de dirección"


def test_customer_cannot_cancel_once_the_merchant_confirmed(client, db, shop):
    make_order(db, "PED-1", shop["customer"].id, status="confirmado")
    assert cancel(client, shop["customer"], "PED-1").status_code == 400


def test_customer_cannot_cancel_a_paid_order(client, db, shop):
    code = create(client, shop["customer"], method="yappy").json()["code"]
    client.post(PAYMENTS, json={"order_code": code, "method": "yappy"},
                headers=auth_headers(shop["customer"]))
    res = cancel(client, shop["customer"], code)
    assert res.status_code == 400
    assert "comercio" in res.json()["detail"].lower()


def test_customer_cannot_cancel_someone_elses_order(client, db, shop):
    other = make_user(db, "otro@t.com", "customer")
    make_order(db, "PED-1", other.id)
    assert cancel(client, shop["customer"], "PED-1").status_code == 404


def test_cancel_requires_a_reason(client, db, shop):
    make_order(db, "PED-1", shop["customer"].id)
    assert cancel(client, shop["customer"], "PED-1", reason="   ").status_code == 400


def test_only_customers_use_the_cancel_endpoint(client, db, shop):
    make_order(db, "PED-1", shop["customer"].id)
    assert cancel(client, shop["owner"], "PED-1").status_code == 403


def test_customer_still_cannot_use_the_generic_status_endpoint(client, db, shop):
    make_order(db, "PED-1", shop["customer"].id)
    res = client.patch(f"{ORDERS}PED-1/status", json={"status": "cancelado", "reason": "x"},
                       headers=auth_headers(shop["customer"]))
    assert res.status_code == 403



@pytest.mark.parametrize("field,size", [("description", 1001), ("category", 61)])
def test_product_text_fields_are_capped(client, db, shop, field, size):
    body = {"name": "Nuevo", "price": 3.5, field: "x" * size}
    res = client.post("/api/v1/catalog/merchants/M-TEST/products", json=body,
                      headers=auth_headers(shop["owner"]))
    assert res.status_code == 422, res.text
