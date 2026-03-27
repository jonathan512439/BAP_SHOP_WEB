// ============================================================
// Tipos del entorno del Worker (Cloudflare Bindings)
// Refleja exactamente los bindings declarados en wrangler.toml
// ============================================================

export interface Env {
  // D1 — Base de datos
  DB: D1Database

  // R2 — Almacenamiento de imágenes y snapshots del catálogo
  R2: R2Bucket

  // KV — Rate limiting (best-effort, eventual consistency entre POPs)
  KV: KVNamespace

  // Variables de entorno
  ENVIRONMENT: 'development' | 'production'
  R2_PUBLIC_DOMAIN: string    // ej: "assets.bapshop.com"
  STORE_DOMAIN: string        // ej: "bapshop.com"
  ADMIN_DOMAIN: string        // ej: "admin.bapshop.com"

  // Secretos (definidos en .dev.vars o wrangler secret)
  ADMIN_PEPPER: string        // Pepper para Argon2id del hash de contraseñas
  TURNSTILE_SECRET: string    // Secret key de Cloudflare Turnstile
}

// Tipo de contexto de Hono con el entorno tipado
export type HonoEnv = {
  Bindings: Env
  Variables: {
    adminId: string
    adminUsername: string
    csrfToken: string
    requestId: string
  }
}
