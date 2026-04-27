<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: string
  kind?: 'product' | 'order' | 'generic'
}>()

type BadgeConfig = {
  label: string
  color: string
}

const config = computed(() => {
  const productMap: Record<string, BadgeConfig> = {
    draft: { label: 'Borrador', color: 'var(--text-tertiary)' },
    active: { label: 'Activo', color: 'var(--success)' },
    hidden: { label: 'Oculto', color: 'var(--warning)' },
    reserved: { label: 'Reservado', color: 'var(--accent-hover)' },
    sold: { label: 'Vendido', color: 'var(--danger)' },
  }

  const orderMap: Record<string, BadgeConfig> = {
    pending: { label: 'Pendiente', color: 'var(--warning)' },
    confirmed: { label: 'Confirmado', color: 'var(--success)' },
    cancelled: { label: 'Cancelado', color: 'var(--danger)' },
    expired: { label: 'Expirado', color: 'var(--text-secondary)' },
  }

  const genericMap: Record<string, BadgeConfig> = {
    active: { label: 'Activo', color: 'var(--success)' },
    inactive: { label: 'Inactivo', color: 'var(--text-secondary)' },
    scheduled: { label: 'Programado', color: 'var(--warning)' },
    expired: { label: 'Expirado', color: 'var(--text-secondary)' },
    archived: { label: 'Archivado', color: 'var(--text-secondary)' },
    with_promo: { label: 'Con promo', color: 'var(--accent-hover)' },
    without_promo: { label: 'Sin promo', color: 'var(--text-tertiary)' },
  }

  const maps: Record<'product' | 'order' | 'generic', Record<string, BadgeConfig>> = {
    product: productMap,
    order: orderMap,
    generic: genericMap,
  }

  return maps[props.kind || 'generic'][props.status] || {
    label: props.status,
    color: 'var(--text-secondary)',
  }
})
</script>

<template>
  <span class="status-badge" :style="{ color: config.color, borderColor: config.color }">
    {{ config.label }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  border: 1px solid currentColor;
  background: rgba(0, 0, 0, 0.1);
}
</style>
