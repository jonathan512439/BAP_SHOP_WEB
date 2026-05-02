# Roadmap tecnico para `apps/mobile`

## Objetivo

Agregar una app movil al monorepo actual sin rehacer el backend ni duplicar reglas de negocio.

La meta correcta no es reutilizar componentes web, sino reutilizar:

- contratos de datos
- cliente API
- logica de catalogo
- logica de carrito
- logica de pedido
- branding publico
- reglas de disponibilidad y promociones

## Estado actual util para movil

El proyecto ya tiene una base valida para una app movil:

- `worker`
  - backend central sobre Cloudflare Workers + Hono
  - endpoints publicos y admin
- `packages/shared`
  - tipos compartidos
  - constantes y helpers compartidos
- `apps/store`
  - referencia funcional del flujo cliente
- `apps/admin`
  - panel administrativo web

### Endpoints ya reutilizables

- `GET /settings/public`
- `GET /public/manifest.json`
- `GET /public/catalog/index.json`
- `GET /public/catalog/filters.json`
- `GET /public/products/{id}.json`
- `POST /orders`

### Logica cliente actual que hoy esta demasiado acoplada al store web

- `apps/store/src/stores/catalog.ts`
- `apps/store/src/stores/cart.ts`
- `apps/store/src/stores/branding.ts`
- `apps/store/src/composables/useOrder.ts`
- partes de:
  - `apps/store/src/views/ProductDetailView.vue`
  - `apps/store/src/views/CheckoutView.vue`
  - `apps/store/src/components/PromotionSpotlight.vue`

## Decision de stack movil

La opcion recomendada es:

- `Ionic Vue`
- `Capacitor`
- `Vue Router`
- `Pinia`
- `TypeScript`

Motivo:

- el proyecto ya usa Vue 3
- reduce el costo de entrada
- evita reescribir la UI del cliente en otro framework desde cero
- mantiene el modelo mental del equipo

## Arquitectura objetivo del monorepo

La estructura objetivo debe quedar asi:

```text
apps/
  store/
  admin/
  mobile/
worker/
packages/
  shared/
  client-core/
  client-api/
```

## Regla principal

No mover componentes visuales web a paquetes compartidos.

Si una pieza depende de:

- `localStorage`
- `sessionStorage`
- Vue templates
- clases CSS del store
- router web

entonces no pertenece aun a un paquete compartido.

Lo que si debe extraerse es la logica pura.

## Fase 1 - Crear `packages/client-api`

### Objetivo

Centralizar el acceso HTTP que hoy esta repartido entre `apps/store` y `apps/admin`.

### Carpeta nueva

```text
packages/client-api/
  package.json
  tsconfig.json
  src/
    index.ts
    config.ts
    public-api.ts
    order-api.ts
    types.ts
```

### Responsabilidad

Este paquete debe exponer funciones como:

- `fetchPublicSettings()`
- `fetchCatalogManifest()`
- `fetchCatalogIndex()`
- `fetchCatalogFilters()`
- `fetchProductDetail(productId)`
- `createOrder(payload)`

### Lo que debe salir de `apps/store`

- URLs hardcodeadas basadas en `VITE_API_URL`
- URLs hardcodeadas basadas en `VITE_ASSETS_URL`
- manejo repetido de `fetch`
- parsing repetido de `ApiResponse`

### Requisitos tecnicos

- timeout configurable
- parseo defensivo de JSON
- errores tipados
- cero dependencia de Vue

### Resultado esperado

`apps/store` deja de hacer fetchs directos en catalogo, branding y pedidos.

## Fase 2 - Crear `packages/client-core`

### Objetivo

Extraer la logica cliente que no depende de componentes web.

### Carpeta nueva

```text
packages/client-core/
  package.json
  tsconfig.json
  src/
    index.ts
    catalog/
      normalize-promotion.ts
      filters.ts
      sorting.ts
    cart/
      cart-model.ts
      cart-pricing.ts
    branding/
      branding-model.ts
    order/
      order-payload.ts
      order-errors.ts
    storage/
      storage-adapter.ts
```

### Responsabilidad

Este paquete debe contener:

- normalizacion de promociones expiradas
- reglas para ordenar `active`, `reserved`, `sold`
- helpers de filtros
- calculo de totales del carrito
- transformacion del carrito a payload de pedido
- interfaces de storage

### Lo que debe salir de `apps/store`

- parte de `stores/catalog.ts`
- parte de `stores/cart.ts`
- parte de `composables/useOrder.ts`

### Lo que no debe entrar aqui

- Pinia
- Vue refs
- componentes
- CSS

### Resultado esperado

La logica de negocio del cliente puede ejecutarse desde web o movil sin duplicarse.

## Fase 3 - Introducir una capa de storage abstracta

### Objetivo

Evitar que la logica compartida dependa de `localStorage` o `sessionStorage`.

### Contrato a crear

Archivo:

```text
packages/client-core/src/storage/storage-adapter.ts
```

Interfaz esperada:

```ts
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null> | string | null
  setItem(key: string, value: string): Promise<void> | void
  removeItem(key: string): Promise<void> | void
}
```

### Implementaciones

Web:

- `packages/client-core/src/storage/web-storage.ts`

Movil:

- `apps/mobile/src/platform/capacitor-storage.ts`

### Casos que deben usar esta capa

- carrito persistente
- cache del catalogo
- cache de filtros
- version del manifest
- popup de promociones visto por sesion o persistencia equivalente

## Fase 4 - Adaptar `apps/store` para consumir los nuevos paquetes

### Objetivo

Antes de crear la app movil, el store web debe quedar como primer consumidor de la nueva arquitectura.

### Archivos a tocar

- `apps/store/src/stores/catalog.ts`
- `apps/store/src/stores/cart.ts`
- `apps/store/src/stores/branding.ts`
- `apps/store/src/composables/useOrder.ts`

### Resultado esperado

`apps/store` sigue funcionando igual, pero:

- consume `@bap-shop/client-api`
- consume `@bap-shop/client-core`
- mantiene solo la capa Vue/Pinia/UI

### Criterio de cierre

- `pnpm --filter store build`
- `pnpm test:store`

deben seguir pasando sin regresiones.

## Fase 5 - Crear `apps/mobile`

### Objetivo

Agregar la nueva app movil dentro del mismo monorepo.

### Estructura inicial

```text
apps/mobile/
  package.json
  tsconfig.json
  vite.config.ts
  capacitor.config.ts
  ionic.config.json
  index.html
  src/
    main.ts
    App.vue
    router/
      index.ts
    stores/
      catalog.ts
      cart.ts
      branding.ts
    views/
      HomeView.vue
      CatalogView.vue
      ProductDetailView.vue
      CartView.vue
      CheckoutView.vue
      SuccessView.vue
      FaqView.vue
      PoliciesView.vue
    components/
      ProductCardMobile.vue
      FilterSheet.vue
      BrandingHeader.vue
      PromotionBanner.vue
    platform/
      capacitor-storage.ts
      whatsapp.ts
```

### Comandos base recomendados

Desde raiz:

```powershell
cd D:\Jonathan\Desktop\SOFTWARE\BAP_SHOP-WEB
pnpm create ionic apps/mobile --type vue
cd apps/mobile
pnpm add @capacitor/core @capacitor/cli @capacitor/android
pnpm exec cap init "BAP Shop" "com.bapshop.mobile"
pnpm exec cap add android
```

Nota:

- el scaffold final debe adaptarse al workspace pnpm
- no ejecutar esto en produccion sin revisar package manager y archivos generados

## Fase 6 - Implementar el MVP movil

### Alcance inicial

El MVP movil debe cubrir solo cliente final:

- branding
- catalogo
- filtros
- detalle de producto
- carrito
- checkout
- apertura de WhatsApp
- estados `reservado` y `vendido`
- promociones activas

### No incluir en MVP

- admin movil
- login admin movil
- auditoria admin
- subida de productos

## Fase 7 - Adaptaciones de UX movil

### Objetivo

No portar la web en bruto; crear una experiencia movil real.

### Reglas de UI

- home con secciones compactas
- filtros en sheet o modal inferior
- carrito como vista propia
- checkout con campos grandes y teclado correcto
- CTA de WhatsApp nativo
- imagenes optimizadas con variantes existentes
- manejo claro de offline

### Comportamientos especiales

- abrir WhatsApp con deep link nativo
- detectar conectividad
- usar safe areas
- persistir carrito correctamente

## Fase 8 - Ajustes minimos de backend para movil

### Objetivo

No rehacer el Worker, solo mejorar lo necesario para consumo movil.

### Cambios recomendados

1. Versionar endpoints publicos a futuro:

- `/v1/settings/public`
- `/v1/catalog/manifest`
- `/v1/catalog/index`
- `/v1/catalog/filters`
- `/v1/products/:id`
- `/v1/orders`

2. Mantener los snapshots R2 como fuente publica principal.

3. Si luego el catalogo crece mucho:

- agregar paginacion o feeds por categoria
- agregar endpoint resumido de promociones activas

### Lo que no hace falta cambiar ahora

- D1
- R2
- politica de variantes de imagen
- cron de reservas/promociones

## Fase 9 - Android real

### Objetivo

Probar la app fuera del navegador.

### Pasos

```powershell
cd D:\Jonathan\Desktop\SOFTWARE\BAP_SHOP-WEB\apps\mobile
pnpm build
pnpm exec cap sync android
pnpm exec cap open android
```

### Validaciones minimas

- carga de branding
- carga de catalogo
- promociones visibles
- productos reservados y vendidos
- detalle de producto
- carrito persistente
- checkout
- apertura de WhatsApp
- reconnect despues de perder red

## Fase 10 - Segunda etapa opcional

Solo despues de cerrar el MVP cliente:

- push notifications
- analytics
- crash reporting
- favoritos
- seguimiento de pedido por codigo
- cuentas cliente
- auth movil para admin

## Orden de implementacion recomendado

1. Crear `packages/client-api`
2. Crear `packages/client-core`
3. Adaptar `apps/store`
4. Validar web sin regresiones
5. Crear `apps/mobile`
6. Conectar `apps/mobile` a staging
7. Probar Android
8. Recien despues considerar mejoras del backend movil

## Criterio para no romper el sistema actual

Cada fase debe cerrar con estas validaciones:

```powershell
cd D:\Jonathan\Desktop\SOFTWARE\BAP_SHOP-WEB
pnpm typecheck
pnpm test
pnpm --filter store build
pnpm --filter worker exec tsc --noEmit
```

Y para la app movil, cuando exista:

```powershell
pnpm --filter mobile build
```

## Resultado esperado final

Al terminar este roadmap, el proyecto tendra:

- un solo backend
- una sola base de datos
- una sola logica de negocio
- dos clientes publicos:
  - web
  - movil
- un panel admin web

Sin duplicar:

- productos
- promociones
- branding
- pedidos
- disponibilidad
- reglas del negocio
