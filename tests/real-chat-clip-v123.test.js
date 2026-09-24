import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const clipQuestion='¿Puedo crear una especie de GPU con una computadora vieja?';

test('clip regression: long free-provider inference is not aborted after 16 seconds',()=>{
  const app=read('app.js'),client=read('runtime-client.js'),provider=read('lib/providers.js');
  assert.ok(clipQuestion.includes('GPU'));
  assert.match(client,/try\{return await edge\(payload,signal,39000\)\}/);
  assert.match(client,/conversation_id:null\},signal,39000\)/);
  assert.match(app,/setTimeout\(\(\)=>c\.abort\(\),100000\)/);
  assert.match(provider,/attemptTimeoutMs=38000/);
  assert.match(provider,/Math\.min\(40000,Math\.max\(20,Number\(attemptTimeoutMs\)\|\|38000\)\)/);
  assert.match(provider,/Math\.min\(55000,Math\.max\(6000,Number\(budgetMs\)\|\|46000\)\)/);
  assert.match(provider,/AbortSignal\.any\(\[parentSignal,timeout\(ms\)\]\)/);
});

test('recovery indicator names observed provider, never assumes Supabase',()=>{
  const client=read('runtime-client.js');
  assert.match(client,/fallback\.clone\(\)\.json\(\)\.catch\(\(\)=>null\)/);
  assert.match(client,/provider\?'Render · '\+provider:'Render · proveedor no identificado'/);
  assert.doesNotMatch(client,/Render → Supabase capability router/);
  assert.doesNotMatch(client,/primary:err\?\.message/);
  assert.doesNotMatch(client,/fallback:fallbackError\?\.message/);
});

test('updated PWA assets reach Android without changing interface or factory',()=>{
  const html=read('index.html'),sw=read('sw.js');
  for(const piece of ['waewebpublic=v126&recovery=v121&edgefix=v123','app.js?v=121&edgefix=v123']){
    assert.ok(html.includes(piece));
    assert.ok(sw.includes(piece));
  }
  assert.match(sw,/wae-universal-render-waeweb-public-v45-recovery-v121-edgefix-v123/);
  for(const piece of ['canvas-render-factory-v1.js','factory-agent-render-v3.js','workspace-premium-v1.js']){
    assert.ok(html.includes(piece));
  }
});
