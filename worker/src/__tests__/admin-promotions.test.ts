import { env } from 'cloudflare:test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import worker from '../index'
import { nowISO } from '@bap-shop/shared'
import { generateCsrfToken, generateSessionToken } from '../lib/auth'
import { cleanupTestDb, setupTestDb } from './setup'

describe('Admin promotions routes', () => {
  const ids = {
    brand: '11111111-1111-4111-8111-111111111111',
    model: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    product: '80808080-8080-4080-8080-808080808080',
    missingProduct: '90909090-9090-4090-8090-909090909090',
  }

  let sessionToken = ''
  let csrfToken = ''

  beforeAll(async () => {
    await setupTestDb()

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
        (id, type, status, name, model_id, size, description, price, physical_condition, created_at, updated_at)
       VALUES
        (?, 'sneaker', 'active', 'Producto promo', ?, '42', 'Producto para promo', 50000, 'like_new', ?, ?)`
    ).bind(ids.product, ids.model, now, now).run()

    await env.DB.prepare(
      `INSERT INTO product_images (id, product_id, r2_key, is_primary, sort_order, created_at)
       VALUES ('img-promo', ?, 'products/prod-promo/primary.webp', 1, 0, ?)`
    ).bind(ids.product, now).run()
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

  it('crea o actualiza una promocion y registra auditoria', async () => {
    const response = await adminRequest(`/admin/promotions/${ids.product}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        discount_pct: 20,
        starts_at: '2026-03-27T10:00:00.000Z',
        ends_at: '2026-03-28T10:00:00.000Z',
        enabled: true,
      }),
    })

    const payload = await response.json<{
      success: boolean
      data?: { productId: string; discount_pct: number; enabled: boolean }
    }>()
    const promo = await env.DB.prepare(
      'SELECT discount_pct, enabled FROM product_promotions WHERE product_id = ?'
    ).bind(ids.product).first<{ discount_pct: number; enabled: number }>()
    const audit = await env.DB.prepare(
      "SELECT action, entity_id FROM audit_log WHERE entity_id = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(ids.product).first<{ action: string; entity_id: string }>()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data).toMatchObject({
      productId: ids.product,
      discount_pct: 20,
      enabled: true,
    })
    expect(promo).toMatchObject({
      discount_pct: 20,
      enabled: 1,
    })
    expect(audit).toMatchObject({
      action: 'promotion.upsert',
      entity_id: ids.product,
    })
  })

  it('deshabilita una promocion existente', async () => {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO product_promotions
        (product_id, discount_pct, starts_at, ends_at, enabled, created_at, updated_at)
       VALUES (?, 25, '2026-03-27T10:00:00.000Z', '2026-03-28T10:00:00.000Z', 1, ?, ?)`
    ).bind(ids.product, nowISO(), nowISO()).run()

    const response = await adminRequest(`/admin/promotions/${ids.product}/disable`, {
      method: 'PATCH',
    })

    const payload = await response.json<{ success: boolean }>()
    const promo = await env.DB.prepare(
      'SELECT enabled FROM product_promotions WHERE product_id = ?'
    ).bind(ids.product).first<{ enabled: number }>()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(promo?.enabled).toBe(0)
  })

  it('retorna 404 si se intenta crear promo para producto inexistente', async () => {
    const response = await adminRequest(`/admin/promotions/${ids.missingProduct}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        discount_pct: 15,
        starts_at: '2026-03-27T10:00:00.000Z',
        ends_at: '2026-03-28T10:00:00.000Z',
        enabled: true,
      }),
    })

    const payload = await response.json<{ success: boolean; error: string }>()

    expect(response.status).toBe(404)
    expect(payload.success).toBe(false)
    expect(payload.error).toContain('Producto no encontrado')
  })
})
