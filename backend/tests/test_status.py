import pytest

from app.domains.orders.models import Order, OrderStatusHistory
from tests.factories import (
    auth_headers,
    link_courier,
    link_merchant,
    make_courier,
    make_merchant,
    make_order,
    make_user,
)

CANONICAL = [
    "pendiente",
    "confirmado",
    "en_preparacion",
    "listo_para_recoger",
    "en_camino",
    "entregado",
    "rechazado",
    "cancelado",
]
CHAIN = CANONICAL[:6]
TERMINAL = {"entregado", "rechazado", "cancelado"}
REASON_TARGETS = {"rechazado", "cancelado"}


def is_allowed(current: str, target: str) -> bool:
    """Independent statement of section 3.3 of the architecture document."""
    if current in TERMINAL:
        return False
    if target in REASON_TARGETS:
        return True
    return CHAIN.index(target) == CHAIN.index(current) + 1 if target in CHAIN else False


def url(code: str) -> str:
    return f"/api/v1/orders/{code}/status"


@pytest.fixture()
def world(db):
    cust_a = make_user(db, "a@t.com", "customer")
    cust_b = make_user(db, "b@t.com", "customer")
    m1_user = make_user(db, "m1@t.com", "merchant")
    m2_user = make_user(db, "m2@t.com", "merchant")
    m_unlinked = make_user(db, "mu@t.com", "merchant")
    k1_user = make_user(db, "k1@t.com", "courier")
    k2_user = make_user(db, "k2@t.com", "courier")
    admin = make_user(db, "ad@t.com", "admin")
    acct = make_user(db, "ac@t.com", "accountant")
    link_merchant(db, make_merchant(db, "M1", "Uno"), m1_user)
    link_merchant(db, make_merchant(db, "M2", "Dos"), m2_user)
    link_courier(db, make_courier(db, "K1"), k1_user)
    link_courier(db, make_courier(db, "K2"), k2_user)
    make_courier(db, "KX", is_available=False)
    make_courier(db, "KS", affiliation_status="suspendido")
    return dict(
        a=cust_a, b=cust_b, m1=m1_user, m2=m2_user, mu=m_unlinked, k1=k1_user, k2=k2_user,
        admin=admin, acct=acct,
    )


def patch_status(client, user, code, status, reason=None):
    body = {"status": status}
    if reason is not None:
        body["reason"] = reason
    return client.patch(url(code), json=body, headers=auth_headers(user))


def status_of(db, code):
    db.expire_all()
    return db.query(Order).filter_by(code=code).one().status


# --- transition matrix (admin may set any target; the table is the only limit) ---


@pytest.mark.parametrize("target", CANONICAL)
@pytest.mark.parametrize("current", CANONICAL)
def test_transition_matrix(client, db, world, current, target):
    make_order(db, "PED-1", world["a"].id, "M1", "K1", status=current)
    resp = patch_status(client, world["admin"], "PED-1", target, reason="Motivo de prueba")
    if is_allowed(current, target):
        assert resp.status_code == 200
        assert resp.json()["status"] == target
        assert status_of(db, "PED-1") == target
    else:
        assert resp.status_code == 400
        assert status_of(db, "PED-1") == current


@pytest.mark.parametrize("spaced", ["en preparación", "en preparacion", "listo para recoger", "en camino", "Confirmado", ""])
def test_spaced_or_unknown_status_is_422_and_unchanged(client, db, world, spaced):
    make_order(db, "PED-1", world["a"].id, "M1", status="confirmado")
    resp = patch_status(client, world["m1"], "PED-1", spaced)
    assert resp.status_code == 422
    assert status_of(db, "PED-1") == "confirmado"


@pytest.mark.parametrize("current", [s for s in CANONICAL if s not in TERMINAL])
@pytest.mark.parametrize("target", ["rechazado", "cancelado"])
@pytest.mark.parametrize("reason", [None, "", "   "])
def test_blank_reason_is_400_and_unchanged(client, db, world, current, target, reason):
    make_order(db, "PED-1", world["a"].id, "M1", "K1", status=current)
    resp = patch_status(client, world["admin"], "PED-1", target, reason=reason)
    assert resp.status_code == 400
    assert status_of(db, "PED-1") == current


def test_reason_is_stored_on_order_and_history(client, db, world):
    make_order(db, "PED-1", world["a"].id, "M1", status="en_preparacion")
    resp = patch_status(client, world["m1"], "PED-1", "rechazado", reason="Sin insumos")
    assert resp.status_code == 200
    assert resp.json()["cancellation_reason"] == "Sin insumos"
    db.expire_all()
    hist = db.query(OrderStatusHistory).filter_by(order_code="PED-1").one()
    assert (hist.previous_status, hist.new_status, hist.reason) == (
        "en_preparacion",
        "rechazado",
        "Sin insumos",
    )


# --- who may set which target, and scope ---


def test_customer_cannot_patch_even_own_order_403(client, db, world):
    make_order(db, "PED-1", world["a"].id, "M1", status="pendiente")
    resp = patch_status(client, world["a"], "PED-1", "cancelado", reason="Cambié de opinión")
    assert resp.status_code == 403
    assert status_of(db, "PED-1") == "pendiente"


def test_accountant_403_and_anonymous_401(client, db, world):
    make_order(db, "PED-1", world["a"].id, "M1", status="pendiente")
    assert patch_status(client, world["acct"], "PED-1", "confirmado").status_code == 403
    assert client.patch(url("PED-1"), json={"status": "confirmado"}).status_code == 401


@pytest.mark.parametrize(
    "who,current,target",
    [
        ("m1", "pendiente", "confirmado"),
        ("m1", "confirmado", "en_preparacion"),
        ("m1", "en_preparacion", "listo_para_recoger"),
        ("k1", "listo_para_recoger", "en_camino"),
        ("k1", "en_camino", "entregado"),
    ],
)
def test_role_may_set_its_targets(client, db, world, who, current, target):
    make_order(db, "PED-1", world["a"].id, "M1", "K1", status=current)
    resp = patch_status(client, world[who], "PED-1", target)
    assert resp.status_code == 200
    assert status_of(db, "PED-1") == target


@pytest.mark.parametrize(
    "who,current,target",
    [
        ("m1", "listo_para_recoger", "en_camino"),  # merchant cannot deliver
        ("m1", "en_camino", "entregado"),
        ("k1", "pendiente", "confirmado"),  # courier cannot run the kitchen
        ("k1", "confirmado", "en_preparacion"),
        ("k1", "en_preparacion", "listo_para_recoger"),
        ("k1", "pendiente", "rechazado"),  # rechazado is the merchant's decision
    ],
)
def test_wrong_role_target_is_403_and_unchanged(client, db, world, who, current, target):
    make_order(db, "PED-1", world["a"].id, "M1", "K1", status=current)
    resp = patch_status(client, world[who], "PED-1", target, reason="Motivo")
    assert resp.status_code == 403
    assert status_of(db, "PED-1") == current


@pytest.mark.parametrize("who", ["m1", "k1"])
def test_merchant_and_courier_may_cancel_in_scope(client, db, world, who):
    make_order(db, "PED-1", world["a"].id, "M1", "K1", status="en_camino")
    resp = patch_status(client, world[who], "PED-1", "cancelado", reason="Sin respuesta del cliente")
    assert resp.status_code == 200
    assert status_of(db, "PED-1") == "cancelado"


def test_merchant_reject_in_scope(client, db, world):
    make_order(db, "PED-1", world["a"].id, "M1", status="pendiente")
    resp = patch_status(client, world["m1"], "PED-1", "rechazado", reason="Cerrado")
    assert resp.status_code == 200
    assert status_of(db, "PED-1") == "rechazado"


@pytest.mark.parametrize("who", ["m2", "mu", "k2", "b"])
def test_out_of_scope_order_is_404_and_unchanged(client, db, world, who):
    # order of M1/K1 owned by customer a: m2, unlinked merchant, other courier get 404
    make_order(db, "PED-1", world["a"].id, "M1", "K1", status="pendiente")
    target = "en_camino" if who == "k2" else "confirmado"
    resp = patch_status(client, world[who], "PED-1", target)
    # customer b is stopped by the role gate (403) before scope: still unchanged
    assert resp.status_code == (403 if who == "b" else 404)
    assert status_of(db, "PED-1") == "pendiente"


def test_courier_unassigned_order_is_404(client, db, world):
    make_order(db, "PED-1", world["a"].id, "M1", None, status="listo_para_recoger")
    resp = patch_status(client, world["k1"], "PED-1", "en_camino")
    assert resp.status_code == 404


def test_unknown_order_404(client, world):
    assert patch_status(client, world["admin"], "PED-NOPE", "confirmado").status_code == 404


def test_full_happy_path_history_is_canonical(client, db, world):
    make_order(db, "PED-1", world["a"].id, "M1", None, status="pendiente")
    for who, target in [("m1", "confirmado"), ("m1", "en_preparacion"), ("m1", "listo_para_recoger")]:
        assert patch_status(client, world[who], "PED-1", target).status_code == 200
    # assign courier, then the courier takes over
    resp = client.patch(
        "/api/v1/orders/PED-1/courier", json={"courier_code": "K1"}, headers=auth_headers(world["m1"])
    )
    assert resp.status_code == 200
    for who, target in [("k1", "en_camino"), ("k1", "entregado")]:
        assert patch_status(client, world[who], "PED-1", target).status_code == 200
    db.expire_all()
    rows = (
        db.query(OrderStatusHistory).filter_by(order_code="PED-1").order_by(OrderStatusHistory.id).all()
    )
    assert [(r.previous_status, r.new_status) for r in rows] == [
        ("pendiente", "confirmado"),
        ("confirmado", "en_preparacion"),
        ("en_preparacion", "listo_para_recoger"),
        ("listo_para_recoger", "en_camino"),
        ("en_camino", "entregado"),
    ]
    assert all(r.new_status in CANONICAL for r in rows)


# --- courier assignment scope ---


def assign(client, user, code, courier_code):
    return client.patch(
        f"/api/v1/orders/{code}/courier", json={"courier_code": courier_code}, headers=auth_headers(user)
    )


def test_assign_by_own_merchant_ok(client, db, world):
    make_order(db, "PED-1", world["a"].id, "M1", None, status="confirmado")
    resp = assign(client, world["m1"], "PED-1", "K2")
    assert resp.status_code == 200
    assert resp.json()["courier_code"] == "K2"


def test_assign_by_admin_ok(client, db, world):
    make_order(db, "PED-1", world["a"].id, "M1", None, status="confirmado")
    assert assign(client, world["admin"], "PED-1", "K1").status_code == 200


@pytest.mark.parametrize("who", ["m2", "mu"])
def test_assign_foreign_order_404_and_unchanged(client, db, world, who):
    make_order(db, "PED-1", world["a"].id, "M1", None, status="confirmado")
    assert assign(client, world[who], "PED-1", "K1").status_code == 404
    db.expire_all()
    assert db.query(Order).filter_by(code="PED-1").one().courier_code is None


@pytest.mark.parametrize("who", ["a", "k1", "acct"])
def test_assign_other_roles_403(client, db, world, who):
    make_order(db, "PED-1", world["a"].id, "M1", None, status="confirmado")
    assert assign(client, world[who], "PED-1", "K1").status_code == 403


@pytest.mark.parametrize("courier_code", ["NOPE", "KX", "KS"])
def test_assign_missing_unavailable_or_suspended_courier_400(client, db, world, courier_code):
    make_order(db, "PED-1", world["a"].id, "M1", None, status="confirmado")
    assert assign(client, world["m1"], "PED-1", courier_code).status_code == 400
    db.expire_all()
    assert db.query(Order).filter_by(code="PED-1").one().courier_code is None


# --- rating ownership ---

RATING = {"merchant_stars": 5, "courier_stars": 4, "comment": "Muy bien"}


def rate(client, user, code):
    return client.post(f"/api/v1/orders/{code}/rating", json=RATING, headers=auth_headers(user))


def test_owner_rates_delivered_order(client, db, world):
    make_order(db, "PED-1", world["a"].id, "M1", "K1", status="entregado")
    resp = rate(client, world["a"], "PED-1")
    assert resp.status_code == 200
    assert resp.json()["rating"]["merchant_stars"] == 5


def test_non_owner_customer_rating_404_and_nothing_stored(client, db, world):
    make_order(db, "PED-1", world["a"].id, "M1", "K1", status="entregado")
    assert rate(client, world["b"], "PED-1").status_code == 404
    db.expire_all()
    assert db.query(Order).filter_by(code="PED-1").one().rating is None


@pytest.mark.parametrize("who", ["admin", "k1", "m1", "acct"])
def test_non_customer_rating_403(client, db, world, who):
    make_order(db, "PED-1", world["a"].id, "M1", "K1", status="entregado")
    assert rate(client, world[who], "PED-1").status_code == 403
    db.expire_all()
    assert db.query(Order).filter_by(code="PED-1").one().rating is None


def test_rating_requires_delivered_order_400(client, db, world):
    make_order(db, "PED-1", world["a"].id, "M1", "K1", status="en_camino")
    assert rate(client, world["a"], "PED-1").status_code == 400
