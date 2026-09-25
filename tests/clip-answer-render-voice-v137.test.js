import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {speechText} from '../lib/response-envelope-v131.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function loadRich(){
  const source=read('premium-render-v1.js');
  const first=source.indexOf('function inline(value){');
  const last=source.indexOf('function rawOf(article)');
  assert.ok(first>=0&&last>first);
  const section=source.slice(first,last);
  const context={
    text:v=>String(v==null?'':v),
    esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  };
  vm.runInNewContext(section+';this.rich=rich;',context);
  return context.rich;
}

test('v137 renders model <br> as a real line break while escaping every other HTML tag',()=>{
  const rich=loadRich();
  const html=rich('| Área | Indicadores clave |\n|---|---|\n| Comunicación | culpa.<br>Cambia de tema.<BR/>Presiona para decidir. <img src=x onerror=alert(1)> |');
  assert.match(html,/culpa\.<br>Cambia de tema\.<br>Presiona para decidir\./);
  assert.doesNotMatch(html,/&lt;br/i);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html,/<img\b/i);
});

test('v137 keeps ordered steps continuous when bullet details appear between them',()=>{
  const rich=loadRich();
  const raw=[
    '1. **Detén la reacción inmediata**',
    '- Respira y aléjate.',
    '',
    '1. **Analiza la intención**',
    '- Pregúntate qué gana la otra persona.',
    '',
    '1. **Verifica los hechos**',
    '- Contrasta la información.'
  ].join('\n');
  const html=rich(raw);
  assert.match(html,/<ol><li><strong>Detén la reacción inmediata<\/strong><\/li><\/ol>/);
  assert.match(html,/<ol start="2"><li><strong>Analiza la intención<\/strong><\/li><\/ol>/);
  assert.match(html,/<ol start="3"><li><strong>Verifica los hechos<\/strong><\/li><\/ol>/);
});

test('v139 TTS removes markdown table separators and sentence dots before playback',()=>{
  const raw=[
    '| Área | Estado |',
    '|---|---|',
    '| Voz | Activa. |',
    '| Calidad | Premium. |'
  ].join('\n');
  const spoken=speechText(raw);
  assert.doesNotMatch(spoken,/\|/);
  assert.doesNotMatch(spoken,/-{2,}/);
  assert.doesNotMatch(spoken,/(^|\s)\.(?=\s|$)/);
  assert.doesNotMatch(spoken,/---/);
  assert.match(spoken,/Voz/);
  assert.match(spoken,/Premium/);
});

test('v137 TTS normalization never speaks literal br markup',()=>{
  const spoken=speechText('El interlocutor te culpa.<br>Cambia de tema.<br/>Te presiona.');
  assert.doesNotMatch(spoken,/<br/i);
  assert.equal(spoken.includes('Cambia de tema'),true);
  assert.equal(spoken.includes('Te presiona'),true);
});

test('v141 voice UI stays preparing until a real audio route starts',()=>{
  const source=read('premium-render-v1.js');
  assert.match(source,/button\.textContent='◌';button\.title='Generando voz natural'/);
  assert.match(source,/function setPlaying\(button,route/);
  assert.match(source,/source\.start\(0\)/);
  assert.match(source,/utter\.onstart=\(\)=>\{[\s\S]*?setPlaying\(button,'browser'/);
  assert.match(source,/utter\.volume=1/);
  assert.match(source,/code:'start_timeout'/);
  assert.match(source,/setTimeout\(\(\)=>\{[\s\S]*?2800\)/);
  const preparing=source.indexOf("button.textContent='◌';button.title='Generando voz natural'");
  const cloudStart=source.indexOf("source.start(0)");
  const browserStart=source.indexOf("utter.onstart=()=>");
  const cloudCall=source.indexOf("cloudPlayback(content,button,token,prefs)");
  assert.ok(preparing>=0&&cloudStart>=0&&browserStart>=0&&cloudCall>preparing);
});

test('v137 voice fallback cannot duplicate an already-started response',()=>{
  const source=read('premium-render-v1.js');
  assert.match(source,/if\(token!==voice\.token\|\|voice\.started\)return/);
  assert.match(source,/voice\.completedChunks===0&&!voice\.fallbackAttempted/);
  assert.match(source,/if\(voice\.active===article&&!voice\.started\)\{resetVoice\(\);return\}/);
});

test('v137 PWA publishes the same premium renderer asset as HTML',()=>{
  const html=read('index.html'),sw=read('sw.js');
  const asset=html.match(/\.\/premium-render-v1\.js\?[^"'<>\s]+/)?.[0];
  assert.ok(asset);
  assert.match(asset,/render=v137/);
  assert.ok(sw.includes(asset),asset+' missing from service worker');
  assert.match(sw,/answer-v137/);
});


test('v141 voice uses authenticated natural audio first and browser synthesis as recovery',()=>{
  const runtime=read('runtime-client.js');
  const renderer=read('premium-render-v1.js');
  assert.match(runtime,/wae-natural-voice-v60/);
  assert.match(runtime,/window\.WAEVoiceRuntime=Object\.freeze/);
  assert.match(runtime,/contentType/);
  assert.match(renderer,/function cloudPlayback\(/);
  assert.match(renderer,/ctx\.decodeAudioData/);
  assert.match(renderer,/createBufferSource\(\)/);
  assert.match(renderer,/cloud_to_browser/);
  assert.match(renderer,/function browserPlayback\(/);
  assert.match(renderer,/document\.addEventListener\('pointerdown',unlockAudio/);
});
