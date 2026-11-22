import { computed, onScopeDispose, ref } from 'vue'
import api from '../services/api'

const TIMEOUT_MS = 5000
const MAX_STORES = 6

/** Public fields only. Price, rating, ETA, fee, distance and open/closed never leave this module. */
export interface Tienda {
  id: number | string
  name: string
  category: string
  zoneName: string
  icon: string
}

export interface Zona {
  id: number | string
  slug: string
  name: string
}

export type LandingEstado = 'loading' | 'ready' | 'empty' | 'error'

interface MerchantRaw {
  id: number | string
  name: string
  category_type: string
  zone_slug: string
  affiliation_status: string
  icon?: string
}

interface ZoneRaw {
  id: number | string
  slug: string
  name: string
  is_active: boolean
}

function humanizeSlug(slug: string): string {
  const text = slug.replace(/-/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function selectFeatured(merchants: MerchantRaw[], zonas: Zona[]): Tienda[] {
  const names = new Map(zonas.map((z) => [z.slug, z.name]))
  return merchants
    .filter((m) => m.affiliation_status === 'activo')
    .slice(0, MAX_STORES)
    .map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category_type,
      zoneName: names.get(m.zone_slug) ?? humanizeSlug(m.zone_slug),
      icon: m.icon ?? '',
    }))
}

function selectZonas(zones: ZoneRaw[]): Zona[] {
  return zones.filter((z) => z.is_active === true).map(({ id, slug, name }) => ({ id, slug, name }))
}

/** Public landing data. Not the Pinia store: no auth, no sync, no side effects on app state. */
export function useLandingData() {
  const controller = new AbortController()
  const merchants = ref<MerchantRaw[]>([])
  const zonas = ref<Zona[]>([])
  const settledStores = ref(false)
  const storesFailed = ref(false)
  const zonasError = ref(false)

  const tiendas = computed(() => selectFeatured(merchants.value, zonas.value))
  const estado = computed<LandingEstado>(() => {
    if (!settledStores.value) return 'loading'
    if (storesFailed.value) return 'error'
    return tiendas.value.length === 0 ? 'empty' : 'ready'
  })
  const loading = computed(() => estado.value === 'loading')
  const empty = computed(() => estado.value === 'empty')
  const error = computed(() => estado.value === 'error')

  const config = { timeout: TIMEOUT_MS, signal: controller.signal }
  Promise.allSettled([api.get('/merchants/', config), api.get('/zones/', config)]).then(([stores, zones]) => {
    if (controller.signal.aborted) return
    if (stores.status === 'fulfilled') {
      merchants.value = Array.isArray(stores.value.data) ? stores.value.data : []
    } else {
      storesFailed.value = true
    }
    if (zones.status === 'fulfilled') {
      zonas.value = Array.isArray(zones.value.data) ? selectZonas(zones.value.data) : []
    } else {
      zonasError.value = true
    }
    settledStores.value = true
    if (storesFailed.value || zonasError.value) {
      console.warn('Landing: no se pudieron cargar los datos públicos, se muestra contenido estático.')
    }
  })

  onScopeDispose(() => controller.abort())

  return { estado, loading, empty, error, tiendas, zonas, zonasError }
}
