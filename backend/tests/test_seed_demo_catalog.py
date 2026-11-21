"""Opt-in demo catalog generator: deterministic, idempotent, additive-only."""
from collections import Counter

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

from app.domains.catalog.models import Product
from app.domains.merchants.models import Merchant
from app.seed_demo_catalog import generate_demo_catalog, main, mask_url
from tests.factories import make_merchant, make_product, make_zone

ICON_ALLOW_LIST = {"Cake", "Coffee", "Drumstick", "Fish", "Pizza", "Salad", "ShoppingCart", "Soup", "Store", "Tags"}
SEED_CATEGORY_TYPES = {
    "Comida típica panameña", "Café y panadería", "Comida japonesa", "Súper y despensa",
    "Pizzería artesanal", "Pollo y frituras", "Opciones saludables", "Snacks y postres",
    "Cevichería y mariscos", "Desayunos y criolla", "Parrillada y carnes", "Pastelería y postres",
}


def _zones(db, count=10, inactive=()):
    for i in range(count):
        make_zone(db, slug=f"zona-{i}", name=f"Zona {i}", is_active=f"zona-{i}" not in inactive)


def _snapshot(db):
    merchants = [
        (m.code, m.name, m.category_type, m.zone_slug, m.rating, m.delivery_time, m.is_open,
         m.affiliation_status, m.opens_at, m.closes_at, m.description, m.icon, m.owner_user_id)
        for m in db.scalars(select(Merchant).order_by(Merchant.code))
    ]
    products = [
        (p.code, p.merchant_code, p.name, p.description, p.category, p.price, p.promo_price, p.is_available)
        for p in db.scalars(select(Product).order_by(Product.code))
    ]
    return merchants, products


def _count(db, model):
    return db.scalar(select(func.count(model.id)))


def test_creates_requested_merchants_with_stable_codes(db):
    _zones(db)
    summary = generate_demo_catalog(db, merchants=150, products_per_merchant=10, seed=2026)
    db.commit()
    codes = [c for (c,) in db.execute(select(Merchant.code).order_by(Merchant.code))]
    assert summary.merchants_created == 150
    assert codes[0] == "DM-001" and codes[-1] == "DM-150" and len(set(codes)) == 150


def test_distributes_evenly_across_active_zones_only(db):
    _zones(db, count=10, inactive=("zona-3",))
    generate_demo_catalog(db, merchants=150, products_per_merchant=10, seed=2026)
    db.commit()
    per_zone = Counter(z for (z,) in db.execute(select(Merchant.zone_slug)))
    assert "zona-3" not in per_zone
    assert len(per_zone) == 9
    assert max(per_zone.values()) - min(per_zone.values()) <= 1
    assert sum(per_zone.values()) == 150


def test_fifteen_per_zone_across_ten_zones(db):
    _zones(db)
    generate_demo_catalog(db, merchants=150, products_per_merchant=10, seed=2026)
    db.commit()
    per_zone = Counter(z for (z,) in db.execute(select(Merchant.zone_slug)))
    assert set(per_zone.values()) == {15}


def test_same_seed_produces_identical_rows(db_engine):
    snapshots = []
    for run in range(2):
        session = sessionmaker(bind=db_engine)()
        if run == 0:
            _zones(session)
        generate_demo_catalog(session, merchants=40, products_per_merchant=10, seed=7)
        session.commit()
        snapshots.append(_snapshot(session))
        session.query(Product).delete()
        session.query(Merchant).delete()
        session.commit()
        session.close()
    assert snapshots[0] == snapshots[1]


def test_different_seed_changes_content(db):
    _zones(db)
    generate_demo_catalog(db, merchants=30, products_per_merchant=10, seed=1)
    db.commit()
    first = _snapshot(db)
    db.query(Product).delete()
    db.query(Merchant).delete()
    db.commit()
    generate_demo_catalog(db, merchants=30, products_per_merchant=10, seed=2)
    db.commit()
    assert _snapshot(db) != first


def test_running_twice_creates_nothing_new(db):
    _zones(db)
    generate_demo_catalog(db, merchants=150, products_per_merchant=10, seed=2026)
    db.commit()
    before = _snapshot(db)
    summary = generate_demo_catalog(db, merchants=150, products_per_merchant=10, seed=2026)
    db.commit()
    assert (summary.merchants_created, summary.products_created) == (0, 0)
    assert summary.merchants_skipped == 150
    assert _snapshot(db) == before


def test_larger_run_adds_exactly_the_missing_merchants(db):
    _zones(db)
    generate_demo_catalog(db, merchants=150, products_per_merchant=10, seed=2026)
    db.commit()
    before_merchants, before_products = _snapshot(db)
    summary = generate_demo_catalog(db, merchants=200, products_per_merchant=10, seed=2026)
    db.commit()
    after_merchants, after_products = _snapshot(db)
    assert summary.merchants_created == 50
    assert len(after_merchants) == 200
    assert after_merchants[:150] == before_merchants  # first 150 untouched (DM-001..DM-150 sort first)
    assert set(before_products) <= set(after_products)
    assert {m[0] for m in after_merchants[150:]} == {f"DM-{i}" for i in range(151, 201)}


def test_growth_run_matches_a_fresh_run_of_the_same_size(db_engine):
    results = []
    for steps in ([200], [150, 200]):
        session = sessionmaker(bind=db_engine)()
        _zones(session)
        for n in steps:
            generate_demo_catalog(session, merchants=n, products_per_merchant=10, seed=2026)
            session.commit()
        results.append(_snapshot(session))
        session.query(Product).delete()
        session.query(Merchant).delete()
        from app.domains.zones.models import Zone
        session.query(Zone).delete()
        session.commit()
        session.close()
    assert results[0] == results[1]


def test_preexisting_rows_are_never_modified(db):
    _zones(db)
    make_merchant(db, code="c1", name="Real Comercio", zone_slug="zona-0")
    make_product(db, code="p1", merchant_code="c1", name="Real Plato", price=5.0)
    make_merchant(db, code="DM-001", name="Editado a mano", zone_slug="zona-5")
    pre = _snapshot(db)
    generate_demo_catalog(db, merchants=20, products_per_merchant=10, seed=2026)
    db.commit()
    merchants, products = _snapshot(db)
    assert [m for m in merchants if m[0] in ("c1", "DM-001")] == [m for m in pre[0] if m[0] in ("c1", "DM-001")]
    assert [p for p in products if p[0] == "p1"] == pre[1]
    assert _count(db, Merchant) == 21  # 2 pre-existing + 19 new (DM-001 skipped)


def test_generated_merchants_are_unlinked_and_fields_are_valid(db):
    _zones(db)
    generate_demo_catalog(db, merchants=150, products_per_merchant=10, seed=2026)
    db.commit()
    merchants = list(db.scalars(select(Merchant)))
    assert all(m.owner_user_id is None for m in merchants)
    assert all(3.8 <= m.rating <= 5.0 and m.rating == round(m.rating, 1) for m in merchants)
    assert {m.icon for m in merchants} <= ICON_ALLOW_LIST
    assert {m.category_type for m in merchants} <= SEED_CATEGORY_TYPES
    assert len({m.category_type for m in merchants}) >= 8
    assert {m.affiliation_status for m in merchants} == {"activo", "en_revision"}
    assert all(m.is_open is False for m in merchants if m.affiliation_status == "en_revision")
    closed = sum(1 for m in merchants if not m.is_open)
    assert 5 <= closed <= 40
    assert all(m.name.strip() and m.description.strip() and m.delivery_time.endswith(" min") for m in merchants)
    assert all(m.opens_at < m.closes_at and len(m.opens_at) == 5 for m in merchants)
    assert len({m.name for m in merchants}) == 150


def test_products_are_valid_and_varied(db):
    _zones(db)
    generate_demo_catalog(db, merchants=150, products_per_merchant=10, seed=2026)
    db.commit()
    products = list(db.scalars(select(Product)))
    codes = [p.code for p in products]
    assert len(set(codes)) == len(codes)
    assert all(p.price == round(p.price, 2) and p.price > 0 for p in products)
    promos = [p for p in products if p.promo_price is not None]
    assert all(0 < p.promo_price < p.price and p.promo_price == round(p.promo_price, 2) for p in promos)
    assert 0.08 <= len(promos) / len(products) <= 0.22
    unavailable = sum(1 for p in products if not p.is_available)
    assert 0.03 <= unavailable / len(products) <= 0.14
    per_merchant = Counter(p.merchant_code for p in products)
    assert set(per_merchant) == {m for (m,) in db.execute(select(Merchant.code))}
    assert min(per_merchant.values()) >= 6 and max(per_merchant.values()) <= 14
    assert 9 <= sum(per_merchant.values()) / len(per_merchant) <= 11
    names_by_merchant = Counter((p.merchant_code, p.name) for p in products)
    assert max(names_by_merchant.values()) == 1
    assert all(p.category.strip() and p.description.strip() for p in products)


def test_dry_run_writes_nothing(db):
    _zones(db)
    summary = generate_demo_catalog(db, merchants=50, products_per_merchant=10, seed=2026, dry_run=True)
    db.commit()
    assert summary.merchants_created == 50 and summary.products_created > 0
    assert _count(db, Merchant) == 0 and _count(db, Product) == 0


def test_fails_clearly_without_active_zones(db):
    _zones(db, count=2, inactive=("zona-0", "zona-1"))
    with pytest.raises(ValueError, match="active zones"):
        generate_demo_catalog(db, merchants=10, products_per_merchant=10, seed=2026)


def test_mask_url_hides_password():
    masked = mask_url("postgresql+psycopg://goeats:s3cret@db:5432/goeats")
    assert "s3cret" not in masked and "goeats" in masked and "db:5432" in masked


def _factory(db_engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=db_engine)


def test_cli_requires_yes_unless_dry_run(db_engine, capsys):
    with _factory(db_engine)() as s:
        _zones(s)
    code = main(["--merchants", "10"], session_factory=_factory(db_engine), database_url="sqlite://")
    assert code == 2
    assert "--yes" in capsys.readouterr().err
    with _factory(db_engine)() as s:
        assert _count(s, Merchant) == 0


def test_cli_yes_commits_and_dry_run_does_not(db_engine, capsys):
    with _factory(db_engine)() as s:
        _zones(s)
    assert main(["--merchants", "12", "--dry-run"], session_factory=_factory(db_engine), database_url="sqlite://") == 0
    with _factory(db_engine)() as s:
        assert _count(s, Merchant) == 0
    assert main(["--merchants", "12", "--yes"], session_factory=_factory(db_engine), database_url="sqlite://") == 0
    out = capsys.readouterr().out
    assert "sqlite://" in out and "12" in out
    with _factory(db_engine)() as s:
        assert _count(s, Merchant) == 12


def test_module_registers_every_table_needed_by_foreign_keys_when_run_standalone():
    """`python -m app.seed_demo_catalog` imports no init_db: merchants.owner_user_id needs `users`."""
    import subprocess
    import sys

    code = "import app.seed_demo_catalog; from app.core.database import Base; print('users' in Base.metadata.tables)"
    result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, env={"DATABASE_URL": "sqlite://", "PATH": ""})
    assert result.stdout.strip() == "True", result.stderr


def test_names_do_not_pile_up_on_the_same_place_within_a_zone(db):
    """Zone cycling must not align with the place word list (found in the screenshots)."""
    _zones(db)
    generate_demo_catalog(db, merchants=150, products_per_merchant=10, seed=2026)
    db.commit()
    from app.seed_demo_catalog import PLACES

    by_zone = {}
    for m in db.scalars(select(Merchant)):
        place = next(p for p in PLACES if p in m.name)
        by_zone.setdefault(m.zone_slug, []).append(place)
    for zone, places in by_zone.items():
        assert len(set(places)) >= 13, (zone, Counter(places))  # 15 merchants per zone


def test_promos_are_concentrated_in_some_merchants_not_all(db):
    _zones(db)
    generate_demo_catalog(db, merchants=150, products_per_merchant=10, seed=2026)
    db.commit()
    with_promo = {p.merchant_code for p in db.scalars(select(Product)) if p.promo_price is not None}
    assert 0.25 <= len(with_promo) / 150 <= 0.60
