import { computed, ref, watch, type Ref, type WatchSource } from 'vue'
import { PAGE_SIZE, paginar } from '../utils/pagination'

/**
 * Reveals `tamano` more items per `verMas()`. Any of the `reiniciar` sources changing (search, category,
 * sort, zone) goes back to the first page; a new list with the same filters keeps the revealed page.
 */
export function usePaginacion<T>(lista: Ref<T[]>, reiniciar: WatchSource[] = [], tamano = PAGE_SIZE) {
  const pagina = ref(1)
  watch(reiniciar, () => {
    pagina.value = 1
  })
  const vista = computed(() => paginar(lista.value, pagina.value, tamano))
  return {
    visibles: computed(() => vista.value.visibles),
    restantes: computed(() => vista.value.restantes),
    hayMas: computed(() => vista.value.hayMas),
    verMas: () => {
      pagina.value += 1
    },
  }
}
