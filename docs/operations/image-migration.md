# Migracion y reparacion de imagenes

## Objetivo

Asegurar que todas las imagenes de productos usen variantes optimizadas y que el cliente no descargue originales pesados.

## Variantes esperadas

Cada imagen debe tener:

- `thumb.webp`
- `card.webp`
- `detail.webp`
- `full.webp`

D1 guarda las keys:

- `thumb_r2_key`
- `card_r2_key`
- `detail_r2_key`
- `full_r2_key`

R2 guarda los archivos reales.

## Verificar pendientes en D1

Produccion:

```powershell
npx wrangler d1 execute bap-shop-db --env production --remote --command "SELECT COUNT(*) AS pending FROM product_images WHERE thumb_r2_key IS NULL OR card_r2_key IS NULL OR detail_r2_key IS NULL OR full_r2_key IS NULL;"
```

Staging:

```powershell
npx wrangler d1 execute bap-shop-db-staging --env staging --remote --command "SELECT COUNT(*) AS pending FROM product_images WHERE thumb_r2_key IS NULL OR card_r2_key IS NULL OR detail_r2_key IS NULL OR full_r2_key IS NULL;"
```

Criterio:

- `pending = 0`.

## Migrar imagenes antiguas

Dry-run:

```powershell
pnpm --filter worker migrate:image-variants -- --dry-run --limit 20 --env production --database bap-shop-db --bucket bap-shop-images --assetOrigin https://api.bab-shop.com
```

Ejecucion real:

```powershell
pnpm --filter worker migrate:image-variants -- --limit 20 --env production --database bap-shop-db --bucket bap-shop-images --assetOrigin https://api.bab-shop.com --retries 5 --retryDelayMs 2000
```

Repetir hasta que el script muestre:

```text
Imagenes pendientes totales: 0
```

## Errores temporales de red

Errores como `fetch failed`, `R2 500` o `Unspecified error` suelen ser temporales.

Accion:

1. Volver a ejecutar el comando con `--retries 5`.
2. Usar lotes pequenos con `--limit 10` o `--limit 20`.
3. No editar D1 manualmente si el script puede reintentar.

## Refrescar snapshot de un producto

Si una imagen existe en R2 pero el store muestra imagen rota, refrescar el snapshot del producto:

```powershell
pnpm --filter worker migrate:image-variants -- --refreshProductId PRODUCT_ID --env production --database bap-shop-db --bucket bap-shop-images --assetOrigin https://api.bab-shop.com
```

Staging:

```powershell
pnpm --filter worker migrate:image-variants -- --refreshProductId PRODUCT_ID --env staging --database bap-shop-db-staging --bucket bap-shop-images-staging --assetOrigin https://api-staging.bab-shop.com
```

## Cuando volver a subir una imagen

Volver a subir desde admin si:

- El archivo original o una variante se perdio.
- El snapshot se regenera pero la imagen sigue rota.
- R2 no tiene `thumb.webp`, `card.webp`, `detail.webp` o `full.webp`.
- La imagen quedo corrupta.

La subida nueva desde admin debe generar variantes optimizadas automaticamente.

## No borrar originales antiguos todavia

Si quedaron originales pesados no referenciados en R2, no borrarlos hasta cumplir:

- `pending = 0`.
- Catalogo y detalle funcionan.
- Hay backup reciente.
- Existe script seguro con `--dry-run` para detectar huerfanos.
- Se probo limpieza en staging.

## Validacion en DevTools

En catalogo:

- Deben cargarse imagenes `card.webp`.
- No deben cargarse imagenes de 2 MB a 8 MB.

En carrito/checkout:

- Deben cargarse `thumb.webp`.

En detalle:

- Debe cargarse `detail.webp`.
- `full.webp` solo debe cargarse al abrir el visor ampliado.
