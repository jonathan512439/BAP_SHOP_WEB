<script setup lang="ts">
import { PHYSICAL_CONDITION_LABELS } from '@bap-shop/shared'
import { useCatalogStore } from '../stores/catalog'

defineProps<{
  showBrandFilters: boolean
}>()

const emit = defineEmits<{
  (e: 'clear'): void
}>()

const catalogStore = useCatalogStore()
</script>

<template>
  <div class="filters-panel glass-card">
    <div v-if="showBrandFilters" class="filter-group">
      <label for="brand-filter">Marca</label>
      <select id="brand-filter" v-model="catalogStore.selectedBrand" class="custom-select">
        <option value="">Todas</option>
        <option v-for="brand in catalogStore.filters?.brands ?? []" :key="brand.id" :value="brand.id">
          {{ brand.name }}
        </option>
      </select>
    </div>

    <div v-if="showBrandFilters" class="filter-group">
      <label for="model-filter">Modelo</label>
      <select id="model-filter" v-model="catalogStore.selectedModel" class="custom-select">
        <option value="">Todos</option>
        <option v-for="model in catalogStore.availableModels" :key="model.id" :value="model.id">
          {{ model.name }}
        </option>
      </select>
    </div>

    <div v-if="showBrandFilters" class="filter-group">
      <label for="size-filter">Talla</label>
      <select id="size-filter" v-model="catalogStore.selectedSize" class="custom-select">
        <option value="">Todas</option>
        <option v-for="size in catalogStore.filters?.sizes ?? []" :key="size" :value="size">
          {{ size }}
        </option>
      </select>
    </div>

    <div class="filter-group">
      <label for="condition-filter">Condicion</label>
      <select id="condition-filter" v-model="catalogStore.selectedCondition" class="custom-select">
        <option value="">Todas</option>
        <option
          v-for="condition in catalogStore.filters?.conditions ?? []"
          :key="condition"
          :value="condition"
        >
          {{ PHYSICAL_CONDITION_LABELS[condition] }}
        </option>
      </select>
    </div>

    <button type="button" class="clear-btn" @click="emit('clear')">
      Limpiar filtros
    </button>
  </div>
</template>

<style scoped>
.filters-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  align-items: end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-group label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.custom-select {
  width: 100%;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  color: var(--text-primary);
  padding: 0.75rem 0.9rem;
  border-radius: var(--radius-md);
}

.clear-btn {
  min-height: 46px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  background: transparent;
  transition: var(--transition-fast);
}

.clear-btn:hover {
  color: var(--text-primary);
  border-color: var(--border-focus);
}
</style>
