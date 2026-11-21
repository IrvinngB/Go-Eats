import pytest

from tests.factories import (
    auth_headers,
    link_courier,
    link_merchant,
    make_courier,
    make_merchant,
    make_user,
)

API = "/api/v1"
ROLES = ["customer", "merchant", "courier", "accountant", "admin"]


@pytest.fixture()
def users(db):
    return {r: make_user(db, f"{r}@t.com", r) for r in ROLES}


def test_merchants_mine_returns_linked(client, db, users):
    m = make_merchant(db, "M1", "Uno")
    make_merchant(db, "M2", "Dos")
    link_merchant(db, m, users["merchant"])
    res = client.get(f"{API}/merchants/mine", headers=auth_headers(users["merchant"]))
    assert res.status_code == 200
    assert res.json()["code"] == "M1"
    assert "owner_user_id" not in res.json()


def test_merchants_mine_unlinked_404(client, db, users):
    make_merchant(db, "M1")
    res = client.get(f"{API}/merchants/mine", headers=auth_headers(users["merchant"]))
    assert res.status_code == 404
    assert res.json()["detail"] == "no_linked_entity"


@pytest.mark.parametrize("role", ["customer", "courier", "accountant", "admin"])
def test_merchants_mine_other_roles_403(client, users, role):
    assert client.get(f"{API}/merchants/mine", headers=auth_headers(users[role])).status_code == 403


def test_merchants_mine_anonymous_401(client):
    assert client.get(f"{API}/merchants/mine").status_code == 401


def test_merchants_code_route_still_works(client, db):
    make_merchant(db, "M1", "Uno")
    assert client.get(f"{API}/merchants/M1").json()["name"] == "Uno"


def test_courier_me_returns_linked(client, db, users):
    k = make_courier(db, "K1", "Uno")
    make_courier(db, "K2", "Dos")
    link_courier(db, k, users["courier"])
    res = client.get(f"{API}/delivery/couriers/me", headers=auth_headers(users["courier"]))
    assert res.status_code == 200
    assert res.json()["code"] == "K1"
    assert "user_id" not in res.json()


def test_courier_me_unlinked_404(client, db, users):
    make_courier(db, "K1")
    res = client.get(f"{API}/delivery/couriers/me", headers=auth_headers(users["courier"]))
    assert res.status_code == 404
    assert res.json()["detail"] == "no_linked_entity"


@pytest.mark.parametrize("role", ["customer", "merchant", "accountant", "admin"])
def test_courier_me_other_roles_403(client, users, role):
    assert client.get(f"{API}/delivery/couriers/me", headers=auth_headers(users[role])).status_code == 403


def test_courier_me_anonymous_401(client):
    assert client.get(f"{API}/delivery/couriers/me").status_code == 401


LOCKS = [
    ("/payments/", {"accountant", "admin"}),
    ("/users/arco", {"admin"}),
    ("/reports/kpis", {"accountant", "admin"}),
    ("/reports/financial", {"accountant", "admin"}),
    ("/reports/audit-logs", {"accountant", "admin"}),
]


@pytest.mark.parametrize("path,allowed", LOCKS)
def test_lock_anonymous_401(client, path, allowed):
    assert client.get(f"{API}{path}").status_code == 401


@pytest.mark.parametrize("role", ROLES)
@pytest.mark.parametrize("path,allowed", LOCKS)
def test_lock_per_role(client, users, path, allowed, role):
    res = client.get(f"{API}{path}", headers=auth_headers(users[role]))
    assert res.status_code == (200 if role in allowed else 403)
