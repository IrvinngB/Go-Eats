import pytest

from tests.factories import (
    auth_headers,
    link_courier,
    link_merchant,
    make_courier,
    make_merchant,
    make_order,
    make_user,
)


@pytest.fixture()
def world(db):
    cust_a = make_user(db, "a@t.com", "customer")
    cust_b = make_user(db, "b@t.com", "customer")
    m1_user = make_user(db, "m1@t.com", "merchant")
    m2_user = make_user(db, "m2@t.com", "merchant")
    m_unlinked = make_user(db, "mu@t.com", "merchant")
    k1_user = make_user(db, "k1@t.com", "courier")
    k_unlinked = make_user(db, "ku@t.com", "courier")
    admin = make_user(db, "ad@t.com", "admin")
    acct = make_user(db, "ac@t.com", "accountant")
    m1 = make_merchant(db, "M1", "Uno")
    m2 = make_merchant(db, "M2", "Dos")
    k1 = make_courier(db, "K1")
    k2 = make_courier(db, "K2")
    link_merchant(db, m1, m1_user)
    link_merchant(db, m2, m2_user)
    link_courier(db, k1, k1_user)
    make_order(db, "PED-1", cust_a.id, "M1", "K1")
    make_order(db, "PED-2", cust_a.id, "M2", "K2")
    make_order(db, "PED-3", cust_b.id, "M1", None)
    make_order(db, "PED-4", cust_b.id, "M2", "K1")
    return dict(
        a=cust_a, b=cust_b, m1=m1_user, mu=m_unlinked, k1=k1_user, ku=k_unlinked,
        admin=admin, acct=acct,
    )


def codes(resp):
    assert resp.status_code == 200
    return sorted(o["code"] for o in resp.json())


def test_anonymous_list_401(client, world):
    assert client.get("/api/v1/orders/").status_code == 401


@pytest.mark.parametrize(
    "who,expected",
    [
        ("a", ["PED-1", "PED-2"]),
        ("b", ["PED-3", "PED-4"]),
        ("m1", ["PED-1", "PED-3"]),
        ("mu", []),
        ("k1", ["PED-1", "PED-4"]),
        ("ku", []),
        ("admin", ["PED-1", "PED-2", "PED-3", "PED-4"]),
        ("acct", ["PED-1", "PED-2", "PED-3", "PED-4"]),
    ],
)
def test_list_scope_per_role(client, world, who, expected):
    assert codes(client.get("/api/v1/orders/", headers=auth_headers(world[who]))) == expected


def test_query_params_cannot_widen_customer_scope(client, world):
    h = auth_headers(world["a"])
    assert codes(client.get("/api/v1/orders/?merchant_code=M1", headers=h)) == ["PED-1"]
    assert codes(client.get("/api/v1/orders/?courier_code=K1", headers=h)) == ["PED-1"]
    assert codes(client.get("/api/v1/orders/?merchant_code=M2&courier_code=K1", headers=h)) == []


def test_query_params_cannot_widen_merchant_or_courier_scope(client, world):
    assert codes(client.get("/api/v1/orders/?merchant_code=M2", headers=auth_headers(world["m1"]))) == []
    assert codes(client.get("/api/v1/orders/?courier_code=K2", headers=auth_headers(world["k1"]))) == []


def test_admin_query_params_still_filter(client, world):
    h = auth_headers(world["admin"])
    assert codes(client.get("/api/v1/orders/?merchant_code=M2", headers=h)) == ["PED-2", "PED-4"]
    assert codes(client.get("/api/v1/orders/?courier_code=K1", headers=h)) == ["PED-1", "PED-4"]


def test_get_order_anonymous_401(client, world):
    assert client.get("/api/v1/orders/PED-1").status_code == 401


@pytest.mark.parametrize(
    "who,code,status",
    [
        ("a", "PED-1", 200),
        ("a", "PED-3", 404),
        ("m1", "PED-1", 200),
        ("m1", "PED-2", 404),
        ("mu", "PED-1", 404),
        ("k1", "PED-4", 200),
        ("k1", "PED-2", 404),
        ("ku", "PED-1", 404),
        ("admin", "PED-3", 200),
        ("acct", "PED-2", 200),
        ("admin", "PED-999", 404),
    ],
)
def test_get_order_scope(client, world, who, code, status):
    assert client.get(f"/api/v1/orders/{code}", headers=auth_headers(world[who])).status_code == status
