"""Tests for merchant role ownership, catalog RF-13 management, and RF-01 courier guard."""
import pytest
from tests.factories import auth_headers, link_merchant, make_courier, make_merchant, make_order, make_product, make_user, make_zone

API = "/api/v1"


@pytest.fixture
def world(db):
    make_zone(db, slug="san-francisco", name="San Francisco")
    m1_user = make_user(db, email="m1@test.pa", role="merchant", full_name="Merchant One")
    m2_user = make_user(db, email="m2@test.pa", role="merchant", full_name="Merchant Two")
    unlinked_user = make_user(db, email="mu@test.pa", role="merchant", full_name="Merchant Unlinked")
    admin = make_user(db, email="admin@test.pa", role="admin", full_name="Admin")
    customer = make_user(db, email="cust@test.pa", role="customer", full_name="Customer")

    m1 = make_merchant(db, code="M1", name="Tienda Uno", zone_slug="san-francisco")
    m2 = make_merchant(db, code="M2", name="Tienda Dos", zone_slug="san-francisco")
    link_merchant(db, m1, m1_user)
    link_merchant(db, m2, m2_user)
    p1 = make_product(db, code="M1-P1", merchant_code="M1", name="Sancocho", price=8.0, category="Sopas")
    k1 = make_courier(db, code="K1", name="Repartidor Uno", zone_slug="san-francisco", is_available=True)

    return {
        "m1_user": m1_user,
        "m2_user": m2_user,
        "unlinked_user": unlinked_user,
        "admin": admin,
        "customer": customer,
        "m1": m1,
        "m2": m2,
        "p1": p1,
        "k1": k1,
    }


def test_update_schedule_allows_owner_and_admin_but_forbids_other_merchants(client, world):
    # Owner can update schedule and toggle is_open
    res = client.put(
        f"{API}/merchants/M1/schedule",
        json={"opens_at": "08:30", "closes_at": "22:00", "is_open": False},
        headers=auth_headers(world["m1_user"]),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["opens_at"] == "08:30"
    assert body["closes_at"] == "22:00"
    assert body["is_open"] is False

    # Other merchant cannot update M1's schedule
    res_other = client.put(
        f"{API}/merchants/M1/schedule",
        json={"opens_at": "10:00", "closes_at": "12:00", "is_open": True},
        headers=auth_headers(world["m2_user"]),
    )
    assert res_other.status_code == 403

    # Unlinked merchant cannot update M1's schedule
    res_unlinked = client.put(
        f"{API}/merchants/M1/schedule",
        json={"opens_at": "10:00", "closes_at": "12:00"},
        headers=auth_headers(world["unlinked_user"]),
    )
    assert res_unlinked.status_code == 403

    # Admin can update any merchant's schedule
    res_admin = client.put(
        f"{API}/merchants/M1/schedule",
        json={"opens_at": "09:00", "closes_at": "21:00", "is_open": True},
        headers=auth_headers(world["admin"]),
    )
    assert res_admin.status_code == 200
    assert res_admin.json()["is_open"] is True


def test_catalog_create_and_update_enforce_merchant_ownership(client, world):
    payload = {
        "name": "Arroz con Pollo",
        "description": "Tradicional",
        "category": "Platos fuertes",
        "price": 7.5,
        "promo_price": 6.0,
        "is_available": True,
    }

    # Foreign merchant -> 403
    assert (
        client.post(
            f"{API}/catalog/merchants/M1/products",
            json=payload,
            headers=auth_headers(world["m2_user"]),
        ).status_code
        == 403
    )

    # Unlinked merchant -> 403
    assert (
        client.post(
            f"{API}/catalog/merchants/M1/products",
            json=payload,
            headers=auth_headers(world["unlinked_user"]),
        ).status_code
        == 403
    )

    # Owner merchant -> 201
    res = client.post(
        f"{API}/catalog/merchants/M1/products",
        json=payload,
        headers=auth_headers(world["m1_user"]),
    )
    assert res.status_code == 201
    created = res.json()
    assert created["category"] == "Platos fuertes"
    assert created["price"] == 7.5
    assert created["promo_price"] == 6.0

    # Foreign merchant cannot update M1's product
    assert (
        client.put(
            f"{API}/catalog/products/{created['code']}",
            json={"name": "Hackeado"},
            headers=auth_headers(world["m2_user"]),
        ).status_code
        == 403
    )

    # Owner can update and clear promo_price
    res_upd = client.put(
        f"{API}/catalog/products/{created['code']}",
        json={"price": 8.0, "promo_price": None, "category": "Especiales"},
        headers=auth_headers(world["m1_user"]),
    )
    assert res_upd.status_code == 200
    assert res_upd.json()["price"] == 8.0
    assert res_upd.json()["promo_price"] is None
    assert res_upd.json()["category"] == "Especiales"


def test_catalog_validates_promo_price_lower_than_regular_price(client, world):
    # Create with promo_price >= price -> 400 or 422
    res_bad_create = client.post(
        f"{API}/catalog/merchants/M1/products",
        json={"name": "Ceviche", "price": 5.0, "promo_price": 5.0},
        headers=auth_headers(world["m1_user"]),
    )
    assert res_bad_create.status_code in (400, 422)

    # Update existing product with promo_price >= current price (8.0) -> 400 or 422
    res_bad_update = client.put(
        f"{API}/catalog/products/M1-P1",
        json={"promo_price": 8.5},
        headers=auth_headers(world["m1_user"]),
    )
    assert res_bad_update.status_code in (400, 422)


def test_catalog_delete_product_enforces_ownership_and_removes_product(client, world):
    # Foreign merchant cannot delete M1-P1
    assert (
        client.delete(
            f"{API}/catalog/products/M1-P1",
            headers=auth_headers(world["m2_user"]),
        ).status_code
        == 403
    )

    # Owner can delete M1-P1
    res_del = client.delete(
        f"{API}/catalog/products/M1-P1",
        headers=auth_headers(world["m1_user"]),
    )
    assert res_del.status_code == 204

    # Subsequent GET returns 404
    assert client.get(f"{API}/catalog/products/M1-P1").status_code == 404


@pytest.mark.parametrize("bad_status", ["en_camino", "entregado", "cancelado", "rechazado"])
def test_assign_courier_rejects_in_transit_or_terminal_orders(client, db, world, bad_status):
    code = f"PED-{bad_status}"
    make_order(db, code, world["customer"].id, "M1", None, status=bad_status)
    res = client.patch(
        f"{API}/orders/{code}/courier",
        json={"courier_code": "K1"},
        headers=auth_headers(world["m1_user"]),
    )
    assert res.status_code == 400
