import { env } from 'cloudflare:test'

const SCHEMA_STATEMENTS = [
  `CREATE TABLE brands (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE,
    slug TEXT UNIQUE,
    is_active INTEGER DEFAULT 1,
    created_at TEXT
  )`,
  `CREATE TABLE models (
    id TEXT PRIMARY KEY,
    brand_id TEXT,
    name TEXT,
    slug TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT
  )`,
  `CREATE TABLE products (
    id TEXT PRIMARY KEY,
    type TEXT,
    status TEXT DEFAULT 'draft',
    name TEXT,
    model_id TEXT,
    size TEXT,
    description TEXT,
    characteristics TEXT,
    price INTEGER,
    physical_condition TEXT,
    sort_order INTEGER DEFAULT 0,
    reserved_order_id TEXT,
    reserved_until TEXT,
    created_at TEXT,
    updated_at TEXT
  )`,
  `CREATE TABLE product_images (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    r2_key TEXT UNIQUE,
    is_primary INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT
  )`,
  `CREATE TABLE product_promotions (
    product_id TEXT PRIMARY KEY,
    discount_pct INTEGER,
    starts_at TEXT,
    ends_at TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
  )`,
  `CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    order_code TEXT UNIQUE,
    customer_name TEXT,
    customer_phone TEXT,
    status TEXT DEFAULT 'pending',
    subtotal INTEGER,
    discount INTEGER,
    total INTEGER,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT,
    expires_at TEXT
  )`,
  `CREATE TABLE order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    product_id TEXT,
    product_name TEXT,
    product_type TEXT,
    product_size TEXT,
    unit_price INTEGER,
    promo_price INTEGER,
    final_price INTEGER
  )`,
  `CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
]

const DROP_STATEMENTS = [
  'DROP TABLE IF EXISTS settings',
  'DROP TABLE IF EXISTS order_items',
  'DROP TABLE IF EXISTS orders',
  'DROP TABLE IF EXISTS product_promotions',
  'DROP TABLE IF EXISTS product_images',
  'DROP TABLE IF EXISTS products',
  'DROP TABLE IF EXISTS models',
  'DROP TABLE IF EXISTS brands',
]

export async function setupTestDb() {
  for (const statement of SCHEMA_STATEMENTS) {
    await env.DB.prepare(statement).run()
  }
}

export async function cleanupTestDb() {
  for (const statement of DROP_STATEMENTS) {
    await env.DB.prepare(statement).run()
  }
}
