// ============================================================
// ENUMS Y CONSTANTES DEL SISTEMA
// ============================================================

export const PRODUCT_TYPE = {
  SNEAKER: 'sneaker',
  OTHER: 'other',
} as const
export type ProductType = (typeof PRODUCT_TYPE)[keyof typeof PRODUCT_TYPE]

export const PRODUCT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  HIDDEN: 'hidden',
  RESERVED: 'reserved',
  SOLD: 'sold',
} as const
export type ProductStatus = (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS]

// Transiciones de estado válidas
export const VALID_STATUS_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  draft: ['active'],
  active: ['hidden', 'sold'],
  hidden: ['active', 'sold'],
  reserved: ['active', 'sold'],
  sold: [], // estado final
}

export const PHYSICAL_CONDITION = {
  NEW: 'new',
  LIKE_NEW: 'like_new',
  VERY_GOOD: 'very_good',
  GOOD: 'good',
  ACCEPTABLE: 'acceptable',
} as const
export type PhysicalCondition = (typeof PHYSICAL_CONDITION)[keyof typeof PHYSICAL_CONDITION]

export const PHYSICAL_CONDITION_LABELS: Record<PhysicalCondition, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  very_good: 'Muy bueno',
  good: 'Bueno',
  acceptable: 'Aceptable',
}

export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  expired: 'Expirado',
}

// Settings keys
export const SETTINGS_KEYS = {
  WHATSAPP_NUMBER: 'whatsapp_number',
  STORE_NAME: 'store_name',
  WHATSAPP_HEADER: 'whatsapp_header',
  ORDER_EXPIRY_MINUTES: 'order_expiry_minutes',
  CATALOG_VERSION: 'catalog_version',
} as const

// Defaults
export const DEFAULT_ORDER_EXPIRY_MINUTES = 120
export const DEFAULT_STORE_NAME = 'BAP Shop'
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_CART_ITEMS = 20
export const SESSION_DURATION_HOURS = 8
