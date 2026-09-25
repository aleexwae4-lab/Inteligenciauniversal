import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('v143 arms audio synchronously from the trusted submit gesture',()=>{
  const app=read('app.js'),renderer=read('premium-render-v1.js');
  const primeDispatch=app.indexOf("new CustomEvent('wae:voice-prime'");
  const busy=app.indexOf("state.busy=true",primeDispatch);
  assert.ok(primeDispatch>=0&&busy>primeDispatch,'voice prime must happen before async turn work');
  assert.match(renderer,/function primeAudio\(\)/);
  assert.match(renderer,/ctx\.createBuffer\(1,1,/);
  assert.match(renderer,/gain\.gain\.value=0/);
  assert.match(renderer,/window\.addEventListener\('wae:voice-prime'/);
});

test('v143 autostart is driven by the explicit completed assistant event',()=>{
  const app=read('app.js'),renderer=read('premium-render-v1.js');
  assert.match(app,/const assistantArticle=addMessage\('assistant',r\)/);
  assert.match(app,/new CustomEvent\('wae:assistant-final',\{detail:\{article:assistantArticle/);
  assert.match(renderer,/window\.addEventListener\('wae:assistant-final'/);
  assert.match(renderer,/queueMicrotask\(\(\)=>autoSpeakFinal\(article,'assistant-final'\)\)/);
  assert.match(renderer,/voiceEvent\('autostart',\{reason\}\)/);
});

test('v143 autoplay is idempotent and never reads hydrated history',()=>{
  const renderer=read('premium-render-v1.js');
  assert.match(renderer,/article\.dataset\.iuAutoVoice==='started'/);
  assert.match(renderer,/article\.dataset\.iuAutoVoice='started'/);
  assert.match(renderer,/window\.__waeHydratingHistory/);
  assert.match(renderer,/article!==QA\('#messages \.message\.assistant'\)\.at\(-1\)/);
  assert.doesNotMatch(renderer,/if\(allowAuto&&auto&&!window\.__waeHydratingHistory[\s\S]{0,300}speak\(article,b\)/);
});

test('v143 production shell publishes matching autoplay assets to Android PWA cache',()=>{
  const html=read('index.html'),sw=read('sw.js');
  const runtime=html.match(/\.\/runtime-client\.js\?[^"'<>\s]+/)?.[0];
  const premium=html.match(/\.\/premium-render-v1\.js\?[^"'<>\s]+/)?.[0];
  const chunks=html.match(/\.\/speech-chunks\.js\?[^"'<>\s]+/)?.[0];
  assert.ok(runtime&&premium&&chunks);
  assert.match(runtime,/voice=v143/);
  assert.match(premium,/voice=v143/);
  assert.match(chunks,/v=11/);
  assert.ok(sw.includes(runtime));
  assert.ok(sw.includes(premium));
  assert.ok(sw.includes(chunks));
  assert.match(sw,/voice-v143/);
});