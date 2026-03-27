<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatPrice, PHYSICAL_CONDITION_LABELS } from '@bap-shop/shared'
import BaseEmptyState from '../components/BaseEmptyState.vue'
import ImageGallery from '../components/ImageGallery.vue'
import { useCartStore } from '../stores/cart'

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore()

const ASSETS_DOMAIN = import.meta.env.VITE_ASSETS_URL || 'https://assets.bapshop.com/public'

const isLoading = ref(true)
const error = ref<string | null>(null)
const product = ref<any | null>(null)

const finalPrice = computed(() => product.value?.promo_price ?? product.value?.price ?? 0)
const inCart = computed(() => !!product.value && cartStore.isInCart(product.value.id))
const backRoute = computed(() => (product.value?.type === 'other' ? '/otros' : '/zapatillas'))

onMounted(async () => {
  try {
    const productId = route.params.id as string
    const response = await fetch(`${ASSETS_DOMAIN}/products/${productId}.json`)

    if (!response.ok) {
      throw new Error('Producto no encontrado')
    }

    product.value = await response.json()
  } catch (err: any) {
    error.value = err.message || 'No se pudo cargar el producto'
  } finally {
    isLoading.value = false
  }
})

const addToCart = () => {
  if (!product.value || inCart.value) return

  cartStore.addItem({
    id: product.value.id,
    type: product.value.type,
    name: product.value.name,
    brand: product.value.brand,
    model: product.value.model,
    size: product.value.size,
    price: product.value.price,
    promo_price: product.value.promo_price,
    discount_pct: product.value.discount_pct,
    physical_condition: product.value.physical_condition,
    primary_image_url:
      product.value.images?.find((image: any) => image.is_primary)?.url ?? product.value.images?.[0]?.url ?? null,
    sort_order: 0,
  })
}
</script>

<template>
  <BaseEmptyState
    v-if="isLoading"
    title="Cargando producto..."
    description="Estamos leyendo el snapshot publico del item seleccionado."
    loading
  />
  <BaseEmptyState
    v-else-if="error"
    title="No se pudo cargar el producto"
    :description="error"
    action-label="Volver al catalogo"
    @action="router.push('/zapatillas')"
  />
  <div v-else-if="product" class="detail-view">
    <ImageGallery :images="product.images ?? []" :alt="product.name" />

    <div class="summary glass-card">
      <div class="summary-top">
        <span v-if="product.brand" class="brand">{{ product.brand.name }}</span>
        <span class="condition">{{ PHYSICAL_CONDITION_LABELS[product.physical_condition] }}</span>
      </div>

      <h1>{{ product.name }}</h1>

      <p v-if="product.model?.name" class="meta">{{ product.model.name }}</p>
      <p v-if="product.size" class="meta">Talla: {{ product.size }}</p>

      <div class="prices">
        <span v-if="product.promo_price" class="original-price">{{ formatPrice(product.price) }}</span>
        <span class="final-price">{{ formatPrice(finalPrice) }}</span>
      </div>

      <p v-if="product.description" class="description">{{ product.description }}</p>
      <p v-else-if="product.characteristics" class="description">{{ product.characteristics }}</p>

      <div class="actions">
        <button class="btn-primary" :disabled="inCart" @click="addToCart">
          {{ inCart ? 'Ya esta en tu carrito' : 'Agregar al carrito' }}
        </button>
        <button v-if="inCart" class="btn-secondary" @click="router.push('/checkout')">Ir a checkout</button>
        <button class="btn-secondary" @click="router.push(backRoute)">Volver al catalogo</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-view {
  display: grid;
  gap: 2rem;
}

@media (min-width: 900px) {
  .detail-view {
    grid-template-columns: 1.1fr 0.9fr;
    align-items: start;
  }
}

.summary {
  padding: 1.25rem;
}

.summary-top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.summary h1 {
  font-size: clamp(2rem, 4vw, 3rem);
  margin-bottom: 0.75rem;
}

.meta {
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.prices {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin: 1.5rem 0;
}

.original-price {
  text-decoration: line-through;
  color: var(--text-secondary);
}

.final-price {
  font-size: 2rem;
  font-weight: 700;
}

.description {
  color: var(--text-secondary);
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 2rem;
}
</style>
