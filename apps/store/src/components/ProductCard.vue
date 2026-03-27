<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { CatalogCard } from '@bap-shop/shared'
import { formatPrice } from '@bap-shop/shared'
import { PHYSICAL_CONDITION_LABELS } from '@bap-shop/shared'
import { useCartStore } from '../stores/cart'

const props = defineProps<{
  product: CatalogCard
}>()

const router = useRouter()
const cartStore = useCartStore()

const conditionLabel = computed(() => {
  return PHYSICAL_CONDITION_LABELS[props.product.physical_condition] || props.product.physical_condition
})

const inCart = computed(() => cartStore.isInCart(props.product.id))

const addToCart = () => {
  cartStore.addItem(props.product)
}

const openDetail = () => {
  router.push(`/products/${props.product.id}`)
}
</script>

<template>
  <div class="product-card glass-card">
    <button class="image-wrapper image-button" @click="openDetail" type="button">
      <img
        v-if="product.primary_image_url"
        :src="product.primary_image_url"
        :alt="product.name"
        class="product-image"
        loading="lazy"
      />
      <div v-else class="no-image">Sin imagen</div>
      
      <div v-if="product.discount_pct" class="badge discount">
        -{{ product.discount_pct }}%
      </div>
      <div class="badge condition">
        {{ conditionLabel }}
      </div>
    </button>

    <div class="content">
      <div class="meta">
        <span v-if="product.brand" class="brand">{{ product.brand.name }}</span>
        <span v-if="product.size" class="size">Talla: {{ product.size }}</span>
      </div>
      
      <button class="name-link" @click="openDetail" type="button">
        <h3 class="name">{{ product.name }}</h3>
      </button>

      <p class="product-id">{{ product.id }}</p>
      
      <div class="price-row">
        <div class="prices">
          <span v-if="product.promo_price" class="original-price">
            {{ formatPrice(product.price) }}
          </span>
          <span class="final-price" :class="{ 'is-promo': !!product.promo_price }">
            {{ formatPrice(product.promo_price || product.price) }}
          </span>
        </div>
        
        <button 
          @click="addToCart" 
          class="btn-cart"
          :class="{ 'in-cart': inCart }"
          :disabled="inCart"
        >
          {{ inCart ? 'En carrito' : 'Agregar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.image-wrapper {
  position: relative;
  aspect-ratio: 1;
  background: var(--bg-tertiary);
  overflow: hidden;
  border-bottom: 1px solid var(--border-light);
}

.image-button,
.name-link {
  border: 0;
  padding: 0;
  margin: 0;
  background: transparent;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
}

.image-button {
  display: block;
  width: 100%;
}

.product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.product-card:hover .product-image {
  transform: scale(1.05);
}

.no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.badge {
  position: absolute;
  top: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.badge.discount {
  left: 0.75rem;
  background: var(--accent-primary);
  color: var(--bg-main);
}

.badge.condition {
  right: 0.75rem;
  background: var(--surface-glass);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
}

.content {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.name {
  font-size: 1.125rem;
  margin-bottom: 1rem;
  line-height: 1.3;
  flex: 1;
}

.name-link:hover .name {
  text-decoration: underline;
}

.product-id {
  margin: -0.35rem 0 1rem;
  font-family: monospace;
  font-size: 0.72rem;
  color: var(--text-tertiary);
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: auto;
}

.prices {
  display: flex;
  flex-direction: column;
}

.original-price {
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-decoration: line-through;
}

.final-price {
  font-size: 1.25rem;
  font-weight: 700;
  font-family: var(--font-heading);
}

.final-price.is-promo {
  color: var(--accent-primary);
}

.btn-cart {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 600;
  transition: all var(--transition-fast);
}

.btn-cart:hover:not(:disabled) {
  background: var(--text-primary);
  color: var(--bg-main);
  transform: translateY(-2px);
}

.btn-cart.in-cart {
  background: var(--accent-glow);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
  opacity: 0.8;
  cursor: not-allowed;
}
</style>
