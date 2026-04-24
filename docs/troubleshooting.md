# Troubleshooting

## Regla general

Antes de tocar datos:

1. Identificar si el fallo es store, admin, API, D1, R2, CORS, CSP o sesion.
2. Revisar DevTools.
3. Revisar `/health`.
4. Revisar logs del Worker con `requestId`.
5. Si hay riesgo de datos, crear backup.

## API no responde

Validar:

```powershell
curl https://api.bab-shop.com/health
```

Si falla:

- Revisar despliegue del Worker.
- Revisar ruta/dominio `api.bab-shop.com/*`.
- Revisar que el Worker correcto este asociado.
- Revisar logs de Cloudflare Workers.

## Endpoint no encontrado

Respuesta:

```json
{"success":false,"error":"Endpoint no encontrado"}
```

Significa que el Worker esta vivo, pero la ruta no existe.

Accion:

- Revisar URL exacta.
- Para assets publicos usar `/public/...`.
- Para health usar `/health`.

## Catalogo vacio

Revisar:

```powershell
curl https://api.bab-shop.com/public/manifest.json
curl https://api.bab-shop.com/public/catalog/index.json
curl https://api.bab-shop.com/public/catalog/filters.json
```

Si hay 404:

- Reconstruir catalogo con `ops:repair --rebuildCatalog`.
- Reconstruir catalogo con `ops:repair --rebuild-catalog`.
- Revisar `docs/operations/catalog-rebuild.md`.

Si hay CORS:

- Revisar headers del Worker para `/public`.
- Confirmar que el origen sea `https://bab-shop.com` o staging correcto.

Si hay CSP:

- Revisar `_headers` de store/admin.
- Agregar el dominio correcto a `connect-src` o `img-src` segun corresponda.

## Imagen rota

Revisar en R2:

- `thumb.webp`
- `card.webp`
- `detail.webp`
- `full.webp`

Revisar en D1:

```sql
SELECT id, product_id, r2_key, thumb_r2_key, card_r2_key, detail_r2_key, full_r2_key
FROM product_images
WHERE product_id = 'PRODUCT_ID';
```

Acciones:

1. Refrescar snapshot del producto.
2. Reconstruir catalogo.
3. Si sigue rota, volver a subir imagen desde admin.

## Admin no puede iniciar sesion

Revisar DevTools:

- `401` en `/auth/me` antes de login es normal.
- `422` en `/auth/login` indica validacion fallida, Turnstile invalido o credenciales incorrectas.
- Error CORS indica origen no permitido.
- Error CSP indica que admin no puede conectar con API.
- Error de cookie en Safari/incognito suele indicar problema `SameSite=None`/`Secure` o dominio.

En `staging` y `development`, `POST /auth/login` ahora devuelve `debug.code` para diagnostico rapido:

- `turnstile_failed`: token Turnstile invalido.
- `pepper_missing`: secret `ADMIN_PEPPER` no cargado en el Worker del entorno.
- `user_not_found`: username no existe (o no coincide).
- `hash_format_invalid`: `password_hash` en formato invalido.
- `password_mismatch`: usuario existe, pero hash+pepper no coincide con la contrasena enviada.

Revisar:

- `ADMIN_PEPPER` correcto.
- Admin existe en D1.
- Hash corresponde al pepper.
- Turnstile site key y secret corresponden al entorno.
- `ADMIN_DOMAIN` y `STORE_DOMAIN` en Worker.

## Wrangler se cuelga o no encuentra configuracion

Si `Test-Path .\wrangler.jsonc` devuelve `False`, estas en carpeta incorrecta.

Usar:

```powershell
cd D:\Jonathan\Desktop\SOFTWARE\BAP_SHOP-WEB\worker
npx wrangler d1 execute bap-shop-db-staging --env staging --remote --command "SELECT 1;"
```

Si `pnpm exec wrangler` falla pero `npx wrangler` funciona, usar `npx` para diagnostico puntual.

## Migracion D1 dice tabla ya existe

No aplicar `0001_initial.sql` sobre una DB que ya tiene tablas pero no tiene tabla interna de migraciones.

Accion:

- No repetir migraciones a ciegas.
- Revisar `sqlite_master`.
- Revisar historial de migraciones.
- En staging se puede recrear DB si no hay datos importantes.
- En produccion pedir backup antes de cualquier correccion.

## R2 public asset no encontrado

Respuesta:

```json
{"success":false,"error":"Asset no encontrado"}
```

Accion:

- Verificar key exacta en R2.
- Confirmar que el archivo no tiene espacios en URL.
- Confirmar que el bucket del entorno es correcto.
- Confirmar que el Worker staging no apunta a R2 produccion ni viceversa.

## CSP bloquea logo, fuentes o API

Sintoma:

- `blocked:csp`
- `violates Content Security Policy directive`

Accion:

- Para API: revisar `connect-src`.
- Para imagenes: revisar `img-src`.
- Para fuentes Google: revisar `style-src` y `font-src`, o eliminar dependencia externa.
- Para Turnstile: revisar `script-src`, `frame-src` y `connect-src`.

No poner `*` si no es necesario.

## Git push non-fast-forward

Significa que remoto y local tienen commits distintos.

Flujo seguro:

```powershell
git status
git fetch origin
git pull --rebase origin main
git push origin main
```

Si hay conflictos, resolverlos manualmente y continuar:

```powershell
git rebase --continue
```

No usar `git reset --hard` salvo aprobacion explicita.

## CI falla en GitHub

Accion:

1. Leer el job que fallo.
2. Ejecutar el mismo comando local.
3. Corregir.
4. Subir commit nuevo.

Comandos comunes:

```powershell
pnpm typecheck
pnpm test
pnpm build:store
pnpm build:admin
pnpm build:worker
```

## Deploy Worker falla con autenticacion

Error comun:

```text
Authentication failed (code: 9106)
```

Accion:

- Revisar `CLOUDFLARE_API_TOKEN`.
- Revisar `CLOUDFLARE_ACCOUNT_ID`.
- Confirmar permisos del token.
- Confirmar que el token pertenece a la cuenta correcta.

## Despues de cada reparacion

Validar:

- `/health`.
- Store.
- Catalogo.
- Detalle.
- Checkout.
- Admin login.
- Editar producto.
- DevTools sin CORS/CSP.
- Logs sin 500.
