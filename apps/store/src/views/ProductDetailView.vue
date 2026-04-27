<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatPrice, PHYSICAL_CONDITION_LABELS, PRODUCT_STATUS, type CatalogProductDetail } from '@bap-shop/shared'
import BaseEmptyState from '../components/BaseEmptyState.vue'
import ImageGallery from '../components/ImageGallery.vue'
import { useCartStore } from '../stores/cart'
import { absoluteUrl, removeStructuredData, setDocumentMeta, setStructuredData, stripHtml } from '../lib/seo'

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore()

const ASSETS_DOMAIN = (import.meta.env.VITE_ASSETS_URL || 'https://assets.bapshop.com/public')
  .trim()
  .replace(/\/+$/, '')

const isLoading = ref(true)
const error = ref<string | null>(null)
const product = ref<CatalogProductDetail | null>(null)

const hasActivePromo = computed(() => {
  if (!product.value?.promo_price || !product.value?.discount_pct) return false
  if (!product.value.promo_ends_at) return true

  const endsAt = Date.parse(product.value.promo_ends_at)
  if (Number.isNaN(endsAt)) return true
  return endsAt > Date.now()
})

const effectivePromoPrice = computed(() => (hasActivePromo.value ? product.value?.promo_price ?? null : null))
const effectiveDiscountPct = computed(() => (hasActivePromo.value ? product.value?.discount_pct ?? null : null))
const finalPrice = computed(() => effectivePromoPrice.value ?? product.value?.price ?? 0)
const isSold = computed(() => product.value?.status === PRODUCT_STATUS.SOLD)
const isReserved = computed(() => product.value?.status === PRODUCT_STATUS.RESERVED)
const isUnavailable = computed(() => isSold.value || isReserved.value)
const inCart = computed(() => !!product.value && cartStore.isInCart(product.value.id))
const backRoute = computed(() => (product.value?.type === 'other' ? '/otros' : '/zapatillas'))

watch(
  product,
  (currentProduct) => {
    if (!currentProduct) {
      removeStructuredData('product')
      removeStructuredData('breadcrumbs')
      return
    }

    const titleParts = [currentProduct.name]
    if (currentProduct.brand?.name) titleParts.push(currentProduct.brand.name)
    titleParts.push('BAP Shop Oruro - Bolivia')

    const detailBits = [
      currentProduct.model?.name,
      currentProduct.size ? `Talla ${currentProduct.size}` : null,
      isReserved.value ? 'Reservado' : isSold.value ? 'Vendido' : 'Disponible',
    ].filter(Boolean)

    const sourceDescription = stripHtml(currentProduct.description || currentProduct.characteristics || '')
    const description = sourceDescription
      ? `${sourceDescription} | BAP Shop, Oruro - Bolivia.`
      : `Consulta fotos, estado y detalles de ${currentProduct.name}${detailBits.length ? `, ${detailBits.join(', ')}` : ''} en BAP Shop, tienda de Oruro - Bolivia.`

    setDocumentMeta({
      title: titleParts.join(' | '),
      description,
      canonicalPath: route.path,
      robots: 'index,follow',
      ogType: 'product',
      imageUrl: currentProduct.images[0]?.variants?.detail_url ?? currentProduct.images[0]?.url ?? null,
    })

    const productUrl = absoluteUrl(route.path)
    const offerPrice = effectivePromoPrice.value ?? currentProduct.price

    setStructuredData('product', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: currentProduct.name,
      description,
      image: currentProduct.images.map((image) => image.variants?.detail_url ?? image.url),
      sku: currentProduct.id,
      url: productUrl,
      brand: currentProduct.brand?.name
        ? {
            '@type': 'Brand',
            name: currentProduct.brand.name,
          }
        : undefined,
      size: currentProduct.size ?? undefined,
      itemCondition: 'https://schema.org/UsedCondition',
      offers: {
        '@type': 'Offer',
        priceCurrency: 'BOB',
        price: offerPrice.toFixed(2),
        availability: isUnavailable.value ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        url: productUrl,
        seller: {
          '@type': 'Organization',
          name: 'BAP Shop',
        },
      },
      additionalProperty: [
        {
          '@type': 'PropertyValue',
          name: 'Estado',
          value: PHYSICAL_CONDITION_LABELS[currentProduct.physical_condition],
        },
        currentProduct.model?.name
          ? {
              '@type': 'PropertyValue',
              name: 'Modelo',
              value: currentProduct.model.name,
            }
          : null,
      ].filter(Boolean),
    })

    setStructuredData('breadcrumbs', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Inicio',
          item: absoluteUrl('/'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: currentProduct.type === 'other' ? 'Otros' : 'Zapatillas',
          item: absoluteUrl(backRoute.value),
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: currentProduct.name,
          item: productUrl,
        },
      ],
    })
  },
  { immediate: true }
)

onUnmounted(() => {
  removeStructuredData('product')
  removeStructuredData('breadcrumbs')
})

onMounted(async () => {
  try {
    const productId = route.params.id as string
    const response = await fetch(`${ASSETS_DOMAIN}/products/${productId}.json`)

    if (!response.ok) {
      throw new Error('Producto no encontrado')
    }

    product.value = (await response.json()) as CatalogProductDetail
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'No se pudo cargar el producto'
  } finally {
    isLoading.value = false
  }
})

const addToCart = () => {
  if (!product.value || inCart.value || isUnavailable.value) return

  cartStore.addItem({
    id: product.value.id,
    type: product.value.type,
    status: product.value.status,
    name: product.value.name,
    brand: product.value.brand,
    model: product.value.model,
    size: product.value.size,
    price: product.value.price,
    promo_price: effectivePromoPrice.value,
    discount_pct: effectiveDiscountPct.value,
    physical_condition: product.value.physical_condition,
    primary_image_url:
      product.value.images.find((image) => image.is_primary)?.url ?? product.value.images[0]?.url ?? null,
    primary_image_variants:
      product.value.images.find((image) => image.is_primary)?.variants ?? product.value.images[0]?.variants ?? null,
    sort_order: 0,
  })
}
</script>

<template>
  <BaseEmptyState
    v-if="isLoading"
    title="Cargando producto..."
    description="Estamos preparando la informacion del producto que seleccionaste."
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
        <span class="condition" :class="{ 'is-sold': isSold, 'is-reserved': isReserved }">
          {{ isReserved ? 'Reservado' : isSold ? 'Vendido' : PHYSICAL_CONDITION_LABELS[product.physical_condition] }}
        </span>
      </div>

      <h1>{{ product.name }}</h1>

      <p v-if="product.model?.name" class="meta">{{ product.model.name }}</p>
      <p v-if="product.size" class="meta">Talla: {{ product.size }}</p>

      <div class="prices">
        <span v-if="effectivePromoPrice !== null" class="original-price">{{ formatPrice(product.price) }}</span>
        <span class="final-price">{{ formatPrice(finalPrice) }}</span>
      </div>

      <p v-if="product.description" class="description">{{ product.description }}</p>
      <p v-else-if="product.characteristics" class="description">{{ product.characteristics }}</p>
      <p v-if="isUnavailable" class="sold-note">
        {{
          isReserved
            ? 'Este articulo esta reservado temporalmente y no esta disponible para compra en este momento.'
            : 'Este articulo ya fue vendido. Puedes revisar sus fotos y detalles, pero ya no esta disponible para compra.'
        }}
      </p>
        
        <button
          class="btn-primary"
          :class="{ 'is-sold': isSold, 'is-reserved': isReserved }"
          :disabled="inCart || isUnavailable"
          @click="addToCart"
        >
          {{ isReserved ? 'Reservado' : isSold ? 'Vendido' : inCart ? 'Ya esta en tu carrito' : 'Agregar al carrito' }}
        </button>
      <div class="purchase-note">
        <strong>Atencion: Toda entrega es con previa coordinacion.</strong>
        <p>La compra se coordina por WhatsApp con la tienda. Se hacen entregas en la ciudad de Oruro.
           Tambien se hacen envios a nivel nacional.</p>
      </div>

      <div class="actions">
        
        <button v-if="inCart && !isUnavailable" class="btn-secondary" @click="router.push('/checkout')">Ir a checkout</button>
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
    grid-template-columns: minmax(0, 1.34fr) minmax(320px, 0.66fr);
    align-items: start;
  }
}

.summary {
  padding: 1.4rem;
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

.condition.is-sold {
  background: #c62828;
  color: #fff;
  padding: 0.35rem 0.8rem;
  border-radius: var(--radius-full);
}

.condition.is-reserved {
  background: #1565c0;
  color: #fff;
  padding: 0.35rem 0.8rem;
  border-radius: var(--radius-full);
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

.sold-note {
  margin-top: 1.25rem;
  padding: 0.9rem 1rem;
  border-radius: var(--radius-md);
  background: rgba(198, 40, 40, 0.12);
  border: 1px solid rgba(198, 40, 40, 0.28);
  color: #f5c2c2;
}

.btn-primary {
  display: block;
  margin: 1.5rem auto;
  padding: 0.95rem 1.8rem;
  font-size: 1.05rem;
  min-width: 220px;
}
.btn-secondary {
  padding: 0.8rem 1.2rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
  font-weight: 600;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.22);
  transform: translateY(-1px);
}

.btn-secondary:active {
  transform: translateY(0);
}
.purchase-note {
  margin-top: 1.1rem;
  padding: 1rem;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-light);
}

.purchase-note strong {
  display: inline-block;
  margin-bottom: 0.35rem;
}

.purchase-note p {
  color: var(--text-secondary);
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 2rem;
}

.btn-primary.is-sold {
  background: #5b1d1d;
  color: #f6d2d2;
  border-color: rgba(198, 40, 40, 0.35);
  cursor: not-allowed;
}

.btn-primary.is-reserved {
  background: #1b3f66;
  color: #dbeafe;
  border-color: rgba(21, 101, 192, 0.38);
  cursor: not-allowed;
}
</style>
