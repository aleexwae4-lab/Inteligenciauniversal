# WAE · Inteligencia Universal

PWA mobile-first con chat, Workspace y un runtime server-side para orquestar modelos, herramientas, memoria y agentes.

## Universal Runtime v1

La app usa `/api/chat` por defecto. El runtime detecta únicamente integraciones realmente configuradas y nunca marca como disponible un proveedor sin credenciales.

### Proveedores soportados

- OpenAI Responses API (`OPENAI_API_KEY`, modelo por defecto `gpt-5.6-sol`).
- Anthropic Messages API (`ANTHROPIC_API_KEY`, modelo por defecto `claude-sonnet-5`).
- Gemini (`GEMINI_API_KEY`, modelo por defecto `gemini-3.8-flash`).
- xAI Responses API (`XAI_API_KEY`, modelo por defecto `grok-4.6`).
- OpenRouter (`OPENROUTER_API_KEY` + `OPENROUTER_MODEL`).

Si `provider=auto`, el runtime intenta los proveedores configurados en orden y registra fallos de fallback sin interrumpir toda la sesión cuando otro proveedor puede responder.

### Tool Fabric

- `web_search`: búsqueda web cuando `TAVILY_API_KEY` está configurada.
- `github_search`: búsqueda de código cuando `GITHUB_TOKEN` está configurado. Puedes indicar `repo:owner/name` en la misión o definir `DEFAULT_GITHUB_REPO`.

Las herramientas actuales son de solo lectura. Las acciones mutables deben añadirse con permisos explícitos y confirmación separada.

### Agentes

- `general` — Universal Core.
- `research` — investigación y verificación.
- `code` — ingeniería y debugging.
- `analysis` — análisis estratégico y riesgos.
- `design` — producto y UX.
- `executive` — coordinación C-level.

Los modos existentes de la interfaz (`Investigar`, `Programar`, `Analizar`, `Diseñar`) seleccionan estos agentes automáticamente.

### Memoria persistente

Con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, cada turno se guarda en `universal_memory` y se recupera con búsqueda full-text en español por `user_key`.

Ejecuta `supabase/migrations/001_universal_memory.sql` en tu proyecto Supabase antes de activar las variables.

### Endpoints

- `POST /api/chat` — conversación multimodelo.
- `POST /api/tasks` — ejecución síncrona de una misión con agente.
- `GET /api/health` — estado real de proveedores, herramientas y memoria.
- `GET /api/capabilities` — inventario de capacidades y agentes.

## Variables de entorno

Copia `.env.example` en tu gestor de secretos de Vercel. No subas claves al repositorio.

Para producción, configura al menos un proveedor IA. Para habilitar capacidades adicionales, agrega Tavily, GitHub y Supabase según se necesiten.

## Cliente

`runtime-client.js` conecta la PWA al backend, mantiene un `sessionId` por dispositivo, envía el historial reciente y permite adjuntar hasta cinco archivos de texto/código (máximo 120 kB por archivo) como contexto de la misión.

Si el runtime no tiene proveedores configurados o está temporalmente caído, la interfaz conserva el fallback local existente para no bloquear la UX.

## PWA

El Service Worker usa caché de shell para la interfaz, pero excluye `/api/*` para evitar cachear estados o respuestas de IA.

© 2026 WAE OS Enterprise
