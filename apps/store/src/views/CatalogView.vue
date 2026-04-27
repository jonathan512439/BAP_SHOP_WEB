<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { PRODUCT_STATUS, PRODUCT_TYPE, type ProductType } from '@bap-shop/shared'
import BaseEmptyState from '../components/BaseEmptyState.vue'
import BasePagination from '../components/BasePagination.vue'
import ProductCard from '../components/ProductCard.vue'
import FilterPanel from '../components/FilterPanel.vue'
import { useCatalogStore } from '../stores/catalog'
import { useBrandingStore } from '../stores/branding'
import { useFilters } from '../composables/useFilters'

const route = useRoute()
const catalogStore = useCatalogStore()
const brandingStore = useBrandingStore()
const ITEMS_PER_PAGE = 10

const categoryType = computed<ProductType>(() => {
  return route.name === 'others' ? PRODUCT_TYPE.OTHER : PRODUCT_TYPE.SNEAKER
})

const categoryTitle = computed(() => {
  return categoryType.value === PRODUCT_TYPE.SNEAKER ? 'Zapatillas disponibles' : 'Accesorios y complementos'
})

const categoryDescription = computed(() => {
  return categoryType.value === PRODUCT_TYPE.SNEAKER
    ? 'Descubre pares disponibles en nuestra tienda BAP Shop.'
    : 'Encuentra articulos complementarios seleccionados para tu estilo.'
})

const showBrandFilters = computed(() => categoryType.value === PRODUCT_TYPE.SNEAKER)

const { currentPage, visibleProducts, totalPages, paginatedProducts, applyRouteFilters, clearFilters, goToPage } =
  useFilters(categoryType, ITEMS_PER_PAGE)

const availableCount = computed(
  () => visibleProducts.value.filter((product) => product.status === PRODUCT_STATUS.ACTIVE).length
)
const listedCount = computed(() => visibleProducts.value.length)



onMounted(() => {
  brandingStore.loadBranding()
  applyRouteFilters()
  catalogStore.fetchCatalog()
})
</script>

<template>
  <section class="catalog-view" :aria-busy="catalogStore.isLoading">
    <div class="hero">
      <div>
        <p class="eyebrow">BAP Shop | Oruro - Bolivia</p>
        <h1 class="title">{{ categoryTitle }}</h1>
        <p class="subtitle">{{ categoryDescription }}</p>
      </div>
      <div class="hero-meta glass-card">
        <div class="meta-item">
          <span class="meta-label">Disponibles ahora</span>
          <strong class="meta-value">{{ availableCount }} articulos</strong>
        </div>
        <div class="meta-item">
          <span class="meta-label">Mostrando en lista</span>
          <strong class="meta-value">{{ listedCount }} resultados</strong>
        </div>
      </div>
    </div>
    
    <FilterPanel :show-brand-filters="showBrandFilters" @clear="clearFilters" />
    
    <BaseEmptyState
      v-if="catalogStore.isLoading"
      title="Cargando productos..."
      description="Estamos preparando el listado mas reciente para ti."
      loading
    />

    <BaseEmptyState
      v-else-if="catalogStore.error"
      title="No se pudo cargar el catalogo"
      :description="catalogStore.error"
      action-label="Reintentar"
      @action="catalogStore.fetchCatalog()"
    />

    <BaseEmptyState
      v-else-if="visibleProducts.length === 0"
      title="No hay resultados para estos filtros"
      description="Prueba limpiando marca, modelo, talla o condicion para ver mas productos."
    />

    <div v-else class="product-grid" role="list" aria-label="Productos del catalogo">
      <ProductCard v-for="product in paginatedProducts" :key="product.id" :product="product" />
    </div>

    <BasePagination
      v-if="visibleProducts.length > ITEMS_PER_PAGE"
      :current-page="currentPage"
      :total-pages="totalPages"
      @previous="goToPage(currentPage - 1)"
      @next="goToPage(currentPage + 1)"
      @go-to-page="goToPage"
    />
  </section>
</template>

<style scoped>
.catalog-view {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  align-items: end;
}

@media (min-width: 960px) {
  .hero {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
  }
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.75rem;
  color: var(--accent-primary);
  margin-bottom: 0.75rem;
}

.title {
  font-size: clamp(2.5rem, 4vw, 4rem);
  letter-spacing: -0.04em;
  margin-bottom: 0.75rem;
}

.subtitle {
  color: var(--text-secondary);
  max-width: 60ch;
  font-size: 1rem;
}

.hero-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  align-self: stretch;
  justify-content: stretch;
  align-items: start;
  min-height: 128px;
  padding: 1.25rem 1.5rem;
  text-align: left;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
  min-width: 0;
}

.meta-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  color: var(--text-tertiary);
  letter-spacing: 0.1em;
}

.meta-value {
  font-size: clamp(1.2rem, 2.1vw, 1.8rem);
  font-family: var(--font-heading);
}

.meta-caption {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.5rem;
}

@media (max-width: 960px) {
  .hero-meta {
    grid-template-columns: minmax(0, 1fr);
    text-align: center;
    align-items: center;
  }
}

@media (max-width: 640px) {
  .catalog-view {
    gap: 1.25rem;
  }

  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
  }
}
</style>
