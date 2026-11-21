import type { Component } from 'vue'
import {
  Banknote,
  BellRing,
  Cake,
  ClipboardList,
  Coffee,
  Drumstick,
  Fish,
  NotebookText,
  PackageCheck,
  Pizza,
  Route,
  Salad,
  ShoppingCart,
  Soup,
  Store,
  Tags,
  Wifi,
} from '@lucide/vue'

/** Approved shipping sentence. Do not paraphrase (spec: Copy integrity). */
export const ENVIO_COPY = 'El costo de envío depende de tu zona y lo ves antes de confirmar el pedido.'

export interface Category {
  name: string
  icon: Component
}

/** Store types and icons mirror the app's own catalogue (mockData `tipo` and `icono`). */
export const CATEGORIES: Category[] = [
  { name: 'Comida típica', icon: Soup },
  { name: 'Café y panadería', icon: Coffee },
  { name: 'Comida japonesa', icon: Fish },
  { name: 'Súper y despensa', icon: ShoppingCart },
  { name: 'Pizzería', icon: Pizza },
  { name: 'Pollo y frituras', icon: Drumstick },
  { name: 'Opciones saludables', icon: Salad },
  { name: 'Snacks y postres', icon: Cake },
]

export interface Step {
  n: number
  title: string
  text: string
  icon: Component
}

/** RF-04, RF-05 (choose, cart), RF-10 (cash on delivery), RF-16 (order status). */
export const STEPS: Step[] = [
  { n: 1, title: 'Elige un comercio', text: 'Mira las tiendas que llegan a tu zona y entra a la que prefieras.', icon: Store },
  { n: 2, title: 'Arma tu carrito', text: 'Explora el catálogo, revisa cada producto y agrega lo que necesitas.', icon: ShoppingCart },
  {
    n: 3,
    title: 'Confirma y paga al recibir',
    text: `Confirma tu pedido y paga en efectivo al recibirlo. ${ENVIO_COPY}`,
    icon: Banknote,
  },
  { n: 4, title: 'Sigue el estado de tu pedido', text: 'Ve cómo avanza: confirmado, en preparación, en camino y entregado.', icon: PackageCheck },
]

export interface RolePoint {
  title: string
  text: string
  icon: Component
}

export interface Role {
  id: string
  eyebrow: string
  title: string
  lead: string
  cta: string
  points: RolePoint[]
}

export const ROLES: Record<'merchant' | 'courier', Role> = {
  // RF-13, RF-01, RF-16
  merchant: {
    id: 'comercios',
    eyebrow: 'Para comercios',
    title: 'Vende a tu zona con Go Eats',
    lead: 'Tu comercio aparece donde están tus clientes y tú llevas el control de cada pedido.',
    cta: 'Ingresar como comercio',
    points: [
      { title: 'Gestiona tu catálogo', text: 'Productos, categorías, promociones, horarios y disponibilidad en un solo lugar.', icon: NotebookText },
      { title: 'Asigna pedidos listos', text: 'Entrega cada pedido listo a un repartidor registrado y disponible.', icon: Route },
      { title: 'Actualiza el estado', text: 'Cambia el estado del pedido y avisa al cliente con una notificación.', icon: ClipboardList },
    ],
  },
  // RF-02, RF-19, RF-16
  courier: {
    id: 'repartidores',
    eyebrow: 'Para repartidores',
    title: 'Reparte los pedidos que te asignan',
    lead: 'Decide cuándo estás disponible y ten a mano todo lo que necesitas para cada entrega.',
    cta: 'Ingresar como repartidor',
    points: [
      { title: 'Define tu disponibilidad', text: 'Cambia entre en línea, ocupado y desconectado cuando lo necesites.', icon: Wifi },
      { title: 'Consulta recogida y entrega', text: 'Revisa los datos de recogida, la dirección de entrega y las observaciones.', icon: Tags },
      { title: 'Actualiza el estado', text: 'Marca cada avance del pedido y avisa al comercio y al cliente.', icon: BellRing },
    ],
  },
}

/** Stores section copy. Neutral on purpose: no ranking words, no prices, times or claims (spec: Featured stores). */
export const STORES_COPY = {
  eyebrow: 'Tiendas de tu zona',
  title: 'Comercios en Go Eats',
  lead: 'Algunos de los comercios afiliados que puedes encontrar en la app.',
  loading: 'Cargando comercios',
  empty: 'Estamos sumando comercios a tu zona. Entra a la app para ver los disponibles.',
  error: 'No pudimos mostrar los comercios en este momento. Puedes verlos directamente en la app.',
  cta: 'Ver comercios',
} as const

/** Coverage section copy. Only what the zones list supports: no delivery times, fees or distances. */
export const COVERAGE_COPY = {
  eyebrow: 'Cobertura',
  title: 'Zonas donde opera Go Eats',
  lead: 'Go Eats trabaja por zonas: al entrar a la app ves los comercios de la tuya.',
  chipsLabel: 'Zonas activas',
  mapLabel: 'Mapa de las zonas activas de Go Eats en la ciudad de Panamá',
  empty: 'Estamos activando zonas de cobertura. Entra a la app para ver los comercios disponibles.',
  error: 'No pudimos mostrar las zonas en este momento. Puedes consultarlas directamente en la app.',
} as const

/** Install section copy. Only PWA facts: installs from the browser, opens like any app. No stores, ratings or counts. */
export const INSTALL_COPY = {
  eyebrow: 'Instala la app',
  title: 'Lleva Go Eats en tu pantalla de inicio',
  lead: 'Instala Go Eats desde tu navegador y ábrela como cualquier otra app, directo desde tu pantalla de inicio.',
  cta: 'Instalar Go Eats',
  iosIntro: 'En iPhone y iPad, desde Safari:',
  iosShare: 'Compartir',
  iosAdd: 'Agregar a pantalla de inicio',
  neutral: 'Si tu navegador permite instalar apps, busca la opción Instalar o Agregar a pantalla de inicio en su menú.',
} as const
