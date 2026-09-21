import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CANVAS_ENGINE_VERSION,
  canvasKind,
  extractCanvasHtml,
  auditCanvas,
  hardenCanvasHtml,
  createPremiumCanvas,
} from '../lib/canvas-engine-v1.js';

const validHtml = '<!doctype html><html lang="es"><head><title>Cafetería</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui}@media(max-width:600px){body{padding:1rem}}</style></head><body><main><h1>Cafetería de especialidad</h1><section>Producto real</section></main></body></html>' + ' '.repeat(1800);

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


test('production QA rejects apparent complete files that contain dead CTAs or external dependencies', () => {
  assert.equal(auditCanvas(validHtml.replace('</main>', '<a href="#">Comprar</a></main>')).checks.noPlaceholders, false);
  assert.equal(auditCanvas(validHtml.replace('</main>', '<img src="https://example.org/photo.png"></main>')).checks.noExternalDependencies, false);
  assert.equal(auditCanvas(validHtml.replace('Cafetería', 'Lorem ipsum')).checks.noPlaceholders, false);
});

test('security hardening removes external resource loading and strips embeds', () => {
  const candidate=validHtml.replace('</main>','<section>'+'Contenido auténtico. '.repeat(150)+'</section></main>')
    .replace('</head>', '<link rel="stylesheet" href="https://example.org/style.css"><style>@import url(https://example.org/a.css);</style></head>')
    .replace('</main>', '<object data="x"></object><embed src="https://example.org/x"></main>');
  const safe=hardenCanvasHtml(candidate);
  assert.ok(!safe.includes('example.org'));
  assert.ok(!safe.includes('<object'));
  assert.ok(!safe.includes('<embed'));
  assert.equal(auditCanvas(safe).pass,true);
});


test('real creation pipeline executes three expert briefs and builder, then reports only executed experts', async () => {
  const artifact = validHtml.replace('</main>', '<section>'+'Contenido comercial veraz. '.repeat(90)+'</section></main>');
  const calls=[];
  const result=await createPremiumCanvas({
    request:'Crea una landing profesional para una cafetería de especialidad',
    kind:'landing',
    brand:'Café Central',
    generate:async ({message})=>{
      calls.push(message);
      return {text: message.includes('Encargo original:') ? artifact : 'Brief profesional: foco en clientes, UX responsive y oferta honesta.'};
    }
  });
  assert.equal(calls.length,4);
  assert.equal(result.kind,'landing');
  assert.equal(result.title,'Café Central');
  assert.equal(result.quality.structural,'passed');
  assert.equal(result.quality.repaired,false);
  assert.equal(result.experts.length,5);
  assert.ok(result.html.includes('Content-Security-Policy'));
});

test('broken output gets one QA repair instead of being released to users', async () => {
  let calls=0;
  const artifact=validHtml.replace('</main>', '<section>'+'Diseño sólido. '.repeat(150)+'</section></main>');
  const result=await createPremiumCanvas({
    request:'Genera una landing útil para turismo local',
    generate:async ()=>{
      calls++;
      return {text: calls<=3?'Brief especializado':calls===4?'<html>incompleto</html>':artifact};
    }
  });
  assert.equal(calls,5);
  assert.equal(result.quality.repaired,true);
  assert.equal(result.quality.structural,'passed');
});

test('unrepairable output fails closed without returning a fake artifact', async () => {
  await assert.rejects(
    createPremiumCanvas({
      request:'Construye una landing que pueda usar ya',
      generate:async ({message})=>({text:message.includes('Encargo original:')?'<html>roto</html>':'Brief'})
    }),
    error=>error.code==='canvas_quality_gate_failed' && error.statusCode===422
  );
});


test('iterative refinement sends existing HTML to the builder without replacing the revision contract', async () => {
  const calls=[];
  const generated = await createPremiumCanvas({
    request:'Refina la paleta y conserva los controles de mi cafetería',
    kind:'landing',
    baseHtml:validHtml,
    generate:async ({message})=>{
      calls.push(message);
      return {text:message.includes('Encargo original:')?validHtml:'Brief de diseño estratégico y QA'};
    }
  });
  assert.equal(generated.revision,true);
  assert.equal(generated.quality.structural,'passed');
  assert.equal(calls.length,4);
  assert.ok(calls[3].includes('MODO REVISIÓN'));
  assert.ok(calls[3].includes('HTML ACTUAL'));
  await assert.rejects(createPremiumCanvas({request:'Refina este diseño',baseHtml:'<html>roto</html>',generate:async()=>({text:validHtml})}),error=>error.code==='invalid_canvas_revision');
});

test('desktop and native mobile expose revision, rollback and export controls', () => {
  const desktop=readFileSync(new URL('../canvas-creation-v1.js',import.meta.url),'utf8');
  const mobile=readFileSync(new URL('../canvas-native-mobile-v1.js',import.meta.url),'utf8');
  const api=readFileSync(new URL('../api/canvas.js',import.meta.url),'utf8');
  for(const source of [desktop,mobile]){
    assert.match(source,/baseHtml/);
    assert.match(source,/history/);
    assert.match(source,/\[\.\.\.previous/);
  }
  assert.match(desktop,/waeCanvasRefine/);
  assert.match(mobile,/wncRefine/);
  assert.match(mobile,/wncExport/);
  assert.match(api,/canvas_revision_too_large/);
});

test('premium and enterprise shells mount the additive Canvas layer independently', () => {
  const premium=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const enterprise=readFileSync(new URL('../ui/enterprise/index.html',import.meta.url),'utf8');
  for(const html of [premium,enterprise]){
    assert.match(html,/canvas-creation-v1\.js\?v=1/);
    assert.match(html,/id="htmlEditor"/);
    assert.match(html,/sandbox="allow-scripts"/);
  }
  assert.match(premium,/data-wae-ui="premium"/);
  assert.match(enterprise,/data-wae-ui="enterprise"/);
});

test('Render registers the new Canvas route without diverting main chat', () => {
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.match(server,/\['\/api\/canvas', canvasHandler\]/);
  assert.match(server,/\['\/api\/chat', chatHandler\]/);
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(sw,/canvas-creation-v1\.js/);
  assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
});


test('distinct Render mobile shell mounts a Canvas adapter without replacing its chat transport', () => {
  const page=readFileSync(new URL('../api/mobile.js',import.meta.url),'utf8');
  const adapter=readFileSync(new URL('../canvas-native-mobile-v1.js',import.meta.url),'utf8');
  assert.match(page,/canvas-native-mobile-v1\.js\?v=1/);
  assert.match(page,/form\.addEventListener\('submit'/);
  assert.match(adapter,/fetch\('\/api\/canvas'/);
  assert.match(adapter,/sandbox="allow-scripts"/);
  assert.match(adapter,/wae\.nativeCanvas\./);
  assert.match(adapter,/previousKey\(\)/);
});
