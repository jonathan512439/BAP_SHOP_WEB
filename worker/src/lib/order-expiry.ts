type ExpireOrdersResult = {
  expiredOrders: number
  releasedProducts: number
}

/**
 * Expira pedidos pendientes vencidos y libera productos reservados.
 * Incluye una pasada defensiva para limpiar reservas vencidas que hayan quedado
 * inconsistentes por cualquier fallo operativo previo.
 */
export async function expirePendingOrdersAndReleaseProducts(
  db: D1Database,
  now: string
): Promise<ExpireOrdersResult> {
  const expiredOrders = await db
    .prepare(`SELECT id FROM orders WHERE status = 'pending' AND expires_at <= ?`)
    .bind(now)
    .all<{ id: string }>()

  const orderIds = expiredOrders.results.map((row) => row.id)
  let expiredOrdersCount = 0
  let releasedFromExpiredOrdersCount = 0

  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => '?').join(', ')
    const [ordersResult, productsResult] = await db.batch([
      db.prepare(
        `UPDATE orders
         SET status = 'expired', updated_at = ?
         WHERE id IN (${placeholders}) AND status = 'pending'`
      ).bind(now, ...orderIds),
      db.prepare(
        `UPDATE products
         SET status = 'active', reserved_order_id = NULL, reserved_until = NULL, updated_at = ?
         WHERE status = 'reserved' AND reserved_order_id IN (${placeholders})`
      ).bind(now, ...orderIds),
    ])

    expiredOrdersCount = ordersResult.meta?.changes ?? 0
    releasedFromExpiredOrdersCount = productsResult.meta?.changes ?? 0
  }

  // Fallback defensivo:
  // libera cualquier reserva vencida (reserved_until <= now) que no pertenezca
  // a un pedido confirmado. Evita que queden reservas "pegadas" si un cron falla.
  const staleReservationsResult = await db
    .prepare(
      `UPDATE products
       SET status = 'active', reserved_order_id = NULL, reserved_until = NULL, updated_at = ?
       WHERE status = 'reserved'
         AND reserved_until IS NOT NULL
         AND reserved_until <= ?
         AND (
           reserved_order_id IS NULL
           OR NOT EXISTS (
             SELECT 1
             FROM orders o
             WHERE o.id = products.reserved_order_id
               AND o.status = 'confirmed'
           )
         )`
    )
    .bind(now, now)
    .run()

  const releasedStaleReservationsCount = staleReservationsResult.meta?.changes ?? 0

  return {
    expiredOrders: expiredOrdersCount,
    releasedProducts: releasedFromExpiredOrdersCount + releasedStaleReservationsCount,
  }
}
