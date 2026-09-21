import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('v117 is additive to the existing Vercel shell and keeps production transports',async()=>{
  const html=await read('index.html');
  assert.match(html,/premium-shell-v117\.css\?v=117/);
  assert.match(html,/premium-shell-v117\.js\?v=117/);
  assert.match(html,/runtime-client\.js/);
  assert.match(html,/premium-v4\.js/);
  assert.match(html,/productivity-v59\.js/);
  assert.doesNotMatch(html,/¿Qué quieres construir hoy\?/);
});
test('no static first assistant message contaminates fresh or restored chats',async()=>{
  const app=await read('app.js');
  assert.doesNotMatch(app,/state\.messages=\[\{role:'assistant',text:'\*\*Sistema listo/);
  assert.match(app,/^\s*function renderMessages\(\).*state\.messages\.forEach\(renderMessage\)/m);
  assert.match(app,/Sistema listo/); // legacy migration
});
test('v117 has real voice, copy, workspace and evidence controls, not fabricated sources',async()=>{
  const js=await read('premium-shell-v117.js');
  const css=await read('premium-shell-v117.css');
  assert.match(js,/__waeVoice\?\.toggle/);
  assert.match(js,/wae:voice-state/);
  assert.match(js,/data-act="copy"/);
  assert.match(js,/data-act="workspace"/);
  assert.match(js,/Fuentes \('/);
  assert.match(js,/if\(sources\)/);
  assert.match(js,/wae117CoreBadge/);
  assert.match(js,/new MutationObserver\(schedule\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/overflow-wrap:anywhere/);
  assert.match(css,/overscroll-behavior-x:contain/);
});
test('structured responses and sources survive secondary markdown enhancer',async()=>{
  const js=await read('gpt-experience-v1.js');
  assert.match(js,/!body\.classList\.contains\('rich-content'\)/);
  assert.match(js,/!\$\('\.iu-sources',node\)/);
  assert.doesNotMatch(js,/node\.scrollIntoView\(\{block:'end',behavior:'smooth'\}\)/);
});
test('premium voice preference is not reset on each page load',async()=>{
  const polish=await read('polish-v2.js');
  assert.doesNotMatch(polish,/localStorage\.setItem\('wae\.autoVoice','false'\)/);
  assert.match(polish,/state\.autoVoice=false/);
});