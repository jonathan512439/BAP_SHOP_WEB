# BAP_SHOP Production Checklist

## Estado tecnico actual

- `worker` typecheck: OK
- `worker` tests: OK
- `apps/admin` typecheck: OK
- `apps/admin` tests: OK
- `apps/store` typecheck: OK
- `apps/store` tests: OK

## Validacion rapida local

Ejecutar desde la raiz del monorepo:

```powershell
pnpm validate
```

O, por bloque:

```powershell
pnpm typecheck
pnpm test
pnpm test:admin
pnpm test:worker
pnpm test:store
```

## Cloudflare

- Crear D1 de produccion.
- Ejecutar migraciones de produccion.
- Ejecutar seeds de produccion.
- Crear bucket R2 de produccion.
- Confirmar dominio publico de assets en R2.
- Configurar secretos:
  - `ADMIN_PEPPER`
  - `TURNSTILE_SECRET`
- Confirmar `STORE_DOMAIN`, `ADMIN_DOMAIN`, `R2_PUBLIC_DOMAIN` y bindings en `wrangler.toml`.

## Storefront

- Verificar `VITE_API_URL` para produccion.
- Verificar `VITE_ASSETS_URL` para produccion si no se usa el dominio default.
- Verificar `VITE_TURNSTILE_SITE_KEY` para produccion.
- Verificar `VITE_STORE_WHATSAPP_NUMBER` si se usa en footer.
- Confirmar que snapshots existen:
  - `public/manifest.json`
  - `public/catalog/index.json`
  - `public/catalog/filters.json`
  - `public/products/{id}.json`

## Admin

- Crear usuario admin real.
- Cambiar la contraseña inicial.
- Verificar login, logout y expiracion de sesion.
- Verificar CSRF en mutaciones desde panel.
- Validar alta/edicion de productos, marcas, modelos y promociones.

## Catalogo y pedidos

- Confirmar que al activar un producto aparece en tienda.
- Confirmar que al ocultarlo desaparece del catalogo.
- Confirmar que una promocion modifica snapshots.
- Confirmar paginacion y filtros compartibles por URL en `/zapatillas` y `/otros`.
- Confirmar que un pedido reserva productos.
- Confirmar que cancelar pedido los libera.
- Confirmar que confirmar pedido los marca como `sold`.
- Confirmar que el cron expira pedidos pendientes.

## Seguridad

- Revisar CORS solo para dominios esperados.
- Revisar cookies con `Secure`, `SameSite=Strict` y dominio de admin.
- Confirmar que uploads de imagen rechazan MIME invalido y archivos > 5MB.
- Confirmar que R2 no tiene escritura publica.
- Configurar reglas basicas de WAF en Cloudflare.

## Operacion

- Confirmar backup semanal a `R2/backups/YYYY-MM-DD.json`.
- Confirmar limpieza de sesiones por cron.
- Confirmar expiracion de promociones por cron.
- Configurar alertas de errores en Cloudflare.

## Smoke test final

- Login admin correcto.
- Crear producto draft.
- Subir imagen.
- Activar producto.
- Ver producto en `/zapatillas` o `/otros`.
- Probar detalle de producto y estado `ya en carrito`.
- Agregar al carrito.
- Hacer checkout.
- Verificar mensaje de cambios de precio si aplica.
- Abrir WhatsApp con codigo de pedido.
- Confirmar pedido desde admin.
- Revisar auditoria.
