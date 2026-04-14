import type { PhysicalCondition, ProductStatus, ProductType, OrderStatus } from './constants'

// ============================================================
// ENTIDADES DE BASE DE DATOS
// ============================================================

export interface Brand {
  id: string
  name: string
  slug: string
  is_active: 0 | 1
  created_at: string
}

export interface Model {
  id: string
  brand_id: string
  name: string
  slug: string
  is_active: 0 | 1
  created_at: string
}

export interface Product {
  id: string
  type: ProductType
  status: ProductStatus
  name: string
  model_id: string | null
  size: string | null
  description: string | null
  characteristics: string | null
  price: number
  physical_condition: PhysicalCondition
  sort_order: number
  reserved_order_id: string | null
  reserved_until: string | null
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  r2_key: string
  is_primary: 0 | 1
  sort_order: number
  created_at: string
}

export interface ProductPromotion {
  product_id: string
  discount_pct: number
  starts_at: string
  ends_at: string
  enabled: 0 | 1
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_code: string
  customer_name: string
  customer_phone: string
  status: OrderStatus
  subtotal: number
  discount: number
  total: number
  notes: string | null
  created_at: string
  updated_at: string
  expires_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  product_type: ProductType
  product_size: string | null
  unit_price: number
  promo_price: number | null
  final_price: number
}

export interface Admin {
  id: string
  username: string
  password_hash: string
  created_at: string
}

export interface AdminSession {
  id: string
  admin_id: string
  token_hash: string
  csrf_token: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
  expires_at: string
}

export interface AuditLog {
  id: string
  admin_id: string
  action: string
  entity_type: string
  entity_id: string
  old_value: string | null
  new_value: string | null
  created_at: string
}

export interface Settings {
  key: string
  value: string
}

// ============================================================
// TIPOS ENRIQUECIDOS (con JOINs)
// ============================================================

/** Producto con marca derivada del modelo (para admin y snapshots) */
export interface ProductWithDetails extends Product {
  model_name?: string
  brand_id?: string
  brand_name?: string
  brand_slug?: string
  images: ProductImage[]
  promotion: ProductPromotion | null
}

/** Card del catálogo (incluida en el snapshot index.json) */
export interface CatalogCard {
  id: string
  type: ProductType
  status: ProductStatus
  name: string
  brand?: { id: string; name: string; slug: string }
  model?: { id: string; name: string }
  size: string | null
  price: number
  promo_price: number | null
  discount_pct: number | null
  physical_condition: PhysicalCondition
  primary_image_url: string | null
  sort_order: number
}

/** Detalle completo del producto para el snapshot products/{id}.json */
export interface CatalogProductDetail {
  id: string
  type: ProductType
  status: ProductStatus
  name: string
  brand?: { id: string; name: string; slug: string }
  model?: { id: string; name: string }
  size: string | null
  description: string | null
  characteristics: string | null
  price: number
  promo_price: number | null
  discount_pct: number | null
  physical_condition: PhysicalCondition
  images: Array<{ r2_key: string; url: string; is_primary: boolean; sort_order: number }>
}

/** Datos de filtros del catálogo (snapshot catalog/filters.json) */
export interface CatalogFilters {
  brands: Array<{ id: string; name: string; slug: string }>
  models: Array<{ id: string; brand_id: string; name: string; slug: string }>
  sizes: string[]
  conditions: PhysicalCondition[]
}

/** Manifiesto público */
export interface CatalogManifest {
  catalog_version: number
  generated_at: string
  total_products: number
}

export interface PublicBrandingSettings {
  store_name: string
  brand_logo_url: string
  social_facebook_url: string
  social_tiktok_url: string
  social_instagram_url: string
  store_banner_title: string
  store_banner_text: string
  store_banner_image_url: string
  store_banner_video_url: string
  store_banner_media_type: 'image' | 'video'
  admin_banner_title: string
  admin_banner_text: string
  admin_banner_image_url: string
}

// ============================================================
// TIPOS DE API
// ============================================================

/** Item del carrito enviado al crear pedido */
export interface CartItemInput {
  productId: string
}

/** Respuesta del POST /orders */
export interface CreateOrderResponse {
  orderId: string
  orderCode: string
  whatsappUrl: string
  priceChanges: PriceChange[]
}

export interface PriceChange {
  productId: string
  productName: string
  cartPrice: number
  actualPrice: number
  changed: boolean
}

/** Item inválido en respuesta 422 */
export interface InvalidCartItem {
  productId: string
  productName: string
  reason: 'sold' | 'hidden' | 'reserved' | 'draft' | 'not_found'
}

/** Respuesta estándar de la API */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    page?: number
    limit?: number
    total?: number
    totalPages?: number
  }
}
