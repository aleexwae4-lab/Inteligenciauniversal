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
servidor al navegador del usuario. Las rutas tienen protección de origen y
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
clave correspondiente (server-only). **No usar NEXT_PUBLIC_**.

## Operación
Prueba local aislada: `npm run test:waeweb-connect`. Un resultado
de CI PASS verifica contrato de cliente, no URL Render ni proveedor
externo en vivo. No fusionar ni habilitar hasta verificar cada runtime
y los controles de lanzamiento de WAEWEB.
