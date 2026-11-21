import { defineStore } from 'pinia'
import api, { tokenStorage } from '../services/api'
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

export const CUENTAS_DEMO = [
  { email: 'carlos@ejemplo.pa', role: 'customer', name: 'Carlos Andrade', label: 'Cliente (Carlos)', avatar: 'CA' },
  { email: 'hector.endara@ejemplo.pa', role: 'merchant', name: 'Héctor Endara', label: 'Comercio (Diablicos)', avatar: 'HE' },
  { email: 'maria.cedeno@ejemplo.pa', role: 'courier', name: 'María Cedeño', label: 'Repartidor (María)', avatar: 'MC' },
  { email: 'javier.morales@ejemplo.pa', role: 'courier', name: 'Javier Morales', label: 'Repartidor (Javier)', avatar: 'JM' },
  { email: 'contabilidad@goeats.pa', role: 'accountant', name: 'Marta Pinzón', label: 'Contabilidad (Marta)', avatar: 'MP' },
  { email: 'admin@goeats.pa', role: 'admin', name: 'Administrador General', label: 'Admin (Go Eats)', avatar: 'AG' },
]

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

    pedidosComoCliente: (s) => s.pedidos.filter((p) => p.clienteNombre === s.usuario.nombre || p.clienteEmail === s.usuario.email),
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

    async cambiarACuentaDemo(cuenta) {
      const res = await this.autenticarUsuario({
        email: cuenta.email,
        password: 'demo1234',
        nombre: cuenta.name,
        rolLocal: cuenta.role,
      })
      if (res.ok) {
        this.notificar(`Sesión activa: ${cuenta.name}`)
      }
      return res
    },

    cerrarSesion() {
      tokenStorage.clear()
      this.autenticado = false
      this.usuario = { nombre: 'Invitado', email: '', telefono: '', consentimientoLey81: false }
      this.rol = 'customer'
      this.notificar('Has cerrado sesión.')
    },

    async autenticarUsuario({ email, password, nombre, modoRegistro = false, aceptaPolitica = false, rolLocal = 'customer' }) {
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
          nombre: data.user.full_name,
          email: data.user.email,
          telefono: data.user.phone || '6123-4567',
          consentimientoLey81: true,
        }
        this.rol = data.user.role
        this.autenticado = true
        await this.sincronizarConBackend()
        return { ok: true, origen: 'api' }
      } catch (err) {
        if (err?.response?.status === 400 || err?.response?.status === 401 || err?.response?.status === 409) {
          return { ok: false, mensaje: err.response?.data?.detail || 'Credenciales inválidas.' }
        }
        // Fallback offline/demo cuando el backend no está levantado
        if (modoRegistro && nombre) this.usuario.nombre = nombre
        this.usuario.email = email
        this.rol = rolLocal
        this.autenticado = true
        return { ok: true, origen: 'local' }
      }
    },

    async sincronizarConBackend() {
      try {
        const [
          zonesRes,
          merchantsRes,
          couriersRes,
          productsRes,
          ordersRes,
          paymentsRes,
          arcoRes,
          auditRes,
        ] = await Promise.all([
          api.get('/zones/'),
          api.get('/merchants/'),
          api.get('/delivery/couriers'),
          api.get('/catalog/products'),
          api.get('/orders/'),
          api.get('/payments/'),
          api.get('/users/arco'),
          api.get('/reports/audit-logs'),
        ])
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
              precio: p.price,
              descripcion: p.description,
              categoria: p.category,
              disponible: p.is_available,
            })
          }
          this.catalogo = agrupado
        }
        if (Array.isArray(ordersRes.data) && ordersRes.data.length > 0) {
          this.pedidos = ordersRes.data.map((o) => ({
            id: o.code,
            comercioId: o.merchant_code,
            comercioNombre: o.merchant_name,
            clienteNombre: o.customer_name,
            clienteTelefono: o.customer_phone,
            zona: o.zone_slug,
            direccion: o.delivery_address,
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
            repartidorId: o.courier_code,
            observaciones: o.notes,
            motivoCancelacion: o.cancellation_reason,
            calificacion: o.rating?.merchant_stars || null,
            calificacionComercio: o.rating?.merchant_stars || null,
            calificacionRepartidor: o.rating?.courier_stars || null,
            fecha: new Date(o.created_at).toLocaleString('es-PA', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
          }))
        }
        if (Array.isArray(paymentsRes.data) && paymentsRes.data.length > 0) {
          this.transacciones = paymentsRes.data.map((t) => ({
            id: t.code,
            pedidoId: t.order_code,
            fecha: new Date(t.created_at).toLocaleString('es-PA', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
            cliente: t.customer_name,
            comercio: t.merchant_name,
            monto: t.total,
            comision: t.commission,
            total: Number((t.total - t.commission).toFixed(2)),
            estado: t.status === 'pagado' ? 'aprobado' : t.status === 'fallido' ? 'rechazado' : 'pendiente',
            metodo: t.method === 'contr_entrega' ? 'contr_entrega' : 'electronico',
            referencia: t.provider_reference || '—',
          }))
        }
        if (Array.isArray(arcoRes.data) && arcoRes.data.length > 0) {
          this.solicitudesARCO = arcoRes.data.map((a) => ({
            id: a.id,
            usuario: a.user_name,
            tipo: a.request_type,
            detalle: a.detail,
            estado: a.status,
            respuesta: a.admin_response,
            fecha: new Date(a.created_at).toLocaleString('es-PA', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
          }))
        }
        if (Array.isArray(auditRes.data) && auditRes.data.length > 0) {
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
      } catch {
        // Silencioso si el backend no está activo (modo PWA offline/demo)
      }
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
      api
        .post('/orders/', {
          merchant_code: comercio.id,
          merchant_name: comercio.nombre,
          customer_name: this.usuario.nombre,
          customer_phone: this.usuario.telefono,
          zone_slug: this.zonaSeleccionada,
          delivery_address: direccion,
          notes: observaciones || '',
          payment_method: metodoPago === 'electronico' ? 'tarjeta' : 'contr_entrega',
          delivery_fee: tarifa,
          items: this.carrito.map((i) => ({
            product_code: String(i.id),
            name: i.nombre,
            unit_price: i.precio,
            quantity: i.cantidad,
            notes: i.observacion || '',
          })),
        })
        .catch(() => {})
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
      api
        .patch(`/orders/${pedidoId}/status`, {
          status: nuevoEstado,
          reason: extra.motivoCancelacion || null,
        })
        .catch(() => {})
    },

    rechazarPedido(pedidoId, motivo) {
      const pedido = this.pedidos.find((p) => p.id === pedidoId)
      if (!pedido) return
      pedido.estado = 'cancelado'
      pedido.motivoCancelacion = motivo
      this.registrarEvento('Sistema', `Pedido ${pedido.id} rechazado por el comercio`, 'pedido')
      api.patch(`/orders/${pedidoId}/status`, { status: 'rechazado', reason: motivo }).catch(() => {})
    },

    asignarRepartidor(pedidoId, repartidorId) {
      const pedido = this.pedidos.find((p) => p.id === pedidoId)
      if (!pedido) return
      pedido.repartidorId = repartidorId
      const r = this.repartidorPorId(repartidorId)
      this.notificar(r ? `${r.nombre} fue asignado al pedido ${pedido.id}.` : 'Repartidor asignado.')
      api.patch(`/orders/${pedidoId}/courier`, { courier_code: repartidorId }).catch(() => {})
    },

    toggleRepartidorDisponible(repartidorId) {
      const r = this.repartidores.find((x) => x.id === repartidorId)
      if (!r) return
      r.disponible = !r.disponible
      api
        .patch(`/delivery/couriers/${repartidorId}/availability`, { is_available: r.disponible })
        .catch(() => {})
    },

    actualizarEstadoProducto(comercioId, productoId, disponible) {
      const prod = (this.catalogo[comercioId] || []).find((p) => p.id === productoId)
      if (prod) prod.disponible = disponible
      api.put(`/catalog/products/${productoId}`, { is_available: disponible }).catch(() => {})
    },

    guardarProducto(comercioId, datos, productoId = null) {
      const lista = this.catalogo[comercioId] || []
      if (productoId) {
        const idx = lista.findIndex((p) => p.id === productoId)
        if (idx >= 0) Object.assign(lista[idx], datos)
        api
          .put(`/catalog/products/${productoId}`, {
            name: datos.nombre,
            price: Number(datos.precio),
            description: datos.descripcion || '',
          })
          .catch(() => {})
      } else {
        lista.push({ id: nextId('P'), disponible: true, ...datos })
        api
          .post(`/catalog/merchants/${comercioId}/products`, {
            name: datos.nombre,
            price: Number(datos.precio),
            description: datos.descripcion || '',
            is_available: true,
          })
          .catch(() => {})
      }
    },

    guardarHorarioComercio(comercioId, horario) {
      const c = this.comercios.find((x) => x.id === comercioId)
      if (c) c.horario = { ...horario }
      api
        .put(`/merchants/${comercioId}/schedule`, {
          opens_at: horario.abre,
          closes_at: horario.cierra,
        })
        .catch(() => {})
    },

    conciliarTransaccion(txId, estado) {
      const tx = this.transacciones.find((t) => t.id === txId)
      if (!tx) return
      tx.estado = estado
      this.registrarEvento('Contabilidad', `Transacción ${tx.id} marcada como ${estado}`, 'pago')
      api
        .patch(`/payments/${txId}/status`, {
          status: estado === 'aprobado' ? 'pagado' : estado,
        })
        .catch(() => {})
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

    resolverAfiliacion(id, aprobar) {
      const a = this.afiliaciones.find((x) => x.id === id)
      if (!a) return
      if (aprobar) {
        a.estado = 'activo'
        if (a.tipo === 'comercio') {
          const c = this.comercios.find((x) => x.nombre === a.nombre)
          if (c) {
            c.estadoAfiliacion = 'activo'
            c.activo = true
            api
              .patch(`/merchants/${c.id}/affiliation`, { affiliation_status: 'activo', is_open: true })
              .catch(() => {})
          }
        } else {
          const r = this.repartidores.find((x) => x.nombre === a.nombre)
          if (r) {
            r.estadoAfiliacion = 'activo'
            api
              .patch(`/delivery/couriers/${r.id}/affiliation`, { affiliation_status: 'activo' })
              .catch(() => {})
          }
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
      api
        .patch(`/merchants/${comercioId}/affiliation`, {
          affiliation_status: c.estadoAfiliacion,
          is_open: c.activo,
        })
        .catch(() => {})
    },

    responderARCO(id, respuesta) {
      const s = this.solicitudesARCO.find((x) => x.id === id)
      if (!s) return
      s.estado = 'respondida'
      s.respuesta = respuesta
      this.registrarEvento('Admin', `Respondió solicitud ARCO de ${s.usuario}`, 'arco')
      if (typeof id === 'number' || /^\d+$/.test(String(id))) {
        api.post(`/users/arco/${id}/resolve`, { admin_response: respuesta }).catch(() => {})
      }
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
      api.post('/users/me/arco', { request_type: tipo, detail: detalle }).catch(() => {})
    },

    guardarPerfil(datos) {
      Object.assign(this.usuario, datos)
      this.notificar('Perfil actualizado correctamente.')
      api
        .put('/users/me', {
          full_name: this.usuario.nombre,
          phone: this.usuario.telefono,
        })
        .catch(() => {})
    },

    calificarPedido(pedidoId, estrellasComercio, estrellasRepartidor = null, comentario = '') {
      const p = this.pedidos.find((x) => x.id === pedidoId)
      if (!p) return
      p.calificacion = estrellasComercio
      p.calificacionComercio = estrellasComercio
      p.calificacionRepartidor = estrellasRepartidor ?? estrellasComercio
      p.comentarioCalificacion = comentario
      api
        .post(`/orders/${pedidoId}/rating`, {
          merchant_stars: estrellasComercio,
          courier_stars: estrellasRepartidor ?? estrellasComercio,
          comment: comentario || '',
        })
        .catch(() => {})
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
