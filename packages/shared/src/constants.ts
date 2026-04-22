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

// Transiciones de estado válidas para productos
// NOTA: 'sold' es un estado TERMINAL — no hay transiciones de salida.
// Si una venta se deshace, se crea un nuevo producto (preserva historial de órdenes).
export const VALID_STATUS_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  draft: ['active'],
  active: ['hidden', 'reserved', 'sold'],
  hidden: ['active', 'reserved', 'sold'],
  reserved: ['active', 'sold'],
  sold: [],
}

// Transiciones de estado válidas para órdenes
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: [],
  cancelled: [],
  expired: [],
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
  very_good: 'Buen Estado',
  good: 'Aceptable',
  acceptable: 'Con detalles',
  
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
  WHATSAPP_TEMPLATE: 'whatsapp_template',
  ORDER_EXPIRY_MINUTES: 'order_expiry_minutes',
  BRAND_LOGO_URL: 'brand_logo_url',
  STORE_BANNER_TITLE: 'store_banner_title',
  STORE_BANNER_TEXT: 'store_banner_text',
  STORE_BANNER_IMAGE_URL: 'store_banner_image_url',
  STORE_BANNER_VIDEO_URL: 'store_banner_video_url',
  STORE_BANNER_MEDIA_TYPE: 'store_banner_media_type',
  ADMIN_BANNER_TITLE: 'admin_banner_title',
  ADMIN_BANNER_TEXT: 'admin_banner_text',
  ADMIN_BANNER_IMAGE_URL: 'admin_banner_image_url',
  SOCIAL_FACEBOOK_URL: 'social_facebook_url',
  SOCIAL_TIKTOK_URL: 'social_tiktok_url',
  SOCIAL_INSTAGRAM_URL: 'social_instagram_url',
  CATALOG_VERSION: 'catalog_version',
} as const

// Defaults
export const DEFAULT_ORDER_EXPIRY_MINUTES = 120
export const DEFAULT_STORE_NAME = 'BAP Shop'
export const DEFAULT_WHATSAPP_TEMPLATE = [
  '*{{store_name_upper}}*',
  '*COMPROBANTE DE COMPRA*',
  '{{whatsapp_header_block}}',
  '',
  '--------------------------------',
  'Pedido: *#{{order_code}}*',
  'Cliente: *{{customer_name}}*',
  'Telefono: *{{customer_phone}}*',
  '--------------------------------',
  '*Detalle*',
  '{{items}}',
  '',
  '--------------------------------',
  'Subtotal: {{subtotal}}',
  '{{discount_block}}',
  'Total: *{{total}}*',
  '--------------------------------',
  'Comprobante generado para seguimiento y coordinacion de entrega.',
  'Referencia: *#{{order_code}}*',
  '',
  'Gracias por tu compra.',
  'Quedamos atentos para confirmar disponibilidad y coordinar la entrega.',
].join('\n')
export const DEFAULT_STORE_BANNER_TITLE = 'Piezas seleccionadas, stock real'
export const DEFAULT_STORE_BANNER_TEXT = 'Catalogo actualizado desde el panel con disponibilidad y promociones sincronizadas.'
export const DEFAULT_ADMIN_BANNER_TITLE = 'BAP Shop Admin'
export const DEFAULT_ADMIN_BANNER_TEXT = 'Gestion centralizada de catalogo, promociones, pedidos y ajustes.'
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const PRODUCT_IMAGE_VARIANTS = {
  THUMB: 'thumb',
  CARD: 'card',
  DETAIL: 'detail',
  FULL: 'full',
} as const
export type ProductImageVariant = (typeof PRODUCT_IMAGE_VARIANTS)[keyof typeof PRODUCT_IMAGE_VARIANTS]

export const PRODUCT_IMAGE_VARIANT_LIMITS_BYTES: Record<ProductImageVariant, number> = {
  thumb: 150 * 1024,
  card: 450 * 1024,
  detail: 1100 * 1024,
  full: 2200 * 1024,
}
export const MAX_CART_ITEMS = 20
export const SESSION_DURATION_HOURS = 8
