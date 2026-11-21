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

export interface FaqItem {
  id: string
  q: string
  a: string
}

/** FAQ copy. Every answer maps to a verified product fact: RF-04, 05, 14 (order), RF-10 (payment), RF-15 (shipping), RF-16 (status), RF-01/02/13/19 (roles). */
export const FAQ_COPY = {
  eyebrow: 'Ayuda',
  title: 'Preguntas frecuentes',
  lead: 'Lo básico para pedir, recibir y empezar a usar Go Eats.',
} as const

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'pedir',
    q: '¿Cómo hago un pedido?',
    a: 'Elige un comercio de tu zona, arma tu carrito con los productos de su catálogo y confirma tu pedido con tu dirección de entrega.',
  },
  {
    id: 'pago',
    q: '¿Cómo se paga?',
    a: 'Puedes pagar contra entrega, es decir, al recibir tu pedido.',
  },
  {
    id: 'envio',
    q: '¿Cómo se calcula el costo de envío?',
    a: ENVIO_COPY,
  },
  {
    id: 'estado',
    q: '¿Cómo sigo el estado de mi pedido?',
    a: 'Entra a la sección de pedidos de la app. Ahí ves cómo avanza: confirmado, en preparación, en camino y entregado.',
  },
  {
    id: 'unirse',
    q: '¿Cómo me uno como comercio o repartidor?',
    a: 'Entra a la página de ingreso de Go Eats: ahí puedes crear tu cuenta o iniciar sesión como comercio o como repartidor.',
  },
  {
    id: 'instalar',
    q: '¿Puedo instalar Go Eats como app?',
    a: 'Sí. Desde tu navegador puedes agregarla a tu pantalla de inicio y abrirla como cualquier otra app.',
  },
  {
    id: 'zona',
    q: '¿Cómo sé si llegan a mi zona?',
    a: 'Go Eats trabaja por zonas de cobertura. Al entrar a la app ves los comercios que llegan a la tuya, y en la sección de cobertura de esta página puedes revisar las zonas activas.',
  },
]

/** Final CTA band copy. No claims beyond the hero and the steps. */
export const CTA_COPY = {
  title: 'Empieza tu pedido en Go Eats',
  lead: 'Elige un comercio de tu zona y paga al recibir tu pedido.',
  primary: 'Pedir ahora',
  secondary: 'Iniciar sesión',
} as const

export interface FooterLink {
  label: string
  href: string
}

export const FOOTER_COPY = {
  tagline: 'Comercios de tu zona, en tu puerta.',
  copyright: '© Go Eats',
} as const

/** Only /tiendas, /login and anchors of sections that always render (the install section hides itself once installed, so it is not linked). */
export const FOOTER_GROUPS: { id: string; label: string; links: FooterLink[] }[] = [
  {
    id: 'lp-footer-explorar',
    label: 'Explorar',
    links: [
      { label: 'Cómo funciona', href: '#como-funciona' },
      { label: 'Comercios', href: '#tiendas' },
      { label: 'Cobertura', href: '#cobertura' },
      { label: 'Preguntas frecuentes', href: '#preguntas' },
    ],
  },
  {
    id: 'lp-footer-cuenta',
    label: 'Go Eats',
    links: [
      { label: 'Ver comercios', href: '/tiendas' },
      { label: 'Para comercios', href: '#comercios' },
      { label: 'Para repartidores', href: '#repartidores' },
      { label: 'Iniciar sesión', href: '/login' },
    ],
  },
]
