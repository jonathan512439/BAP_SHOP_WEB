import { upsertSetting } from './settings'

/**
 * Marca el catálogo como "dirty" para que el cron lo reconstruya.
 * Esto reemplaza las llamadas directas a rebuildCatalogSnapshots() en cada mutación,
 * reduciendo drásticamente la latencia de las operaciones admin y el consumo de R2.
 *
 * El cron cada 2 minutos verifica este flag y ejecuta el rebuild si está dirty.
 */
export async function markCatalogDirty(db: D1Database): Promise<void> {
  await upsertSetting(db, 'catalog_dirty', '1')
}
