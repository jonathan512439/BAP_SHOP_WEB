import { mkdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = fileURLToPath(new URL('../..', import.meta.url))
const WORKER_DIR = fileURLToPath(new URL('..', import.meta.url))
const TMP_DIR = join(ROOT_DIR, '.tmp', 'ops-health')
const WRANGLER_BIN = join(WORKER_DIR, 'node_modules', 'wrangler', 'bin', 'wrangler.js')

const options = parseArgs(process.argv.slice(2))
const envName = options.env || 'production'
const database = options.database || (envName === 'staging' ? 'bap-shop-db-staging' : 'bap-shop-db')
const bucket = options.bucket || (envName === 'staging' ? 'bap-shop-images-staging' : 'bap-shop-images')
const checkImages = Boolean(options.checkImages)
const imageLimit = parsePositiveInteger(options.imageLimit) ?? 50
const failOnIssues = Boolean(options.failOnIssues)
const now = new Date().toISOString()

try {
  await main()
} catch (error) {
  console.error('\nDiagnostico abortado.')
  console.error(error?.stack || error?.message || error)
  process.exit(1)
}

async function main() {
  console.log('Diagnostico operativo BAP Shop')
  console.log(`- env: ${envName}`)
  console.log(`- database: ${database}`)
  console.log(`- bucket: ${bucket}`)
  console.log(`- checkImages: ${checkImages ? 'si' : 'no'}`)
  console.log(`- imageLimit: ${imageLimit}`)

  await mkdir(TMP_DIR, { recursive: true })

  const issues = []

  await checkDatabaseIntegrity(issues)
  await checkPublicSnapshots(issues)
  if (checkImages) {
    await checkImageObjects(issues)
  }

  await rm(TMP_DIR, { recursive: true, force: true })

  console.log('\nResumen')
  if (issues.length === 0) {
    console.log('- OK: no se detectaron problemas criticos.')
    return
  }

  for (const issue of issues) {
    console.log(`- ${issue.severity.toUpperCase()}: ${issue.code} - ${issue.message}`)
  }

  if (failOnIssues && issues.some((issue) => issue.severity === 'error')) {
    process.exit(2)
  }
}

async function checkDatabaseIntegrity(issues) {
  const checks = [
    {
      code: 'image_variants_missing',
      severity: 'error',
      message: 'Imagenes con variantes faltantes en D1.',
      sql: `
        SELECT COUNT(*) AS count
        FROM product_images
        WHERE thumb_r2_key IS NULL
           OR card_r2_key IS NULL
           OR detail_r2_key IS NULL
           OR full_r2_key IS NULL
      `,
    },
    {
      code: 'visible_products_without_primary_image',
      severity: 'error',
      message: 'Productos visibles sin imagen principal.',
      sql: `
        SELECT COUNT(*) AS count
        FROM products p
        WHERE p.status IN ('active', 'sold')
          AND NOT EXISTS (
            SELECT 1 FROM product_images pi
            WHERE pi.product_id = p.id AND pi.is_primary = 1
          )
      `,
    },
    {
      code: 'expired_pending_orders',
      severity: 'warning',
      message: 'Pedidos pendientes vencidos que aun no expiraron.',
      sql: `
        SELECT COUNT(*) AS count
        FROM orders
        WHERE status = 'pending' AND expires_at <= '${sqlEscape(now)}'
      `,
    },
    {
      code: 'reserved_products_without_pending_order',
      severity: 'error',
      message: 'Productos reservados asociados a pedidos no pendientes o inexistentes.',
      sql: `
        SELECT COUNT(*) AS count
        FROM products p
        LEFT JOIN orders o ON o.id = p.reserved_order_id
        WHERE p.status = 'reserved'
          AND p.reserved_order_id IS NOT NULL
          AND (o.id IS NULL OR o.status <> 'pending')
      `,
    },
    {
      code: 'pending_order_items_not_reserved',
      severity: 'error',
      message: 'Items de pedidos pendientes cuyos productos no estan reservados por ese pedido.',
      sql: `
        SELECT COUNT(*) AS count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE o.status = 'pending'
          AND (p.id IS NULL OR p.status <> 'reserved' OR p.reserved_order_id <> o.id)
      `,
    },
    {
      code: 'order_items_without_product',
      severity: 'warning',
      message: 'Items historicos que apuntan a productos eliminados.',
      sql: `
        SELECT COUNT(*) AS count
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE p.id IS NULL
      `,
    },
  ]

  console.log('\nD1')
  for (const check of checks) {
    const rows = await d1Query(check.sql)
    const count = Number(rows[0]?.count ?? 0)
    console.log(`- ${check.code}: ${count}`)
    if (count > 0) {
      issues.push({ ...check, message: `${check.message} Total: ${count}` })
    }
  }
}

async function checkPublicSnapshots(issues) {
  console.log('\nSnapshots publicos R2')
  const expectedKeys = [
    'public/manifest.json',
    'public/catalog/index.json',
    'public/catalog/filters.json',
  ]

  const visibleProducts = await d1Query(`
    SELECT id
    FROM products
    WHERE status IN ('active', 'sold')
    ORDER BY id ASC
  `)
  for (const product of visibleProducts) {
    expectedKeys.push(`public/products/${product.id}.json`)
  }

  let missing = 0
  for (const key of expectedKeys) {
    if (!r2ObjectExists(key)) {
      missing += 1
      console.log(`- FALTA: ${key}`)
    }
  }

  if (missing === 0) {
    console.log(`- OK: ${expectedKeys.length} snapshot(s) verificados.`)
  } else {
    issues.push({
      code: 'public_snapshots_missing',
      severity: 'error',
      message: `Faltan ${missing} snapshot(s) publicos en R2.`,
    })
  }
}

async function checkImageObjects(issues) {
  console.log('\nImagenes R2')
  const rows = await d1Query(`
    SELECT id, product_id, r2_key, thumb_r2_key, card_r2_key, detail_r2_key, full_r2_key
    FROM product_images
    ORDER BY product_id ASC, sort_order ASC
    LIMIT ${imageLimit}
  `)

  let missing = 0
  let checked = 0
  for (const row of rows) {
    const keys = [row.r2_key, row.thumb_r2_key, row.card_r2_key, row.detail_r2_key, row.full_r2_key]
      .filter(Boolean)
    for (const key of new Set(keys)) {
      checked += 1
      if (!r2ObjectExists(key)) {
        missing += 1
        console.log(`- FALTA: image=${row.id} key=${key}`)
      }
    }
  }

  if (missing === 0) {
    console.log(`- OK: ${checked} objeto(s) de imagen verificados.`)
  } else {
    issues.push({
      code: 'image_objects_missing',
      severity: 'error',
      message: `Faltan ${missing} objeto(s) de imagen en R2 dentro del lote revisado.`,
    })
  }
}

async function d1Query(sql) {
  const payload = runWrangler(['d1', 'execute', database, '--env', envName, '--remote', '--json', '--command', sql])
  const parsed = parseWranglerJson(payload)
  const first = Array.isArray(parsed) ? parsed[0] : parsed
  return first?.results || first?.result?.[0]?.results || []
}

function r2ObjectExists(key) {
  const outputPath = join(TMP_DIR, key.replace(/[\\/]/g, '__'))
  const result = runWrangler(
    ['r2', 'object', 'get', `${bucket}/${key}`, '--file', outputPath, '--remote'],
    { allowFailure: true }
  )
  return result.ok
}

function runWrangler(args, { allowFailure = false } = {}) {
  const result = spawnSync(process.execPath, [WRANGLER_BIN, ...args], {
    cwd: WORKER_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })

  if (result.error) {
    if (allowFailure) return { ok: false, stdout: result.stdout, stderr: result.stderr }
    throw new Error(`No se pudo ejecutar wrangler (${args.join(' ')}): ${result.error.message}`)
  }

  if (result.status !== 0) {
    if (allowFailure) return { ok: false, stdout: result.stdout, stderr: result.stderr }
    throw new Error([
      `wrangler ${args.join(' ')} fallo con codigo ${result.status}.`,
      result.stderr ? `stderr:\n${result.stderr}` : '',
      result.stdout ? `stdout:\n${result.stdout}` : '',
    ].filter(Boolean).join('\n'))
  }

  return allowFailure ? { ok: true, stdout: result.stdout.trim(), stderr: result.stderr } : result.stdout.trim()
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
  const booleanAliases = new Map([
    ['check-images', 'checkImages'],
    ['checkImages', 'checkImages'],
    ['fail-on-issues', 'failOnIssues'],
    ['failOnIssues', 'failOnIssues'],
  ])
  const valueAliases = new Map([
    ['env', 'env'],
    ['database', 'database'],
    ['bucket', 'bucket'],
    ['image-limit', 'imageLimit'],
    ['imageLimit', 'imageLimit'],
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

function parsePositiveInteger(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''")
}
