import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { generateUniqueOrderCode } from '../lib/orders'
import { setupTestDb, cleanupTestDb } from './setup'
import { generateId, nowISO } from '@bap-shop/shared'

describe('Order Code Generator (D1 bound)', () => {
  beforeAll(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await cleanupTestDb()
  })

  it('generateUniqueOrderCode should return a valid string formatted as BAP-YYYYMMDD-XXXX', async () => {
    const code = await generateUniqueOrderCode(env.DB)
    expect(code).toMatch(/^BAP-\d{8}-[A-Z0-9]{4}$/)
  })

  it('generateUniqueOrderCode should not return the exact same code twice (random uniqueness)', async () => {
    const code1 = await generateUniqueOrderCode(env.DB)
    const code2 = await generateUniqueOrderCode(env.DB)
    expect(code1).not.toBe(code2)
  })

  it('generateUniqueOrderCode should avoid collisions if simulated in database', async () => {
    const freshCode = await generateUniqueOrderCode(env.DB)
    // Inserta artificialmente para provocar colision si justo intentara hacer ese mismo
    await env.DB.prepare(
      `INSERT INTO orders (id, order_code, customer_name, customer_phone, subtotal, discount, total, created_at, updated_at, expires_at)
       VALUES (?, ?, 'Test', '123', 0, 0, 0, ?, ?, ?)`
    ).bind(generateId(), freshCode, nowISO(), nowISO(), nowISO()).run()

    // Este nuevo código debería ser distinto al que metimos artificialmente a pesar de la remota posibilidad de colisión
    const nextCode = await generateUniqueOrderCode(env.DB)
    expect(nextCode).not.toBe(freshCode)
  })
})
