<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { CircleAlert, CircleCheck, CircleX, CreditCard, ShieldCheck, TriangleAlert } from '@lucide/vue'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import './catalog/catalog.css'
import { useDialogo } from '../composables/useDialogo'
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
const panel = ref<HTMLElement | null>(null)
const titulo = ref<HTMLElement | null>(null)
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
  if (paso.value !== 'card') return
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
  if (paso.value !== 'otp') return // single submit: a second Enter or click while processing does nothing
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

// Each step puts focus where the user continues: the first field of a form, or the title of a status step.
function enfoqueDelPaso(): HTMLElement | null | undefined {
  if (paso.value === 'card') return panel.value?.querySelector<HTMLElement>('[data-test="card-holder"]')
  if (paso.value === 'otp') return panel.value?.querySelector<HTMLElement>('[data-test="otp-code"]')
  return titulo.value
}

watch(paso, async () => {
  if (!props.open) return
  await nextTick()
  enfoqueDelPaso()?.focus()
})

// Escape and Tab trapping, scroll lock and focus return; Escape is ignored while the payment is in flight.
useDialogo(() => props.open, panel, {
  cerrar,
  puedeCerrar: () => paso.value !== 'processing',
  enfoqueInicial: enfoqueDelPaso,
  alVolver: ['[data-test="cart-fab"]', '[data-test="add-to-cart"]'],
})


</script>

<template>
  <transition name="cx-sheet">
    <!-- Own .cx scope: the dialog keeps its tokens and Nunito headings wherever it is mounted. -->
    <div v-if="open" class="cx cx-overlay cx-overlay-center" data-test="gateway-overlay" @click="cerrar">
      <div
        ref="panel"
        class="modal-panel cx-sheet cx-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gateway-title"
        tabindex="-1"
        data-test="gateway-dialog"
        @click.stop
      >
        <!-- Step 1: Card form -->
        <div v-if="paso === 'card'" data-test="step-card" class="cx-sheet-body" style="padding-top: 16px">
          <div class="cx-row cx-row-between" style="flex-wrap: nowrap; align-items: flex-start">
            <h2 id="gateway-title" ref="titulo" tabindex="-1" class="cx-h2">Pago electrónico (simulado)</h2>
            <span class="cx-gw-chip" data-test="card-brand"><CreditCard :size="16" aria-hidden="true" />{{ marca }}</span>
          </div>
          <p>Total a pagar <strong class="cx-price" style="font-size: 1.25rem">B/ {{ total.toFixed(2) }}</strong></p>
          <p class="cx-gw-note">
            <ShieldCheck :size="16" aria-hidden="true" style="display: inline; vertical-align: -3px; color: var(--cx-primary-text)" />
            Entorno simulado: los datos de tarjeta se validan localmente y nunca se envían al servidor ni se almacenan.
            Tarjetas de prueba: <code>{{ TEST_CARD_APPROVE }}</code> (aprueba) · <code>{{ TEST_CARD_DECLINE }}</code> (rechaza en demo).
          </p>

          <div class="cx-form" @keydown.enter.prevent="continuarAOtp">
            <div>
              <label for="gw-holder" class="cx-label">Nombre del titular</label>
              <input
                id="gw-holder"
                v-model="titular"
                data-test="card-holder"
                class="cx-input cx-input-plain"
                autocomplete="off"
                placeholder="Ej. Carlos Andrade"
                :aria-invalid="errores.titular ? 'true' : undefined"
                :aria-describedby="errores.titular ? 'gw-holder-error' : undefined"
              />
              <p v-if="errores.titular" id="gw-holder-error" class="cx-field-error" data-test="error-titular">
                <CircleAlert :size="16" aria-hidden="true" /><span>{{ errores.titular }}</span>
              </p>
            </div>
            <div>
              <label for="gw-number" class="cx-label">Número de tarjeta</label>
              <input
                id="gw-number"
                v-model="numero"
                data-test="card-number"
                inputmode="numeric"
                class="cx-input cx-input-plain cx-mono"
                autocomplete="off"
                placeholder="4111 1111 1111 1111"
                :aria-invalid="errores.numero ? 'true' : undefined"
                :aria-describedby="errores.numero ? 'gw-number-error' : undefined"
              />
              <p v-if="errores.numero" id="gw-number-error" class="cx-field-error" data-test="error-numero">
                <CircleAlert :size="16" aria-hidden="true" /><span>{{ errores.numero }}</span>
              </p>
            </div>
            <div class="cx-grid-2">
              <div>
                <label for="gw-expiry" class="cx-label">Vencimiento (MM/AA)</label>
                <input
                  id="gw-expiry"
                  v-model="vencimiento"
                  data-test="card-expiry"
                  class="cx-input cx-input-plain cx-mono"
                  autocomplete="off"
                  placeholder="12/29"
                  :aria-invalid="errores.vencimiento ? 'true' : undefined"
                  :aria-describedby="errores.vencimiento ? 'gw-expiry-error' : undefined"
                />
                <p v-if="errores.vencimiento" id="gw-expiry-error" class="cx-field-error" data-test="error-vencimiento">
                  <CircleAlert :size="16" aria-hidden="true" /><span>{{ errores.vencimiento }}</span>
                </p>
              </div>
              <div>
                <label for="gw-cvv" class="cx-label">CVV</label>
                <input
                  id="gw-cvv"
                  v-model="cvv"
                  data-test="card-cvv"
                  inputmode="numeric"
                  maxlength="4"
                  class="cx-input cx-input-plain cx-mono"
                  autocomplete="off"
                  placeholder="123"
                  :aria-invalid="errores.cvv ? 'true' : undefined"
                  :aria-describedby="errores.cvv ? 'gw-cvv-error' : undefined"
                />
                <p v-if="errores.cvv" id="gw-cvv-error" class="cx-field-error" data-test="error-cvv">
                  <CircleAlert :size="16" aria-hidden="true" /><span>{{ errores.cvv }}</span>
                </p>
              </div>
            </div>

            <!-- One announcement for assistive tech; the visible messages sit under each field. -->
            <div v-if="Object.keys(errores).length > 0" data-test="card-errors" role="alert" class="cx-sr-only">
              <p v-for="(msg, k) in errores" :key="k">{{ msg }}</p>
            </div>

            <div class="cx-actions">
              <button type="button" class="cx-btn cx-btn-secondary" data-test="card-cancel" @click="cerrar">Cancelar</button>
              <button type="button" data-test="card-submit" class="cx-btn cx-btn-lg" @click="continuarAOtp">Continuar</button>
            </div>
          </div>
        </div>

        <!-- Step 2: 3-D Secure simulated OTP -->
        <div v-else-if="paso === 'otp'" data-test="step-otp" class="cx-sheet-body" style="padding-top: 16px">
          <h2 id="gateway-title" ref="titulo" tabindex="-1" class="cx-h2">Verificación 3-D Secure (simulado)</h2>
          <p class="cx-gw-note">
            <ShieldCheck :size="16" aria-hidden="true" style="display: inline; vertical-align: -3px; color: var(--cx-primary-text)" />
            Ingresa cualquier código de 6 dígitos (ej. <code>123456</code>) para autorizar el cobro simulado de <strong>B/ {{ total.toFixed(2) }}</strong>.
          </p>
          <div class="cx-form" @keydown.enter.prevent="confirmarOtp">
            <div>
              <label for="gw-otp" class="cx-label">Código de verificación (OTP)</label>
              <input
                id="gw-otp"
                v-model="otp"
                data-test="otp-code"
                inputmode="numeric"
                maxlength="6"
                class="cx-input cx-input-plain cx-mono cx-otp"
                autocomplete="off"
                placeholder="123456"
                :aria-invalid="errorOtp ? 'true' : undefined"
                :aria-describedby="errorOtp ? 'gw-otp-error' : undefined"
                @input="errorOtp = ''"
              />
              <p v-if="errorOtp" id="gw-otp-error" role="alert" class="cx-field-error" data-test="otp-error">
                <CircleAlert :size="16" aria-hidden="true" /><span>{{ errorOtp }}</span>
              </p>
            </div>
            <div class="cx-actions">
              <button type="button" class="cx-btn cx-btn-secondary" data-test="otp-cancel" @click="cerrar">Cancelar</button>
              <button type="button" data-test="otp-submit" class="cx-btn cx-btn-lg" @click="confirmarOtp">Pagar (simulado)</button>
            </div>
          </div>
        </div>

        <!-- Step 3: Processing -->
        <div v-else-if="paso === 'processing'" data-test="step-processing" class="cx-sheet-body" style="padding-top: 16px" aria-busy="true">
          <h2 id="gateway-title" ref="titulo" tabindex="-1" class="cx-h2">Pago electrónico (simulado)</h2>
          <p role="status">Estamos confirmando tu pago. No cierres esta ventana.</p>
          <div class="cx-actions">
            <button type="button" data-test="processing-button" class="cx-btn cx-btn-lg" disabled aria-disabled="true">
              <span class="cx-spinner cx-spinner-sm" aria-hidden="true" />
              Procesando…
            </button>
          </div>
        </div>

        <!-- Step 4: Result (status is always icon + text + color) -->
        <div v-else data-test="step-result" class="cx-sheet-body" style="padding-top: 16px">
          <div class="cx-result">
            <span class="cx-result-icon" :class="resultado === 'aprobado' ? 'cx-result-ok' : 'cx-result-bad'">
              <CircleCheck v-if="resultado === 'aprobado'" :size="40" aria-hidden="true" />
              <CircleX v-else-if="resultado === 'rechazado'" :size="40" aria-hidden="true" />
              <TriangleAlert v-else :size="40" aria-hidden="true" />
            </span>
            <h2 id="gateway-title" ref="titulo" tabindex="-1" class="cx-h2">
              {{ resultado === 'aprobado' ? 'Pago aprobado' : resultado === 'rechazado' ? 'Pago rechazado' : 'No se pudo completar' }}
            </h2>
            <template v-if="resultado === 'aprobado' && pedidoResultado">
              <p>Pedido {{ pedidoResultado.id }}</p>
              <p class="cx-overline">Referencia de pago</p>
              <span data-test="referencia-pago" class="cx-code">{{ pedidoResultado.referenciaPasarela }}</span>
            </template>
            <p v-else-if="resultado === 'rechazado'" class="cx-help">
              El pedido fue cancelado. Puedes intentarlo de nuevo con pago contra entrega.
            </p>
            <div v-else-if="consentRequired" data-test="consent-required" class="cx-alert cx-alert-danger" style="text-align: left">
              <CircleAlert :size="20" aria-hidden="true" />
              <div class="cx-alert-body">
                <p>Debes aceptar el tratamiento de tus datos para continuar. Tu carrito se conserva.</p>
                <button type="button" class="cx-btn cx-btn-secondary" @click="emit('go-profile')">Ir a mi perfil para aceptar</button>
              </div>
            </div>
            <p v-else class="cx-help">No pudimos procesar el pago. Revisa tus pedidos o inténtalo de nuevo.</p>
          </div>
          <div class="cx-actions">
            <button v-if="resultado === 'error' && !pedidoResultado" type="button" class="cx-btn cx-btn-lg" data-test="result-close" @click="cerrar">Cerrar</button>
            <button v-else type="button" class="cx-btn cx-btn-lg" data-test="result-orders" @click="emit('view-orders')">Ver mis pedidos</button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>
