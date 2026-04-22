// ============================================================
// Acceso centralizado a la tabla de settings
// ============================================================

/**
 * Carga todos los settings de la base de datos como un mapa key→value.
 */
export async function loadAllSettings(db: D1Database): Promise<Record<string, string>> {
  const rows = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  return Object.fromEntries(rows.results.map((row) => [row.key, row.value]))
}

/**
 * Carga un subconjunto de settings por keys específicas.
 * Más eficiente que loadAllSettings cuando solo necesitas unas pocas.
 */
export async function loadSettingsByKeys(
  db: D1Database,
  keys: string[]
): Promise<Record<string, string>> {
  if (keys.length === 0) return {}
  const placeholders = keys.map(() => '?').join(', ')
  const rows = await db
    .prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
    .bind(...keys)
    .all<{ key: string; value: string }>()
  return Object.fromEntries(rows.results.map((r) => [r.key, r.value]))
}

/**
 * Inserta o actualiza un setting individual.
 */
export async function upsertSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .bind(key, value)
    .run()
}
