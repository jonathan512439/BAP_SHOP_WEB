# Backups y recuperacion

## Objetivo

Mantener copias recuperables de los datos criticos de D1 sin duplicar archivos pesados de R2 ni crecer sin control.

## Que se respalda

El backup operativo de D1 incluye:

- `admins`
- `brands`
- `models`
- `products`
- `product_images`
- `product_promotions`
- `orders`
- `order_items`
- `settings`
- `audit_log`

Notas importantes:

- Las imagenes reales no se guardan dentro del backup de D1.
- `product_images` guarda solo rutas/keys hacia R2.
- Los hashes de contrasena de `admins` se omiten por seguridad.
- Si se restaura desde backup, el usuario admin debe recrearse o resetearse con un hash nuevo.

## Donde se guardan

Los backups se guardan en R2:

```text
backups/d1/YYYY-MM-DDTHH-MM-SS-sssZ.json
```

El bucket debe mantenerse privado. No se debe habilitar escritura publica ni exponer `backups/` desde rutas publicas.

## Retencion

Politica definida:

- Backups diarios: conservar 7 dias.
- Backups semanales: conservar 4 semanas.
- Backups mensuales: opcional, no activo por ahora.

El cron semanal usa la logica de retencion para eliminar backups antiguos bajo `backups/d1/`.

## Backup automatico

El Worker ejecuta backup semanal con cron:

```text
0 4 * * SUN
```

Archivo relacionado:

```text
worker/src/cron.ts
worker/src/lib/backups.ts
```

## Backup manual antes de despliegues

Desde la raiz del proyecto:

```powershell
pnpm --filter worker backup:d1 -- --dry-run --env production --database bap-shop-db --bucket bap-shop-images
```

Si el dry-run no muestra errores, ejecutar el backup real:

```powershell
pnpm --filter worker backup:d1 -- --env production --database bap-shop-db --bucket bap-shop-images
```

El comando real sube el JSON a:

```text
R2 / backups/d1/
```

## Verificacion manual en Cloudflare

1. Entrar a Cloudflare Dashboard.
2. Ir a `R2`.
3. Abrir el bucket `bap-shop-images`.
4. Entrar a la carpeta `backups/d1/`.
5. Confirmar que existe el archivo `.json` con fecha reciente.
6. Confirmar que el bucket no tenga escritura publica.
7. Confirmar que no existe una ruta publica del Worker que exponga `backups/`.

## Restauracion basica

Restaurar automaticamente aun no esta implementado.

Procedimiento seguro por ahora:

1. Descargar el backup JSON desde R2.
2. Crear una D1 de staging o restauracion.
3. Revisar el contenido del backup.
4. Reinsertar primero tablas base:
   - `brands`
   - `models`
   - `products`
   - `product_images`
   - `settings`
5. Reinsertar tablas transaccionales si corresponde:
   - `orders`
   - `order_items`
   - `product_promotions`
   - `audit_log`
6. Recrear o resetear admin con:

```powershell
pnpm --filter worker hash-password
```

7. Regenerar snapshots del catalogo.
8. Probar store/admin antes de apuntar trafico real.

## Reglas

- No restaurar directo sobre produccion sin probar en staging.
- No borrar backups recientes manualmente.
- No guardar backups dentro de D1.
- No guardar imagenes duplicadas dentro del backup de D1.
- No exponer `backups/` por URLs publicas.
