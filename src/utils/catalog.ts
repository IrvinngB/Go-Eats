export function normalizarTextoBusqueda(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function coincideBusqueda(texto: string, consulta: string): boolean {
  const q = normalizarTextoBusqueda(consulta)
  if (!q) return true
  return normalizarTextoBusqueda(texto).includes(q)
}

export function tienePromocion(p: { precio: number; precioRegular?: number | null }): boolean {
  return typeof p.precioRegular === 'number' && p.precio > 0 && p.precioRegular > p.precio
}

export function extraerCategorias<T extends Record<string, unknown>>(
  items: T[],
  clave: keyof T,
): string[] {
  const vistas = new Set<string>()
  const resultado: string[] = []
  for (const it of items) {
    const raw = typeof it[clave] === 'string' ? (it[clave] as string).trim() : ''
    if (raw && !vistas.has(raw)) {
      vistas.add(raw)
      resultado.push(raw)
    }
  }
  return resultado
}

export interface MerchantFilterOptions {
  busqueda?: string
  categoria?: string
  orden?: 'relevancia' | 'rating' | 'nombre'
}

export function filtrarYOrdenarComercios<
  T extends { nombre: string; tipo?: string; descripcion?: string; rating?: number; activo?: boolean },
>(comercios: T[], opts: MerchantFilterOptions = {}): T[] {
  const q = opts.busqueda || ''
  const cat = (opts.categoria || '').trim()
  const orden = opts.orden || 'relevancia'

  const filtrados = comercios.filter((c) => {
    if (cat && (c.tipo || '').trim() !== cat) return false
    if (!q.trim()) return true
    const texto = `${c.nombre} ${c.tipo || ''} ${c.descripcion || ''}`
    return coincideBusqueda(texto, q)
  })

  if (orden === 'rating') {
    return [...filtrados].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  }
  if (orden === 'nombre') {
    return [...filtrados].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }
  return filtrados
}

export interface ProductFilterOptions {
  busqueda?: string
  categoria?: string
}

export function filtrarProductos<
  T extends { nombre: string; descripcion?: string; categoria?: string; precio: number; precioRegular?: number | null },
>(productos: T[], opts: ProductFilterOptions = {}): T[] {
  const q = opts.busqueda || ''
  const cat = (opts.categoria || '').trim()

  return productos.filter((p) => {
    if (cat && (p.categoria || '').trim() !== cat) return false
    if (!q.trim()) return true
    const texto = `${p.nombre} ${p.descripcion || ''} ${p.categoria || ''}`
    return coincideBusqueda(texto, q)
  })
}

/** Ratings always print with one decimal and a dot ("4.0", never "4" or "4,0"). Backend values stay numbers. */
export function formatRating(valor: number | string | null | undefined, vacio = '—'): string {
  const n = typeof valor === 'string' ? Number(valor) : valor
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return vacio
  return n.toFixed(1)
}
