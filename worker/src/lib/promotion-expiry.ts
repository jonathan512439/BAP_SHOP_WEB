/**
 * Deshabilita promociones vencidas.
 * Retorna la cantidad de filas afectadas.
 */
export async function expireEndedPromotions(
  db: D1Database,
  now: string
): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE product_promotions
       SET enabled = 0, updated_at = ?
       WHERE enabled = 1 AND ends_at <= ?`
    )
    .bind(now, now)
    .run()

  return result.meta?.changes ?? 0
}
