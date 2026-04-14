# Roadmap App Android + Web Compartiendo Backend

## Objetivo

Mantener en paralelo:

- Store web
- Admin web
- App Android

Compartiendo una sola fuente de verdad para:

- productos
- stock
- promociones
- branding
- pedidos
- ajustes globales
- reglas del negocio

La base recomendada es:

- Cloudflare como backend principal
- Firebase solo como complemento móvil

## Principio de arquitectura

La app Android no debe tener una lógica de negocio separada del sitio web.

Todo cambio hecho desde el admin debe reflejarse en:

- web cliente
- web admin
- app Android

Esto implica:

- una sola base de datos
- un solo backend principal
- múltiples clientes consumiendo el mismo sistema

## Arquitectura propuesta

### Cloudflare como fuente de verdad

- `Cloudflare Worker`
  - reglas de negocio
  - validaciones
  - endpoints públicos
  - endpoints admin
- `D1`
  - productos
  - pedidos
  - promociones
  - settings
  - sesiones admin
- `R2`
  - imágenes
  - branding
  - snapshots públicos
- `Cron`
  - expiración de reservas
  - expiración de promociones
  - housekeeping

### Clientes del sistema

- `Store web`
- `Admin web`
- `App Android`

### Firebase como complemento

Usar Firebase solo para:

- `FCM` notificaciones push
- analítica móvil
- crash reporting

No usar Firebase como fuente principal de:

- productos
- stock
- pedidos
- promociones
- branding

## Qué se queda en Cloudflare

Estas piezas deben seguir centralizadas en el backend actual:

- catálogo
- estados de producto
- precios
- promociones
- branding
- reservas
- expiración
- pedidos
- ajustes globales
- auditoría

## Qué puede hacer Firebase

Firebase sí puede aportar valor en:

- notificaciones push de promos
- avisos de nuevo stock
- avisos de reserva por vencer
- analítica de uso móvil
- crash reporting

Firebase no debe duplicar la lógica principal del negocio.

## Roadmap por fases

## Fase 1. Consolidación del backend reutilizable

### Objetivo

Dejar claro qué partes del backend actual sirven como base común para web y app.

### Tareas

- inventariar endpoints públicos y admin ya existentes
- documentar contratos de respuesta
- separar claramente lo web-only de lo reutilizable
- validar qué ajustes globales deben exponerse a app
- revisar puntos débiles actuales:
  - auth admin con cookies + CSRF
  - Turnstile acoplado a web
  - snapshots públicos sin paginación
  - checkout final por WhatsApp

### Resultado esperado

Un backend claramente definido como fuente única de verdad para todos los clientes.

## Fase 2. Diseñar una API móvil real

### Objetivo

Evitar que la app dependa de la lógica interna de la web.

### Tareas

Diseñar o preparar endpoints con enfoque móvil:

- `GET /catalog`
  - paginación
  - filtros server-side
  - búsqueda
  - orden
- `GET /products/:id`
- `GET /settings/public`
- `POST /orders`

Endpoints futuros recomendados:

- `GET /orders/:id`
- `GET /orders/by-code/:code`
- `GET /catalog/updates`

### Resultado esperado

La app consume una API pensada para móviles y no depende de descargar snapshots completos en cada caso.

## Fase 3. Rediseñar autenticación para móvil

### Objetivo

Resolver la limitación actual de login web-only.

### Problema actual

Hoy el login admin depende de:

- cookies
- CSRF
- Turnstile
- contexto navegador

Eso es incómodo para una app nativa.

### Tareas

- diseñar auth basada en tokens
- separar auth web de auth móvil si hace falta
- definir:
  - access token
  - refresh token
  - expiración
  - revocación
- mantener compatibilidad con el admin web actual mientras se migra

### Resultado esperado

La app Android podrá autenticarse de forma robusta sin depender del flujo de cookies del navegador.

## Fase 4. MVP de la app Android cliente

### Objetivo

Lanzar una primera app útil sin reescribir todo el sistema.

### Alcance recomendado

- home
- branding
- catálogo
- detalle de producto
- carrito local
- checkout
- apertura de WhatsApp
- productos agotados visibles
- promociones visibles

### Lo que debe compartir con web

- disponibilidad
- stock
- branding
- promociones
- precios
- estado de productos

### Resultado esperado

Una app Android funcional que reutiliza el backend actual sin duplicar datos.

## Fase 5. Integración Firebase como complemento móvil

### Objetivo

Agregar valor específico para app móvil.

### Tareas

- integrar `FCM`
- definir eventos de push
- integrar analytics
- integrar crash reporting

### Eventos de notificación sugeridos

- nueva promoción
- producto nuevo
- producto repuesto
- reserva por vencer
- pedido confirmado

### Resultado esperado

La app gana capacidades móviles reales sin partir la arquitectura del backend.

## Fase 6. Mejorar el flujo de compra

### Objetivo

Reducir la dependencia operativa del flujo puramente manual por WhatsApp.

### Tareas

- exponer consulta de estado de pedido
- permitir seguimiento básico por código
- agregar historial simple del cliente si luego existe cuenta cliente
- evaluar pago integrado a futuro

### Resultado esperado

La web y la app comparten un flujo de compra más fuerte y menos manual.

## Fase 7. Escalabilidad y robustez

### Objetivo

Preparar el sistema para más catálogo, más tráfico y más operación.

### Tareas

- mejorar estrategia de catálogo público
- reducir rebuilds completos
- mejorar observabilidad
- revisar rate limiting
- separar mejor storage público y backups
- fortalecer autenticación admin

### Resultado esperado

Una base más estable para crecer sin romper consistencia entre web y app.

## Qué no hacer

Evitar:

- duplicar productos en Firestore y D1
- duplicar pedidos en dos backends
- mover branding a dos fuentes distintas
- implementar reglas distintas entre web y app
- usar Firebase como segundo backend principal sin una estrategia clara

## Prioridades recomendadas

### Prioridad alta

- API móvil real
- auth móvil
- seguimiento básico de pedidos

### Prioridad media

- FCM
- analytics
- mejoras de catálogo

### Prioridad posterior

- cuentas cliente
- historial
- pagos integrados
- experiencia más avanzada en app

## Resumen ejecutivo

La estrategia recomendada es:

- `Cloudflare` como backend principal y fuente de verdad
- `Web store`, `web admin` y `app Android` compartiendo datos y reglas
- `Firebase` solo como apoyo móvil

Esta arquitectura permite crecer sin duplicar lógica de negocio ni romper consistencia entre canales.
