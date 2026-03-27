import { generateId, nowISO } from '@bap-shop/shared'

// ============================================================
// Generación y persistencia de Order Code
// Formato: BAP-YYYYMMDD-XXXX (4 chars base36 aleatorios)
// Ejemplo: BAP-20260322-A7K3
// ============================================================

/**
 * Genera un código de pedido con formato BAP-YYYYMMDD-XXXX.
 * El sufijo es aleatorio en base36 (0-9, A-Z) de 4 caracteres.
 */
function generateCode(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const suffix = Array.from(bytes)
    .map((b) => b.toString(36).toUpperCase())
    .join('')
    .slice(0, 4)
  return `BAP-${date}-${suffix}`
}

/**
 * Genera un order_code único verificando contra la base de datos.
 * Reintenta hasta 3 veces en caso de colisión (probabilidad prácticamente nula).
 * Lanza un error si no puede generar uno único tras 3 intentos.
 */
export async function generateUniqueOrderCode(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode()
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
 * Crea el pedido y reserva todos los artículos en una transacción D1 (batch atómico).
 * Si algún artículo ya no está 'active', retorna error.
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

  const reserveResult = await db
    .prepare(
      `UPDATE products
       SET status = 'reserved',
           reserved_order_id = ?,
           reserved_until = ?,
           updated_at = ?
       WHERE id IN (${placeholders}) AND status = 'active'`
    )
    .bind(orderId, expiresAt, now, ...productIds)
    .run()

  if ((reserveResult.meta?.changes ?? 0) !== productIds.length) {
    await releaseReservedProducts(db, orderId, now)
    throw new ConcurrencyError('Uno o más artículos ya no estaban disponibles al reservar')
  }

  const statements: D1PreparedStatement[] = [
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
  ]

  for (const item of input.items) {
    statements.push(
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
    )
  }

  try {
    await db.batch(statements)
  } catch (error) {
    await releaseReservedProducts(db, orderId, now)
    throw error
  }

  return { orderId, orderCode, expiresAt }
}

async function releaseReservedProducts(
  db: D1Database,
  orderId: string,
  now: string
): Promise<void> {
  await db.prepare(
    `UPDATE products
     SET status = 'active',
         reserved_order_id = NULL,
         reserved_until = NULL,
         updated_at = ?
     WHERE reserved_order_id = ?`
  ).bind(now, orderId).run()
}

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConcurrencyError'
  }
}
