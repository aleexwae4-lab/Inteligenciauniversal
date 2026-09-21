import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function load(){
 const window={},document={readyState:'loading',addEventListener(){}};
 vm.runInNewContext(read('canvas-premium-v2.js'),{window,document,console});
 return window;
}
test('preview injects a mobile viewport without changing the saved Canvas HTML',()=>{
 const w=load();
 const raw='<!doctype html><html><head><title>Prueba</title></head><body><div>Café</div></body></html>';
 const html=w.WAECanvasPreparePreview(raw);
 assert.match(html,/name="viewport"/);
 assert.match(html,/data-iu-preview="mobile-fallback"/);
 assert.equal(raw.includes('viewport'),false);
 assert.equal(w.WAECanvasPreparePreview(html).match(/name="viewport"/g).length,1);
});
test('Canvas generation requires complete HTML and preserves existing output when incomplete',()=>{
 const w=load();
 const raw='<!doctype html><html lang="es"><head></head><body><h1>Hola</h1></body></html>';
 assert.equal(w.WAECanvasValidateHTML(raw+'\nNota de relleno'),raw);
 assert.equal(w.WAECanvasValidateHTML('<!doctype html><html><body><h1>HTML incompleto'),'');
});
test('Canvas mobile can switch between full-size editing and preview and recover previous content',()=>{
 const code=read('canvas-premium-v2.js'),css=read('workspace-premium-v1.css'),app=read('app.js');
 assert.match(code,/dataset\.iuView/);
 assert.match(code,/WAECanvasTemplates/);
 assert.match(code,/function undo/);
 assert.match(css,/#panel-html\[data-iu-view="preview"\] \.code-pane\{display:none!important\}/);
 assert.match(css,/#panel-html\[data-iu-view="code"\] \.preview-pane\{display:none!important\}/);
 assert.match(app,/WAECanvasRefreshPreview/);
 assert.doesNotMatch(code,/\bconfirm\(/);
});

test('mobile/desktop preview selector overrides legacy fixed iframe width',()=>{
 const js=read('canvas-premium-v2.js'),css=read('workspace-premium-v1.css');
 assert.match(js,/setProperty\('--iu-preview-width'/);
 assert.match(css,/width:var\(--iu-preview-width,100%\)!important/);
});

test('document has THREE explicit rows for toolbar export controls and a flexible sheet',()=>{
 const css=read('workspace-premium-v1.css');
 assert.match(css,/#workspace #panel-document\.active\{[\s\S]*?grid-template-rows:auto auto minmax\(0,1fr\)!important/);
 assert.match(css,/#workspace #panel-document\.active #documentEditor\{[\s\S]*?grid-row:3!important/);
 assert.match(css,/#workspace #panel-document\.active #documentEditor\{[\s\S]*?min-height:0!important/);
});
test('Canvas selected pane fills workspace regardless of device-width breakpoint',()=>{
 const css=read('workspace-premium-v1.css'),js=read('canvas-premium-v2.js');
 assert.match(css,/#workspace #panel-html\[data-iu-view="code"\] \.preview-pane\{display:none!important\}/);
 assert.match(css,/#workspace #panel-html\[data-iu-view="preview"\] \.code-pane\{display:none!important\}/);
 assert.match(js,/Respuesta incompleta; intentando una versión compacta/);
 assert.match(js,/No modifiqué tu HTML/);
});
