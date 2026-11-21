// "Ver más" pagination for long catalog lists: show the first page, reveal one more page per click.
export const PAGE_SIZE = 12

export interface Pagina<T> {
  visibles: T[]
  restantes: number
  hayMas: boolean
}

export function paginar<T>(items: T[], pagina: number, tamano = PAGE_SIZE): Pagina<T> {
  const p = Math.max(1, Math.floor(pagina) || 1)
  const visibles = items.slice(0, p * tamano)
  const restantes = items.length - visibles.length
  return { visibles, restantes, hayMas: restantes > 0 }
}

export function textoVerMas(restantes: number, sustantivo: string): string {
  return `Ver más ${sustantivo} (${restantes} ${restantes === 1 ? 'restante' : 'restantes'})`
}
