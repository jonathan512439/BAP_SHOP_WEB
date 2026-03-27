import { generateId, nowISO } from '@bap-shop/shared'

// ============================================================
// Auditoría de acciones del admin
// ============================================================

/**
 * Registra una acción del admin en la tabla audit_log.
 * old_value y new_value son serializados a JSON string.
 */
export async function logAction(
  db: D1Database,
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  oldValue?: unknown,
  newValue?: unknown
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_log
        (id, admin_id, action, entity_type, entity_id, old_value, new_value, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      generateId(),
      adminId,
      action,
      entityType,
      entityId,
      oldValue !== undefined ? JSON.stringify(oldValue) : null,
      newValue !== undefined ? JSON.stringify(newValue) : null,
      nowISO()
    )
    .run()
}
