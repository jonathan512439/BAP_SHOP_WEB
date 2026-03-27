<script setup lang="ts">
defineProps<{
  empty: boolean
  emptyMessage?: string
  colspan: number
}>()
</script>

<template>
  <div class="table-container">
    <table>
      <slot name="head" />
      <tbody v-if="!empty">
        <slot />
      </tbody>
      <tbody v-else>
        <tr>
          <td :colspan="colspan" class="text-center">{{ emptyMessage || 'No hay registros.' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.text-center {
  text-align: center;
  padding: 2rem;
}
</style>
