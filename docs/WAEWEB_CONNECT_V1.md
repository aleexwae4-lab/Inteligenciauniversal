# Universal Core ⇄ WAEWEB Connect v1

**Código de integración en rama de desarrollo; desactivado y no desplegado.**
Las rutas originales `/api/web/search`, `/api/web/research`, `/api/web/retrieve`
siguen usando Universal Web Intelligence v2. WAEWEB es un proveedor alternativo explícito.

## Rutas nuevas del backend Universal Core

- `GET /api/waeweb/status` — capacidades reales tras autenticar con WAEWEB.
- `POST /api/waeweb/search` — `{"query":"ejemplo","type":"all","fresh":true}`.
- `POST /api/waeweb/stream` — SSE `ready`, `results/error`, `done`.
- `POST /api/waeweb/retrieve` — lectura pública HTTPS opcional en WAEWEB.

El token de WAEWEB se adjunta **solo en el backend** y nunca pasa del
servidor al navegador del usuario. **Las nuevas rutas NO son públicas**:
se requiere el encabezado `X-WAEWEB-Internal-Token` con una segunda
clave aleatoria en `WAEWEB_CONNECT_INBOUND_TOKEN`, independiente de
`WAEWEB_CONNECT_TOKEN`. Sin ambas claves válidas responden 503/401;
las llamadas originadas desde un navegador quedan rechazadas.
Los orquestadores de confianza que utilicen estas rutas deben llamar desde
servidor e inyectar ese secreto; no colocar esta cabecera en JavaScript
público, tampoco en `NEXT_PUBLIC_*`. Una sesión de usuario por sí sola
no autoriza esta ruta máquina-a-máquina. Las rutas tienen protección de origen y
límites de consumo locales; las cargas malformadas y cambios de protocolo
fallan cerrado. Resultados SSE no son video de Chrome ni navegación remota.

## Despliegues previstos

- `https://inteligenciauniversal.onrender.com/?wae_runtime=36` → id
  `inteligenciauniversal`, **pendiente confirmar servicio → commit en Render**.
- `https://wae-inteligencia-universal-vt3h.onrender.com/` → id
  `universal-core-vt3h`, vinculado al flujo de pruebas de este repositorio.

Ambas ediciones necesitan tokens distintos y variables independientes;
no agregar una sola clave compartida a los dos servicios. Esta rama no
modifica ni despliega los dos sistemas por sí sola.

Variables: `WAEWEB_CONNECT_ENABLED=false` hasta validar backend WAEWEB;
`WAEWEB_CONNECT_BASE_URL` origen HTTPS del futuro backend WAEWEB;
`WAEWEB_CONNECT_CLIENT_ID` según entorno; `WAEWEB_CONNECT_TOKEN`
clave correspondiente (server-only). Configurar además `WAEWEB_CONNECT_INBOUND_TOKEN` (clave distinta y exclusiva del servicio consumidor). **No usar NEXT_PUBLIC_**.

## Operación
Prueba local aislada: `npm run test:waeweb-connect`. Un resultado
de CI PASS verifica contrato de cliente, no URL Render ni proveedor
externo en vivo. No fusionar ni habilitar hasta verificar cada runtime
y los controles de lanzamiento de WAEWEB.

## RC6 — streaming fiable y prueba entre repositorios

Universal Core mantiene el timeout durante todo el SSE, limita la respuesta
recibida a 128 KiB, propaga la cancelación al upstream y convierte las
interrupciones/EOF sin evento `done` en error explícito, sin simular éxito.
Los tests focalizados del conector verifican espera agotada después de cabeceras,
transferencia excesiva y cancelación: [QA PASS](https://github.com/aleexwae4-lab/Inteligenciauniversal/actions/runs/35714792211).

Una prueba del repositorio público WAEWEB obtiene el cliente real de esta rama
y lo ejecuta contra el manejador HTTP real de WAEWEB con fuentes **simuladas**:
[contrato cross-repo PASS](https://github.com/aleexwae4-lab/Waeweb/actions/runs/35714662862).
No demuestra que ningún Render esté conectado ni que la suite general de
Inteligenciauniversal esté verde: las regresiones generales continúan bloqueando
el merge de este PR.
