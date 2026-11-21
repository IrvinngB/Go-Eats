import type { Component } from 'vue'
import { Cake, Coffee, Drumstick, Fish, Pizza, Salad, ShoppingCart, Soup, Store, Tags } from '@lucide/vue'

/** Allow-list of the icon names the catalogue uses (mockData `icono`, backend `icon`). */
const STORE_ICONS: Record<string, Component> = { Cake, Coffee, Drumstick, Fish, Pizza, Salad, ShoppingCart, Soup, Store, Tags }

/** API `icon` is free text: never index a component registry with it directly. */
export function resolveStoreIcon(name: string): Component {
  return Object.prototype.hasOwnProperty.call(STORE_ICONS, name) ? STORE_ICONS[name] : Store
}
