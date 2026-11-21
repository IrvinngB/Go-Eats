<script setup>
import { onMounted, onBeforeUnmount, watch, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  COORDENADAS_ZONAS,
  CENTRO_PANAMA,
  getCoordenadasComercio,
  encontrarZonaMasCercana,
} from '../utils/geo'
import { TILE_URL, TILE_ATTRIBUTION } from '../utils/mapTiles'
import { formatRating } from '../utils/catalog'
import { Navigation, Locate, Store, Bike, Home, CheckCircle2, Route } from '@lucide/vue'

const props = defineProps({
  modo: {
    type: String,
    default: 'coverage', // 'coverage' | 'tracking'
  },
  zonaSeleccionada: {
    type: String,
    default: 'san-francisco',
  },
  comercios: {
    type: Array,
    default: () => [],
  },
  pedido: {
    type: Object,
    default: null,
  },
  altura: {
    type: String,
    default: '420px',
  },
  // Static, read-only rendering for the public landing: no interaction, controls or geolocation.
  estatico: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['seleccionar-comercio', 'seleccionar-zona', 'geolocalizado'])

const contenedorMapa = ref(null)
const geolocalizando = ref(false)
const gpsInfo = ref(null)
const progresoAnimacion = ref(0.65) // posición del repartidor entre origen y destino

let mapa = null
let capaZonas = null
let capaComercios = null
let capaTracking = null
let marcadorUsuario = null
let animacionIntervalo = null

function crearIconoComercio(comercio, activo) {
  const color = activo ? '#00B19D' : '#94A3B8'
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="background: white; border: 2px solid ${color}; color: #0F172A; font-weight: 700; font-size: 11px; padding: 2px 7px; border-radius: 9999px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
          <span>⭐ ${formatRating(comercio.rating || 4.5)}</span>
          <span style="max-width: 110px; overflow: hidden; text-overflow: ellipsis;">${comercio.nombre}</span>
        </div>
        <div style="width: 14px; height: 14px; background: ${color}; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.3); margin-top: -3px;"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function crearIconoTracking(tipo, label) {
  let bg = '#00B19D'
  let emoji = '🏪'
  if (tipo === 'courier') {
    bg = '#3B82F6'
    emoji = '🛵'
  } else if (tipo === 'destination') {
    bg = '#EF4444'
    emoji = '📍'
  }

  return L.divIcon({
    className: 'custom-tracking-marker',
    html: `
      <div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center;">
        <div style="background: white; border: 2px solid ${bg}; color: #0F172A; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); white-space: nowrap;">
          ${emoji} ${label}
        </div>
        <div style="width: 18px; height: 18px; background: ${bg}; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); margin-top: -4px;"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function inicializarMapa() {
  if (!contenedorMapa.value || mapa) return

  mapa = L.map(contenedorMapa.value, {
    zoomControl: false,
    attributionControl: false,
    ...(props.estatico && {
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    }),
  }).setView([CENTRO_PANAMA.lat, CENTRO_PANAMA.lng], 13)

  if (!props.estatico) L.control.zoom({ position: 'bottomright' }).addTo(mapa)

  // Capa base: ver utils/mapTiles.ts (OSM por defecto, configurable por env)
  L.tileLayer(TILE_URL, {
    maxZoom: 19,
    attribution: TILE_ATTRIBUTION,
  }).addTo(mapa)

  capaZonas = L.layerGroup().addTo(mapa)
  capaComercios = L.layerGroup().addTo(mapa)
  capaTracking = L.layerGroup().addTo(mapa)

  if (props.estatico) {
    renderizarZonas()
    mapa.fitBounds(capaZonas.getLayers().map((c) => c.getBounds()).reduce((a, b) => a.extend(b)), { animate: false })
  } else if (props.modo === 'coverage') {
    renderizarZonas()
    renderizarComercios()
  } else if (props.modo === 'tracking') {
    renderizarTracking()
  }
}

function renderizarZonas() {
  if (!mapa || !capaZonas) return
  capaZonas.clearLayers()

  for (const [slug, z] of Object.entries(COORDENADAS_ZONAS)) {
    const esSeleccionada = props.zonaSeleccionada === slug
    const circulo = L.circle([z.lat, z.lng], {
      radius: z.radioM,
      color: z.color,
      fillColor: z.color,
      fillOpacity: esSeleccionada ? 0.25 : 0.08,
      weight: esSeleccionada ? 2.5 : 1,
      interactive: !props.estatico,
    })

    circulo.bindTooltip(
      `<strong>${z.nombre}</strong><br><span style="font-size: 11px; opacity: 0.85;">Zona de cobertura</span>`,
      { sticky: true }
    )

    circulo.on('click', () => {
      emit('seleccionar-zona', slug)
    })

    capaZonas.addLayer(circulo)
  }
}

function renderizarComercios() {
  if (!mapa || !capaComercios) return
  capaComercios.clearLayers()

  const comerciosMostrar = props.comercios.length > 0 ? props.comercios : []

  for (const c of comerciosMostrar) {
    const coords = getCoordenadasComercio(c.id, c.zona)
    const marcador = L.marker([coords.lat, coords.lng], {
      icon: crearIconoComercio(c, c.activo),
    })

    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px; min-width: 170px;">
        <strong style="color: #0F172A; font-size: 14px; display: block;">${c.nombre}</strong>
        <span style="color: #64748B; font-size: 11px; display: block; margin-top: 2px;">${c.tipo || ''}</span>
        <div style="margin-top: 6px; display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 600; color: #D97706;">★ ${formatRating(c.rating || 4.5)}</span>
          <span style="color: #64748B;">⏱️ ${c.tiempoEntrega || '20-35 min'}</span>
        </div>
        <button id="btn-ver-${c.id}" style="margin-top: 10px; width: 100%; background: #00B19D; color: #0B2B33; border: none; border-radius: 6px; padding: 6px 10px; min-height: 44px; font-weight: 600; font-size: 12px; cursor: pointer;">
          Ver menú y pedir
        </button>
      </div>
    `

    marcador.bindPopup(popupHtml)
    marcador.on('popupopen', () => {
      const btn = document.getElementById(`btn-ver-${c.id}`)
      if (btn) {
        btn.onclick = () => {
          emit('seleccionar-comercio', c)
        }
      }
    })

    capaComercios.addLayer(marcador)
  }

  // Centrar en la zona seleccionada
  const zInfo = COORDENADAS_ZONAS[props.zonaSeleccionada]
  if (zInfo && mapa) {
    mapa.flyTo([zInfo.lat, zInfo.lng], 14, { duration: 0.8 })
  }
}

function renderizarTracking() {
  if (!mapa || !capaTracking || !props.pedido) return
  capaTracking.clearLayers()

  const slugZona = props.pedido.zona || 'san-francisco'
  const origen = getCoordenadasComercio(props.pedido.comercioId || 'c1', slugZona)
  const destino = {
    lat: +(origen.lat - 0.009).toFixed(5),
    lng: +(origen.lng - 0.007).toFixed(5),
  }

  // Posición actual interpolada del repartidor
  const t = progresoAnimacion.value
  const courierLat = origen.lat + (destino.lat - origen.lat) * t
  const courierLng = origen.lng + (destino.lng - origen.lng) * t

  // 1. Marcador Origen (Comercio)
  const mOrigen = L.marker([origen.lat, origen.lng], {
    icon: crearIconoTracking('store', props.pedido.comercioNombre || 'Restaurante'),
  })
  capaTracking.addLayer(mOrigen)

  // 2. Marcador Destino (Cliente)
  const mDestino = L.marker([destino.lat, destino.lng], {
    icon: crearIconoTracking('destination', props.pedido.direccionEntrega || 'Entrega'),
  })
  capaTracking.addLayer(mDestino)

  // 3. Marcador Repartidor
  const mCourier = L.marker([courierLat, courierLng], {
    icon: crearIconoTracking('courier', `${props.pedido.repartidorNombre || 'Repartidor'} (demo)`),
  })
  capaTracking.addLayer(mCourier)

  // 4. Ruta (Polyline)
  const rutaRecorrida = L.polyline(
    [
      [origen.lat, origen.lng],
      [courierLat, courierLng],
    ],
    { color: '#3B82F6', weight: 4, opacity: 0.8 }
  )
  const rutaRestante = L.polyline(
    [
      [courierLat, courierLng],
      [destino.lat, destino.lng],
    ],
    { color: '#94A3B8', weight: 4, dashArray: '6, 8', opacity: 0.7 }
  )

  capaTracking.addLayer(rutaRecorrida)
  capaTracking.addLayer(rutaRestante)

  const bounds = L.latLngBounds([
    [origen.lat, origen.lng],
    [destino.lat, destino.lng],
    [courierLat, courierLng],
  ])
  mapa.fitBounds(bounds, { padding: [40, 40] })
}

function geolocalizarUsuario() {
  if (!navigator.geolocation) {
    alert('Tu navegador no soporta geolocalización.')
    return
  }

  geolocalizando.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      geolocalizando.value = false
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude

      const zona = encontrarZonaMasCercana(lat, lng)
      gpsInfo.value = {
        lat: +lat.toFixed(4),
        lng: +lng.toFixed(4),
        zona: zona.slug,
        distanciaKm: zona.distanciaKm,
      }

      if (marcadorUsuario && mapa) {
        mapa.removeLayer(marcadorUsuario)
      }

      const iconoUser = L.divIcon({
        className: 'user-gps-marker',
        html: `
          <div style="position: relative; width: 22px; height: 22px;">
            <div style="position: absolute; inset: -4px; background: rgba(0, 177, 157, 0.35); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 22px; height: 22px; background: #00B19D; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })

      if (mapa) {
        marcadorUsuario = L.marker([lat, lng], { icon: iconoUser })
          .addTo(mapa)
          .bindTooltip(`📍 Estás aquí (Zona más cercana: ${zona.slug})`, { permanent: true, direction: 'top' })
          .openTooltip()

        mapa.flyTo([lat, lng], 14, { duration: 1 })
      }

      emit('geolocalizado', { lat, lng, zona: zona.slug })
      emit('seleccionar-zona', zona.slug)
    },
    (err) => {
      geolocalizando.value = false
      // Si el usuario rechaza o estamos en localhost sin permisos, usamos centro de Panamá con zona San Francisco
      console.warn('Geolocalización no disponible:', err.message)
      const lat = CENTRO_PANAMA.lat
      const lng = CENTRO_PANAMA.lng
      gpsInfo.value = { lat, lng, zona: 'san-francisco', distanciaKm: 1.2 }
      emit('seleccionar-zona', 'san-francisco')
      if (mapa) {
        mapa.flyTo([lat, lng], 14, { duration: 1 })
      }
    },
    { timeout: 7000, enableHighAccuracy: true }
  )
}

function recentrar() {
  if (!mapa) return
  if (props.modo === 'tracking') {
    renderizarTracking()
  } else {
    const zInfo = COORDENADAS_ZONAS[props.zonaSeleccionada] || CENTRO_PANAMA
    mapa.flyTo([zInfo.lat, zInfo.lng], 13, { duration: 0.8 })
  }
}

watch(
  () => props.zonaSeleccionada,
  () => {
    if (props.modo === 'coverage') {
      renderizarZonas()
      renderizarComercios()
    }
  }
)

watch(
  () => props.comercios,
  () => {
    if (props.modo === 'coverage') {
      renderizarComercios()
    }
  },
  { deep: true }
)

watch(
  () => props.pedido,
  () => {
    if (props.modo === 'tracking') {
      renderizarTracking()
    }
  },
  { deep: true }
)

onMounted(() => {
  inicializarMapa()

  // Si está en modo tracking, simular avance leve del repartidor cada 3 segundos
  if (props.modo === 'tracking') {
    animacionIntervalo = setInterval(() => {
      progresoAnimacion.value = Math.min(0.92, progresoAnimacion.value + 0.05)
      renderizarTracking()
    }, 3500)
  }
})

onBeforeUnmount(() => {
  if (animacionIntervalo) clearInterval(animacionIntervalo)
  if (mapa) {
    mapa.remove()
    mapa = null
  }
})
</script>

<template>
  <div class="relative w-full rounded-2xl overflow-hidden border border-line shadow-card bg-slate-50">
    <!-- Contenedor Leaflet -->
    <div ref="contenedorMapa" class="w-full" :style="{ height: altura }" />

    <!-- Barra de Controles Flotante Superior -->
    <div v-if="!estatico" class="absolute top-3 left-3 z-[400] flex items-center gap-2">
      <button
        v-if="modo === 'coverage'"
        class="inline-flex items-center justify-center gap-1.5 bg-white min-h-[44px] min-w-[44px] px-4 rounded-full text-sm font-semibold text-ink border border-line hover:border-brand transition-colors"
        :disabled="geolocalizando"
        @click="geolocalizarUsuario"
      >
        <Locate class="w-4 h-4 text-brand-dark" :class="{ 'animate-spin': geolocalizando }" />
        <span>{{ geolocalizando ? 'Buscando GPS...' : 'Mi ubicación' }}</span>
      </button>

      <button
        class="inline-flex items-center justify-center gap-1.5 bg-white min-h-[44px] min-w-[44px] px-4 rounded-full text-sm font-semibold text-ink border border-line hover:border-brand transition-colors"
        @click="recentrar"
      >
        <Navigation class="w-4 h-4 text-slatebody" />
        <span>Centrar</span>
      </button>
    </div>

    <!-- Badge Informativo Inferior -->
    <p
      v-if="estatico"
      data-test="map-attribution"
      class="absolute bottom-0 right-0 z-[400] m-0 bg-white px-2 py-1 text-[11px] text-slatebody"
    >
      {{ TILE_ATTRIBUTION }}
    </p>

    <div
      v-else-if="modo === 'tracking' && pedido"
      class="absolute bottom-3 left-3 right-3 z-[400] bg-white border border-line rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
    >
      <div class="flex items-center gap-2.5">
        <span class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 grid place-items-center shrink-0">
          <Bike class="w-4 h-4" />
        </span>
        <div>
          <p class="font-bold text-ink">{{ pedido.repartidorNombre || 'Repartidor en camino' }}</p>
          <p class="text-slatebody">
            <span data-test="map-simulated" class="font-semibold">Posición simulada (demo)</span>
            · {{ pedido.comercioNombre }}
          </p>
        </div>
      </div>
      <span data-test="map-transit" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold text-[11px] shrink-0">
        <Route class="w-3.5 h-3.5" aria-hidden="true" />
        En tránsito
      </span>
    </div>

    <div
      v-else-if="gpsInfo"
      class="absolute bottom-3 left-3 z-[400] bg-white border border-line rounded-lg px-3 py-1.5 text-[11px] text-slatebody"
    >
      GPS: {{ gpsInfo.lat }}, {{ gpsInfo.lng }} · Zona más cercana:
      <strong class="text-brand-dark uppercase">{{ gpsInfo.zona }}</strong>
    </div>
  </div>
</template>

<style>
@keyframes ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}
.custom-leaflet-marker, .custom-tracking-marker, .user-gps-marker {
  background: transparent;
  border: none;
}
.leaflet-popup-content-wrapper {
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
  border: 1px solid #E2E8F0;
}
.leaflet-popup-content {
  margin: 12px 14px;
}
</style>
