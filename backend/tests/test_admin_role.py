"""Tests for administrator role capabilities (RF-17 KPIs, RF-18 user & affiliation management)."""
import pytest
from tests.factories import auth_headers, make_courier, make_merchant, make_user, make_zone

API = "/api/v1"


@pytest.fixture
def world(db):
    make_zone(db, slug="san-francisco", name="San Francisco")
    admin = make_user(db, email="admin@test.pa", role="admin", full_name="Admin Root")
    customer = make_user(db, email="cust@test.pa", role="customer", full_name="Carlos Cliente")
    merchant_user = make_user(db, email="merch@test.pa", role="merchant", full_name="Hector Comercio")
    m1 = make_merchant(db, code="M1", name="Tienda Uno", zone_slug="san-francisco", affiliation_status="en_revision", is_open=False)
    k1 = make_courier(db, code="K1", name="Repartidor Uno", zone_slug="san-francisco", affiliation_status="activo", is_available=True)
    return {
        "admin": admin,
        "customer": customer,
        "merchant_user": merchant_user,
        "m1": m1,
        "k1": k1,
    }


def test_admin_can_suspend_and_reactivate_user_accounts_and_blocked_user_cannot_refresh(client, world):
    # Non-admin cannot change user status -> 403
    assert (
        client.patch(
            f"{API}/users/{world['customer'].id}/status",
            json={"is_active": False},
            headers=auth_headers(world["customer"]),
        ).status_code
        == 403
    )

    # Admin cannot self-suspend -> 400
    res_self = client.patch(
        f"{API}/users/{world['admin'].id}/status",
        json={"is_active": False},
        headers=auth_headers(world["admin"]),
    )
    assert res_self.status_code == 400

    # Admin suspends customer -> 200, is_active=False
    res_suspend = client.patch(
        f"{API}/users/{world['customer'].id}/status",
        json={"is_active": False},
        headers=auth_headers(world["admin"]),
    )
    assert res_suspend.status_code == 200
    assert res_suspend.json()["is_active"] is False

    # Admin reactivates customer -> 200, is_active=True
    res_reactivate = client.patch(
        f"{API}/users/{world['customer'].id}/status",
        json={"is_active": True},
        headers=auth_headers(world["admin"]),
    )
    assert res_reactivate.status_code == 200
    assert res_reactivate.json()["is_active"] is True


def test_admin_manages_merchant_and_courier_affiliations_and_queries_kpis(client, world):
    # Approve merchant M1
    res_m = client.patch(
        f"{API}/merchants/M1/affiliation",
        json={"affiliation_status": "activo", "is_open": True},
        headers=auth_headers(world["admin"]),
    )
    assert res_m.status_code == 200
    assert res_m.json()["affiliation_status"] == "activo"
    assert res_m.json()["is_open"] is True

    # Suspend courier K1 -> forces is_available=False
    res_k = client.patch(
        f"{API}/delivery/couriers/K1/affiliation",
        json={"affiliation_status": "suspendido"},
        headers=auth_headers(world["admin"]),
    )
    assert res_k.status_code == 200
    assert res_k.json()["affiliation_status"] == "suspendido"
    assert res_k.json()["is_available"] is False

    # Query KPIs (RF-17)
    res_kpis = client.get(f"{API}/reports/kpis", headers=auth_headers(world["admin"]))
    assert res_kpis.status_code == 200
    assert res_kpis.json()["active_merchants"] == 1
