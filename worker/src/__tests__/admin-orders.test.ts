import { env } from 'cloudflare:test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import worker from '../index'
import { nowISO } from '@bap-shop/shared'
import { generateCsrfToken, generateSessionToken } from '../lib/auth'
import { cleanupTestDb, setupTestDb } from './setup'

describe('Admin orders routes', () => {
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
      `INSERT INTO orders
        (id, order_code, customer_name, customer_phone, status, subtotal, discount, total, notes, created_at, updated_at, expires_at)
       VALUES
        ('order-1', 'BAP-20260327-AAAA', 'Juan Perez', '70000001', 'pending', 45000, 0, 45000, NULL, '2026-03-20T10:00:00.000Z', '2026-03-20T10:00:00.000Z', '2026-03-20T12:00:00.000Z'),
        ('order-2', 'BAP-20260327-BBBB', 'Maria Lopez', '71111111', 'confirmed', 50000, 5000, 45000, 'Entregado', '2026-03-25T10:00:00.000Z', '2026-03-25T11:00:00.000Z', '2026-03-25T12:00:00.000Z')`
    ).run()

    await env.DB.prepare(
      `INSERT INTO order_items
        (id, order_id, product_id, product_name, product_type, product_size, unit_price, promo_price, final_price)
       VALUES
        ('item-1', 'order-1', 'prod-1', 'Nike AF1', 'sneaker', '42', 45000, NULL, 45000),
        ('item-2', 'order-2', 'prod-2', 'Adidas Campus', 'sneaker', '41', 50000, 45000, 45000)`
    ).run()
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

  it('filtra pedidos por estado, busqueda y rango de fechas', async () => {
    const response = await adminRequest(
      '/admin/orders?status=confirmed&search=Maria&date_from=2026-03-24T00:00:00.000Z&date_to=2026-03-26T00:00:00.000Z&page=1&limit=10'
    )

    const payload = await response.json<{
      success: boolean
      data: Array<{ id: string; order_code: string; item_count: number }>
      meta: { total: number; totalPages: number }
    }>()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data).toHaveLength(1)
    expect(payload.data[0]).toMatchObject({
      id: 'order-2',
      order_code: 'BAP-20260327-BBBB',
      item_count: 1,
    })
    expect(payload.meta).toMatchObject({
      total: 1,
      totalPages: 1,
    })
  })

  it('guarda notas internas y registra auditoria', async () => {
    const response = await adminRequest('/admin/orders/order-1/notes', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notes: 'Cliente pide entrega por la tarde',
      }),
    })

    const payload = await response.json<{ success: boolean; data?: { id: string; notes: string | null } }>()
    const order = await env.DB.prepare('SELECT notes FROM orders WHERE id = ?')
      .bind('order-1')
      .first<{ notes: string | null }>()
    const audit = await env.DB.prepare(
      "SELECT action, entity_type, entity_id, new_value FROM audit_log WHERE entity_id = 'order-1' ORDER BY created_at DESC LIMIT 1"
    ).first<{ action: string; entity_type: string; entity_id: string; new_value: string | null }>()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data).toEqual({
      id: 'order-1',
      notes: 'Cliente pide entrega por la tarde',
    })
    expect(order?.notes).toBe('Cliente pide entrega por la tarde')
    expect(audit).toMatchObject({
      action: 'order.notes',
      entity_type: 'order',
      entity_id: 'order-1',
    })
    expect(audit?.new_value).toContain('Cliente pide entrega por la tarde')
  })
})
