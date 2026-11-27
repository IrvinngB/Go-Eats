"""Hardening: bcrypt 72-byte limit, live account status, unpaid Yappy orders, payment lock,
payload size limits and the production JWT secret guard."""
import pytest
from sqlalchemy.dialects import postgresql

from app.core.config import DEFAULT_JWT_SECRET, validate_runtime_settings
from app.core.security import hash_password, verify_password
from app.domains.orders.repository import OrderRepository
from app.domains.users.models import User
from tests.factories import (
    auth_headers,
    link_merchant,
    make_merchant,
    make_order,
    make_product,
    make_user,
    make_zone,
)

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
ORDERS = "/api/v1/orders/"
PAYMENTS = "/api/v1/payments/"


def register(client, password):
    return client.post(REGISTER, json={
        "full_name": "Nuevo Usuario", "email": "nuevo@t.com", "phone": "6000-0000",
        "password": password, "accepts_privacy_policy": True,
    })


# --- 1. bcrypt only hashes 72 bytes: longer passwords must be a 422, never a 500 ---

def test_register_rejects_password_over_72_bytes(client):
    res = register(client, "a" * 73)
    assert res.status_code == 422, res.text


def test_register_counts_bytes_not_characters(client):
    # 40 characters but 80 bytes in UTF-8: still over the bcrypt limit.
    res = register(client, "ñ" * 40)
    assert res.status_code == 422, res.text


def test_register_accepts_exactly_72_bytes(client):
    res = register(client, "a" * 72)
    assert res.status_code == 201, res.text


def test_login_with_overlong_password_is_401_not_500(client, db):
    make_user(db, "carlos@t.com")
    res = client.post(LOGIN, json={"email": "carlos@t.com", "password": "x" * 200})
    assert res.status_code == 401, res.text


def test_security_helpers_never_raise_on_long_passwords():
    assert verify_password("x" * 200, hash_password("abc123")) is False
    with pytest.raises(ValueError):
        hash_password("x" * 73)


# --- 2. Suspension is effective immediately, not when the access token expires ---

def test_suspended_user_token_is_rejected_immediately(client, db):
    user = make_user(db, "ana@t.com")
    headers = auth_headers(user)
    assert client.get(ORDERS, headers=headers).status_code == 200
    user.is_active = False
    db.commit()
    res = client.get(ORDERS, headers=headers)
    assert res.status_code == 401, res.text


def test_token_of_a_deleted_user_is_rejected(client, db):
    user = make_user(db, "ana@t.com")
    headers = auth_headers(user)
    db.delete(db.get(User, user.id))
    db.commit()
    assert client.get(ORDERS, headers=headers).status_code == 401


# --- 3. A merchant cannot move an electronic (Yappy) order forward until it is paid ---

@pytest.fixture()
def shop(db):
    customer = make_user(db, "cli@t.com", "customer")
    owner = make_user(db, "dueno@t.com", "merchant")
    link_merchant(db, make_merchant(db, "M-TEST"), owner)
    make_zone(db)
    return {"customer": customer, "owner": owner}


def confirm(client, owner, code):
    return client.patch(
        f"{ORDERS}{code}/status", json={"status": "confirmado"}, headers=auth_headers(owner)
    )


def test_unpaid_yappy_order_cannot_be_confirmed(client, db, shop):
    order = make_order(db, "PED-1", shop["customer"].id)
    order.payment_method = "yappy"
    db.commit()
    res = confirm(client, shop["owner"], "PED-1")
    assert res.status_code == 400, res.text
    assert "pago" in res.json()["detail"].lower()


def test_paid_yappy_order_can_be_confirmed(client, db, shop):
    order = make_order(db, "PED-1", shop["customer"].id)
    order.payment_method = "yappy"
    db.commit()
    paid = client.post(
        PAYMENTS, json={"order_code": "PED-1", "method": "yappy"},
        headers=auth_headers(shop["customer"]),
    )
    assert paid.status_code == 201 and paid.json()["status"] == "pagado"
    assert confirm(client, shop["owner"], "PED-1").status_code == 200


def test_unpaid_yappy_order_can_still_be_rejected(client, db, shop):
    order = make_order(db, "PED-1", shop["customer"].id)
    order.payment_method = "yappy"
    db.commit()
    res = client.patch(
        f"{ORDERS}PED-1/status", json={"status": "rechazado", "reason": "Sin stock"},
        headers=auth_headers(shop["owner"]),
    )
    assert res.status_code == 200, res.text


def test_cash_order_is_confirmed_without_payment(client, db, shop):
    make_order(db, "PED-1", shop["customer"].id)  # contr_entrega: paid on delivery
    assert confirm(client, shop["owner"], "PED-1").status_code == 200


# --- 4. Paying locks the order row so two concurrent payments cannot both pass ---

def test_payment_reads_the_order_with_a_row_lock(client, db, shop, monkeypatch):
    make_order(db, "PED-1", shop["customer"].id)
    calls = []
    original = OrderRepository.get_by_code_for_update

    def spy(self, code):
        calls.append(code)
        return original(self, code)

    monkeypatch.setattr(OrderRepository, "get_by_code_for_update", spy)
    res = client.post(
        PAYMENTS, json={"order_code": "PED-1", "method": "contr_entrega"},
        headers=auth_headers(shop["customer"]),
    )
    assert res.status_code == 201, res.text
    assert calls == ["PED-1"]


def test_order_lock_statement_is_select_for_update_on_postgres(db):
    stmt = OrderRepository(db).lock_statement("PED-1")
    sql = str(stmt.compile(dialect=postgresql.dialect()))
    assert "FOR UPDATE OF orders" in sql


# --- 5. Payload size limits ---

def order_body(**overrides):
    body = {
        "merchant_code": "M-TEST", "zone_slug": "zona-test", "delivery_address": "Calle 50",
        "payment_method": "contr_entrega", "items": [{"product_code": "P-TEST", "quantity": 1}],
    }
    body.update(overrides)
    return body


@pytest.mark.parametrize("overrides", [
    {"notes": "x" * 501},
    {"delivery_address": "x" * 301},
    {"items": [{"product_code": "P-TEST", "quantity": 1, "notes": "x" * 201}]},
    {"items": [{"product_code": "P-TEST", "quantity": 1}] * 31},
])
def test_order_create_rejects_oversized_payloads(client, db, shop, overrides):
    make_product(db)
    res = client.post(ORDERS, json=order_body(**overrides), headers=auth_headers(shop["customer"]))
    assert res.status_code == 422, res.text


def test_order_create_within_limits_still_works(client, db, shop):
    make_product(db)
    res = client.post(
        ORDERS,
        json=order_body(notes="x" * 500, delivery_address="x" * 300),
        headers=auth_headers(shop["customer"]),
    )
    assert res.status_code == 201, res.text


def test_status_reason_is_capped(client, db, shop):
    make_order(db, "PED-1", shop["customer"].id)
    res = client.patch(
        f"{ORDERS}PED-1/status", json={"status": "rechazado", "reason": "x" * 501},
        headers=auth_headers(shop["owner"]),
    )
    assert res.status_code == 422, res.text


def test_rating_comment_is_capped(client, db, shop):
    make_order(db, "PED-1", shop["customer"].id, status="entregado")
    res = client.post(
        f"{ORDERS}PED-1/rating",
        json={"merchant_stars": 5, "courier_stars": 5, "comment": "x" * 1001},
        headers=auth_headers(shop["customer"]),
    )
    assert res.status_code == 422, res.text


# --- 6. Production must never start with the hard-coded JWT secret ---

@pytest.mark.parametrize("env", [{"RENDER": "true"}, {"APP_ENV": "production"}])
@pytest.mark.parametrize("secret", [None, DEFAULT_JWT_SECRET])
def test_production_refuses_missing_or_default_jwt_secret(env, secret):
    environ = dict(env)
    if secret is not None:
        environ["JWT_SECRET_KEY"] = secret
    with pytest.raises(RuntimeError):
        validate_runtime_settings(environ)


def test_production_with_a_real_secret_starts():
    validate_runtime_settings({"RENDER": "true", "JWT_SECRET_KEY": "s3cr3t-generado-por-render"})


def test_local_development_keeps_the_default_secret():
    validate_runtime_settings({})
