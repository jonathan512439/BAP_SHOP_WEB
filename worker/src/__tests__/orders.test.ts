import { env } from 'cloudflare:test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { nowISO } from '@bap-shop/shared'
import { handleScheduled } from '../cron'
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
        ('prod-catalog', 'other', 'active', 'Producto catalogo', 15000, 'like_new', NULL, NULL, ?, ?)`
    ).bind(past, now, now, future, now, now, now, now).run()

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
    await handleScheduled('*/15 * * * *', env)

    const expiredOrder = await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind('order-expired').first<{ status: string }>()
    const pendingOrder = await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind('order-pending').first<{ status: string }>()
    const releasedProduct = await env.DB.prepare(
      'SELECT status, reserved_order_id, reserved_until FROM products WHERE id = ?'
    ).bind('prod-expired').first<{ status: string; reserved_order_id: string | null; reserved_until: string | null }>()
    const untouchedProduct = await env.DB.prepare(
      'SELECT status, reserved_order_id FROM products WHERE id = ?'
    ).bind('prod-pending').first<{ status: string; reserved_order_id: string | null }>()

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
  })

  it('deshabilita promociones vencidas y genera backup semanal', async () => {
    await handleScheduled('0 * * * *', env)

    const promo = await env.DB.prepare(
      'SELECT enabled FROM product_promotions WHERE product_id = ?'
    ).bind('prod-catalog').first<{ enabled: number }>()
    expect(promo?.enabled).toBe(0)

    await handleScheduled('0 4 * * 0', env)

    const backupDate = nowISO().slice(0, 10)
    const backupObject = await env.R2.get(`backups/${backupDate}.json`)
    expect(backupObject).not.toBeNull()

    const backupPayload = await backupObject!.json<{
      tables: {
        products: Array<{ id: string }>
        orders: Array<{ id: string }>
        settings: Array<{ key: string; value: string }>
      }
    }>()

    expect(backupPayload.tables.products.some((row) => row.id === 'prod-catalog')).toBe(true)
    expect(backupPayload.tables.orders.some((row) => row.id === 'order-expired')).toBe(true)
    expect(backupPayload.tables.settings.some((row) => row.key === 'catalog_version')).toBe(true)
  })
})
