import pytest

from app.domains.orders.models import Order
from app.domains.reports.repository import ReportRepository
from tests.factories import make_order, make_user


def _set_total(db, code, total):
    db.query(Order).filter_by(code=code).update({"total": total})
    db.commit()


@pytest.fixture()
def orders(db):
    cust = make_user(db, "c@t.com", "customer")
    for i, (status, total) in enumerate(
        [("entregado", 10.0), ("en_camino", 5.0), ("rechazado", 100.0), ("cancelado", 1000.0)], 1
    ):
        make_order(db, f"PED-{i}", cust.id, status=status)
        _set_total(db, f"PED-{i}", total)


def test_reports_revenue_excludes_rechazado(db, orders):
    assert ReportRepository(db).sum_revenue() == 15.0


def test_revenue_excludes_cancelado_and_rechazado_only(db, orders):
    make_order(db, "PED-9", make_user(db, "d@t.com", "customer").id, status="pendiente")
    _set_total(db, "PED-9", 2.5)
    assert ReportRepository(db).sum_revenue() == 17.5


def test_revenue_via_endpoint(client, db, orders):
    from tests.factories import auth_headers

    admin = make_user(db, "ad@t.com", "admin")
    resp = client.get("/api/v1/reports/kpis", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert resp.json()["total_revenue"] == 15.0
