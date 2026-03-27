// ============================================================
// VALIDACIONES DE DATOS DEL CLIENTE
// ============================================================

/**
 * Valida el nombre del cliente.
 * Reglas: mínimo 2 caracteres, máximo 100, no vacío.
 */
export function validateCustomerName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim()
  if (trimmed.length < 2) return { valid: false, error: 'El nombre debe tener al menos 2 caracteres' }
  if (trimmed.length > 100) return { valid: false, error: 'El nombre no puede superar los 100 caracteres' }
  return { valid: true }
}

/**
 * Alias corto del planning.
 */
export function validateName(name: string): { valid: boolean; error?: string } {
  return validateCustomerName(name)
}

/**
 * Valida el número de teléfono del cliente.
 * Acepta formatos variados con/sin código de país, guiones, espacios y paréntesis.
 * Ejemplos válidos: +54 9 11 1234-5678 | 01112345678 | +1 (555) 123-4567
 */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  const cleaned = phone.replace(/[\s\-().+]/g, '')
  if (!/^\d{7,15}$/.test(cleaned)) {
    return { valid: false, error: 'Ingresa un número de teléfono válido (7-15 dígitos)' }
  }
  return { valid: true }
}

/**
 * Normaliza un teléfono: elimina espacios, guiones y paréntesis.
 * Conserva el + inicial si existe.
 */
export function normalizePhone(phone: string): string {
  const hasPlus = phone.trimStart().startsWith('+')
  const digits = phone.replace(/[\s\-().+]/g, '')
  return hasPlus ? `+${digits}` : digits
}

/**
 * Valida que el porcentaje de descuento esté entre 1 y 99.
 */
export function validateDiscountPct(pct: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(pct) || pct < 1 || pct > 99) {
    return { valid: false, error: 'El descuento debe ser un entero entre 1 y 99' }
  }
  return { valid: true }
}

/**
 * Valida que un precio entero sea positivo.
 */
export function validatePrice(price: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(price) || price <= 0) {
    return { valid: false, error: 'El precio debe ser un número entero positivo' }
  }
  return { valid: true }
}
