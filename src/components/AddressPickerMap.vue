<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
// @ts-expect-error geo.js ships no type declarations
import { CENTRO_PANAMA, puntoEnCobertura } from '../utils/geo'
import { TILE_URL, TILE_ATTRIBUTION } from '../utils/mapTiles'
import { CircleAlert, Info, MapPinOff } from '@lucide/vue'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import './catalog/catalog.css'

type Pin = { lat: number; lng: number }

const props = withDefaults(
  defineProps<{
    modelValue: Pin | null
    disabled?: boolean
    altura?: string
  }>(),
  { disabled: false, altura: '280px' },
)

const emit = defineEmits<{ 'update:modelValue': [value: Pin | null] }>()

let seq = 0
const uid = `address-picker-${++seq}-${Math.random().toString(36).slice(2, 7)}`
const idLat = `${uid}-lat`
const idLng = `${uid}-lng`
const idError = `${uid}-error`
const idHint = `${uid}-hint`

const contenedorMapa = ref<HTMLElement | null>(null)
const pin = ref<Pin | null>(props.modelValue ? { ...props.modelValue } : null)
const latTxt = ref(props.modelValue ? String(props.modelValue.lat) : '')
const lngTxt = ref(props.modelValue ? String(props.modelValue.lng) : '')

let mapa: L.Map | null = null
let marcador: L.Marker | null = null

const redondear = (n: number) => Math.round(n * 1e6) / 1e6
const mismoPin = (a: Pin | null, b: Pin | null) => (a === null || b === null ? a === b : a.lat === b.lat && a.lng === b.lng)

type Validacion = { error: string; latMal: boolean; lngMal: boolean; valor: Pin | null }

function validar(latStr: string, lngStr: string): Validacion {
  const a = latStr.trim().replace(',', '.')
  const b = lngStr.trim().replace(',', '.')
  if (a === '' && b === '') return { error: '', latMal: false, lngMal: false, valor: null }
  if (a === '' || b === '') {
    return { error: 'Ingresa latitud y longitud juntas, o deja ambas vacías.', latMal: a === '', lngMal: b === '', valor: null }
  }
  const la = Number(a)
  const ln = Number(b)
  if (!Number.isFinite(la)) return { error: 'La latitud debe ser un número.', latMal: true, lngMal: false, valor: null }
  if (la < -90 || la > 90) return { error: 'La latitud debe estar entre -90 y 90.', latMal: true, lngMal: false, valor: null }
  if (!Number.isFinite(ln)) return { error: 'La longitud debe ser un número.', latMal: false, lngMal: true, valor: null }
  if (ln < -180 || ln > 180) return { error: 'La longitud debe estar entre -180 y 180.', latMal: false, lngMal: true, valor: null }
  return { error: '', latMal: false, lngMal: false, valor: { lat: redondear(la), lng: redondear(ln) } }
}

const validacion = computed(() => validar(latTxt.value, lngTxt.value))
const enCobertura = computed(() => (pin.value ? puntoEnCobertura(pin.value.lat, pin.value.lng) : true))
const hayAlgo = computed(() => pin.value !== null || latTxt.value !== '' || lngTxt.value !== '')

function crearIcono() {
  return L.divIcon({
    className: 'address-picker-marker',
    // Destination pin in the brand indigo (desing.md map tile); styled by .cx-pin-marker in catalog.css.
    html: '<div class="cx-pin-marker"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function dibujarPin() {
  if (!mapa) return
  if (!pin.value) {
    if (marcador) {
      mapa.removeLayer(marcador)
      marcador = null
    }
    return
  }
  const ll: L.LatLngExpression = [pin.value.lat, pin.value.lng]
  if (marcador) {
    marcador.setLatLng(ll)
    return
  }
  // keyboard:false: the marker would be a tab stop that does nothing; the typed inputs are the keyboard path.
  marcador = L.marker(ll, { icon: crearIcono(), draggable: !props.disabled, keyboard: false }).addTo(mapa)
  marcador.on('dragend', () => {
    if (!marcador || props.disabled) return
    const p = marcador.getLatLng().wrap()
    fijarDesdeMapa({ lat: redondear(p.lat), lng: redondear(p.lng) })
  })
}

// Click or drag: the map is the source, so the inputs follow.
function fijarDesdeMapa(valor: Pin) {
  pin.value = valor
  latTxt.value = String(valor.lat)
  lngTxt.value = String(valor.lng)
  dibujarPin()
  emit('update:modelValue', valor)
}

function alEscribir() {
  const v = validacion.value
  if (v.error) return
  if (mismoPin(v.valor, pin.value)) return
  pin.value = v.valor
  dibujarPin()
  if (v.valor && mapa) mapa.panTo([v.valor.lat, v.valor.lng], { animate: false })
  emit('update:modelValue', v.valor)
}

function quitarPin() {
  latTxt.value = ''
  lngTxt.value = ''
  alEscribir()
}

watch(
  () => props.modelValue,
  (v) => {
    if (mismoPin(v, pin.value)) return
    pin.value = v ? { ...v } : null
    latTxt.value = v ? String(v.lat) : ''
    lngTxt.value = v ? String(v.lng) : ''
    dibujarPin()
    if (v && mapa) mapa.panTo([v.lat, v.lng], { animate: false })
  },
  { deep: true },
)

watch(
  () => props.disabled,
  (d) => {
    if (!marcador?.dragging) return
    if (d) marcador.dragging.disable()
    else marcador.dragging.enable()
  },
)

onMounted(() => {
  if (!contenedorMapa.value) return
  const inicio = pin.value ?? CENTRO_PANAMA
  mapa = L.map(contenedorMapa.value, { zoomControl: false, attributionControl: false }).setView(
    [inicio.lat, inicio.lng],
    pin.value ? 15 : 13,
  )
  L.control.zoom({ position: 'bottomright' }).addTo(mapa)
  // Capa base: ver utils/mapTiles.ts. Es la unica peticion de red del selector (sin geocodificacion ni claves).
  L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(mapa)

  mapa.on('click', (e: L.LeafletMouseEvent) => {
    if (props.disabled) return
    const p = e.latlng.wrap()
    fijarDesdeMapa({ lat: redondear(p.lat), lng: redondear(p.lng) })
  })
  dibujarPin()
})

onBeforeUnmount(() => {
  if (mapa) {
    mapa.remove()
    mapa = null
    marcador = null
  }
})
</script>

<template>
  <!-- Own .cx scope so the tokens resolve even when the picker is mounted outside a catalog view. -->
  <div role="group" aria-label="Ubicación de entrega en el mapa" class="cx cx-embed cx-stack" style="gap: 12px">
    <div class="cx-mapbox">
      <div
        ref="contenedorMapa"
        data-test="map-canvas"
        role="region"
        aria-label="Mapa: haz clic para fijar la ubicación de entrega"
        :aria-describedby="idHint"
        style="width: 100%"
        :style="{ height: altura }"
      />
      <p data-test="map-attribution" class="cx-mapbox-attr">{{ TILE_ATTRIBUTION }}</p>
    </div>

    <p :id="idHint" data-test="map-hint" class="cx-help">Haz clic en el mapa o arrastra el marcador para fijar tu ubicación. También puedes escribir la latitud y la longitud.</p>

    <div class="cx-grid-2">
      <div>
        <label :for="idLat" class="cx-label">Latitud</label>
        <input
          :id="idLat"
          v-model="latTxt"
          data-test="lat-input"
          class="cx-input cx-input-plain cx-mono"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          aria-label="Latitud"
          placeholder="8.9824"
          :disabled="disabled"
          :aria-invalid="validacion.latMal ? 'true' : undefined"
          :aria-describedby="validacion.error ? idError : undefined"
          @input="alEscribir"
        />
      </div>
      <div>
        <label :for="idLng" class="cx-label">Longitud</label>
        <input
          :id="idLng"
          v-model="lngTxt"
          data-test="lng-input"
          class="cx-input cx-input-plain cx-mono"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          aria-label="Longitud"
          placeholder="-79.5199"
          :disabled="disabled"
          :aria-invalid="validacion.lngMal ? 'true' : undefined"
          :aria-describedby="validacion.error ? idError : undefined"
          @input="alEscribir"
        />
      </div>
    </div>

    <p v-if="validacion.error" :id="idError" data-test="coord-error" role="alert" class="cx-field-error" style="margin-top: 0">
      <CircleAlert :size="16" aria-hidden="true" /><span>{{ validacion.error }}</span>
    </p>

    <div role="status" aria-live="polite">
      <div v-if="!enCobertura" data-test="coverage-hint" class="cx-alert">
        <Info :size="20" aria-hidden="true" />
        <p>Esta ubicación está fuera de las zonas de cobertura</p>
      </div>
    </div>

    <button v-if="hayAlgo" type="button" data-test="clear-pin" class="cx-btn cx-btn-ghost" style="align-self: flex-start; margin-left: -16px" :disabled="disabled" @click="quitarPin">
      <MapPinOff :size="20" aria-hidden="true" />Quitar ubicación
    </button>
  </div>
</template>

<style>
.address-picker-marker {
  background: transparent;
  border: none;
}
</style>
