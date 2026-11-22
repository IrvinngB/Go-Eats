import { describe, it, expect } from 'vitest'
import { nextTick, ref } from 'vue'
import { layoutGrid } from './grid'
import { PAGE_SIZE, paginar, textoVerMas } from './pagination'
import { usePaginacion } from '../composables/usePaginacion'

const items = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

// Rows of the 6-column desktop grid must add up to exactly 6 for a visible subset.
function rowsAreFull(n: number): boolean {
  let used = 0
  for (const cell of layoutGrid(n)) {
    used += cell.span
    if (used > 6) return false
    if (used === 6) used = 0
  }
  return used === 0
}

describe('paginar', () => {
  it('shows the first 12 and counts the remaining ones', () => {
    const p = paginar(items(40), 1)
    expect(PAGE_SIZE).toBe(12)
    expect(p.visibles).toEqual(items(12))
    expect(p.restantes).toBe(28)
    expect(p.hayMas).toBe(true)
  })

  it('reveals 12 more per page and never more than exist', () => {
    expect(paginar(items(40), 2).visibles).toHaveLength(24)
    expect(paginar(items(40), 3).visibles).toHaveLength(36)
    const last = paginar(items(40), 4)
    expect(last.visibles).toHaveLength(40)
    expect(last.restantes).toBe(0)
    expect(last.hayMas).toBe(false)
  })

  it('has no button for 12 or fewer items and handles the empty list', () => {
    expect(paginar(items(12), 1)).toMatchObject({ restantes: 0, hayMas: false })
    expect(paginar(items(3), 1).visibles).toEqual([1, 2, 3])
    expect(paginar([], 1)).toEqual({ visibles: [], restantes: 0, hayMas: false })
  })

  it('treats a page below 1 as the first page', () => {
    expect(paginar(items(30), 0).visibles).toHaveLength(12)
  })

  it('the visible subset of any page always packs complete desktop rows', () => {
    for (let total = 1; total <= 40; total++) {
      for (let pagina = 1; pagina <= 4; pagina++) {
        const { visibles } = paginar(items(total), pagina)
        expect(rowsAreFull(visibles.length), `total ${total} page ${pagina}`).toBe(true)
      }
    }
  })

  it('rows are full for every visible count 1..12 (a filtered first page)', () => {
    for (let n = 1; n <= 12; n++) expect(rowsAreFull(paginar(items(n), 1).visibles.length), `count ${n}`).toBe(true)
  })
})

describe('textoVerMas', () => {
  it('names the remaining count with the right plural', () => {
    expect(textoVerMas(8, 'comercios')).toBe('Ver más comercios (8 restantes)')
    expect(textoVerMas(1, 'comercios')).toBe('Ver más comercios (1 restante)')
    expect(textoVerMas(28, 'productos')).toBe('Ver más productos (28 restantes)')
  })
})

describe('usePaginacion', () => {
  it('verMas adds a page and the filters reset it to the first page', async () => {
    const lista = ref(items(40))
    const busqueda = ref('')
    const zona = ref('a')
    const p = usePaginacion(lista, [busqueda, zona])
    expect(p.visibles.value).toHaveLength(12)
    p.verMas()
    p.verMas()
    expect(p.visibles.value).toHaveLength(36)
    expect(p.restantes.value).toBe(4)

    busqueda.value = 'x'
    await nextTick()
    expect(p.visibles.value).toHaveLength(12)

    p.verMas()
    zona.value = 'b'
    await nextTick()
    expect(p.visibles.value).toHaveLength(12)
  })

  it('a change that is not a reset trigger keeps the revealed page', async () => {
    const lista = ref(items(40))
    const busqueda = ref('')
    const p = usePaginacion(lista, [busqueda])
    p.verMas()
    lista.value = items(40)
    await nextTick()
    expect(p.visibles.value).toHaveLength(24)
  })
})
