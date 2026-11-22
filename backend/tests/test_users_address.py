"""Profile delivery address: PUT /users/me address/lat/lng (improve-customer-checkout A1)."""
import pytest

from tests.factories import auth_headers, make_user

ME = "/api/v1/users/me"
LIST = "/api/v1/users/"


@pytest.fixture()
def people(db):
    return dict(
        ana=make_user(db, "ana@t.com", "customer", address="Calle Vieja 1", lat=8.9, lng=-79.5),
        bob=make_user(db, "bob@t.com", "customer", address="Casa de Bob", lat=9.0, lng=-79.6),
        admin=make_user(db, "ad@t.com", "admin"),
    )


def put(client, user, body):
    return client.put(ME, json=body, headers=auth_headers(user))


def test_saves_address_and_coords(client, people):
    res = put(client, people["ana"], {"address": "Vía España 123", "lat": 8.98, "lng": -79.52})
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body["address"], body["lat"], body["lng"]) == ("Vía España 123", 8.98, -79.52)
    got = client.get(ME, headers=auth_headers(people["ana"])).json()
    assert (got["address"], got["lat"], got["lng"]) == ("Vía España 123", 8.98, -79.52)


def test_omitted_fields_are_left_untouched(client, people):
    res = put(client, people["ana"], {"phone": "6000-0000"})
    assert res.status_code == 200
    body = res.json()
    assert (body["address"], body["lat"], body["lng"]) == ("Calle Vieja 1", 8.9, -79.5)
    assert body["phone"] == "6000-0000"


@pytest.mark.parametrize(
    "body",
    [
        {"lat": 91, "lng": -79.5},
        {"lat": -90.5, "lng": -79.5},
        {"lat": 8.9, "lng": 181},
        {"lat": 8.9, "lng": -180.1},
        {"lat": 8.9},
        {"lng": -79.5},
        {"lat": 8.9, "lng": None},
        {"address": "abc"},
        {"address": "x" * 301},
    ],
)
def test_invalid_payloads_are_422_and_change_nothing(client, people, body):
    res = put(client, people["ana"], body)
    assert res.status_code == 422, res.text
    got = client.get(ME, headers=auth_headers(people["ana"])).json()
    assert (got["address"], got["lat"], got["lng"]) == ("Calle Vieja 1", 8.9, -79.5)


@pytest.mark.parametrize("token", ["NaN", "Infinity", "-Infinity"])
def test_non_finite_coords_are_422(client, people, token):
    res = client.put(
        ME,
        content=f'{{"lat": {token}, "lng": -79.5}}',
        headers={**auth_headers(people["ana"]), "Content-Type": "application/json"},
    )
    assert res.status_code == 422, res.text


def test_boundary_coords_are_accepted(client, people):
    res = put(client, people["ana"], {"lat": -90, "lng": 180})
    assert res.status_code == 200, res.text
    assert (res.json()["lat"], res.json()["lng"]) == (-90, 180)


def test_explicit_null_clears_address_and_coords(client, people):
    res = put(client, people["ana"], {"address": None, "lat": None, "lng": None})
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body["address"], body["lat"], body["lng"]) == (None, None, None)


def test_clearing_coords_only_keeps_address(client, people):
    res = put(client, people["ana"], {"lat": None, "lng": None})
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body["address"], body["lat"], body["lng"]) == ("Calle Vieja 1", None, None)


def test_update_only_touches_the_caller(client, people):
    put(client, people["ana"], {"address": "Nueva dirección", "lat": 1.0, "lng": 2.0})
    bob = client.get(ME, headers=auth_headers(people["bob"])).json()
    assert (bob["address"], bob["lat"], bob["lng"]) == ("Casa de Bob", 9.0, -79.6)


def test_anonymous_is_401(client):
    assert client.put(ME, json={"address": "Calle 12345"}).status_code == 401


def test_admin_list_omits_address_and_coords(client, people):
    res = client.get(LIST, headers=auth_headers(people["admin"]))
    assert res.status_code == 200
    rows = res.json()
    assert len(rows) == 3
    for row in rows:
        assert not {"address", "lat", "lng"} & set(row)
        assert "email" in row


def test_login_returns_only_the_callers_own_saved_address(client, people):
    from tests.factories import DEFAULT_PASSWORD

    res = client.post("/api/v1/auth/login", json={"email": "ana@t.com", "password": DEFAULT_PASSWORD})
    assert res.status_code == 200, res.text
    user = res.json()["user"]
    assert (user["address"], user["lat"], user["lng"]) == ("Calle Vieja 1", 8.9, -79.5)
