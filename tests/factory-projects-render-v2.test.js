import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Render multi-file project factory parses without altering backend or provider routes',()=>{
  const source=read('factory-projects-render-v2.js');
  assert.doesNotThrow(()=>new vm.Script(source));
  assert.match(source,/wae\.render\.factory\.projects\.v1/);
  assert.match(source,/WAECanvasPreparePreview/);
  assert.match(source,/WAECanvasCommit/);
  assert.doesNotMatch(source,/fetch\(|\/api\/chat|\/api\/canvas/);
});
test('Render shell retains premium Canvas before additive multi-file project tab',()=>{
  const html=read('index.html');
  const canvas=html.indexOf('canvas-render-factory-v1.js?v=1');
  const project=html.indexOf('factory-projects-render-v2.js?v=2');
  assert.ok(canvas>=0&&project>canvas);
  assert.match(html,/factory-projects-render-v2\.css\?v=2/);
  assert.match(html,/id="workspace"/);
  assert.match(html,/id="htmlEditor"/);
});
test('existing Canvas generated HTML and undo remain the single owner',()=>{
  const source=read('factory-projects-render-v2.js');
  assert.match(source,/WAECanvasCommit\(html/);
  assert.match(source,/createProject\('Canvas importado'\)/);
  assert.match(source,/setAttribute\('sandbox','allow-scripts'\)/);
  assert.doesNotMatch(source,/allow-same-origin|allow-top-navigation/);
});
test('PWA includes code workspace assets and never caches API responses',()=>{
  const sw=read('sw.js');
  assert.match(sw,/factory-projects-render-v2\.js\?v=2/);
  assert.match(sw,/factory-projects-render-v2\.css\?v=2/);
  assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
});
