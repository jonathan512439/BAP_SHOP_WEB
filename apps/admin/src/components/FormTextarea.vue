<script setup lang="ts">
defineProps<{
  label: string
  modelValue: string
  help?: string
  rows?: number
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <label class="form-field">
    <span class="form-label">{{ label }}</span>
    <textarea
      :value="modelValue"
      class="form-textarea"
      :rows="rows || 3"
      :placeholder="placeholder"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    ></textarea>
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

.form-textarea {
  width: 100%;
  padding: 0.85rem;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  resize: vertical;
  min-height: 120px;
  font: inherit;
}

.form-help {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  line-height: 1.5;
}
</style>
