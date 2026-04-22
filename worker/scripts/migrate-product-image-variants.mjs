import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT_DIR = fileURLToPath(new URL('../..', import.meta.url))
const WORKER_DIR = fileURLToPath(new URL('..', import.meta.url))
const TMP_DIR = join(ROOT_DIR, '.tmp', 'image-variants')
const WRANGLER_BIN = join(WORKER_DIR, 'node_modules', 'wrangler', 'bin', 'wrangler.js')

const options = parseArgs(process.argv.slice(2))
const envName = options.env || 'production'
const database = options.database || 'bap-shop-db'
const bucket = options.bucket || 'bap-shop-images'
const assetOrigin = stripTrailingSlash(options.assetOrigin || 'https://api.bab-shop.com')
const dryRun = Boolean(options.dryRun)
const limit = parsePositiveInteger(options.limit)
const refreshProductId = options.refreshProductId || null
const maxRetries = parseIntegerOption(options.retries, 3, '--retries')
const retryDelayMs = parseIntegerOption(options.retryDelayMs, 1500, '--retryDelayMs')

const pendingImagesWhere = `
  WHERE thumb_r2_key IS NULL
     OR card_r2_key IS NULL
     OR detail_r2_key IS NULL
     OR full_r2_key IS NULL
`

const variants = {
  thumb: { max: 320, quality: 72, limit: 150 * 1024 },
  card: { max: 640, quality: 76, limit: 450 * 1024 },
  detail: { max: 1200, quality: 80, limit: 1100 * 1024 },
  full: { max: 1600, quality: 84, limit: 2200 * 1024 },
}

try {
  await main()
} catch (error) {
  console.error('\nMigracion abortada.')
  console.error(error?.stack || error?.message || error)
  process.exit(1)
}

async function main() {
  console.log('Migracion de variantes de imagenes')
  console.log(`- env: ${envName}`)
  console.log(`- database: ${database}`)
  console.log(`- bucket: ${bucket}`)
  console.log(`- assetOrigin: ${assetOrigin}`)
  console.log(`- dryRun: ${dryRun ? 'si' : 'no'}`)
  console.log(`- limit: ${limit || 'sin limite'}`)
  console.log(`- refreshProductId: ${refreshProductId || 'no'}`)
  console.log(`- retries: ${maxRetries}`)
  console.log(`- retryDelayMs: ${retryDelayMs}`)

  await mkdir(TMP_DIR, { recursive: true })

  if (refreshProductId) {
    await patchPublicSnapshots([refreshProductId])
    await rm(TMP_DIR, { recursive: true, force: true })
    return
  }

  const pendingCountRows = await d1Query(`
    SELECT COUNT(*) AS pending
    FROM product_images
    ${pendingImagesWhere}
  `)
  const totalPending = Number(pendingCountRows[0]?.pending || 0)
  console.log(`Imagenes pendientes totales: ${totalPending}`)

  if (totalPending === 0) {
    return
  }

  const rows = await d1Query(`
    SELECT id, product_id, r2_key, thumb_r2_key, card_r2_key, detail_r2_key, full_r2_key, is_primary, sort_order
    FROM product_images
    ${pendingImagesWhere}
    ORDER BY product_id ASC, sort_order ASC
    ${limit ? `LIMIT ${limit}` : ''}
  `)

  console.log(`Imagenes en este lote: ${rows.length}`)
  if (rows.length === 0) {
    return
  }

  const migrated = []
  const failed = []

  for (const row of rows) {
    try {
      console.log(`\nProcesando ${row.id} (${row.r2_key})`)
      const sourceBuffer = await downloadImage(row.r2_key)
      const baseKey = `public/products/${row.product_id}/${row.id}`
      const variantKeys = {
        thumb: `${baseKey}/thumb.webp`,
        card: `${baseKey}/card.webp`,
        detail: `${baseKey}/detail.webp`,
        full: `${baseKey}/full.webp`,
      }

      const generated = {}
      for (const [variant, config] of Object.entries(variants)) {
        generated[variant] = await sharp(sourceBuffer)
          .rotate()
          .resize({
            width: config.max,
            height: config.max,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: config.quality, effort: 4 })
          .toBuffer()

        if (generated[variant].byteLength > config.limit) {
          console.warn(
            `  Aviso: ${variant} pesa ${formatBytes(generated[variant].byteLength)}, supera objetivo ${formatBytes(config.limit)}.`
          )
        }
      }

      if (!dryRun) {
        for (const [variant, buffer] of Object.entries(generated)) {
          const filePath = join(TMP_DIR, `${row.id}-${variant}.webp`)
          await writeFile(filePath, buffer)
          r2Put(variantKeys[variant], filePath, 'image/webp')
        }

        await d1Exec(`
          UPDATE product_images
          SET r2_key = '${sqlEscape(variantKeys.full)}',
              thumb_r2_key = '${sqlEscape(variantKeys.thumb)}',
              card_r2_key = '${sqlEscape(variantKeys.card)}',
              detail_r2_key = '${sqlEscape(variantKeys.detail)}',
              full_r2_key = '${sqlEscape(variantKeys.full)}'
          WHERE id = '${sqlEscape(row.id)}'
        `)
      }

      const originalBytes = sourceBuffer.byteLength
      const optimizedBytes = Object.values(generated).reduce((total, buffer) => total + buffer.byteLength, 0)
      console.log(`  OK: ${formatBytes(originalBytes)} -> ${formatBytes(optimizedBytes)} en 4 variantes`)
      migrated.push({ ...row, ...variantKeys, r2_key: variantKeys.full })
    } catch (error) {
      console.error(`  Error migrando ${row.id}:`, error.message)
      failed.push({ row, error: error.message })
    }
  }

  if (!dryRun && migrated.length > 0) {
    const migratedProductIds = Array.from(new Set(migrated.map((row) => row.product_id)))
    await patchPublicSnapshots(migratedProductIds)
  }

  await rm(TMP_DIR, { recursive: true, force: true })
  console.log(`\nMigradas: ${migrated.length}`)
  console.log(`Fallidas: ${failed.length}`)

  if (failed.length > 0) {
    console.log('\nFallidas:')
    for (const item of failed) {
      console.log(`- ${item.row.id}: ${item.error}`)
    }
  }
}

async function patchPublicSnapshots(productIdsToPatch) {
  const productIds = Array.from(new Set(productIdsToPatch)).filter(Boolean)
  if (productIds.length === 0) {
    return
  }

  const productIdFilter = productIds.map((id) => `'${sqlEscape(id)}'`).join(', ')
  const rows = await d1Query(`
    SELECT id, product_id, r2_key, thumb_r2_key, card_r2_key, detail_r2_key, full_r2_key, is_primary, sort_order
    FROM product_images
    WHERE product_id IN (${productIdFilter})
    ORDER BY product_id ASC, sort_order ASC
  `)

  const byProduct = new Map()
  for (const row of rows) {
    const list = byProduct.get(row.product_id) || []
    list.push(row)
    byProduct.set(row.product_id, list)
  }

  const catalogUrl = `${assetOrigin}/public/catalog/index.json`
  const catalog = await fetchJson(catalogUrl)
  for (const product of catalog) {
    if (!productIds.includes(product.id)) continue

    const images = byProduct.get(product.id) || []
    const primary = images.find((image) => image.is_primary === 1) || images[0]
    if (!primary) continue

    product.primary_image_url = toAssetUrl(primary.r2_key)
    product.primary_image_variants = toVariantUrls(primary)
  }

  await putJson('public/catalog/index.json', catalog)

  for (const [productId, images] of byProduct) {
    const detailUrl = `${assetOrigin}/public/products/${productId}.json`
    const detail = await fetchJson(detailUrl).catch(() => null)
    if (!detail || !Array.isArray(detail.images)) continue

    detail.images = detail.images.map((image) => {
      const row = images.find((item) => item.id === image.r2_key || item.r2_key === image.r2_key) ||
        images.find((item) => item.sort_order === image.sort_order) ||
        images[0]

      if (!row) return image

      return {
        ...image,
        r2_key: row.r2_key,
        url: toAssetUrl(row.r2_key),
        variants: toVariantUrls(row),
      }
    })

    await putJson(`public/products/${productId}.json`, detail)
  }

  const settings = await d1Query(`SELECT value FROM settings WHERE key = 'catalog_version'`)
  const nextVersion = Number.parseInt(settings[0]?.value || '1', 10) + 1
  await d1Exec(`UPDATE settings SET value = '${nextVersion}' WHERE key = 'catalog_version'`)

  const manifest = {
    catalog_version: nextVersion,
    generated_at: new Date().toISOString(),
    total_products: Array.isArray(catalog) ? catalog.length : 0,
  }
  await putJson('public/manifest.json', manifest)
  console.log(`Snapshots publicos actualizados para ${productIds.length} producto(s). Nueva version: ${nextVersion}`)
}

async function fetchJson(url) {
  return retryAsync(`leer ${url}`, async () => {
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) {
      throw new Error(`No se pudo leer ${url}: ${response.status}`)
    }
    return response.json()
  })
}

async function downloadImage(r2Key) {
  return retryAsync(`descargar ${r2Key}`, async () => {
    const response = await fetch(toAssetUrl(r2Key))
    if (!response.ok) {
      throw new Error(`No se pudo descargar ${r2Key}: ${response.status}`)
    }
    return Buffer.from(await response.arrayBuffer())
  })
}

async function putJson(key, payload) {
  const filePath = join(TMP_DIR, key.replace(/[\\/]/g, '__'))
  await mkdir(TMP_DIR, { recursive: true })
  await writeFile(filePath, JSON.stringify(payload))
  r2Put(key, filePath, 'application/json')
}

function toVariantUrls(row) {
  return {
    thumb_url: toAssetUrl(row.thumb_r2_key || row.r2_key),
    card_url: toAssetUrl(row.card_r2_key || row.r2_key),
    detail_url: toAssetUrl(row.detail_r2_key || row.r2_key),
    full_url: toAssetUrl(row.full_r2_key || row.r2_key),
  }
}

function toAssetUrl(key) {
  return `${assetOrigin}/${key}`
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
  retrySync(`subir ${key}`, () => {
    runWrangler(['r2', 'object', 'put', `${bucket}/${key}`, '--file', filePath, '--content-type', contentType, '--remote'])
  })
}

function runWrangler(args) {
  const result = spawnSync(process.execPath, [WRANGLER_BIN, ...args], {
    cwd: WORKER_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })

  if (result.error) {
    throw new Error(`No se pudo ejecutar wrangler (${args.join(' ')}): ${result.error.message}`)
  }

  if (result.status !== 0) {
    throw new Error([
      `wrangler ${args.join(' ')} fallo con codigo ${result.status}.`,
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

function parseArgs(args) {
  const parsed = {}
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--dry-run') {
      parsed.dryRun = true
      continue
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      parsed[key] = args[index + 1]
      index += 1
    }
  }
  return parsed
}

function parsePositiveInteger(value) {
  if (value === undefined) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error('--limit debe ser un numero entero mayor a 0.')
  }
  return parsed
}

function parseIntegerOption(value, fallback, label) {
  if (value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} debe ser un numero entero mayor o igual a 0.`)
  }
  return parsed
}

async function retryAsync(label, action) {
  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await action()
    } catch (error) {
      lastError = error
      if (attempt >= maxRetries || !isRetryableError(error)) {
        throw error
      }

      const delay = retryDelayMs * 2 ** attempt
      console.warn(`  Reintento ${attempt + 1}/${maxRetries} en ${delay}ms: ${label} (${error.message})`)
      await wait(delay)
    }
  }
  throw lastError
}

function retrySync(label, action) {
  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return action()
    } catch (error) {
      lastError = error
      if (attempt >= maxRetries || !isRetryableError(error)) {
        throw error
      }

      const delay = retryDelayMs * 2 ** attempt
      console.warn(`  Reintento ${attempt + 1}/${maxRetries} en ${delay}ms: ${label} (${error.message})`)
      sleepSync(delay)
    }
  }
  throw lastError
}

function isRetryableError(error) {
  const message = String(error?.message || error).toLowerCase()
  return [
    'fetch failed',
    'connectivity',
    'network',
    'timeout',
    'timed out',
    'econnreset',
    'etimedout',
    'eai_again',
    '500',
    '502',
    '503',
    '504',
    'unspecified error',
  ].some((fragment) => message.includes(fragment))
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''")
}

function stripTrailingSlash(value) {
  return value.replace(/\/$/, '')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
