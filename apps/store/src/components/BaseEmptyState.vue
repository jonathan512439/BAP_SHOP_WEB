<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  loading?: boolean
  actionLabel?: string
}>()

const emit = defineEmits<{
  (e: 'action'): void
}>()
</script>

<template>
  <div class="state-block glass-card" :class="{ loading }">
    <div v-if="loading" class="spinner"></div>
    <h3 class="state-title">{{ title }}</h3>
    <p v-if="description" class="state-description">{{ description }}</p>
    <button v-if="actionLabel" type="button" class="state-action btn-primary" @click="emit('action')">
      {{ actionLabel }}
    </button>
  </div>
</template>

<style scoped>
.state-block {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  text-align: center;
  padding: 1.75rem;
}

.state-title {
  font-size: 1.15rem;
}

.state-description {
  max-width: 52ch;
  color: var(--text-secondary);
  line-height: 1.6;
}

.state-action {
  margin-top: 0.25rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 3px solid var(--border-light);
  border-top-color: var(--accent-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
