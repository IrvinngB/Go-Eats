from pathlib import Path

from app.core.security import verify_password
from tests.factories import DEFAULT_PASSWORD, PASSWORD_HASH, auth_headers, make_user

GOEATS_DB = Path(__file__).resolve().parents[1] / "goeats.db"
_DB_EXISTED_AT_IMPORT = GOEATS_DB.exists()


def test_health_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "Go Eats API"}


def test_precomputed_hash_matches_default_password():
    assert verify_password(DEFAULT_PASSWORD, PASSWORD_HASH) is True
    assert verify_password("wrong-password", PASSWORD_HASH) is False


def test_login_with_factory_user(client, db):
    user = make_user(db, email="cust@test.com", role="customer")
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "cust@test.com", "password": DEFAULT_PASSWORD},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == "cust@test.com"
    assert body["user"]["role"] == "customer"

    bad = client.post(
        "/api/v1/auth/login",
        json={"email": "cust@test.com", "password": "nope-nope"},
    )
    assert bad.status_code == 401
    assert auth_headers(user)["Authorization"].startswith("Bearer ")


def test_no_goeats_db_created(client):
    client.get("/health")
    assert GOEATS_DB.exists() == _DB_EXISTED_AT_IMPORT
    assert GOEATS_DB.exists() is False
