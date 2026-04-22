# Fase 3: WAF y rate limiting

## Objetivo

Reducir abuso, fuerza bruta y trafico automatizado antes de que llegue al Worker, sin bloquear usuarios reales.

El sistema usa dos capas:

- Worker: rate limiting por KV a nivel de aplicacion.
- Cloudflare WAF: barrera externa antes de consumir CPU, D1, R2 o KV.

## Rate limits implementados en Worker

Archivo principal:

- `worker/src/middleware/rate-limit.ts`

Presets actuales:

- `login`: 5 errores cada 15 minutos por IP.
- `publicOrders`: 10 intentos de pedido cada 1 hora por IP.
- `passwordChange`: 5 errores cada 15 minutos por admin o IP.
- `adminMutation`: 120 mutaciones admin cada 15 minutos por admin o IP.
- `imageUpload`: 30 subidas de imagen cada 5 minutos por admin o IP.
- `brandingUpload`: 15 subidas de branding cada 5 minutos por admin o IP.

Rutas protegidas:

- `POST /auth/login`
- `PATCH /auth/password`
- `POST /orders`
- Mutaciones admin de productos.
- Mutaciones admin de marcas y modelos.
- Mutaciones admin de promociones.
- Mutaciones admin de pedidos.
- Mutaciones admin de ajustes.
- Subida de imagenes de productos.
- Subida de logo, banners y video de branding.

## Reglas recomendadas en Cloudflare

Estas reglas deben configurarse en el panel de Cloudflare del dominio.

Ruta sugerida:

1. Cloudflare Dashboard.
2. Selecciona el dominio `bab-shop.com`.
3. Security.
4. WAF.
5. Rate limiting rules.
6. Create rule.

### Regla 1: login admin

Nombre:

```text
BAP API - login admin
```

Expression:

```text
(http.host eq "api.bab-shop.com" and http.request.uri.path eq "/auth/login" and http.request.method eq "POST")
```

Configuracion sugerida:

- Characteristics: IP.
- Period: 10 minutes.
- Requests: 10.
- Mitigation: Block.
- Duration: 10 minutes.

Motivo:

El login ya tiene Turnstile y rate limit interno. Esta regla evita fuerza bruta antes de llegar al Worker.

### Regla 2: checkout publico

Nombre:

```text
BAP API - checkout publico
```

Expression:

```text
(http.host eq "api.bab-shop.com" and http.request.uri.path eq "/orders" and http.request.method eq "POST")
```

Configuracion sugerida:

- Characteristics: IP.
- Period: 10 minutes.
- Requests: 20.
- Mitigation: Block.
- Duration: 10 minutes.

Motivo:

Evita spam de pedidos. No usar challenge aqui, porque es una llamada `fetch` desde el checkout y una pagina de challenge romperia el flujo del cliente.

### Regla 3: mutaciones admin

Nombre:

```text
BAP API - mutaciones admin
```

Expression:

```text
(http.host eq "api.bab-shop.com" and starts_with(http.request.uri.path, "/admin/") and http.request.method in {"POST" "PUT" "PATCH" "DELETE"})
```

Configuracion sugerida:

- Characteristics: IP.
- Period: 10 minutes.
- Requests: 150.
- Mitigation: Block.
- Duration: 10 minutes.

Motivo:

El admin es de uso humano. 150 mutaciones cada 10 minutos es amplio para operacion real, pero bloquea loops, automatizaciones accidentales o abuso.

### Regla 4: subida de assets pesados

Nombre:

```text
BAP API - uploads admin
```

Expression:

```text
(http.host eq "api.bab-shop.com" and http.request.method eq "POST" and (http.request.uri.path contains "/images" or http.request.uri.path contains "/assets/"))
```

Configuracion sugerida:

- Characteristics: IP.
- Period: 5 minutes.
- Requests: 40.
- Mitigation: Block.
- Duration: 10 minutes.

Motivo:

Las subidas consumen mas ancho de banda y R2. Esta regla reduce abuso sin afectar uso normal.

## Notas importantes

- Para endpoints API, usar `Block` es mas predecible que `Managed Challenge`.
- No aplicar challenge a `/orders`, porque el cliente no vera bien el challenge dentro de una llamada `fetch`.
- No aplicar reglas agresivas a `GET /public/...`, porque son imagenes, snapshots y assets del catalogo.
- Si un admin queda bloqueado por error, bajar temporalmente la severidad o esperar la duracion configurada.
- Mantener Turnstile activo en login y checkout. WAF no reemplaza Turnstile.

## Verificacion despues de configurar Cloudflare

1. Iniciar sesion normalmente en `https://admin.bab-shop.com/login`.
2. Editar un producto.
3. Subir una imagen pequena de prueba.
4. Crear un pedido desde el store.
5. Confirmar que no hay errores 403/429 en flujos normales.
6. Revisar Cloudflare Security Events para confirmar que las reglas no bloquean trafico legitimo.

## Criterio de cierre

- Worker compila.
- Tests criticos pasan.
- Reglas WAF creadas en Cloudflare.
- Login normal funciona.
- Checkout normal funciona.
- Mutaciones admin normales funcionan.
- No hay bloqueos falsos en operacion normal.
