"""PR7: server-derived payments, ownership, duplicates, dev-only failure, history, receipts."""
import logging

import pytest

from app.core.config import settings
from app.domains.orders.models import Order, OrderStatusHistory
from app.domains.payments.models import Payment, PaymentStatusHistory
from app.shared.audit import AuditLog
from tests.factories import (
    auth_headers,
    make_merchant,
    make_order,
    make_user,
    make_zone,
)

URL = "/api/v1/payments/"


@pytest.fixture()
def world(db):
    owner = make_user(db, "ana@t.com", "customer", full_name="Ana")
    other = make_user(db, "bob@t.com", "customer", full_name="Bob")
    make_zone(db)
    make_merchant(db, "M-TEST")
    order = make_order(db, "PED-1", owner.id)  # subtotal 10.0, fee 1.5, total 11.5
    return {"owner": owner, "other": other, "order": order}


@pytest.fixture()
def electronic(db, world):
    world["order"].payment_method = "yappy"
    db.commit()
    return world


def pay(client, user, body):
    return client.post(URL, json=body, headers=auth_headers(user))


def test_amounts_come_from_the_order_and_client_amounts_are_ignored(client, db, world):
    res = pay(client, world["owner"], {
        "order_code": "PED-1", "method": "contr_entrega",
        "subtotal": 1.0, "delivery_fee": 0, "total": 0.01,
        "merchant_name": "Fake", "customer_name": "Fake",
    })
    assert res.status_code == 201, res.text
    body = res.json()
    assert (body["subtotal"], body["delivery_fee"], body["total"]) == (10.0, 1.5, 11.5)
    assert body["merchant_name"] == "Merchant" and body["customer_name"] == "Customer"
    assert body["commission"] == 1.2
    assert db.query(Payment).one().total == 11.5


def test_cash_creates_a_pending_payment(client, db, world):
    res = pay(client, world["owner"], {"order_code": "PED-1", "method": "contr_entrega"})
    assert res.status_code == 201
    assert res.json()["status"] == "pendiente"
    assert res.json()["provider_reference"].startswith("COD-")


def test_electronic_is_approved_by_default(client, electronic):
    res = pay(client, electronic["owner"], {"order_code": "PED-1", "method": "yappy"})
    assert res.json()["status"] == "pagado"
    assert res.json()["provider_reference"].startswith("YPY-")


def test_other_customers_order_is_404_and_stores_nothing(client, db, world):
    res = pay(client, world["other"], {"order_code": "PED-1", "method": "yappy"})
    assert res.status_code == 404
    assert db.query(Payment).count() == 0


def test_unknown_order_is_404(client, world):
    assert pay(client, world["owner"], {"order_code": "PED-NOPE", "method": "yappy"}).status_code == 404


@pytest.mark.parametrize("role", ["admin", "accountant", "merchant", "courier"])
def test_non_customer_roles_get_403(client, db, world, role):
    user = make_user(db, f"{role}@t.com", role)
    assert pay(client, user, {"order_code": "PED-1", "method": "yappy"}).status_code == 403


def test_anonymous_is_401(client, world):
    assert client.post(URL, json={"order_code": "PED-1", "method": "yappy"}).status_code == 401


@pytest.mark.parametrize("first", ["yappy", "contr_entrega"])
def test_duplicate_payment_for_an_active_payment_is_409(client, db, world, first):
    world["order"].payment_method = first
    db.commit()
    assert pay(client, world["owner"], {"order_code": "PED-1", "method": first}).status_code == 201
    again = pay(client, world["owner"], {"order_code": "PED-1", "method": first})
    assert again.status_code == 409
    assert db.query(Payment).count() == 1


def test_method_must_match_the_order_method(client, db, world):
    res = pay(client, world["owner"], {"order_code": "PED-1", "method": "yappy"})  # order is contr_entrega
    assert res.status_code == 400
    assert db.query(Payment).count() == 0


def test_order_must_be_pending(client, db, world):
    world["order"].status = "confirmado"
    db.commit()
    assert pay(client, world["owner"], {"order_code": "PED-1", "method": "contr_entrega"}).status_code == 400


def test_flag_off_ignores_simulate_failure(client, db, electronic, monkeypatch):
    monkeypatch.setattr(settings, "dev_simulate_failure", False)
    res = pay(client, electronic["owner"], {"order_code": "PED-1", "method": "yappy", "simulate_failure": True})
    assert res.status_code == 201
    assert res.json()["status"] == "pagado"
    assert db.query(Order).one().status == "pendiente"


def test_flag_on_failure_marks_payment_failed_and_cancels_the_order(client, db, electronic, monkeypatch):
    monkeypatch.setattr(settings, "dev_simulate_failure", True)
    res = pay(client, electronic["owner"], {"order_code": "PED-1", "method": "yappy", "simulate_failure": True})
    assert res.status_code == 201
    assert res.json()["status"] == "fallido"
    order = db.query(Order).one()
    assert order.status == "cancelado"
    assert order.cancellation_reason == "Pago electrónico rechazado"
    rows = db.query(OrderStatusHistory).filter_by(order_code="PED-1").all()
    assert [(r.previous_status, r.new_status, r.actor, r.reason) for r in rows] == [
        ("pendiente", "cancelado", "sistema:pago", "Pago electrónico rechazado")
    ]


def test_flag_on_without_simulate_failure_still_approves(client, electronic, monkeypatch):
    monkeypatch.setattr(settings, "dev_simulate_failure", True)
    res = pay(client, electronic["owner"], {"order_code": "PED-1", "method": "yappy"})
    assert res.json()["status"] == "pagado"


def test_simulate_failure_never_fails_cash(client, db, world, monkeypatch):
    monkeypatch.setattr(settings, "dev_simulate_failure", True)
    res = pay(client, world["owner"], {"order_code": "PED-1", "method": "contr_entrega", "simulate_failure": True})
    assert res.json()["status"] == "pendiente"
    assert db.query(Order).one().status == "pendiente"


def test_payment_history_is_recorded_on_create_and_reconcile(client, db, world):
    code = pay(client, world["owner"], {"order_code": "PED-1", "method": "contr_entrega"}).json()["code"]
    acct = make_user(db, "ac@t.com", "accountant")
    res = client.patch(f"{URL}{code}/status", json={"status": "pagado"}, headers=auth_headers(acct))
    assert res.status_code == 200
    rows = db.query(PaymentStatusHistory).filter_by(payment_code=code).order_by(PaymentStatusHistory.id).all()
    assert [(r.previous_status, r.new_status) for r in rows] == [(None, "pendiente"), ("pendiente", "pagado")]
    assert rows[0].actor == f"customer:{world['owner'].id}"
    assert rows[1].actor == f"accountant:{acct.id}"


def test_failed_payment_history_row(client, db, electronic, monkeypatch):
    monkeypatch.setattr(settings, "dev_simulate_failure", True)
    code = pay(client, electronic["owner"], {"order_code": "PED-1", "method": "yappy", "simulate_failure": True}).json()["code"]
    row = db.query(PaymentStatusHistory).filter_by(payment_code=code).one()
    assert (row.previous_status, row.new_status) == (None, "fallido")


CARD = {"card_number": "4111111111111111", "cvv": "123", "expiry": "12/30"}


def test_card_fields_are_dropped_never_stored_or_logged(client, db, world, caplog):
    caplog.set_level(logging.DEBUG)
    res = pay(client, world["owner"], {"order_code": "PED-1", "method": "contr_entrega", **CARD})
    assert res.status_code == 201
    assert not any(k in res.json() for k in CARD)
    pay_row = db.query(Payment).one()
    haystack = " ".join(
        [str(c.name) + str(getattr(pay_row, c.name)) for c in Payment.__table__.columns]
        + [a.action for a in db.query(AuditLog).all()]
        + [caplog.text, res.text]
    )
    assert "4111111111111111" not in haystack
    assert "4111" not in haystack


def test_legacy_tarjeta_payment_stays_readable(client, db, world):
    db.add(Payment(
        code="TX-9001", order_code="PED-1", merchant_name="m", customer_name="c",
        method="tarjeta", subtotal=1.0, delivery_fee=1.0, commission=0.1, total=2.0,
    ))
    db.commit()
    acct = make_user(db, "ac@t.com", "accountant")
    got = client.get(URL, headers=auth_headers(acct))
    assert got.status_code == 200 and got.json()[0]["method"] == "tarjeta"
    assert client.post(URL, json={"order_code": "PED-1", "method": "tarjeta"}, headers=auth_headers(world["owner"])).status_code == 422


def test_order_read_exposes_the_payment_status(client, db, world):
    before = client.get("/api/v1/orders/PED-1", headers=auth_headers(world["owner"]))
    assert before.json()["payment_status"] is None
    pay(client, world["owner"], {"order_code": "PED-1", "method": "contr_entrega"})
    after = client.get("/api/v1/orders/PED-1", headers=auth_headers(world["owner"]))
    assert after.json()["payment_status"] == "pendiente"
    listed = client.get("/api/v1/orders/", headers=auth_headers(world["owner"])).json()
    assert listed[0]["payment_status"] == "pendiente"


def test_receipt_owner_admin_accountant_ok_others_denied(client, db, world):
    code = pay(client, world["owner"], {"order_code": "PED-1", "method": "contr_entrega"}).json()["code"]
    url = f"{URL}{code}/receipt.pdf"
    ok = client.get(url, headers=auth_headers(world["owner"]))
    assert ok.status_code == 200 and ok.headers["content-type"] == "application/pdf"
    for role in ("admin", "accountant"):
        assert client.get(url, headers=auth_headers(make_user(db, f"{role}@t.com", role))).status_code == 200
    assert client.get(url, headers=auth_headers(world["other"])).status_code == 404
    for role in ("merchant", "courier"):
        assert client.get(url, headers=auth_headers(make_user(db, f"{role}@t.com", role))).status_code == 403
    assert client.get(f"{URL}TX-NOPE/receipt.pdf", headers=auth_headers(world["owner"])).status_code == 404
