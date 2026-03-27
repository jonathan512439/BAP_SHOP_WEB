<script setup lang="ts">
defineProps<{
  id: string
  label: string
  modelValue: string
  type?: 'text' | 'tel' | 'search'
  placeholder?: string
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <label :for="id" class="input-group">
    <span>{{ label }}</span>
    <input
      :id="id"
      :value="modelValue"
      :type="type || 'text'"
      :placeholder="placeholder"
      :class="{ 'has-error': !!error }"
      :disabled="disabled"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="error-msg">{{ error }}</span>
  </label>
</template>

<style scoped>
.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.input-group span:first-child {
  font-size: 0.86rem;
  color: var(--text-secondary);
}

.input-group input {
  width: 100%;
  padding: 0.8rem 1rem;
  background: var(--bg-main);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font: inherit;
  transition: border-color var(--transition-fast);
}

.input-group input:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.input-group input.has-error {
  border-color: #ef4444;
}

.error-msg {
  font-size: 0.78rem;
  color: #f87171;
}
</style>
