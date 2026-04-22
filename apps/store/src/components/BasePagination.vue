<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentPage: number
  totalPages: number
}>()

const emit = defineEmits<{
  (e: 'previous'): void
  (e: 'next'): void
  (e: 'go-to-page', page: number): void
}>()

const visiblePages = computed(() => {
  const pages: Array<number | string> = []
  const total = props.totalPages
  const current = props.currentPage
  const range = 1

  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  pages.push(1)

  const start = Math.max(2, current - range)
  const end = Math.min(total - 1, current + range)

  if (start > 2) {
    pages.push('...')
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }

  if (end < total - 1) {
    pages.push('...')
  }

  pages.push(total)
  return pages
})
</script>

<template>
  <div class="pagination-bar">
    <button
      type="button"
      class="pagination-btn"
      :disabled="currentPage === 1"
      aria-label="Ir a la pagina anterior"
      @click="emit('previous')"
    >
      Anterior
    </button>
    <div class="pagination-pages" aria-label="Paginas disponibles">
      <template v-for="(item, index) in visiblePages" :key="`${item}-${index}`">
        <span v-if="typeof item === 'string'" class="pagination-ellipsis" aria-hidden="true">{{ item }}</span>
        <button
          v-else
          type="button"
          class="pagination-number"
          :class="{ active: item === currentPage }"
          :aria-current="item === currentPage ? 'page' : undefined"
          :aria-label="`Ir a la pagina ${item}`"
          @click="emit('go-to-page', item)"
        >
          {{ item }}
        </button>
      </template>
    </div>
    <button
      type="button"
      class="pagination-btn"
      :disabled="currentPage === totalPages"
      aria-label="Ir a la pagina siguiente"
      @click="emit('next')"
    >
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

.pagination-pages {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.pagination-number,
.pagination-ellipsis {
  min-width: 2.25rem;
  height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  font-size: 0.9rem;
}

.pagination-number {
  border: 1px solid var(--border-light);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-primary);
  font-weight: 700;
  transition: background-color var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
}

.pagination-number:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--border-focus);
  transform: translateY(-1px);
}

.pagination-number.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: var(--bg-main);
}

.pagination-ellipsis {
  color: var(--text-tertiary);
}

.pagination-btn {
  min-width: 110px;
  padding: 0.7rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-primary);
  font-weight: 600;
  transition: background-color var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.pagination-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--border-focus);
}

.pagination-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .pagination-bar {
    flex-direction: column;
    align-items: stretch;
    padding: 0.9rem 1rem;
  }

  .pagination-btn {
    width: 100%;
  }

  .pagination-pages {
    order: -1;
  }
}
</style>
