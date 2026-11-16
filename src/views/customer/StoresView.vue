<script setup>
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import { useRouter } from 'vue-router'

const store = useGoEatsStore()
const router = useRouter()

function abrirTienda(c) {
  if (!c.activo || c.estadoAfiliacion !== 'activo') return
  const res = store.abrirTienda(c.id)
  if (!res.ok) {
    store.notificar(res.mensaje)
    return
  }
  router.push(`/tiendas/${c.id}`)
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8">
    <h1 class="text-2xl font-bold">Explora comercios cerca de ti</h1>
    <p class="text-sm text-slatebody mt-1">Elige tu zona para ver comercios disponibles y tarifas de envío.</p>

    <!-- Selector de zona -->
    <div class="mt-6 -mx-4 px-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
      <button
        v-for="z in store.zonas" :key="z.id"
        class="shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150"
        :class="store.zonaSeleccionada === z.id ? 'bg-brand text-white border-brand shadow-sm' : 'bg-white text-ink border-line hover:border-brand/50'"
        @click="store.seleccionarZona(z.id)"
      >
        {{ z.nombre }}
        <span class="ml-1.5 text-xs opacity-80">B/ {{ z.tarifa.toFixed(2) }}</span>
      </button>
    </div>

    <!-- Info de zona -->
    <div class="mt-5 card p-4 flex flex-wrap items-center gap-x-8 gap-y-2">
      <div class="flex items-center gap-2 text-sm">
        <svg class="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.6 7.2a8 8 0 10.4 6.4M18 3v4.4h-4.4" /></svg>
        <span class="font-semibold text-ink">{{ store.zonaActual.nombre }}</span>
      </div>
      <div class="text-sm"><span class="text-slatebody">Tarifa de envío: </span><span class="font-semibold text-ink">B/ {{ store.zonaActual.tarifa.toFixed(2) }}</span></div>
      <div class="text-sm"><span class="text-slatebody">Distancia aprox.: </span><span class="font-semibold text-ink">{{ store.zonaActual.distanciaKm }} km</span></div>
      <div class="text-sm"><span class="text-slatebody">Comercios activos: </span><span class="font-semibold text-ink">{{ store.comerciosPorZona.filter((c) => c.activo).length }}</span></div>
    </div>

    <!-- Grid de comercios -->
    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button
        v-for="c in store.comerciosPorZona" :key="c.id"
        class="card p-5 text-left transition-all duration-200 hover:shadow-md hover:border-brand/40 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        :disabled="!c.activo"
        @click="abrirTienda(c)"
      >
        <div class="flex items-start justify-between">
          <span class="grid place-items-center w-12 h-12 rounded-xl bg-brand-light text-2xl">{{ c.emoji }}</span>
          <span
            v-if="!c.activo"
            class="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
            :class="c.estadoAfiliacion === 'en_revision' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200'"
          >
            {{ c.estadoAfiliacion === 'en_revision' ? 'En revisión' : 'Cerrado' }}
          </span>
        </div>
        <h3 class="mt-3 font-semibold text-ink">{{ c.nombre }}</h3>
        <p class="text-xs text-slatebody mt-0.5">{{ c.tipo }}</p>
        <p class="text-xs text-slatebody mt-2 line-clamp-2">{{ c.descripcion }}</p>
        <div class="mt-3 pt-3 border-t border-line flex items-center gap-3 text-xs text-slatebody">
          <span class="flex items-center gap-1 text-amber-600 font-semibold">
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.1 3.4a1 1 0 00.95.7h3.6c.97 0 1.37 1.24.59 1.81l-2.9 2.1a1 1 0 00-.36 1.12l1.1 3.4c.3.92-.75 1.69-1.54 1.12l-2.9-2.1a1 1 0 00-1.18 0l-2.9 2.1c-.79.57-1.84-.2-1.54-1.12l1.1-3.4a1 1 0 00-.36-1.12L2.8 8.84c-.78-.57-.38-1.81.59-1.81h3.6a1 1 0 00.95-.7l1.1-3.4z"/></svg>
            {{ c.rating }}
          </span>
          <span class="flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            {{ c.tiempoEntrega }}
          </span>
        </div>
      </button>
    </div>
  </div>
</template>
