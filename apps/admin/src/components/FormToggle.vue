<script setup lang="ts">
defineProps<{
  label: string
  help?: string
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()
</script>

<template>
  <label class="toggle-field">
    <div class="toggle-copy">
      <span class="toggle-label">{{ label }}</span>
      <small v-if="help" class="toggle-help">{{ help }}</small>
    </div>
    <button
      type="button"
      class="toggle-control"
      :class="{ active: modelValue }"
      role="switch"
      :aria-checked="modelValue"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span class="toggle-thumb"></span>
    </button>
  </label>
</template>

<style scoped>
.toggle-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 0.9rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
}

.toggle-copy {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.toggle-label {
  font-size: 0.9rem;
  color: var(--text-primary);
}

.toggle-help {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.toggle-control {
  width: 52px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid var(--border-light);
  background: rgba(161, 161, 170, 0.18);
  padding: 2px;
  display: inline-flex;
  align-items: center;
  transition: var(--transition-fast);
}

.toggle-control.active {
  background: rgba(16, 185, 129, 0.25);
  border-color: rgba(16, 185, 129, 0.45);
}

.toggle-thumb {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: white;
  transform: translateX(0);
  transition: var(--transition-fast);
}

.toggle-control.active .toggle-thumb {
  transform: translateX(22px);
}
</style>
