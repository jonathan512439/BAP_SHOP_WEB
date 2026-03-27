<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { PRODUCT_TYPE, type ProductType } from '@bap-shop/shared'
import BaseEmptyState from '../components/BaseEmptyState.vue'
import BasePagination from '../components/BasePagination.vue'
import ProductCard from '../components/ProductCard.vue'
import FilterPanel from '../components/FilterPanel.vue'
import { useCatalogStore } from '../stores/catalog'
import { useFilters } from '../composables/useFilters'

const route = useRoute()
const catalogStore = useCatalogStore()
const ITEMS_PER_PAGE = 12

const categoryType = computed<ProductType>(() => {
  return route.name === 'others' ? PRODUCT_TYPE.OTHER : PRODUCT_TYPE.SNEAKER
})

const categoryTitle = computed(() => {
  return categoryType.value === PRODUCT_TYPE.SNEAKER ? 'Zapatillas seleccionadas' : 'Otros hallazgos'
})

const categoryDescription = computed(() => {
  return categoryType.value === PRODUCT_TYPE.SNEAKER
    ? 'Modelos curados, tallas visibles y disponibilidad sincronizada con el stock real.'
    : 'Accesorios y piezas complementarias publicadas desde el panel con snapshot publico.'
})
const showBrandFilters = computed(() => categoryType.value === PRODUCT_TYPE.SNEAKER)
const { currentPage, visibleProducts, totalPages, paginatedProducts, applyRouteFilters, clearFilters, goToPage } =
  useFilters(categoryType, ITEMS_PER_PAGE)

onMounted(() => {
  applyRouteFilters()
  catalogStore.fetchCatalog()
})
</script>

<template>
  <section class="catalog-view">
    <div class="hero">
      <div>
        <p class="eyebrow">Catalogo publico</p>
        <h1 class="title">{{ categoryTitle }}</h1>
        <p class="subtitle">{{ categoryDescription }}</p>
      </div>
      <div class="hero-meta glass-card">
        <span class="meta-label">Disponibles ahora</span>
        <strong class="meta-value">{{ visibleProducts.length }}</strong>
        <span class="meta-caption">{{ paginatedProducts.length }} visibles en esta pagina</span>
      </div>
    </div>

    <FilterPanel :show-brand-filters="showBrandFilters" @clear="clearFilters" />

    <BaseEmptyState
      v-if="catalogStore.isLoading"
      title="Cargando catalogo..."
      description="Estamos leyendo el ultimo snapshot publico disponible."
      loading
    />

    <BaseEmptyState
      v-else-if="catalogStore.error"
      title="No se pudo cargar el catalogo"
      :description="catalogStore.error"
      action-label="Reintentar"
      @action="catalogStore.fetchCatalog(true)"
    />

    <BaseEmptyState
      v-else-if="visibleProducts.length === 0"
      title="No hay resultados para estos filtros"
      description="Prueba limpiando marca, modelo, talla o condicion para ver mas productos."
    />

    <div v-else class="product-grid">
      <ProductCard v-for="product in paginatedProducts" :key="product.id" :product="product" />
    </div>

    <BasePagination
      v-if="visibleProducts.length > ITEMS_PER_PAGE"
      :current-page="currentPage"
      :total-pages="totalPages"
      @previous="goToPage(currentPage - 1)"
      @next="goToPage(currentPage + 1)"
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
    grid-template-columns: minmax(0, 1fr) 220px;
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
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-self: stretch;
  justify-content: center;
}

.meta-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  color: var(--text-tertiary);
  letter-spacing: 0.1em;
}

.meta-value {
  font-size: 2rem;
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

</style>
