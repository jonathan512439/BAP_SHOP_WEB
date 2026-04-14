import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { HonoEnv } from '../types/env'
import { rateLimitMiddleware } from '../middleware'
import { validateAndPriceCart, calculateTotals, buildPriceChanges } from '../lib/pricing'
import { createOrderTransaction, ConcurrencyError } from '../lib/orders'
import { rebuildCatalogSnapshots } from '../lib/catalog-builder'
import { buildWhatsappMessage, buildWhatsappUrl, validateName, validatePhone, MAX_CART_ITEMS } from '@bap-shop/shared'

export const ordersRouter = new Hono<HonoEnv>()

// ============================================================
// POST /orders — Crear pedido (endpoint público)
// ============================================================
const createOrderSchema = z.object({
  customerName: z.string().trim().refine((value) => validateName(value).valid, {
    message: 'Nombre inválido',
  }),
  customerPhone: z.string().trim().refine((value) => validatePhone(value).valid, {
    message: 'Teléfono inválido',
  }),
  turnstileToken: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        cartPrice: z.number().int().positive().optional(),
      })
    )
    .min(1)
    .max(MAX_CART_ITEMS),
})

ordersRouter.post(
  '/',
  rateLimitMiddleware('rl:orders', 10, 60 * 60),
  zValidator('json', createOrderSchema),
  async (c) => {
    const { customerName, customerPhone, turnstileToken, items } = c.req.valid('json')

    // 1. Verificar Turnstile
    const turnstileSecret = c.env.TURNSTILE_SECRET_STORE ?? c.env.TURNSTILE_SECRET
    const turnstileOk = await verifyTurnstile(turnstileToken, turnstileSecret)
    if (!turnstileOk) {
      return c.json({ success: false, error: 'Verificación de seguridad fallida' }, 422)
    }

    // 2. Validar y calcular precio de todos los items en una sola query batch
    const { valid, invalid } = await validateAndPriceCart(c.env.DB, items)

    if (invalid.length > 0) {
      return c.json(
        {
          success: false,
          error: 'Uno o más artículos no están disponibles',
          data: { invalidItems: invalid },
        },
        422
      )
    }

    if (valid.length === 0) {
      return c.json({ success: false, error: 'El carrito está vacío' }, 422)
    }

    // 3. Calcular totales
    const { subtotal, discount, total } = calculateTotals(valid)

    // 4. Leer tiempo de expiración de settings
    const expiryRow = await c.env.DB
      .prepare(`SELECT value FROM settings WHERE key = 'order_expiry_minutes'`)
      .first<{ value: string }>()
    const expiryMinutes = parseInt(expiryRow?.value ?? '120', 10)

    // 5. Crear pedido y dejar artículos en reserva temporal (transacción atómica D1)
    let orderId: string
    let orderCode: string

    try {
      const result = await createOrderTransaction(c.env.DB, {
        customerName,
        customerPhone,
        items: valid.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          productType: i.productType,
          productSize: i.productSize,
          unitPrice: i.unitPrice,
          promoPrice: i.promoPrice,
          finalPrice: i.finalPrice,
        })),
        subtotal,
        discount,
        total,
        expiryMinutes,
      })
      orderId = result.orderId
      orderCode = result.orderCode
    } catch (err) {
      if (err instanceof ConcurrencyError) {
        return c.json(
          {
            success: false,
            error: 'Un artículo fue reservado por otro cliente. Por favor revisa tu carrito.',
          },
          409
        )
      }
      throw err
    }

    // 6. Construir mensaje y URL de WhatsApp
    const settings = await getSettings(c.env.DB)
    const orderItems = valid.map((i) => ({
      id: `item_${i.productId}`,
      order_id: orderId,
      product_id: i.productId,
      product_name: i.productName,
      product_type: i.productType,
      product_size: i.productSize,
      unit_price: i.unitPrice,
      promo_price: i.promoPrice,
      final_price: i.finalPrice,
    }))

    const message = buildWhatsappMessage(
      {
        order_code: orderCode,
        customer_name: customerName,
        customer_phone: customerPhone,
        subtotal,
        discount,
        total,
      },
      orderItems,
      {
        whatsapp_number: settings.whatsapp_number,
        store_name: settings.store_name,
        whatsapp_header: settings.whatsapp_header,
        whatsapp_template: settings.whatsapp_template,
      }
    )

    const whatsappUrl = buildWhatsappUrl(settings.whatsapp_number, message)

    // 7. Rebuild síncrono del catálogo (artículos → reserved)
    try {
      await rebuildCatalogSnapshots(c.env.DB, c.env.R2, c.env.R2_PUBLIC_DOMAIN)
    } catch (err) {
      // El catálogo se reconstruirá en el próximo cron. El pedido ya fue creado.
      console.error('[catalog-builder] Error en rebuild post-pedido:', err)
    }

    // 8. Calcular priceChanges para notificar al frontend
    const priceChanges = buildPriceChanges(valid)

    return c.json({
      success: true,
      data: {
        orderId,
        orderCode,
        whatsappUrl,
        priceChanges,
      },
    })
  }
)

// ============================================================
// Helpers
// ============================================================

async function verifyTurnstile(token: string, secret: string): Promise<boolean> {
  try {
    const formData = new FormData()
    formData.append('secret', secret)
    formData.append('response', token)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json<{ success: boolean }>()
    return data.success === true
  } catch {
    return false
  }
}

async function getSettings(db: D1Database): Promise<{
  whatsapp_number: string
  store_name: string
  whatsapp_header: string
  whatsapp_template: string
}> {
  const rows = await db
    .prepare(`SELECT key, value FROM settings WHERE key IN ('whatsapp_number','store_name','whatsapp_header','whatsapp_template')`)
    .all<{ key: string; value: string }>()
  const map = Object.fromEntries(rows.results.map((r) => [r.key, r.value]))
  return {
    whatsapp_number: map['whatsapp_number'] ?? '',
    store_name: map['store_name'] ?? 'BAP Shop',
    whatsapp_header: map['whatsapp_header'] ?? '',
    whatsapp_template: map['whatsapp_template'] ?? '',
  }
}
