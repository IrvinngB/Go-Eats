const centavos = (n: number) => Math.round(n * 100) / 100

export interface ResumenPedido {
  subtotal: number
  envio: number
  total: number
}

/** Order summary rows: everything in cents so floating point noise never reaches the screen. */
export function resumenPedido(subtotal: number, envio: number | undefined | null): ResumenPedido {
  const s = centavos(subtotal)
  const e = centavos(envio ?? 0)
  return { subtotal: s, envio: e, total: centavos(s + e) }
}
