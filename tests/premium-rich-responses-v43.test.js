import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('desktop loads semantic rich renderer and premium visual layer',()=>{
  const html=read('index.html');
  assert.match(html,/premium-v5\.css\?v=43/);
  assert.match(html,/premium-v4\.js\?v=43/);
  assert.match(html,/premium-v5\.js\?v=43/);
});

test('mobile injects premium response assets without replacing the stable runtime',()=>{
  const server=read('server.js');
  assert.match(server,/premium-v5\.css\?v=43/);
  assert.match(server,/premium-v5\.js\?v=43/);
  assert.match(server,/universal-core-mobile-v34-adaptive-mesh/);
  assert.match(server,/universal-core-rich-v43/);
  assert.match(server,/mobile-runtime-v34\.js\?v=34/);
});

test('premium CSS supports semantic hierarchy, tables, metrics, charts and reduced motion',()=>{
  const css=read('premium-v5.css');
  for(const token of ['.iu-metric','.iu-progress','.wae-table-shell','.wae-code-shell','.iu-chart','.iu-answer-actions','@media(prefers-reduced-motion:reduce)'])assert.ok(css.includes(token),`missing ${token}`);
  assert.doesNotMatch(css,/@import\s+url|fonts\.googleapis|http:\/\/|https:\/\//i);
});

test('premium enhancer adds functional copy affordances and observes streamed responses',()=>{
  const js=read('premium-v5.js');
  assert.match(js,/Copiar código/);
  assert.match(js,/Copiar tabla/);
  assert.match(js,/MutationObserver/);
  assert.match(js,/waePremiumRich/);
  assert.doesNotMatch(js,/eval\(|new Function\(/);
});

test('premium enhancer is valid JavaScript',()=>{
  const file=fileURLToPath(new URL('../premium-v5.js',import.meta.url));
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
