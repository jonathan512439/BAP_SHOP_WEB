// ============================================================
// UTILIDADES GENERALES
// ============================================================

/**
 * Genera un UUID v4 usando la Web Crypto API.
 * Funciona en Workers y en el navegador.
 */
export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Genera un código de pedido único con formato: BAP-YYYYMMDD-XXXX
 * Ejemplo: BAP-20260322-A7K3
 */
export function generateOrderCode(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(36).toUpperCase())
    .join('')
    .slice(0, 4)
  return `BAP-${date}-${suffix}`
}

/**
 * Genera un slug a partir de un texto.
 * Ejemplo: "Nike Air Force 1" -> "nike-air-force-1"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

/**
 * Aplica un porcentaje de descuento a un precio entero.
 * Usa Math.floor para evitar fracciones.
 */
export function applyDiscount(price: number, discountPct: number): number {
  return Math.floor(price * (1 - discountPct / 100))
}

/**
 * Calcula los totales de un pedido dado un array de items.
 */
export function calculateOrderTotals(
  items: Array<{ unit_price: number; final_price: number }>
): { subtotal: number; discount: number; total: number } {
  const subtotal = items.reduce((sum, i) => sum + i.unit_price, 0)
  const total = items.reduce((sum, i) => sum + i.final_price, 0)
  const discount = subtotal - total
  return { subtotal, discount, total }
}

/**
 * Formateo de moneda BOB sin decimales, usando Intl.NumberFormat.
 * Ejemplo: 12500 -> "Bs12.500"
 * Si el monto no es un número finito, retorna "Bs0".
 */
const bobFormatter = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  currencyDisplay: 'narrowSymbol',
})

export function formatPrice(amount: number): string {
  if (!Number.isFinite(amount)) return bobFormatter.format(0)
  return bobFormatter.format(amount)
}

/**
 * Pagina un array dado page (1-indexed) y limit.
 */
export function paginate<T>(items: T[], page: number, limit: number): T[] {
  const start = (page - 1) * limit
  return items.slice(start, start + limit)
}

/**
 * Calcula el total de páginas dado un total de items y un limit.
 */
export function totalPages(total: number, limit: number): number {
  return Math.ceil(total / limit)
}
