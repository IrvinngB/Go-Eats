"""Tests for courier role ownership and availability constraints (RF-02)."""
import pytest
from tests.factories import auth_headers, link_courier, make_courier, make_user, make_zone

API = "/api/v1"


@pytest.fixture
def world(db):
    make_zone(db, slug="san-francisco", name="San Francisco")
    c1_user = make_user(db, email="c1@test.pa", role="courier", full_name="Courier One")
    c2_user = make_user(db, email="c2@test.pa", role="courier", full_name="Courier Two")
    unlinked_user = make_user(db, email="cu@test.pa", role="courier", full_name="Courier Unlinked")
    admin = make_user(db, email="admin@test.pa", role="admin", full_name="Admin")

    k1 = make_courier(db, code="K1", name="Repartidor Uno", zone_slug="san-francisco", is_available=True)
    k2 = make_courier(db, code="K2", name="Repartidor Dos", zone_slug="san-francisco", is_available=True)
    link_courier(db, k1, c1_user)
    link_courier(db, k2, c2_user)

    return {
        "c1_user": c1_user,
        "c2_user": c2_user,
        "unlinked_user": unlinked_user,
        "admin": admin,
        "k1": k1,
        "k2": k2,
    }


def test_update_availability_enforces_courier_ownership_and_allows_admin(client, world):
    # Own courier can toggle offline and back online
    res = client.patch(
        f"{API}/delivery/couriers/K1/availability",
        json={"is_available": False},
        headers=auth_headers(world["c1_user"]),
    )
    assert res.status_code == 200
    assert res.json()["is_available"] is False

    # Foreign courier -> 403
    assert (
        client.patch(
            f"{API}/delivery/couriers/K1/availability",
            json={"is_available": True},
            headers=auth_headers(world["c2_user"]),
        ).status_code
        == 403
    )

    # Unlinked courier -> 403
    assert (
        client.patch(
            f"{API}/delivery/couriers/K1/availability",
            json={"is_available": True},
            headers=auth_headers(world["unlinked_user"]),
        ).status_code
        == 403
    )

    # Admin can update any courier's availability
    res_admin = client.patch(
        f"{API}/delivery/couriers/K1/availability",
        json={"is_available": True},
        headers=auth_headers(world["admin"]),
    )
    assert res_admin.status_code == 200
    assert res_admin.json()["is_available"] is True


def test_suspended_courier_cannot_enable_availability(client, world):
    # Suspend K1 as admin
    res_susp = client.patch(
        f"{API}/delivery/couriers/K1/affiliation",
        json={"affiliation_status": "suspendido"},
        headers=auth_headers(world["admin"]),
    )
    assert res_susp.status_code == 200
    assert res_susp.json()["is_available"] is False

    # Suspended courier cannot turn availability back on
    res_on = client.patch(
        f"{API}/delivery/couriers/K1/availability",
        json={"is_available": True},
        headers=auth_headers(world["c1_user"]),
    )
    assert res_on.status_code == 400
