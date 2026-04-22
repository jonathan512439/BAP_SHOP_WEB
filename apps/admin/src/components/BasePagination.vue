<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  page: number
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
  const current = props.page
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

  for (let item = start; item <= end; item += 1) {
    pages.push(item)
  }

  if (end < total - 1) {
    pages.push('...')
  }

  pages.push(total)
  return pages
})
</script>

<template>
  <div class="pagination">
    <button type="button" class="btn btn-secondary btn-sm" :disabled="page === 1" @click="emit('previous')">
      Ant
    </button>
    <div class="pagination-pages" aria-label="Paginas disponibles">
      <template v-for="(item, index) in visiblePages" :key="`${item}-${index}`">
        <span v-if="typeof item === 'string'" class="pagination-ellipsis" aria-hidden="true">{{ item }}</span>
        <button
          v-else
          type="button"
          class="pagination-number"
          :class="{ active: item === page }"
          :aria-current="item === page ? 'page' : undefined"
          :aria-label="`Ir a la pagina ${item}`"
          @click="emit('go-to-page', item)"
        >
          {{ item }}
        </button>
      </template>
    </div>
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
  justify-content: center;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.pagination-pages {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.pagination-number,
.pagination-ellipsis {
  min-width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 0.8rem;
}

.pagination-number {
  border: 1px solid var(--border-light);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
  font-weight: 700;
}

.pagination-number:hover {
  border-color: var(--border-focus);
  background: rgba(255, 255, 255, 0.08);
}

.pagination-number.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: var(--bg-main);
}

.pagination-ellipsis {
  color: var(--text-tertiary);
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

@media (max-width: 640px) {
  .pagination {
    align-items: stretch;
  }

  .pagination-pages {
    order: -1;
    width: 100%;
  }
}
</style>
