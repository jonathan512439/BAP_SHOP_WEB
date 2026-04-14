import type { Env } from './types/env'
import { nowISO } from '@bap-shop/shared'
import { rebuildCatalogSnapshots } from './lib/catalog-builder'
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
      console.warn(`[cron] Cron trigger desconocido: ${cronType}`)
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
  console.log(`[cron] Expirados ${orderIds.length} pedidos.`)
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
    console.log(`[cron] ${result.meta.changes} promociones vencidas deshabilitadas.`)
  }
}

/**
 * Limpia sesiones expiradas de admin_sessions (Daily Housekeeping)
 */
async function cleanupSessions(env: Env, now: string): Promise<void> {
  const result = await env.DB.prepare(
    `DELETE FROM admin_sessions WHERE expires_at <= ?`
  ).bind(now).run()
  console.log(`[cron] ${result.meta?.changes ?? 0} sesiones expiradas eliminadas.`)
}

/**
 * Backup semanal hacia R2 (Mecánica simple con D1 Dump - Requiere soporte WorkerD1/REST API en prod, 
 * por ahora lo dejamos como stub funcional)
 */
async function backupDatabase(env: Env): Promise<void> {
  const generatedAt = nowISO()
  const backupDate = generatedAt.slice(0, 10)

  const [products, productImages, productPromotions, orders, orderItems, settings] = await Promise.all([
    selectAll(env.DB, 'products'),
    selectAll(env.DB, 'product_images'),
    selectAll(env.DB, 'product_promotions'),
    selectAll(env.DB, 'orders'),
    selectAll(env.DB, 'order_items'),
    selectAll(env.DB, 'settings'),
  ])

  const payload = {
    generatedAt,
    tables: {
      products,
      product_images: productImages,
      product_promotions: productPromotions,
      orders,
      order_items: orderItems,
      settings,
    },
  }

  await env.R2.put(`backups/${backupDate}.json`, JSON.stringify(payload), {
    httpMetadata: {
      contentType: 'application/json',
    },
  })

  console.log(`[cron] Backup semanal generado en backups/${backupDate}.json`)
}

async function selectAll(db: D1Database, table: string): Promise<Record<string, unknown>[]> {
  const result = await db.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>()
  return result.results
}
