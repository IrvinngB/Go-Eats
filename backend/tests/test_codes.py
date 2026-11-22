"""PR6: collision-free PED-/TX- code generation with bounded retry."""
import pytest

from app import seed
from app.domains.orders.models import Order
from app.domains.payments.models import Payment, Receipt
from app.domains.payments.repository import PaymentRepository
from app.shared import codes
from tests.factories import (
    auth_headers,
    make_merchant,
    make_order,
    make_product,
    make_user,
    make_zone,
)

URL = "/api/v1/orders/"


@pytest.fixture()
def shop(db):
    customer = make_user(db, "ana@t.com", "customer")
    make_zone(db)
    make_merchant(db, "M1", "Uno", zone_slug="zona-test")
    make_product(db, "P1", "M1", price=5.0)
    return customer


def place(client, customer):
    return client.post(
        URL,
        json={
            "merchant_code": "M1",
            "zone_slug": "zona-test",
            "delivery_address": "Calle 45",
            "payment_method": "contr_entrega",
            "items": [{"product_code": "P1", "quantity": 1}],
        },
        headers=auth_headers(customer),
    )


def test_first_order_is_1001_on_empty_db(client, shop):
    assert place(client, shop).json()["code"] == "PED-1001"


def test_first_order_after_seed_is_ped_1100(client, db_engine):
    from sqlalchemy.orm import sessionmaker

    s = sessionmaker(bind=db_engine)()
    seed.seed_initial_data(s)
    customer = s.query(Order).first().customer_id
    s.close()
    from app.core.security import create_access_token

    token = create_access_token(str(customer), "customer")
    # product and merchant of the seed: pick an open, active merchant with an available product
    s = sessionmaker(bind=db_engine)()
    from app.domains.catalog.models import Product
    from app.domains.merchants.models import Merchant

    m = s.query(Merchant).filter_by(affiliation_status="activo", is_open=True).first()
    p = s.query(Product).filter_by(merchant_code=m.code, is_available=True).first()
    s.close()
    res = client.post(
        URL,
        json={
            "merchant_code": m.code,
            "zone_slug": m.zone_slug,
            "delivery_address": "Calle 45",
            "payment_method": "contr_entrega",
            "items": [{"product_code": p.code, "quantity": 1}],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201, res.text
    assert res.json()["code"] == "PED-1100"


def test_code_after_gaps_and_deletions_never_reuses_max(client, db, shop):
    make_order(db, "PED-1005", shop.id)
    make_order(db, "PED-1003", shop.id)
    assert place(client, shop).json()["code"] == "PED-1006"


def test_non_numeric_suffixes_are_ignored(client, db, shop):
    make_order(db, "PED-LEGACY", shop.id)
    make_order(db, "PED-1010", shop.id)
    assert place(client, shop).json()["code"] == "PED-1011"


def test_collision_is_retried_and_succeeds(client, db, shop, monkeypatch):
    make_order(db, "PED-1001", shop.id)
    real = codes.next_code
    calls = []

    def flaky(db_, column, prefix, floor):
        calls.append(prefix)
        if len(calls) == 1:
            return "PED-1001"  # already taken: the insert hits the unique index
        return real(db_, column, prefix, floor)

    monkeypatch.setattr(codes, "next_code", flaky)
    res = place(client, shop)
    assert res.status_code == 201, res.text
    assert res.json()["code"] == "PED-1002"
    assert len(calls) == 2


def test_collision_exhausting_retries_is_503_not_500(client, db, shop, monkeypatch):
    make_order(db, "PED-1001", shop.id)
    monkeypatch.setattr(codes, "next_code", lambda *a, **k: "PED-1001")
    res = place(client, shop)
    assert res.status_code == 503
    assert db.query(Order).count() == 1


def test_payment_code_is_max_plus_one_and_matches_receipt(db):
    for n in (9001, 9002, 9060):
        db.add(
            Payment(
                code=f"TX-{n}", order_code="PED-1", merchant_name="m", customer_name="c",
                method="tarjeta", subtotal=1.0, delivery_fee=1.0, commission=0.1, total=2.0,
            )
        )
    db.commit()
    pay = PaymentRepository(db).create(
        "PED-1", "m", "c", "yappy", 10.0, 1.0, "pagado", "YPY-1", "actor"
    )
    assert pay.code == "TX-9061"
    assert db.query(Receipt).one().receipt_number == "REC-9061"


def test_payment_code_floor_on_empty_table(db):
    pay = PaymentRepository(db).create("PED-1", "m", "c", "yappy", 1.0, 1.0, "pagado", "r", "a")
    assert pay.code == "TX-9001"


def test_payment_collision_is_retried(db, monkeypatch):
    repo = PaymentRepository(db)
    repo.create("PED-1", "m", "c", "yappy", 1.0, 1.0, "pagado", "r", "a")
    real = codes.next_code
    calls = []

    def flaky(db_, column, prefix, floor):
        calls.append(prefix)
        return "TX-9001" if len(calls) == 1 else real(db_, column, prefix, floor)

    monkeypatch.setattr(codes, "next_code", flaky)
    pay = repo.create("PED-2", "m", "c", "yappy", 1.0, 1.0, "pagado", "r", "a")
    assert pay.code == "TX-9002"
    assert len(calls) == 2
