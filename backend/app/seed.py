from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import hash_password
from app.domains.catalog.models import Product
from app.domains.delivery.models import Courier
from app.domains.merchants.models import Merchant
from app.domains.orders.models import Order, OrderItem, OrderRating, OrderStatusHistory
from app.domains.payments.models import Payment, PaymentStatusHistory, Receipt
from app.domains.users.models import ArcoRequest, DataConsent, User
from app.domains.zones.models import Zone
from app.shared.audit import AuditLog, AuthEvent
from app.shared.entity_links import ENTITY_LINKS


def _linked_user_id(db: Session, links: dict[str, str], code: str) -> int | None:
    """User id linked to an entity code via the shared email mapping, else None."""
    for email, linked_code in links.items():
        if linked_code == code:
            return db.scalar(select(User.id).where(User.email == email))
    return None


def seed_initial_data(db: Session) -> None:
    existing_orders = db.scalar(select(func.count(Order.id))) or 0
    if existing_orders >= 40:
        return

    # 1. Zonas de Cobertura en Ciudad de Panamá (10 zonas)
    zones_data = [
        ("san-francisco", "San Francisco", 2.50, 3.2),
        ("costa-del-este", "Costa del Este", 3.25, 6.1),
        ("bella-vista", "Bella Vista", 2.00, 2.4),
        ("condado-del-rey", "Condado del Rey", 3.50, 7.5),
        ("el-cangrejo", "El Cangrejo", 2.25, 2.8),
        ("punta-pacifica", "Punta Pacífica", 2.75, 3.8),
        ("obarrio", "Obarrio", 2.15, 2.6),
        ("marbella", "Marbella", 2.40, 3.0),
        ("clayton", "Clayton", 3.90, 8.4),
        ("brisas-del-golf", "Brisas del Golf", 4.20, 11.2),
    ]
    for slug, name, fee, dist in zones_data:
        if not db.scalars(select(Zone).where(Zone.slug == slug)).first():
            db.add(Zone(slug=slug, name=name, delivery_fee=fee, distance_km=dist, is_active=True))
    db.flush()

    # 2. Usuarios (25 usuarios en los 5 roles + Ley 81 consents)
    pw_hash = hash_password("demo1234")
    users_seed = [
        ("Carlos Andrade", "carlos@ejemplo.pa", "6123-4567", "customer"),
        ("Valeria Quintero", "valeria.quintero@ejemplo.pa", "6211-8899", "customer"),
        ("Roberto Arosemena", "roberto.arosemena@ejemplo.pa", "6344-1122", "customer"),
        ("Ana Gabriela Batista", "ana.batista@ejemplo.pa", "6455-3344", "customer"),
        ("Diego Vallarino", "diego.vallarino@ejemplo.pa", "6566-5566", "customer"),
        ("Camila De Obaldía", "camila.deobaldia@ejemplo.pa", "6677-7788", "customer"),
        ("Andrés Castrellón", "andres.castrellon@ejemplo.pa", "6788-9900", "customer"),
        ("Sofía Icaza", "sofia.icaza@ejemplo.pa", "6899-1234", "customer"),
        ("Gabriel Lewis", "gabriel.lewis@ejemplo.pa", "6900-5678", "customer"),
        ("Lucía Fábrega", "lucia.fabrega@ejemplo.pa", "6110-4321", "customer"),
        ("Ricardo Chiari", "ricardo.chiari@ejemplo.pa", "6220-8765", "customer"),
        ("Elena Tribaldos", "elena.tribaldos@ejemplo.pa", "6330-2109", "customer"),
        ("Fernando Boyd", "fernando.boyd@ejemplo.pa", "6440-6543", "customer"),
        ("Daniela Galindo", "daniela.galindo@ejemplo.pa", "6550-0987", "customer"),
        ("Héctor Endara", "hector.endara@ejemplo.pa", "6660-5432", "merchant"),
        ("Patricia Motta", "patricia.motta@ejemplo.pa", "6770-9876", "merchant"),
        ("Arturo Melo", "arturo.melo@ejemplo.pa", "6880-1357", "merchant"),
        ("Mónica Alemán", "monica.aleman@ejemplo.pa", "6990-2468", "merchant"),
        ("Javier Morales", "javier.morales@ejemplo.pa", "6701-1122", "courier"),
        ("María Cedeño", "maria.cedeno@ejemplo.pa", "6812-3344", "courier"),
        ("Luis Gómez", "luis.gomez@ejemplo.pa", "6923-5566", "courier"),
        ("Pedro Abrego", "pedro.abrego@ejemplo.pa", "6745-7788", "courier"),
        ("Marta Pinzón", "contabilidad@goeats.pa", "6100-2200", "accountant"),
        ("Ernesto Guardia", "auditoria@goeats.pa", "6100-3300", "accountant"),
        ("Administrador General", "admin@goeats.pa", "6000-0001", "admin"),
    ]
    created_users: list[User] = []
    for full_name, email, phone, role in users_seed:
        u = db.scalars(select(User).where(User.email == email)).first()
        if not u:
            u = User(
                full_name=full_name,
                email=email,
                phone=phone,
                password_hash=pw_hash,
                role=role,
                is_active=True,
            )
            db.add(u)
            db.flush()
            db.add(
                DataConsent(
                    user_id=u.id,
                    policy_version=settings.privacy_policy_version,
                    accepted=True,
                )
            )
        created_users.append(u)
    db.flush()

    # 3. Comercios (16 comercios en Ciudad de Panamá)
    merchants_seed = [
        ("c1", "Restaurante Diablicos", "Comida típica panameña", "san-francisco", 4.8, "25-35 min", True, "activo", "11:00", "21:00", "Sancocho, ropa vieja y ceviche elaborados al estilo del mercado interno.", "Soup"),
        ("c2", "Café Duran Express", "Café y panadería", "bella-vista", 4.6, "15-25 min", True, "activo", "06:30", "20:00", "Café de Boquete, empanadas y pan dulce horneado cada mañana.", "Coffee"),
        ("c3", "Sushi Itsumo", "Comida japonesa", "costa-del-este", 4.9, "30-45 min", True, "activo", "12:00", "22:30", "Rolls frescos de Corotú, ramen tonkotsu y tempura crujiente.", "Fish"),
        ("c4", "Supermercado El Rey Select", "Súper y despensa", "condado-del-rey", 4.5, "20-40 min", True, "activo", "07:00", "21:30", "Despensa completa, frutas frescas de Tierras Altas y artículos básicos.", "ShoppingCart"),
        ("c5", "Pizzería La Vespa", "Pizzería artesanal", "el-cangrejo", 4.7, "25-40 min", True, "activo", "12:00", "23:00", "Pizza de leña con masa de fermentación lenta, estilo napolitano.", "Pizza"),
        ("c6", "Pollo Riquísimo", "Pollo y frituras", "punta-pacifica", 4.4, "20-30 min", True, "activo", "10:00", "21:00", "Pollo entero asado y frito, patacones crujientes y ensalada de feria.", "Drumstick"),
        ("c7", "Verde Bistro", "Opciones saludables", "san-francisco", 4.7, "20-30 min", True, "activo", "08:00", "19:30", "Bowls proteicos, ensaladas orgánicas y jugos prensados en frío.", "Salad"),
        ("c8", "Antojos del Istmo", "Snacks y postres", "bella-vista", 4.3, "15-25 min", False, "en_revision", "10:00", "19:00", "Raspados artesanales, tres leches y cocadas. Afiliación en revisión.", "Cake"),
        ("c9", "El Trapiche Express", "Desayunos y criolla", "el-cangrejo", 4.9, "20-30 min", True, "activo", "07:00", "21:00", "Hojaldras, tortillas asadas, bistec picado y chicheme chorrerano.", "Soup"),
        ("c10", "Mariscos del Mercado", "Cevichería y mariscos", "marbella", 4.8, "25-35 min", True, "activo", "11:30", "22:00", "Ceviche de combinación, arañitas de calamar y corvina al ajillo.", "Fish"),
        ("c11", "Boquete Brew & Roasters", "Cafetería de especialidad", "obarrio", 4.8, "15-25 min", True, "activo", "07:00", "19:00", "Geisha filtrado, cold brew artesanal y croissants de almendra.", "Coffee"),
        ("c12", "Asados Don Chicho", "Parrillada y carnes", "condado-del-rey", 4.6, "30-45 min", True, "activo", "12:00", "22:00", "Puyazo importado, chorizos tableños, yuca al mojo y chimichurri.", "Drumstick"),
        ("c13", "Napoli Mia Trattoria", "Pastas y pizzas", "costa-del-este", 4.7, "25-40 min", True, "activo", "12:00", "22:30", "Fettuccine Alfredo, lasaña boloñesa al horno y pizza diavola.", "Pizza"),
        ("c14", "Fresh Market Clayton", "Orgánico y mercado", "clayton", 4.6, "25-40 min", True, "activo", "07:30", "20:30", "Productos orgánicos locales, pan de masa madre y lácteos artesanales.", "ShoppingCart"),
        ("c15", "Dulcería Momi Tradición", "Pastelería y postres", "punta-pacifica", 4.8, "15-30 min", True, "activo", "08:30", "21:00", "Kekis, empanadas de queso horneadas, dulce de cumpleaños y milhojas.", "Cake"),
        ("c16", "Wok & Dim Sum Dorado", "Comida cantonesa", "brisas-del-golf", 4.4, "30-45 min", False, "en_revision", "11:00", "21:30", "Siu mai, hakao, arroz con combinación y pollo agridulce.", "Soup"),
    ]
    for code, name, ctype, zslug, rating, dtime, is_open, aff, opens, closes, desc, icon in merchants_seed:
        if not db.scalars(select(Merchant).where(Merchant.code == code)).first():
            db.add(
                Merchant(
                    code=code,
                    name=name,
                    category_type=ctype,
                    zone_slug=zslug,
                    rating=rating,
                    delivery_time=dtime,
                    is_open=is_open,
                    affiliation_status=aff,
                    opens_at=opens,
                    closes_at=closes,
                    description=desc,
                    icon=icon,
                    owner_user_id=_linked_user_id(db, ENTITY_LINKS["merchants"], code),
                )
            )
    db.flush()

    # 4. Catálogo de Productos (96 productos: 6 por cada uno de los 16 comercios)
    catalog_by_merchant: dict[str, list[tuple[str, str, float, str, str, bool]]] = {
        "c1": [
            ("p1", "Sancocho de gallina", 6.50, "Sopas", "Receta tradicional con ñame diamante y culantro fresco", True),
            ("p2", "Ropa vieja con arroz con guandú", 8.25, "Fuertes", "Carne deshilachada en sofrito criollo con tajadas maduras", True),
            ("p3", "Ceviche de corvina del Pacífico", 7.50, "Entradas", "Marinado en limón persa con ají chombo y galletas saladas", True),
            ("p4", "Tamal de olla panameño", 5.75, "Tradicional", "Maíz nuevo con pollo, pasitas y aceitunas", True),
            ("p5", "Arroz con pollo y ensalada de feria", 7.90, "Fuertes", "Servido con plátano en tentación y ensalada de papas con remolacha", True),
            ("p6", "Chicheme chorrerano frío (16 oz)", 3.25, "Bebidas", "Maíz pilado con leche evaporada, canela y vainilla", True),
        ],
        "c2": [
            ("p7", "Café Geisha filtrado de Boquete", 3.80, "Café", "Notas florales y cítricas de altura", True),
            ("p8", "Empanada de carne guisada (2 unid.)", 3.20, "Panadería", "Masa de maíz amarillo rellena de picadillo criollo", True),
            ("p9", "Derretido de queso prensado en pan michita", 4.50, "Emparedados", "Tostado a la plancha con mantequilla", True),
            ("p10", "Cappuccino con leche de avena", 4.20, "Café", "Doble carga de espresso 100% arábica", True),
            ("p11", "Pan de trenza con queso blanco", 3.95, "Panadería", "Recién salido del horno", True),
            ("p12", "Jugo natural de naranja con raspadura", 2.90, "Bebidas", "Exprimido al momento", True),
        ],
        "c3": [
            ("p13", "Roll Canal de Panamá (10 pzas)", 12.50, "Rolls", "Camarón tempurizado, queso crema, aguacate y plátano maduro", True),
            ("p14", "Ramen Tonkotsu Especial", 13.75, "Ramen", "Caldo de 12 horas, chashu de cerdo, huevo ajitsuke y nori", True),
            ("p15", "Gyozas de cerdo y jengibre (6 unid.)", 6.80, "Entradas", "Doradas a la plancha con salsa ponzu", True),
            ("p16", "Tiradito de salmón con maracuyá", 11.90, "Entradas", "Cortes finos de salmón fresco con reducción cítrica", True),
            ("p17", "Yakimeshi de mariscos al wok", 10.50, "Arroces", "Arroz salteado con camarones, calamar y vegetales", True),
            ("p18", "Té verde frío con lichi", 3.50, "Bebidas", "Infusión natural sin conservantes", True),
        ],
        "c4": [
            ("p19", "Canasta de frutas de Tierras Altas", 11.90, "Frutas", "Papaya, piña oro miel, banano y fresas de Cerro Punta", True),
            ("p20", "Pack desayuno panameño", 9.40, "Despensa", "Huevos de patio (12), queso blanco, tortillas y café molido", True),
            ("p21", "Agua mineral embotellada (pack 6×1.5L)", 6.25, "Bebidas", "Agua purificada de manantial", True),
            ("p22", "Pechuga de pollo fresca (1 kg)", 7.80, "Carnes", "Empacada al vacío lista para cocinar", True),
            ("p23", "Aguacates Hass maduros (3 unid.)", 5.50, "Vegetales", "Seleccionados para consumo inmediato", True),
            ("p24", "Detergente biodegradable (2L)", 8.90, "Hogar", "Fórmula concentrada hipoalergénica", True),
        ],
        "c5": [
            ("p25", "Pizza Margherita DOP (12 pulg.)", 11.50, "Pizzas", "Salsa San Marzano, mozzarella fior di latte y albahaca", True),
            ("p26", "Pizza Diavola Picante", 13.25, "Pizzas", "Salami calabrese, aceite de chile y orégano", True),
            ("p27", "Pizza Cuatro Quesos & Miel", 14.00, "Pizzas", "Gorgonzola, provolone, parmesano y mozzarella", True),
            ("p28", "Focaccia al romero y ajo confitado", 6.20, "Entradas", "Horneada a la leña con aceite de oliva virgen extra", True),
            ("p29", "Calzone clásico napolitano", 12.80, "Pizzas", "Relleno de ricotta, jamón artesanal y champiñones", True),
            ("p30", "Tiramisú de la casa", 5.50, "Postres", "Con mascarpone italiano y espresso", True),
        ],
        "c6": [
            ("p31", "Combo Pollo Entero + Patacones + Soda 1.5L", 15.90, "Combos", "8 presas crujientes, 12 patacones y ensalada de repollo", True),
            ("p32", "Medio Pollo Asado con yuca al mojo", 8.75, "Asados", "Marinado en hierbas criollas", True),
            ("p33", "Alitas bañadas en salsa de maracuyá picante (8 unid.)", 7.90, "Entradas", "Acompañadas de bastones de apio", True),
            ("p34", "Deditos de pollo con papas fritas", 6.50, "Combos", "Pechuga empanizada al momento", True),
            ("p35", "Orden extra de patacones con queso fundido", 4.25, "Acompañamientos", "Plátano verde machacado doble fritura", True),
            ("p36", "Chicha de saril con jengibre (16 oz)", 2.75, "Bebidas", "Flor de jamaica natural", True),
        ],
        "c7": [
            ("p37", "Bowl Pacífico de Atún Sellado", 11.80, "Bowls", "Quinoa, edamame, aguacate, mango y aderezo de sésamo", True),
            ("p38", "Ensalada César con Pollo Grillé", 9.90, "Ensaladas", "Lechuga romana hidropónica, parmesano y crutones integrales", True),
            ("p39", "Wrap Mediterráneo de Falafel y Hummus", 8.75, "Wraps", "Tortilla espinaca, pepino, tomate cherry y tahini", True),
            ("p40", "Jugo Verde Detox Prensado en Frío", 4.90, "Jugos", "Pepino, apio, espinaca, piña y jengibre", True),
            ("p41", "Açaí Bowl Energético", 7.80, "Postres", "Granola artesanal, banano, chía y mantequilla de maní", True),
            ("p42", "Crema de zapallo rostizado y cúrcuma", 6.20, "Sopas", "Sin lácteos, acompañada de semillas de calabaza", True),
        ],
        "c8": [
            ("p43", "Tres Leches de Coco y Ron Abuelo", 5.25, "Postres", "Bizcocho esponjoso bañado en tres leches con coco tostado", True),
            ("p44", "Raspao de Rosa y Maracuyá con Leche Condensada", 3.50, "Raspados", "Con malteada en polvo al estilo del Casco Antiguo", True),
            ("p45", "Caja de Cocadas y Huevitos de Leche (8 unid.)", 6.00, "Tradicional", "Dulces típicos artesanales", True),
            ("p46", "Pesada de Nance con Queso Blanco (12 oz)", 4.25, "Tradicional", "Fruta de temporada cocida con maicena", True),
            ("p47", "Flan de la Abuela con Caramelo Oscuro", 4.50, "Postres", "Receta casera al baño maría", True),
            ("p48", "Sopa Borracha Panameña", 5.00, "Postres", "Marquesote con almíbar especiado y pasitas", True),
        ],
        "c9": [
            ("p49", "Desayuno El Trapiche Completo", 9.80, "Desayunos", "Bistec encebollado, 2 huevos, hojaldra, tortilla y queso blanco", True),
            ("p50", "Carimañolas de carne (3 unid.)", 4.50, "Frituras", "Masa de yuca rellena de carne molida condimentada", True),
            ("p51", "Almojábanos chiricanos con queso (4 unid.)", 4.20, "Frituras", "Maíz pilado molido con queso blanco", True),
            ("p52", "Hojaldra a caballo", 6.90, "Desayunos", "Hojaldra grande con bistec picado y huevo frito encima", True),
            ("p53", "Mondongo a la culona con arroz blanco", 8.95, "Fuertes", "Guiso tradicional con chorizo y garbanzos", True),
            ("p54", "Chicha de maracuyá natural (16 oz)", 2.95, "Bebidas", "Fruta fresca recién licuada", True),
        ],
        "c10": [
            ("p55", "Corvina entera frita con patacones", 14.50, "Mariscos", "Pescado del día con salsa tártara casera", True),
            ("p56", "Arañitas de calamar con alioli de culantro", 8.90, "Entradas", "Crujientes y doradas al momento", True),
            ("p57", "Ceviche de combinación con pulpo y camarón", 9.80, "Ceviches", "Con canchita y camote glaseado", True),
            ("p58", "Arroz chaufa de mariscos", 13.20, "Fuertes", "Salteado al fuego alto con langostinos", True),
            ("p59", "Sopa marinera levantamuertos", 12.90, "Sopas", "Con almejas, mejillones, camarón y filete de corvina", True),
            ("p60", "Limonada con hierbabuena y raspadura", 3.40, "Bebidas", "Refrescante y natural", True),
        ],
        "c11": [
            ("p61", "Cold Brew Nitro Boquete (12 oz)", 4.60, "Café", "Extracción en frío de 18 horas", True),
            ("p62", "Croissant de almendras horneado", 4.40, "Panadería", "Masa hojaldrada con crema frangipane", True),
            ("p63", "Tostada de aguacate y huevo pochado en masa madre", 8.50, "Brunch", "Con semillas de cáñamo y tomates secos", True),
            ("p64", "Flat White Doble", 4.10, "Café", "Microespuma sedosa con espresso de Volcán", True),
            ("p65", "Matcha Latte Ceremonial Helado", 4.95, "Bebidas", "Té verde japonés grado ceremonial", True),
            ("p66", "Bolsa de café en grano Catuai Lavado (250g)", 12.00, "Granos", "Tostado esta semana en Chiriquí", True),
        ],
        "c12": [
            ("p67", "Puyazo Importado 12 oz a la Parrilla", 18.50, "Carnes", "Con chimichurri artesanal, yuca al mojo y ensalada", True),
            ("p68", "Picada Mixta Don Chicho (2-3 personas)", 26.90, "Picadas", "Res, cerdo, pollo, chorizo tableño, patacones y bollos", True),
            ("p69", "Choripán en pan baguette con provoleta", 7.80, "Emparedados", "Chorizo artesanal a las brasas", True),
            ("p70", "Costillitas de cerdo BBQ de guayaba", 14.90, "Carnes", "Cocción lenta por 6 horas", True),
            ("p71", "Bollo preñao con chicharrón y maíz nuevo", 4.50, "Acompañamientos", "Envuelto en capullo de maíz", True),
            ("p72", "Papas rústicas con romero y parmesano", 4.80, "Acompañamientos", "Cortadas a mano", True),
        ],
        "c13": [
            ("p73", "Lasaña Boloñesa Gratinada al Horno", 12.40, "Pastas", "Capas de pasta fresca, ragú de res y bechamel", True),
            ("p74", "Fettuccine Alfredo con Camarones", 14.20, "Pastas", "Salsa cremosa de parmigiano reggiano 24 meses", True),
            ("p75", "Ravioles de Ricotta y Espinaca en Mantequilla de Salvia", 13.50, "Pastas", "Pasta artesanal hecha en casa", True),
            ("p76", "Bruschettas Clásicas de Tomate y Albahaca (4 unid.)", 6.50, "Entradas", "Pan campesino tostado con ajo", True),
            ("p77", "Panna Cotta de Frutos Rojos", 5.80, "Postres", "Postre piamontés suave y cremoso", True),
            ("p78", "San Pellegrino Aranciata Rossa", 3.20, "Bebidas", "Importada de Italia", True),
        ],
        "c14": [
            ("p79", "Hogaza de Pan de Masa Madre Integral", 6.40, "Panadería", "Fermentación natural de 36 horas", True),
            ("p80", "Miel cruda de abejas de Veraguas (500g)", 9.50, "Despensa", "100% pura sin pasteurizar", True),
            ("p81", "Queso de cabra artesanal de Boquete (250g)", 7.90, "Lácteos", "Con finas hierbas provenzales", True),
            ("p82", "Mix de hojas verdes hidropónicas (300g)", 4.60, "Vegetales", "Lavadas y listas para servir", True),
            ("p83", "Mantequilla de maní 100% natural sin azúcar", 6.80, "Despensa", "Molienda en piedra", True),
            ("p84", "Kombucha artesanal de maracuyá y cúrcuma", 4.20, "Bebidas", "Con probióticos vivos", True),
        ],
        "c15": [
            ("p85", "Empanadas de queso horneadas (caja de 6)", 8.40, "Panadería", "El clásico panameño de masa dulce y queso", True),
            ("p86", "Keki tradicional de raspadura y jengibre (3 unid.)", 4.50, "Tradicional", "Horneados diariamente", True),
            ("p87", "Rebanada de Dulce de Cumpleaños Panameño", 4.80, "Pastelería", "Merengue italiano y relleno de mermelada de guayaba", True),
            ("p88", "Milhojas de dulce de leche artesanal", 5.20, "Pastelería", "Hojaldre crujiente caramelizado", True),
            ("p89", "Orejas de hojaldre azucaradas (4 unid.)", 4.10, "Panadería", "Crujientes y doradas", True),
            ("p90", "Chocolate caliente espeso de la casa", 3.90, "Bebidas", "Con cacao bocatoreño", True),
        ],
        "c16": [
            ("p91", "Siu Mai de Cerdo y Camarón (orden de 6)", 5.80, "Dim Sum", "Al vapor con salsa de soya y picante", True),
            ("p92", "Hakao de Camarón Cristal (orden de 4)", 6.20, "Dim Sum", "Masa traslúcida al vapor", True),
            ("p93", "Arroz Frito con Combinación Especial", 9.90, "Arroces", "Puerco asado, camarón, pollo y cebollina", True),
            ("p94", "Costillitas Agridulces Estilo El Dorado", 11.40, "Fuertes", "Glaseadas al wok con piña y pimentón", True),
            ("p95", "Rollos de Primavera Crujientes (4 unid.)", 5.20, "Entradas", "Rellenos de vegetales y cerdo", True),
            ("p96", "Té de Jazmín Caliente o Frío", 2.80, "Bebidas", "Infusión tradicional china", True),
        ],
    }
    for mcode, plist in catalog_by_merchant.items():
        for pcode, pname, price, cat, desc, avail in plist:
            if not db.scalars(select(Product).where(Product.code == pcode)).first():
                db.add(
                    Product(
                        code=pcode,
                        merchant_code=mcode,
                        name=pname,
                        price=price,
                        category=cat,
                        description=desc,
                        is_available=avail,
                    )
                )
    db.flush()

    # 5. Repartidores (12 repartidores en distintas zonas)
    couriers_seed = [
        ("r1", "Javier Morales", "6701-1122", "san-francisco", 4.9, True, "activo"),
        ("r2", "María Cedeño", "6812-3344", "bella-vista", 4.8, True, "activo"),
        ("r3", "Luis Gómez", "6923-5566", "costa-del-este", 4.7, False, "activo"),
        ("r4", "Pedro Abrego", "6745-7788", "condado-del-rey", 4.9, True, "activo"),
        ("r5", "Kenia Villarreal", "6512-9012", "el-cangrejo", 4.8, True, "activo"),
        ("r6", "Rubén Samaniego", "6634-3456", "punta-pacifica", 4.6, True, "activo"),
        ("r7", "Yarisel Pineda", "6890-7890", "obarrio", 4.9, True, "activo"),
        ("r8", "Alexis Bethancourt", "6129-4567", "marbella", 4.7, True, "activo"),
        ("r9", "Efraín Tejeira", "6348-8901", "clayton", 4.8, False, "activo"),
        ("r10", "Dayana Barsallo", "6478-2345", "brisas-del-golf", 4.9, True, "activo"),
        ("r11", "Moisés Córdoba", "6589-6789", "san-francisco", 4.5, False, "en_revision"),
        ("r12", "Zuleika Vergara", "6711-0123", "bella-vista", 4.7, False, "en_revision"),
    ]
    for ccode, cname, cphone, zslug, rating, avail, aff in couriers_seed:
        if not db.scalars(select(Courier).where(Courier.code == ccode)).first():
            db.add(
                Courier(
                    code=ccode,
                    name=cname,
                    phone=cphone,
                    zone_slug=zslug,
                    rating=rating,
                    is_available=avail,
                    affiliation_status=aff,
                    user_id=_linked_user_id(db, ENTITY_LINKS["couriers"], ccode),
                )
            )
    db.flush()

    # 6. Pedidos (60 pedidos realistas + items + historial de estados + calificaciones + pagos + recibos)
    customer_users = [u for u in created_users if u.role == "customer"]
    addresses = [
        "Calle 70 Este, PH Mirador de San Francisco, Apto 12B",
        "Av. Balboa, PH Yoo Panama, Piso 28, Apto 28D",
        "Costa del Este, Paseo del Mar, PH Murano, Apto 19A",
        "El Cangrejo, Vía Argentina, Edificio Bellavista, Piso 4",
        "Condado del Rey, PH Terrazas del Rey, Torre B, Apto 7C",
        "Punta Pacífica, PH Oasis on the Bay, Piso 34",
        "Obarrio, Calle 54 Este, PH Twist Tower, Oficina 14",
        "Bella Vista, Calle 43, PH Parque Urracá, Apto 9B",
        "Clayton, Ciudad del Saber, Residencial Los Senderos, Casa 18",
        "Marbella, Calle Aquilino de la Guardia, PH Marbella Tower, 11A",
    ]
    notes_samples = [
        "Llamar en garita al llegar.",
        "Dejar en recepción con el seguridad.",
        "Incluir cubiertos y servilletas extra, por favor.",
        "Sin cebolla en la orden principal.",
        "Apartamento al fondo del pasillo derecho.",
        "",
    ]
    statuses_cycle = [
        "entregado",
        "entregado",
        "en_camino",
        "listo_para_recoger",
        "en_preparacion",
        "confirmado",
        "pendiente",
        "cancelado",
    ]
    methods_cycle = ["yappy", "contr_entrega"]
    active_merchants = [m for m in merchants_seed if m[7] == "activo"]
    active_couriers = ["r1", "r2", "r4", "r5", "r6", "r7", "r8", "r10"]

    now = datetime.now(timezone.utc)
    # One demo order per terminal "rechazado" state (canonical, with its mandatory reason).
    rechazado_index = 9
    rechazado_reason = "Sin insumos para preparar el pedido."

    for i in range(60):
        order_code = f"PED-{1040 + i}"
        if db.scalars(select(Order).where(Order.code == order_code)).first():
            continue

        # Asegurar que los primeros 10 pedidos incluyan varios de Carlos Andrade, c1 y r2 para la demo inmediata
        if i < 8:
            cust = customer_users[0]  # Carlos Andrade
        else:
            cust = customer_users[i % len(customer_users)]

        if i < 6:
            m_tuple = active_merchants[0]  # c1 Restaurante Diablicos
        else:
            m_tuple = active_merchants[i % len(active_merchants)]

        m_code, m_name, _, m_zone = m_tuple[0], m_tuple[1], m_tuple[2], m_tuple[3]
        zone_fee = dict((z[0], z[2]) for z in zones_data).get(m_zone, 2.50)

        status_val = "rechazado" if i == rechazado_index else statuses_cycle[i % len(statuses_cycle)]
        method_val = methods_cycle[i % len(methods_cycle)]

        courier_val: str | None = None
        if status_val in {"listo_para_recoger", "en_camino", "entregado"}:
            courier_val = "r2" if i < 6 else active_couriers[i % len(active_couriers)]

        m_products = catalog_by_merchant[m_code]
        item1 = m_products[i % len(m_products)]
        item2 = m_products[(i + 2) % len(m_products)]
        qty1 = (i % 2) + 1
        qty2 = 1
        subtotal = round(item1[2] * qty1 + item2[2] * qty2, 2)
        total = round(subtotal + zone_fee, 2)
        created_time = now - timedelta(minutes=i * 22)

        cancel_reason = {
            "cancelado": "Cliente solicitó cancelación por cambio de dirección.",
            "rechazado": rechazado_reason,
        }.get(status_val)

        order = Order(
            code=order_code,
            merchant_code=m_code,
            merchant_name=m_name,
            customer_id=cust.id,
            customer_name=cust.full_name,
            customer_phone=cust.phone,
            zone_slug=m_zone,
            delivery_address=addresses[i % len(addresses)],
            notes=notes_samples[i % len(notes_samples)],
            payment_method=method_val,
            status=status_val,
            courier_code=courier_val,
            cancellation_reason=cancel_reason,
            subtotal=subtotal,
            delivery_fee=zone_fee,
            total=total,
            created_at=created_time,
        )
        db.add(order)
        db.flush()

        db.add(
            OrderItem(
                order_id=order.id,
                product_code=item1[0],
                name=item1[1],
                unit_price=item1[2],
                quantity=qty1,
                notes="",
            )
        )
        db.add(
            OrderItem(
                order_id=order.id,
                product_code=item2[0],
                name=item2[1],
                unit_price=item2[2],
                quantity=qty2,
                notes="Bien caliente" if i % 3 == 0 else "",
            )
        )

        db.add(
            OrderStatusHistory(
                order_code=order.code,
                previous_status="pendiente" if status_val != "pendiente" else None,
                new_status=status_val,
                actor=cust.full_name if status_val == "pendiente" else f"Comercio:{m_code}",
                reason=cancel_reason,
                changed_at=created_time,
            )
        )

        # Calificaciones para pedidos entregados (RF-20)
        if status_val == "entregado" and i % 3 != 0:
            db.add(
                OrderRating(
                    order_id=order.id,
                    merchant_stars=5 if i % 2 == 0 else 4,
                    courier_stars=5,
                    comment="Excelente sabor y llegó súper rápido a San Francisco.",
                    created_at=created_time + timedelta(minutes=35),
                )
            )

        # Transacción financiera y comprobante PDF (RF-10, RF-11, RF-12)
        tx_code = f"TX-{9001 + i}"
        if not db.scalars(select(Payment).where(Payment.code == tx_code)).first():
            tx_status = (
                "fallido"
                if status_val in {"cancelado", "rechazado"}
                else ("pagado" if (method_val != "contr_entrega" or status_val == "entregado") else "pendiente")
            )
            commission = round(subtotal * 0.12, 2)
            ref_prefix = "COD" if method_val == "contr_entrega" else ("YPY" if method_val == "yappy" else "PGF")
            payment = Payment(
                code=tx_code,
                order_code=order.code,
                merchant_name=m_name,
                customer_name=cust.full_name,
                method=method_val,
                subtotal=subtotal,
                delivery_fee=zone_fee,
                commission=commission,
                total=total,
                status=tx_status,
                provider_reference=f"{ref_prefix}-{100000 + i * 7}",
                created_at=created_time,
            )
            db.add(payment)
            db.flush()
            db.add(
                PaymentStatusHistory(
                    payment_code=payment.code,
                    previous_status=None,
                    new_status=tx_status,
                    actor="Sistema",
                    changed_at=created_time,
                )
            )
            db.add(
                Receipt(
                    receipt_number=f"REC-{9001 + i}",
                    payment_id=payment.id,
                    issued_at=created_time,
                )
            )

    # 7. Solicitudes ARCO Ley 81 (15 solicitudes entre pendientes y respondidas)
    arco_samples = [
        ("Acceso", "Solicito copia íntegra de mi historial de pedidos y consentimientos firmados.", "pendiente", None),
        ("Rectificación", "Actualizar teléfono secundario y corregir dirección principal en San Francisco.", "pendiente", None),
        ("Oposición", "Deseo desactivar el envío de comunicaciones promocionales manteniendo alertas de pedidos.", "respondida", "Se desactivaron las notificaciones comerciales conforme al Art. 15 de la Ley 81."),
        ("Cancelación", "Eliminar direcciones antiguas asociadas a mi domicilio anterior en Bella Vista.", "respondida", "Direcciones históricas eliminadas de su perfil activo."),
        ("Acceso", "Confirmar qué comercios recibieron mis datos de contacto durante el último trimestre.", "pendiente", None),
        ("Rectificación", "Corregir segundo apellido en mis comprobantes fiscales.", "respondida", "Datos rectificados en el padrón de facturación."),
        ("Oposición", "No deseo que mi número telefónico sea visible una vez entregado el pedido.", "pendiente", None),
        ("Acceso", "Solicito reporte de trazabilidad de accesos a mis datos personales.", "respondida", "Reporte enviado al correo registrado en formato PDF."),
        ("Cancelación", "Solicito baja de cuenta secundaria en desuso.", "respondida", "Cuenta desactivada y programada para bloqueo conforme a retención legal."),
        ("Rectificación", "Cambio de correo electrónico corporativo a personal.", "pendiente", None),
    ]
    existing_arco_count = db.scalar(select(func.count(ArcoRequest.id))) or 0
    if existing_arco_count < 10:
        for idx, (rtype, detail, st, resp) in enumerate(arco_samples):
            u = customer_users[idx % len(customer_users)]
            db.add(
                ArcoRequest(
                    user_id=u.id,
                    user_name=u.full_name,
                    request_type=rtype,
                    detail=detail,
                    status=st,
                    admin_response=resp,
                    created_at=now - timedelta(hours=idx * 5),
                    resolved_at=(now - timedelta(hours=idx * 3)) if st == "respondida" else None,
                )
            )

    # 8. Eventos de Auditoría y Seguridad (50 eventos)
    existing_audit_count = db.scalar(select(func.count(AuditLog.id))) or 0
    if existing_audit_count < 30:
        audit_entries = [
            ("Carlos Andrade (Cliente)", "pedido", "Creó pedido PED-1040 en Restaurante Diablicos"),
            ("Restaurante Diablicos", "pedido", "Confirmó e inició preparación de PED-1040"),
            ("María Cedeño (Repartidor)", "pedido", "Marcó pedido PED-1040 como entregado"),
            ("Pasarela Paguelo Fácil", "pago", "Aprobó cobro electrónico TX-9001 por B/ 16.50"),
            ("Marta Pinzón (Contabilidad)", "pago", "Concilió lote de 18 transacciones electrónicas"),
            ("Admin", "comercio", "Aprobó afiliación de Pizzería La Vespa en El Cangrejo"),
            ("Admin", "arco", "Respondió solicitud ARCO de Valeria Quintero (Ley 81)"),
            ("Sushi Itsumo", "comercio", "Actualizó precios y disponibilidad de temporada"),
            ("Javier Morales (Repartidor)", "pedido", "Activó disponibilidad en zona San Francisco"),
            ("Café Duran Express", "comercio", "Actualizó horario de apertura a 06:30 AM"),
            ("Roberto Arosemena (Cliente)", "acceso", "Aceptó política de datos Ley 81 v1.0"),
            ("El Trapiche Express", "pedido", "Asignó repartidor Pedro Abrego a PED-1048"),
            ("Admin", "comercio", "Inició revisión de afiliación para Antojos del Istmo"),
            ("Admin", "comercio", "Inició revisión de afiliación para Wok & Dim Sum Dorado"),
            ("Ernesto Guardia (Contabilidad)", "pago", "Descargó comprobantes PDF del cierre diario"),
        ]
        for idx, (actor, etype, action) in enumerate(audit_entries * 3):
            db.add(
                AuditLog(
                    actor=actor,
                    event_type=etype,
                    action=action,
                    created_at=now - timedelta(minutes=idx * 14),
                )
            )
        for u in customer_users[:10]:
            db.add(AuthEvent(user_email=u.email, event="login_success:customer", ip_address="190.141.42.10"))

    db.commit()
