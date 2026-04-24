import { mkdir, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = fileURLToPath(new URL('../..', import.meta.url))
const WORKER_DIR = fileURLToPath(new URL('..', import.meta.url))
const TMP_DIR = join(ROOT_DIR, '.tmp', 'ops-repair')
const WRANGLER_BIN = join(WORKER_DIR, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const WRANGLER_TIMEOUT_MS = 120_000

const options = parseArgs(process.argv.slice(2))
const envName = options.env || 'production'
const database = options.database || (envName === 'staging' ? 'bap-shop-db-staging' : 'bap-shop-db')
const bucket = options.bucket || (envName === 'staging' ? 'bap-shop-images-staging' : 'bap-shop-images')
const assetOrigin = stripTrailingSlash(options.assetOrigin || (envName === 'staging' ? 'https://api-staging.bab-shop.com' : 'https://api.bab-shop.com'))
const dryRun = Boolean(options.dryRun)
const expireReservations = Boolean(options.expireReservations)
const releaseInvalidReservations = Boolean(options.releaseInvalidReservations)
const rebuildCatalog = Boolean(options.rebuildCatalog)
const markCatalogDirty = Boolean(options.markCatalogDirty)

try {
  await main()
} catch (error) {
  console.error('\nReparacion abortada.')
  console.error(error?.stack || error?.message || error)
  process.exit(1)
}

async function main() {
  if (!expireReservations && !releaseInvalidReservations && !rebuildCatalog && !markCatalogDirty) {
    printUsage()
    process.exit(1)
  }

  console.log('Reparadores operativos BAP Shop')
  console.log(`- env: ${envName}`)
  console.log(`- database: ${database}`)
  console.log(`- bucket: ${bucket}`)
  console.log(`- assetOrigin: ${assetOrigin}`)
  console.log(`- dryRun: ${dryRun ? 'si' : 'no'}`)

  await mkdir(TMP_DIR, { recursive: true })

  if (expireReservations) await expirePendingReservations()
  if (releaseInvalidReservations) await releaseBrokenReservations()
  if (markCatalogDirty) await setCatalogDirty()
  if (rebuildCatalog) await rebuildCatalogSnapshots()

  await rm(TMP_DIR, { recursive: true, force: true })
  console.log('\nReparacion finalizada.')
}

async function expirePendingReservations() {
  console.log('\nExpirar reservas vencidas')
  const now = new Date().toISOString()
  const rows = await d1Query(`
    SELECT id
    FROM orders
    WHERE status = 'pending' AND expires_at <= '${sqlEscape(now)}'
    ORDER BY expires_at ASC
  `)
  const orderIds = rows.map((row) => row.id)
  console.log(`- pedidos vencidos: ${orderIds.length}`)
  if (orderIds.length === 0 || dryRun) return

  const ids = orderIds.map(sqlQuote).join(', ')
  await d1Exec(`
    UPDATE products
    SET status = 'active',
        reserved_order_id = NULL,
        reserved_until = NULL,
        updated_at = '${sqlEscape(now)}'
    WHERE status = 'reserved' AND reserved_order_id IN (${ids})
  `)
  await d1Exec(`
    UPDATE orders
    SET status = 'expired',
        updated_at = '${sqlEscape(now)}'
    WHERE id IN (${ids}) AND status = 'pending'
  `)
  await upsertSetting('catalog_dirty', '1')
  console.log('- reservas vencidas liberadas y catalogo marcado como pendiente.')
}

async function releaseBrokenReservations() {
  console.log('\nLiberar reservas inconsistentes')
  const rows = await d1Query(`
    SELECT p.id, p.reserved_order_id
    FROM products p
    LEFT JOIN orders o ON o.id = p.reserved_order_id
    WHERE p.status = 'reserved'
      AND p.reserved_order_id IS NOT NULL
      AND (o.id IS NULL OR o.status <> 'pending')
    ORDER BY p.updated_at ASC
  `)
  console.log(`- productos reservados inconsistentemente: ${rows.length}`)
  if (rows.length === 0 || dryRun) return

  const ids = rows.map((row) => sqlQuote(row.id)).join(', ')
  const now = new Date().toISOString()
  await d1Exec(`
    UPDATE products
    SET status = 'active',
        reserved_order_id = NULL,
        reserved_until = NULL,
        updated_at = '${sqlEscape(now)}'
    WHERE id IN (${ids}) AND status = 'reserved'
  `)
  await upsertSetting('catalog_dirty', '1')
  console.log('- reservas inconsistentes liberadas y catalogo marcado como pendiente.')
}

async function setCatalogDirty() {
  console.log('\nMarcar catalogo como pendiente')
  if (dryRun) {
    console.log('- dry-run: no se modifico settings.catalog_dirty.')
    return
  }
  await upsertSetting('catalog_dirty', '1')
  console.log('- settings.catalog_dirty = 1')
}

async function rebuildCatalogSnapshots() {
  console.log('\nReconstruir snapshots publicos')
  const startedAt = Date.now()
  const now = new Date().toISOString()
  const products = await d1Query(`
    SELECT
      p.id, p.type, p.status, p.name, p.model_id, p.size,
      p.description, p.characteristics, p.price,
      p.physical_condition, p.sort_order,
      m.name AS model_name,
      m.slug AS model_slug,
      b.id AS brand_id,
      b.name AS brand_name,
      b.slug AS brand_slug,
      pp.discount_pct,
      pp.starts_at AS promo_starts,
      pp.ends_at AS promo_ends,
      pp.enabled AS promo_enabled
    FROM products p
    LEFT JOIN models m ON m.id = p.model_id
    LEFT JOIN brands b ON b.id = m.brand_id
    LEFT JOIN product_promotions pp ON pp.product_id = p.id
    WHERE p.status IN ('active', 'sold')
    ORDER BY CASE WHEN p.status = 'sold' THEN 1 ELSE 0 END ASC,
             p.sort_order ASC,
             p.created_at DESC,
             p.id ASC
  `)

  const productIds = products.map((product) => product.id)
  const images = productIds.length > 0
    ? await d1Query(`
        SELECT product_id, r2_key, thumb_r2_key, card_r2_key, detail_r2_key, full_r2_key, is_primary, sort_order
        FROM product_images
        WHERE product_id IN (${productIds.map(sqlQuote).join(', ')})
        ORDER BY sort_order ASC
      `)
    : []

  const imagesByProduct = groupBy(images, 'product_id')
  const catalogCards = products.map((product) => toCatalogCard(product, imagesByProduct.get(product.id) ?? [], now))
  const filters = buildFilters(products)
  const versionRows = await d1Query(`SELECT value FROM settings WHERE key = 'catalog_version'`)
  const nextVersion = Number.parseInt(versionRows[0]?.value || '1', 10) + 1
  const manifest = {
    catalog_version: nextVersion,
    generated_at: now,
    total_products: products.length,
  }

  console.log(`- productos visibles: ${products.length}`)
  console.log(`- catalog_version siguiente: ${nextVersion}`)

  if (dryRun) {
    console.log('- dry-run: no se escribieron snapshots ni settings.')
    return
  }

  await putJson('public/manifest.json', manifest)
  console.log('- snapshot escrito: public/manifest.json')
  await putJson('public/catalog/index.json', catalogCards)
  console.log('- snapshot escrito: public/catalog/index.json')
  await putJson('public/catalog/filters.json', filters)
  console.log('- snapshot escrito: public/catalog/filters.json')

  let productSnapshotCount = 0
  for (const product of products) {
    await putJson(
      `public/products/${product.id}.json`,
      toProductDetail(product, imagesByProduct.get(product.id) ?? [], now)
    )
    productSnapshotCount += 1
    if (productSnapshotCount % 10 === 0 || productSnapshotCount === products.length) {
      console.log(`- progreso snapshots producto: ${productSnapshotCount}/${products.length}`)
    }
  }

  await upsertSetting('catalog_version', String(nextVersion))
  await upsertSetting('catalog_dirty', '0')
  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`- snapshots reconstruidos y catalog_dirty limpiado. (${elapsedSeconds}s)`)
}

function toCatalogCard(product, images, now) {
  const primary = images.find((image) => Number(image.is_primary) === 1) || images[0]
  const promo = getActivePromo(product, now)
  return {
    id: product.id,
    type: product.type,
    status: product.status,
    name: product.name,
    brand: product.brand_id ? { id: product.brand_id, name: product.brand_name, slug: product.brand_slug } : undefined,
    model: product.model_id ? { id: product.model_id, name: product.model_name } : undefined,
    size: product.size,
    price: Number(product.price),
    promo_price: promo.price,
    discount_pct: promo.discount,
    physical_condition: product.physical_condition,
    primary_image_url: primary ? toAssetUrl(primary.r2_key) : null,
    primary_image_variants: primary ? toVariantUrls(primary) : null,
    sort_order: Number(product.sort_order ?? 0),
  }
}

function toProductDetail(product, images, now) {
  const promo = getActivePromo(product, now)
  return {
    id: product.id,
    type: product.type,
    status: product.status,
    name: product.name,
    brand: product.brand_id ? { id: product.brand_id, name: product.brand_name, slug: product.brand_slug } : undefined,
    model: product.model_id ? { id: product.model_id, name: product.model_name } : undefined,
    size: product.size,
    description: product.description,
    characteristics: product.characteristics,
    price: Number(product.price),
    promo_price: promo.price,
    discount_pct: promo.discount,
    physical_condition: product.physical_condition,
    images: images.map((image) => ({
      r2_key: image.r2_key,
      url: toAssetUrl(image.r2_key),
      variants: toVariantUrls(image),
      is_primary: Number(image.is_primary) === 1,
      sort_order: Number(image.sort_order ?? 0),
    })),
  }
}

function buildFilters(products) {
  const brands = new Map()
  const models = new Map()
  const sizes = new Set()
  const conditions = new Set()

  for (const product of products) {
    if (product.brand_id) {
      brands.set(product.brand_id, { id: product.brand_id, name: product.brand_name, slug: product.brand_slug })
    }
    if (product.model_id && product.brand_id) {
      models.set(product.model_id, {
        id: product.model_id,
        brand_id: product.brand_id,
        name: product.model_name,
        slug: product.model_slug || product.model_id,
      })
    }
    if (product.size) sizes.add(product.size)
    if (product.physical_condition) conditions.add(product.physical_condition)
  }

  return {
    brands: Array.from(brands.values()),
    models: Array.from(models.values()),
    sizes: Array.from(sizes).sort((a, b) => Number.parseFloat(a) - Number.parseFloat(b)),
    conditions: Array.from(conditions),
  }
}

function getActivePromo(product, now) {
  const discount = Number(product.discount_pct || 0)
  const enabled = Number(product.promo_enabled || 0) === 1
  const active = discount > 0 && enabled && product.promo_starts && product.promo_ends
    && product.promo_starts <= now && product.promo_ends > now

  if (!active) return { discount: null, price: null }
  return {
    discount,
    price: Math.floor(Number(product.price) * (1 - discount / 100)),
  }
}

function toVariantUrls(image) {
  return {
    thumb_url: toAssetUrl(image.thumb_r2_key || image.r2_key),
    card_url: toAssetUrl(image.card_r2_key || image.r2_key),
    detail_url: toAssetUrl(image.detail_r2_key || image.r2_key),
    full_url: toAssetUrl(image.full_r2_key || image.r2_key),
  }
}

function toAssetUrl(key) {
  return `${assetOrigin}/${key}`
}

async function putJson(key, payload) {
  const filePath = join(TMP_DIR, key.replace(/[\\/]/g, '__'))
  await writeFile(filePath, JSON.stringify(payload))
  r2Put(key, filePath, 'application/json')
}

async function upsertSetting(key, value) {
  await d1Exec(`
    INSERT INTO settings (key, value)
    VALUES ('${sqlEscape(key)}', '${sqlEscape(value)}')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)
}

async function d1Query(sql) {
  const payload = runWrangler(['d1', 'execute', database, '--env', envName, '--remote', '--json', '--command', sql])
  const parsed = parseWranglerJson(payload)
  const first = Array.isArray(parsed) ? parsed[0] : parsed
  return first?.results || first?.result?.[0]?.results || []
}

async function d1Exec(sql) {
  runWrangler(['d1', 'execute', database, '--env', envName, '--remote', '--command', sql])
}

function r2Put(key, filePath, contentType) {
  runWrangler(['r2', 'object', 'put', `${bucket}/${key}`, '--file', filePath, '--content-type', contentType, '--remote'])
}

function runWrangler(args) {
  const result = spawnSync(process.execPath, [WRANGLER_BIN, ...args], {
    cwd: WORKER_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    timeout: WRANGLER_TIMEOUT_MS,
  })

  if (result.error) {
    throw new Error(`No se pudo ejecutar wrangler (${args.join(' ')}): ${result.error.message}`)
  }

  if (result.status !== 0) {
    const timedOut = result.signal === 'SIGTERM'
    throw new Error([
      `wrangler ${args.join(' ')} fallo con codigo ${result.status}.`,
      timedOut ? `timeout: el comando supero ${WRANGLER_TIMEOUT_MS}ms.` : '',
      result.stderr ? `stderr:\n${result.stderr}` : '',
      result.stdout ? `stdout:\n${result.stdout}` : '',
    ].filter(Boolean).join('\n'))
  }

  return result.stdout.trim()
}

function parseWranglerJson(output) {
  try {
    return JSON.parse(output)
  } catch {
    const jsonStart = output.indexOf('[')
    const jsonObjectStart = output.indexOf('{')
    const startCandidates = [jsonStart, jsonObjectStart].filter((index) => index >= 0)
    const start = Math.min(...startCandidates)

    if (Number.isFinite(start)) {
      return JSON.parse(output.slice(start))
    }

    throw new Error(`Wrangler no devolvio JSON valido:\n${output}`)
  }
}

function groupBy(rows, key) {
  const map = new Map()
  for (const row of rows) {
    const group = row[key]
    const list = map.get(group) ?? []
    list.push(row)
    map.set(group, list)
  }
  return map
}

function parseArgs(args) {
  const parsed = {}
  const booleanAliases = new Map([
    ['dry-run', 'dryRun'],
    ['dryRun', 'dryRun'],
    ['expire-reservations', 'expireReservations'],
    ['expireReservations', 'expireReservations'],
    ['release-invalid-reservations', 'releaseInvalidReservations'],
    ['releaseInvalidReservations', 'releaseInvalidReservations'],
    ['rebuild-catalog', 'rebuildCatalog'],
    ['rebuildCatalog', 'rebuildCatalog'],
    ['mark-catalog-dirty', 'markCatalogDirty'],
    ['markCatalogDirty', 'markCatalogDirty'],
  ])
  const valueAliases = new Map([
    ['env', 'env'],
    ['database', 'database'],
    ['bucket', 'bucket'],
    ['asset-origin', 'assetOrigin'],
    ['assetOrigin', 'assetOrigin'],
  ])

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg.startsWith('--')) continue

    const [rawKey, inlineValue] = arg.slice(2).split('=', 2)
    const booleanKey = booleanAliases.get(rawKey)
    if (booleanKey) {
      parsed[booleanKey] = true
      continue
    }

    const valueKey = valueAliases.get(rawKey)
    if (!valueKey) {
      throw new Error(`Flag no soportado: --${rawKey}`)
    }

    if (inlineValue !== undefined && inlineValue !== '') {
      parsed[valueKey] = inlineValue
      continue
    }

    const next = args[index + 1]
    if (!next || next.startsWith('--')) {
      throw new Error(`Flag --${rawKey} requiere un valor.`)
    }
    parsed[valueKey] = next
    index += 1
  }
  return parsed
}

function printUsage() {
  console.log(`Uso:
pnpm --filter worker ops:repair -- --dry-run --env staging --rebuild-catalog
pnpm --filter worker ops:repair -- --env production --expire-reservations
pnpm --filter worker ops:repair -- --env production --release-invalid-reservations
pnpm --filter worker ops:repair -- --env production --mark-catalog-dirty`)
}

function sqlQuote(value) {
  return `'${sqlEscape(value)}'`
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''")
}

function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/, '')
}
