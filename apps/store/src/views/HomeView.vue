<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCatalogStore } from '../stores/catalog'
import ProductCard from '../components/ProductCard.vue'

const catalogStore = useCatalogStore()
const featuredProducts = computed(() => catalogStore.filteredProducts.slice(0, 10))

onMounted(() => {
  catalogStore.fetchCatalog()
})
</script>

<template>
  <div class="home-view">
    <div class="hero">
      <h1 class="title">Sneakers exclusivos.<br/>Encuentra tu par ideal.</h1>
      <p class="subtitle">Catálogo premium sincronizado en tiempo real.</p>
    </div>

    <!-- Filtros (próximamente se pueden mover a un componente) -->
    <div class="filters-bar glass-card">
      <div class="filter-group">
        <label>Marca</label>
        <select v-model="catalogStore.selectedBrand" class="custom-select">
          <option value="">Todas</option>
          <option v-for="b in catalogStore.filters?.brands" :key="b.id" :value="b.id">
            {{ b.name }}
          </option>
        </select>
      </div>
      
      <!-- Otros filtros (Modelo, Talla) -->
      
      <div class="results-count" v-if="catalogStore.isLoaded">
        Mostrando {{ catalogStore.filteredProducts.length }} productos
      </div>
    </div>

    <!-- Grid de productos -->
    <div v-if="catalogStore.isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Cargando catálogo...</p>
    </div>
    
    <div v-else-if="catalogStore.error" class="error-state">
      <p>{{ catalogStore.error }}</p>
      <button class="btn-primary" @click="catalogStore.fetchCatalog()">Reintentar</button>
    </div>

    <div v-else class="product-grid">
      <ProductCard 
        v-for="product in featuredProducts" 
        :key="product.id" 
        :product="product"
      />
      
      <div v-if="catalogStore.filteredProducts.length === 0" class="empty-results">
        No se encontraron productos con estos filtros.
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero {
  text-align: center;
  padding: 3rem 1rem 4rem;
  animation: fadeUp 0.8s var(--bounce);
}

.title {
  font-size: clamp(2.5rem, 5vw, 4.5rem);
  letter-spacing: -0.03em;
  margin-bottom: 1.5rem;
  background: linear-gradient(to right, #ffffff, #a1a1aa);
  -webkit-background-clip: text;
  color: transparent;
}

.subtitle {
  font-size: 1.25rem;
  color: var(--text-secondary);
}

.filters-bar {
  margin-bottom: 2rem;
  padding: 1rem 1.5rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.5rem;
  justify-content: space-between;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-group label {
  font-weight: 500;
  color: var(--text-secondary);
}

.custom-select {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  color: var(--text-primary);
  padding: 0.5rem 2rem 0.5rem 1rem;
  border-radius: var(--radius-md);
  appearance: none;
  font-family: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1rem;
  transition: border-color var(--transition-fast);
}

.custom-select:hover, .custom-select:focus {
  border-color: var(--border-focus);
  outline: none;
}

.results-count {
  font-size: 0.875rem;
  color: var(--text-tertiary);
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2rem;
}

.loading-state, .error-state, .empty-results {
  text-align: center;
  padding: 4rem 1rem;
  color: var(--text-secondary);
  grid-column: 1 / -1;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-light);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  margin: 0 auto 1.5rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
