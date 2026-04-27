<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { CatalogCard } from '@bap-shop/shared'
import { formatPrice, PHYSICAL_CONDITION_LABELS, PRODUCT_STATUS } from '@bap-shop/shared'
import { useCartStore } from '../stores/cart'

const props = defineProps<{
  product: CatalogCard
}>()

const router = useRouter()
const cartStore = useCartStore()

const conditionLabel = computed(() => {
  return PHYSICAL_CONDITION_LABELS[props.product.physical_condition] || props.product.physical_condition
})

const isSold = computed(() => props.product.status === PRODUCT_STATUS.SOLD)
const isReserved = computed(() => props.product.status === PRODUCT_STATUS.RESERVED)
const isUnavailable = computed(() => isSold.value || isReserved.value)
const inCart = computed(() => cartStore.isInCart(props.product.id))
const imageVariants = computed(() => props.product.primary_image_variants ?? null)
const cardImageUrl = computed(() => imageVariants.value?.card_url || props.product.primary_image_url)
const thumbImageUrl = computed(() => imageVariants.value?.thumb_url || props.product.primary_image_url)
const imageSrcset = computed(() => {
  if (!thumbImageUrl.value || !cardImageUrl.value || thumbImageUrl.value === cardImageUrl.value) {
    return undefined
  }

  return `${thumbImageUrl.value} 320w, ${cardImageUrl.value} 640w`
})
const cartButtonLabel = computed(() => {
  if (isSold.value) return 'Vendido'
  if (isReserved.value) return 'Reservado'
  return inCart.value ? 'En carrito' : 'Agregar'
})

const promoEndsLabel = computed(() => {
  if (!props.product.promo_ends_at || !props.product.discount_pct) return ''
  const date = new Date(props.product.promo_ends_at)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
})

const addToCart = () => {
  if (isUnavailable.value) return
  cartStore.addItem(props.product)
}

const openDetail = () => {
  router.push(`/products/${props.product.id}`)
}

const onCardKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  openDetail()
}
</script>

<template>
  <div
    class="product-card glass-card"
    :class="{ 'is-unavailable': isUnavailable }"
    role="link"
    tabindex="0"
    :aria-label="`Ver detalle de ${product.name}`"
    @click="openDetail"
    @keydown="onCardKeydown"
  >
    <button class="image-wrapper image-button" :aria-label="`Ver imagenes y detalle de ${product.name}`" @click="openDetail" type="button">
      <img
        v-if="cardImageUrl"
        :src="cardImageUrl"
        :srcset="imageSrcset"
        sizes="(max-width: 640px) 50vw, 320px"
        :alt="product.name"
        class="product-image"
        loading="lazy"
        decoding="async"
      />
      <div v-else class="no-image">Sin imagen</div>

      <div v-if="isUnavailable" class="unavailable-overlay" />
      <div v-if="isUnavailable" class="status-watermark" :class="{ reserved: isReserved }">
        {{ isReserved ? 'Reservado' : 'Vendido' }}
      </div>
      
      <div v-if="product.discount_pct" class="badge discount" :class="{ stacked: isUnavailable }">
        {{ product.discount_pct }}% DESC
      </div>
      <div v-if="isUnavailable" class="badge unavailable" :class="{ reserved: isReserved }">
        {{ isReserved ? 'Reservado' : 'Vendido' }}
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
      
      <button class="name-link" :aria-label="`Ver detalle de ${product.name}`" @click="openDetail" type="button">
        <h3 class="name">{{ product.name }}</h3>
      </button>

      <p v-if="promoEndsLabel" class="product-promo-window">Hasta {{ promoEndsLabel }}</p>
      <p v-else class="product-id">{{ product.id }}</p>
      
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
          @click.stop="addToCart" 
          class="btn-cart"
          :class="{ 'in-cart': inCart && !isUnavailable, 'is-sold': isSold, 'is-reserved': isReserved }"
          :disabled="inCart || isUnavailable"
          :aria-label="
            isUnavailable
              ? `${product.name} no disponible`
              : inCart
                ? `${product.name} ya esta en tu carrito`
                : `Agregar ${product.name} al carrito`
          "
        >
          {{ cartButtonLabel }}
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
  cursor: pointer;
}

.product-card:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 4px;
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

.image-button:focus-visible,
.name-link:focus-visible {
  outline-offset: -4px;
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

.product-card.is-unavailable .product-image {
  filter: grayscale(0.15) brightness(0.68);
}

.no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.unavailable-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(8, 8, 8, 0.1) 0%, rgba(8, 8, 8, 0.28) 100%);
  pointer-events: none;
}

.status-watermark {
  position: absolute;
  left: 50%;
  bottom: 0.75rem;
  transform: translateX(-50%);
  z-index: 2;
  min-width: 9rem;
  padding: 0.4rem 0.9rem;
  border-radius: var(--radius-full);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.78rem;
  font-weight: 800;
  color: #fff;
  background: rgba(13, 13, 13, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.status-watermark.reserved {
  background: rgba(11, 71, 138, 0.78);
  border-color: rgba(173, 208, 255, 0.45);
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
  font-size: 0.68rem;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.badge.discount.stacked {
  top: 3.2rem;
}

.badge.condition {
  right: 0.75rem;
  background: var(--surface-glass);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
}

.badge.unavailable {
  left: 0.75rem;
  top: 0.75rem;
  background: #c62828;
  color: #fff;
  border-radius: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge.unavailable.reserved {
  background: #1565c0;
}

.badge.unavailable + .badge.condition,
.badge.discount + .badge.unavailable + .badge.condition {
  top: 3.2rem;
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

.product-promo-window {
  margin: -0.35rem 0 1rem;
  font-size: 0.75rem;
  color: #fde68a;
  font-weight: 600;
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
  text-shadow: 0 0 16px rgba(34, 211, 238, 0.42);
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

.btn-cart.is-sold {
  background: rgba(198, 40, 40, 0.12);
  color: #f3b6b6;
  border-color: rgba(198, 40, 40, 0.4);
  cursor: not-allowed;
}

.btn-cart.is-reserved {
  background: rgba(21, 101, 192, 0.12);
  color: #c6ddfb;
  border-color: rgba(21, 101, 192, 0.4);
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .content {
    padding: 0.75rem;
  }

  .meta {
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.72rem;
    margin-bottom: 0.4rem;
  }

  .name {
    font-size: 0.9rem;
    margin-bottom: 0.65rem;
  }

  .product-id,
  .product-promo-window {
    display: none;
  }

  .price-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.6rem;
  }

  .original-price {
    font-size: 0.75rem;
  }

  .final-price {
    font-size: 1rem;
  }

  .btn-cart {
    width: 100%;
    padding: 0.45rem 0.65rem;
    font-size: 0.75rem;
  }

  .badge {
    top: 0.45rem;
    padding: 0.2rem 0.45rem;
    font-size: 0.62rem;
  }

  .badge.discount,
  .badge.unavailable {
    left: 0.45rem;
  }

  .badge.condition {
    right: 0.45rem;
    max-width: calc(100% - 0.9rem);
  }

  .badge.discount.stacked,
  .badge.unavailable + .badge.condition,
  .badge.discount + .badge.unavailable + .badge.condition {
    top: 2.45rem;
  }

  .status-watermark {
    bottom: 0.5rem;
    min-width: 6.8rem;
    padding: 0.32rem 0.55rem;
    font-size: 0.64rem;
  }
}
</style>
