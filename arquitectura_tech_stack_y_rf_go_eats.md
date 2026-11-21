# Go Eats — Especificación Técnica, Tech Stack y Arquitectura

**Cliente:** Comercios Unidos del Istmo, S.A.  
**Tipo de Entregable:** MVP en ambiente de pruebas (PWA Web/Móvil + API REST)  
**Capacidad Objetivo:** 500 pedidos concurrentes en hora pico ($\le 4\text{ s}$ de respuesta)  

---

## 1. Tech Stack Consolidado (Full-Stack)

La solución adopta un enfoque de **código único para web y móvil** mediante una Aplicación Web Progresiva (PWA) conectada a un **monolito modular** en Python.

### Frontend (PWA Cliente Web & Móvil)
* **Framework Principal:** Vue 3 (`<script setup>` con Composition API)
* **Empaquetador & Dev Server:** Vite
* **Capacidades PWA:** `vite-plugin-pwa` (Service Worker + `manifest.json` para instalación en Android/iOS)
* **Enrutamiento & Estado:** Vue Router 4 + Pinia (gestión de carrito, sesión JWT y cambio de vista por rol)
* **Estilos & UI:** Tailwind CSS (sistema visual limpio estilo Alegra: `#00B19D` primario, `#F5F7FA` fondo, `#FFFFFF` superficies) + Iconografía Phosphor / Lucide
* **Cliente HTTP:** Axios / Fetch con interceptores para inyección de `Bearer Token` y renovación automática (`refresh_token`)

### Backend (API REST)
* **Lenguaje & Framework:** Python 3.12 + FastAPI (ASGI)
* **Servidor de Aplicación:** Gunicorn con workers de Uvicorn
* **Validación & Serialización:** Pydantic v2 (`XxxCreate`, `XxxRead`, `XxxUpdate`)
* **ORM & Migraciones:** SQLAlchemy 2.x (asíncrono/síncrono) + Alembic
* **Base de Datos Relacional:** PostgreSQL 16 (diseño normalizado hasta 3FN)
* **Almacenamiento de Objetos:** MinIO (compatible con S3) para imágenes de catálogo y comprobantes PDF
* **Tareas en Segundo Plano:** `BackgroundTasks` de FastAPI (Redis + Celery/ARQ opcional si escala la carga)

### Seguridad, Integraciones e Infraestructura
* **Autenticación & Autorización:** JWT (Access Token 30 min / Refresh Token 7 días) + RBAC con 5 roles (`customer`, `merchant`, `courier`, `accountant`, `admin`) + Hash `bcrypt`/`argon2`
* **Cumplimiento Normativo:** Ley 81 de Protección de Datos Personales de Panamá (consentimientos versionados y flujo de derechos ARCO) + PCI-DSS básico (sin almacenamiento de datos de tarjetas)
* **Servicios Externos:** Google Maps API (geocodificación y polígonos de cobertura) + Firebase Cloud Messaging (notificaciones push)
* **Pasarela de Pagos:** Patrón Adaptador (`PaymentProvider`) con implementación de pago contra entrega y pasarela electrónica simulada para el MVP (modelado conceptual para Paguelo Fácil y Yappy)
* **Infraestructura & CI/CD:** Docker, `docker-compose`, Terraform (IaC), GitHub Actions, DigitalOcean (Droplets + PostgreSQL Administrado + Spaces) y Hostinger (hosting estático de la PWA + DNS/Correo)

---

## 2. Catálogo de Requisitos Funcionales (RF-01 a RF-20)

> **Nota:** Los códigos `RF-01` a `RF-12` corresponden directamente a los `RQ-01` a `RQ-12` del Acta de Constitución; `RF-13` a `RF-20` corresponden a los requisitos funcionales ampliados.  
> **Prioridad MoSCoW:** **M** = *Must have* (Esencial) | **S** = *Should have* (Importante).

| Código | Descripción Funcional | Dominio(s) Backend | Rol(es) Involucrado(s) | Prioridad |
| :--- | :--- | :--- | :--- | :---: |
| **RF-01** *(RQ-01)* | El comercio asigna pedidos listos a repartidores previamente registrados y disponibles. | `delivery`, `orders` | Comercio | **M** |
| **RF-02** *(RQ-02)* | El repartidor gestiona su estado de disponibilidad (en línea / ocupado / desconectado). | `delivery` | Repartidor | **M** |
| **RF-03** *(RQ-03)* | El cliente consulta el seguimiento en tiempo real de su pedido y los datos del repartidor asignado. | `orders`, `delivery` | Cliente | **M** |
| **RF-04** *(RQ-04)* | El cliente consulta los comercios afiliados disponibles según su zona de cobertura (polígono). | `merchants`, `zones` | Cliente | **M** |
| **RF-05** *(RQ-05)* | El cliente explora el catálogo de productos disponibles de un comercio seleccionado. | `catalog` | Cliente | **M** |
| **RF-06** *(RQ-06)* | El cliente visualiza el detalle completo de un producto (descripción, precio, disponibilidad) antes de pedir. | `catalog` | Cliente | **M** |
| **RF-07** *(RQ-07)* | Registro de usuarios diferenciados por rol con aceptación obligatoria de política de datos (Ley 81). | `users`, `auth` | Todos | **S** |
| **RF-08** *(RQ-08)* | Inicio de sesión mediante credenciales con control de acceso estricto (RBAC) según el rol. | `auth` | Todos | **M** |
| **RF-09** *(RQ-09)* | El usuario actualiza los datos de su perfil y puede ejercer sus derechos ARCO. | `users` | Todos | **S** |
| **RF-10** *(RQ-10)* | Procesamiento de pago electrónico (pasarela simulada) y pago contra entrega sin almacenar tarjetas. | `payments` | Cliente | **M** |
| **RF-11** *(RQ-11)* | Consulta del registro histórico y estado de todas las transacciones financieras y comisiones. | `payments`, `reports` | Contabilidad | **M** |
| **RF-12** *(RQ-12)* | Generación y descarga de comprobantes de pago digitales en formato PDF. | `payments` | Contabilidad | **M** |
| **RF-13** | El comercio gestiona su catálogo: productos, categorías, precios, promociones, horarios y disponibilidad. | `catalog`, `merchants` | Comercio | **M** |
| **RF-14** | El cliente arma su carrito de compras y confirma el pedido con observaciones y dirección de entrega. | `orders` | Cliente | **M** |
| **RF-15** | El cliente visualiza el costo estimado de envío calculado según distancia y tarifa de zona de cobertura. | `zones` | Cliente | **M** |
| **RF-16** | El comercio o repartidor actualiza el estado del pedido con notificación push y motivo obligatorio si se cancela/rechaza. | `orders` | Comercio, Repartidor | **M** |
| **RF-17** | La administración consulta reportes operativos, métricas e indicadores clave de gestión (KPIs). | `reports` | Administrador | **S** |
| **RF-18** | El administrador gestiona cuentas de usuario y aprueba o suspende la afiliación de comercios y repartidores. | `users`, `merchants`, `delivery` | Administrador | **M** |
| **RF-19** | El repartidor consulta los datos de recogida, entrega y observaciones de sus pedidos asignados. | `delivery`, `orders` | Repartidor | **M** |
| **RF-20** | El cliente califica el servicio del comercio y la atención del repartidor una vez entregado el pedido. | `orders`, `delivery` | Cliente | **S** |

---

## 3. Arquitectura del Sistema

### 3.1 Estilo Arquitectónico: Monolito Modular en Capas
Para cumplir con la ventana de desarrollo de 8 semanas con un equipo de 4 personas y evitar colisiones de código, el backend se estructura como un **monolito modular dividido en 9 dominios independientes**.

Cada dominio respeta estrictamente el flujo unidireccional de capas:
$$\text{Router (HTTP)} \longrightarrow \text{Service (Reglas de Negocio)} \longrightarrow \text{Repository (SQLAlchemy)} \longrightarrow \text{Model (PostgreSQL)}$$

* **Regla de aislamiento:** Un dominio **no puede** importar servicios de otro dominio. Si requiere consultar información externa (ej. `orders` verificando si un repartidor está disponible en `delivery`), únicamente puede consultar el repositorio correspondiente o coordinar a través de eventos/transacciones controladas.

### 3.2 Diagrama de Bloques y Flujo de Datos

```text
+-----------------------------------------------------------------------+
|                        CLIENTE PWA (Vue 3 + Vite)                     |
|  [Vista Cliente] [Vista Comercio] [Vista Repartidor] [Admin/Contab.]  |
+-----------------------------------+-----------------------------------+
                                    | HTTPS / TLS (REST JSON + JWT)
                                    v
+-----------------------------------------------------------------------+
|                     REVERSE PROXY (Nginx / Caddy)                     |
+-----------------------------------+-----------------------------------+
                                    | /api/v1/*
                                    v
+-----------------------------------------------------------------------+
|                    API REST FASTAPI (Monolito Modular)                |
|                                                                       |
|  +----------------------- CAPA TRANSVERSAL ------------------------+  |
|  | core/ (Config, DB, JWT, RBAC) | shared/ (Geo, Push, S3, Audit)  |  |
|  +-----------------------------------------------------------------+  |
|                                                                       |
|  +------------------------ 9 DOMINIOS DE NEGOCIO ------------------+  |
|  |  1. auth/       2. users/      3. merchants/    4. zones/       |  |
|  |  5. catalog/    6. orders/     7. delivery/     8. payments/    |  |
|  |  9. reports/                                                    |  |
|  +-----------------------------------------------------------------+  |
+---------+-------------------------+-------------------------+---------+
          |                         |                         |
          v                         v                         v
+-------------------+     +-------------------+     +-------------------+
|   PostgreSQL 16   |     |   MinIO (S3 API)  |     | Servicios Externos|
|  - Tablas 3FN     |     | - Fotos productos |     | - Google Maps API |
|  - Audit Logs     |     | - Comprobantes PDF|     | - Firebase (FCM)  |
|    (Append-Only)  |     |                   |     | - Pasarela Simul. |
+-------------------+     +-------------------+     +-------------------+
```

### 3.3 Máquina de Estados del Pedido (`orders`)
El ciclo de vida de un pedido sigue una transición estricta auditada en `order_status_history`:

```text
[pendiente] ──► [confirmado] ──► [en_preparacion] ──► [listo_para_recoger] ──► [en_camino] ──► [entregado]
     │                │                  │                     │                    │
     └────────────────┴──────────────────┴─────────────────────┴────────────────────┴──► [rechazado / cancelado]
                                                                                          (Requiere motivo obligatorio)
```
*(Nota: La asignación del repartidor `courier_id` no constituye un estado independiente, sino una propiedad vinculada al pedido a partir de su confirmación/preparación).*

### 3.4 Diseño de Datos y Seguridad (3FN + Auditoría)
* **Normalización (3FN):** Separación estricta de entidades (`users`, `merchants`, `zones`, `products`, `orders`, `order_items`, `couriers`, `payments`, `receipts`, `order_ratings`, `data_consents`, `arco_requests`).
* **Inmutabilidad Histórica:** `order_items` almacena una copia del `precio_unitario` vigente al momento de la compra, y `orders` congela `subtotal`, `tarifa_entrega`, `total` y `direccion_entrega` para evitar alteraciones históricas si el comercio o cliente editan sus datos posteriormente.
* **Trazabilidad & Cumplimiento:** Las tablas `audit_logs`, `auth_events`, `order_status_history`, `payment_status_history` y `data_access_log` operan bajo política de **solo inserción (`INSERT` only)** sin permisos de modificación o borrado para el usuario de la aplicación, garantizando retención de 12 meses (3 meses activos en base principal y archivo histórico en Object Storage).