import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { validateAndPriceCart, calculateTotals } from '../lib/pricing'
import { setupTestDb, cleanupTestDb } from './setup'
import { generateId, nowISO } from '@bap-shop/shared'

describe('Pricing Engine & Availability', () => {
  beforeAll(async () => {
    await setupTestDb()
    
    // Insertar un producto Activo sin descuento
    await env.DB.prepare(`
      INSERT INTO products (id, type, status, name, price, physical_condition, created_at, updated_at)
      VALUES (?, 'other', 'active', 'Camiseta Normal', 20000, 'new', ?, ?)
    `).bind('p_normal', nowISO(), nowISO()).run()

    // Insertar un producto Activo CON descuento (30%)
    await env.DB.prepare(`
      INSERT INTO products (id, type, status, name, price, physical_condition, created_at, updated_at)
      VALUES (?, 'sneaker', 'active', 'Zapatilla Descuento', 50000, 'new', ?, ?)
    `).bind('p_promo', nowISO(), nowISO()).run()
    
    // startDate < now < endDate
    const startDate = new Date(Date.now() - 100000).toISOString()
    const endDate = new Date(Date.now() + 100000).toISOString()
    await env.DB.prepare(`
      INSERT INTO product_promotions (product_id, discount_pct, starts_at, ends_at, enabled, created_at, updated_at)
      VALUES ('p_promo', 30, ?, ?, 1, ?, ?)
    `).bind(startDate, endDate, nowISO(), nowISO()).run()

    // Insertar un producto No disponible (sold)
    await env.DB.prepare(`
      INSERT INTO products (id, type, status, name, price, physical_condition, created_at, updated_at)
      VALUES (?, 'other', 'sold', 'Gorra Vendida', 15000, 'used_good', ?, ?)
    `).bind('p_sold', nowISO(), nowISO()).run()
  })

  afterAll(async () => {
    await cleanupTestDb()
  })

  it('validateAndPriceCart should return valid item with correct normal price', async () => {
    const { valid, invalid } = await validateAndPriceCart(env.DB, [{ productId: 'p_normal' }])
    
    expect(invalid.length).toBe(0)
    expect(valid.length).toBe(1)
    expect(valid[0].unitPrice).toBe(20000)
    expect(valid[0].promoPrice).toBeNull()
    expect(valid[0].finalPrice).toBe(20000)
  })

  it('validateAndPriceCart should calculate 30% discount correctly', async () => {
    const { valid } = await validateAndPriceCart(env.DB, [{ productId: 'p_promo' }])
    
    expect(valid[0].unitPrice).toBe(50000)
    // 30% de 50000 es 15000. Precio final = 35000
    expect(valid[0].promoPrice).toBe(35000)
    expect(valid[0].finalPrice).toBe(35000)
  })

  it('validateAndPriceCart should mark sold items as invalid', async () => {
    const { valid, invalid } = await validateAndPriceCart(env.DB, [{ productId: 'p_sold' }])
    
    expect(valid.length).toBe(0)
    expect(invalid.length).toBe(1)
    expect(invalid[0].productId).toBe('p_sold')
    expect(invalid[0].reason).toBe('sold')
  })

  it('validateAndPriceCart should handle non-existent ids gracefully', async () => {
    const { valid, invalid } = await validateAndPriceCart(env.DB, [{ productId: 'non-ext' }])
    expect(valid.length).toBe(0)
    expect(invalid.length).toBe(1)
    expect(invalid[0].reason).toBe('not_found')
  })

  it('calculateTotals should sum correctly', () => {
    const validItems = [
      { unitPrice: 20000, finalPrice: 20000 },
      { unitPrice: 50000, finalPrice: 35000 }
    ]
    const totals = calculateTotals(validItems as any)
    
    expect(totals.subtotal).toBe(70000)
    expect(totals.discount).toBe(15000)
    expect(totals.total).toBe(55000)
  })
})
