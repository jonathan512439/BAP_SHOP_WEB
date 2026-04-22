<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { formatPrice, validateCustomerName, validatePhone, type InvalidCartItem } from '@bap-shop/shared'
import BaseInput from '../components/BaseInput.vue'
import BaseModal from '../components/BaseModal.vue'
import { useCartStore } from '../stores/cart'
import { useOrder } from '../composables/useOrder'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
        }
      ) => string | number
      remove: (widgetId: string | number) => void
      reset: (widgetId: string | number) => void
    }
  }
}

const router = useRouter()
const cartStore = useCartStore()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'

const form = ref({
  customerName: '',
  customerPhone: '',
})

const errors = ref({
  customerName: '',
  customerPhone: '',
  submit: '',
})

const turnstileToken = ref('')
const turnstileWidgetId = ref<string | number | null>(null)
const { isSubmitting: orderSubmitting, invalidItems, submitError, resetOrderFeedback, submitOrder: submitOrderRequest } =
  useOrder()
const hasUnavailableItems = computed(() => invalidItems.value.length > 0)

onMounted(() => {
  if (cartStore.items.length === 0) {
    router.push('/zapatillas')
    return
  }

  const existingScript = document.querySelector<HTMLScriptElement>('script[data-turnstile-script="true"]')
  if (existingScript) {
    mountTurnstile()
    return
  }

  const script = document.createElement('script')
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  script.async = true
  script.defer = true
  script.dataset.turnstileScript = 'true'
  script.onload = mountTurnstile
  document.head.appendChild(script)
})

onUnmounted(() => {
  if (window.turnstile && turnstileWidgetId.value !== null) {
    window.turnstile.remove(turnstileWidgetId.value)
  }
})

function mountTurnstile() {
  if (!window.turnstile || turnstileWidgetId.value !== null) {
    return
  }

  turnstileWidgetId.value = window.turnstile.render('#turnstile-container', {
    sitekey: turnstileSiteKey,
    callback: (token: string) => {
      turnstileToken.value = token
      errors.value.submit = ''
    },
    'error-callback': () => {
      errors.value.submit = 'No se pudo validar la seguridad. Revisa que Turnstile permita bab-shop.com y recarga la pagina.'
    },
    'expired-callback': () => {
      turnstileToken.value = ''
    },
  })
}

function resetFeedback() {
  resetOrderFeedback()
  errors.value.submit = ''
}

function validateForm() {
  let valid = true
  errors.value = {
    customerName: '',
    customerPhone: '',
    submit: '',
  }

  const nameResult = validateCustomerName(form.value.customerName)
  if (!nameResult.valid) {
    errors.value.customerName = nameResult.error || 'Nombre invalido'
    valid = false
  }

  const phoneResult = validatePhone(form.value.customerPhone)
  if (!phoneResult.valid) {
    errors.value.customerPhone = phoneResult.error || 'Telefono invalido'
    valid = false
  }

  if (!turnstileToken.value) {
    errors.value.submit = 'Completa la validacion de seguridad antes de enviar el pedido.'
    valid = false
  }

  return valid
}

async function handleSubmitOrder() {
  resetFeedback()

  if (!validateForm()) {
    return
  }

  const orderResponse = await submitOrderRequest({
    apiUrl: API_URL,
    customerName: form.value.customerName,
    customerPhone: form.value.customerPhone,
    turnstileToken: turnstileToken.value,
  })

  errors.value.submit = submitError.value

  try {
    if (!orderResponse.success || !orderResponse.result?.data) {
      return
    }

    const priceChanges = orderResponse.result.data.priceChanges ?? []
    sessionStorage.setItem('bap_last_price_changes', JSON.stringify(priceChanges.filter((item) => item.changed)))
    cartStore.clearCart()

    await router.push({
      name: 'confirmation',
      query: {
        code: orderResponse.result.data.orderCode ?? '',
        url: orderResponse.result.data.whatsappUrl ?? '',
      },
    })
  } finally {
    if (window.turnstile && turnstileWidgetId.value !== null) {
      window.turnstile.reset(turnstileWidgetId.value)
      turnstileToken.value = ''
    }
  }
}

function removeInvalidItems() {
  invalidItems.value.forEach((item) => {
    cartStore.removeItem(item.productId)
  })

  invalidItems.value = []
  errors.value.submit = ''

  if (cartStore.items.length === 0) {
    router.push('/zapatillas')
  }
}

function closeUnavailableModal() {
  invalidItems.value = []
}

function reasonLabel(reason: InvalidCartItem['reason']) {
  switch (reason) {
    case 'sold':
      return 'Vendido'
    case 'hidden':
      return 'Oculto'
    case 'reserved':
      return 'Reservado'
    case 'draft':
      return 'No publicado'
    default:
      return 'No disponible'
  }
}
</script>

<template>
  <div class="checkout-view glass-card">
    <div class="checkout-header">
      <h2>Coordinar compra</h2>
      <p>
        Esta pagina no cobra en linea. Completa tus datos y continua la coordinacion final directamente por WhatsApp con la tienda.
      </p>
      <p class="support-copy">
        Antes de continuar, puedes revisar
        <RouterLink to="/como-comprar">Como Comprar</RouterLink>,
        <RouterLink to="/preguntas-frecuentes">Preguntas Frecuentes</RouterLink> y
        <RouterLink to="/politicas">Politica de la Tienda</RouterLink>.
      </p>
    </div>

    <div class="checkout-grid">
      <section class="order-summary">
        <h3>Resumen ({{ cartStore.count }} items)</h3>

        <div class="item-list">
          <article v-for="item in cartStore.items" :key="item.id" class="item-card">
            <img
              v-if="item.primary_image_variants?.thumb_url || item.primary_image_url"
              :src="item.primary_image_variants?.thumb_url || item.primary_image_url || ''"
              alt=""
              class="img-thumb"
              loading="lazy"
              decoding="async"
            />
            <div class="item-info">
              <h4>{{ item.name }}</h4>
              <span v-if="item.size" class="size">Talla: {{ item.size }}</span>
            </div>
            <div class="item-price-group">
              <span v-if="item.promo_price" class="base-price">{{ formatPrice(item.price) }}</span>
              <strong class="item-price">{{ formatPrice(item.promo_price ?? item.price) }}</strong>
            </div>
          </article>
        </div>

        <div class="totals">
          <div v-if="cartStore.discount > 0" class="row">
            <span>Subtotal</span>
            <span>{{ formatPrice(cartStore.subtotal) }}</span>
          </div>
          <div v-if="cartStore.discount > 0" class="row discount">
            <span>Descuento</span>
            <span>-{{ formatPrice(cartStore.discount) }}</span>
          </div>
          <div class="row total">
            <span>Total</span>
            <span>{{ formatPrice(cartStore.total) }}</span>
          </div>
        </div>

        <div v-if="hasUnavailableItems" class="feedback-stack">
          <div class="feedback-card danger">
            Algunos productos ya no estan disponibles. Revisa el detalle y retira los articulos que ya no se pueden comprar.
          </div>
        </div>

        <div class="feedback-card neutral" role="note">
          Tu solicitud se enviara por WhatsApp con el resumen del pedido. La tienda te confirmara disponibilidad, forma
          de pago, entrega o retiro antes de cerrar la venta.
        </div>
      </section>

      <section class="form-container">
        <h3>Datos de contacto</h3>
        <p class="form-note">
          Usaremos este numero para confirmar stock, pago, y coordinar entrega o envio . Asegurate de ingresar un WhatsApp valido.
        </p>

        <form class="checkout-form" @submit.prevent="handleSubmitOrder">
          <BaseInput
            id="name"
            v-model="form.customerName"
            label="Nombre completo"
            placeholder="Ej. Juan Perez"
            :error="errors.customerName"
            :disabled="orderSubmitting"
          />

          <BaseInput
            id="phone"
            v-model="form.customerPhone"
            type="tel"
            label="Telefono o WhatsApp"
            placeholder="+591 71234567"
            :error="errors.customerPhone"
            :disabled="orderSubmitting"
          />

          <div id="turnstile-container" class="turnstile-box"></div>

          <div v-if="errors.submit" class="global-error" role="alert" aria-live="assertive">
            {{ errors.submit }}
          </div>

          <button type="submit" class="btn-primary block-button" :disabled="orderSubmitting || !turnstileToken">
            {{ orderSubmitting ? 'Enviando solicitud...' : 'Enviar solicitud' }}
          </button>
        </form>
      </section>
    </div>

    <BaseModal :is-open="hasUnavailableItems" title="Articulos no disponibles" @close="closeUnavailableModal">
      <div class="modal-copy">
        <p>Algunos articulos ya no estan disponibles. Puedes quitarlos del carrito y volver a intentar el checkout.</p>
        <ul class="modal-list">
          <li v-for="item in invalidItems" :key="item.productId">
            <strong>{{ item.productName }}</strong>
            <span>{{ reasonLabel(item.reason) }}</span>
          </li>
        </ul>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" @click="closeUnavailableModal">Cerrar</button>
          <button type="button" class="btn-primary" @click="removeInvalidItems">Eliminar no disponibles</button>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.checkout-view {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem;
  animation: fadeUp 0.6s ease;
  min-width: 0;
}

.checkout-header {
  text-align: center;
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.checkout-header h2 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.checkout-header p {
  color: var(--text-secondary);
  max-width: 640px;
  margin: 0 auto;
}

.support-copy {
  margin-top: 0.85rem !important;
}

.support-copy a {
  color: var(--accent-primary);
  font-weight: 600;
}

.checkout-guidance {
  display: grid;
  gap: 1rem;
  margin-bottom: 2rem;
}

@media (min-width: 860px) {
  .checkout-guidance {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.guidance-card {
  padding: 1rem 1.1rem;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-light);
}

.guidance-card strong {
  display: block;
  margin-bottom: 0.4rem;
}

.guidance-card p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.checkout-grid {
  display: grid;
  gap: 2rem;
  min-width: 0;
}

@media (min-width: 860px) {
  .checkout-grid {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  }
}

.order-summary,
.form-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
}

.order-summary h3,
.form-container h3 {
  font-size: 1.2rem;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.item-card {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  gap: 0.9rem;
  align-items: center;
  padding: 0.9rem;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  min-width: 0;
}

.img-thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.item-info h4 {
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
  overflow-wrap: anywhere;
}

.size {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.item-price-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
  min-width: 0;
}

.base-price {
  font-size: 0.76rem;
  color: var(--text-tertiary);
  text-decoration: line-through;
}

.item-price {
  font-size: 0.95rem;
  word-break: break-word;
}

.totals {
  padding-top: 1.25rem;
  border-top: 1px solid var(--border-light);
}

.row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.55rem;
  color: var(--text-secondary);
  gap: 1rem;
}

.row.discount {
  color: var(--accent-primary);
}

.row.total {
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px dashed var(--border-focus);
  color: var(--text-primary);
  font-size: 1.15rem;
  font-weight: 700;
}

.feedback-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.feedback-card {
  padding: 1rem;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  min-width: 0;
  overflow-wrap: anywhere;
}

.feedback-card.danger {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.28);
  color: #fca5a5;
}

.feedback-card.neutral {
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--border-light);
  color: var(--text-secondary);
  line-height: 1.6;
}

.form-note {
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

.checkout-form {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.turnstile-box {
  min-height: 66px;
}

.global-error {
  padding: 0.9rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid rgba(239, 68, 68, 0.26);
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
  font-size: 0.86rem;
  overflow-wrap: anywhere;
}

.block-button {
  width: 100%;
}

.modal-copy {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-copy p {
  color: var(--text-secondary);
  line-height: 1.6;
}

.modal-list {
  margin: 0;
  padding-left: 1rem;
  display: grid;
  gap: 0.75rem;
}

.modal-list li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: var(--text-secondary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .checkout-view {
    padding: 1.15rem;
  }

  .checkout-header {
    margin-bottom: 1.75rem;
    padding-bottom: 1.1rem;
  }

  .checkout-header h2 {
    font-size: 1.65rem;
  }

  .checkout-grid {
    gap: 1.4rem;
  }

  .item-card {
    grid-template-columns: 48px minmax(0, 1fr);
    align-items: start;
    gap: 0.75rem;
    padding: 0.8rem;
  }

  .img-thumb {
    width: 48px;
    height: 48px;
  }

  .item-info {
    min-width: 0;
  }

  .item-info h4 {
    font-size: 0.9rem;
    margin-bottom: 0.2rem;
  }

  .item-price-group {
    grid-column: 2 / -1;
    align-items: flex-start;
    padding-top: 0.1rem;
  }

  .totals {
    padding-top: 1rem;
  }

  .row {
    align-items: flex-start;
  }

  .row span:last-child {
    text-align: right;
    overflow-wrap: anywhere;
  }

  .turnstile-box {
    overflow-x: auto;
  }

  .modal-list {
    padding-left: 0;
    list-style: none;
  }

  .modal-list li {
    flex-direction: column;
    gap: 0.3rem;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }

  .modal-actions button {
    width: 100%;
  }
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
