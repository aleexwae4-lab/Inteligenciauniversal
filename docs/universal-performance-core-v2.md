# Universal Performance Core v2

Universal Core no promueve una ruta por nombre, intuición o marketing. La promoción requiere evidencia productiva.

## Gates

- Candidate error-rate <= control error-rate.
- Candidate P95 debe mejorar al menos 5% frente a control.
- Mínimo 20 respuestas OK por variante en la ventana evaluada.
- Streaming sólo se considera listo cuando existe al menos un transporte verificado, HEALTHY, CLOSED y con EWMA TTFT <= 2500 ms.
- Fast lane requiere al menos una ruta server-side HEALTHY, CLOSED y EWMA <= 3000 ms.

## Fail-closed

Si el endpoint de rendimiento o Supabase no están disponibles, el cliente mantiene `control`, streaming desactivado y continuidad existente.

## Identidad pública

El rendimiento se expone como telemetría de Universal Core. La UI no necesita mostrar proveedores ni modelos internos.
