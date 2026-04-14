<script setup lang="ts">
defineProps<{
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'neutral'
  isLoading?: boolean
  singleAction?: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="emit('cancel')">
    <div class="modal-card admin-card">
      <div class="modal-copy">
        <h3>{{ title }}</h3>
        <p>{{ message }}</p>
      </div>

      <div class="modal-actions">
        <button
          v-if="!singleAction"
          type="button"
          class="btn btn-secondary"
          :disabled="isLoading"
          @click="emit('cancel')"
        >
          {{ cancelLabel || 'Cancelar' }}
        </button>
        <button
          type="button"
          class="btn"
          :class="{
            'btn-danger': variant === 'danger',
            'btn-warning': variant === 'warning',
            'btn-neutral': !variant || variant === 'neutral',
          }"
          :disabled="isLoading"
          @click="emit('confirm')"
        >
          {{ isLoading ? 'Procesando...' : confirmLabel || 'Confirmar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  display: grid;
  place-items: center;
  padding: 1.5rem;
  z-index: 80;
}

.modal-card {
  width: min(460px, 100%);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-copy h3 {
  margin: 0 0 0.5rem;
  font-size: 1.15rem;
}

.modal-copy p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-warning {
  background: var(--warning);
  color: white;
}

.btn-neutral {
  background: var(--text-primary);
  color: var(--bg-main);
}
</style>
