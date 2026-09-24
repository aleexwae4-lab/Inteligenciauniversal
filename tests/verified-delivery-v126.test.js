import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifiedDeliveryEventsV126,VERIFIED_DELIVERY_VERSION} from '../supabase/functions/wae-local-voice-demo-v61/verified-delivery-v126.js';

const edge=readFileSync(new URL('../supabase/functions/wae-local-voice-demo-v61/index-v63.ts',import.meta.url),'utf8');
const stream=edge.match(/function chatStream\([\s\S]*?\n\s*Deno\.serve/)?.[0]||edge.slice(edge.indexOf('function chatStream('));
const models=edge.slice(edge.indexOf('async function executeModels('),edge.indexOf('async function chatJson('));

test('events send the same canonical persisted answer, and only after final verification',()=>{
  const approved={content:'Respuesta validada.'};
  const events=verifiedDeliveryEventsV126(approved,text=>'Voz: '+text);
  assert.deepEqual(events,[
    {event:'content.delta',data:{text:'Respuesta validada.'}},
    {event:'speech.delta',data:{text:'Voz: Respuesta validada.'}},
  ]);
  assert.deepEqual(verifiedDeliveryEventsV126({content:''},()=> 'voice'),[]);
  assert.equal(VERIFIED_DELIVERY_VERSION,'wae-verified-delivery/v126');
});

test('structured JSON is delivered as text without raw JSON read aloud',()=>{
  const events=verifiedDeliveryEventsV126({content:'{"project":"ZEPHYR"}'},()=>{throw Error('voice must not run')},true);
  assert.deepEqual(events,[{event:'content.delta',data:{text:'{"project":"ZEPHYR"}'}}]);
});

test('streaming does not send unverified raw token or speech deltas',()=>{
  assert.match(edge,/import \{verifiedDeliveryEventsV126\} from '\.\/verified-delivery-v126\.js'/);
  assert.match(stream,/const run=await executeModels\(db,ctx,true,signal\);/);
  assert.doesNotMatch(stream,/send\('content\.delta',\{text:delta\}\)/);
  assert.doesNotMatch(stream,/send\('speech\.delta',\{text:spoken\}\)/);
  const persisted=stream.indexOf('const fin=await finalize(');
  const delivered=stream.indexOf('verifiedDeliveryEventsV126(fin.response');
  const completed=stream.indexOf("send('response.complete'");
  assert.ok(persisted>0&&delivered>persisted&&completed>delivered);
  assert.match(stream,/delivery_mode:'validated_complete',content_verified_before_delivery:true/);
});

test('a provider that fails after partial tokens cannot be marked as an accepted full answer',()=>{
  assert.doesNotMatch(models,/if\(partial\.trim\(\)/);
  assert.doesNotMatch(models,/generated=\{text:partial\.trim\(\)/);
  assert.match(models,/for\(const m of ctx\.ranked\.slice\(0,6\)\)/);
  assert.match(models,/failures\.push\(/);
});
