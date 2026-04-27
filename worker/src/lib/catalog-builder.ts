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
  status: 'active' | 'reserved' | 'sold'
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

const getImageUrl = (r2PublicDomain: string, r2Key: string) => `https://${r2PublicDomain}/${r2Key}`

const getImageVariantUrls = (r2PublicDomain: string, img: RawImage) => ({
  thumb_url: getImageUrl(r2PublicDomain, img.thumb_r2_key ?? img.r2_key),
  card_url: getImageUrl(r2PublicDomain, img.card_r2_key ?? img.r2_key),
  detail_url: getImageUrl(r2PublicDomain, img.detail_r2_key ?? img.r2_key),
  full_url: getImageUrl(r2PublicDomain, img.full_r2_key ?? img.r2_key),
})

const isPromoActive = (product: RawProductForSnapshot, now: string): boolean => {
  if (!product.discount_pct || !product.promo_enabled || !product.promo_starts || !product.promo_ends) return false

  const startsAt = Date.parse(product.promo_starts)
  const endsAt = Date.parse(product.promo_ends)
  const nowAt = Date.parse(now)

  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || !Number.isFinite(nowAt)) {
    return false
  }

  return startsAt <= nowAt && endsAt > nowAt
}

const buildCatalogCard = (
  product: RawProductForSnapshot,
  images: RawImage[],
  r2PublicDomain: string,
  now: string
): CatalogCard => {
  const primaryImg = images.find((i) => i.is_primary === 1) ?? images[0]
  const promoActive = isPromoActive(product, now)
  const promoPrice = promoActive && product.discount_pct ? applyDiscount(product.price, product.discount_pct) : null

  return {
    id: product.id,
    type: product.type,
    status: product.status,
    name: product.name,
    brand: product.brand_id ? { id: product.brand_id, name: product.brand_name!, slug: product.brand_slug! } : undefined,
    model: product.model_id ? { id: product.model_id, name: product.model_name! } : undefined,
    size: product.size,
    price: product.price,
    promo_price: promoPrice,
    discount_pct: promoActive ? product.discount_pct : null,
    promo_ends_at: promoActive ? product.promo_ends : null,
    physical_condition: product.physical_condition as CatalogCard['physical_condition'],
    primary_image_url: primaryImg ? getImageUrl(r2PublicDomain, primaryImg.r2_key) : null,
    primary_image_variants: primaryImg ? getImageVariantUrls(r2PublicDomain, primaryImg) : null,
    sort_order: product.sort_order,
  }
}

const buildCatalogProductDetail = (
  product: RawProductForSnapshot,
  images: RawImage[],
  r2PublicDomain: string,
  now: string
): CatalogProductDetail => {
  const promoActive = isPromoActive(product, now)
  const promoPrice = promoActive && product.discount_pct ? applyDiscount(product.price, product.discount_pct) : null

  return {
    id: product.id,
    type: product.type,
    status: product.status,
    name: product.name,
    brand: product.brand_id ? { id: product.brand_id, name: product.brand_name!, slug: product.brand_slug! } : undefined,
    model: product.model_id ? { id: product.model_id, name: product.model_name! } : undefined,
    size: product.size,
    description: product.description,
    characteristics: product.characteristics,
    price: product.price,
    promo_price: promoPrice,
    discount_pct: promoActive ? product.discount_pct : null,
    promo_ends_at: promoActive ? product.promo_ends : null,
    physical_condition: product.physical_condition as CatalogProductDetail['physical_condition'],
    images: images.map((img) => ({
      r2_key: img.r2_key,
      url: getImageUrl(r2PublicDomain, img.r2_key),
      variants: getImageVariantUrls(r2PublicDomain, img),
      is_primary: img.is_primary === 1,
      sort_order: img.sort_order,
    })),
  }
}

async function getNextCatalogVersion(db: D1Database): Promise<number> {
  const versionRow = await db
    .prepare(`SELECT value FROM settings WHERE key = 'catalog_version'`)
    .first<{ value: string }>()
  return parseInt(versionRow?.value ?? '1', 10) + 1
}

async function updateCatalogVersion(db: D1Database, version: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (key, value) VALUES ('catalog_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .bind(String(version))
    .run()
}

async function getVisibleProductForSnapshot(
  db: D1Database,
  productId: string
): Promise<RawProductForSnapshot | null> {
  return await db
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
       WHERE p.id = ?
         AND p.status IN ('active', 'reserved', 'sold')`
    )
    .bind(productId)
    .first<RawProductForSnapshot>()
}

async function getProductImagesForSnapshot(db: D1Database, productId: string): Promise<RawImage[]> {
  const imagesResult = await db
    .prepare(
      `SELECT product_id, r2_key, thumb_r2_key, card_r2_key, detail_r2_key, full_r2_key, is_primary, sort_order
       FROM product_images
       WHERE product_id = ?
       ORDER BY sort_order ASC`
    )
    .bind(productId)
    .all<RawImage>()
  return imagesResult.results
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
       WHERE p.status IN ('active', 'reserved', 'sold')
       ORDER BY CASE
                WHEN p.status = 'active' THEN 0
                WHEN p.status = 'reserved' THEN 1
                WHEN p.status = 'sold' THEN 2
                ELSE 3
               END ASC,
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

  // 4. Construir catalog/index.json (cards para el listado)
  const catalogCards: CatalogCard[] = products.map((p) => {
    const imgs = imageMap.get(p.id) ?? []
    return buildCatalogCard(p, imgs, r2PublicDomain, now)
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
    const detail = buildCatalogProductDetail(p, imgs, r2PublicDomain, now)

    await r2.put(
      `public/products/${p.id}.json`,
      JSON.stringify(detail),
      { httpMetadata: { contentType: 'application/json' } }
    )
  })

  // 7. Incrementar catalog_version
  const newVersion = await getNextCatalogVersion(db)

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
    updateCatalogVersion(db, newVersion),
  ])
}

/**
 * Actualiza solo los snapshots afectados por un cambio de promocion.
 * Si falta el snapshot base, usa rebuild completo como fallback seguro.
 */
export async function refreshProductPromotionSnapshots(
  db: D1Database,
  r2: R2Bucket,
  r2PublicDomain: string,
  productId: string
): Promise<void> {
  const [indexObject, manifestObject] = await Promise.all([
    r2.get('public/catalog/index.json'),
    r2.get('public/manifest.json'),
  ])

  if (!indexObject || !manifestObject) {
    await rebuildCatalogSnapshots(db, r2, r2PublicDomain)
    return
  }

  const now = nowISO()
  const [catalogCards, manifest, product, images] = await Promise.all([
    indexObject.json<CatalogCard[]>(),
    manifestObject.json<CatalogManifest>(),
    getVisibleProductForSnapshot(db, productId),
    getProductImagesForSnapshot(db, productId),
  ])

  const existingCardIndex = catalogCards.findIndex((card) => card.id === productId)
  const nextCards = catalogCards.slice()
  let detailUpload: Promise<R2Object | null>

  if (product) {
    const nextCard = buildCatalogCard(product, images, r2PublicDomain, now)
    const detail = buildCatalogProductDetail(product, images, r2PublicDomain, now)
    if (existingCardIndex >= 0) nextCards[existingCardIndex] = nextCard
    else nextCards.push(nextCard)
    detailUpload = r2.put(`public/products/${productId}.json`, JSON.stringify(detail), {
      httpMetadata: { contentType: 'application/json' },
    })
  } else {
    if (existingCardIndex >= 0) nextCards.splice(existingCardIndex, 1)
    detailUpload = r2.delete(`public/products/${productId}.json`).then(() => null)
  }

  const newVersion = await getNextCatalogVersion(db)
  const nextManifest: CatalogManifest = {
    ...manifest,
    catalog_version: newVersion,
    generated_at: now,
    total_products: nextCards.length,
  }

  await Promise.all([
    detailUpload,
    r2.put('public/manifest.json', JSON.stringify(nextManifest), {
      httpMetadata: { contentType: 'application/json' },
    }),
    r2.put('public/catalog/index.json', JSON.stringify(nextCards), {
      httpMetadata: { contentType: 'application/json' },
    }),
    updateCatalogVersion(db, newVersion),
  ])
}

