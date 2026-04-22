import { mkdir, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = fileURLToPath(new URL('../..', import.meta.url))
const WORKER_DIR = fileURLToPath(new URL('..', import.meta.url))
const TMP_DIR = join(ROOT_DIR, '.tmp', 'backups')
const WRANGLER_BIN = join(WORKER_DIR, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const BACKUP_PREFIX = 'backups/d1/'
const BACKUP_SCHEMA_VERSION = 1

const BACKUP_TABLES = [
  'admins',
  'brands',
  'models',
  'products',
  'product_images',
  'product_promotions',
  'orders',
  'order_items',
  'settings',
  'audit_log',
]

const options = parseArgs(process.argv.slice(2))
const envName = options.env || 'production'
const database = options.database || 'bap-shop-db'
const bucket = options.bucket || 'bap-shop-images'
const dryRun = Boolean(options.dryRun)

try {
  await main()
} catch (error) {
  console.error('\nBackup abortado.')
  console.error(error?.stack || error?.message || error)
  process.exit(1)
}

async function main() {
  const generatedAt = new Date().toISOString()
  const backupKey = `${BACKUP_PREFIX}${toBackupStamp(generatedAt)}.json`
  const localPath = join(TMP_DIR, `${toBackupStamp(generatedAt)}.json`)

  console.log('Backup manual de D1 hacia R2')
  console.log(`- env: ${envName}`)
  console.log(`- database: ${database}`)
  console.log(`- bucket: ${bucket}`)
  console.log(`- key: ${backupKey}`)
  console.log(`- dryRun: ${dryRun ? 'si' : 'no'}`)

  await mkdir(TMP_DIR, { recursive: true })

  const tables = {}
  for (const table of BACKUP_TABLES) {
    const rows = await d1Query(`SELECT * FROM ${table}`)
    const sanitizedRows = table === 'admins' ? sanitizeAdminRows(rows) : rows
    tables[table] = {
      rowCount: sanitizedRows.length,
      rows: sanitizedRows,
    }
    console.log(`- ${table}: ${sanitizedRows.length} filas`)
  }

  const payload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    generatedAt,
    environment: envName,
    database,
    note: 'Backup operativo de D1. No contiene archivos R2; product_images conserva solo rutas/keys.',
    security: {
      adminPasswordHashesOmitted: true,
    },
    tables,
  }

  const body = JSON.stringify(payload, null, 2)
  await writeFile(localPath, body)
  console.log(`Archivo temporal generado: ${localPath}`)
  console.log(`Tamano: ${formatBytes(Buffer.byteLength(body))}`)

  if (!dryRun) {
    r2Put(backupKey, localPath, 'application/json')
    console.log(`Backup subido a R2: ${backupKey}`)
  } else {
    console.log('Dry-run: no se subio el backup a R2.')
  }

  await rm(TMP_DIR, { recursive: true, force: true })
}

function sanitizeAdminRows(rows) {
  return rows.map(({ password_hash: _passwordHash, ...row }) => ({
    ...row,
    password_hash_omitted: true,
  }))
}

async function d1Query(sql) {
  const payload = runWrangler(['d1', 'execute', database, '--env', envName, '--remote', '--json', '--command', sql])
  const parsed = parseWranglerJson(payload)
  const first = Array.isArray(parsed) ? parsed[0] : parsed
  return first?.results || first?.result?.[0]?.results || []
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

function toBackupStamp(iso) {
  return iso.replace(/[:.]/g, '-')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
