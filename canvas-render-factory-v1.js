/* Render Canvas Factory v1: additive, no UI replacement or cross-edition deployment. */
(() => {
  'use strict';
  if (window.WAERenderCanvasFactory) return;
  const $ = selector => document.querySelector(selector);
  let busy = false;
  function status(message, error=false) {
    const el = $('#iuCanvasStatus');
    if (el) { el.textContent = message; el.dataset.error = error ? 'true' : 'false'; }
  }
  function validPrior(value) {
    return /^\s*<!doctype\s+html/i.test(value) && value.length <= 100000;
  }
  async function persistBeforeCommit(html, before) {
    if (window.WAEStorage) {
      await window.WAEStorage.ready;
      if (before && before !== html) await window.WAEStorage.save('canvas_factory_previous', before);
      await window.WAEStorage.save('html', html);
      if (await window.WAEStorage.load('html') !== html) throw Error('No se verificó el archivo en IndexedDB.');
    } else {
      if (before && before !== html) localStorage.setItem('wae.render.canvas.previous', before);
      localStorage.setItem('wae.html', html);
      if (localStorage.getItem('wae.html') !== html) throw Error('No se verificó el archivo en este dispositivo.');
    }
  }
  async function build() {
    if (busy) return;
    const brief = ($('#iuCanvasBrief')?.value || '').trim();
    const kind = $('#iuCanvasType')?.value || 'landing';
    const refining = $('#iuCanvasOperation')?.value === 'refine';
    const previous = $('#htmlEditor')?.value || '';
    if (brief.length < 8) return status('Describe el objetivo, el público y el producto (mínimo ocho caracteres).', true);
    if (refining && !validPrior(previous)) return status('Abre un HTML5 completo de hasta 100 KB para perfeccionarlo.', true);
    const button = $('#iuCanvasGenerate');
    busy = true;
    if (button) { button.disabled = true; button.textContent = 'Construyendo…'; }
    status('Consejo experto → producto HTML → QA estructural. El Canvas anterior permanece intacto hasta validar.');
    try {
      const response = await fetch('/api/canvas', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify({
          request: brief,
          kind: kind === 'slides' ? 'presentation' : kind === 'prototype' ? 'app' : kind === 'blank' ? 'landing' : kind,
          brand: '',
          baseHtml: refining ? previous : ''
        }),
        signal: AbortSignal.timeout(110000)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.html || result.quality?.structural !== 'passed') {
        throw Error(result.message || 'La generación no pasó el control de calidad.');
      }
      if (($('#htmlEditor')?.value || '') !== previous) {
        throw Error('El editor cambió mientras trabajaban los especialistas; no sobrescribí tus cambios.');
      }
      if (typeof window.WAECanvasCommit !== 'function') throw Error('El editor Canvas no completó su inicialización.');
      await persistBeforeCommit(result.html, previous);
      window.WAECanvasCommit(result.html, 'Producto creado y guardado; validación estructural aprobada.');
      status((result.revision ? 'Producto perfeccionado' : 'Producto creado') +
        ' · HTML verificado y archivado · ' + (result.experts?.length || 0) +
        ' responsabilidades ejecutadas. Revisa los controles y el diseño en dispositivos reales antes de publicar.');
    } catch (error) {
      status('Conservé el Canvas anterior. '+ String(error.message || 'Error de conexión.'), true);
    } finally {
      busy = false;
      if (button) { button.disabled = false; button.textContent = '✦ Generar producto premium'; }
    }
  }
  function init() {
    const button = $('#iuCanvasGenerate');
    const field = $('#iuCanvasBrief');
    if (!button || !field || button.dataset.waeFactory === '1') return;
    button.dataset.waeFactory = '1';
    button.textContent = '✦ Generar producto premium';
    // The legacy handler is a property (onclick), not an addEventListener.
    button.onclick = build;
    // Capture Ctrl/Cmd+Enter before the legacy shortcut can start a second generation.
    field.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        event.stopImmediatePropagation();
        build();
      }
    }, true);
    const controls = $('#iuCanvasControls');
    const explainer = document.createElement('small');
    explainer.id = 'iuCanvasFactoryNote';
    explainer.textContent = 'Fábrica profesional: dirección estratégica, color, UX, frontend y QA. Crear, perfeccionar, deshacer y exportar.';
    controls?.appendChild(explainer);
    status('Listo para crear un producto original o perfeccionar el actual.');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
  window.WAERenderCanvasFactory = {build,version:'render-canvas-factory/v1'};
})();