import { nowISO } from '@bap-shop/shared'

export const BACKUP_PREFIX = 'backups/d1/'
export const BACKUP_SCHEMA_VERSION = 1

export const BACKUP_ALLOWED_TABLES = [
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
] as const

export type BackupTable = typeof BACKUP_ALLOWED_TABLES[number]

interface BackupOptions {
  environment: string
  keepDailyDays?: number
  keepWeeklyWeeks?: number
}

interface BackupTablePayload {
  rows: Record<string, unknown>[]
  rowCount: number
}

interface BackupPayload {
  schemaVersion: number
  generatedAt: string
  environment: string
  note: string
  retention: {
    keepDailyDays: number
    keepWeeklyWeeks: number
  }
  tables: Record<BackupTable, BackupTablePayload>
}

interface BackupResult {
  key: string
  generatedAt: string
  rowCounts: Record<BackupTable, number>
  bytes: number
  deletedBackups: string[]
}

const DEFAULT_KEEP_DAILY_DAYS = 7
const DEFAULT_KEEP_WEEKLY_WEEKS = 4

export async function createDatabaseBackup(
  db: D1Database,
  r2: R2Bucket,
  options: BackupOptions
): Promise<BackupResult> {
  const generatedAt = nowISO()
  const keepDailyDays = options.keepDailyDays ?? DEFAULT_KEEP_DAILY_DAYS
  const keepWeeklyWeeks = options.keepWeeklyWeeks ?? DEFAULT_KEEP_WEEKLY_WEEKS

  const tables = {} as Record<BackupTable, BackupTablePayload>
  for (const table of BACKUP_ALLOWED_TABLES) {
    const rows = await selectAll(db, table)
    const sanitizedRows = table === 'admins' ? sanitizeAdminRows(rows) : rows
    tables[table] = {
      rows: sanitizedRows,
      rowCount: sanitizedRows.length,
    }
  }

  const payload: BackupPayload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    generatedAt,
    environment: options.environment,
    note: 'Backup operativo de D1. No contiene archivos R2; product_images conserva solo rutas/keys.',
    retention: {
      keepDailyDays,
      keepWeeklyWeeks,
    },
    tables,
  }

  const body = JSON.stringify(payload)
  const key = `${BACKUP_PREFIX}${toBackupStamp(generatedAt)}.json`

  await r2.put(key, body, {
    httpMetadata: {
      contentType: 'application/json',
      cacheControl: 'no-store',
    },
    customMetadata: {
      generatedAt,
      environment: options.environment,
      schemaVersion: String(BACKUP_SCHEMA_VERSION),
    },
  })

  const deletedBackups = await cleanupExpiredBackups(r2, generatedAt, {
    keepDailyDays,
    keepWeeklyWeeks,
    keepKey: key,
  })

  return {
    key,
    generatedAt,
    rowCounts: Object.fromEntries(
      BACKUP_ALLOWED_TABLES.map((table) => [table, tables[table].rowCount])
    ) as Record<BackupTable, number>,
    bytes: new TextEncoder().encode(body).byteLength,
    deletedBackups,
  }
}

async function selectAll(db: D1Database, table: BackupTable): Promise<Record<string, unknown>[]> {
  const result = await db.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>()
  return result.results
}

function sanitizeAdminRows(rows: Record<string, unknown>[]) {
  return rows.map(({ password_hash: _passwordHash, ...row }) => ({
    ...row,
    password_hash_omitted: true,
  }))
}

async function cleanupExpiredBackups(
  r2: R2Bucket,
  now: string,
  options: {
    keepDailyDays: number
    keepWeeklyWeeks: number
    keepKey: string
  }
): Promise<string[]> {
  const objects = await listAllBackupObjects(r2)
  const nowTime = new Date(now).getTime()
  const dailyCutoff = nowTime - options.keepDailyDays * 24 * 60 * 60 * 1000
  const weeklyCutoff = nowTime - options.keepWeeklyWeeks * 7 * 24 * 60 * 60 * 1000
  const keysToDelete: string[] = []

  for (const object of objects) {
    if (object.key === options.keepKey) continue

    const backupDate = parseBackupDate(object.key)
    if (!backupDate) continue

    const backupTime = backupDate.getTime()
    const isRecentDaily = backupTime >= dailyCutoff
    const isWeeklyKeeper = backupDate.getUTCDay() === 0 && backupTime >= weeklyCutoff

    if (!isRecentDaily && !isWeeklyKeeper) {
      keysToDelete.push(object.key)
    }
  }

  await Promise.all(keysToDelete.map((key) => r2.delete(key)))
  return keysToDelete
}

async function listAllBackupObjects(r2: R2Bucket): Promise<R2Object[]> {
  const objects: R2Object[] = []
  let cursor: string | undefined

  do {
    const result = await r2.list({ prefix: BACKUP_PREFIX, cursor })
    objects.push(...result.objects)
    cursor = result.truncated ? result.cursor : undefined
  } while (cursor)

  return objects
}

function toBackupStamp(iso: string) {
  return iso.replace(/[:.]/g, '-')
}

function parseBackupDate(key: string) {
  const filename = key.slice(BACKUP_PREFIX.length).replace(/\.json$/, '')
  const normalized = filename.replace(
    /^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    '$1:$2:$3.$4Z'
  )
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}
