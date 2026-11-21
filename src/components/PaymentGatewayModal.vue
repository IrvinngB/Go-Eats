<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import {
  TEST_CARD_APPROVE,
  TEST_CARD_DECLINE,
  detectarMarcaTarjeta,
  esTarjetaRechazoSimulado,
  validarFormularioTarjeta,
  type CardFormErrors,
} from '../utils/card'

export interface GatewayOrderResult {
  id: string
  pagoEstado: string
  estado?: string
  referenciaPasarela?: string
}

const props = defineProps<{
  open: boolean
  total: number
  consentRequired?: boolean
  onProcess: (opts: { simulateFailure: boolean }) => Promise<GatewayOrderResult | null>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'view-orders'): void
  (e: 'go-profile'): void
}>()

type Step = 'card' | 'otp' | 'processing' | 'result'
type ResultKind = 'aprobado' | 'rechazado' | 'error'

const paso = ref<Step>('card')
const resultado = ref<ResultKind | null>(null)
const pedidoResultado = ref<GatewayOrderResult | null>(null)

// Card and OTP values live in component memory only and are wiped before network calls and on close/unmount.
const titular = ref('')
const numero = ref('')
const vencimiento = ref('')
const cvv = ref('')
const otp = ref('')
const errores = ref<CardFormErrors>({})
const errorOtp = ref('')
const simularRechazo = ref(false)
const marca = computed(() => detectarMarcaTarjeta(numero.value))

function limpiarDatosSensibles() {
  titular.value = ''
  numero.value = ''
  vencimiento.value = ''
  cvv.value = ''
  otp.value = ''
  errores.value = {}
  errorOtp.value = ''
}

function reiniciarTodo() {
  limpiarDatosSensibles()
  simularRechazo.value = false
  paso.value = 'card'
  resultado.value = null
  pedidoResultado.value = null
}

watch(
  () => props.open,
  (abierto) => {
    reiniciarTodo()
    if (!abierto) limpiarDatosSensibles()
  },
)

onBeforeUnmount(() => {
  limpiarDatosSensibles()
})

function continuarAOtp() {
  const res = validarFormularioTarjeta({
    titular: titular.value,
    numero: numero.value,
    vencimiento: vencimiento.value,
    cvv: cvv.value,
  })
  errores.value = res.errores
  if (!res.valido) return
  simularRechazo.value = esTarjetaRechazoSimulado(numero.value)
  limpiarDatosSensibles()
  paso.value = 'otp'
}

async function confirmarOtp() {
  if (!/^\d{6}$/.test(otp.value.trim())) {
    errorOtp.value = 'Ingresa el código de 6 dígitos.'
    return
  }
  const flagRechazo = simularRechazo.value
  limpiarDatosSensibles()
  paso.value = 'processing'

  let pedido: GatewayOrderResult | null = null
  try {
    pedido = await props.onProcess({ simulateFailure: flagRechazo })
  } catch {
    pedido = null
  }
  pedidoResultado.value = pedido
  if (!pedido) {
    resultado.value = 'error'
  } else if (pedido.pagoEstado === 'pagado') {
    resultado.value = 'aprobado'
  } else if (pedido.pagoEstado === 'fallido') {
    resultado.value = 'rechazado'
  } else {
    resultado.value = 'error'
  }
  paso.value = 'result'
}

function cerrar() {
  if (paso.value === 'processing') return
  limpiarDatosSensibles()
  emit('close')
}
</script>

<template>
  <transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" @click="cerrar">
      <div class="modal-panel card p-6 w-full max-w-md" role="dialog" aria-modal="true" aria-labelledby="gateway-title" @click.stop>
        <!-- Step 1: Card form -->
        <div v-if="paso === 'card'" data-test="step-card">
          <div class="flex items-center justify-between">
            <h3 id="gateway-title" class="text-lg font-semibold text-ink">Pago electrónico (simulado)</h3>
            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-canvas border border-line text-slatebody">{{ marca }}</span>
          </div>
          <p class="text-sm text-slatebody mt-1">Total a pagar <strong>B/ {{ total.toFixed(2) }}</strong></p>
          <p class="text-xs text-slatebody mt-3 bg-canvas rounded-lg p-3">
            Entorno simulado: los datos de tarjeta se validan localmente y nunca se envían al servidor ni se almacenan.
            Tarjetas de prueba: <code class="font-mono">{{ TEST_CARD_APPROVE }}</code> (aprueba) · <code class="font-mono">{{ TEST_CARD_DECLINE }}</code> (rechaza en demo).
          </p>

          <div class="mt-4 space-y-3">
            <div>
              <label for="gw-holder" class="label">Nombre del titular</label>
              <input id="gw-holder" v-model="titular" data-test="card-holder" class="input" autocomplete="off" placeholder="Ej. Carlos Andrade" />
            </div>
            <div>
              <label for="gw-number" class="label">Número de tarjeta</label>
              <input id="gw-number" v-model="numero" data-test="card-number" inputmode="numeric" class="input font-mono" autocomplete="off" placeholder="4111 1111 1111 1111" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="gw-expiry" class="label">Vencimiento (MM/AA)</label>
                <input id="gw-expiry" v-model="vencimiento" data-test="card-expiry" class="input font-mono" autocomplete="off" placeholder="12/29" />
              </div>
              <div>
                <label for="gw-cvv" class="label">CVV</label>
                <input id="gw-cvv" v-model="cvv" data-test="card-cvv" inputmode="numeric" maxlength="4" class="input font-mono" autocomplete="off" placeholder="123" />
              </div>
            </div>
          </div>

          <div v-if="Object.keys(errores).length > 0" data-test="card-errors" role="alert" class="mt-3 text-xs text-red-600 space-y-0.5">
            <p v-for="(msg, k) in errores" :key="k">{{ msg }}</p>
          </div>

          <div class="mt-5 grid grid-cols-2 gap-3">
            <button type="button" class="btn-secondary" @click="cerrar">Cancelar</button>
            <button type="button" data-test="card-submit" class="btn-primary" @click="continuarAOtp">Continuar</button>
          </div>
        </div>

        <!-- Step 2: 3-D Secure simulated OTP -->
        <div v-else-if="paso === 'otp'" data-test="step-otp">
          <h3 id="gateway-title" class="text-lg font-semibold text-ink">Verificación 3-D Secure (simulado)</h3>
          <p class="text-xs text-slatebody mt-2 bg-canvas rounded-lg p-3">
            Ingresa cualquier código de 6 dígitos (ej. <code class="font-mono">123456</code>) para autorizar el cobro simulado de <strong>B/ {{ total.toFixed(2) }}</strong>.
          </p>
          <div class="mt-4">
            <label for="gw-otp" class="label">Código de verificación (OTP)</label>
            <input id="gw-otp" v-model="otp" data-test="otp-code" inputmode="numeric" maxlength="6" class="input font-mono tracking-widest text-center" autocomplete="off" placeholder="123456" />
            <p v-if="errorOtp" role="alert" class="mt-1 text-xs text-red-600">{{ errorOtp }}</p>
          </div>
          <div class="mt-5 grid grid-cols-2 gap-3">
            <button type="button" class="btn-secondary" @click="cerrar">Cancelar</button>
            <button type="button" data-test="otp-submit" class="btn-primary" @click="confirmarOtp">Pagar (simulado)</button>
          </div>
        </div>

        <!-- Step 3: Processing -->
        <div v-else-if="paso === 'processing'" data-test="step-processing" class="text-center py-6">
          <h3 id="gateway-title" class="text-lg font-semibold text-ink">Pago electrónico (simulado)</h3>
          <p class="text-sm text-slatebody mt-2">Procesando…</p>
        </div>

        <!-- Step 4: Result -->
        <div v-else data-test="step-result" class="text-center py-4">
          <div class="mx-auto grid place-items-center w-14 h-14 rounded-full" :class="resultado === 'aprobado' ? 'bg-emerald-50' : 'bg-red-50'">
            <svg v-if="resultado === 'aprobado'" class="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            <svg v-else class="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </div>
          <h3 id="gateway-title" class="mt-4 text-lg font-semibold text-ink">
            {{ resultado === 'aprobado' ? 'Pago aprobado' : resultado === 'rechazado' ? 'Pago rechazado' : 'No se pudo completar' }}
          </h3>
          <p v-if="resultado === 'aprobado' && pedidoResultado" class="text-sm text-slatebody mt-1">
            Pedido {{ pedidoResultado.id }} · Referencia <span data-test="referencia-pago" class="font-mono">{{ pedidoResultado.referenciaPasarela }}</span>
          </p>
          <p v-else-if="resultado === 'rechazado'" class="text-sm text-slatebody mt-1">
            El pedido fue cancelado. Puedes intentarlo de nuevo con pago contra entrega.
          </p>
          <div v-else-if="consentRequired" data-test="consent-required" class="mt-2 text-sm text-slatebody">
            <p>Debes aceptar el tratamiento de tus datos para continuar. Tu carrito se conserva.</p>
            <button type="button" class="mt-2 font-semibold text-brand-dark underline underline-offset-2" @click="emit('go-profile')">Ir a mi perfil para aceptar</button>
          </div>
          <p v-else class="text-sm text-slatebody mt-1">No pudimos procesar el pago. Revisa tus pedidos o inténtalo de nuevo.</p>
          <button v-if="resultado === 'error' && !pedidoResultado" type="button" class="btn-primary w-full mt-5" @click="cerrar">Cerrar</button>
          <button v-else type="button" class="btn-primary w-full mt-5" @click="emit('view-orders')">Ver mis pedidos</button>
        </div>
      </div>
    </div>
  </transition>
</template>
