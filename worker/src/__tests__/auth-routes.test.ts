import { env } from 'cloudflare:test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import worker from '../index'
import { nowISO } from '@bap-shop/shared'
import { cleanupTestDb, setupTestDb } from './setup'
import { generateCsrfToken, generateSessionToken, hashPassword, verifyPassword } from '../lib/auth'

describe('Auth routes', () => {
  const adminId = 'admin-auth-1'
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

    const passwordHash = await hashPassword('ClaveActual123!', env.ADMIN_PEPPER)

    await env.DB.prepare(
      `INSERT INTO admins (id, username, password_hash, created_at)
       VALUES (?, 'admin', ?, ?)`
    ).bind(adminId, passwordHash, now).run()

    await env.DB.prepare(
      `INSERT INTO admin_sessions
        (id, admin_id, token_hash, csrf_token, ip_address, user_agent, created_at, expires_at)
       VALUES
        ('session-current', ?, ?, ?, '127.0.0.1', 'vitest', ?, ?),
        ('session-old', ?, 'legacy-hash', 'legacy-csrf', '127.0.0.2', 'vitest', ?, ?)`
    ).bind(adminId, session.tokenHash, csrfToken, now, expiresAt, adminId, now, expiresAt).run()
  })

  afterAll(async () => {
    await env.DB.prepare('DROP TABLE IF EXISTS audit_log').run()
    await env.DB.prepare('DROP TABLE IF EXISTS admin_sessions').run()
    await env.DB.prepare('DROP TABLE IF EXISTS admins').run()
    await cleanupTestDb()
  })

  const authRequest = (path: string, init?: RequestInit) => {
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

  it('permite cambiar contraseña validando la contraseña actual e invalida otras sesiones', async () => {
    const response = await authRequest('/auth/password', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'ClaveActual123!',
        newPassword: 'NuevaClave456!',
      }),
    })

    const payload = await response.json<{ success: boolean }>()
    const admin = await env.DB.prepare(
      'SELECT password_hash FROM admins WHERE id = ?'
    ).bind(adminId).first<{ password_hash: string }>()
    const currentSession = await env.DB.prepare(
      'SELECT id FROM admin_sessions WHERE id = ?'
    ).bind('session-current').first()
    const oldSession = await env.DB.prepare(
      'SELECT id FROM admin_sessions WHERE id = ?'
    ).bind('session-old').first()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(admin).not.toBeNull()
    expect(await verifyPassword('NuevaClave456!', admin!.password_hash, env.ADMIN_PEPPER)).toBe(true)
    expect(await verifyPassword('ClaveActual123!', admin!.password_hash, env.ADMIN_PEPPER)).toBe(false)
    expect(currentSession).not.toBeNull()
    expect(oldSession).toBeNull()
  })

  it('rechaza el cambio si la contraseña actual no coincide', async () => {
    const response = await authRequest('/auth/password', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'Incorrecta999!',
        newPassword: 'OtraClave789!',
      }),
    })

    const payload = await response.json<{ success: boolean; error: string }>()

    expect(response.status).toBe(401)
    expect(payload.success).toBe(false)
    expect(payload.error).toContain('actual')
  })
})
