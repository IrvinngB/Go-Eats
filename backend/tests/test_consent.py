"""PR9: persisted revocable consent, consent gate on orders/payments, own-scoped ARCO."""
import pytest
from sqlalchemy import func, select

from app.core.config import settings
from app.domains.orders.models import Order
from app.domains.payments.models import Payment
from app.domains.users.models import ArcoRequest, DataConsent, User
from tests.factories import (
    auth_headers,
    make_consent,
    make_merchant,
    make_order,
    make_product,
    make_user,
    make_zone,
)

CONSENT = "/api/v1/users/me/consent"
ARCO = "/api/v1/users/me/arco"
ORDERS = "/api/v1/orders/"
PAYMENTS = "/api/v1/payments/"


@pytest.fixture()
def shop(db):
    customer = make_user(db, "ana@t.com", "customer", full_name="Ana")
    other = make_user(db, "bob@t.com", "customer", full_name="Bob")
    make_zone(db)
    make_merchant(db, "M1", zone_slug="zona-test")
    make_product(db, "P1", "M1", price=5.0)
    return {"customer": customer, "other": other}


def order_body():
    return {
        "merchant_code": "M1", "zone_slug": "zona-test", "delivery_address": "Calle 1",
        "payment_method": "contr_entrega", "items": [{"product_code": "P1", "quantity": 1}],
    }


def put_consent(client, user, accepted):
    return client.put(CONSENT, json={"accepted": accepted}, headers=auth_headers(user))


def consent_rows(db, user):
    return list(db.scalars(select(DataConsent).where(DataConsent.user_id == user.id)
                           .order_by(DataConsent.id)))


# ---- read / write consent -------------------------------------------------

def test_get_consent_without_record_is_not_accepted(client, db):
    user = make_user(db, "n@t.com", consent=False)
    res = client.get(CONSENT, headers=auth_headers(user))
    assert res.status_code == 200
    assert res.json() == {"accepted": False, "policy_version": None, "accepted_at": None}


def test_get_consent_returns_latest_record(client, db):
    user = make_user(db, "n@t.com")
    body = client.get(CONSENT, headers=auth_headers(user)).json()
    assert body["accepted"] is True
    assert body["policy_version"] == settings.privacy_policy_version
    assert body["accepted_at"] is not None


def test_latest_is_highest_id_not_timestamp(client, db):
    from datetime import datetime, timedelta, timezone
    user = make_user(db, "n@t.com", consent=False)
    now = datetime.now(timezone.utc)
    make_consent(db, user, True, accepted_at=now + timedelta(hours=1))  # newer time, lower id
    make_consent(db, user, False, accepted_at=now)                      # older time, higher id
    assert client.get(CONSENT, headers=auth_headers(user)).json()["accepted"] is False


def test_put_consent_appends_records_and_keeps_history(client, db):
    user = make_user(db, "n@t.com")
    res = put_consent(client, user, False)
    assert res.status_code == 200
    assert res.json()["accepted"] is False
    assert res.json()["policy_version"] == settings.privacy_policy_version
    put_consent(client, user, True)
    rows = consent_rows(db, user)
    assert [r.accepted for r in rows] == [True, False, True]


def test_same_second_revoke_then_regrant_reflects_last(client, db):
    user = make_user(db, "n@t.com")
    put_consent(client, user, False)
    put_consent(client, user, True)
    put_consent(client, user, False)
    assert client.get(CONSENT, headers=auth_headers(user)).json()["accepted"] is False


def test_put_consent_only_affects_the_caller(client, db, shop):
    put_consent(client, shop["customer"], False)
    assert len(consent_rows(db, shop["other"])) == 1
    assert client.get(CONSENT, headers=auth_headers(shop["other"])).json()["accepted"] is True


def test_put_consent_rejects_non_boolean_and_anonymous(client, db):
    user = make_user(db, "n@t.com")
    assert client.put(CONSENT, json={}, headers=auth_headers(user)).status_code == 422
    assert client.put(CONSENT, json={"accepted": True}).status_code == 401
    assert client.get(CONSENT).status_code == 401


def test_login_does_not_add_consent(client, db):
    from tests.factories import DEFAULT_PASSWORD
    user = make_user(db, "n@t.com", consent=False)
    res = client.post("/api/v1/auth/login", json={"email": "n@t.com", "password": DEFAULT_PASSWORD})
    assert res.status_code == 200
    assert consent_rows(db, user) == []


# ---- gate ----------------------------------------------------------------

def test_revoked_consent_blocks_order_and_creates_nothing(client, db, shop):
    put_consent(client, shop["customer"], False)
    res = client.post(ORDERS, json=order_body(), headers=auth_headers(shop["customer"]))
    assert res.status_code == 403
    assert res.json()["detail"] == "consent_required"
    assert db.scalar(select(func.count()).select_from(Order)) == 0


def test_revoked_consent_blocks_payment(client, db, shop):
    order = make_order(db, "PED-1", shop["customer"].id)
    put_consent(client, shop["customer"], False)
    res = client.post(PAYMENTS, json={"order_code": order.code, "method": "contr_entrega"},
                      headers=auth_headers(shop["customer"]))
    assert res.status_code == 403
    assert res.json()["detail"] == "consent_required"
    assert db.scalar(select(func.count()).select_from(Payment)) == 0


def test_missing_consent_counts_as_not_accepted_on_both_posts(client, db):
    user = make_user(db, "nc@t.com", consent=False)
    make_zone(db)
    make_merchant(db, "M1")
    make_product(db, "P1", "M1")
    order = make_order(db, "PED-1", user.id)
    o = client.post(ORDERS, json=order_body(), headers=auth_headers(user))
    p = client.post(PAYMENTS, json={"order_code": order.code, "method": "contr_entrega"},
                    headers=auth_headers(user))
    assert (o.status_code, o.json()["detail"]) == (403, "consent_required")
    assert (p.status_code, p.json()["detail"]) == (403, "consent_required")


def test_regrant_restores_order_and_payment(client, db, shop):
    user = shop["customer"]
    put_consent(client, user, False)
    put_consent(client, user, True)
    res = client.post(ORDERS, json=order_body(), headers=auth_headers(user))
    assert res.status_code == 201, res.text
    pay = client.post(PAYMENTS, json={"order_code": res.json()["code"], "method": "contr_entrega"},
                      headers=auth_headers(user))
    assert pay.status_code == 201, pay.text


def test_revoke_keeps_data_and_reads_keep_working(client, db, shop):
    user = shop["customer"]
    make_order(db, "PED-1", user.id)
    put_consent(client, user, False)
    assert db.scalar(select(func.count()).select_from(Order)) == 1
    assert db.get(User, user.id) is not None
    h = auth_headers(user)
    assert client.get(ORDERS, headers=h).status_code == 200
    assert client.get(ORDERS + "PED-1", headers=h).status_code == 200
    assert client.get("/api/v1/users/me", headers=h).status_code == 200
    assert client.get(CONSENT, headers=h).status_code == 200
    assert client.get(ARCO, headers=h).status_code == 200
    assert client.post(ARCO, json={"request_type": "Acceso", "detail": "Quiero mis datos"},
                       headers=h).status_code == 201
    assert len(consent_rows(db, user)) == 2  # nothing deleted


def test_gate_does_not_hide_role_errors(client, db):
    admin = make_user(db, "a@t.com", "admin", consent=False)
    merchant = make_user(db, "m@t.com", "merchant", consent=False)
    res = client.post(PAYMENTS, json={"order_code": "X", "method": "yappy"},
                      headers=auth_headers(merchant))
    assert res.status_code == 403 and res.json()["detail"] != "consent_required"
    assert client.get(ORDERS, headers=auth_headers(admin)).status_code == 200


def test_anonymous_post_is_still_401(client, db):
    assert client.post(ORDERS, json=order_body()).status_code == 401


# ---- ARCO ----------------------------------------------------------------

def arco(client, user, rtype="Acceso", detail="Quiero conocer mis datos"):
    return client.post(ARCO, json={"request_type": rtype, "detail": detail},
                       headers=auth_headers(user))


def test_arco_list_is_own_only_and_newest_first(client, db, shop):
    a, b = shop["customer"], shop["other"]
    first = arco(client, a, "Acceso").json()["id"]
    arco(client, b, "Oposición")
    second = arco(client, a, "Rectificación").json()["id"]
    res = client.get(ARCO, headers=auth_headers(a))
    assert res.status_code == 200
    assert [r["id"] for r in res.json()] == [second, first]
    assert {r["user_id"] for r in res.json()} == {a.id}


def test_arco_list_includes_status_and_admin_response(client, db, shop):
    admin = make_user(db, "ad@t.com", "admin")
    rid = arco(client, shop["customer"]).json()["id"]
    client.post(f"/api/v1/users/arco/{rid}/resolve", json={"admin_response": "Listo, enviado"},
                headers=auth_headers(admin))
    row = client.get(ARCO, headers=auth_headers(shop["customer"])).json()[0]
    assert (row["status"], row["admin_response"]) == ("respondida", "Listo, enviado")


@pytest.mark.parametrize("rtype", ["Acceso", "Rectificación", "Cancelación", "Oposición"])
def test_arco_accepts_each_closed_type(client, db, shop, rtype):
    res = arco(client, shop["customer"], rtype)
    assert res.status_code == 201
    assert (res.json()["request_type"], res.json()["status"]) == (rtype, "pendiente")


@pytest.mark.parametrize("rtype", ["Borrado", "acceso", "", "Acceso "])
def test_arco_rejects_unknown_type_and_stores_nothing(client, db, shop, rtype):
    assert arco(client, shop["customer"], rtype).status_code == 422
    assert db.scalar(select(func.count()).select_from(ArcoRequest)) == 0


def test_arco_rejects_short_detail(client, db, shop):
    assert arco(client, shop["customer"], detail="abc").status_code == 422


def test_arco_cannot_be_created_for_another_user(client, db, shop):
    res = client.post(ARCO, json={"request_type": "Acceso", "detail": "Detalle valido",
                                  "user_id": shop["other"].id, "user_name": "Bob"},
                      headers=auth_headers(shop["customer"]))
    assert res.status_code == 201
    row = db.scalars(select(ArcoRequest)).one()
    assert (row.user_id, row.user_name) == (shop["customer"].id, "Ana")
    assert client.get(ARCO, headers=auth_headers(shop["other"])).json() == []


def test_admin_wide_list_stays_admin_only(client, db, shop):
    arco(client, shop["customer"])
    assert client.get("/api/v1/users/arco", headers=auth_headers(shop["customer"])).status_code == 403
    admin = make_user(db, "ad@t.com", "admin")
    assert len(client.get("/api/v1/users/arco", headers=auth_headers(admin)).json()) == 1
