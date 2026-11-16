import { defineStore } from 'pinia'
import {
  ZONAS,
  comercios,
  productosPorComercio,
  repartidores,
  pedidosIniciales,
  transacciones,
  afiliacionesPendientes,
  solicitudesARCO,
  eventosAuditoria,
  ESTADOS_PEDIDO,
} from '../mockData'

let seq = 1100
const nextId = (prefix) => `${prefix}-${++seq}`

function ahora() {
  return new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export const useGoEatsStore = defineStore('goeats', {
  state: () => ({
    rol: 'customer',
    autenticado: false,
    usuario: { nombre: 'Carlos Andrade', email: 'carlos@ejemplo.pa', telefono: '6123-4567', consentimientoLey81: true },
    zonas: ZONAS,
    zonaSeleccionada: 'san-francisco',
    comercios: comercios.map((c) => ({ ...c })),
    catalogo: JSON.parse(JSON.stringify(productosPorComercio)),
    repartidores: repartidores.map((r) => ({ ...r })),
    pedidos: pedidosIniciales.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i })) })),
    transacciones: transacciones.map((t) => ({ ...t })),
    afiliaciones: afiliacionesPendientes.map((a) => ({ ...a })),
    solicitudesARCO: solicitudesARCO.map((s) => ({ ...s })),
    eventos: eventosAuditoria.map((e) => ({ ...e })),
    carrito: [], // items {id, nombre, precio, cantidad, observacion, comercioId}
    carritoComercioId: null,
    notificacion: null,
  }),

  getters: {
    zonaActual: (s) => s.zonas.find((z) => z.id === s.zonaSeleccionada) || s.zonas[0],
    comerciosPorZona: (s) => s.comercios.filter((c) => c.zona === s.zonaSeleccionada),
    comercioPorId: (s) => (id) => s.comercios.find((c) => c.id === id),
    productosDe: (s) => (comercioId) => s.catalogo[comercioId] || [],
    repartidorPorId: (s) => (id) => s.repartidores.find((r) => r.id === id),
    repartidoresDisponibles: (s) => s.repartidores.filter((r) => r.disponible && r.estadoAfiliacion === 'activo'),
    carritoTotalItems: (s) => s.carrito.reduce((acc, i) => acc + i.cantidad, 0),
    carritoSubtotal: (s) => s.carrito.reduce((acc, i) => acc + i.cantidad * i.precio, 0),
    carritoComercio: (s) => (s.carritoComercioId ? s.comercios.find((c) => c.id === s.carritoComercioId) : null),

    pedidosComoCliente: (s) => s.pedidos.filter((p) => p.clienteNombre === s.usuario.nombre),
    pedidosPorComercio: (s) => (comercioId) => s.pedidos.filter((p) => p.comercioId === comercioId),
    pedidosAsignadosA: (s) => (repartidorId) => s.pedidos.filter((p) => p.repartidorId === repartidorId && !['entregado', 'cancelado'].includes(p.estado)),

    ingresosDelDia: (s) => s.transacciones.filter((t) => t.estado === 'aprobado').reduce((acc, t) => acc + t.monto, 0),
  },

  actions: {
    notificar(texto) {
      this.notificacion = { texto, id: Date.now() }
      setTimeout(() => { if (this.notificacion?.id === Date.now()) this.notificacion = null }, 2800)
    },

    setRol(rol) {
      this.rol = rol
      this.autenticado = true
    },

    seleccionarZona(zonaId) {
      this.zonaSeleccionada = zonaId
    },

    abrirTienda(comercioId) {
      if (this.carritoComercioId && this.carritoComercioId !== comercioId && this.carrito.length > 0) {
        return { ok: false, mensaje: 'Tu carrito tiene productos de otro comercio. Finaliza o vacía ese pedido primero.' }
      }
      this.carritoComercioId = comercioId
      return { ok: true }
    },

    agregarAlCarrito(comercioId, producto, cantidad = 1, observacion = '') {
      this.carritoComercioId = comercioId
      const existente = this.carrito.find((i) => i.id === producto.id && (i.observacion || '') === observacion)
      if (existente) existente.cantidad += cantidad
      else this.carrito.push({ id: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad, observacion, comercioId })
    },

    actualizarCantidad(idx, delta) {
      const item = this.carrito[idx]
      if (!item) return
      item.cantidad += delta
      if (item.cantidad <= 0) this.carrito.splice(idx, 1)
      if (this.carrito.length === 0) this.carritoComercioId = null
    },

    vaciarCarrito() {
      this.carrito = []
      this.carritoComercioId = null
    },

    crearPedido({ direccion, metodoPago, observaciones }) {
      const comercio = this.carritoComercio
      if (!comercio || this.carrito.length === 0) return null
      const subtotal = this.carritoSubtotal
      const tarifa = this.zonaActual.tarifa
      const pedido = {
        id: nextId('ORD'),
        comercioId: comercio.id,
        comercioNombre: comercio.nombre,
        clienteNombre: this.usuario.nombre,
        clienteTelefono: this.usuario.telefono,
        zona: this.zonaSeleccionada,
        direccion,
        items: this.carrito.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, observacion: i.observacion || '' })),
        subtotal,
        tarifaEnvio: tarifa,
        total: subtotal + tarifa,
        estado: 'pendiente',
        metodoPago,
        referenciaPasarela: metodoPago === 'electronico' ? `PAY-${Math.floor(Math.random() * 90000 + 10000)}-GO` : undefined,
        repartidorId: null,
        observaciones,
        calificacion: null,
        fecha: `Hoy, ${ahora()}`,
      }
      this.pedidos.unshift(pedido)
      this.transacciones.unshift({
        id: nextId('TX'),
        pedidoId: pedido.id,
        fecha: `Hoy, ${ahora()}`,
        cliente: pedido.clienteNombre,
        comercio: pedido.comercioNombre,
        monto: pedido.total,
        comision: metodoPago === 'electronico' ? Number((pedido.total * 0.12).toFixed(2)) : 0,
        total: metodoPago === 'electronico' ? Number((pedido.total * 0.88).toFixed(2)) : pedido.total,
        estado: metodoPago === 'electronico' ? 'pendiente' : 'pendiente',
        metodo: metodoPago,
        referencia: pedido.referenciaPasarela || '—',
      })
      this.registrarEvento(`${this.usuario.nombre} (Cliente)`, `Creación de pedido ${pedido.id}`, 'pedido')
      this.vaciarCarrito()
      return pedido
    },

    simularPago(pedidoId, aprobar) {
      const pedido = this.pedidos.find((p) => p.id === pedidoId)
      if (!pedido || pedido.metodoPago !== 'electronico') return
      const tx = this.transacciones.find((t) => t.pedidoId === pedidoId)
      if (aprobar) {
        pedido.estado = 'confirmado'
        if (tx) tx.estado = 'aprobado'
        this.registrarEvento('Sistema', `Aprobación de pago ${pedido.referenciaPasarela}`, 'pago')
        this.notificar('Pago aprobado. Tu pedido fue confirmado con el comercio.')
      } else {
        pedido.estado = 'cancelado'
        pedido.motivoCancelacion = 'Pago electrónico rechazado en la pasarela simulada.'
        if (tx) tx.estado = 'rechazado'
        this.registrarEvento('Sistema', `Pago rechazado para ${pedido.id}`, 'pago')
        this.notificar('Pago rechazado. El pedido fue cancelado.')
      }
    },

    avanzarEstadoPedido(pedidoId, nuevoEstado, extra = {}) {
      const pedido = this.pedidos.find((p) => p.id === pedidoId)
      if (!pedido) return
      pedido.estado = nuevoEstado
      Object.assign(pedido, extra)
      this.registrarEvento('Sistema', `Pedido ${pedido.id} pasó a "${nuevoEstado}"`, 'pedido')
    },

    rechazarPedido(pedidoId, motivo) {
      const pedido = this.pedidos.find((p) => p.id === pedidoId)
      if (!pedido) return
      pedido.estado = 'cancelado'
      pedido.motivoCancelacion = motivo
      this.registrarEvento('Sistema', `Pedido ${pedido.id} rechazado por el comercio`, 'pedido')
    },

    asignarRepartidor(pedidoId, repartidorId) {
      const pedido = this.pedidos.find((p) => p.id === pedidoId)
      if (!pedido) return
      pedido.repartidorId = repartidorId
      const r = this.repartidorPorId(repartidorId)
      this.notificar(r ? `${r.nombre} fue asignado al pedido ${pedido.id}.` : 'Repartidor asignado.')
    },

    toggleRepartidorDisponible(repartidorId) {
      const r = this.repartidores.find((x) => x.id === repartidorId)
      if (r) r.disponible = !r.disponible
    },

    actualizarEstadoProducto(comercioId, productoId, disponible) {
      const prod = (this.catalogo[comercioId] || []).find((p) => p.id === productoId)
      if (prod) prod.disponible = disponible
    },

    guardarProducto(comercioId, datos, productoId = null) {
      const lista = this.catalogo[comercioId] || []
      if (productoId) {
        const idx = lista.findIndex((p) => p.id === productoId)
        if (idx >= 0) Object.assign(lista[idx], datos)
      } else {
        lista.push({ id: nextId('P'), disponible: true, ...datos })
      }
    },

    guardarHorarioComercio(comercioId, horario) {
      const c = this.comercios.find((x) => x.id === comercioId)
      if (c) c.horario = { ...horario }
    },

    conciliarTransaccion(txId, estado) {
      const tx = this.transacciones.find((t) => t.id === txId)
      if (!tx) return
      tx.estado = estado
      this.registrarEvento('Contabilidad', `Transacción ${tx.id} marcada como ${estado}`, 'pago')
    },

    resolverAfiliacion(id, aprobar) {
      const a = this.afiliaciones.find((x) => x.id === id)
      if (!a) return
      if (aprobar) {
        a.estado = 'activo'
        if (a.tipo === 'comercio') {
          const c = this.comercios.find((x) => x.nombre === a.nombre)
          if (c) { c.estadoAfiliacion = 'activo'; c.activo = true }
        } else {
          const r = this.repartidores.find((x) => x.nombre === a.nombre)
          if (r) r.estadoAfiliacion = 'activo'
        }
        this.registrarEvento('Admin', `Aprobó afiliación de ${a.nombre}`, a.tipo)
      } else {
        a.estado = 'rechazado'
        this.registrarEvento('Admin', `Rechazó afiliación de ${a.nombre}`, a.tipo)
      }
    },

    cambiarEstadoComercio(comercioId, suspendido) {
      const c = this.comercios.find((x) => x.id === comercioId)
      if (!c) return
      c.activo = !suspendido
      c.estadoAfiliacion = suspendido ? 'suspendido' : 'activo'
      this.registrarEvento('Admin', `${suspendido ? 'Suspendió' : 'Reactivó'} a ${c.nombre}`, 'comercio')
    },

    responderARCO(id, respuesta) {
      const s = this.solicitudesARCO.find((x) => x.id === id)
      if (!s) return
      s.estado = 'respondida'
      s.respuesta = respuesta
      this.registrarEvento('Admin', `Respondió solicitud ARCO de ${s.usuario}`, 'arco')
    },

    enviarSolicitudARCO(tipo, detalle) {
      this.solicitudesARCO.unshift({
        id: nextId('ARCO'),
        usuario: this.usuario.nombre,
        tipo,
        detalle,
        fecha: `Hoy, ${ahora()}`,
        estado: 'pendiente',
      })
      this.notificar('Tu solicitud fue enviada. El administrador la responderá pronto.')
    },

    guardarPerfil(datos) {
      Object.assign(this.usuario, datos)
      this.notificar('Perfil actualizado correctamente.')
    },

    calificarPedido(pedidoId, estrellas) {
      const p = this.pedidos.find((x) => x.id === pedidoId)
      if (p) p.calificacion = estrellas
    },

    registrarEvento(actor, accion, tipo) {
      this.eventos.unshift({ id: nextId('EV'), fecha: `Hoy, ${ahora()}`, actor, accion, tipo })
    },

    siguienteEstado(estado) {
      const i = ESTADOS_PEDIDO.indexOf(estado)
      return i >= 0 && i < ESTADOS_PEDIDO.length - 1 ? ESTADOS_PEDIDO[i + 1] : null
    },
  },
})
