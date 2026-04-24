# Seguridad

## Objetivo

Mantener el sistema seguro sin hacerlo dificil de operar.

## Superficie publica

Dominios:

- Store: `bab-shop.com`
- Admin: `admin.bab-shop.com`
- API: `api.bab-shop.com`

Rutas publicas esperadas:

- Store y paginas informativas.
- `GET /settings/public`
- Assets publicos bajo `/public`.
- Checkout y creacion de pedidos con controles anti abuso.

## Autenticacion admin

El admin usa:

- Usuario y contrasena.
- Hash con pepper.
- Cookie de sesion.
- CSRF para mutaciones.
- Turnstile en login.

El pepper vive como secreto del Worker:

```powershell
pnpm --filter worker exec wrangler secret put ADMIN_PEPPER --env production
```

No debe existir en el repositorio.

## CSRF

Las mutaciones admin deben incluir token CSRF.

Aplica a:

- Crear/editar/eliminar productos.
- Marcas/modelos.
- Pedidos.
- Promociones.
- Ajustes.
- Cambio de contrasena.

Si una mutacion admin funciona sin sesion o sin CSRF, es un bug de seguridad.

## Turnstile

Turnstile protege login y flujos sensibles.

Dominios permitidos:

- Produccion: `bab-shop.com`, `admin.bab-shop.com`.
- Staging: `staging.bab-shop.com`, `admin-staging.bab-shop.com`.

Secretos:

- `TURNSTILE_SECRET`
- `TURNSTILE_SECRET_ADMIN`
- `TURNSTILE_SECRET_STORE`

## CORS

El Worker debe aceptar solo origenes esperados:

- Produccion store/admin.
- Staging store/admin.
- Localhost para desarrollo.

No usar `Access-Control-Allow-Origin: *` con credenciales.

## Cookies

Las cookies admin deben:

- Ser `HttpOnly`.
- Ser `Secure` en produccion/staging.
- Usar `SameSite=None` cuando admin y API viven en subdominios distintos.
- Tener expiracion razonable.

## Headers de seguridad

Pages debe servir headers en:

- `apps/store/public/_headers`
- `apps/admin/public/_headers`

Controles esperados:

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`

Si se agrega un nuevo dominio externo, actualizar CSP de store/admin.

## Rate limiting

Protecciones:

- WAF externo para login admin cuando Cloudflare Free lo permite.
- Rate limiting interno en Worker para login, pedidos y mutaciones sensibles.
- KV como soporte de rate limiting.

Documento relacionado:

- `docs/security-waf-rate-limiting.md`

## Auditoria

Acciones admin importantes deben quedar registradas:

- Login.
- Cambios de productos.
- Cambios de imagenes.
- Cambios de pedidos.
- Cambios de promociones.
- Cambios de ajustes.
- Cambios de marcas/modelos.

La auditoria no debe guardar secretos ni contrasenas.

## Backups

Backups en R2:

- Deben ser privados.
- No deben exponerse por `/public`.
- No deben duplicar imagenes pesadas.
- No deben incluir hashes de contrasena admin.

## Reglas operativas

- No subir `.dev.vars`, secrets, SQL temporales o archivos de prueba sensibles.
- No usar tokens de Cloudflare de una cuenta incorrecta.
- No usar claves reales en staging si no es necesario.
- No desplegar si CI falla.
- No ejecutar scripts destructivos sin `--dry-run` y backup.
- No relajar CSP/CORS para resolver rapido sin entender la causa.

## Validacion rapida

Comandos:

```powershell
pnpm typecheck
pnpm test
pnpm build:store
pnpm build:admin
pnpm build:worker
```

URLs:

```powershell
curl https://api.bab-shop.com/health
curl https://api.bab-shop.com/settings/public
```

DevTools:

- Sin errores CORS.
- Sin errores CSP.
- Sin cookies bloqueadas en login admin.
- Sin assets desde dominios no permitidos.
