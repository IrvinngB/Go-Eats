"""Order delivery coordinates: optional, validated, frozen snapshot (improve-customer-checkout A1)."""
import pytest
from sqlalchemy import select

from app.domains.orders.models import Order
from tests.factories import auth_headers, make_merchant, make_order, make_product, make_user, make_zone

URL = "/api/v1/orders/"
PAYLOAD = {
    "merchant_code": "M1",
    "zone_slug": "zona-test",
    "delivery_address": "Calle 45, Apto 2B",
    "payment_method": "contr_entrega",
    "items": [{"product_code": "P1", "quantity": 1}],
}


@pytest.fixture()
def shop(db):
    zone = make_zone(db, "zona-test", delivery_fee=2.5, distance_km=3.0)
    make_merchant(db, "M1", "Comercio Real", zone_slug=zone.slug)
    make_product(db, "P1", "M1", "Plato Real", price=5.0)
    return make_user(db, "ana@t.com", "customer", address="Casa", lat=8.0, lng=-79.0)


def post(client, user, **extra):
    return client.post(URL, json={**PAYLOAD, **extra}, headers=auth_headers(user))


def test_valid_coords_are_stored_and_exposed(client, shop):
    res = post(client, shop, delivery_lat=8.9824, delivery_lng=-79.5199)
    assert res.status_code == 201, res.text
    body = res.json()
    assert (body["delivery_lat"], body["delivery_lng"]) == (8.9824, -79.5199)
    got = client.get(f"{URL}{body['code']}", headers=auth_headers(shop)).json()
    assert (got["delivery_lat"], got["delivery_lng"]) == (8.9824, -79.5199)


def test_without_coords_they_are_null_not_copied_from_profile(client, shop):
    res = post(client, shop)
    assert res.status_code == 201, res.text
    assert (res.json()["delivery_lat"], res.json()["delivery_lng"]) == (None, None)


@pytest.mark.parametrize(
    "extra",
    [
        {"delivery_lat": 8.9},
        {"delivery_lng": -79.5},
        {"delivery_lat": 8.9, "delivery_lng": None},
        {"delivery_lat": 90.1, "delivery_lng": -79.5},
        {"delivery_lat": 8.9, "delivery_lng": -180.5},
    ],
)
def test_half_or_out_of_range_coords_are_422_and_create_nothing(client, db, shop, extra):
    res = post(client, shop, **extra)
    assert res.status_code == 422, res.text
    assert db.scalars(select(Order)).all() == []


def test_non_finite_coords_are_422(client, shop):
    res = client.post(
        URL,
        content=(
            '{"merchant_code":"M1","zone_slug":"zona-test","delivery_address":"Calle 45",'
            '"payment_method":"contr_entrega","items":[{"product_code":"P1","quantity":1}],'
            '"delivery_lat":NaN,"delivery_lng":Infinity}'
        ),
        headers={**auth_headers(shop), "Content-Type": "application/json"},
    )
    assert res.status_code == 422, res.text


def test_profile_change_after_order_never_alters_the_order(client, shop):
    code = post(client, shop, delivery_lat=8.9, delivery_lng=-79.5).json()["code"]
    res = client.put(
        "/api/v1/users/me",
        json={"address": "Otra dirección", "lat": 1.0, "lng": 2.0},
        headers=auth_headers(shop),
    )
    assert res.status_code == 200
    order = client.get(f"{URL}{code}", headers=auth_headers(shop)).json()
    assert (order["delivery_address"], order["delivery_lat"], order["delivery_lng"]) == (
        "Calle 45, Apto 2B",
        8.9,
        -79.5,
    )


def test_factory_order_carries_coords(db, shop):
    make_order(db, "PED-9", shop.id, delivery_lat=9.1, delivery_lng=-79.4)
    order = db.scalars(select(Order).where(Order.code == "PED-9")).one()
    assert (order.delivery_lat, order.delivery_lng) == (9.1, -79.4)
