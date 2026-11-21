"""Opt-in DEMO catalog generator (fictional merchants and products).

Usage (never wired into startup, init_db or reseed):

    python -m app.seed_demo_catalog [--merchants N] [--products-per-merchant M]
                                    [--seed S] [--dry-run] [--yes]

Deterministic and idempotent: merchant `DM-001`.. and product `DP-001-01`.. codes are
derived from (seed, index) only, so re-running creates nothing new and a larger N only
adds the missing merchants. Existing rows are never modified or deleted; users, orders,
payments and consent are never touched; generated merchants have no owner (unlinked).
All names are fictional word-list combinations. DEMO ONLY: never run it in production.
"""
import argparse
import random
import sys
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.domains.catalog.models import Product
from app.domains.merchants.models import Merchant
from app.domains.users.models import User  # noqa: F401  (merchants.owner_user_id FK needs `users` registered)
from app.domains.zones.models import Zone

DEFAULT_MERCHANTS = 150
DEFAULT_PRODUCTS_PER_MERCHANT = 10
DEFAULT_SEED = 2026
MIN_PRODUCTS, MAX_PRODUCTS = 6, 14
REVIEW_RATE, CLOSED_RATE = 0.03, 0.07  # en_revision (always closed) / active but closed
PROMO_RATE, PROMO_MERCHANT_RATE, UNAVAILABLE_RATE = 0.15, 0.4, 0.08  # promos cluster in ~40% of merchants

PLACES = [
    "Doña Mireya", "Don Beto", "Tía Nena", "La Ceiba", "Los Almendros", "El Mango", "Punta Brava",
    "Las Palmas", "Isla Verde", "El Tamarindo", "Casa Chitré", "La Cumbre", "Don Aurelio", "Doña Lupe",
    "El Guayacán", "Los Cocos", "La Palma Real", "Santa Elena", "El Cedro", "Doña Tere", "Bahía Azul",
    "Los Pinos", "El Níspero", "Don Rafa", "La Marquesina", "Cerro Alegre", "Doña Chela", "El Corozo",
    "Los Laureles", "La Hamaca", "Don Tito", "Villa Esperanza", "El Marañón", "Doña Gloria",
    "Puerto Real", "La Bendición", "Don Nando", "Las Mercedes", "El Higuerón", "Doña Ñeca", "Las Tinajas",
]
assert len(PLACES) == 41  # prime: never aligns with the zone count, so a zone sees every place
SUFFIXES = ["Express", "del Barrio", "Norte", "Centro", "Plus", "Gourmet", "Familiar", "Sur"]
DELIVERY_TIMES = ["15-25 min", "20-30 min", "20-35 min", "25-35 min", "25-40 min", "30-45 min"]

PRODUCT_DESCRIPTIONS = {
    "Sopas": ["Caliente y espesa, a fuego lento", "Receta casera de la casa"],
    "Fuertes": ["Porción generosa con acompañamiento", "Servido con arroz y ensalada"],
    "Entradas": ["Ideal para compartir", "Preparado al momento"],
    "Bebidas": ["Natural y bien fría", "Preparada al momento"],
    "Postres": ["Hecho en casa cada día", "Dulce y cremoso"],
    "Café": ["Café recién preparado", "Tostado local"],
    "Panadería": ["Horneado esta mañana", "Masa artesanal"],
    "Emparedados": ["Pan fresco y relleno abundante", "Tostado a la plancha"],
    "Rolls": ["Enrollado a mano", "Fresco del día"],
    "Entradas japonesas": ["Para empezar la mesa", "Preparado al momento"],
    "Arroces": ["Salteado al fuego alto", "Porción abundante"],
    "Frutas": ["Fruta fresca de temporada", "Seleccionada a mano"],
    "Despensa": ["Básico para tu cocina", "Buena relación precio y calidad"],
    "Carnes": ["Corte fresco", "Empacado el mismo día"],
    "Hogar": ["Para el día a día", "Presentación familiar"],
    "Pizzas": ["Masa de fermentación lenta", "Horneada al momento"],
    "Pastas": ["Salsa de la casa", "Porción generosa"],
    "Combos": ["Para compartir en familia", "Incluye acompañante y bebida"],
    "Asados": ["Marinado con hierbas criollas", "Dorado y jugoso"],
    "Acompañamientos": ["Complemento perfecto", "Preparado al momento"],
    "Bowls": ["Ingredientes frescos", "Liviano y nutritivo"],
    "Ensaladas": ["Hojas frescas y aderezo casero", "Ligera y completa"],
    "Jugos": ["Prensado al momento", "Sin azúcar añadida"],
    "Snacks": ["Para el antojo", "Crujiente y recién hecho"],
    "Raspados": ["Hielo fino y sirope natural", "Refrescante"],
    "Tradicional": ["Receta de la abuela", "Dulce típico artesanal"],
    "Mariscos": ["Pescado del día", "Fresco y bien sazonado"],
    "Ceviches": ["Marinado en limón", "Con ají y cilantro"],
    "Desayunos": ["Para arrancar el día", "Servido caliente"],
    "Frituras": ["Doradas al momento", "Crujientes por fuera"],
    "Parrilla": ["A las brasas", "Cocción lenta y jugosa"],
    "Pastelería": ["Hecho a diario", "Suave y esponjoso"],
}


@dataclass(frozen=True)
class Archetype:
    category_type: str
    icon: str
    prefixes: tuple[str, ...]
    opens: tuple[str, ...]
    closes: tuple[str, ...]
    descriptions: tuple[str, ...]
    items: tuple[tuple[str, str, float, float], ...]  # (category, name, min price, max price)


ARCHETYPES: tuple[Archetype, ...] = (
    Archetype("Comida típica panameña", "Soup", ("Fonda", "Cantina", "Rincón Criollo", "Sazón"),
        ("10:30", "11:00", "11:30"), ("20:00", "21:00", "21:30"),
        ("Platos criollos de todos los días, sazón casera.", "Cocina criolla al estilo de la casa.", "Sopas, arroces y fritos como en casa de la abuela."),
        (("Sopas", "Sancocho de gallina", 5.5, 7.5), ("Sopas", "Mondongo", 6.0, 8.5), ("Sopas", "Sopa de mariscos", 7.5, 11.0),
         ("Fuertes", "Arroz con pollo", 6.5, 8.5), ("Fuertes", "Ropa vieja con arroz", 7.0, 9.5), ("Fuertes", "Bistec picado con yuca", 7.5, 10.0),
         ("Fuertes", "Pescado frito con patacones", 8.5, 12.5), ("Fuertes", "Arroz con guandú y carne", 6.5, 9.0),
         ("Frituras", "Carimañolas (3 unid.)", 3.5, 5.0), ("Frituras", "Empanadas de carne (3 unid.)", 3.0, 4.5),
         ("Bebidas", "Chicheme frío", 2.5, 3.5), ("Bebidas", "Chicha de maracuyá", 2.5, 3.5),
         ("Postres", "Tres leches", 3.5, 5.0), ("Postres", "Arroz con piña", 3.0, 4.5))),
    Archetype("Café y panadería", "Coffee", ("Panadería", "Café", "Horno", "Panificadora"),
        ("06:00", "06:30", "07:00"), ("18:00", "19:00", "20:00"),
        ("Pan fresco y café todo el día.", "Horneamos cada mañana: pan, empanadas y dulces.", "Café, pan dulce y desayunos rápidos."),
        (("Café", "Café americano", 1.8, 2.8), ("Café", "Capuchino", 3.2, 4.5), ("Café", "Latte de vainilla", 3.5, 4.8), ("Café", "Café helado", 3.0, 4.2),
         ("Panadería", "Pan de trenza con queso", 2.5, 4.0), ("Panadería", "Hojaldre de queso", 1.8, 3.0), ("Panadería", "Pan de mantequilla (6 unid.)", 2.0, 3.5),
         ("Panadería", "Croissant", 2.5, 3.8), ("Emparedados", "Sándwich de jamón y queso", 3.5, 5.0), ("Emparedados", "Tostada de aguacate", 4.5, 6.5),
         ("Panadería", "Empanada de queso (2 unid.)", 2.5, 3.8), ("Postres", "Keki de zanahoria", 2.8, 4.2), ("Bebidas", "Jugo natural de naranja", 2.5, 3.5),
         ("Bebidas", "Chocolate caliente", 2.8, 4.0))),
    Archetype("Comida japonesa", "Fish", ("Sushi Bar", "Izakaya", "Wok", "Sushi"),
        ("11:30", "12:00"), ("21:30", "22:00", "22:30"),
        ("Rolls, ramen y platos calientes al estilo japonés.", "Cocina japonesa fusión con producto fresco.", "Sushi preparado al momento."),
        (("Rolls", "Roll de salmón y aguacate", 8.5, 12.0), ("Rolls", "Roll de camarón tempura", 9.0, 13.0), ("Rolls", "Roll vegetariano", 6.5, 9.0),
         ("Rolls", "Roll acevichado", 9.5, 13.5), ("Rolls", "Roll de atún picante", 9.0, 12.5), ("Entradas japonesas", "Gyozas de cerdo (6 unid.)", 5.5, 7.5),
         ("Entradas japonesas", "Edamame con sal", 3.5, 5.0), ("Entradas japonesas", "Tempura de vegetales", 5.5, 8.0), ("Arroces", "Yakimeshi de pollo", 7.5, 10.0),
         ("Arroces", "Yakimeshi de mariscos", 9.5, 12.5), ("Fuertes", "Ramen de cerdo", 10.0, 14.0), ("Fuertes", "Pollo teriyaki con arroz", 8.5, 11.5),
         ("Bebidas", "Té verde frío", 2.5, 3.8), ("Postres", "Mochi de fresa (3 unid.)", 4.0, 5.5))),
    Archetype("Súper y despensa", "ShoppingCart", ("Minisúper", "Súper", "Despensa", "Mercadito"),
        ("07:00", "07:30", "08:00"), ("20:00", "21:00", "21:30"),
        ("Despensa, frutas y productos básicos para el hogar.", "Todo lo del día a día cerca de ti.", "Abarrotes, frescos y artículos del hogar."),
        (("Frutas", "Canasta de frutas de temporada", 7.5, 12.0), ("Frutas", "Bananos (1 libra)", 0.6, 1.2), ("Frutas", "Aguacates (3 unid.)", 3.5, 5.5),
         ("Despensa", "Arroz blanco (5 lb)", 2.8, 4.2), ("Despensa", "Aceite vegetal (1 L)", 2.8, 4.5), ("Despensa", "Pack de desayuno", 6.5, 10.0),
         ("Despensa", "Frijoles negros (2 lb)", 1.8, 3.0), ("Carnes", "Pechuga de pollo (1 kg)", 5.5, 8.0), ("Carnes", "Carne molida (1 lb)", 3.5, 5.5),
         ("Bebidas", "Agua embotellada (pack 6)", 3.5, 5.5), ("Bebidas", "Jugo de naranja (1 L)", 2.0, 3.2), ("Hogar", "Detergente líquido (2 L)", 5.5, 9.0),
         ("Hogar", "Papel higiénico (pack 12)", 6.0, 9.5), ("Despensa", "Huevos (docena)", 2.8, 4.2))),
    Archetype("Pizzería artesanal", "Pizza", ("Pizzería", "Horno de Leña", "Pizza", "Trattoria"),
        ("11:30", "12:00"), ("22:00", "23:00"),
        ("Pizzas de masa fina al horno.", "Masa de fermentación lenta y buenos ingredientes.", "Pizzas, pastas y algo dulce para cerrar."),
        (("Pizzas", "Pizza margarita", 9.5, 13.0), ("Pizzas", "Pizza pepperoni", 10.5, 14.0), ("Pizzas", "Pizza cuatro quesos", 11.5, 15.0),
         ("Pizzas", "Pizza hawaiana", 10.0, 13.5), ("Pizzas", "Pizza vegetariana", 10.0, 13.5), ("Pizzas", "Calzone de jamón y queso", 9.5, 12.5),
         ("Pastas", "Lasaña de carne", 9.5, 12.5), ("Pastas", "Fettuccine al pesto", 9.0, 12.0), ("Pastas", "Espagueti a la boloñesa", 8.5, 11.5),
         ("Entradas", "Pan de ajo con queso", 3.5, 5.5), ("Entradas", "Bruschetta de tomate", 4.5, 6.5), ("Bebidas", "Gaseosa (500 ml)", 1.5, 2.5),
         ("Postres", "Tiramisú", 4.5, 6.5), ("Postres", "Panna cotta", 4.5, 6.0))),
    Archetype("Pollo y frituras", "Drumstick", ("Pollería", "Pollo Dorado", "Frituras", "Asadero"),
        ("10:00", "10:30", "11:00"), ("20:00", "21:00", "22:00"),
        ("Pollo asado y frito con acompañamientos criollos.", "Combos familiares y frituras crujientes.", "Pollo jugoso, patacones y yuca."),
        (("Combos", "Combo de pollo entero", 12.5, 17.0), ("Combos", "Combo de medio pollo", 7.5, 10.5), ("Combos", "Combo personal de pollo frito", 5.5, 7.5),
         ("Asados", "Pollo asado entero", 9.5, 13.0), ("Asados", "Cuarto de pollo asado", 4.5, 6.5), ("Entradas", "Alitas picantes (8 unid.)", 6.5, 9.0),
         ("Entradas", "Deditos de pollo (6 unid.)", 5.5, 7.5), ("Entradas", "Nuggets de pollo (10 unid.)", 4.5, 6.5), ("Acompañamientos", "Patacones (orden)", 2.5, 4.0),
         ("Acompañamientos", "Yuca frita (orden)", 2.5, 4.0), ("Acompañamientos", "Papas fritas", 2.0, 3.5), ("Acompañamientos", "Ensalada de repollo", 1.8, 3.0),
         ("Bebidas", "Soda (1.5 L)", 2.0, 3.2), ("Bebidas", "Chicha de saril", 2.2, 3.2))),
    Archetype("Opciones saludables", "Salad", ("Verde", "Bowl", "Fresco", "Naturalmente"),
        ("07:30", "08:00", "09:00"), ("18:00", "19:00", "20:00"),
        ("Bowls, ensaladas y jugos hechos al momento.", "Cocina ligera con ingredientes frescos.", "Menú ligero y fresco para todos los días."),
        (("Bowls", "Bowl de pollo y quinoa", 7.5, 10.5), ("Bowls", "Bowl de atún y aguacate", 8.5, 11.5), ("Bowls", "Bowl vegano de garbanzos", 7.0, 9.5),
         ("Ensaladas", "Ensalada César con pollo", 7.0, 9.5), ("Ensaladas", "Ensalada de lentejas", 6.0, 8.5), ("Ensaladas", "Ensalada de frutas", 4.5, 6.5),
         ("Entradas", "Wrap de falafel", 6.5, 8.5), ("Entradas", "Wrap de pollo y vegetales", 6.5, 8.5), ("Sopas", "Crema de zapallo", 4.5, 6.5),
         ("Jugos", "Jugo verde detox", 3.5, 5.0), ("Jugos", "Jugo de zanahoria y naranja", 3.0, 4.5), ("Jugos", "Batido de frutas", 3.5, 5.0),
         ("Postres", "Bowl de açaí", 6.0, 8.5), ("Postres", "Yogur con granola", 3.5, 5.0))),
    Archetype("Snacks y postres", "Cake", ("Antojitos", "Dulces", "Raspados", "Golosinas"),
        ("10:00", "11:00", "12:00"), ("18:00", "19:00", "20:00"),
        ("Antojos dulces y salados todo el día.", "Raspados, tres leches y dulces típicos.", "Postres caseros y algo para picar."),
        (("Raspados", "Raspado de frutas", 1.8, 3.0), ("Raspados", "Raspado con leche condensada", 2.2, 3.5), ("Raspados", "Raspado de tamarindo", 1.8, 3.0),
         ("Postres", "Tres leches", 3.5, 5.0), ("Postres", "Flan de caramelo", 3.0, 4.5), ("Postres", "Brownie con helado", 4.0, 5.5),
         ("Tradicional", "Cocadas (6 unid.)", 3.5, 5.5), ("Tradicional", "Huevitos de leche (6 unid.)", 3.5, 5.5), ("Tradicional", "Pesada de nance", 3.0, 4.5),
         ("Snacks", "Chicharrones con limón", 2.0, 3.5), ("Snacks", "Palomitas de caramelo", 2.0, 3.5), ("Snacks", "Tostones con queso", 2.8, 4.2),
         ("Bebidas", "Malteada de chocolate", 3.5, 5.0), ("Bebidas", "Limonada fría", 1.8, 3.0))),
    Archetype("Cevichería y mariscos", "Fish", ("Cevichería", "Mariscos", "Marisquería", "La Lancha"),
        ("11:00", "11:30", "12:00"), ("21:00", "22:00"),
        ("Ceviches y mariscos frescos todos los días.", "Pescado del día preparado al momento.", "Sabor de mar con ají y limón."),
        (("Ceviches", "Ceviche de corvina", 6.5, 9.0), ("Ceviches", "Ceviche de camarón", 7.5, 10.5), ("Ceviches", "Ceviche mixto", 8.5, 11.5),
         ("Ceviches", "Ceviche de pulpo", 8.5, 11.5), ("Mariscos", "Corvina frita con patacones", 10.5, 14.5), ("Mariscos", "Camarones al ajillo", 11.0, 15.0),
         ("Mariscos", "Pulpo a la parrilla", 12.0, 16.0), ("Mariscos", "Filete de pargo", 11.0, 15.0), ("Entradas", "Arañitas de calamar", 6.5, 9.0),
         ("Entradas", "Deditos de pescado", 5.5, 8.0), ("Sopas", "Sopa de mariscos", 8.5, 12.5), ("Sopas", "Sopa de pescado", 6.5, 9.5),
         ("Bebidas", "Limonada con hierbabuena", 2.5, 3.8), ("Bebidas", "Chicha de maracuyá", 2.5, 3.5))),
    Archetype("Desayunos y criolla", "Soup", ("Desayunos", "La Esquina", "Comedor", "Fogón"),
        ("06:00", "07:00"), ("14:00", "20:00", "21:00"),
        ("Desayunos típicos y comida criolla.", "Hojaldras, tortillas y café para empezar el día.", "Comedor de barrio con sabor casero."),
        (("Desayunos", "Hojaldras con huevo (3 unid.)", 3.5, 5.0), ("Desayunos", "Tortilla asada con queso", 3.0, 4.5), ("Desayunos", "Bistec picado con huevos", 5.5, 8.0),
         ("Desayunos", "Desayuno criollo completo", 6.0, 8.5), ("Desayunos", "Tamal de olla", 3.5, 5.0), ("Frituras", "Carimañolas (3 unid.)", 3.5, 5.0),
         ("Frituras", "Almojábanos (4 unid.)", 3.0, 4.5), ("Frituras", "Empanadas de queso (3 unid.)", 3.0, 4.5), ("Fuertes", "Arroz con pollo", 6.0, 8.5),
         ("Fuertes", "Carne guisada con arroz", 6.5, 9.0), ("Fuertes", "Pescado frito con arroz", 7.5, 10.5), ("Bebidas", "Chicheme", 2.5, 3.5),
         ("Bebidas", "Café con leche", 1.8, 2.8), ("Bebidas", "Jugo de tamarindo", 2.0, 3.2))),
    Archetype("Parrillada y carnes", "Drumstick", ("Parrilla", "Asados", "Brasas", "El Fogón"),
        ("11:30", "12:00"), ("21:00", "22:00", "23:00"),
        ("Carnes a las brasas con guarniciones caseras.", "Parrillada al carbón, cortes y chorizos.", "Asados para compartir."),
        (("Parrilla", "Puyazo a la parrilla", 12.5, 18.0), ("Parrilla", "Costillas de cerdo BBQ", 10.5, 15.0), ("Parrilla", "Pechuga a la parrilla", 7.5, 10.5),
         ("Parrilla", "Chorizo parrillero", 4.5, 7.0), ("Parrilla", "Picada mixta (2 personas)", 18.0, 26.0), ("Parrilla", "Churrasco con chimichurri", 11.5, 16.5),
         ("Acompañamientos", "Yuca al mojo", 2.5, 4.0), ("Acompañamientos", "Papas rústicas", 2.8, 4.2), ("Acompañamientos", "Ensalada de la casa", 3.0, 4.5),
         ("Acompañamientos", "Bollo preñao", 2.5, 4.0), ("Entradas", "Provoleta a la plancha", 5.0, 7.5), ("Bebidas", "Limonada frappé", 2.5, 3.8),
         ("Bebidas", "Cerveza sin alcohol", 2.0, 3.0), ("Postres", "Flan casero", 3.0, 4.5))),
    Archetype("Pastelería y postres", "Cake", ("Pastelería", "Dulcería", "Repostería", "Dulce"),
        ("08:00", "08:30", "09:00"), ("18:00", "19:00", "20:00"),
        ("Pasteles y postres hechos por encargo y al día.", "Repostería artesanal para toda ocasión.", "Kekis, milhojas y algo dulce para el café."),
        (("Pastelería", "Rebanada de pastel de chocolate", 3.5, 5.0), ("Pastelería", "Rebanada de pastel de vainilla", 3.2, 4.8), ("Pastelería", "Milhojas", 3.5, 5.0),
         ("Pastelería", "Éclair de crema", 2.8, 4.2), ("Pastelería", "Cheesecake de fresa", 4.0, 5.8), ("Pastelería", "Pie de limón", 3.5, 5.0),
         ("Tradicional", "Keki de raspadura", 2.8, 4.2), ("Tradicional", "Empanadas de queso (caja de 6)", 5.5, 8.0), ("Tradicional", "Tres leches", 3.5, 5.0),
         ("Postres", "Flan de queso", 3.0, 4.5), ("Postres", "Brownie", 2.5, 3.8), ("Postres", "Galletas de avena (6 unid.)", 3.0, 4.5),
         ("Bebidas", "Café con leche", 2.0, 3.2), ("Bebidas", "Chocolate frío", 2.8, 4.0))),
)
assert all(len(a.items) >= MAX_PRODUCTS for a in ARCHETYPES)


@dataclass
class Summary:
    merchants_created: int = 0
    merchants_skipped: int = 0
    products_created: int = 0
    products_skipped: int = 0
    zones_used: int = 0
    dry_run: bool = False


def mask_url(url: str) -> str:
    """Database URL with the password hidden, safe to print."""
    return make_url(url).render_as_string(hide_password=True)


def _merchant_code(index: int) -> str:
    return f"DM-{index:03d}"


def _product_code(index: int, position: int) -> str:
    return f"DP-{index:03d}-{position:02d}"


def _merchant_name(index: int, archetype: Archetype, rng: random.Random) -> str:
    """Place and suffix are index-derived, so names stay unique for any N."""
    place = PLACES[(index - 1) % len(PLACES)]
    cycle = (index - 1) // len(PLACES)
    name = f"{rng.choice(archetype.prefixes)} {place}"
    if cycle == 0:
        return name
    if cycle <= len(SUFFIXES):
        return f"{name} {SUFFIXES[cycle - 1]}"
    return f"{name} {cycle + 1}"


def _build_merchant(index: int, zone_slug: str, seed: int) -> tuple[Merchant, Archetype, random.Random]:
    rng = random.Random(f"{seed}:merchant:{index}")
    archetype = rng.choice(ARCHETYPES)
    roll = rng.random()
    in_review = roll < REVIEW_RATE
    is_open = not in_review and roll >= REVIEW_RATE + CLOSED_RATE
    opens, closes = rng.choice(archetype.opens), rng.choice(archetype.closes)
    merchant = Merchant(
        code=_merchant_code(index),
        name=_merchant_name(index, archetype, rng),
        category_type=archetype.category_type,
        zone_slug=zone_slug,
        rating=round(rng.triangular(3.8, 5.0, 4.7), 1),
        delivery_time=rng.choice(DELIVERY_TIMES),
        is_open=is_open,
        affiliation_status="en_revision" if in_review else "activo",
        opens_at=opens,
        closes_at=closes,
        description=rng.choice(archetype.descriptions),
        icon=archetype.icon,
        owner_user_id=None,
    )
    return merchant, archetype, rng


def _build_products(index: int, archetype: Archetype, per_merchant: int, seed: int) -> list[Product]:
    rng = random.Random(f"{seed}:products:{index}")
    low = max(MIN_PRODUCTS if per_merchant >= MIN_PRODUCTS else 1, per_merchant - 4)
    high = min(MAX_PRODUCTS, per_merchant + 4)
    count = rng.randint(min(low, high), high)
    chosen = rng.sample(archetype.items, k=min(count, len(archetype.items)))
    has_promos = rng.random() < PROMO_MERCHANT_RATE
    products: list[Product] = []
    for position, (category, name, price_min, price_max) in enumerate(chosen, start=1):
        price = round(round(rng.uniform(price_min, price_max) * 20) / 20, 2)
        promo = None
        if has_promos and rng.random() < PROMO_RATE / PROMO_MERCHANT_RATE:
            promo = round(price * rng.uniform(0.75, 0.9), 2)
            if promo >= price:
                promo = round(price - 0.05, 2)
        products.append(
            Product(
                code=_product_code(index, position),
                merchant_code=_merchant_code(index),
                name=name,
                description=rng.choice(PRODUCT_DESCRIPTIONS[category]),
                category=category,
                price=price,
                promo_price=promo,
                is_available=rng.random() >= UNAVAILABLE_RATE,
            )
        )
    return products


def generate_demo_catalog(
    db: Session,
    merchants: int = DEFAULT_MERCHANTS,
    products_per_merchant: int = DEFAULT_PRODUCTS_PER_MERCHANT,
    seed: int = DEFAULT_SEED,
    dry_run: bool = False,
) -> Summary:
    """Add the missing demo merchants/products. Never updates or deletes; caller commits."""
    zones = list(db.scalars(select(Zone.slug).where(Zone.is_active.is_(True)).order_by(Zone.slug)))
    if not zones:
        raise ValueError("No active zones found: run the base seed first (python -m app.init_db).")
    existing_merchants = set(db.scalars(select(Merchant.code).where(Merchant.code.like("DM-%"))))
    existing_products = set(db.scalars(select(Product.code).where(Product.code.like("DP-%"))))
    summary = Summary(zones_used=len(zones), dry_run=dry_run)
    for index in range(1, merchants + 1):
        zone_slug = zones[(index - 1) % len(zones)]
        merchant, archetype, _ = _build_merchant(index, zone_slug, seed)
        if merchant.code in existing_merchants:
            summary.merchants_skipped += 1
        else:
            summary.merchants_created += 1
            if not dry_run:
                db.add(merchant)
        for product in _build_products(index, archetype, products_per_merchant, seed):
            if product.code in existing_products:
                summary.products_skipped += 1
            else:
                summary.products_created += 1
                if not dry_run:
                    db.add(product)
    if not dry_run:
        db.flush()
    return summary


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m app.seed_demo_catalog",
        description="Opt-in, idempotent generator of fictional DEMO merchants and products. Never run in production.",
    )
    parser.add_argument("--merchants", type=int, default=DEFAULT_MERCHANTS, help="merchants DM-001..DM-N (default 150)")
    parser.add_argument("--products-per-merchant", type=int, default=DEFAULT_PRODUCTS_PER_MERCHANT,
                        help="average products per merchant, varies +-4 within 6..14 (default 10)")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED, help="deterministic seed (default 2026)")
    parser.add_argument("--dry-run", action="store_true", help="report what would be created, write nothing")
    parser.add_argument("--yes", action="store_true", help="confirm writing to the printed database")
    return parser


def main(argv: list[str] | None = None, session_factory=None, database_url: str | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.merchants < 0 or args.products_per_merchant < 1:
        print("error: --merchants must be >= 0 and --products-per-merchant >= 1", file=sys.stderr)
        return 2
    if session_factory is None or database_url is None:
        from app.core.config import settings
        from app.core.database import SessionLocal

        session_factory = session_factory or SessionLocal
        database_url = database_url or settings.database_url
    print(f"Target database: {mask_url(database_url)}")
    if not args.dry_run and not args.yes:
        print("error: refusing to write without --yes (use --dry-run to preview). Demo only: never run in production.", file=sys.stderr)
        return 2
    with session_factory() as db:
        try:
            summary = generate_demo_catalog(db, args.merchants, args.products_per_merchant, args.seed, args.dry_run)
        except ValueError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        if args.dry_run:
            db.rollback()
        else:
            db.commit()
    mode = "DRY RUN (nothing written)" if summary.dry_run else "Done"
    print(
        f"{mode}: merchants +{summary.merchants_created} (existing {summary.merchants_skipped}), "
        f"products +{summary.products_created} (existing {summary.products_skipped}), "
        f"active zones {summary.zones_used}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
