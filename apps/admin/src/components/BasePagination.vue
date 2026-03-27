<script setup lang="ts">
defineProps<{
  page: number
  totalPages: number
}>()

const emit = defineEmits<{
  (e: 'previous'): void
  (e: 'next'): void
}>()
</script>

<template>
  <div class="pagination">
    <button type="button" class="btn btn-secondary btn-sm" :disabled="page === 1" @click="emit('previous')">
      Ant
    </button>
    <span class="text-sm text-secondary">Pagina {{ page }} de {{ totalPages }}</span>
    <button
      type="button"
      class="btn btn-secondary btn-sm"
      :disabled="page === totalPages"
      @click="emit('next')"
    >
      Sig
    </button>
  </div>
</template>

<style scoped>
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.text-sm {
  font-size: 0.875rem;
}

.text-secondary {
  color: var(--text-secondary);
}
</style>
