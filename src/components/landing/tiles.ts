import type { Component } from 'vue'
import { ListChecks, Map, Zap, Route, Receipt, Smartphone } from '@lucide/vue'

export interface TileData {
  key: string
  title: string
  text: string
  icon: Component
  tone: 'neutral' | 'brand'
  /** Tailwind span classes: mobile 2 cols, tablet 4, desktop 12. */
  span: string
}

// Copy only from verified facts (RF-04 coverage zones, RF-15 distance + zone tariff). No amounts or delivery times.
export const tiles: TileData[] = [
  {
    key: 'how',
    title: 'Cómo funciona',
    text: 'Elige un comercio, arma tu pedido y confírmalo. Te mostramos cada paso para que no te pierdas.',
    icon: ListChecks,
    tone: 'brand',
    span: 'col-span-2 md:col-span-2 lg:col-span-5',
  },
  {
    key: 'coverage',
    title: 'Cobertura',
    text: 'Comercios disponibles según tu zona de cobertura. Ingresa tu dirección y mira qué hay cerca.',
    icon: Map,
    tone: 'neutral',
    span: 'col-span-1 md:col-span-2 lg:col-span-4',
  },
  {
    key: 'speed',
    title: 'Rapidez',
    text: 'Pedidos preparados y repartidos por comercios de tu zona.',
    icon: Zap,
    tone: 'neutral',
    span: 'col-span-1 md:col-span-2 lg:col-span-3',
  },
  {
    key: 'tracking',
    title: 'Seguimiento',
    text: 'Sigue el estado de tu pedido desde que lo confirmas.',
    icon: Route,
    tone: 'neutral',
    span: 'col-span-1 md:col-span-2 lg:col-span-3',
  },
  {
    key: 'pricing',
    title: 'Costo de envío',
    text: 'El costo de envío se calcula según la distancia y la tarifa de tu zona. Lo ves antes de confirmar el pedido.',
    icon: Receipt,
    tone: 'neutral',
    span: 'col-span-1 md:col-span-2 lg:col-span-4',
  },
  {
    key: 'app',
    title: 'Descarga la app',
    text: 'Instálala desde tu navegador y ábrela como cualquier otra app.',
    icon: Smartphone,
    tone: 'brand',
    span: 'col-span-2 md:col-span-4 lg:col-span-5',
  },
]
