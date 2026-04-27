import { env } from 'cloudflare:test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { nowISO } from '@bap-shop/shared'
import { handleScheduled } from '../cron'
import { createOrderTransaction } from '../lib/orders'
import { cleanupTestDb, setupTestDb } from './setup'

describe('Orders and scheduled jobs', () => {
  beforeAll(async () => {
    await setupTestDb()

    const now = nowISO()
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    await env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES
        ('catalog_version', '5'),
        ('store_name', 'BAP Shop'),
        ('whatsapp_number', '+59170000000'),
        ('whatsapp_header', 'Hola')`
    ).run()

    await env.DB.prepare(
      `INSERT INTO orders
        (id, order_code, customer_name, customer_phone, status, subtotal, discount, total, created_at, updated_at, expires_at)
       VALUES
        ('order-expired', 'BAP-20260326-AAAA', 'Cliente 1', '70000001', 'pending', 30000, 0, 30000, ?, ?, ?),
        ('order-pending', 'BAP-20260326-BBBB', 'Cliente 2', '70000002', 'pending', 20000, 0, 20000, ?, ?, ?)`
    ).bind(now, now, past, now, now, future).run()

    await env.DB.prepare(
      `INSERT INTO products
        (id, type, status, name, price, physical_condition, reserved_order_id, reserved_until, created_at, updated_at)
       VALUES
        ('prod-expired', 'other', 'reserved', 'Producto reservado', 30000, 'good', 'order-expired', ?, ?, ?),
        ('prod-pending', 'other', 'reserved', 'Producto pendiente', 20000, 'good', 'order-pending', ?, ?, ?),
        ('prod-stale', 'other', 'reserved', 'Producto stale', 18000, 'good', 'order-inexistente', ?, ?, ?),
        ('prod-catalog', 'other', 'active', 'Producto catalogo', 15000, 'like_new', NULL, NULL, ?, ?)`
    ).bind(past, now, now, future, now, now, past, now, now, now, now).run()

    await env.DB.prepare(
      `INSERT INTO product_images
        (id, product_id, r2_key, is_primary, sort_order, created_at)
       VALUES ('img-cat', 'prod-catalog', 'products/prod-catalog/primary.webp', 1, 0, ?)`
    ).bind(now).run()

    await env.DB.prepare(
      `INSERT INTO product_promotions
        (product_id, discount_pct, starts_at, ends_at, enabled, created_at, updated_at)
       VALUES
        ('prod-catalog', 15, ?, ?, 1, ?, ?)`
    ).bind(past, past, now, now).run()
  })

  afterAll(async () => {
    await cleanupTestDb()
  })

  it('expira solo pedidos pending vencidos y libera sus productos', async () => {
    await handleScheduled('*/5 * * * *', env)

    const expiredOrder = await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind('order-expired').first<{ status: string }>()
    const pendingOrder = await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind('order-pending').first<{ status: string }>()
    const releasedProduct = await env.DB.prepare(
      'SELECT status, reserved_order_id, reserved_until FROM products WHERE id = ?'
    ).bind('prod-expired').first<{ status: string; reserved_order_id: string | null; reserved_until: string | null }>()
    const untouchedProduct = await env.DB.prepare(
      'SELECT status, reserved_order_id FROM products WHERE id = ?'
    ).bind('prod-pending').first<{ status: string; reserved_order_id: string | null }>()
    const staleReleasedProduct = await env.DB.prepare(
      'SELECT status, reserved_order_id, reserved_until FROM products WHERE id = ?'
    ).bind('prod-stale').first<{ status: string; reserved_order_id: string | null; reserved_until: string | null }>()

    expect(expiredOrder?.status).toBe('expired')
    expect(pendingOrder?.status).toBe('pending')
    expect(releasedProduct).toMatchObject({
      status: 'active',
      reserved_order_id: null,
      reserved_until: null,
    })
    expect(untouchedProduct).toMatchObject({
      status: 'reserved',
      reserved_order_id: 'order-pending',
    })
    expect(staleReleasedProduct).toMatchObject({
      status: 'active',
      reserved_order_id: null,
      reserved_until: null,
    })
  })

  it('crea pedidos pending y deja el producto en reserved hasta confirmacion admin', async () => {
    const now = nowISO()
    await env.DB.prepare(
      `INSERT INTO products
        (id, type, status, name, price, physical_condition, reserved_order_id, reserved_until, created_at, updated_at)
       VALUES
        ('prod-new-order', 'sneaker', 'active', 'Producto nuevo', 41000, 'like_new', NULL, NULL, ?, ?)`
    ).bind(now, now).run()

    const result = await createOrderTransaction(env.DB, {
      customerName: 'Cliente Reserva',
      customerPhone: '70000003',
      items: [
        {
          productId: 'prod-new-order',
          productName: 'Producto nuevo',
          productType: 'sneaker',
          productSize: '42',
          unitPrice: 41000,
          promoPrice: null,
          finalPrice: 41000,
        },
      ],
      subtotal: 41000,
      discount: 0,
      total: 41000,
      expiryMinutes: 20,
    })

    const createdOrder = await env.DB.prepare(
      'SELECT status, expires_at FROM orders WHERE id = ?'
    ).bind(result.orderId).first<{ status: string; expires_at: string }>()
    const reservedProduct = await env.DB.prepare(
      'SELECT status, reserved_order_id, reserved_until FROM products WHERE id = ?'
    ).bind('prod-new-order').first<{ status: string; reserved_order_id: string | null; reserved_until: string | null }>()

    expect(createdOrder?.status).toBe('pending')
    expect(createdOrder?.expires_at).toBe(result.expiresAt)
    expect(reservedProduct).toMatchObject({
      status: 'reserved',
      reserved_order_id: result.orderId,
      reserved_until: result.expiresAt,
    })
  })

  it('deshabilita promociones vencidas y genera backup semanal', async () => {
    await handleScheduled('*/5 * * * *', env)

    const promo = await env.DB.prepare(
      'SELECT enabled FROM product_promotions WHERE product_id = ?'
    ).bind('prod-catalog').first<{ enabled: number }>()
    expect(promo?.enabled).toBe(0)

    await handleScheduled('0 4 * * SUN', env)

    const backups = await env.R2.list({ prefix: 'backups/d1/' })
    const backupObject = backups.objects[0] ? await env.R2.get(backups.objects[0].key) : null
    expect(backupObject).not.toBeNull()

    const backupPayload = await backupObject!.json<{
      tables: {
        products: { rows: Array<{ id: string }> }
        orders: { rows: Array<{ id: string }> }
        settings: { rows: Array<{ key: string; value: string }> }
      }
    }>()

    expect(backupPayload.tables.products.rows.some((row) => row.id === 'prod-catalog')).toBe(true)
    expect(backupPayload.tables.orders.rows.some((row) => row.id === 'order-expired')).toBe(true)
    expect(backupPayload.tables.settings.rows.some((row) => row.key === 'catalog_version')).toBe(true)
  })
})
