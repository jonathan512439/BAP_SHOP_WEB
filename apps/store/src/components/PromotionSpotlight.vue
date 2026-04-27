<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { CatalogCard } from '@bap-shop/shared'
import { formatPrice, PRODUCT_STATUS } from '@bap-shop/shared'
import { useCatalogStore } from '../stores/catalog'

const SESSION_KEY = 'bap_promotion_spotlight_dismissed'
const MAX_VISIBLE_PRODUCTS = 3

const router = useRouter()
const catalogStore = useCatalogStore()
const isDismissed = ref(true)

const promotedProducts = computed(() => {
  return catalogStore.products
    .filter((product) => {
      return (
        product.status === PRODUCT_STATUS.ACTIVE &&
        !!product.discount_pct &&
        !!product.promo_price
      )
    })
    .slice()
    .sort((a, b) => (b.discount_pct ?? 0) - (a.discount_pct ?? 0))
})

const visibleProducts = computed(() => promotedProducts.value.slice(0, MAX_VISIBLE_PRODUCTS))
const hiddenCount = computed(() => Math.max(promotedProducts.value.length - MAX_VISIBLE_PRODUCTS, 0))
const shouldShow = computed(() => !isDismissed.value && visibleProducts.value.length > 0)

const getImageUrl = (product: CatalogCard) => {
  return (
    product.primary_image_variants?.thumb_url ||
    product.primary_image_variants?.card_url ||
    product.primary_image_url ||
    ''
  )
}

const promoEndsLabel = (product: CatalogCard) => {
  if (!product.promo_ends_at) return ''
  const date = new Date(product.promo_ends_at)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const dismiss = () => {
  isDismissed.value = true
  sessionStorage.setItem(SESSION_KEY, '1')
}

const openProduct = (productId: string) => {
  dismiss()
  router.push(`/products/${productId}`)
}

const openCatalog = () => {
  dismiss()
  router.push('/zapatillas')
}

onMounted(async () => {
  isDismissed.value = sessionStorage.getItem(SESSION_KEY) === '1'
  if (isDismissed.value) return

  if (!catalogStore.isLoaded && !catalogStore.isLoading) {
    await catalogStore.fetchCatalog()
  }
})
</script>

<template>
  <aside v-if="shouldShow" class="promotion-spotlight" aria-label="Promociones activas">
    <button class="spotlight-close" type="button" aria-label="Cerrar promociones" @click="dismiss">
      x
    </button>

    <div class="spotlight-heading">
      <span class="eyebrow">Promociones activas</span>
      <strong>{{ promotedProducts.length }} {{ promotedProducts.length === 1 ? 'par con descuento' : 'pares con descuento' }}</strong>
      <p>Ofertas por tiempo limitado disponibles ahora.</p>
    </div>

    <div class="spotlight-list">
      <button
        v-for="product in visibleProducts"
        :key="product.id"
        type="button"
        class="spotlight-item"
        :aria-label="`Ver promocion de ${product.name}`"
        @click="openProduct(product.id)"
      >
        <img v-if="getImageUrl(product)" :src="getImageUrl(product)" :alt="product.name" loading="lazy" decoding="async" />
        <div v-else class="spotlight-no-image">Sin imagen</div>

        <div class="spotlight-copy">
          <span class="discount-pill">{{ product.discount_pct }}% DESC</span>
          <strong>{{ product.name }}</strong>
          <span class="spotlight-price">
            <del>{{ formatPrice(product.price) }}</del>
            <b>{{ formatPrice(product.promo_price || product.price) }}</b>
          </span>
          <small v-if="promoEndsLabel(product)">Hasta {{ promoEndsLabel(product) }}</small>
        </div>
      </button>
    </div>

    <button class="spotlight-action" type="button" @click="openCatalog">
      Ver catalogo
      <span v-if="hiddenCount > 0">+{{ hiddenCount }} mas</span>
    </button>
  </aside>
</template>

<style scoped>
.promotion-spotlight {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 85;
  width: min(390px, calc(100vw - 2rem));
  padding: 1rem;
  border-radius: 1.35rem;
  color: #f8fafc;
  background:
    radial-gradient(circle at top left, rgba(34, 211, 238, 0.26), transparent 34%),
    linear-gradient(145deg, rgba(2, 6, 23, 0.96), rgba(15, 23, 42, 0.92));
  border: 1px solid rgba(125, 211, 252, 0.28);
  box-shadow: 0 24px 70px rgba(2, 6, 23, 0.48);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.spotlight-close {
  position: absolute;
  top: 0.7rem;
  right: 0.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.8rem;
  height: 1.8rem;
  border: 1px solid rgba(226, 232, 240, 0.18);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #e2e8f0;
  font-weight: 800;
}

.spotlight-heading {
  display: grid;
  gap: 0.25rem;
  padding-right: 2.2rem;
}

.eyebrow {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #67e8f9;
}

.spotlight-heading strong {
  font-family: var(--font-heading);
  font-size: 1.2rem;
}

.spotlight-heading p {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.88rem;
}

.spotlight-list {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.9rem;
}

.spotlight-item {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 0.75rem;
  align-items: center;
  width: 100%;
  padding: 0.55rem;
  text-align: left;
  border: 1px solid rgba(226, 232, 240, 0.12);
  border-radius: 1rem;
  background: rgba(15, 23, 42, 0.58);
  color: inherit;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.spotlight-item:hover {
  transform: translateY(-2px);
  border-color: rgba(103, 232, 249, 0.42);
  background: rgba(15, 23, 42, 0.78);
}

.spotlight-item img,
.spotlight-no-image {
  width: 72px;
  height: 72px;
  border-radius: 0.8rem;
  object-fit: cover;
  background: rgba(148, 163, 184, 0.14);
}

.spotlight-no-image {
  display: grid;
  place-items: center;
  color: #94a3b8;
  font-size: 0.7rem;
}

.spotlight-copy {
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}

.spotlight-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.92rem;
}

.discount-pill {
  width: fit-content;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  background: #22d3ee;
  color: #06111f;
  font-size: 0.68rem;
  font-weight: 900;
}

.spotlight-price {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.spotlight-price del {
  color: #94a3b8;
  font-size: 0.8rem;
}

.spotlight-price b {
  color: #67e8f9;
  font-size: 0.95rem;
}

.spotlight-copy small {
  color: #fde68a;
  font-size: 0.72rem;
}

.spotlight-action {
  display: flex;
  justify-content: center;
  gap: 0.45rem;
  width: 100%;
  margin-top: 0.85rem;
  padding: 0.75rem 1rem;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #22d3ee, #67e8f9);
  color: #06111f;
  font-weight: 900;
}

@media (max-width: 640px) {
  .promotion-spotlight {
    left: 0.75rem;
    right: 0.75rem;
    bottom: 0.75rem;
    width: auto;
    padding: 0.85rem;
    border-radius: 1.15rem;
  }

  .spotlight-heading strong {
    font-size: 1.05rem;
  }

  .spotlight-list {
    gap: 0.5rem;
  }

  .spotlight-item {
    grid-template-columns: 60px 1fr;
    padding: 0.45rem;
  }

  .spotlight-item img,
  .spotlight-no-image {
    width: 60px;
    height: 60px;
  }
}
</style>
