/** The order as the store maps it from the API (mapPedidoApi); only the fields the order tiles read. */
export interface PedidoVista {
  id: string
  comercioId?: string
  comercioNombre: string
  fecha: string
  direccion: string
  items: Array<{ nombre: string; cantidad: number; precio: number; observacion?: string }>
  total: number
  estado: string
  metodoPago: string
  pagoEstado?: string | null
  repartidorId?: string | null
  repartidorNombre?: string
  motivoCancelacion?: string | null
  calificacion?: number | null
}
