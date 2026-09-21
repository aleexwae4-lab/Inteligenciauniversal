import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANVAS_ENGINE_VERSION,
  canvasKind,
  extractCanvasHtml,
  auditCanvas,
  hardenCanvasHtml,
} from '../lib/canvas-engine-v1.js';

const validHtml = '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui}@media(max-width:600px){body{padding:1rem}}</style></head><body><main><h1>Cafetería de especialidad</h1><section>Producto real</section></main></body></html>' + ' '.repeat(1800);

test('canvas supports landing, presentation, dashboard and app intent', () => {
  assert.equal(CANVAS_ENGINE_VERSION, 'universal-canvas-creation/v1');
  assert.equal(canvasKind('Crea una landing para café'), 'landing');
  assert.equal(canvasKind('Una presentación ejecutiva'), 'presentation');
  assert.equal(canvasKind('Necesito un dashboard de negocio'), 'dashboard');
  assert.equal(canvasKind('Crea un prototipo de aplicación'), 'app');
});

test('extracts whole HTML from fenced provider responses', () => {
  const fence=String.fromCharCode(96).repeat(3);
  const result = extractCanvasHtml(fence+'html\n' + validHtml + '\n'+fence+'\ntexto sobrante');
  assert.ok(result.startsWith('<!doctype html>'));
  assert.ok(result.includes('</html>'));
  assert.ok(!result.includes('texto sobrante'));
});

test('rejects incomplete placeholder-like output and accepts responsive complete HTML', () => {
  assert.equal(auditCanvas('<html>hola</html>').pass, false);
  assert.equal(auditCanvas(validHtml).pass, true);
  assert.equal(auditCanvas(validHtml,'presentation').pass, false);
});

test('removes externally loaded scripts and embeds while retaining inline script for slides', () => {
  const candidate=validHtml.replace('</head>', '<script src="https://example.com/x.js"></script></head>')
    .replace('</main>','<iframe src="https://example.com"></iframe><script>document.title="Demo";</script></main>');
  const safe=hardenCanvasHtml(candidate);
  assert.ok(safe.includes('Content-Security-Policy'));
  assert.ok(!safe.includes('example.com'));
  assert.ok(safe.includes('document.title="Demo"'));
});
