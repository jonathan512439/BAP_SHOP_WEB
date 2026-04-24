# Arquitectura de BAP Shop

## Resumen

BAP Shop es un monorepo con tienda publica, panel administrativo y API serverless.

Componentes principales:

- `apps/store`: tienda publica para clientes.
- `apps/admin`: panel administrativo para gestionar catalogo, pedidos, ajustes y promociones.
- `worker`: API sobre Cloudflare Workers.
- `packages/shared`: tipos y constantes compartidas.

Tecnologias principales:

- Vue 3.
- Vite.
- TypeScript.
- Pinia.
- Vue Router.
- Cloudflare Workers.
- Hono como framework HTTP del Worker.
- Cloudflare D1 para datos estructurados.
- Cloudflare R2 para archivos.
- Cloudflare KV para rate limiting y soporte operativo.
- Cloudflare Turnstile para proteccion contra bots.

## Flujo general

Cliente:

1. El usuario entra a `https://bab-shop.com`.
2. El store carga configuracion publica desde `https://api.bab-shop.com/settings/public`.
3. El catalogo se carga desde snapshots publicos servidos por el Worker bajo `/public`.
4. El usuario agrega productos al carrito.
5. Al finalizar checkout, el store crea una orden por API.
6. El producto pasa a reservado y el cliente continua la coordinacion por WhatsApp.

Admin:

1. El admin entra a `https://admin.bab-shop.com`.
2. El login usa Turnstile y credenciales propias.
3. El Worker crea sesion segura por cookie.
4. Cada mutacion admin exige autenticacion, CSRF y rol/permisos.
5. Las acciones sensibles generan auditoria.

Backend:

1. El Worker recibe requests en `https://api.bab-shop.com`.
2. Valida CORS, seguridad, sesion, CSRF, parametros y cuerpo.
3. Lee/escribe datos en D1.
4. Guarda imagenes, snapshots y backups en R2.
5. Usa KV para rate limiting.
6. Ejecuta crons para tareas periodicas.

## D1

D1 guarda datos estructurados:

- Admins.
- Marcas.
- Modelos.
- Productos.
- Imagenes de producto como keys/rutas.
- Pedidos.
- Items de pedidos.
- Ajustes.
- Promociones.
- Auditoria.

D1 no guarda archivos reales ni imagenes binarias.

## R2

R2 guarda archivos:

- Imagenes optimizadas de productos.
- Branding.
- Banner.
- Video de banner.
- Snapshots publicos del catalogo.
- Backups de D1.

Los archivos publicos se sirven a traves del Worker con dominio:

- Produccion: `https://api.bab-shop.com/public`
- Staging: `https://api-staging.bab-shop.com/public`

No se debe depender del dominio `r2.dev` para produccion.

## Imagenes

Cada imagen de producto debe tener variantes:

- `thumb.webp`: miniaturas y carrito.
- `card.webp`: tarjetas de catalogo.
- `detail.webp`: pagina de detalle.
- `full.webp`: visor ampliado.

El cliente no debe descargar originales pesados.

## Snapshots publicos

El catalogo publico se sirve desde snapshots en R2 para reducir carga directa sobre D1.

Archivos importantes:

- `public/manifest.json`
- `public/catalog/index.json`
- `public/catalog/filters.json`
- Snapshots por producto cuando aplique.

Si el catalogo no carga, revisar primero snapshots y CORS del Worker.

## Entornos

Produccion:

- Store: `https://bab-shop.com`
- Admin: `https://admin.bab-shop.com`
- API: `https://api.bab-shop.com`
- D1: `bap-shop-db`
- R2: `bap-shop-images`

Staging:

- Store: `https://staging.bab-shop.com`
- Admin: `https://admin-staging.bab-shop.com`
- API: `https://api-staging.bab-shop.com`
- D1: `bap-shop-db-staging`
- R2: `bap-shop-images-staging`

Staging no debe compartir D1, R2 ni KV con produccion.

## Seguridad base

Medidas aplicadas:

- Cookies de sesion para admin.
- CSRF para mutaciones admin.
- Turnstile en login y flujos publicos sensibles.
- Rate limiting interno en Worker.
- WAF externo en Cloudflare para login admin.
- CSP y headers de seguridad en Pages.
- Logs estructurados sin secretos.
- Auditoria admin.

## Operacion

Documentos relacionados:

- `docs/deployment/cloudflare.md`
- `docs/deployment/ci-cd.md`
- `docs/deployment/staging.md`
- `docs/operations/backups.md`
- `docs/operations/image-migration.md`
- `docs/operations/catalog-rebuild.md`
- `docs/operations/repair-tools.md`
- `docs/operations/performance.md`
- `docs/security.md`
- `docs/troubleshooting.md`
