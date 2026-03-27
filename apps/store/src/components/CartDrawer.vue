<script setup lang="ts">
import { formatPrice } from '@bap-shop/shared'
import { useCartStore } from '../stores/cart'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'click:close'): void
}>()

const cartStore = useCartStore()

const close = () => {
  emit('click:close')
}
</script>

<template>
  <div class="cart-drawer" :class="{ 'is-open': isOpen }">
    <div class="drawer">
      <div class="drawer-header">
        <h2>Tu carrito</h2>
        <div class="drawer-actions">
          <span class="count">{{ cartStore.count }}</span>
          <button type="button" class="btn-close" @click="close">Cerrar</button>
        </div>
      </div>

      <div class="drawer-content">
        <div v-if="cartStore.items.length === 0" class="empty-state">
          <p>Tu carrito esta vacio.</p>
          <router-link to="/zapatillas" class="empty-link" @click="close">Explorar catalogo</router-link>
        </div>

        <div v-else class="cart-items">
          <div v-for="item in cartStore.items" :key="item.id" class="cart-item">
            <img v-if="item.primary_image_url" :src="item.primary_image_url" :alt="item.name" class="item-img" />

            <div class="item-details">
              <h4>{{ item.name }}</h4>
              <span v-if="item.size" class="item-size">Talla: {{ item.size }}</span>
              <span class="item-price">{{ formatPrice(item.promo_price || item.price) }}</span>
              <router-link class="detail-link" :to="`/products/${item.id}`" @click="close">Ver detalle</router-link>
            </div>

            <button type="button" class="btn-remove" @click="cartStore.removeItem(item.id)">
              &times;
            </button>
          </div>
        </div>
      </div>

      <div v-if="cartStore.items.length > 0" class="drawer-footer">
        <div class="summary">
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

        <router-link to="/checkout" class="btn-primary checkout-btn" @click="close">
          Continuar
        </router-link>
        <button type="button" class="btn-clear" @click="cartStore.clearCart">Vaciar carrito</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cart-drawer {
  position: fixed;
  top: 0;
  right: -400px;
  width: 100%;
  max-width: 400px;
  height: 100vh;
  background: var(--bg-main);
  border-left: 1px solid var(--border-light);
  z-index: 100;
  display: flex;
  flex-direction: column;
  transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
}

.cart-drawer.is-open {
  right: 0;
}

.drawer {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.drawer-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.drawer-header h2 {
  font-size: 1.5rem;
  margin: 0;
}

.drawer-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.count {
  background: var(--text-primary);
  color: var(--bg-main);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-weight: 700;
  font-size: 0.875rem;
}

.btn-close {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.btn-close:hover {
  color: var(--text-primary);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.empty-state {
  text-align: center;
  color: var(--text-secondary);
  margin-top: 2rem;
}

.empty-link {
  display: inline-flex;
  margin-top: 0.75rem;
  color: var(--text-primary);
  text-decoration: underline;
}

.cart-items {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.cart-item {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.item-img {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--bg-tertiary);
}

.item-details {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.item-details h4 {
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
  font-family: var(--font-body);
}

.item-size {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.item-price {
  font-weight: 700;
}

.detail-link {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-decoration: underline;
}

.btn-remove {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.btn-remove:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.drawer-footer {
  padding: 1.5rem;
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
}

.summary {
  margin-bottom: 1.5rem;
}

.row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.row.discount {
  color: var(--accent-primary);
}

.row.total {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-light);
}

.checkout-btn {
  width: 100%;
}

.btn-clear {
  width: 100%;
  margin-top: 0.75rem;
  padding: 0.8rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-secondary);
}
</style>
