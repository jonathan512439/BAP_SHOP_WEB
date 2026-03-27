import { env } from 'cloudflare:test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { nowISO } from '@bap-shop/shared'
import { rebuildCatalogSnapshots } from '../lib/catalog-builder'
import { cleanupTestDb, setupTestDb } from './setup'

describe('Catalog Builder', () => {
  beforeAll(async () => {
    await setupTestDb()

    const now = nowISO()
    const promoStart = new Date(Date.now() - 60_000).toISOString()
    const promoEnd = new Date(Date.now() + 60_000).toISOString()

    await env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES
        ('catalog_version', '1'),
        ('store_name', 'BAP Shop'),
        ('whatsapp_number', '+59170000000'),
        ('whatsapp_header', 'Hola')`
    ).run()

    await env.DB.prepare(
      `INSERT INTO brands (id, name, slug, is_active, created_at)
       VALUES ('brand-1', 'Nike', 'nike', 1, ?)`
    ).bind(now).run()

    await env.DB.prepare(
      `INSERT INTO models (id, brand_id, name, slug, is_active, created_at)
       VALUES ('model-1', 'brand-1', 'Air Force 1', 'air-force-1', 1, ?)`
    ).bind(now).run()

    await env.DB.prepare(
      `INSERT INTO products
        (id, type, status, name, model_id, size, description, price, physical_condition, sort_order, created_at, updated_at)
       VALUES
        ('prod-1', 'sneaker', 'active', 'Nike Air Force 1 Low', 'model-1', '42', 'Descripcion', 45000, 'like_new', 3, ?, ?),
        ('prod-2', 'other', 'active', 'Bolso deportivo', NULL, NULL, 'Bolso', 18000, 'good', 7, ?, ?),
        ('prod-3', 'other', 'hidden', 'Borrado oculto', NULL, NULL, 'No visible', 10000, 'good', 9, ?, ?)`
    ).bind(now, now, now, now, now, now).run()

    await env.DB.prepare(
      `INSERT INTO product_images
        (id, product_id, r2_key, is_primary, sort_order, created_at)
       VALUES
        ('img-1', 'prod-1', 'products/prod-1/primary.webp', 1, 0, ?),
        ('img-2', 'prod-1', 'products/prod-1/secondary.webp', 0, 1, ?),
        ('img-3', 'prod-2', 'products/prod-2/primary.webp', 1, 0, ?)`
    ).bind(now, now, now).run()

    await env.DB.prepare(
      `INSERT INTO product_promotions
        (product_id, discount_pct, starts_at, ends_at, enabled, created_at, updated_at)
       VALUES ('prod-1', 20, ?, ?, 1, ?, ?)`
    ).bind(promoStart, promoEnd, now, now).run()
  })

  afterAll(async () => {
    await cleanupTestDb()
  })

  it('genera snapshots publicos correctos e incrementa catalog_version', async () => {
    await rebuildCatalogSnapshots(env.DB, env.R2, env.R2_PUBLIC_DOMAIN)

    const versionRow = await env.DB.prepare(`SELECT value FROM settings WHERE key = 'catalog_version'`).first<{ value: string }>()
    expect(versionRow?.value).toBe('2')

    const manifestObject = await env.R2.get('public/manifest.json')
    const indexObject = await env.R2.get('public/catalog/index.json')
    const filtersObject = await env.R2.get('public/catalog/filters.json')
    const detailObject = await env.R2.get('public/products/prod-1.json')
    const hiddenDetailObject = await env.R2.get('public/products/prod-3.json')

    expect(manifestObject).not.toBeNull()
    expect(indexObject).not.toBeNull()
    expect(filtersObject).not.toBeNull()
    expect(detailObject).not.toBeNull()
    expect(hiddenDetailObject).toBeNull()

    const manifest = await manifestObject!.json<{ catalog_version: number; total_products: number }>()
    const index = await indexObject!.json<Array<{ id: string; promo_price: number | null; discount_pct: number | null }>>()
    const filters = await filtersObject!.json<{
      brands: Array<{ id: string; name: string; slug: string }>
      models: Array<{ id: string; brand_id: string; name: string; slug: string }>
      sizes: string[]
    }>()
    const detail = await detailObject!.json<{
      id: string
      images: Array<{ is_primary: boolean; url: string }>
      promo_price: number | null
      discount_pct: number | null
    }>()

    expect(manifest.catalog_version).toBe(2)
    expect(manifest.total_products).toBe(2)
    expect(index).toHaveLength(2)
    expect(index.find((item) => item.id === 'prod-1')).toMatchObject({
      promo_price: 36000,
      discount_pct: 20,
    })
    expect(filters.brands).toEqual([{ id: 'brand-1', name: 'Nike', slug: 'nike' }])
    expect(filters.models).toEqual([{ id: 'model-1', brand_id: 'brand-1', name: 'Air Force 1', slug: 'air-force-1' }])
    expect(filters.sizes).toEqual(['42'])
    expect(detail.id).toBe('prod-1')
    expect(detail.promo_price).toBe(36000)
    expect(detail.images[0]?.is_primary).toBe(true)
    expect(detail.images[0]?.url).toContain('https://assets.bapshop.com/products/prod-1/primary.webp')
  })
})
