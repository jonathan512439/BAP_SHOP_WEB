<script setup lang="ts">
defineProps<{
  currentPage: number
  totalPages: number
}>()

const emit = defineEmits<{
  (e: 'previous'): void
  (e: 'next'): void
}>()
</script>

<template>
  <div class="pagination-bar">
    <button type="button" class="pagination-btn" :disabled="currentPage === 1" @click="emit('previous')">
      Anterior
    </button>
    <span class="pagination-label">Pagina {{ currentPage }} de {{ totalPages }}</span>
    <button type="button" class="pagination-btn" :disabled="currentPage === totalPages" @click="emit('next')">
      Siguiente
    </button>
  </div>
</template>

<style scoped>
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
}

.pagination-btn {
  min-width: 110px;
  padding: 0.7rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-primary);
}

.pagination-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pagination-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
}
</style>
