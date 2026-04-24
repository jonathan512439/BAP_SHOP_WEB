import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { HonoEnv } from '../types/env'
import { RATE_LIMITS, rateLimitMiddleware, sha256 } from '../middleware'
import { validateAndPriceCart, calculateTotals, buildPriceChanges } from '../lib/pricing'
import { createOrderTransaction, ConcurrencyError } from '../lib/orders'
import { markCatalogDirty } from '../lib/catalog-dirty'
import { rebuildCatalogSnapshots } from '../lib/catalog-builder'
import { verifyTurnstile } from '../lib/turnstile'
import { loadSettingsByKeys, upsertSetting } from '../lib/settings'
import { logError, logWarn, serializeError } from '../lib/logger'
import { buildWhatsappMessage, buildWhatsappUrl, validateName, validatePhone, MAX_CART_ITEMS } from '@bap-shop/shared'

export const ordersRouter = new Hono<HonoEnv>()

const IDEMPOTENCY_KEY_PATTERN = /^[a-zA-Z0-9:_-]{8,128}$/
const IDEMPOTENCY_PENDING_TTL_SEC = 120
const IDEMPOTENCY_COMPLETED_TTL_SEC = 24 * 60 * 60

type IdempotencyCompletedPayload = {
  orderId: string
  orderCode: string
  whatsappUrl: string
  priceChanges: ReturnType<typeof buildPriceChanges>
}

type IdempotencyRecord =
  | {
      status: 'processing'
      hash: string
      createdAt: string
    }
  | {
      status: 'completed'
      hash: string
      createdAt: string
      payload: IdempotencyCompletedPayload
    }

const createOrderSchema = z.object({
  customerName: z.string().trim().refine((value) => validateName(value).valid, {
    message: 'Nombre invalido',
  }),
  customerPhone: z.string().trim().refine((value) => validatePhone(value).valid, {
    message: 'Telefono invalido',
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
  rateLimitMiddleware(RATE_LIMITS.publicOrders),
  zValidator('json', createOrderSchema),
  async (c) => {
    const { customerName, customerPhone, turnstileToken, items } = c.req.valid('json')

    const idempotencyKey = normalizeIdempotencyKey(c.req.header('Idempotency-Key'))
    const idempotencyStorageKey = idempotencyKey ? buildIdempotencyStorageKey(c, idempotencyKey) : null
    const requestHash = await buildOrderRequestHash({
      customerName,
      customerPhone,
      items: items.map((item) => ({
        productId: item.productId,
        cartPrice: item.cartPrice ?? null,
      })),
    })

    if (idempotencyStorageKey) {
      const previous = await readIdempotencyRecord(c, idempotencyStorageKey)

      if (previous && previous.hash !== requestHash) {
        return c.json(
          {
            success: false,
            error: 'La clave de idempotencia ya fue usada con otra solicitud.',
          },
          409
        )
      }

      if (previous?.status === 'completed') {
        const replayResponse = c.json({ success: true, data: previous.payload })
        replayResponse.headers.set('X-Idempotent-Replay', '1')
        return replayResponse
      }

      if (previous?.status === 'processing') {
        return c.json(
          {
            success: false,
            error: 'Ya hay un pedido en proceso con esta clave. Espera unos segundos e intenta nuevamente.',
          },
          409
        )
      }
    }

    const turnstileSecret = c.env.TURNSTILE_SECRET_STORE ?? c.env.TURNSTILE_SECRET
    const turnstileOk = await verifyTurnstile(turnstileToken, turnstileSecret, {
      requestId: c.get('requestId'),
      source: 'orders.create',
      environment: c.env.ENVIRONMENT,
    })
    if (!turnstileOk) {
      return c.json({ success: false, error: 'Verificacion de seguridad fallida' }, 422)
    }

    const { valid, invalid } = await validateAndPriceCart(c.env.DB, items)
    if (invalid.length > 0) {
      return c.json(
        {
          success: false,
          error: 'Uno o mas articulos no estan disponibles',
          data: { invalidItems: invalid },
        },
        422
      )
    }

    if (valid.length === 0) {
      return c.json({ success: false, error: 'El carrito esta vacio' }, 422)
    }

    const { subtotal, discount, total } = calculateTotals(valid)
    const expiryRow = await c.env.DB
      .prepare(`SELECT value FROM settings WHERE key = 'order_expiry_minutes'`)
      .first<{ value: string }>()
    const expiryMinutes = parseInt(expiryRow?.value ?? '120', 10)

    if (idempotencyStorageKey) {
      await writeIdempotencyRecord(c, idempotencyStorageKey, {
        status: 'processing',
        hash: requestHash,
        createdAt: new Date().toISOString(),
      }, IDEMPOTENCY_PENDING_TTL_SEC)
    }

    let orderCreated = false

    try {
      const orderResult = await createOrderTransaction(c.env.DB, {
        customerName,
        customerPhone,
        items: valid.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productType: item.productType,
          productSize: item.productSize,
          unitPrice: item.unitPrice,
          promoPrice: item.promoPrice,
          finalPrice: item.finalPrice,
        })),
        subtotal,
        discount,
        total,
        expiryMinutes,
      })
      orderCreated = true

      const settings = await getWhatsappSettings(c.env.DB)
      const orderItems = valid.map((item) => ({
        id: `item_${item.productId}`,
        order_id: orderResult.orderId,
        product_id: item.productId,
        product_name: item.productName,
        product_type: item.productType,
        product_size: item.productSize,
        unit_price: item.unitPrice,
        promo_price: item.promoPrice,
        final_price: item.finalPrice,
      }))

      const message = buildWhatsappMessage(
        {
          order_code: orderResult.orderCode,
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

      queueCatalogRefreshAfterInventoryMutation(c, {
        event: 'orders_reserved',
        orderId: orderResult.orderId,
      })

      const payload: IdempotencyCompletedPayload = {
        orderId: orderResult.orderId,
        orderCode: orderResult.orderCode,
        whatsappUrl,
        priceChanges: buildPriceChanges(valid),
      }

      if (idempotencyStorageKey) {
        await writeIdempotencyRecord(c, idempotencyStorageKey, {
          status: 'completed',
          hash: requestHash,
          createdAt: new Date().toISOString(),
          payload,
        }, IDEMPOTENCY_COMPLETED_TTL_SEC)
      }

      return c.json({
        success: true,
        data: payload,
      })
    } catch (error) {
      if (error instanceof ConcurrencyError) {
        if (idempotencyStorageKey) {
          await c.env.KV.delete(idempotencyStorageKey)
        }

        return c.json(
          {
            success: false,
            error: 'Un articulo fue reservado por otro cliente. Por favor revisa tu carrito.',
          },
          409
        )
      }

      if (idempotencyStorageKey && !orderCreated) {
        await c.env.KV.delete(idempotencyStorageKey)
      }

      if (idempotencyStorageKey && orderCreated) {
        logWarn('orders_idempotency_processing_left_open', {
          requestId: c.get('requestId'),
          key: idempotencyStorageKey,
        })
      }

      throw error
    }
  }
)

function normalizeIdempotencyKey(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || !IDEMPOTENCY_KEY_PATTERN.test(trimmed)) return null
  return trimmed
}

function buildIdempotencyStorageKey(c: Context<HonoEnv>, idempotencyKey: string) {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown'
  return `idem:orders:${ip}:${idempotencyKey}`
}

async function buildOrderRequestHash(input: { customerName: string; customerPhone: string; items: Array<{ productId: string; cartPrice: number | null }> }) {
  const normalized = JSON.stringify({
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    items: input.items,
  })
  return sha256(normalized)
}

async function readIdempotencyRecord(c: Context<HonoEnv>, storageKey: string) {
  const raw = await c.env.KV.get(storageKey)
  if (!raw) return null

  try {
    return JSON.parse(raw) as IdempotencyRecord
  } catch {
    await c.env.KV.delete(storageKey)
    return null
  }
}

async function writeIdempotencyRecord(
  c: Context<HonoEnv>,
  storageKey: string,
  payload: IdempotencyRecord,
  ttlSeconds: number,
) {
  await c.env.KV.put(storageKey, JSON.stringify(payload), { expirationTtl: ttlSeconds })
}

async function getWhatsappSettings(db: D1Database): Promise<{
  whatsapp_number: string
  store_name: string
  whatsapp_header: string
  whatsapp_template: string
}> {
  const map = await loadSettingsByKeys(db, [
    'whatsapp_number',
    'store_name',
    'whatsapp_header',
    'whatsapp_template',
  ])

  return {
    whatsapp_number: map['whatsapp_number'] ?? '',
    store_name: map['store_name'] ?? 'BAP Shop',
    whatsapp_header: map['whatsapp_header'] ?? '',
    whatsapp_template: map['whatsapp_template'] ?? '',
  }
}

async function refreshCatalogAfterInventoryMutation(
  c: Context<HonoEnv>,
  context: { event: string; orderId?: string }
): Promise<void> {
  try {
    await rebuildCatalogSnapshots(c.env.DB, c.env.R2, c.env.R2_PUBLIC_DOMAIN)
    await upsertSetting(c.env.DB, 'catalog_dirty', '0')
  } catch (error) {
    logError('catalog_rebuild_after_inventory_change_failed', {
      requestId: c.get('requestId'),
      event: context.event,
      orderId: context.orderId ?? null,
      error: serializeError(error, c.env.ENVIRONMENT !== 'production'),
    })

    try {
      await markCatalogDirty(c.env.DB)
    } catch (dirtyError) {
      logError('catalog_dirty_mark_failed', {
        requestId: c.get('requestId'),
        event: context.event,
        orderId: context.orderId ?? null,
        error: serializeError(dirtyError, c.env.ENVIRONMENT !== 'production'),
      })
    }
  }
}

function queueCatalogRefreshAfterInventoryMutation(
  c: Context<HonoEnv>,
  context: { event: string; orderId?: string }
) {
  const task = refreshCatalogAfterInventoryMutation(c, context)
  if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
    c.executionCtx.waitUntil(task)
    return
  }
  void task
}
