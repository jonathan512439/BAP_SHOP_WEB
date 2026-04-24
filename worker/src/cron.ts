import type { Env } from './types/env'
import { nowISO } from '@bap-shop/shared'
import { rebuildCatalogSnapshots } from './lib/catalog-builder'
import { loadSettingsByKeys, upsertSetting } from './lib/settings'
import { createDatabaseBackup } from './lib/backups'
import { logInfo, logWarn } from './lib/logger'
import { enableForeignKeys } from './middleware'

/**
 * Handler principal para Cron Triggers configurados en wrangler.
 */
export async function handleScheduled(
  cronType: string,
  env: Env
): Promise<void> {
  await enableForeignKeys(env.DB)

  const now = nowISO()

  switch (cronType) {
    case '*/5 * * * *':
      await expireOrders(env, now)
      await expirePromotions(env, now)
      await rebuildIfDirty(env)
      break
    case '0 * * * *':
      await expirePromotions(env, now)
      break
    case '0 3 * * *':
      await cleanupSessions(env, now)
      break
    case '0 4 * * SUN':
    case '0 4 * * 0':
      await backupDatabase(env)
      break
    default:
      logWarn('cron_unknown_trigger', { cronType })
  }
}

/**
 * Caduca pedidos pendientes y libera productos reservados.
 */
async function expireOrders(env: Env, now: string): Promise<void> {
  // 1. Obtener pedidos que expiran
  const expiredOrders = await env.DB.prepare(
    `SELECT id FROM orders WHERE status = 'pending' AND expires_at <= ?`
  ).bind(now).all<{ id: string }>()

  if (!expiredOrders.results || expiredOrders.results.length === 0) {
    return
  }

  const orderIds = expiredOrders.results.map((o) => o.id)
  const placeholders = orderIds.map(() => '?').join(', ')

  const statements: D1PreparedStatement[] = []

  // 2. Marcar pedidos como expirados
  statements.push(
    env.DB.prepare(
      `UPDATE orders SET status = 'expired', updated_at = ? WHERE id IN (${placeholders})`
    ).bind(now, ...orderIds)
  )

  // 3. Liberar productos reservados por estos pedidos
  statements.push(
    env.DB.prepare(
      `UPDATE products
       SET status = 'active', reserved_order_id = NULL, reserved_until = NULL, updated_at = ?
       WHERE reserved_order_id IN (${placeholders})`
    ).bind(now, ...orderIds)
  )

  await env.DB.batch(statements)
  
  // 4. Reconstruir catálogo ya que hay artículos nuevos disponibles
  await rebuildCatalogSnapshots(env.DB, env.R2, env.R2_PUBLIC_DOMAIN)
  logInfo('cron_orders_expired', { count: orderIds.length })
}

/**
 * Deshabilita promociones vencidas
 */
async function expirePromotions(env: Env, now: string): Promise<void> {
  const result = await env.DB.prepare(
    `UPDATE product_promotions SET enabled = 0, updated_at = ? WHERE enabled = 1 AND ends_at <= ?`
  ).bind(now, now).run()

  if (result.meta?.changes && result.meta.changes > 0) {
    await rebuildCatalogSnapshots(env.DB, env.R2, env.R2_PUBLIC_DOMAIN)
    logInfo('cron_promotions_expired', { count: result.meta.changes })
  }
}

/**
 * Limpia sesiones expiradas de admin_sessions (Daily Housekeeping)
 */
async function cleanupSessions(env: Env, now: string): Promise<void> {
  const result = await env.DB.prepare(
    `DELETE FROM admin_sessions WHERE expires_at <= ?`
  ).bind(now).run()
  logInfo('cron_sessions_cleaned', { count: result.meta?.changes ?? 0 })
}

/**
 * Rebuild diferido del catálogo: solo ejecuta si el flag catalog_dirty está en '1'.
 * Después del rebuild, limpia JSONs huérfanos en R2 (productos ocultos/eliminados).
 */
async function rebuildIfDirty(env: Env): Promise<void> {
  const settings = await loadSettingsByKeys(env.DB, ['catalog_dirty'])
  if (settings['catalog_dirty'] !== '1') return

  // Rebuild completo
  await rebuildCatalogSnapshots(env.DB, env.R2, env.R2_PUBLIC_DOMAIN)

  // Limpiar flag
  await upsertSetting(env.DB, 'catalog_dirty', '0')

  // Limpiar JSONs huérfanos: obtener IDs visibles y comparar con R2
  const visibleIds = await env.DB.prepare(
    `SELECT id FROM products WHERE status IN ('active', 'reserved', 'sold')`
  ).all<{ id: string }>()
  const validIds = new Set(visibleIds.results.map((r) => r.id))

  // Listar objetos en public/products/
  const listed = await env.R2.list({ prefix: 'public/products/' })
  const deleteKeys: string[] = []
  for (const obj of listed.objects) {
    // Extraer ID del key: public/products/{id}.json
    const match = obj.key.match(/^public\/products\/(.+)\.json$/)
    if (match && !validIds.has(match[1])) {
      deleteKeys.push(obj.key)
    }
  }

  if (deleteKeys.length > 0) {
    // R2 delete soporta hasta 1000 keys por llamada
    await Promise.all(deleteKeys.map((key) => env.R2.delete(key)))
    logInfo('cron_orphan_product_snapshots_deleted', { count: deleteKeys.length })
  }

  logInfo('cron_catalog_rebuilt', { reason: 'dirty_flag' })
}

/**
 * Backup semanal hacia R2 (Mecánica simple con D1 Dump - Requiere soporte WorkerD1/REST API en prod, 
 * por ahora lo dejamos como stub funcional)
 */
async function backupDatabase(env: Env): Promise<void> {
  const result = await createDatabaseBackup(env.DB, env.R2, {
    environment: env.ENVIRONMENT,
  })

  logInfo('cron_d1_backup_created', {
    key: result.key,
    bytes: result.bytes,
  })
  if (result.deletedBackups.length > 0) {
    logInfo('cron_d1_backups_pruned', { count: result.deletedBackups.length })
  }
}

// Allowlist de tablas permitidas para backup — previene SQL injection
