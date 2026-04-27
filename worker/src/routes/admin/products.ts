import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { HonoEnv } from '../../types/env'
import { RATE_LIMITS, authMiddleware, csrfMiddleware, validateUuidParams, rateLimitMiddleware } from '../../middleware'
import { logAction } from '../../lib/audit'
import { markCatalogDirty } from '../../lib/catalog-dirty'
import { rebuildCatalogSnapshots } from '../../lib/catalog-builder'
import { matchesContentType } from '../../lib/file-signatures'
import { logError, serializeError } from '../../lib/logger'
import { upsertSetting } from '../../lib/settings'
import { generateId, nowISO, PRODUCT_IMAGE_VARIANT_LIMITS_BYTES, VALID_STATUS_TRANSITIONS } from '@bap-shop/shared'
import type { ProductStatus } from '@bap-shop/shared'

export const adminProductsRouter = new Hono<HonoEnv>()
adminProductsRouter.use('*', authMiddleware())
adminProductsRouter.use('/:id/*', validateUuidParams('id'))
adminProductsRouter.use('/:id', validateUuidParams('id'))

type ProductImageVariantName = 'thumb' | 'card' | 'detail' | 'full'
const PRODUCT_IMAGE_VARIANT_NAMES: ProductImageVariantName[] = ['thumb', 'card', 'detail', 'full']

// ============================================================
// Schemas de validación
// ============================================================
const sneakerSchema = z.object({
  type: z.literal('sneaker'),
  name: z.string().min(1).max(200).trim(),
  model_id: z.string().min(1).max(120).trim(),
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
  model_id: z.string().min(1).max(120).trim().optional(),
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
              (SELECT COALESCE(card_r2_key, r2_key) FROM product_images WHERE product_id = p.id AND is_primary = 1) AS primary_image,
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
adminProductsRouter.post('/', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), zValidator('json', productSchema), async (c) => {
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
adminProductsRouter.put('/:id', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), zValidator('json', productUpdateSchema), async (c) => {
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
    await markCatalogDirty(c.env.DB)
    queueCatalogRefreshAfterProductMutation(c, {
      event: 'product.update',
      productId: id,
    })
  }

  return c.json({ success: true })
})

// ============================================================
// PATCH /admin/products/:id/status
// ============================================================
adminProductsRouter.patch('/:id/status', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), zValidator('json', z.object({ status: z.enum(['active', 'hidden', 'reserved', 'sold']) })), async (c) => {
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
     reserved_order_id = CASE WHEN ? IN ('active', 'sold', 'hidden', 'reserved') THEN NULL ELSE reserved_order_id END,
     reserved_until = CASE WHEN ? IN ('active', 'sold', 'hidden', 'reserved') THEN NULL ELSE reserved_until END
     WHERE id = ?`
  ).bind(newStatus, now, newStatus, newStatus, id).run()

  await logAction(c.env.DB, c.get('adminId'), 'product.status', 'product', id, { status: product.status }, { status: newStatus })
  await markCatalogDirty(c.env.DB)
  queueCatalogRefreshAfterProductMutation(c, {
    event: 'product.status',
    productId: id,
  })

  return c.json({ success: true, data: { id, status: newStatus } })
})

// ============================================================
// DELETE /admin/products/:id
// ============================================================
adminProductsRouter.delete('/:id', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), async (c) => {
  const { id } = c.req.param()

  const product = await c.env.DB.prepare(
    'SELECT id, name, status FROM products WHERE id = ?'
  ).bind(id).first<{ id: string; name: string; status: string }>()

  if (!product) {
    return c.json({ success: false, error: 'Producto no encontrado' }, 404)
  }

  const linkedOpenOrder = await c.env.DB.prepare(
    `SELECT o.id
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = ? AND o.status = 'pending'
     LIMIT 1`
  ).bind(id).first<{ id: string }>()

  if (linkedOpenOrder) {
    return c.json(
      {
        success: false,
        error: 'No puedes eliminar un producto con un pedido pendiente. Si solo quieres quitarlo del catalogo, cambialo a oculto o cancela el pedido primero.',
      },
      409
    )
  }

  const images = await c.env.DB.prepare(
    'SELECT r2_key, thumb_r2_key, card_r2_key, detail_r2_key, full_r2_key FROM product_images WHERE product_id = ?'
  ).bind(id).all<{
    r2_key: string
    thumb_r2_key: string | null
    card_r2_key: string | null
    detail_r2_key: string | null
    full_r2_key: string | null
  }>()

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM product_images WHERE product_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM product_promotions WHERE product_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id),
  ])

  const keysToDelete = new Set<string>()
  for (const image of images.results) {
    keysToDelete.add(image.r2_key)
    if (image.thumb_r2_key) keysToDelete.add(image.thumb_r2_key)
    if (image.card_r2_key) keysToDelete.add(image.card_r2_key)
    if (image.detail_r2_key) keysToDelete.add(image.detail_r2_key)
    if (image.full_r2_key) keysToDelete.add(image.full_r2_key)
  }
  const r2Deletes = Array.from(keysToDelete).map((key) => c.env.R2.delete(key))
  r2Deletes.push(c.env.R2.delete(`public/products/${id}.json`))
  r2Deletes.push(c.env.R2.delete(`products/${id}.json`))
  await Promise.all(r2Deletes)

  await logAction(c.env.DB, c.get('adminId'), 'product.delete', 'product', id, product, null)
  await markCatalogDirty(c.env.DB)
  queueCatalogRefreshAfterProductMutation(c, {
    event: 'product.delete',
    productId: id,
  })

  return c.json({ success: true, data: { id } })
})

// ============================================================
// PATCH /admin/products/:id/sort
// ============================================================
adminProductsRouter.patch('/:id/sort', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), zValidator('json', z.object({ sort_order: z.number().int().min(0) })), async (c) => {
  const { id } = c.req.param()
  const { sort_order } = c.req.valid('json')

  const product = await c.env.DB.prepare('SELECT id, status, sort_order FROM products WHERE id = ?')
    .bind(id)
    .first<{ id: string; status: string; sort_order: number }>()

  if (!product) {
    return c.json({ success: false, error: 'Producto no encontrado' }, 404)
  }

  await c.env.DB.prepare('UPDATE products SET sort_order = ?, updated_at = ? WHERE id = ?')
    .bind(sort_order, nowISO(), id).run()
  await logAction(c.env.DB, c.get('adminId'), 'product.sort', 'product', id, { sort_order: product.sort_order }, { sort_order })
  await markCatalogDirty(c.env.DB)
  queueCatalogRefreshAfterProductMutation(c, {
    event: 'product.sort',
    productId: id,
  })
  return c.json({ success: true })
})

// ============================================================
// Gestión de imágenes
// ============================================================

// POST /admin/products/:id/images
adminProductsRouter.post('/:id/images', rateLimitMiddleware(RATE_LIMITS.imageUpload), csrfMiddleware(), async (c) => {
  const { id } = c.req.param()

  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first()
  if (!product) return c.json({ success: false, error: 'Producto no encontrado' }, 404)

  const contentType = c.req.header('Content-Type') ?? ''
  const imgId = generateId()

  if (contentType.includes('multipart/form-data')) {
    const parsedBody = await c.req.parseBody()
    const files: Record<ProductImageVariantName, { bytes: ArrayBuffer }> = {} as Record<ProductImageVariantName, { bytes: ArrayBuffer }>

    for (const variant of PRODUCT_IMAGE_VARIANT_NAMES) {
      const file = parsedBody[variant]
      if (!(file instanceof File)) {
        return c.json({ success: false, error: `Falta la variante de imagen: ${variant}` }, 422)
      }

      if (file.type !== 'image/webp') {
        return c.json({ success: false, error: `La variante ${variant} debe estar en formato WebP.` }, 422)
      }

      const maxBytes = PRODUCT_IMAGE_VARIANT_LIMITS_BYTES[variant]
      if (file.size > maxBytes) {
        return c.json({ success: false, error: `La variante ${variant} supera el limite permitido.` }, 422)
      }

      const bytes = await file.arrayBuffer()
      if (!matchesContentType(bytes, 'image/webp')) {
        return c.json({ success: false, error: `La variante ${variant} no contiene un WebP valido.` }, 422)
      }

      files[variant] = { bytes }
    }

    const baseKey = `public/products/${id}/${imgId}`
    const variantKeys: Record<ProductImageVariantName, string> = {
      thumb: `${baseKey}/thumb.webp`,
      card: `${baseKey}/card.webp`,
      detail: `${baseKey}/detail.webp`,
      full: `${baseKey}/full.webp`,
    }

    await Promise.all(
      PRODUCT_IMAGE_VARIANT_NAMES.map(async (variant) => {
        await c.env.R2.put(variantKeys[variant], files[variant].bytes, {
          httpMetadata: { contentType: 'image/webp' },
        })
      })
    )

    const existing = await c.env.DB.prepare(
      'SELECT COUNT(*) AS cnt FROM product_images WHERE product_id = ?'
    ).bind(id).first<{ cnt: number }>()
    const isPrimary = !existing || existing.cnt === 0 ? 1 : 0
    const now = nowISO()

    await c.env.DB.prepare(
      `INSERT INTO product_images
        (id, product_id, r2_key, thumb_r2_key, card_r2_key, detail_r2_key, full_r2_key, is_primary, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      imgId,
      id,
      variantKeys.full,
      variantKeys.thumb,
      variantKeys.card,
      variantKeys.detail,
      variantKeys.full,
      isPrimary,
      existing?.cnt ?? 0,
      now
    ).run()

    await logAction(c.env.DB, c.get('adminId'), 'image.upload', 'product_image', imgId, null, {
      product_id: id,
      r2_key: variantKeys.full,
      variants: variantKeys,
    })

    const productAfter = await c.env.DB.prepare('SELECT status FROM products WHERE id = ?').bind(id).first<{ status: string }>()
    if (productAfter?.status === 'active') {
      await markCatalogDirty(c.env.DB)
      queueCatalogRefreshAfterProductMutation(c, {
        event: 'image.upload',
        productId: id,
      })
    }

    return c.json({
      success: true,
      data: {
        id: imgId,
        r2_key: variantKeys.full,
        thumb_r2_key: variantKeys.thumb,
        card_r2_key: variantKeys.card,
        detail_r2_key: variantKeys.detail,
        full_r2_key: variantKeys.full,
        is_primary: isPrimary,
      },
    }, 201)
  }

  return c.json(
    {
      success: false,
      error: 'La subida directa de imagenes ya no esta permitida. Sube las variantes optimizadas WebP desde el panel.',
    },
    422
  )
})

// DELETE /admin/products/:id/images/:imgId
adminProductsRouter.delete('/:id/images/:imgId', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), async (c) => {
  const { id, imgId } = c.req.param()

  const img = await c.env.DB.prepare('SELECT * FROM product_images WHERE id = ? AND product_id = ?').bind(imgId, id).first<{
    id: string
    r2_key: string
    thumb_r2_key: string | null
    card_r2_key: string | null
    detail_r2_key: string | null
    full_r2_key: string | null
    is_primary: number
  }>()
  if (!img) return c.json({ success: false, error: 'Imagen no encontrada' }, 404)

  const keysToDelete = new Set([img.r2_key])
  if (img.thumb_r2_key) keysToDelete.add(img.thumb_r2_key)
  if (img.card_r2_key) keysToDelete.add(img.card_r2_key)
  if (img.detail_r2_key) keysToDelete.add(img.detail_r2_key)
  if (img.full_r2_key) keysToDelete.add(img.full_r2_key)
  await Promise.all(Array.from(keysToDelete).map((key) => c.env.R2.delete(key)))
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
    await markCatalogDirty(c.env.DB)
    queueCatalogRefreshAfterProductMutation(c, {
      event: 'image.delete',
      productId: id,
    })
  }

  return c.json({ success: true })
})

// PATCH /admin/products/:id/images/:imgId/primary
adminProductsRouter.patch('/:id/images/:imgId/primary', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), async (c) => {
  const { id, imgId } = c.req.param()

  const img = await c.env.DB.prepare('SELECT id, is_primary FROM product_images WHERE id = ? AND product_id = ?')
    .bind(imgId, id)
    .first<{ id: string; is_primary: number }>()
  if (!img) return c.json({ success: false, error: 'Imagen no encontrada' }, 404)

  const currentPrimary = await c.env.DB.prepare('SELECT id FROM product_images WHERE product_id = ? AND is_primary = 1')
    .bind(id)
    .first<{ id: string }>()

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE product_images SET is_primary = 0 WHERE product_id = ?').bind(id),
    c.env.DB.prepare('UPDATE product_images SET is_primary = 1 WHERE id = ?').bind(imgId),
  ])

  await logAction(c.env.DB, c.get('adminId'), 'image.primary', 'product_image', imgId, {
    product_id: id,
    previous_primary_id: currentPrimary?.id ?? null,
  }, {
    product_id: id,
    primary_id: imgId,
  })

  const productAfter = await c.env.DB.prepare('SELECT status FROM products WHERE id = ?').bind(id).first<{ status: string }>()
  if (productAfter?.status === 'active') {
    await markCatalogDirty(c.env.DB)
    queueCatalogRefreshAfterProductMutation(c, {
      event: 'image.primary',
      productId: id,
    })
  }

  return c.json({ success: true })
})

// PATCH /admin/products/:id/images/sort
adminProductsRouter.patch('/:id/images/sort', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), zValidator('json', z.array(z.object({ id: z.string(), sort_order: z.number().int().min(0) }))), async (c) => {
  const { id } = c.req.param()
  const items = c.req.valid('json')

  if (items.length === 0) {
    return c.json({ success: false, error: 'Debes enviar al menos una imagen para ordenar' }, 422)
  }

  const existingImages = await c.env.DB.prepare(
    'SELECT id, sort_order FROM product_images WHERE product_id = ?'
  ).bind(id).all<{ id: string; sort_order: number }>()
  const existingIds = new Set(existingImages.results.map((image) => image.id))
  const requestedIds = new Set(items.map((item) => item.id))

  if (requestedIds.size !== items.length) {
    return c.json({ success: false, error: 'La lista de imagenes contiene duplicados' }, 422)
  }

  if (items.some((item) => !existingIds.has(item.id))) {
    return c.json({ success: false, error: 'Una o mas imagenes no pertenecen al producto' }, 422)
  }

  const statements = items.map((item) =>
    c.env.DB.prepare('UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ?')
      .bind(item.sort_order, item.id, id)
  )
  await c.env.DB.batch(statements)
  await logAction(c.env.DB, c.get('adminId'), 'image.sort', 'product_image', id, {
    product_id: id,
    images: existingImages.results,
  }, {
    product_id: id,
    images: items,
  })

  const productAfter = await c.env.DB.prepare('SELECT status FROM products WHERE id = ?').bind(id).first<{ status: string }>()
  if (productAfter?.status === 'active') {
    await markCatalogDirty(c.env.DB)
    queueCatalogRefreshAfterProductMutation(c, {
      event: 'image.sort',
      productId: id,
    })
  }

  return c.json({ success: true })
})

async function refreshCatalogAfterProductMutation(
  c: Context<HonoEnv>,
  context: { event: string; productId: string }
): Promise<void> {
  try {
    await rebuildCatalogSnapshots(c.env.DB, c.env.R2, c.env.R2_PUBLIC_DOMAIN)
    await upsertSetting(c.env.DB, 'catalog_dirty', '0')
  } catch (error) {
    try {
      await markCatalogDirty(c.env.DB)
    } catch {
      // noop: mantener resiliencia del endpoint; error principal queda logueado abajo.
    }
    logError('catalog_rebuild_after_product_change_failed', {
      requestId: c.get('requestId'),
      event: context.event,
      productId: context.productId,
      error: serializeError(error, c.env.ENVIRONMENT !== 'production'),
    })
  }
}

function queueCatalogRefreshAfterProductMutation(
  c: Context<HonoEnv>,
  context: { event: string; productId: string }
) {
  const task = refreshCatalogAfterProductMutation(c, context)
  if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
    c.executionCtx.waitUntil(task)
    return
  }
  void task
}

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
