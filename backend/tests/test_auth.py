import pytest

from app.core.config import settings
from app.core.security import create_refresh_token
from tests.factories import DEFAULT_PASSWORD, auth_headers, make_user

LOGIN = "/api/v1/auth/login"
REGISTER = "/api/v1/auth/register"
REFRESH = "/api/v1/auth/refresh"


def _login(client, email, **extra):
    return client.post(LOGIN, json={"email": email, "password": DEFAULT_PASSWORD, **extra})


def _register_body(**extra):
    return {
        "full_name": "New Person",
        "email": "new@test.com",
        "phone": "6000-0000",
        "password": "secret123",
        "accepts_privacy_policy": True,
        **extra,
    }


def test_login_ignores_role_flag_off(client, db):
    make_user(db, email="c@test.com", role="customer")
    res = _login(client, "c@test.com", role="admin")
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["role"] == "customer"
    # token is rejected by an admin-only endpoint
    admin_only = client.get(
        "/api/v1/users/", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert admin_only.status_code in (401, 403)
    assert admin_only.status_code != 200


def test_login_without_role_uses_stored_role(client, db):
    make_user(db, email="m@test.com", role="merchant")
    assert _login(client, "m@test.com").json()["user"]["role"] == "merchant"


def test_login_honors_role_flag_on(client, db, monkeypatch):
    make_user(db, email="c@test.com", role="customer")
    monkeypatch.setattr(settings, "dev_role_override", True)
    res = _login(client, "c@test.com", role="admin")
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "admin"


def test_request_cannot_enable_flag(client, db):
    make_user(db, email="c@test.com", role="customer")
    res = client.post(
        LOGIN + "?dev_role_override=true",
        json={
            "email": "c@test.com",
            "password": DEFAULT_PASSWORD,
            "role": "admin",
            "dev_role_override": True,
        },
        headers={"X-Dev-Role-Override": "true"},
    )
    assert res.json()["user"]["role"] == "customer"


def test_flags_default_off():
    assert settings.dev_role_override is False
    assert settings.dev_simulate_failure is False


@pytest.mark.parametrize(
    "raw,expected",
    [("1", True), ("true", True), ("YES", True), ("0", False), ("", False), ("on", False), (None, False)],
)
def test_flag_parsing(raw, expected):
    from app.core.config import env_flag

    assert env_flag(raw) is expected


def test_register_role_admin_becomes_customer(client):
    res = client.post(REGISTER, json=_register_body(role="admin"))
    assert res.status_code in (200, 201)
    body = res.json()
    assert body["user"]["role"] == "customer"
    probe = client.get("/api/v1/users/", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert probe.status_code == 403


def test_register_requires_consent_field(client):
    body = _register_body()
    del body["accepts_privacy_policy"]
    assert client.post(REGISTER, json=body).status_code == 422


def test_register_consent_false_rejected(client):
    res = client.post(REGISTER, json=_register_body(accepts_privacy_policy=False))
    assert res.status_code == 400


def test_refresh_uses_db_role(client, db):
    user = make_user(db, email="r@test.com", role="customer")
    token = create_refresh_token(str(user.id), "admin")  # forged/stale claim
    res = client.post(REFRESH, json={"refresh_token": token})
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "customer"
    probe = client.get(
        "/api/v1/users/", headers={"Authorization": f"Bearer {res.json()['access_token']}"}
    )
    assert probe.status_code == 403


def test_refresh_picks_up_role_changed_after_issue(client, db):
    user = make_user(db, email="r@test.com", role="customer")
    token = _login(client, "r@test.com").json()["refresh_token"]
    user.role = "merchant"
    db.commit()
    res = client.post(REFRESH, json={"refresh_token": token})
    assert res.json()["user"]["role"] == "merchant"


def test_refresh_suspended_user_rejected(client, db):
    user = make_user(db, email="r@test.com")
    token = _login(client, "r@test.com").json()["refresh_token"]
    user.is_active = False
    db.commit()
    assert client.post(REFRESH, json={"refresh_token": token}).status_code == 401
