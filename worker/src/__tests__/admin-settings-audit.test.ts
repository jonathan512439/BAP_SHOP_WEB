import { env } from 'cloudflare:test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import worker from '../index'
import { nowISO } from '@bap-shop/shared'
import { generateCsrfToken, generateSessionToken } from '../lib/auth'
import { cleanupTestDb, setupTestDb } from './setup'
import { normalizeManagedBrandingUrl } from '../routes/admin/settings-audit'

describe('Admin settings and audit routes', () => {
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
       VALUES
        ('whatsapp_number', '+59170000001'),
        ('store_name', 'BAP Shop'),
        ('whatsapp_header', 'Hola, quiero consultar por mi pedido'),
        ('order_expiry_minutes', '120'),
        ('catalog_version', '1')`
    ).run()

    await env.DB.prepare(
      `INSERT INTO audit_log
        (id, admin_id, action, entity_type, entity_id, old_value, new_value, created_at)
       VALUES
        ('audit-1', 'admin-1', 'product.status', 'product', 'prod-1', '{"status":"draft"}', '{"status":"active"}', '2026-03-25T10:00:00.000Z'),
        ('audit-2', 'admin-1', 'settings.update', 'settings', 'global', '{"store_name":"BAP Shop"}', '{"store_name":"BAP Shop Premium"}', '2026-03-26T10:00:00.000Z')`
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

  it('retorna settings como objeto plano', async () => {
    const response = await adminRequest('/admin/settings')
    const payload = await response.json<{ success: boolean; data: Record<string, string> }>()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data).toMatchObject({
      whatsapp_number: '+59170000001',
      store_name: 'BAP Shop',
      whatsapp_header: 'Hola, quiero consultar por mi pedido',
      order_expiry_minutes: '120',
    })
  })

  it('reescribe URLs antiguas de branding al dominio publico vigente', () => {
    expect(
      normalizeManagedBrandingUrl(
        'https://pub-470a5675dc7d4e9d949688372b59b080.r2.dev/public/branding/logo-1774764736762.jpg',
        'api.bab-shop.com'
      )
    ).toBe('https://api.bab-shop.com/public/branding/logo-1774764736762.jpg')

    expect(
      normalizeManagedBrandingUrl(
        'https://external.example.com/public/not-managed/logo.jpg',
        'api.bab-shop.com'
      )
    ).toBe('https://external.example.com/public/not-managed/logo.jpg')
  })

  it('actualiza settings validos y registra auditoria', async () => {
    const response = await adminRequest('/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        store_name: 'BAP Shop Premium',
        order_expiry_minutes: '240',
      }),
    })

    const payload = await response.json<{ success: boolean; data: Record<string, string> }>()
    const rows = await env.DB.prepare(
      "SELECT key, value FROM settings WHERE key IN ('store_name', 'order_expiry_minutes') ORDER BY key ASC"
    ).all<{ key: string; value: string }>()
    const audit = await env.DB.prepare(
      "SELECT action, entity_type, entity_id, new_value FROM audit_log WHERE action = 'settings.update' ORDER BY created_at DESC LIMIT 1"
    ).first<{ action: string; entity_type: string; entity_id: string; new_value: string | null }>()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data.store_name).toBe('BAP Shop Premium')
    expect(payload.data.order_expiry_minutes).toBe('240')
    expect(rows.results).toEqual([
      { key: 'order_expiry_minutes', value: '240' },
      { key: 'store_name', value: 'BAP Shop Premium' },
    ])
    expect(audit).toMatchObject({
      action: 'settings.update',
      entity_type: 'settings',
      entity_id: 'global',
    })
    expect(audit?.new_value).toContain('BAP Shop Premium')
  })

  it('filtra auditoria por accion, entidad y rango de fechas', async () => {
    const response = await adminRequest(
      '/admin/audit?action=settings&entity_type=settings&date_from=2026-03-26T00:00:00.000Z&date_to=2026-03-27T00:00:00.000Z&page=1&limit=10'
    )

    const payload = await response.json<{
      success: boolean
      data: Array<{ action: string; entity_type: string; admin_username: string }>
      meta: { total: number; totalPages: number }
    }>()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data.length).toBeGreaterThanOrEqual(1)
    expect(payload.data[0]).toMatchObject({
      action: 'settings.update',
      entity_type: 'settings',
      admin_username: 'admin',
    })
    expect(payload.meta.total).toBeGreaterThanOrEqual(1)
    expect(payload.meta.totalPages).toBe(1)
  })
})
