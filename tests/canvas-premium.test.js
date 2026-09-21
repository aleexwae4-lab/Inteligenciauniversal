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
