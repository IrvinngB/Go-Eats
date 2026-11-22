import { defineStore } from 'pinia'
import api, { tokenStorage } from '../services/api'
import { toWriteError } from '../services/errors'
import { DEMO_SWITCHER } from '../config'
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
  ESTADOS_TERMINALES,
} from '../mockData'

let seq = 1100
const nextId = (prefix) => `${prefix}-${++seq}`

const FORMATO_FECHA = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }

// API order -> UI order. `payment_status` is the latest payment's status (null while unpaid).
function mapPedidoApi(o) {
  return {
    id: o.code,
    comercioId: o.merchant_code,
    comercioNombre: o.merchant_name,
    clienteId: o.customer_id ?? null,
    clienteNombre: o.customer_name,
    clienteTelefono: o.customer_phone,
    zona: o.zone_slug,
    direccion: o.delivery_address,
    lat: o.delivery_lat ?? null,
    lng: o.delivery_lng ?? null,
    items: (o.items || []).map((it) => ({
      nombre: it.name,
      cantidad: it.quantity,
      precio: it.unit_price,
      observacion: it.notes || '',
    })),
    subtotal: o.subtotal,
    tarifaEnvio: o.delivery_fee,
    total: o.total,
    estado: o.status,
    metodoPago: o.payment_method === 'contr_entrega' ? 'contr_entrega' : 'electronico',
    pagoEstado: o.payment_status ?? null,
    repartidorId: o.courier_code,
    observaciones: o.notes,
    motivoCancelacion: o.cancellation_reason,
    calificacion: o.rating?.merchant_stars || null,
    calificacionComercio: o.rating?.merchant_stars || null,
    calificacionRepartidor: o.rating?.courier_stars || null,
    fecha: new Date(o.created_at).toLocaleString('es-PA', FORMATO_FECHA),
  }
}

function mapArcoApi(a) {
  return {
    id: a.id,
    usuario: a.user_name,
    tipo: a.request_type,
    detalle: a.detail,
    estado: a.status,
    respuesta: a.admin_response,
    fecha: new Date(a.created_at).toLocaleString('es-PA', FORMATO_FECHA),
  }
}

function mapTransaccionApi(t) {
  return {
    id: t.code,
    pedidoId: t.order_code,
    fecha: new Date(t.created_at).toLocaleString('es-PA', FORMATO_FECHA),
    cliente: t.customer_name,
    comercio: t.merchant_name,
    monto: t.total,
    comision: t.commission,
    total: Number((t.total - t.commission).toFixed(2)),
    estado: t.status === 'pagado' ? 'aprobado' : t.status === 'fallido' ? 'rechazado' : 'pendiente',
    metodo: t.method === 'contr_entrega' ? 'contr_entrega' : 'electronico',
    referencia: t.provider_reference || '—',
  }
}

// Default delivery address of the caller (UserRead): text + coordinates, all nullable server-side.
function mapDireccionApi(u) {
  return { direccion: u.address ?? '', lat: u.lat ?? null, lng: u.lng ?? null }
}

let notificacionSeq = 0

// Snapshot of the objects a write touches (shallow: their fields are primitives or replaced wholesale).
function tomarSnapshot(objetivos) {
  return objetivos.map((o) => (o ? { ...o } : null))
}

function restaurarSnapshot(objetivos, snapshot) {
  objetivos.forEach((o, i) => {
    if (!o || !snapshot[i]) return
    for (const k of Object.keys(o)) if (!(k in snapshot[i])) delete o[k]
    Object.assign(o, snapshot[i])
  })
}

function ahora() {
  return new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export const useGoEatsStore = defineStore('goeats', {
  state: () => ({
    rol: 'customer',
    autenticado: false,
    usuario: { id: null, nombre: '', email: '', telefono: '', consentimientoLey81: null, direccion: '', lat: null, lng: null }, // consent null = unknown until GET /users/me/consent; direccion/lat/lng = default delivery address
    zonas: ZONAS,
    zonaSeleccionada: 'san-francisco',
    comercios: comercios.map((c) => ({ ...c })),
    catalogo: JSON.parse(JSON.stringify(productosPorComercio)),
    repartidores: repartidores.map((r) => ({ ...r })),
    pedidos: pedidosIniciales.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i })) })),
    transacciones: transacciones.map((t) => ({ ...t })),
    afiliaciones: afiliacionesPendientes.map((a) => ({ ...a })),
    solicitudesARCO: solicitudesARCO.map((s) => ({ ...s })), // admin-wide list
    misSolicitudesARCO: [], // own requests (GET /users/me/arco), newest first
    consentimientoRequerido: false, // the server answered consent_required to an order/payment
    pedidoPendientePago: null, // { codigo, firma }: created order whose payment still has to succeed
    eventos: eventosAuditoria.map((e) => ({ ...e })),
    carrito: [], // items {id, nombre, precio, cantidad, observacion, comercioId}
    carritoComercioId: null,
    notificacion: null,
    comercioPropioId: null, // comercio vinculado a la cuenta (GET /merchants/mine)
    repartidorPropioId: null, // repartidor vinculado a la cuenta (GET /delivery/couriers/me)
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
    comercioPropio: (s) => (s.comercioPropioId ? s.comercios.find((c) => c.id === s.comercioPropioId) || null : null),
    repartidorPropio: (s) => (s.repartidorPropioId ? s.repartidores.find((r) => r.id === s.repartidorPropioId) || null : null),
    carritoComercio: (s) => (s.carritoComercioId ? s.comercios.find((c) => c.id === s.carritoComercioId) : null),

    pedidosComoCliente: (s) =>
      s.pedidos.filter((p) =>
        // Identity is the account id; name/email only match local demo orders that carry no customer id.
        p.clienteId != null && s.usuario.id != null
          ? p.clienteId === s.usuario.id
          : p.clienteId == null && (p.clienteNombre === s.usuario.nombre || p.clienteEmail === s.usuario.email),
      ),
    pedidosPorComercio: (s) => (comercioId) => s.pedidos.filter((p) => p.comercioId === comercioId),
    pedidosAsignadosA: (s) => (repartidorId) => s.pedidos.filter((p) => p.repartidorId === repartidorId && !ESTADOS_TERMINALES.includes(p.estado)),

    ingresosDelDia: (s) => s.transacciones.filter((t) => t.estado === 'aprobado').reduce((acc, t) => acc + t.monto, 0),
  },

  actions: {
    // info/success auto-dismiss; errors stay until the user dismisses them (desing.md), replaced only by a newer
    // toast or cleared when the same action succeeds (`accion` ties an error to the action that raised it).
    notificar(texto, tipo = 'info', accion = null) {
      // A unique id per toast: the timer only dismisses the toast it was created for.
      const id = ++notificacionSeq
      this.notificacion = { texto, tipo, id, accion }
      if (tipo === 'error') return
      setTimeout(() => { if (this.notificacion?.id === id) this.notificacion = null }, 2800)
    },

    // A successful retry removes the error toast left by the failed attempt of the same action.
    limpiarError(accion) {
      if (accion && this.notificacion?.tipo === 'error' && this.notificacion.accion === accion) this.notificacion = null
    },

    // Single wrapper for every API write.
    //   objetivos: objects whose fields are snapshotted and restored on failure
    //   aplicar:   optimistic local change (runs before the request)
    //   llamada:   () => api promise
    //   exito:     runs after the server confirmed (local log, success toast)
    //   revertir:  extra undo for changes a field snapshot cannot cover (items added to a list)
    // Never throws: returns { ok: true, data } or { ok: false, error } (typed, already toasted).
    async escribir({ objetivos = [], aplicar, llamada, exito, revertir, accion = null }) {
      const snapshot = tomarSnapshot(objetivos)
      if (aplicar) aplicar()
      let data
      try {
        ;({ data } = await llamada())
      } catch (err) {
        restaurarSnapshot(objetivos, snapshot)
        if (revertir) revertir()
        const error = toWriteError(err)
        this.notificar(error.message, 'error', accion)
        return { ok: false, error }
      }
      this.limpiarError(accion)
      if (exito) exito(data)
      return { ok: true, data }
    },

    setRol(rol) {
      this.rol = rol
      this.autenticado = true
    },

    async cambiarACuentaDemo(cuenta) {
      if (!DEMO_SWITCHER) return { ok: false, mensaje: 'El cambio de cuenta de demostración no está disponible.' }
      const { DEMO_PASSWORD } = await import('../demoAccounts')
      const res = await this.autenticarUsuario({
        email: cuenta.email,
        password: DEMO_PASSWORD,
        nombre: cuenta.name,
      })
      if (res.ok) {
        this.notificar(`Sesión activa: ${cuenta.name}`)
      }
      return res
    },

    cerrarSesion(mensaje = 'Has cerrado sesión.') {
      tokenStorage.clear()
      this.autenticado = false
      this.usuario = { id: null, nombre: 'Invitado', email: '', telefono: '', consentimientoLey81: false, direccion: '', lat: null, lng: null }
      this.rol = 'customer'
      this.comercioPropioId = null
      this.repartidorPropioId = null
      this.misSolicitudesARCO = []
      this.consentimientoRequerido = false
      this.pedidoPendientePago = null
      this.notificar(mensaje)
    },

    async autenticarUsuario({ email, password, nombre, modoRegistro = false, aceptaPolitica = false }) {
      try {
        const endpoint = modoRegistro ? '/auth/register' : '/auth/login'
        const payload = modoRegistro
          ? {
              full_name: nombre || 'Usuario Go Eats',
              email,
              phone: this.usuario.telefono || '6000-0000',
              password,
              accepts_privacy_policy: aceptaPolitica,
            }
          : { email, password }

        const { data } = await api.post(endpoint, payload)
        tokenStorage.setTokens(data.access_token, data.refresh_token)
        this.usuario = {
          id: data.user.id ?? null,
          nombre: data.user.full_name,
          email: data.user.email,
          telefono: data.user.phone || '6123-4567',
          consentimientoLey81: null,
          ...mapDireccionApi(data.user),
        }
        this.rol = data.user.role
        this.autenticado = true
        await this.sincronizarConBackend()
        return { ok: true, origen: 'api' }
      } catch (err) {
        if (err?.response?.status === 400 || err?.response?.status === 401 || err?.response?.status === 409) {
          return { ok: false, mensaje: err.response?.data?.detail || 'Credenciales inválidas.' }
        }
        // Sin respaldo offline: un error de red nunca autentica ni asigna rol localmente.
        return { ok: false, mensaje: 'No se pudo conectar con el servidor. Inténtalo de nuevo.' }
      }
    },

    async restaurarSesion() {
      if (!tokenStorage.getAccessToken()) return { ok: false }
      try {
        const { data } = await api.get('/users/me')
        this.usuario = {
          id: data.id ?? null,
          nombre: data.full_name,
          email: data.email,
          telefono: data.phone || '',
          consentimientoLey81: null,
          ...mapDireccionApi(data),
        }
        this.rol = data.role
        this.autenticado = true
        return { ok: true }
      } catch (err) {
        if (err?.response?.status === 401) {
          // Token inválido y refresh fallido: sesión anónima.
          tokenStorage.clear()
          this.autenticado = false
          return { ok: false }
        }
        // Error de red u otro: se conservan los tokens, sin cerrar sesión ni avisar.
        return { ok: false, offline: true }
      }
    },

    async sincronizarConBackend() {
      // Anónimo: solo endpoints públicos (se decide por estado del store, no por tokenStorage).
      const llamadas = {
        zones: '/zones/',
        merchants: '/merchants/',
        couriers: '/delivery/couriers',
        products: '/catalog/products',
      }
      if (this.autenticado) {
        llamadas.orders = '/orders/' // el backend lo acota según el rol
        if (this.rol === 'merchant') llamadas.mine = '/merchants/mine'
        if (this.rol === 'courier') llamadas.me = '/delivery/couriers/me'
        if (this.rol === 'accountant' || this.rol === 'admin') {
          llamadas.payments = '/payments/'
          llamadas.audit = '/reports/audit-logs'
        }
        if (this.rol === 'admin') llamadas.arco = '/users/arco'
      }
      const claves = Object.keys(llamadas)
      const resultados = await Promise.allSettled(claves.map((k) => api.get(llamadas[k])))
      const respuestas = {}
      const fallos = {}
      claves.forEach((k, i) => {
        const r = resultados[i]
        if (r.status === 'fulfilled') respuestas[k] = r.value
        else fallos[k] = r.reason // 401/403/404/red: se ignora salvo 404 de mine/me
      })
      try {
        const zonesRes = respuestas.zones || {}
        const merchantsRes = respuestas.merchants || {}
        const couriersRes = respuestas.couriers || {}
        const productsRes = respuestas.products || {}
        const ordersRes = respuestas.orders || {}
        const paymentsRes = respuestas.payments || {}
        const arcoRes = respuestas.arco || {}
        const auditRes = respuestas.audit || {}
        if (Array.isArray(zonesRes.data) && zonesRes.data.length > 0) {
          this.zonas = zonesRes.data.map((z) => ({
            id: z.slug,
            nombre: z.name,
            tarifa: z.delivery_fee,
            distanciaKm: z.distance_km,
          }))
        }
        if (Array.isArray(merchantsRes.data) && merchantsRes.data.length > 0) {
          this.comercios = merchantsRes.data.map((m) => ({
            id: m.code,
            nombre: m.name,
            tipo: m.category_type,
            zona: m.zone_slug,
            rating: m.rating,
            tiempoEntrega: m.delivery_time,
            activo: m.is_open,
            estadoAfiliacion: m.affiliation_status,
            horario: { abre: m.opens_at, cierra: m.closes_at },
            descripcion: m.description,
            icono: m.icon,
          }))
        }
        if (Array.isArray(couriersRes.data) && couriersRes.data.length > 0) {
          this.repartidores = couriersRes.data.map((r) => ({
            id: r.code,
            nombre: r.name,
            telefono: r.phone,
            zona: r.zone_slug,
            rating: r.rating,
            disponible: r.is_available,
            estadoAfiliacion: r.affiliation_status,
          }))
        }
        if (Array.isArray(productsRes.data) && productsRes.data.length > 0) {
          const agrupado = {}
          for (const p of productsRes.data) {
            if (!agrupado[p.merchant_code]) agrupado[p.merchant_code] = []
            agrupado[p.merchant_code].push({
              id: p.code,
              nombre: p.name,
              // Effective price = what the server charges (promo_price when set and > 0).
              precio: p.promo_price > 0 ? p.promo_price : p.price,
              precioRegular: p.price,
              descripcion: p.description,
              categoria: p.category,
              disponible: p.is_available,
            })
          }
          this.catalogo = agrupado
        }
        if (Array.isArray(ordersRes.data)) {
          this.pedidos = ordersRes.data.map(mapPedidoApi)
        }
        if (Array.isArray(paymentsRes.data)) {
          this.transacciones = paymentsRes.data.map(mapTransaccionApi)
        }
        if (Array.isArray(arcoRes.data)) {
          this.solicitudesARCO = arcoRes.data.map(mapArcoApi)
        }
        if (Array.isArray(auditRes.data)) {
          this.eventos = auditRes.data.map((e) => ({
            id: `EV-${e.id}`,
            actor: e.actor,
            tipo: e.event_type,
            accion: e.action,
            fecha: new Date(e.created_at).toLocaleString('es-PA', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
          }))
        }
        if (this.autenticado) {
          // Entidad vinculada: 404 `no_linked_entity` => cuenta sin comercio/repartidor.
          // Un fallo transitorio (red/5xx) conserva el vínculo anterior; solo 404 o rol ajeno lo borra.
          if (respuestas.mine) this.comercioPropioId = respuestas.mine.data?.code || null
          else if (this.rol !== 'merchant' || fallos.mine?.response?.status === 404) this.comercioPropioId = null
          if (respuestas.me) this.repartidorPropioId = respuestas.me.data?.code || null
          else if (this.rol !== 'courier' || fallos.me?.response?.status === 404) this.repartidorPropioId = null
        }
      } catch {
        // Silencioso si el backend no está activo (modo PWA offline/demo)
      }
      // Los fallos por llamada (401/403/404/red) se ignoran: nunca toast ni descarte de datos.
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

    // Cart drawer edits: an absolute quantity (<= 0 removes the line) and/or the line note.
    actualizarItemCarrito(idx, { cantidad, observacion } = {}) {
      const item = this.carrito[idx]
      if (!item) return
      if (typeof observacion === 'string') item.observacion = observacion
      if (typeof cantidad === 'number') this.actualizarCantidad(idx, cantidad - item.cantidad)
    },

    vaciarCarrito() {
      this.carrito = []
      this.carritoComercioId = null
      this.pedidoPendientePago = null // the cart changed or was cancelled: forget the unpaid order
    },

    // POST /orders then POST /payments for the server order code (both awaited).
    // Returns the UI order (with `pagoEstado`, `referenciaPasarela`) or null on any failure (typed toast shown).
    // The cart is cleared only when both calls succeed.
    async crearPedido({ direccion, lat, lng, metodoPago, observaciones, simularFalloPago = false }) {
      const comercio = this.carritoComercio
      if (!this.autenticado || !comercio || this.carrito.length === 0) return null
      const metodo = metodoPago === 'electronico' ? 'yappy' : 'contr_entrega'
      // Both or none: a lone coordinate is never sent (the server answers 422 to half a pin).
      const hayPin = Number.isFinite(lat) && Number.isFinite(lng)
      const firma = JSON.stringify([
        comercio.id,
        this.zonaSeleccionada,
        direccion,
        hayPin ? [lat, lng] : null, // a moved or removed pin is a different order
        observaciones || '',
        metodo,
        this.carrito.map((i) => [String(i.id), i.cantidad, i.observacion || '']),
      ])
      // Retry-safe: an order whose payment failed is reused while the cart and data are unchanged.
      let pedido = null
      if (this.pedidoPendientePago?.firma === firma) {
        pedido = this.pedidos.find((p) => p.id === this.pedidoPendientePago.codigo) || null
      }
      if (!pedido) {
        this.pedidoPendientePago = null
        try {
          const { data: orden } = await api.post('/orders/', {
            // The server recomputes prices, fee and names: only identifiers and choices travel.
            merchant_code: comercio.id,
            zone_slug: this.zonaSeleccionada,
            delivery_address: direccion,
            ...(hayPin ? { delivery_lat: lat, delivery_lng: lng } : {}),
            notes: observaciones || '',
            // 'electronico' is the UI id; `yappy` is the wire id of the single simulated gateway.
            payment_method: metodo,
            items: this.carrito.map((i) => ({
              product_code: String(i.id),
              quantity: i.cantidad,
              notes: i.observacion || '',
            })),
          })
          pedido = mapPedidoApi(orden)
        } catch (err) {
          const error = toWriteError(err)
          if (error.code === 'consent_required') this.consentimientoRequerido = true
          this.notificar(error.message, 'error', 'crear-pedido')
          return null
        }
        this.pedidos.unshift(pedido)
        this.pedidoPendientePago = { codigo: pedido.id, firma }
      }
      try {
        // Amounts are never sent: the server takes them from the persisted order.
        // Decline simulation is sent ONLY when the build-time demo flag is enabled AND the decline test card was used.
        const demoActivo = import.meta.env.VITE_ENABLE_DEMO_SWITCHER === 'true'
        const cuerpoPago =
          demoActivo && simularFalloPago
            ? { order_code: pedido.id, method: metodo, simulate_failure: true }
            : { order_code: pedido.id, method: metodo }
        const { data: pago } = await api.post('/payments/', cuerpoPago)
        pedido.pagoEstado = pago.status
        pedido.referenciaPasarela = pago.provider_reference || undefined
        if (pago.status === 'fallido') {
          // The server cancels the order when the electronic payment fails.
          pedido.estado = 'cancelado'
          pedido.motivoCancelacion = 'Pago electrónico rechazado'
        }
        this.transacciones.unshift(mapTransaccionApi(pago))
      } catch (err) {
        // The order exists on the server (pending): it is remembered so a retry only repeats the payment.
        const error = toWriteError(err)
        if (error.code === 'consent_required') this.consentimientoRequerido = true
        this.notificar(`El pedido ${pedido.id} se creó, pero el pago falló. ${error.message}`, 'error', 'crear-pedido')
        return null
      }
      this.consentimientoRequerido = false
      this.limpiarError('crear-pedido')
      this.vaciarCarrito() // also clears pedidoPendientePago
      return pedido
    },

    avanzarEstadoPedido(pedidoId, nuevoEstado, extra = {}) {
      const pedido = this.pedidos.find((p) => p.id === pedidoId)
      if (!pedido) return Promise.resolve({ ok: false, error: null })
      return this.escribir({
        accion: `estado:${pedidoId}`,
        objetivos: [pedido],
        aplicar: () => {
          pedido.estado = nuevoEstado
          Object.assign(pedido, extra)
        },
        llamada: () =>
          api.patch(`/orders/${pedidoId}/status`, { status: nuevoEstado, reason: extra.motivoCancelacion || null }),
        exito: () => this.registrarEvento('Sistema', `Pedido ${pedido.id} pasó a "${nuevoEstado}"`, 'pedido'),
      })
    },

    rechazarPedido(pedidoId, motivo) {
      const pedido = this.pedidos.find((p) => p.id === pedidoId)
      if (!pedido) return Promise.resolve({ ok: false, error: null })
      return this.escribir({
        objetivos: [pedido],
        aplicar: () => {
          pedido.estado = 'rechazado'
          pedido.motivoCancelacion = motivo
        },
        llamada: () => api.patch(`/orders/${pedidoId}/status`, { status: 'rechazado', reason: motivo }),
        exito: () => this.registrarEvento('Sistema', `Pedido ${pedido.id} rechazado por el comercio`, 'pedido'),
      })
    },

    asignarRepartidor(pedidoId, repartidorId) {
      const pedido = this.pedidos.find((p) => p.id === pedidoId)
      if (!pedido) return Promise.resolve({ ok: false, error: null })
      return this.escribir({
        objetivos: [pedido],
        aplicar: () => {
          pedido.repartidorId = repartidorId
        },
        llamada: () => api.patch(`/orders/${pedidoId}/courier`, { courier_code: repartidorId }),
        exito: () => {
          const r = this.repartidorPorId(repartidorId)
          this.notificar(r ? `${r.nombre} fue asignado al pedido ${pedido.id}.` : 'Repartidor asignado.')
        },
      })
    },

    toggleRepartidorDisponible(repartidorId) {
      const r = this.repartidores.find((x) => x.id === repartidorId)
      if (!r) return Promise.resolve({ ok: false, error: null })
      const disponible = !r.disponible
      return this.escribir({
        objetivos: [r],
        aplicar: () => {
          r.disponible = disponible
        },
        llamada: () => api.patch(`/delivery/couriers/${repartidorId}/availability`, { is_available: disponible }),
      })
    },

    actualizarEstadoProducto(comercioId, productoId, disponible) {
      const prod = (this.catalogo[comercioId] || []).find((p) => p.id === productoId)
      return this.escribir({
        objetivos: [prod],
        aplicar: () => {
          if (prod) prod.disponible = disponible
        },
        llamada: () => api.put(`/catalog/products/${productoId}`, { is_available: disponible }),
      })
    },

    guardarProducto(comercioId, datos, productoId = null) {
      const lista = this.catalogo[comercioId] || []
      const precioBase = Number(datos.precioRegular ?? datos.precio)
      const tienePromoInput = datos.precioPromo !== undefined
      const promoNum =
        tienePromoInput && datos.precioPromo !== null && datos.precioPromo !== '' && Number(datos.precioPromo) > 0
          ? Number(datos.precioPromo)
          : null
      const precioEfectivo = promoNum && promoNum < precioBase ? promoNum : Number(datos.precio ?? precioBase)
      const body = {
        name: datos.nombre,
        price: precioBase,
        description: datos.descripcion || '',
        ...(datos.categoria !== undefined ? { category: datos.categoria || 'General' } : {}),
        ...(tienePromoInput ? { promo_price: promoNum } : {}),
      }
      const camposLocales = {
        ...datos,
        precio: precioEfectivo,
        ...(datos.precioRegular !== undefined || tienePromoInput ? { precioRegular: precioBase } : {}),
      }
      if (productoId) {
        const existente = lista.find((p) => p.id === productoId)
        return this.escribir({
          objetivos: [existente],
          aplicar: () => {
            if (existente) Object.assign(existente, camposLocales)
          },
          llamada: () => api.put(`/catalog/products/${productoId}`, body),
        })
      }
      const nuevo = { id: nextId('P'), disponible: true, ...camposLocales }
      return this.escribir({
        aplicar: () => lista.push(nuevo),
        llamada: () => api.post(`/catalog/merchants/${comercioId}/products`, { ...body, is_available: true }),
        exito: (data) => {
          if (data?.code) nuevo.id = data.code
        },
        revertir: () => {
          const i = lista.indexOf(nuevo)
          if (i >= 0) lista.splice(i, 1)
          else {
            const j = lista.findIndex((p) => p.id === nuevo.id)
            if (j >= 0) lista.splice(j, 1)
          }
        },
      })
    },

    eliminarProducto(comercioId, productoId) {
      const lista = this.catalogo[comercioId] || []
      const idx = lista.findIndex((p) => p.id === productoId)
      if (idx < 0) return Promise.resolve({ ok: false, error: null })
      const eliminado = lista[idx]
      return this.escribir({
        aplicar: () => lista.splice(idx, 1),
        llamada: () => api.delete(`/catalog/products/${productoId}`),
        revertir: () => lista.splice(idx, 0, eliminado),
      })
    },

    guardarHorarioComercio(comercioId, horario) {
      const c = this.comercios.find((x) => x.id === comercioId)
      const tieneAbierto = typeof horario.abierto === 'boolean'
      const body = {
        opens_at: horario.abre,
        closes_at: horario.cierra,
        ...(tieneAbierto ? { is_open: horario.abierto } : {}),
      }
      return this.escribir({
        objetivos: [c],
        aplicar: () => {
          if (c) {
            c.horario = { abre: horario.abre, cierra: horario.cierra }
            if (tieneAbierto) c.activo = horario.abierto
          }
        },
        llamada: () => api.put(`/merchants/${comercioId}/schedule`, body),
      })
    },

    cambiarAperturaComercio(comercioId, abierto) {
      const c = this.comercios.find((x) => x.id === comercioId)
      if (!c) return Promise.resolve({ ok: false, error: null })
      const abre = c.horario?.abre || '09:00'
      const cierra = c.horario?.cierra || '21:00'
      return this.escribir({
        objetivos: [c],
        aplicar: () => {
          c.activo = Boolean(abierto)
        },
        llamada: () =>
          api.put(`/merchants/${comercioId}/schedule`, {
            opens_at: abre,
            closes_at: cierra,
            is_open: Boolean(abierto),
          }),
      })
    },

    conciliarTransaccion(txId, estado) {
      const tx = this.transacciones.find((t) => t.id === txId)
      if (!tx) return Promise.resolve({ ok: false, error: null })
      return this.escribir({
        objetivos: [tx],
        aplicar: () => {
          tx.estado = estado
        },
        llamada: () => api.patch(`/payments/${txId}/status`, { status: estado === 'aprobado' ? 'pagado' : estado }),
        exito: () => this.registrarEvento('Contabilidad', `Transacción ${tx.id} marcada como ${estado}`, 'pago'),
      })
    },

    async descargarComprobantePDF(tx) {
      const txId = typeof tx === 'string' ? tx : tx?.id || 'TX-9001'
      try {
        const response = await api.get(`/payments/${txId}/receipt.pdf`, {
          responseType: 'blob',
        })
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `comprobante-${txId}.pdf`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
        this.notificar(`Comprobante ${txId}.pdf descargado.`)
        return true
      } catch {
        const lines = [
          'COMERCIOS UNIDOS DEL ISTMO, S.A. - GO EATS',
          `Comprobante Digital: ${txId}`,
          `Pedido: ${tx?.pedidoId || '-'}`,
          `Cliente: ${tx?.cliente || '-'}`,
          `Comercio: ${tx?.comercio || '-'}`,
          `Monto: B/ ${Number(tx?.monto || 0).toFixed(2)}`,
          `Comision: B/ ${Number(tx?.comision || 0).toFixed(2)}`,
          `Neto: B/ ${Number(tx?.total || 0).toFixed(2)}`,
        ]
        const stream = [
          'BT',
          '/F1 11 Tf',
          '50 750 Td',
          '16 TL',
          ...lines.map((l, i) => (i === 0 ? `(${l}) Tj` : `T* (${l}) Tj`)),
          'ET',
        ].join('\n')
        const pdf = `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj\n5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\nxref\n0 6\n0000000000 65535 f \ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF`
        const blob = new Blob([pdf], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `comprobante-${txId}.pdf`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
        this.notificar(`Comprobante ${txId}.pdf descargado.`)
        return true
      }
    },

    async resolverAfiliacion(id, aprobar) {
      const a = this.afiliaciones.find((x) => x.id === id)
      if (!a) return { ok: false, error: null }
      if (!aprobar) {
        a.estado = 'rechazado'
        this.registrarEvento('Admin', `Rechazó afiliación de ${a.nombre}`, a.tipo)
        return { ok: true, data: null }
      }
      const c = a.tipo === 'comercio' ? this.comercios.find((x) => x.nombre === a.nombre) : null
      const r = a.tipo === 'comercio' ? null : this.repartidores.find((x) => x.nombre === a.nombre)
      return this.escribir({
        objetivos: [a, c, r],
        aplicar: () => {
          a.estado = 'activo'
          if (c) {
            c.estadoAfiliacion = 'activo'
            c.activo = true
          }
          if (r) r.estadoAfiliacion = 'activo'
        },
        llamada: () => {
          if (c) return api.patch(`/merchants/${c.id}/affiliation`, { affiliation_status: 'activo', is_open: true })
          if (r) return api.patch(`/delivery/couriers/${r.id}/affiliation`, { affiliation_status: 'activo' })
          return Promise.resolve({ data: null }) // affiliation request with no linked entity: local only
        },
        exito: () => this.registrarEvento('Admin', `Aprobó afiliación de ${a.nombre}`, a.tipo),
      })
    },

    cambiarEstadoComercio(comercioId, suspendido) {
      const c = this.comercios.find((x) => x.id === comercioId)
      if (!c) return Promise.resolve({ ok: false, error: null })
      const estadoAfiliacion = suspendido ? 'suspendido' : 'activo'
      return this.escribir({
        objetivos: [c],
        aplicar: () => {
          c.activo = !suspendido
          c.estadoAfiliacion = estadoAfiliacion
        },
        llamada: () => api.patch(`/merchants/${comercioId}/affiliation`, { affiliation_status: estadoAfiliacion, is_open: !suspendido }),
        exito: () => this.registrarEvento('Admin', `${suspendido ? 'Suspendió' : 'Reactivó'} a ${c.nombre}`, 'comercio'),
      })
    },

    responderARCO(id, respuesta) {
      const s = this.solicitudesARCO.find((x) => x.id === id)
      if (!s) return Promise.resolve({ ok: false, error: null })
      const remoto = typeof id === 'number' || /^\d+$/.test(String(id))
      return this.escribir({
        objetivos: [s],
        aplicar: () => {
          s.estado = 'respondida'
          s.respuesta = respuesta
        },
        // Local-only requests (non-numeric ids) have no server counterpart.
        llamada: () => (remoto ? api.post(`/users/arco/${id}/resolve`, { admin_response: respuesta }) : Promise.resolve({ data: null })),
        exito: () => this.registrarEvento('Admin', `Respondió solicitud ARCO de ${s.usuario}`, 'arco'),
      })
    },

    async cargarMisSolicitudesARCO() {
      try {
        const { data } = await api.get('/users/me/arco')
        if (Array.isArray(data)) this.misSolicitudesARCO = data.map(mapArcoApi)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: toWriteError(err) }
      }
    },

    enviarSolicitudARCO(tipo, detalle) {
      const solicitud = {
        id: nextId('ARCO'),
        usuario: this.usuario.nombre,
        tipo,
        detalle,
        fecha: `Hoy, ${ahora()}`,
        estado: 'pendiente',
        respuesta: null,
      }
      const quitar = () => {
        const i = this.misSolicitudesARCO.findIndex((x) => x.id === solicitud.id)
        if (i >= 0) this.misSolicitudesARCO.splice(i, 1)
      }
      return this.escribir({
        accion: 'arco',
        aplicar: () => this.misSolicitudesARCO.unshift(solicitud),
        llamada: () => api.post('/users/me/arco', { request_type: tipo, detail: detalle }),
        revertir: quitar,
        exito: (data) => {
          const i = this.misSolicitudesARCO.findIndex((x) => x.id === solicitud.id)
          if (i >= 0 && data?.id) this.misSolicitudesARCO.splice(i, 1, mapArcoApi(data))
          this.notificar('Tu solicitud fue enviada. El administrador la responderá pronto.')
        },
      })
    },

    // GET /users/me/consent: the state shown in Perfil always comes from the server (null = unknown).
    async cargarConsentimiento() {
      try {
        const { data } = await api.get('/users/me/consent')
        this.usuario.consentimientoLey81 = data.accepted === true
        if (data.accepted === true) this.consentimientoRequerido = false
        return { ok: true, data }
      } catch (err) {
        return { ok: false, error: toWriteError(err) }
      }
    },

    // PUT /users/me/consent: revoke and re-grant are the same call (history is kept server-side).
    cambiarConsentimiento(aceptado) {
      return this.escribir({
        accion: 'consentimiento',
        objetivos: [this.usuario],
        aplicar: () => {
          this.usuario.consentimientoLey81 = aceptado
        },
        llamada: () => api.put('/users/me/consent', { accepted: aceptado }),
        exito: (data) => {
          this.usuario.consentimientoLey81 = data?.accepted ?? aceptado
          if (this.usuario.consentimientoLey81) this.consentimientoRequerido = false
        },
      })
    },

    // datos: { nombre, telefono, email? } and optionally the default delivery address { direccion, lat, lng }.
    // Address keys are only sent when present in `datos` (a personal-data save never touches them). Clearing =
    // direccion '' (sent as null) and lat/lng null; lat and lng always travel together (a lone one clears both).
    guardarPerfil(datos) {
      const body = { full_name: datos.nombre ?? this.usuario.nombre, phone: datos.telefono ?? this.usuario.telefono }
      const local = { ...datos, consentimientoLey81: this.usuario.consentimientoLey81 }
      if ('direccion' in datos) {
        const texto = (datos.direccion ?? '').trim()
        body.address = texto || null
        local.direccion = texto
      }
      if ('lat' in datos || 'lng' in datos) {
        const par = datos.lat != null && datos.lng != null
        body.lat = par ? datos.lat : null
        body.lng = par ? datos.lng : null
        local.lat = body.lat
        local.lng = body.lng
      }
      return this.escribir({
        accion: 'perfil',
        objetivos: [this.usuario],
        // The consent flag is owned by the server (cambiarConsentimiento), never by a profile form copy.
        aplicar: () => Object.assign(this.usuario, local),
        llamada: () => api.put('/users/me', body),
        exito: (data) => {
          if (data && 'address' in data) Object.assign(this.usuario, mapDireccionApi(data))
          this.notificar('Perfil actualizado correctamente.')
        },
      })
    },

    calificarPedido(pedidoId, estrellasComercio, estrellasRepartidor = null, comentario = '') {
      const p = this.pedidos.find((x) => x.id === pedidoId)
      if (!p) return Promise.resolve({ ok: false, error: null })
      return this.escribir({
        accion: `calificar:${pedidoId}`,
        objetivos: [p],
        aplicar: () => {
          p.calificacion = estrellasComercio
          p.calificacionComercio = estrellasComercio
          p.calificacionRepartidor = estrellasRepartidor ?? estrellasComercio
          p.comentarioCalificacion = comentario
        },
        llamada: () =>
          api.post(`/orders/${pedidoId}/rating`, {
            merchant_stars: estrellasComercio,
            courier_stars: estrellasRepartidor ?? estrellasComercio,
            comment: comentario || '',
          }),
      })
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
