"""Tests for accountant role financial summary, payment reconciliation, and receipts (RF-11, RF-12)."""
import pytest
from tests.factories import auth_headers, make_merchant, make_order, make_user, make_zone

API = "/api/v1"


@pytest.fixture
def world(db):
    make_zone(db, slug="san-francisco", name="San Francisco", delivery_fee=2.0)
    make_merchant(db, code="M1", name="Fonda Uno", zone_slug="san-francisco")
    customer = make_user(db, email="cust@test.pa", role="customer", full_name="Carlos Cliente")
    accountant = make_user(db, email="acct@test.pa", role="accountant", full_name="Marta Contabilidad")
    merchant = make_user(db, email="merch@test.pa", role="merchant", full_name="Hector Comercio")

    o1 = make_order(db, "PED-101", customer.id, "M1", status="pendiente")
    o2 = make_order(db, "PED-102", customer.id, "M1", status="pendiente")
    o2.payment_method = "yappy"
    db.commit()

    return {
        "customer": customer,
        "accountant": accountant,
        "merchant": merchant,
        "o1": o1,
        "o2": o2,
    }


def test_accountant_reconciles_payments_validates_status_and_queries_financial_summary(client, world):
    # Customer creates 1 cash payment (pendiente) and 1 electronic payment (pagado)
    p_cash = client.post(
        f"{API}/payments/",
        json={"order_code": "PED-101", "method": "contr_entrega"},
        headers=auth_headers(world["customer"]),
    ).json()
    p_elec = client.post(
        f"{API}/payments/",
        json={"order_code": "PED-102", "method": "yappy"},
        headers=auth_headers(world["customer"]),
    ).json()

    assert p_cash["status"] == "pendiente"
    assert p_elec["status"] == "pagado"

    # Financial summary before reconciliation: 1 paid (11.5), 1 pending (11.5), commissions on both non-failed (1.2 + 1.2 = 2.4)
    fin1 = client.get(f"{API}/reports/financial", headers=auth_headers(world["accountant"]))
    assert fin1.status_code == 200
    assert fin1.json() == {
        "total_transactions": 2,
        "paid_total": 11.5,
        "pending_total": 11.5,
        "total_commissions": 2.4,
    }

    # Invalid status string rejected with 422
    res_invalid = client.patch(
        f"{API}/payments/{p_cash['code']}/status",
        json={"status": "invalido"},
        headers=auth_headers(world["accountant"]),
    )
    assert res_invalid.status_code == 422

    # Non-accountant/non-admin rejected with 403
    assert (
        client.patch(
            f"{API}/payments/{p_cash['code']}/status",
            json={"status": "pagado"},
            headers=auth_headers(world["merchant"]),
        ).status_code
        == 403
    )

    # Accountant reconciles cash payment to pagado -> financial summary updates
    res_rec = client.patch(
        f"{API}/payments/{p_cash['code']}/status",
        json={"status": "pagado"},
        headers=auth_headers(world["accountant"]),
    )
    assert res_rec.status_code == 200
    assert res_rec.json()["status"] == "pagado"

    fin2 = client.get(f"{API}/reports/financial", headers=auth_headers(world["accountant"])).json()
    assert fin2["paid_total"] == 23.0
    assert fin2["pending_total"] == 0.0

    # Accountant downloads receipt PDF (RF-12)
    pdf = client.get(
        f"{API}/payments/{p_cash['code']}/receipt.pdf",
        headers=auth_headers(world["accountant"]),
    )
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF")
