-- ============================================================
-- BAP_SHOP — Migración inicial
-- Versión: 0001
-- Fecha: 2026-03-22
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- MARCAS (solo para zapatillas)
-- ============================================================
CREATE TABLE IF NOT EXISTS brands (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  slug      TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- ============================================================
-- MODELOS (solo para zapatillas, pertenecen a una marca)
-- ============================================================
CREATE TABLE IF NOT EXISTS models (
  id        TEXT PRIMARY KEY,
  brand_id  TEXT NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  name      TEXT NOT NULL,
  slug      TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(brand_id, name),
  UNIQUE(brand_id, slug)
);

-- ============================================================
-- PRODUCTOS
-- Reglas de status:
--   draft    → no visible, incompleto
--   active   → visible para el cliente
--   hidden   → no visible, pero no vendido
--   reserved → reservado por un pedido pendiente
--   sold     → vendido, histórico (estado final)
--
-- Transiciones válidas:
--   draft    → active
--   active   → hidden | reserved | sold
--   hidden   → active | sold
--   reserved → active (expiración/cancelación) | sold (confirmación admin)
--   sold     → (ninguna)
--
-- Reglas por tipo:
--   type='sneaker': model_id y size obligatorios (validado en capa de aplicación)
--   type='other':   model_id y size deben ser NULL (validado en capa de aplicación)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY,
  type              TEXT NOT NULL CHECK(type IN ('sneaker', 'other')),
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK(status IN ('draft', 'active', 'hidden', 'reserved', 'sold')),
  name              TEXT NOT NULL,
  model_id          TEXT REFERENCES models(id) ON DELETE RESTRICT,
  size              TEXT,
  description       TEXT,
  characteristics   TEXT,
  price             INTEGER NOT NULL CHECK(price > 0),
  physical_condition TEXT NOT NULL
                    CHECK(physical_condition IN ('new', 'like_new', 'very_good', 'good', 'acceptable')),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  reserved_order_id TEXT,       -- ID del pedido que reservó este artículo
  reserved_until    TEXT,       -- ISO 8601 UTC — igual que orders.expires_at
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- ============================================================
-- IMÁGENES DE PRODUCTOS
-- Una sola imagen principal por producto (garantizado por índice único parcial)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  r2_key     TEXT NOT NULL UNIQUE,   -- clave única en el bucket R2
  is_primary INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Garantiza que solo puede haber UNA imagen con is_primary=1 por producto
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_one_primary
  ON product_images(product_id) WHERE is_primary = 1;

-- ============================================================
-- PROMOCIONES (máximo una por producto — product_id es PK)
-- El campo enabled controla si está activa manualmente.
-- La vigencia real también depende de starts_at y ends_at.
-- Una promo es aplicable si: enabled=1 AND starts_at <= now AND ends_at > now
-- ============================================================
CREATE TABLE IF NOT EXISTS product_promotions (
  product_id   TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  discount_pct INTEGER NOT NULL CHECK(discount_pct BETWEEN 1 AND 99),
  starts_at    TEXT NOT NULL,
  ends_at      TEXT NOT NULL,
  enabled      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  CHECK(ends_at > starts_at)
);

-- ============================================================
-- PEDIDOS
-- expires_at = created_at + order_expiry_minutes (de settings)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,
  order_code     TEXT NOT NULL UNIQUE,   -- formato: BAP-20260322-A7K3
  customer_name  TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK(status IN ('pending', 'confirmed', 'cancelled', 'expired')),
  subtotal       INTEGER NOT NULL,
  discount       INTEGER NOT NULL DEFAULT 0,
  total          INTEGER NOT NULL,
  notes          TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  expires_at     TEXT NOT NULL
);

-- ============================================================
-- ITEMS DEL PEDIDO
-- Snapshot del producto al momento de la compra.
-- product_id sin FK intencional: preserva historial aunque el producto cambie.
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  product_id   TEXT NOT NULL,           -- sin FK intencional
  product_name TEXT NOT NULL,           -- snapshot del nombre
  product_type TEXT NOT NULL,           -- snapshot del tipo
  product_size TEXT,                    -- snapshot de la talla (null si type='other')
  unit_price   INTEGER NOT NULL,        -- snapshot del precio sin descuento
  promo_price  INTEGER,                 -- snapshot del precio con descuento (null si no había promo)
  final_price  INTEGER NOT NULL         -- precio efectivamente aplicado al pedido
);

-- ============================================================
-- ADMINISTRADORES
-- password_hash: Argon2id con pepper del entorno
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

-- ============================================================
-- SESIONES DE ADMIN
-- token_hash = sha256(token_real_en_cookie)
-- csrf_token: enviado en header X-CSRF-Token en mutaciones
-- Sesión dura SESSION_DURATION_HOURS (8h por defecto)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_sessions (
  id          TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  csrf_token  TEXT NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

-- ============================================================
-- LOG DE AUDITORÍA
-- Registra todas las acciones del admin.
-- old_value y new_value son JSON strings.
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL,
  action      TEXT NOT NULL,      -- ej: 'product.status' | 'order.confirm' | 'settings.update'
  entity_type TEXT NOT NULL,      -- ej: 'product' | 'order' | 'promotion'
  entity_id   TEXT NOT NULL,
  old_value   TEXT,               -- JSON del estado anterior
  new_value   TEXT,               -- JSON del estado nuevo
  created_at  TEXT NOT NULL
);

-- ============================================================
-- CONFIGURACIÓN GENERAL
-- Claves disponibles:
--   whatsapp_number      → número del dueño (ej: 5491112345678)
--   store_name           → nombre de la tienda (ej: "BAP Shop")

--   whatsapp_header      → texto de cabecera del mensaje
--   order_expiry_minutes → minutos hasta expiración pedido (default: 120)
--   catalog_version      → entero, se incrementa en cada rebuild del catálogo
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============================================================
-- ÍNDICES
-- ============================================================

-- Catálogo público: filtro principal
CREATE INDEX IF NOT EXISTS idx_products_status    ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_model     ON products(model_id);
CREATE INDEX IF NOT EXISTS idx_products_size      ON products(size) WHERE type = 'sneaker';
CREATE INDEX IF NOT EXISTS idx_products_condition ON products(physical_condition);
CREATE INDEX IF NOT EXISTS idx_products_sort      ON products(sort_order, created_at);

-- Para el cron de expiración: saber qué reservas liberar
CREATE INDEX IF NOT EXISTS idx_products_reserved  ON products(reserved_until) WHERE status = 'reserved';

-- Pedidos
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_expiry      ON orders(expires_at, status);

-- Items de pedido (para saber qué pedidos tienen un producto)
CREATE INDEX IF NOT EXISTS idx_order_items_prod   ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order  ON order_items(order_id);

-- Sesiones de admin
CREATE INDEX IF NOT EXISTS idx_sessions_token     ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry    ON admin_sessions(expires_at);

-- Modelos por marca
CREATE INDEX IF NOT EXISTS idx_models_brand       ON models(brand_id);

-- Auditoría
CREATE INDEX IF NOT EXISTS idx_audit_entity       ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_date         ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_admin        ON audit_log(admin_id, created_at);
