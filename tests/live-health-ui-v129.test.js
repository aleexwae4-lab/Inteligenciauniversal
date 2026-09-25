import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('v129 refreshes visible runtime proof after every completed chat turn',()=>{
  const app=read('app.js');
  assert.match(app,/const r=await getAIReply\(m\);hideTyping\(\);[\s\S]{0,260}void refreshCoreReadiness\(\);/);
  assert.match(app,/const operations=health\.operations\|\|\{\}/);
  assert.match(app,/operations\.lastLatencyMs/);
  assert.match(app,/operations\.inferenceFresh===true/);
  assert.match(app,/Esperando una inferencia generativa real/);
  assert.match(app,/Inferencia real/);
});

test('v129 cache bust guarantees Android and PWA clients receive the live health UI',()=>{
  const html=read('index.html');
  const sw=read('sw.js');
  const appAsset=html.match(/\.\/app\.js\?[^"']+/)?.[0];
  assert.ok(appAsset,'index must reference a versioned app.js');
  assert.ok(sw.includes(appAsset),'service worker must cache the exact current app asset');
  assert.match(sw,/healthui-v129/);
  assert.doesNotMatch(sw,/app\.js\?v=121&edgefix=v123/);
});