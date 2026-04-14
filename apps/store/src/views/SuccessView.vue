<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { formatPrice, type PriceChange } from '@bap-shop/shared'
import { useCartStore } from '../stores/cart'

const route = useRoute()
const cartStore = useCartStore()

const whatsappUrl = computed(() => String(route.query.url ?? route.query.whatsappUrl ?? ''))
const orderCode = computed(() => String(route.query.code ?? route.query.orderCode ?? ''))
const priceChanges = ref<PriceChange[]>([])

onMounted(() => {
  cartStore.clearCart()

  const saved = sessionStorage.getItem('bap_last_price_changes')
  if (!saved) {
    return
  }

  try {
    priceChanges.value = JSON.parse(saved) as PriceChange[]
  } catch {
    priceChanges.value = []
  } finally {
    sessionStorage.removeItem('bap_last_price_changes')
  }
})
</script>

<template>
  <div class="success-view glass-card">
    <div class="icon-success">OK</div>

    <h2>Solicitud enviada correctamente</h2>
    <p class="info-text">
      Tu codigo <strong>{{ orderCode || 'pendiente' }}</strong> ya fue generado. Usa el boton de WhatsApp para
      continuar la coordinacion con la tienda. Si la compra no se confirma dentro del plazo establecido, los articulos
      pueden volver a estar disponibles.
    </p>

    <div v-if="priceChanges.length > 0" class="price-change-card">
      <h3>Precios actualizados</h3>
      <p>Al menos uno de los articulos cambio de precio antes de enviar tu solicitud. El pedido ya fue preparado con el valor vigente.</p>
      <ul>
        <li v-for="change in priceChanges" :key="change.productId">
          {{ change.productName }}: {{ formatPrice(change.cartPrice) }} -> {{ formatPrice(change.actualPrice) }}
        </li>
      </ul>
    </div>

    <div class="actions">
      <a v-if="whatsappUrl" :href="whatsappUrl" target="_blank" rel="noopener noreferrer" class="btn-primary whatsapp-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
        Abrir WhatsApp
      </a>

      <p v-else class="fallback">
        No se pudo abrir el enlace automaticamente. Contacta a la tienda indicando el codigo
        {{ orderCode || 'de tu pedido' }}.
      </p>

      <router-link to="/zapatillas" class="btn-secondary">Volver al catalogo</router-link>
    </div>
  </div>
</template>

<style scoped>
.success-view {
  max-width: 600px;
  margin: 4rem auto;
  text-align: center;
  padding: 3rem 2rem;
  animation: scaleIn 0.5s var(--bounce);
}

.icon-success {
  width: 80px;
  height: 80px;
  background: var(--accent-glow);
  color: var(--accent-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0 auto 2rem;
  border: 2px solid var(--accent-primary);
}

h2 {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.info-text {
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 2.5rem;
  font-size: 1.05rem;
}

strong {
  color: var(--text-primary);
}

.price-change-card {
  margin: 0 auto 2rem;
  max-width: 520px;
  padding: 1rem 1.1rem;
  border-radius: var(--radius-md);
  border: 1px solid rgba(245, 158, 11, 0.26);
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
  text-align: left;
}

.price-change-card h3 {
  font-size: 1rem;
  margin-bottom: 0.45rem;
}

.price-change-card p {
  margin-bottom: 0.75rem;
}

.price-change-card ul {
  margin: 0;
  padding-left: 1rem;
  display: grid;
  gap: 0.35rem;
  font-size: 0.92rem;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.whatsapp-btn {
  background: #25d366;
  color: white;
  padding: 1rem 2rem;
  font-size: 1.05rem;
  border: none;
}

.whatsapp-btn:hover {
  background: #22c35e;
  box-shadow: 0 4px 15px rgba(37, 211, 102, 0.4);
}

.fallback {
  color: var(--text-secondary);
}

.btn-secondary {
  color: var(--text-secondary);
  font-weight: 500;
  margin-top: 1rem;
  transition: color var(--transition-fast);
}

.btn-secondary:hover {
  color: var(--text-primary);
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
