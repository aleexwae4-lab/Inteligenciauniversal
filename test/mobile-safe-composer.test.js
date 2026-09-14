import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('mobile safe composer is mounted outside app shell and loads directly',async()=>{
  const html=await read('index.html');
  assert.match(html,/id="mobileSafeComposer"/);
  assert.match(html,/id="mobileSafeInput"/);
  assert.match(html,/\.\/mobile-safe-composer\.css/);
  assert.match(html,/\.\/mobile-safe-composer\.js/);
  const appClose=html.indexOf('</div>\n\n  <form id="mobileSafeComposer"');
  assert.ok(appClose>0,'mobile safe composer must live outside #app shell');
});

test('mobile safe composer bypasses premium hit testing and bridges to native submit',async()=>{
  const css=await read('mobile-safe-composer.css');
  const js=await read('mobile-safe-composer.js');
  assert.match(css,/z-index:2147483647!important/);
  assert.match(css,/pointer-events:auto!important/);
  assert.match(css,/\.drawer:not\(\.open\),\.workspace:not\(\.open\),\.v7-panel:not\(\.open\)/);
  assert.match(js,/mobile-safe-composer\/v22/);
  assert.match(js,/form\.requestSubmit\(\)/);
  assert.match(js,/target\.value=text/);
  assert.match(js,/input\.focus/);
  assert.match(js,/input\.disabled=false/);
  assert.match(js,/input\.readOnly=false/);
});

test('PWA v23 keeps the mobile safe composer in the cache-first core shell',async()=>{
  const sw=await read('sw.js');
  assert.match(sw,/v23-progressive-boot/);
  assert.match(sw,/const CORE=/);
  assert.match(sw,/mobile-safe-composer\.css/);
  assert.match(sw,/mobile-safe-composer\.js/);
  assert.match(sw,/startup-guard-v23\.js/);
  assert.match(sw,/progressive-boot-v23\.js/);
});
