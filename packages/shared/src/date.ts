// ============================================================
// HELPERS DE FECHAS — Todas en UTC, formato ISO 8601
// Formato estándar: "2026-03-22T09:00:00.000Z"
// ============================================================

/**
 * Retorna el timestamp UTC actual en formato ISO 8601.
 * Ejemplo: "2026-03-22T09:00:00.000Z"
 */
export function nowISO(): string {
  return new Date().toISOString()
}

/**
 * Retorna un timestamp UTC futuro sumando N minutos al momento actual.
 */
export function addMinutesISO(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

/**
 * Alias semántico del planning definitivo.
 */
export function addMinutes(minutes: number): string {
  return addMinutesISO(minutes)
}

/**
 * Retorna un timestamp UTC futuro sumando N horas al momento actual.
 */
export function addHoursISO(hours: number): string {
  return addMinutesISO(hours * 60)
}

/**
 * Verifica si una fecha ISO está en el pasado respecto al momento actual.
 */
export function isExpired(isoDate: string): boolean {
  return new Date(isoDate) < new Date()
}

/**
 * Compara dos fechas ISO 8601.
 */
export function isBefore(leftIsoDate: string, rightIsoDate: string): boolean {
  return new Date(leftIsoDate) < new Date(rightIsoDate)
}

/**
 * Verifica si una promoción es válida en este momento.
 * Una promo es válida si: enabled=1 AND starts_at <= now AND ends_at > now
 */
export function isPromoActive(promo: {
  enabled: 0 | 1
  starts_at: string
  ends_at: string
}): boolean {
  if (!promo.enabled) return false
  const now = new Date()
  return new Date(promo.starts_at) <= now && new Date(promo.ends_at) > now
}

/**
 * Formatea una fecha ISO para mostrar en UI (formato legible local).
 * Ejemplo: "22/03/2026 09:00"
 */
export function formatDateDisplay(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Retorna la fecha en formato YYYY-MM-DD para inputs de tipo date.
 */
export function toDateInputValue(isoDate: string): string {
  return isoDate.slice(0, 10)
}

/**
 * Convierte un string de date input (YYYY-MM-DD) a ISO UTC (inicio del día).
 */
export function fromDateInputValue(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00.000Z').toISOString()
}
