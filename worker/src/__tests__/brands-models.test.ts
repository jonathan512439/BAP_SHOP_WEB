import { env } from 'cloudflare:test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import worker from '../index'
import { nowISO } from '@bap-shop/shared'
import { generateCsrfToken, generateSessionToken } from '../lib/auth'
import { cleanupTestDb, setupTestDb } from './setup'

describe('Admin brands/models routes', () => {
  const ids = {
    brand1: '11111111-1111-4111-8111-111111111111',
    brand2: '22222222-2222-4222-8222-222222222222',
    brand3: '33333333-3333-4333-8333-333333333333',
    model1: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    model2: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    model3: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    missingModel: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
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
      `INSERT INTO brands (id, name, slug, is_active, created_at)
       VALUES
        (?, 'Nike', 'nike', 1, ?),
        (?, 'Adidas', 'adidas', 1, ?),
        (?, 'Puma', 'puma', 0, ?)`
    ).bind(ids.brand1, now, ids.brand2, now, ids.brand3, now).run()

    await env.DB.prepare(
      `INSERT INTO models (id, brand_id, name, slug, is_active, created_at)
       VALUES
        (?, ?, 'Air Force 1', 'air-force-1', 1, ?),
        (?, ?, 'Campus', 'campus', 1, ?),
        (?, ?, 'Suede', 'suede', 0, ?)`
    ).bind(ids.model1, ids.brand1, now, ids.model2, ids.brand2, now, ids.model3, ids.brand3, now).run()

    await env.DB.prepare(
      `INSERT INTO products
        (id, type, status, name, model_id, size, price, physical_condition, created_at, updated_at)
       VALUES
        ('prod-1', 'sneaker', 'active', 'Nike AF1 42', ?, '42', 50000, 'good', ?, ?),
        ('prod-2', 'sneaker', 'reserved', 'Nike AF1 43', ?, '43', 52000, 'like_new', ?, ?)`
    ).bind(ids.model1, now, now, ids.model1, now, now).run()
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

  it('rechaza actualizar una marca si el slug colisiona con otra existente', async () => {
    const response = await adminRequest(`/admin/brands/${ids.brand1}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Adidas' }),
    })

    const payload = await response.json<{ success: boolean; error: string }>()

    expect(response.status).toBe(409)
    expect(payload.success).toBe(false)
    expect(payload.error).toContain('otra marca')
  })

  it('rechaza archivar una marca si tiene productos activos o reservados', async () => {
    const response = await adminRequest(`/admin/brands/${ids.brand1}/archive`, {
      method: 'PATCH',
    })

    const payload = await response.json<{ success: boolean; error: string }>()

    expect(response.status).toBe(409)
    expect(payload.success).toBe(false)
    expect(payload.error).toContain('activo')
  })

  it('rechaza crear un modelo si la marca esta inactiva', async () => {
    const response = await adminRequest('/admin/models', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_id: ids.brand3,
        name: 'RS-X',
      }),
    })

    const payload = await response.json<{ success: boolean; error: string }>()

    expect(response.status).toBe(404)
    expect(payload.success).toBe(false)
    expect(payload.error).toContain('inactiva')
  })

  it('retorna 404 al archivar un modelo inexistente', async () => {
    const response = await adminRequest(`/admin/models/${ids.missingModel}/archive`, {
      method: 'PATCH',
    })

    const payload = await response.json<{ success: boolean; error: string }>()

    expect(response.status).toBe(404)
    expect(payload.success).toBe(false)
    expect(payload.error).toContain('no encontrado')
  })

  it('permite restaurar una marca archivada', async () => {
    const response = await adminRequest(`/admin/brands/${ids.brand3}/restore`, {
      method: 'PATCH',
    })

    const payload = await response.json<{ success: boolean }>()
    const brand = await env.DB.prepare('SELECT is_active FROM brands WHERE id = ?').bind(ids.brand3).first<{ is_active: number }>()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(brand?.is_active).toBe(1)
  })

  it('rechaza restaurar un modelo si su marca sigue archivada', async () => {
    await env.DB.prepare('UPDATE brands SET is_active = 0 WHERE id = ?').bind(ids.brand3).run()

    const response = await adminRequest(`/admin/models/${ids.model3}/restore`, {
      method: 'PATCH',
    })

    const payload = await response.json<{ success: boolean; error: string }>()

    expect(response.status).toBe(409)
    expect(payload.success).toBe(false)
    expect(payload.error).toContain('Restaura la marca primero')
  })

  it('permite restaurar un modelo archivado si su marca esta activa', async () => {
    await env.DB.prepare('UPDATE brands SET is_active = 1 WHERE id = ?').bind(ids.brand3).run()

    const response = await adminRequest(`/admin/models/${ids.model3}/restore`, {
      method: 'PATCH',
    })

    const payload = await response.json<{ success: boolean }>()
    const model = await env.DB.prepare('SELECT is_active FROM models WHERE id = ?').bind(ids.model3).first<{ is_active: number }>()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(model?.is_active).toBe(1)
  })
})
