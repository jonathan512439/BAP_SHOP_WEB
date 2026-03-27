import { applyDiscount, nowISO } from '@bap-shop/shared'
import type { ProductPromotion } from '@bap-shop/shared'

// ============================================================
// Librería de precios y promociones
// ============================================================

export interface ValidatedCartItem {
  productId: string
  productName: string
  productType: 'sneaker' | 'other'
  productSize: string | null
  unitPrice: number
  promoPrice: number | null
  finalPrice: number
  cartPrice?: number   // precio que el cliente vio en su carrito (para priceChanges)
}

export interface InvalidCartItem {
  productId: string
  productName: string
  reason: 'sold' | 'hidden' | 'reserved' | 'draft' | 'not_found'
}

interface RawProductRow {
  id: string
  name: string
  type: 'sneaker' | 'other'
  size: string | null
  price: number
  status: string
  discount_pct: number | null
  promo_starts: string | null
  promo_ends: string | null
  promo_enabled: number | null
}

/**
 * Valida y calcula precios de todos los items del carrito en una sola query.
 * Incluye la promoción activa de cada producto (si existe).
 */
export async function validateAndPriceCart(
  db: D1Database,
  cartItems: Array<{ productId: string; cartPrice?: number }>
): Promise<{ valid: ValidatedCartItem[]; invalid: InvalidCartItem[] }> {
  if (cartItems.length === 0) return { valid: [], invalid: [] }

  const productIds = cartItems.map((i) => i.productId)
  const placeholders = productIds.map(() => '?').join(', ')
  const now = nowISO()

  // Una sola query: productos + LEFT JOIN promoción activa
  const rows = await db
    .prepare(
      `SELECT
        p.id, p.name, p.type, p.size, p.price, p.status,
        pp.discount_pct,
        pp.starts_at AS promo_starts,
        pp.ends_at   AS promo_ends,
        pp.enabled   AS promo_enabled
       FROM products p
       LEFT JOIN product_promotions pp ON pp.product_id = p.id
       WHERE p.id IN (${placeholders})`
    )
    .bind(...productIds)
    .all<RawProductRow>()

  const rowMap = new Map(rows.results.map((r) => [r.id, r]))
  const valid: ValidatedCartItem[] = []
  const invalid: InvalidCartItem[] = []

  for (const cartItem of cartItems) {
    const row = rowMap.get(cartItem.productId)

    if (!row) {
      invalid.push({ productId: cartItem.productId, productName: 'Artículo desconocido', reason: 'not_found' })
      continue
    }

    if (row.status !== 'active') {
      const reason = row.status as InvalidCartItem['reason']
      invalid.push({ productId: row.id, productName: row.name, reason })
      continue
    }

    // Calcular precio con promo
    let promoPrice: number | null = null
    if (
      row.discount_pct !== null &&
      row.promo_enabled === 1 &&
      row.promo_starts !== null && row.promo_starts <= now &&
      row.promo_ends !== null && row.promo_ends > now
    ) {
      promoPrice = applyDiscount(row.price, row.discount_pct)
    }

    const finalPrice = promoPrice ?? row.price

    valid.push({
      productId: row.id,
      productName: row.name,
      productType: row.type,
      productSize: row.size,
      unitPrice: row.price,
      promoPrice,
      finalPrice,
      cartPrice: cartItem.cartPrice,
    })
  }

  return { valid, invalid }
}

/**
 * Calcula los totales de un pedido.
 */
export function calculateTotals(items: ValidatedCartItem[]): {
  subtotal: number
  discount: number
  total: number
} {
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice, 0)
  const total = items.reduce((sum, i) => sum + i.finalPrice, 0)
  return { subtotal, discount: subtotal - total, total }
}

/**
 * Genera los priceChanges para notificar al frontend si algún precio cambió.
 */
export function buildPriceChanges(
  items: ValidatedCartItem[]
): Array<{
  productId: string
  productName: string
  cartPrice: number
  actualPrice: number
  changed: boolean
}> {
  return items
    .filter((i) => i.cartPrice !== undefined)
    .map((i) => ({
      productId: i.productId,
      productName: i.productName,
      cartPrice: i.cartPrice!,
      actualPrice: i.finalPrice,
      changed: i.cartPrice !== i.finalPrice,
    }))
}
