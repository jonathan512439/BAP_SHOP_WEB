import { env } from 'cloudflare:test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import worker from '../index'
import { nowISO } from '@bap-shop/shared'
import { generateCsrfToken, generateSessionToken } from '../lib/auth'
import { cleanupTestDb, setupTestDb } from './setup'

describe('Admin products routes', () => {
  const ids = {
    brand: '11111111-1111-4111-8111-111111111111',
    model: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    draftProduct: 'prod-draft',
    reservedProduct: 'prod-reserved',
    hiddenProduct: 'prod-hidden',
    deletableProduct: 'prod-delete',
    soldProduct: 'prod-sold',
    pendingDeleteProduct: 'prod-pending-delete',
    confirmedDeleteProduct: 'prod-confirmed-delete',
  }

  let sessionToken = ''
  let csrfToken = ''

  beforeAll(async () => {
    await setupTestDb()

    await env.DB.prepare(
      `CREATE TABLE admins (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`
    ).run()

    await env.DB.prepare(
      `CREATE TABLE admin_sessions (
        id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        csrf_token TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )`
    ).run()

    await env.DB.prepare(
      `CREATE TABLE audit_log (
        id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        created_at TEXT NOT NULL
      )`
    ).run()

    const now = nowISO()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const session = await generateSessionToken()
    sessionToken = session.token
    csrfToken = generateCsrfToken()

    await env.DB.prepare(
      `INSERT INTO admins (id, username, password_hash, created_at)
       VALUES ('admin-1', 'admin', 'hash-demo', ?)`
    ).bind(now).run()

    await env.DB.prepare(
      `INSERT INTO admin_sessions
        (id, admin_id, token_hash, csrf_token, ip_address, user_agent, created_at, expires_at)
       VALUES ('session-1', 'admin-1', ?, ?, '127.0.0.1', 'vitest', ?, ?)`
    ).bind(session.tokenHash, csrfToken, now, expiresAt).run()

    await env.DB.prepare(
      `INSERT INTO settings (key, value)
       VALUES ('catalog_version', '1')`
    ).run()

    await env.DB.prepare(
      `INSERT INTO brands (id, name, slug, is_active, created_at)
       VALUES (?, 'Nike', 'nike', 1, ?)`
    ).bind(ids.brand, now).run()

    await env.DB.prepare(
      `INSERT INTO models (id, brand_id, name, slug, is_active, created_at)
       VALUES (?, ?, 'Air Force 1', 'air-force-1', 1, ?)`
    ).bind(ids.model, ids.brand, now).run()

    await env.DB.prepare(
      `INSERT INTO products
        (id, type, status, name, model_id, size, description, price, physical_condition, reserved_order_id, reserved_until, created_at, updated_at)
       VALUES
        (?, 'sneaker', 'draft', 'Draft sin imagen', ?, '42', 'Pendiente', 45000, 'good', NULL, NULL, ?, ?),
        (?, 'sneaker', 'reserved', 'Reservado', ?, '43', 'Reservado', 47000, 'like_new', 'order-1', ?, ?, ?),
        (?, 'sneaker', 'hidden', 'Oculto', ?, '44', 'Oculto', 49000, 'very_good', NULL, NULL, ?, ?),
        (?, 'other', 'active', 'Eliminable', NULL, NULL, 'Eliminar', 15000, 'good', NULL, NULL, ?, ?),
        (?, 'sneaker', 'sold', 'Vendido reactivable', ?, '45', 'Vendido antes', 52000, 'like_new', NULL, NULL, ?, ?),
        (?, 'other', 'active', 'Pendiente bloqueo delete', NULL, NULL, 'Pendiente', 17000, 'good', NULL, NULL, ?, ?),
        (?, 'other', 'sold', 'Confirmado eliminable', NULL, NULL, 'Confirmado', 19000, 'good', NULL, NULL, ?, ?)`
    ).bind(
      ids.draftProduct,
      ids.model,
      now,
      now,
      ids.reservedProduct,
      ids.model,
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      now,
      now,
      ids.hiddenProduct,
      ids.model,
      now,
      now,
      ids.deletableProduct,
      now,
      now,
      ids.soldProduct,
      ids.model,
      now,
      now,
      ids.pendingDeleteProduct,
      now,
      now,
      ids.confirmedDeleteProduct,
      now,
      now
    ).run()

    await env.DB.prepare(
      `INSERT INTO product_images (id, product_id, r2_key, is_primary, sort_order, created_at)
       VALUES ('img-reserved', ?, 'products/prod-reserved/primary.webp', 1, 0, ?)`
    ).bind(ids.reservedProduct, now).run()

    await env.DB.prepare(
      `INSERT INTO product_images (id, product_id, r2_key, is_primary, sort_order, created_at)
       VALUES ('img-delete', ?, 'public/products/prod-delete/primary.webp', 1, 0, ?)`
    ).bind(ids.deletableProduct, now).run()

    await env.DB.prepare(
      `INSERT INTO product_images (id, product_id, r2_key, is_primary, sort_order, created_at)
       VALUES ('img-sold', ?, 'public/products/prod-sold/primary.webp', 1, 0, ?)`
    ).bind(ids.soldProduct, now).run()

    await env.DB.prepare(
      `INSERT INTO orders
        (id, order_code, customer_name, customer_phone, status, subtotal, discount, total, notes, created_at, updated_at, expires_at)
       VALUES
        ('order-pending-delete', 'BAP-TEST-PENDING', 'Cliente Pendiente', '70000001', 'pending', 17000, 0, 17000, NULL, ?, ?, ?),
        ('order-confirmed-delete', 'BAP-TEST-CONFIRMED', 'Cliente Confirmado', '70000002', 'confirmed', 19000, 0, 19000, NULL, ?, ?, ?)`
    ).bind(
      now,
      now,
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      now,
      now,
      new Date(Date.now() + 60 * 60 * 1000).toISOString()
    ).run()

    await env.DB.prepare(
      `INSERT INTO order_items
        (id, order_id, product_id, product_name, product_type, product_size, unit_price, promo_price, final_price)
       VALUES
        ('item-pending-delete', 'order-pending-delete', ?, 'Pendiente bloqueo delete', 'other', NULL, 17000, NULL, 17000),
        ('item-confirmed-delete', 'order-confirmed-delete', ?, 'Confirmado eliminable', 'other', NULL, 19000, NULL, 19000)`
    ).bind(ids.pendingDeleteProduct, ids.confirmedDeleteProduct).run()
  })

  afterAll(async () => {
    await env.DB.prepare('DROP TABLE IF EXISTS audit_log').run()
    await env.DB.prepare('DROP TABLE IF EXISTS admin_sessions').run()
    await env.DB.prepare('DROP TABLE IF EXISTS admins').run()
    await cleanupTestDb()
  })

  const adminRequest = (path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    headers.set('Cookie', `bap_session=${sessionToken}`)
    headers.set('X-CSRF-Token', csrfToken)

    return worker.fetch(
      new Request(`https://example.com${path}`, {
        ...init,
        headers,
      }),
      env,
      {} as ExecutionContext
    )
  }

  it('rechaza activar un draft sin imagen principal', async () => {
    const response = await adminRequest(`/admin/products/${ids.draftProduct}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'active' }),
    })

    const payload = await response.json<{ success: boolean; error: string; data?: { errors?: string[] } }>()

    expect(response.status).toBe(422)
    expect(payload.success).toBe(false)
    expect(payload.error).toContain('requisitos')
    expect(payload.data?.errors?.some((item) => item.includes('imagen'))).toBe(true)
  })

  it('al marcar sold un reservado limpia reserved_order_id y reserved_until', async () => {
    const response = await adminRequest(`/admin/products/${ids.reservedProduct}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'sold' }),
    })

    const payload = await response.json<{ success: boolean; data?: { status: string } }>()
    const product = await env.DB.prepare(
      'SELECT status, reserved_order_id, reserved_until FROM products WHERE id = ?'
    ).bind(ids.reservedProduct).first<{
      status: string
      reserved_order_id: string | null
      reserved_until: string | null
    }>()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.status).toBe('sold')
    expect(product).toMatchObject({
      status: 'sold',
      reserved_order_id: null,
      reserved_until: null,
    })
  })

  it('permite reservar manualmente un producto oculto sin asociarlo a un pedido', async () => {
    const response = await adminRequest(`/admin/products/${ids.hiddenProduct}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'reserved' }),
    })

    const payload = await response.json<{ success: boolean; data?: { status: string } }>()
    const product = await env.DB.prepare(
      'SELECT status, reserved_order_id, reserved_until FROM products WHERE id = ?'
    ).bind(ids.hiddenProduct).first<{
      status: string
      reserved_order_id: string | null
      reserved_until: string | null
    }>()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.status).toBe('reserved')
    expect(product).toMatchObject({
      status: 'reserved',
      reserved_order_id: null,
      reserved_until: null,
    })
  })

  it('permite reactivar un producto vendido cuando fue marcado por error', async () => {
    const response = await adminRequest(`/admin/products/${ids.soldProduct}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'active' }),
    })

    const payload = await response.json<{ success: boolean; data?: { status: string } }>()
    const product = await env.DB.prepare('SELECT status FROM products WHERE id = ?')
      .bind(ids.soldProduct)
      .first<{ status: string }>()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.status).toBe('active')
    expect(product?.status).toBe('active')
  })

  it('elimina un producto sin pedidos abiertos y borra sus imagenes asociadas', async () => {
    const response = await adminRequest(`/admin/products/${ids.deletableProduct}`, {
      method: 'DELETE',
    })

    const payload = await response.json<{ success: boolean; data?: { id: string } }>()
    const product = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(ids.deletableProduct).first()
    const image = await env.DB.prepare('SELECT id FROM product_images WHERE product_id = ?').bind(ids.deletableProduct).first()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.id).toBe(ids.deletableProduct)
    expect(product).toBeNull()
    expect(image).toBeNull()
  })

  it('rechaza eliminar un producto con pedido pendiente y devuelve una guia util', async () => {
    const response = await adminRequest(`/admin/products/${ids.pendingDeleteProduct}`, {
      method: 'DELETE',
    })

    const payload = await response.json<{ success: boolean; error: string }>()

    expect(response.status).toBe(409)
    expect(payload.success).toBe(false)
    expect(payload.error).toContain('pedido pendiente')
    expect(payload.error).toContain('oculto')
  })

  it('permite eliminar un producto ligado solo a pedidos confirmados', async () => {
    const response = await adminRequest(`/admin/products/${ids.confirmedDeleteProduct}`, {
      method: 'DELETE',
    })

    const payload = await response.json<{ success: boolean; data?: { id: string } }>()
    const product = await env.DB.prepare('SELECT id FROM products WHERE id = ?')
      .bind(ids.confirmedDeleteProduct)
      .first()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.id).toBe(ids.confirmedDeleteProduct)
    expect(product).toBeNull()
  })
})
