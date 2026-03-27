<script setup lang="ts">
defineProps<{
  label: string
  help?: string
}>()
</script>

<template>
  <label class="form-field">
    <span class="form-label">{{ label }}</span>
    <slot />
    <small v-if="help" class="form-help">{{ help }}</small>
  </label>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.form-label {
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.form-help {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  line-height: 1.5;
}
</style>
