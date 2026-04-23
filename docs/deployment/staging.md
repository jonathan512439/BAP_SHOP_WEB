# Staging de BAP Shop

## Objetivo

Tener un entorno separado de produccion para probar cambios grandes sin tocar datos reales ni archivos reales.

Staging debe usar recursos propios:

- D1 propio.
- R2 propio.
- KV propio.
- Worker propio.
- Dominios propios.
- Variables y secretos propios.

No usar D1/R2/KV de produccion en staging.

## Dominios sugeridos

- Store staging: `https://staging.bab-shop.com`
- Admin staging: `https://admin-staging.bab-shop.com`
- API staging: `https://api-staging.bab-shop.com`

## Recursos Cloudflare a crear

### 1. D1 staging

```powershell
cd D:\Jonathan\Desktop\SOFTWARE\BAP_SHOP-WEB
pnpm --filter worker exec wrangler d1 create bap-shop-db-staging
```

Guardar el `database_id` que devuelve Cloudflare.

### 2. R2 staging

```powershell
pnpm --filter worker exec wrangler r2 bucket create bap-shop-images-staging
```

El bucket staging debe mantenerse privado. El acceso publico debe pasar por el Worker staging.

### 3. KV staging

```powershell
pnpm --filter worker exec wrangler kv namespace create bap-shop-kv-staging
```

Guardar el `id` que devuelve Cloudflare.

## Configurar `worker/wrangler.jsonc`

Despues de crear D1/R2/KV, agregar dentro de `env` un bloque `staging`.

Plantilla:

```jsonc
"staging": {
  "vars": {
    "ENVIRONMENT": "staging",
    "STORE_DOMAIN": "staging.bab-shop.com",
    "ADMIN_DOMAIN": "admin-staging.bab-shop.com",
    "R2_PUBLIC_DOMAIN": "api-staging.bab-shop.com"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "bap-shop-db-staging",
      "database_id": "PEGAR_DATABASE_ID_STAGING"
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "bap-shop-images-staging"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "PEGAR_KV_ID_STAGING"
    }
  ]
}
```

No copiar IDs de produccion.

## Secretos staging

Configurar secretos del Worker staging:

```powershell
pnpm --filter worker exec wrangler secret put ADMIN_PEPPER --env staging
pnpm --filter worker exec wrangler secret put TURNSTILE_SECRET --env staging
pnpm --filter worker exec wrangler secret put TURNSTILE_SECRET_ADMIN --env staging
pnpm --filter worker exec wrangler secret put TURNSTILE_SECRET_STORE --env staging
```

Si se copia una base de datos con admins reales desde produccion, `ADMIN_PEPPER` debe ser el mismo que produccion para que los hashes existentes funcionen.

Si staging tendra admins de prueba, puede usarse un `ADMIN_PEPPER` distinto.

## Migraciones D1 staging

Con `wrangler.jsonc` ya configurado:

```powershell
pnpm --filter worker exec wrangler d1 migrations apply bap-shop-db-staging --env staging --remote
```

Validar tablas:

```powershell
pnpm --filter worker exec wrangler d1 execute bap-shop-db-staging --env staging --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

## Deploy Worker staging

Staging no usa cron triggers automaticos por defecto para evitar duplicar procesos y para no chocar con limites del plan Free de Cloudflare.

```powershell
pnpm --filter worker exec wrangler deploy --env staging
```

Despues, en Cloudflare:

1. Ir a `Workers & Pages`.
2. Abrir `bap-shop-worker-staging`.
3. Configurar dominio o ruta:
   - `api-staging.bab-shop.com/*`
4. Validar:

```powershell
curl https://api-staging.bab-shop.com/health
```

Debe devolver:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "environment": "staging"
  }
}
```

## Cloudflare Pages staging

Crear proyectos separados o despliegues separados para staging.

### Store staging

Dominio:

- `staging.bab-shop.com`

Variables:

- `VITE_SITE_URL=https://staging.bab-shop.com`
- `VITE_API_URL=https://api-staging.bab-shop.com`
- `VITE_ASSETS_URL=https://api-staging.bab-shop.com/public`
- `VITE_TURNSTILE_SITE_KEY=<site key staging store>`

### Admin staging

Dominio:

- `admin-staging.bab-shop.com`

Variables:

- `VITE_API_URL=https://api-staging.bab-shop.com`
- `VITE_ASSETS_URL=https://api-staging.bab-shop.com/public`
- `VITE_TURNSTILE_SITE_KEY=<site key staging admin>`

## Turnstile

En Cloudflare Turnstile, permitir estos dominios:

- `staging.bab-shop.com`
- `admin-staging.bab-shop.com`

Usar secrets staging en el Worker staging.

## Datos de prueba

Opciones:

1. Crear datos manuales desde el admin staging.
2. Restaurar un backup de produccion en D1 staging y usar R2 staging.

Para pruebas seguras, preferir datos manuales o un subconjunto pequeno.

No ejecutar scripts destructivos ni migraciones experimentales sobre produccion.

## Validacion final de Fase 6

Checklist:

- `https://api-staging.bab-shop.com/health` responde `environment=staging`.
- Store staging carga en `https://staging.bab-shop.com`.
- Admin staging carga en `https://admin-staging.bab-shop.com`.
- Login admin staging funciona.
- Se puede crear un producto de prueba.
- Se puede subir imagen de prueba y se generan variantes.
- Catalogo staging muestra el producto.
- Checkout staging crea una reserva de prueba.
- Produccion sigue funcionando sin cambios.

Cuando todo eso se cumpla, Fase 6 puede marcarse como completada.
