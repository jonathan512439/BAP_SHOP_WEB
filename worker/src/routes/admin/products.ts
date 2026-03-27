import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { HonoEnv } from '../../types/env'
import { authMiddleware, csrfMiddleware } from '../../middleware'
import { logAction } from '../../lib/audit'
import { rebuildCatalogSnapshots } from '../../lib/catalog-builder'
import { generateId, nowISO, VALID_STATUS_TRANSITIONS } from '@bap-shop/shared'
import type { ProductStatus } from '@bap-shop/shared'

export const adminProductsRouter = new Hono<HonoEnv>()
adminProductsRouter.use('*', authMiddleware())

// ============================================================
// Schemas de validación
// ============================================================
const sneakerSchema = z.object({
  type: z.literal('sneaker'),
  name: z.string().min(1).max(200).trim(),
  model_id: z.string().uuid(),
  size: z.string().min(1).max(20).trim(),
  price: z.number().int().positive(),
  physical_condition: z.enum(['new', 'like_new', 'very_good', 'good', 'acceptable']),
  description: z.string().max(2000).optional(),
  characteristics: z.undefined().optional(),
})

const otherSchema = z.object({
  type: z.literal('other'),
  name: z.string().min(1).max(200).trim(),
  model_id: z.undefined().optional(),
  size: z.undefined().optional(),
  price: z.number().int().positive(),
  physical_condition: z.enum(['new', 'like_new', 'very_good', 'good', 'acceptable']),
  description: z.string().max(2000).optional(),
  characteristics: z.string().max(1000).optional(),
})

const productSchema = z.discriminatedUnion('type', [sneakerSchema, otherSchema])
const productUpdateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  price: z.number().int().positive().optional(),
  physical_condition: z.enum(['new', 'like_new', 'very_good', 'good', 'acceptable']).optional(),
  description: z.string().max(2000).optional(),
  characteristics: z.string().max(1000).optional(),
  model_id: z.string().uuid().optional(),
  size: z.string().min(1).max(20).optional(),
})

// ============================================================
// GET /admin/products
// ============================================================
adminProductsRouter.get('/', async (c) => {
  const status = c.req.query('status')
  const type = c.req.query('type')
  const search = c.req.query('search')
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10))
  const limit = Math.min(50, parseInt(c.req.query('limit') ?? '20', 10))
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const bindings: unknown[] = []
  if (status) { conditions.push('p.status = ?'); bindings.push(status) }
  if (type) { conditions.push('p.type = ?'); bindings.push(type) }
  if (search) {
    conditions.push('(p.name LIKE ? OR m.name LIKE ? OR b.name LIKE ?)')
    const like = `%${search}%`; bindings.push(like, like, like)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [rows, total] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.id, p.type, p.status, p.name, p.size, p.price,
              p.physical_condition, p.sort_order, p.created_at, p.updated_at,
              m.name AS model_name, b.name AS brand_name,
              (SELECT r2_key FROM product_images WHERE product_id = p.id AND is_primary = 1) AS primary_image,
              (SELECT discount_pct FROM product_promotions WHERE product_id = p.id AND enabled = 1) AS promo_pct
       FROM products p
       LEFT JOIN models m ON m.id = p.model_id
       LEFT JOIN brands b ON b.id = m.brand_id
       ${where}
       ORDER BY p.sort_order ASC, p.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...bindings, limit, offset).all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS cnt FROM products p LEFT JOIN models m ON m.id = p.model_id LEFT JOIN brands b ON b.id = m.brand_id ${where}`)
      .bind(...bindings).first<{ cnt: number }>(),
  ])

  return c.json({
    success: true,
    data: rows.results,
    meta: { page, limit, total: total?.cnt ?? 0, totalPages: Math.ceil((total?.cnt ?? 0) / limit) },
  })
})

// ============================================================
// GET /admin/products/:id
// ============================================================
adminProductsRouter.get('/:id', async (c) => {
  const { id } = c.req.param()
  const [product, images, promo] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.*, m.name AS model_name, b.id AS brand_id, b.name AS brand_name
       FROM products p
       LEFT JOIN models m ON m.id = p.model_id
       LEFT JOIN brands b ON b.id = m.brand_id
       WHERE p.id = ?`
    ).bind(id).first(),
    c.env.DB.prepare(
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC'
    ).bind(id).all(),
    c.env.DB.prepare(
      'SELECT * FROM product_promotions WHERE product_id = ?'
    ).bind(id).first(),
  ])

  if (!product) return c.json({ success: false, error: 'Producto no encontrado' }, 404)
  return c.json({ success: true, data: { ...product, images: images.results, promotion: promo ?? null } })
})

// ============================================================
// POST /admin/products
// ============================================================
adminProductsRouter.post('/', csrfMiddleware(), zValidator('json', productSchema), async (c) => {
  const data = c.req.valid('json')
  const id = generateId()
  const now = nowISO()

  if (data.type === 'sneaker') {
    const model = await validateActiveModel(c.env.DB, data.model_id)
    if (!model) {
      return c.json({ success: false, error: 'Modelo no encontrado o marca inactiva' }, 422)
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO products
      (id, type, status, name, model_id, size, description, characteristics,
       price, physical_condition, sort_order, created_at, updated_at)
     VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).bind(
    id, data.type, data.name,
    data.type === 'sneaker' ? data.model_id : null,
    data.type === 'sneaker' ? data.size : null,
    data.description ?? null,
    data.type === 'other' ? (data.characteristics ?? null) : null,
    data.price, data.physical_condition, now, now
  ).run()

  await logAction(c.env.DB, c.get('adminId'), 'product.create', 'product', id, null, data)
  return c.json({ success: true, data: { id, status: 'draft' } }, 201)
})

// ============================================================
// PUT /admin/products/:id
// ============================================================
adminProductsRouter.put('/:id', csrfMiddleware(), zValidator('json', productUpdateSchema), async (c) => {
  const { id } = c.req.param()
  const updates = c.req.valid('json')
  const now = nowISO()

  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<{ status: string; type: string }>()
  if (!product) return c.json({ success: false, error: 'Producto no encontrado' }, 404)

  if (updates.model_id !== undefined && product.type === 'sneaker') {
    const model = await validateActiveModel(c.env.DB, updates.model_id)
    if (!model) {
      return c.json({ success: false, error: 'Modelo no encontrado o marca inactiva' }, 422)
    }
  }

  const fields: string[] = []
  const bindings: unknown[] = []

  if (updates.name !== undefined) { fields.push('name = ?'); bindings.push(updates.name) }
  if (updates.price !== undefined) { fields.push('price = ?'); bindings.push(updates.price) }
  if (updates.physical_condition !== undefined) { fields.push('physical_condition = ?'); bindings.push(updates.physical_condition) }
  if (updates.description !== undefined) { fields.push('description = ?'); bindings.push(updates.description) }
  if (updates.characteristics !== undefined && product.type === 'other') { fields.push('characteristics = ?'); bindings.push(updates.characteristics) }
  if (updates.model_id !== undefined && product.type === 'sneaker') { fields.push('model_id = ?'); bindings.push(updates.model_id) }
  if (updates.size !== undefined && product.type === 'sneaker') { fields.push('size = ?'); bindings.push(updates.size) }

  if (fields.length === 0) return c.json({ success: false, error: 'Nada que actualizar' }, 422)

  fields.push('updated_at = ?'); bindings.push(now)
  bindings.push(id)

  await c.env.DB.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).bind(...bindings).run()
  await logAction(c.env.DB, c.get('adminId'), 'product.update', 'product', id, product, updates)

  // Rebuild si el producto es visible
  if (['active', 'hidden'].includes(product.status)) {
    await rebuildCatalogSnapshots(c.env.DB, c.env.R2, c.env.R2_PUBLIC_DOMAIN)
  }

  return c.json({ success: true })
})

// ============================================================
// PATCH /admin/products/:id/status
// ============================================================
adminProductsRouter.patch('/:id/status', csrfMiddleware(), zValidator('json', z.object({ status: z.enum(['active', 'hidden', 'sold']) })), async (c) => {
  const { id } = c.req.param()
  const { status: newStatus } = c.req.valid('json')
  const now = nowISO()

  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<{
    id: string; status: ProductStatus; type: string; name: string; price: number;
    model_id: string | null; size: string | null; physical_condition: string
  }>()
  if (!product) return c.json({ success: false, error: 'Producto no encontrado' }, 404)

  // Verificar transición válida
  const validNext = VALID_STATUS_TRANSITIONS[product.status as ProductStatus] ?? []
  if (!validNext.includes(newStatus as ProductStatus)) {
    return c.json({
      success: false,
      error: `No puedes cambiar de "${product.status}" a "${newStatus}"`,
    }, 409)
  }

  // Validar completitud si se intenta activar
  if (newStatus === 'active') {
    const errors = await validateForActivation(c.env.DB, product)
    if (errors.length > 0) {
      return c.json({ success: false, error: 'El producto no cumple los requisitos para activarse', data: { errors } }, 422)
    }
  }

  await c.env.DB.prepare(
    `UPDATE products SET status = ?, updated_at = ?,
     reserved_order_id = CASE WHEN ? = 'sold' THEN NULL ELSE reserved_order_id END,
     reserved_until = CASE WHEN ? = 'sold' THEN NULL ELSE reserved_until END
     WHERE id = ?`
  ).bind(newStatus, now, newStatus, newStatus, id).run()

  await logAction(c.env.DB, c.get('adminId'), 'product.status', 'product', id, { status: product.status }, { status: newStatus })
  await rebuildCatalogSnapshots(c.env.DB, c.env.R2, c.env.R2_PUBLIC_DOMAIN)

  return c.json({ success: true, data: { id, status: newStatus } })
})

// ============================================================
// PATCH /admin/products/:id/sort
// ============================================================
adminProductsRouter.patch('/:id/sort', csrfMiddleware(), zValidator('json', z.object({ sort_order: z.number().int().min(0) })), async (c) => {
  const { id } = c.req.param()
  const { sort_order } = c.req.valid('json')
  await c.env.DB.prepare('UPDATE products SET sort_order = ?, updated_at = ? WHERE id = ?')
    .bind(sort_order, nowISO(), id).run()
  await rebuildCatalogSnapshots(c.env.DB, c.env.R2, c.env.R2_PUBLIC_DOMAIN)
  return c.json({ success: true })
})

// ============================================================
// Gestión de imágenes
// ============================================================

// POST /admin/products/:id/images
adminProductsRouter.post('/:id/images', csrfMiddleware(), async (c) => {
  const { id } = c.req.param()

  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first()
  if (!product) return c.json({ success: false, error: 'Producto no encontrado' }, 404)

  const contentType = c.req.header('Content-Type') ?? ''
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp']
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType]

  if (!allowedMimes.includes(contentType) || !ext) {
    return c.json({ success: false, error: 'Formato de imagen no válido. Usa JPG, PNG o WebP.' }, 422)
  }

  const body = await c.req.arrayBuffer()
  if (body.byteLength > 5 * 1024 * 1024) {
    return c.json({ success: false, error: 'La imagen supera el límite de 5MB' }, 422)
  }

  const imgId = generateId()
  const r2Key = `products/${id}/${imgId}.${ext}`

  await c.env.R2.put(r2Key, body, { httpMetadata: { contentType } })

  // Verificar si ya hay imágenes para determinar si esta es la primera (primary)
  const existing = await c.env.DB.prepare(
    'SELECT COUNT(*) AS cnt FROM product_images WHERE product_id = ?'
  ).bind(id).first<{ cnt: number }>()
  const isPrimary = !existing || existing.cnt === 0 ? 1 : 0

  const now = nowISO()
  await c.env.DB.prepare(
    `INSERT INTO product_images (id, product_id, r2_key, is_primary, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(imgId, id, r2Key, isPrimary, existing?.cnt ?? 0, now).run()

  await logAction(c.env.DB, c.get('adminId'), 'image.upload', 'product_image', imgId, null, { product_id: id, r2_key: r2Key })

  const productAfter = await c.env.DB.prepare('SELECT status FROM products WHERE id = ?').bind(id).first<{ status: string }>()
  if (productAfter?.status === 'active') {
    await rebuildCatalogSnapshots(c.env.DB, c.env.R2, c.env.R2_PUBLIC_DOMAIN)
  }

  return c.json({ success: true, data: { id: imgId, r2_key: r2Key, is_primary: isPrimary } }, 201)
})

// DELETE /admin/products/:id/images/:imgId
adminProductsRouter.delete('/:id/images/:imgId', csrfMiddleware(), async (c) => {
  const { id, imgId } = c.req.param()

  const img = await c.env.DB.prepare('SELECT * FROM product_images WHERE id = ? AND product_id = ?').bind(imgId, id).first<{
    id: string; r2_key: string; is_primary: number
  }>()
  if (!img) return c.json({ success: false, error: 'Imagen no encontrada' }, 404)

  await c.env.R2.delete(img.r2_key)
  await c.env.DB.prepare('DELETE FROM product_images WHERE id = ?').bind(imgId).run()

  // Si era la primaria, asignar la siguiente imagen como primaria
  if (img.is_primary === 1) {
    const next = await c.env.DB.prepare(
      'SELECT id FROM product_images WHERE product_id = ? ORDER BY sort_order ASC LIMIT 1'
    ).bind(id).first<{ id: string }>()
    if (next) {
      await c.env.DB.prepare('UPDATE product_images SET is_primary = 1 WHERE id = ?').bind(next.id).run()
    }
  }

  await logAction(c.env.DB, c.get('adminId'), 'image.delete', 'product_image', imgId, img, null)

  const productAfter = await c.env.DB.prepare('SELECT status FROM products WHERE id = ?').bind(id).first<{ status: string }>()
  if (productAfter?.status === 'active') {
    await rebuildCatalogSnapshots(c.env.DB, c.env.R2, c.env.R2_PUBLIC_DOMAIN)
  }

  return c.json({ success: true })
})

// PATCH /admin/products/:id/images/:imgId/primary
adminProductsRouter.patch('/:id/images/:imgId/primary', csrfMiddleware(), async (c) => {
  const { id, imgId } = c.req.param()

  const img = await c.env.DB.prepare('SELECT id FROM product_images WHERE id = ? AND product_id = ?').bind(imgId, id).first()
  if (!img) return c.json({ success: false, error: 'Imagen no encontrada' }, 404)

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE product_images SET is_primary = 0 WHERE product_id = ?').bind(id),
    c.env.DB.prepare('UPDATE product_images SET is_primary = 1 WHERE id = ?').bind(imgId),
  ])

  const productAfter = await c.env.DB.prepare('SELECT status FROM products WHERE id = ?').bind(id).first<{ status: string }>()
  if (productAfter?.status === 'active') {
    await rebuildCatalogSnapshots(c.env.DB, c.env.R2, c.env.R2_PUBLIC_DOMAIN)
  }

  return c.json({ success: true })
})

// PATCH /admin/products/:id/images/sort
adminProductsRouter.patch('/:id/images/sort', csrfMiddleware(), zValidator('json', z.array(z.object({ id: z.string(), sort_order: z.number().int().min(0) }))), async (c) => {
  const { id } = c.req.param()
  const items = c.req.valid('json')

  const statements = items.map((item) =>
    c.env.DB.prepare('UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ?')
      .bind(item.sort_order, item.id, id)
  )
  await c.env.DB.batch(statements)

  const productAfter = await c.env.DB.prepare('SELECT status FROM products WHERE id = ?').bind(id).first<{ status: string }>()
  if (productAfter?.status === 'active') {
    await rebuildCatalogSnapshots(c.env.DB, c.env.R2, c.env.R2_PUBLIC_DOMAIN)
  }

  return c.json({ success: true })
})

// ============================================================
// Helper: validar producto para activación
// ============================================================
async function validateForActivation(
  db: D1Database,
  product: { id: string; type: string; name: string; price: number; model_id: string | null; size: string | null; physical_condition: string }
): Promise<string[]> {
  const errors: string[] = []

  if (!product.name?.trim()) errors.push('El nombre es obligatorio')
  if (!product.price || product.price <= 0) errors.push('El precio debe ser mayor a 0')
  if (!product.physical_condition) errors.push('El estado físico es obligatorio')

  if (product.type === 'sneaker') {
    if (!product.model_id) errors.push('El modelo es obligatorio para zapatillas')
    if (!product.size) errors.push('La talla es obligatoria para zapatillas')
  }

  // Verificar que tiene imagen principal
  const primaryImg = await db
    .prepare('SELECT id FROM product_images WHERE product_id = ? AND is_primary = 1')
    .bind(product.id)
    .first()
  if (!primaryImg) errors.push('Se require al menos una imagen principal')

  return errors
}

async function validateActiveModel(db: D1Database, modelId: string) {
  return db.prepare(
    `SELECT m.id
     FROM models m
     JOIN brands b ON b.id = m.brand_id
     WHERE m.id = ? AND m.is_active = 1 AND b.is_active = 1`
  ).bind(modelId).first()
}
