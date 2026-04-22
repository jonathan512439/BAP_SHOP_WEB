# CI/CD de BAP Shop

## Objetivo

Evitar que codigo roto llegue a produccion y hacer que los despliegues sean repetibles.

## Workflows creados

### `CI`

Archivo:

- `.github/workflows/ci.yml`

Se ejecuta automaticamente en:

- `push` hacia `main`.
- `pull_request` hacia `main`.

Valida:

- Typecheck de store, admin y worker.
- Tests de worker.
- Tests de store.
- Tests de admin.
- Build de store.
- Build de admin.
- Build/typecheck del worker.

### `Deploy Worker`

Archivo:

- `.github/workflows/deploy-worker.yml`

Se ejecuta manualmente desde GitHub Actions con `Run workflow`.

Antes de desplegar:

- Instala dependencias con lockfile.
- Ejecuta typecheck del Worker.
- Ejecuta tests del Worker.
- Si todo pasa, ejecuta `wrangler deploy --env production`.

## Secretos necesarios en GitHub

Para que `Deploy Worker` funcione, crear estos secretos en GitHub:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Ruta:

1. GitHub repo.
2. `Settings`.
3. `Secrets and variables`.
4. `Actions`.
5. `New repository secret`.

El token de Cloudflare debe ser un API Token de usuario, no una Global API Key ni el ID del token.

Permisos recomendados para este proyecto:

- `User` > `User Details` > `Read`
- `User` > `Memberships` > `Read`
- `Account` > `Account Settings` > `Read`
- `Account` > `Workers Scripts` > `Edit`
- `Account` > `Workers KV Storage` > `Edit`
- `Account` > `Workers R2 Storage` > `Edit`
- `Account` > `D1` > `Edit`
- `Zone` > `Workers Routes` > `Edit`

Recursos:

- Account Resources: incluir la cuenta donde vive `bab-shop.com`.
- Zone Resources: incluir `bab-shop.com`.

Si GitHub Actions muestra `Authentication failed (code: 9106)` en `/memberships`, el token esta mal copiado, vencido, pertenece a otra cuenta o no tiene `User > Memberships > Read`.

## Proteccion recomendada de `main`

Ruta:

1. GitHub repo.
2. `Settings`.
3. `Branches`.
4. `Add branch protection rule`.
5. Branch name pattern: `main`.
6. Activar `Require status checks to pass before merging`.
7. Seleccionar el check `Validate codebase`.

Opcional, pero recomendable:

- Activar `Require a pull request before merging`.
- Activar `Require branches to be up to date before merging`.

## Cloudflare Pages

Si store y admin estan conectados a Cloudflare Pages desde GitHub:

- Produccion debe apuntar solamente a `main`.
- Las variables de entorno deben estar configuradas en Cloudflare Pages, no en el repositorio.
- El build de Pages solo deberia ocurrir despues de subir cambios a `main`.

Variables actuales esperadas:

- Store: `VITE_API_URL=https://api.bab-shop.com`
- Store/Admin: `VITE_ASSETS_URL=https://api.bab-shop.com/public`
- Store: `VITE_SITE_URL=https://bab-shop.com`

## Regla operativa

No desplegar manualmente a produccion si `CI` esta fallando en GitHub.

Para despliegue manual local de emergencia:

```powershell
cd D:\Jonathan\Desktop\SOFTWARE\BAP_SHOP-WEB
pnpm typecheck
pnpm test
pnpm build:store
pnpm build:admin
pnpm build:worker
cd worker
pnpm exec wrangler deploy --env production
```
