import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildResponseEnvelope,RESPONSE_ENVELOPE_VERSION,speechText} from '../lib/response-envelope-v131.js';

test('v131 response envelope exposes safe client actions, speech and verified URLs',()=>{
  const envelope=buildResponseEnvelope({
    reply:'## Resultado\n**Dato** con [fuente](https://example.com/a).',
    sources:[
      {title:'Fuente A',url:'https://example.com/a'},
      {title:'Bloqueada',url:'javascript:alert(1)'},
      {title:'Duplicada',url:'https://example.com/a'}
    ],
    provider:'wae_edge',model:'model-x',latencyMs:321,memory:{recalled:2},tools:[{ok:true}],fallbackFailures:[]
  });
  assert.equal(envelope.schema,RESPONSE_ENVELOPE_VERSION);
  assert.equal(envelope.sources.length,1);
  assert.equal(envelope.sources[0].url,'https://example.com/a');
  assert.deepEqual(envelope.actions.map(x=>x.id),['listen','copy','workspace']);
  assert.match(envelope.speechText,/Resultado/);
  assert.doesNotMatch(envelope.speechText,/https:\/\//);
  assert.equal(envelope.metadata.memoryRecalled,2);
  assert.equal(envelope.metadata.grounded,true);
});

test('v131 speech transcript strips markdown mechanics without inventing content',()=>{
  const spoken=speechText('### Título\n- Uno\n- Dos\n\x60código\x60');
  assert.match(spoken,/Título/);
  assert.match(spoken,/Uno/);
  assert.match(spoken,/Dos/);
  assert.doesNotMatch(spoken,/###|^- /m);
});

test('v131 runtime and browser preserve the native envelope end to end',()=>{
  const runtime=fs.readFileSync(new URL('../lib/runtime.js',import.meta.url),'utf8');
  const chat=fs.readFileSync(new URL('../api/chat.js',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const premium=fs.readFileSync(new URL('../premium-render-v1.js',import.meta.url),'utf8');
  assert.match(runtime,/buildResponseEnvelope/);
  assert.match(runtime,/speech_text:responseEnvelope\.speechText/);
  assert.match(chat,/result\.response\.metadata\.requestId=requestId/);
  assert.match(app,/__waePendingResponseEnvelope/);
  assert.match(premium,/iu-native-sources/);
  assert.match(premium,/dataset\.iuSpeech/);
  assert.match(premium,/wae:assistant-envelope/);
});

test('v131 HTML and service worker publish the exact same envelope assets',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const assets=[
    html.match(/\.\/app\.js\?[^"'<>\s]+/)?.[0],
    html.match(/\.\/premium-render-v1\.js\?[^"'<>\s]+/)?.[0],
    html.match(/\.\/premium-render-v1\.css\?[^"'<>\s]+/)?.[0]
  ];
  for(const asset of assets){
    assert.ok(asset,'current envelope asset missing from HTML');
    assert.ok(sw.includes(asset),asset+' missing from service worker');
  }
  assert.match(assets[0],/envelope=v131/);
  assert.match(assets[1],/envelope=v131/);
  assert.match(sw,/envelope-v131/);
});
