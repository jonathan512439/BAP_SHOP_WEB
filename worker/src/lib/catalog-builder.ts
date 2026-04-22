import { nowISO } from '@bap-shop/shared'
import type { CatalogCard, CatalogFilters, CatalogManifest, CatalogProductDetail } from '@bap-shop/shared'
import { applyDiscount } from '@bap-shop/shared'

// ============================================================
// Catalog Builder — Generación síncrona de snapshots en R2
// Se llama al final de cualquier mutación que afecte el catálogo.
// Para catálogos < 500 productos tarda < 200ms.
// ============================================================

interface RawProductForSnapshot {
  id: string
  type: 'sneaker' | 'other'
  status: 'active' | 'sold'
  name: string
  model_id: string | null
  model_name: string | null
  model_slug: string | null
  brand_id: string | null
  brand_name: string | null
  brand_slug: string | null
  size: string | null
  description: string | null
  characteristics: string | null
  price: number
  physical_condition: string
  sort_order: number
  discount_pct: number | null
  promo_starts: string | null
  promo_ends: string | null
  promo_enabled: number | null
}

interface RawImage {
  product_id: string
  r2_key: string
  thumb_r2_key: string | null
  card_r2_key: string | null
  detail_r2_key: string | null
  full_r2_key: string | null
  is_primary: number
  sort_order: number
}

/**
 * Reconstruye todos los snapshots del catálogo público en R2.
 * Genera: manifest.json, catalog/index.json, catalog/filters.json, products/{id}.json
 * Incrementa catalog_version en settings.
 */
export async function rebuildCatalogSnapshots(
  db: D1Database,
  r2: R2Bucket,
  r2PublicDomain: string
): Promise<void> {
  const now = nowISO()

  // 1. Obtener todos los productos visibles en tienda con JOIN de modelo/marca y promo
  const productsResult = await db
    .prepare(
      `SELECT
        p.id, p.type, p.status, p.name, p.model_id, p.size,
        p.description, p.characteristics, p.price,
        p.physical_condition, p.sort_order,
        m.name        AS model_name,
        m.slug        AS model_slug,
        b.id          AS brand_id,
        b.name        AS brand_name,
        b.slug        AS brand_slug,
        pp.discount_pct,
        pp.starts_at  AS promo_starts,
        pp.ends_at    AS promo_ends,
        pp.enabled    AS promo_enabled
       FROM products p
       LEFT JOIN models m  ON m.id = p.model_id
       LEFT JOIN brands b  ON b.id = m.brand_id
       LEFT JOIN product_promotions pp ON pp.product_id = p.id
       WHERE p.status IN ('active', 'sold')
       ORDER BY CASE WHEN p.status = 'sold' THEN 1 ELSE 0 END ASC,
                p.sort_order ASC,
                p.created_at DESC,
                p.id ASC`
    )
    .all<RawProductForSnapshot>()

  const products = productsResult.results

  // 2. Obtener todas las imágenes de los productos visibles
  const productIds = products.map((p) => p.id)
  let allImages: RawImage[] = []

  if (productIds.length > 0) {
    const placeholders = productIds.map(() => '?').join(', ')
    const imagesResult = await db
      .prepare(
        `SELECT product_id, r2_key, thumb_r2_key, card_r2_key, detail_r2_key, full_r2_key, is_primary, sort_order
         FROM product_images
         WHERE product_id IN (${placeholders})
         ORDER BY sort_order ASC`
      )
      .bind(...productIds)
      .all<RawImage>()
    allImages = imagesResult.results
  }

  // Mapa de imágenes por producto
  const imageMap = new Map<string, RawImage[]>()
  for (const img of allImages) {
    const list = imageMap.get(img.product_id) ?? []
    list.push(img)
    imageMap.set(img.product_id, list)
  }

  const getImageUrl = (r2Key: string) => `https://${r2PublicDomain}/${r2Key}`
  const getImageVariantUrls = (img: RawImage) => ({
    thumb_url: getImageUrl(img.thumb_r2_key ?? img.r2_key),
    card_url: getImageUrl(img.card_r2_key ?? img.r2_key),
    detail_url: getImageUrl(img.detail_r2_key ?? img.r2_key),
    full_url: getImageUrl(img.full_r2_key ?? img.r2_key),
  })

  // 3. Determinar promo activa por producto
  const isPromoActive = (p: RawProductForSnapshot): boolean => {
    if (!p.discount_pct || !p.promo_enabled || !p.promo_starts || !p.promo_ends) return false
    return p.promo_starts <= now && p.promo_ends > now
  }

  // 4. Construir catalog/index.json (cards para el listado)
  const catalogCards: CatalogCard[] = products.map((p) => {
    const imgs = imageMap.get(p.id) ?? []
    const primaryImg = imgs.find((i) => i.is_primary === 1) ?? imgs[0]
    const promoActive = isPromoActive(p)
    const promoPrice = promoActive && p.discount_pct ? applyDiscount(p.price, p.discount_pct) : null

    return {
      id: p.id,
      type: p.type,
      status: p.status,
      name: p.name,
      brand: p.brand_id ? { id: p.brand_id, name: p.brand_name!, slug: p.brand_slug! } : undefined,
      model: p.model_id ? { id: p.model_id, name: p.model_name! } : undefined,
      size: p.size,
      price: p.price,
      promo_price: promoPrice,
      discount_pct: promoActive ? p.discount_pct : null,
      physical_condition: p.physical_condition as CatalogCard['physical_condition'],
      primary_image_url: primaryImg ? getImageUrl(primaryImg.r2_key) : null,
      primary_image_variants: primaryImg ? getImageVariantUrls(primaryImg) : null,
      sort_order: p.sort_order,
    }
  })

  // 5. Construir catalog/filters.json
  const brandsMap = new Map<string, { id: string; name: string; slug: string }>()
  const modelsMap = new Map<string, { id: string; brand_id: string; name: string; slug: string }>()
  const sizesSet = new Set<string>()
  const conditionsSet = new Set<string>()

  for (const p of products) {
    if (p.brand_id) {
      brandsMap.set(p.brand_id, { id: p.brand_id, name: p.brand_name!, slug: p.brand_slug! })
    }
    if (p.model_id && p.brand_id) {
      modelsMap.set(p.model_id, {
        id: p.model_id,
        brand_id: p.brand_id,
        name: p.model_name!,
        slug: p.model_slug ?? p.model_id,
      })
    }
    if (p.size) sizesSet.add(p.size)
    conditionsSet.add(p.physical_condition)
  }

  const filters: CatalogFilters = {
    brands: Array.from(brandsMap.values()),
    models: Array.from(modelsMap.values()),
    sizes: Array.from(sizesSet).sort((a, b) => parseFloat(a) - parseFloat(b)),
    conditions: Array.from(conditionsSet) as CatalogFilters['conditions'],
  }

  // 6. Construir products/{id}.json (detalle completo)
  const detailUploads: Promise<void>[] = products.map(async (p) => {
    const imgs = imageMap.get(p.id) ?? []
    const promoActive = isPromoActive(p)
    const promoPrice = promoActive && p.discount_pct ? applyDiscount(p.price, p.discount_pct) : null

    const detail: CatalogProductDetail = {
      id: p.id,
      type: p.type,
      status: p.status,
      name: p.name,
      brand: p.brand_id ? { id: p.brand_id, name: p.brand_name!, slug: p.brand_slug! } : undefined,
      model: p.model_id ? { id: p.model_id, name: p.model_name! } : undefined,
      size: p.size,
      description: p.description,
      characteristics: p.characteristics,
      price: p.price,
      promo_price: promoPrice,
      discount_pct: promoActive ? p.discount_pct : null,
      physical_condition: p.physical_condition as CatalogProductDetail['physical_condition'],
      images: imgs.map((img) => ({
        r2_key: img.r2_key,
        url: getImageUrl(img.r2_key),
        variants: getImageVariantUrls(img),
        is_primary: img.is_primary === 1,
        sort_order: img.sort_order,
      })),
    }

    await r2.put(
      `public/products/${p.id}.json`,
      JSON.stringify(detail),
      { httpMetadata: { contentType: 'application/json' } }
    )
  })

  // 7. Incrementar catalog_version
  const versionRow = await db
    .prepare(`SELECT value FROM settings WHERE key = 'catalog_version'`)
    .first<{ value: string }>()
  const newVersion = parseInt(versionRow?.value ?? '1', 10) + 1

  // 8. Subir todo a R2 en paralelo
  const manifest: CatalogManifest = {
    catalog_version: newVersion,
    generated_at: now,
    total_products: products.length,
  }

  await Promise.all([
    ...detailUploads,
    r2.put('public/manifest.json', JSON.stringify(manifest), {
      httpMetadata: { contentType: 'application/json' },
    }),
    r2.put('public/catalog/index.json', JSON.stringify(catalogCards), {
      httpMetadata: { contentType: 'application/json' },
    }),
    r2.put('public/catalog/filters.json', JSON.stringify(filters), {
      httpMetadata: { contentType: 'application/json' },
    }),
    db.prepare(`UPDATE settings SET value = ? WHERE key = 'catalog_version'`)
      .bind(String(newVersion))
      .run(),
  ])
}

