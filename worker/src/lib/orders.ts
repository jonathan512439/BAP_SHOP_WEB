import { generateId, generateOrderCode, nowISO } from '@bap-shop/shared'

// ============================================================
// Generación y persistencia de Order Code
// Formato: BAP-YYYYMMDD-XXXX (4 chars base36 aleatorios)
// Ejemplo: BAP-20260322-A7K3
// ============================================================

/**
 * Genera un order_code único verificando contra la base de datos.
 * Reutiliza generateOrderCode() de @bap-shop/shared.
 * Reintenta hasta 3 veces en caso de colisión (probabilidad prácticamente nula).
 */
export async function generateUniqueOrderCode(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateOrderCode()
    const existing = await db
      .prepare('SELECT id FROM orders WHERE order_code = ? LIMIT 1')
      .bind(code)
      .first<{ id: string }>()

    if (!existing) return code
  }
  throw new Error('No se pudo generar un order_code único tras 3 intentos')
}


// ============================================================
// Creación transaccional de pedido con reserva de artículos
// ============================================================

export interface CreateOrderInput {
  customerName: string
  customerPhone: string
  items: Array<{
    productId: string
    productName: string
    productType: 'sneaker' | 'other'
    productSize: string | null
    unitPrice: number
    promoPrice: number | null
    finalPrice: number
  }>
  subtotal: number
  discount: number
  total: number
  expiryMinutes: number
}

export interface CreateOrderResult {
  orderId: string
  orderCode: string
  expiresAt: string
}

/**
 * Crea el pedido de forma ATÓMICA: reserva de productos + insert de order + items
 * se ejecutan en un solo db.batch(), que D1 trata como transacción implícita.
 * 
 * Si cualquier statement falla, todo el batch se revierte automáticamente.
 * No se necesita rollback manual.
 * 
 * Post-batch: verifica que el UPDATE de reserva haya afectado exactamente
 * N filas. Si no, lanza ConcurrencyError (otro pedido reservó los mismos items).
 */
export async function createOrderTransaction(
  db: D1Database,
  input: CreateOrderInput
): Promise<CreateOrderResult> {
  const orderId = generateId()
  const orderCode = await generateUniqueOrderCode(db)
  const now = nowISO()
  const expiresAt = new Date(Date.now() + input.expiryMinutes * 60 * 1000).toISOString()
  const productIds = input.items.map((i) => i.productId)
  const placeholders = productIds.map(() => '?').join(', ')

  // Construir TODOS los statements para un solo batch atómico
  const statements: D1PreparedStatement[] = [
    // 1. Reservar productos (el UPDATE con WHERE status='active' previene doble reserva)
    db.prepare(
      `UPDATE products
       SET status = 'reserved',
           reserved_order_id = ?,
           reserved_until = ?,
           updated_at = ?
       WHERE id IN (${placeholders}) AND status = 'active'`
    ).bind(orderId, expiresAt, now, ...productIds),

    // 2. Insertar orden
    db.prepare(
      `INSERT INTO orders
        (id, order_code, customer_name, customer_phone, status,
         subtotal, discount, total, created_at, updated_at, expires_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`
    ).bind(
      orderId, orderCode, input.customerName, input.customerPhone,
      input.subtotal, input.discount, input.total,
      now, now, expiresAt
    ),

    // 3. Insertar items
    ...input.items.map((item) =>
      db.prepare(
        `INSERT INTO order_items
          (id, order_id, product_id, product_name, product_type,
           product_size, unit_price, promo_price, final_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        generateId(), orderId, item.productId, item.productName,
        item.productType, item.productSize ?? null,
        item.unitPrice, item.promoPrice ?? null, item.finalPrice
      )
    ),
  ]

  // Ejecutar batch atómico — si falla, D1 revierte todo automáticamente
  const results = await db.batch(statements)

  // Verificar que el UPDATE de reserva afectó exactamente los N productos esperados
  // results[0] corresponde al UPDATE de productos
  const reserveChanges = results[0]?.meta?.changes ?? 0
  if (reserveChanges !== productIds.length) {
    // El batch ya se ejecutó, pero no todos los productos estaban disponibles.
    // Revertir: liberar los que sí se reservaron y eliminar la orden creada.
    await db.batch([
      db.prepare(
        `UPDATE products
         SET status = 'active', reserved_order_id = NULL, reserved_until = NULL, updated_at = ?
         WHERE reserved_order_id = ?`
      ).bind(now, orderId),
      db.prepare('DELETE FROM order_items WHERE order_id = ?').bind(orderId),
      db.prepare('DELETE FROM orders WHERE id = ?').bind(orderId),
    ])
    throw new ConcurrencyError('Uno o más artículos ya no estaban disponibles al reservar')
  }

  return { orderId, orderCode, expiresAt }
}

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConcurrencyError'
  }
}

