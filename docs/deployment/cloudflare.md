# Despliegue en Cloudflare

## Objetivo

Desplegar store, admin y Worker sin romper produccion y manteniendo variables separadas por entorno.

## Componentes en Cloudflare

Produccion usa:

- Cloudflare Pages para `store`.
- Cloudflare Pages para `admin`.
- Cloudflare Worker para API.
- Cloudflare D1 para datos.
- Cloudflare R2 para archivos.
- Cloudflare KV para rate limiting.
- Cloudflare Turnstile para proteccion contra bots.

## Dominios de produccion

- Store: `bab-shop.com`
- Admin: `admin.bab-shop.com`
- API: `api.bab-shop.com`

## Variables de Pages

Store:

```text
VITE_SITE_URL=https://bab-shop.com
VITE_API_URL=https://api.bab-shop.com
VITE_ASSETS_URL=https://api.bab-shop.com/public
VITE_TURNSTILE_SITE_KEY=<site key store>
```

Admin:

```text
VITE_API_URL=https://api.bab-shop.com
VITE_ASSETS_URL=https://api.bab-shop.com/public
VITE_TURNSTILE_SITE_KEY=<site key admin>
```

No guardar estos valores como secretos dentro del codigo si cambian por entorno.

## Secretos del Worker

Configurar con Wrangler:

```powershell
pnpm --filter worker exec wrangler secret put ADMIN_PEPPER --env production
pnpm --filter worker exec wrangler secret put TURNSTILE_SECRET --env production
pnpm --filter worker exec wrangler secret put TURNSTILE_SECRET_ADMIN --env production
pnpm --filter worker exec wrangler secret put TURNSTILE_SECRET_STORE --env production
```

No subir secretos a Git.

## Validacion antes de desplegar

Desde la raiz:

```powershell
pnpm typecheck
pnpm test
pnpm build:store
pnpm build:admin
pnpm build:worker
pnpm perf:report:strict
```

Si algun comando falla, no desplegar.

## Backup antes de cambios sensibles

Antes de migraciones, limpieza de imagenes o cambios de datos:

```powershell
pnpm --filter worker backup:d1 -- --dry-run --env production --database bap-shop-db --bucket bap-shop-images
pnpm --filter worker backup:d1 -- --env production --database bap-shop-db --bucket bap-shop-images
```

Verificar en R2 que aparezca el backup bajo:

```text
backups/d1/
```

## Desplegar Worker

Opcion recomendada:

1. Subir cambios a GitHub.
2. Esperar CI verde.
3. Ejecutar workflow manual `Deploy Worker`.

Opcion local de emergencia:

```powershell
pnpm --filter worker exec wrangler deploy --env production
```

Validar:

```powershell
curl https://api.bab-shop.com/health
```

Debe responder `success=true` y `environment=production`.

## Desplegar Pages

Si Pages esta conectado a GitHub:

1. Hacer merge o push a `main`.
2. Esperar build de Cloudflare Pages.
3. Revisar deployment de store.
4. Revisar deployment de admin.

Validar rutas:

- `https://bab-shop.com`
- `https://bab-shop.com/zapatillas`
- `https://bab-shop.com/checkout`
- `https://admin.bab-shop.com`
- `https://api.bab-shop.com/health`
- `https://api.bab-shop.com/settings/public`

## Orden recomendado

Para cambios de backend y frontend juntos:

1. Validar local.
2. Probar en staging.
3. Backup D1 produccion.
4. Aplicar migraciones D1 si existen.
5. Desplegar Worker.
6. Desplegar admin/store.
7. Validar produccion.

## Migraciones D1

Produccion:

```powershell
pnpm --filter worker exec wrangler d1 migrations apply bap-shop-db --env production --remote
```

Staging:

```powershell
pnpm --filter worker exec wrangler d1 migrations apply bap-shop-db-staging --env staging --remote
```

No ejecutar migraciones si no hay backup reciente.

## Validacion posterior

Checklist minimo:

- Store carga.
- Catalogo carga.
- Detalle de producto carga imagenes.
- Checkout crea reserva.
- WhatsApp abre con mensaje correcto.
- Admin login funciona.
- Admin puede editar producto.
- Admin puede subir imagen y ver variantes.
- `/health` responde OK.
- DevTools no muestra errores CORS/CSP.
- DevTools no muestra imagenes pesadas en catalogo.

## Rollback

Si falla Worker:

1. Cloudflare Dashboard.
2. Workers & Pages.
3. Abrir Worker.
4. Revisar deployments.
5. Volver a una version anterior estable.

Si falla Pages:

1. Cloudflare Pages.
2. Abrir proyecto.
3. Deployments.
4. Rollback al deployment anterior.

Si falla D1:

1. No tocar mas datos.
2. Usar D1 Time Travel si esta disponible.
3. Restaurar en staging primero usando backup.
4. Solo despues decidir restauracion en produccion.
