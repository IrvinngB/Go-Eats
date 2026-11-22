<script setup>
import { ref, computed, onMounted } from 'vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import { kpis as kpisMock, actividadReciente } from '../../mockData'
import StatusBadge from '../../components/StatusBadge.vue'
import {
  Package,
  CircleDollarSign,
  Clock,
  Store,
  CreditCard,
  Key,
  FileText,
  Bike,
  Users,
  ShieldCheck,
  Search,
} from '@lucide/vue'

const store = useGoEatsStore()
const tab = ref('afiliaciones')

onMounted(() => {
  store.cargarPanelAdmin?.()
})

// RF-17: KPIs conectados a GET /reports/kpis con respaldo en datos vivos del store
const kpisVivos = computed(() => {
  if (store.kpisAdmin) return store.kpisAdmin
  return {
    pedidosDia: store.pedidos.length || kpisMock.pedidosDia,
    ingresosTotales:
      store.pedidos
        .filter((p) => !['cancelado', 'rechazado'].includes(p.estado))
        .reduce((acc, p) => acc + Number(p.total || 0), 0) || kpisMock.ingresosTotales,
    tiempoPromedioEntrega: kpisMock.tiempoPromedioEntrega,
    comerciosActivos: store.comercios.filter((c) => c.activo && c.estadoAfiliacion === 'activo').length || kpisMock.comerciosActivos,
  }
})

const tarjetas = computed(() => [
  { label: 'Pedidos registrados', valor: kpisVivos.value.pedidosDia, icono: Package, color: 'bg-brand-light text-brand-dark' },
  { label: 'Ingresos totales', valor: `B/ ${Number(kpisVivos.value.ingresosTotales).toFixed(2)}`, icono: CircleDollarSign, color: 'bg-emerald-50 text-emerald-600' },
  { label: 'Tiempo prom. de entrega', valor: kpisVivos.value.tiempoPromedioEntrega, icono: Clock, color: 'bg-blue-50 text-blue-600' },
  { label: 'Comercios activos', valor: kpisVivos.value.comerciosActivos, icono: Store, color: 'bg-amber-50 text-amber-600' },
])

const pendientes = computed(() => store.afiliaciones.filter((a) => a.estado === 'en_revision' || a.estado === 'pendiente'))
const resueltas = computed(() => store.afiliaciones.filter((a) => a.estado !== 'en_revision' && a.estado !== 'pendiente'))
const arcoPendientes = computed(() => store.solicitudesARCO.filter((s) => s.estado === 'pendiente'))

// RF-18: Búsqueda y filtro de usuarios
const busquedaUsuarios = ref('')
const rolFiltroUsuarios = ref('')
const usuariosFiltrados = computed(() => {
  const q = busquedaUsuarios.value.trim().toLowerCase()
  return (store.usuariosAdmin || []).filter((u) => {
    if (rolFiltroUsuarios.value && u.rol !== rolFiltroUsuarios.value) return false
    if (!q) return true
    return `${u.nombre} ${u.email} ${u.rol}`.toLowerCase().includes(q)
  })
})

// Filtro de auditoría
const tipoFiltroAuditoria = ref('')
const eventosFiltrados = computed(() => {
  if (!tipoFiltroAuditoria.value) return store.eventos
  return store.eventos.filter((e) => e.tipo === tipoFiltroAuditoria.value)
})

const responderModal = ref(null)
const respuestaARCO = ref('')

const ETIQUETA_ROL = {
  customer: 'Cliente',
  merchant: 'Comercio',
  courier: 'Repartidor',
  accountant: 'Contabilidad',
  admin: 'Admin',
}

async function resolver(a, aprobar) {
  const r = await store.resolverAfiliacion(a.id, aprobar)
  if (!r.ok) return
  store.notificar(aprobar ? `${a.nombre} fue aprobado.` : `Afiliación de ${a.nombre} rechazada.`)
}

async function toggleComercio(c, suspender) {
  const r = await store.cambiarEstadoComercio(c.id, suspender)
  if (r?.ok) store.notificar(suspender ? `Comercio ${c.nombre} suspendido.` : `Comercio ${c.nombre} reactivado.`)
}

async function toggleRepartidor(rep, suspender) {
  const r = await store.cambiarEstadoRepartidor(rep.id, suspender)
  if (r?.ok) store.notificar(suspender ? `Repartidor ${rep.nombre} suspendido.` : `Repartidor ${rep.nombre} reactivado.`)
}

async function toggleUsuario(u) {
  const nuevoEstado = !u.activo
  const r = await store.cambiarEstadoUsuario(u.id, nuevoEstado)
  if (r?.ok) store.notificar(nuevoEstado ? `Cuenta de ${u.nombre} reactivada.` : `Cuenta de ${u.nombre} suspendida.`)
}

function abrirResponder(s) {
  responderModal.value = s
  respuestaARCO.value = ''
}

async function enviarRespuesta() {
  if (!respuestaARCO.value.trim()) return
  const r = await store.responderARCO(responderModal.value.id, respuestaARCO.value)
  if (!r.ok) return
  store.notificar(`Respuesta enviada a ${responderModal.value.usuario}.`)
  responderModal.value = null
}

const tipoIcono = { pedido: Package, pago: CreditCard, acceso: Key, comercio: Store, arco: FileText }
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-6 pb-16">
    <!-- Cabecera ejecutiva estilo plataforma de delivery (RF-17 / RF-18) -->
    <div class="card overflow-hidden p-0">
      <div class="bg-emerald-500/15 border-b border-line/60 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <span class="grid place-items-center w-14 h-14 rounded-3xl bg-white text-brand shadow-sm border border-line">
            <ShieldCheck class="w-7 h-7" />
          </span>
          <div>
            <div class="flex items-center gap-2">
              <span class="rounded-full bg-white border border-line px-2.5 py-0.5 text-[11px] font-bold text-brand-dark">
                Gobernanza y Operaciones · Ley 81
              </span>
              <span class="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                {{ store.repartidoresDisponibles.length }} repartidores en línea
              </span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-ink mt-1">Panel administrativo</h1>
            <p class="text-xs text-slatebody mt-0.5">Supervisión general de comercios, repartidores, usuarios, derechos ARCO y métricas de Go Eats.</p>
          </div>
        </div>
      </div>

      <!-- KPIs operativos en vivo (RF-17) -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 p-5 bg-white" data-test="admin-kpis">
        <div v-for="k in tarjetas" :key="k.label" class="rounded-2xl border border-line bg-canvas/60 p-4 flex items-center gap-3.5">
          <span class="grid place-items-center w-11 h-11 rounded-2xl shrink-0" :class="k.color">
            <component :is="k.icono" class="w-5 h-5" />
          </span>
          <div>
            <p class="text-xs font-semibold text-slatebody">{{ k.label }}</p>
            <p class="text-xl font-extrabold text-ink">{{ k.valor }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs estilo píldora -->
    <div class="mt-6 flex flex-wrap gap-2 border-b border-line pb-3">
      <button
        v-for="t in [
          ['afiliaciones', `Afiliaciones (${pendientes.length})`],
          ['usuarios', `Usuarios (${store.usuariosAdmin.length})`],
          ['arco', `ARCO (${arcoPendientes.length})`],
          ['auditoria', 'Auditoría'],
        ]"
        :key="t[0]"
        type="button"
        :data-test="`admin-tab-${t[0]}`"
        class="rounded-full px-4 py-2 text-sm font-bold transition-all whitespace-nowrap"
        :class="tab === t[0] ? 'bg-brand text-white shadow-sm' : 'bg-white border border-line text-slatebody hover:text-ink'"
        @click="tab = t[0]"
      >
        {{ t[1] }}
      </button>
    </div>

    <!-- TAB 1: AFILIACIONES DE COMERCIOS Y REPARTIDORES (RF-18) -->
    <section v-if="tab === 'afiliaciones'" class="mt-6 space-y-8">
      <div>
        <h2 class="text-sm font-extrabold uppercase tracking-wide text-slatebody mb-3">
          Solicitudes pendientes de aprobación ({{ pendientes.length }})
        </h2>
        <div v-if="pendientes.length" class="grid gap-4 lg:grid-cols-2">
          <div v-for="a in pendientes" :key="a.id" class="card p-5 flex items-start gap-4">
            <span class="grid place-items-center w-12 h-12 rounded-2xl bg-brand-light text-brand shrink-0">
              <component :is="a.tipo === 'comercio' ? Store : Bike" class="w-6 h-6" />
            </span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-extrabold text-ink">{{ a.nombre }}</h3>
                <span class="rounded-full bg-canvas border border-line px-2 py-0.5 text-[11px] font-bold uppercase text-slatebody">{{ a.tipo }}</span>
                <StatusBadge :estado="a.estado" />
              </div>
              <p class="text-xs text-slatebody mt-1">{{ a.detalle }}</p>
              <p class="text-xs text-slatebody mt-0.5">{{ a.contacto }}</p>
              <div class="mt-3.5 flex gap-2">
                <button class="btn-primary !py-1.5 !px-3.5 text-xs" @click="resolver(a, true)">Aprobar</button>
                <button class="btn-danger-ghost !py-1.5 !px-3.5 text-xs" @click="resolver(a, false)">Rechazar</button>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-slatebody bg-canvas border border-line rounded-2xl p-6 text-center">
          No hay afiliaciones pendientes en este momento.
        </p>
      </div>

      <!-- Comercios de la plataforma (RF-18) -->
      <div>
        <h2 class="text-sm font-extrabold uppercase tracking-wide text-slatebody mb-3">
          Comercios de la plataforma ({{ store.comercios.length }})
        </h2>
        <div class="card overflow-x-auto" data-test="admin-merchants-table">
          <table class="w-full min-w-[600px]">
            <thead class="bg-canvas border-b border-line">
              <tr><th class="th">Comercio</th><th class="th">Categoría</th><th class="th">Zona</th><th class="th">Estado</th><th class="th text-right">Acción</th></tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="c in store.comercios" :key="c.id" class="hover:bg-canvas/50 transition-colors">
                <td class="td font-bold text-ink">{{ c.nombre }}</td>
                <td class="td text-xs text-slatebody">{{ c.tipo }}</td>
                <td class="td text-slatebody">{{ store.zonas.find((z) => z.id === c.zona)?.nombre || c.zona }}</td>
                <td class="td"><StatusBadge :estado="c.estadoAfiliacion" /></td>
                <td class="td text-right">
                  <button
                    v-if="c.estadoAfiliacion === 'activo'"
                    data-test="suspend-merchant-btn"
                    class="rounded-xl border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-100"
                    @click="toggleComercio(c, true)"
                  >Suspender</button>
                  <button
                    v-else
                    data-test="reactivate-merchant-btn"
                    class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                    @click="toggleComercio(c, false)"
                  >Reactivar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Repartidores de la plataforma (RF-18) -->
      <div>
        <h2 class="text-sm font-extrabold uppercase tracking-wide text-slatebody mb-3">
          Repartidores de la plataforma ({{ store.repartidores.length }})
        </h2>
        <div class="card overflow-x-auto" data-test="admin-couriers-table">
          <table class="w-full min-w-[600px]">
            <thead class="bg-canvas border-b border-line">
              <tr><th class="th">Repartidor</th><th class="th">Zona</th><th class="th">Disponibilidad</th><th class="th">Afiliación</th><th class="th text-right">Acción</th></tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="r in store.repartidores" :key="r.id" class="hover:bg-canvas/50 transition-colors">
                <td class="td font-bold text-ink">{{ r.nombre }}</td>
                <td class="td text-slatebody">{{ store.zonas.find((z) => z.id === r.zona)?.nombre || r.zona }}</td>
                <td class="td">
                  <span
                    class="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                    :class="r.disponible ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slatebody'"
                  >
                    {{ r.disponible ? 'En línea' : 'Desconectado' }}
                  </span>
                </td>
                <td class="td"><StatusBadge :estado="r.estadoAfiliacion" /></td>
                <td class="td text-right">
                  <button
                    v-if="r.estadoAfiliacion === 'activo'"
                    data-test="suspend-courier-btn"
                    class="rounded-xl border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-100"
                    @click="toggleRepartidor(r, true)"
                  >Suspender</button>
                  <button
                    v-else
                    data-test="reactivate-courier-btn"
                    class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                    @click="toggleRepartidor(r, false)"
                  >Reactivar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="resueltas.length">
        <h2 class="text-sm font-extrabold uppercase tracking-wide text-slatebody mb-3">Afiliaciones resueltas</h2>
        <div class="card divide-y divide-line">
          <div v-for="a in resueltas" :key="a.id" class="flex items-center justify-between px-4 py-3">
            <div>
              <p class="text-sm font-bold text-ink">{{ a.nombre }} <span class="text-xs text-slatebody font-normal">({{ a.tipo }})</span></p>
              <p class="text-xs text-slatebody">{{ a.detalle }}</p>
            </div>
            <StatusBadge :estado="a.estado" />
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 2: GESTIÓN DE CUENTAS DE USUARIO (RF-18) -->
    <section v-if="tab === 'usuarios'" class="mt-6 space-y-4">
      <div class="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div class="relative flex-1 min-w-[220px] max-w-md">
          <label for="admin-users-search" class="sr-only">Buscar usuario</label>
          <Search class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slatebody" />
          <input
            id="admin-users-search"
            v-model="busquedaUsuarios"
            data-test="admin-users-search"
            type="search"
            class="w-full rounded-full border border-line bg-canvas pl-10 pr-4 py-2 text-sm text-ink placeholder:text-slatebody/70 focus:border-brand focus:bg-white focus:outline-none"
            placeholder="Buscar por nombre o correo…"
          />
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="r in [['', 'Todos'], ['customer', 'Clientes'], ['merchant', 'Comercios'], ['courier', 'Repartidores'], ['accountant', 'Contabilidad'], ['admin', 'Admins']]"
            :key="r[0]"
            type="button"
            data-test="admin-users-role-chip"
            class="rounded-full border px-3 py-1 text-xs font-bold transition-colors"
            :class="rolFiltroUsuarios === r[0] ? 'bg-ink text-white border-ink' : 'bg-canvas text-ink border-line hover:border-brand/50'"
            @click="rolFiltroUsuarios = r[0]"
          >{{ r[1] }}</button>
        </div>
      </div>

      <div class="card overflow-x-auto" data-test="admin-users-table">
        <table class="w-full min-w-[640px]">
          <thead class="bg-canvas border-b border-line">
            <tr><th class="th">Usuario</th><th class="th">Correo</th><th class="th">Rol</th><th class="th">Estado</th><th class="th text-right">Acción</th></tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="u in usuariosFiltrados" :key="u.id" data-test="admin-user-row" class="hover:bg-canvas/50 transition-colors">
              <td class="td font-bold text-ink flex items-center gap-2">
                <Users class="w-4 h-4 text-brand shrink-0" />
                <span>{{ u.nombre }}</span>
              </td>
              <td class="td font-mono text-xs text-slatebody">{{ u.email }}</td>
              <td class="td">
                <span class="rounded-full bg-canvas border border-line px-2.5 py-0.5 text-xs font-bold text-ink">
                  {{ ETIQUETA_ROL[u.rol] || u.rol }}
                </span>
              </td>
              <td class="td">
                <span
                  data-test="admin-user-status"
                  class="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                  :class="u.activo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'"
                >
                  {{ u.activo ? 'Activo' : 'Suspendido' }}
                </span>
              </td>
              <td class="td text-right">
                <button
                  type="button"
                  data-test="toggle-user-status"
                  :disabled="u.id === store.usuario.id"
                  class="rounded-xl border px-3 py-1 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  :class="u.activo ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'"
                  @click="toggleUsuario(u)"
                >
                  {{ u.activo ? 'Suspender cuenta' : 'Reactivar cuenta' }}
                </button>
              </td>
            </tr>
            <tr v-if="usuariosFiltrados.length === 0">
              <td colspan="5" class="td text-center text-slatebody py-8">No se encontraron cuentas de usuario.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- TAB 3: DERECHOS ARCO (RF-09) -->
    <section v-if="tab === 'arco'" class="mt-6 space-y-3">
      <div v-for="s in store.solicitudesARCO" :key="s.id" class="card p-5 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-[220px] flex-1">
          <div class="flex items-center gap-2">
            <h3 class="font-extrabold text-ink text-sm">{{ s.usuario }}</h3>
            <span class="rounded-full bg-canvas border border-line px-2 py-0.5 text-[11px] font-bold text-slatebody">{{ s.tipo }}</span>
            <StatusBadge :estado="s.estado === 'respondida' ? 'aprobado' : 'pendiente'" />
          </div>
          <p class="text-sm text-slatebody mt-1.5">{{ s.detalle }}</p>
          <p class="text-[11px] text-slatebody/70 mt-1">{{ s.fecha }}</p>
          <p v-if="s.respuesta" class="mt-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2 font-medium">
            Respuesta: {{ s.respuesta }}
          </p>
        </div>
        <button v-if="s.estado === 'pendiente'" class="btn-primary !py-2 text-xs" @click="abrirResponder(s)">Responder</button>
      </div>

      <transition name="modal">
        <div v-if="responderModal" class="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" @click="responderModal = null">
          <div class="modal-panel card p-6 w-full max-w-md" @click.stop>
            <h3 class="font-extrabold text-lg text-ink">Responder solicitud ARCO</h3>
            <p class="text-sm text-slatebody mt-1">{{ responderModal.usuario }} · {{ responderModal.tipo }}</p>
            <textarea v-model="respuestaARCO" rows="4" class="input mt-4" placeholder="Escribe la respuesta oficial para el usuario…" />
            <div class="mt-5 grid grid-cols-2 gap-3">
              <button class="btn-secondary" @click="responderModal = null">Cancelar</button>
              <button class="btn-primary" :disabled="!respuestaARCO.trim()" @click="enviarRespuesta">Enviar respuesta</button>
            </div>
          </div>
        </div>
      </transition>
    </section>

    <!-- TAB 4: AUDITORÍA (RF-17) -->
    <section v-if="tab === 'auditoria'" class="mt-6 space-y-4">
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="f in [['', 'Todos'], ['pedido', 'Pedidos'], ['pago', 'Pagos'], ['comercio', 'Comercios'], ['acceso', 'Accesos'], ['arco', 'ARCO']]"
          :key="f[0]"
          type="button"
          class="rounded-full border px-3.5 py-1 text-xs font-bold transition-colors"
          :class="tipoFiltroAuditoria === f[0] ? 'bg-ink text-white border-ink' : 'bg-white text-slatebody border-line hover:text-ink'"
          @click="tipoFiltroAuditoria = f[0]"
        >{{ f[1] }}</button>
      </div>

      <div class="card overflow-x-auto">
        <table class="w-full min-w-[600px]">
          <thead class="bg-canvas border-b border-line">
            <tr><th class="th">Fecha</th><th class="th">Actor</th><th class="th">Evento</th><th class="th">Tipo</th></tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="e in eventosFiltrados" :key="e.id" class="hover:bg-canvas/50 transition-colors">
              <td class="td text-slatebody whitespace-nowrap">{{ e.fecha }}</td>
              <td class="td font-bold text-ink">{{ e.actor }}</td>
              <td class="td text-slatebody">{{ e.accion }}</td>
              <td class="td">
                <span class="inline-flex items-center gap-1 rounded-full bg-canvas border border-line px-2.5 py-0.5 text-xs font-semibold text-slatebody" :title="e.tipo">
                  <component :is="tipoIcono[e.tipo]" v-if="tipoIcono[e.tipo]" class="w-3.5 h-3.5 text-brand" />
                  <span>{{ e.tipo }}</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-slatebody/60">Registro inmutable de solo lectura. Los eventos más recientes aparecen primero.</p>
    </section>

    <!-- Actividad reciente -->
    <section class="mt-10">
      <h2 class="text-sm font-extrabold uppercase tracking-wide text-slatebody mb-3">Actividad reciente</h2>
      <div class="card divide-y divide-line">
        <div v-for="a in actividadReciente" :key="a.id" class="flex items-center gap-3 px-4 py-3">
          <span class="text-xs font-mono text-slatebody/70 w-20 shrink-0">{{ a.hora }}</span>
          <span class="text-sm text-ink">{{ a.texto }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
