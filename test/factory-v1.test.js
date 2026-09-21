import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(path,'utf8');
test('factory client is valid JavaScript and does not modify chat runtime',()=>{
  const src=read('factory-v1.js');
  assert.doesNotThrow(()=>new vm.Script(src,{filename:'factory-v1.js'}));
  assert.match(src,/wae\.factory\.projects\.v1/);
  assert.match(src,/data\.format!=='wae-factory\/v1'/);
  assert.doesNotMatch(src,/\/api\/chat|fetch\(/);
});
test('Render enterprise shell has the factory; premium shell remains isolated',()=>{
  const enterprise=read('ui/enterprise/index.html');
  const premium=read('index.html');
  assert.match(enterprise,/factory-v1\.css\?v=1/);
  assert.match(enterprise,/factory-v1\.js\?v=1/);
  assert.match(enterprise,/id="workspace"/);
  assert.doesNotMatch(premium,/factory-v1\.(?:js|css)/);
});
test('mobile shell exposes explicit factory entry without replacing native chat',()=>{
  const src=read('api/mobile.js');
  assert.match(src,/id="sheetFactory"/);
  assert.match(src,/desktop=1&amp;wae_factory=1/);
  assert.match(src,/id="composer"/);
});
test('preview sandbox never gets same-origin or top navigation permissions',()=>{
  const src=read('factory-v1.js');
  assert.match(src,/setAttribute\('sandbox','allow-scripts'\)/);
  assert.match(src,/sandbox="allow-scripts"/);
  assert.doesNotMatch(src,/allow-same-origin|allow-top-navigation/);
});
