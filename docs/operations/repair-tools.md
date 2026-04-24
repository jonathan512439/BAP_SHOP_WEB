# Reparadores operativos

Estas herramientas sirven para diagnosticar y reparar problemas comunes sin editar manualmente D1 o R2.

Reglas:

- Ejecuta primero diagnostico.
- Usa `--dry-run` antes de cualquier reparacion.
- En produccion, haz backup antes de reparar estados de pedidos o catalogo.
- No uses reparadores para borrar imagenes antiguas hasta cerrar todo el proceso robusto.

## Diagnostico general

Staging:

```powershell
pnpm --filter worker ops:health -- --env staging --database bap-shop-db-staging --bucket bap-shop-images-staging
```

Produccion:

```powershell
pnpm --filter worker ops:health -- --env production --database bap-shop-db --bucket bap-shop-images
```

Con verificacion de objetos de imagen en R2:

```powershell
pnpm --filter worker ops:health -- --env production --database bap-shop-db --bucket bap-shop-images --checkImages --imageLimit 100
```

El diagnostico revisa:

- Imagenes con variantes faltantes en D1.
- Productos visibles sin imagen principal.
- Pedidos pendientes vencidos.
- Productos reservados ligados a pedidos inexistentes o no pendientes.
- Items de pedidos pendientes cuyos productos no estan reservados por ese pedido.
- Snapshots publicos faltantes en R2.
- Opcionalmente, objetos de imagen faltantes en R2.

## Reparar reservas vencidas

Primero simular:

```powershell
pnpm --filter worker ops:repair -- --dry-run --env production --database bap-shop-db --bucket bap-shop-images --expire-reservations
```

Aplicar:

```powershell
pnpm --filter worker ops:repair -- --env production --database bap-shop-db --bucket bap-shop-images --expire-reservations
```

Efecto:

- Cambia pedidos `pending` vencidos a `expired`.
- Libera productos reservados por esos pedidos.
- Marca el catalogo como pendiente de reconstruccion.

## Reparar reservas inconsistentes

Primero simular:

```powershell
pnpm --filter worker ops:repair -- --dry-run --env production --database bap-shop-db --bucket bap-shop-images --release-invalid-reservations
```

Aplicar:

```powershell
pnpm --filter worker ops:repair -- --env production --database bap-shop-db --bucket bap-shop-images --release-invalid-reservations
```

Efecto:

- Libera productos `reserved` con `reserved_order_id` asociado a un pedido inexistente o no pendiente.
- No libera reservas manuales sin `reserved_order_id`.
- Marca el catalogo como pendiente.

## Reconstruir catalogo publico

Staging:

```powershell
pnpm --filter worker ops:repair -- --dry-run --env staging --database bap-shop-db-staging --bucket bap-shop-images-staging --assetOrigin https://api-staging.bab-shop.com --rebuild-catalog
```

Aplicar en staging:

```powershell
pnpm --filter worker ops:repair -- --env staging --database bap-shop-db-staging --bucket bap-shop-images-staging --assetOrigin https://api-staging.bab-shop.com --rebuild-catalog
```

Produccion:

```powershell
pnpm --filter worker ops:repair -- --dry-run --env production --database bap-shop-db --bucket bap-shop-images --assetOrigin https://api.bab-shop.com --rebuild-catalog
```

Aplicar en produccion:

```powershell
pnpm --filter worker ops:repair -- --env production --database bap-shop-db --bucket bap-shop-images --assetOrigin https://api.bab-shop.com --rebuild-catalog
```

Efecto:

- Regenera `public/manifest.json`.
- Regenera `public/catalog/index.json`.
- Regenera `public/catalog/filters.json`.
- Regenera `public/products/{productId}.json` para productos `active` y `sold`.
- Incrementa `catalog_version`.
- Limpia `catalog_dirty`.

## Marcar catalogo como pendiente

```powershell
pnpm --filter worker ops:repair -- --env production --database bap-shop-db --bucket bap-shop-images --mark-catalog-dirty
```

Efecto:

- Coloca `settings.catalog_dirty = 1`.
- El cron del Worker reconstruira el catalogo en la siguiente ejecucion programada.

## Validacion posterior

Despues de reparar:

```powershell
pnpm --filter worker ops:health -- --env production --database bap-shop-db --bucket bap-shop-images
```

Luego revisar:

- `https://api.bab-shop.com/public/manifest.json`
- `https://api.bab-shop.com/public/catalog/index.json`
- `https://api.bab-shop.com/public/catalog/filters.json`
- `https://bab-shop.com/zapatillas`

