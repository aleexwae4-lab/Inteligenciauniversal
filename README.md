# WAE · Inteligencia Universal

Aplicación mobile-first inspirada en el flujo visual del clip de referencia: chat central, acciones ejecutivas, workspace documental, canvas HTML, panel lateral y centro operativo.

## Ejecutar

No requiere build. Sirve la carpeta raíz con cualquier servidor estático, por ejemplo:

```bash
python3 -m http.server 8080
```

Abre `http://localhost:8080`.

## Incluye

- Chat ejecutivo responsive.
- Acciones rápidas: Investigar, Programar, Analizar y Diseñar.
- Workspace con Documento, Canvas HTML y Planes.
- Editor con guardado local y vista previa HTML.
- Navegación lateral tipo sistema operativo empresarial.
- Indicador de estado operativo.
- Adaptador opcional para conectar un endpoint de IA real desde Configuración.
- PWA instalable (manifest + service worker).

## Conectar IA real

En **Configuración → Endpoint IA** define una URL que acepte `POST` con:

```json
{
  "message": "texto del usuario",
  "mode": "general"
}
```

Y responda:

```json
{
  "reply": "respuesta del modelo"
}
```

Si no hay endpoint configurado, la app usa un motor local de demostración para mantener el flujo de interfaz funcional.

© 2026 WAE OS Enterprise
