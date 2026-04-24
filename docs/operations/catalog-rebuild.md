# Reconstruccion de catalogo publico

## Objetivo

Reparar o regenerar los snapshots publicos del catalogo cuando el store no muestra productos, filtros o imagenes correctamente.

## Archivos esperados en R2

Snapshots principales:

```text
public/manifest.json
public/catalog/index.json
public/catalog/filters.json
```

Tambien pueden existir snapshots por producto.

## Sintomas

Reconstruir o revisar catalogo si:

- El store muestra catalogo vacio pero D1 tiene productos activos.
- DevTools muestra 404 en `/public/manifest.json`.
- DevTools muestra 404 en `/public/catalog/index.json`.
- DevTools muestra 404 en `/public/catalog/filters.json`.
- Los filtros no coinciden con productos reales.
- Un producto editado no se refleja despues del tiempo normal de cron.
- Una reserva no se refleja en el catalogo.

## Diagnostico read-only

Produccion:

```powershell
pnpm --filter worker ops:health -- --env production --database bap-shop-db --bucket bap-shop-images
```

Staging:

```powershell
pnpm --filter worker ops:health -- --env staging --database bap-shop-db-staging --bucket bap-shop-images-staging
```

## Marcar catalogo como pendiente

Dry-run:

```powershell
pnpm --filter worker ops:repair -- --dry-run --mark-catalog-dirty --env production --database bap-shop-db --bucket bap-shop-images --asset-origin https://api.bab-shop.com
```

Ejecucion real:

```powershell
pnpm --filter worker ops:repair -- --mark-catalog-dirty --env production --database bap-shop-db --bucket bap-shop-images --asset-origin https://api.bab-shop.com
```

El cron de produccion procesa el catalogo pendiente.

## Reconstruir catalogo inmediatamente

Dry-run:

```powershell
pnpm --filter worker ops:repair -- --dry-run --rebuild-catalog --env production --database bap-shop-db --bucket bap-shop-images --asset-origin https://api.bab-shop.com
```

Ejecucion real:

```powershell
pnpm --filter worker ops:repair -- --rebuild-catalog --env production --database bap-shop-db --bucket bap-shop-images --asset-origin https://api.bab-shop.com
```

Staging:

```powershell
pnpm --filter worker ops:repair -- --rebuild-catalog --env staging --database bap-shop-db-staging --bucket bap-shop-images-staging --asset-origin https://api-staging.bab-shop.com
```

## Validar archivos por URL

Produccion:

```powershell
curl https://api.bab-shop.com/public/manifest.json
curl https://api.bab-shop.com/public/catalog/index.json
curl https://api.bab-shop.com/public/catalog/filters.json
```

Staging:

```powershell
curl https://api-staging.bab-shop.com/public/manifest.json
curl https://api-staging.bab-shop.com/public/catalog/index.json
curl https://api-staging.bab-shop.com/public/catalog/filters.json
```

Cada URL debe responder JSON, no HTML y no 404.

## Validar en store

1. Abrir DevTools.
2. Activar `Disable cache`.
3. Abrir `/zapatillas`.
4. Revisar Network.
5. Confirmar que `manifest.json`, `index.json` y `filters.json` responden 200.
6. Confirmar que no hay CORS ni CSP bloqueando.

## Reglas

- No editar snapshots manualmente salvo emergencia.
- Preferir `ops:repair --rebuild-catalog`.
- No usar R2 publico directo para el store.
- Si falla en produccion, probar el mismo reparador en staging para confirmar causa.
