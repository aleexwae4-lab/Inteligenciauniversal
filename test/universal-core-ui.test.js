import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('base interface exposes Universal Core as the sole intelligence identity', async () => {
  const html = await read('index.html');
  assert.match(html, /WAE OS Enterprise · Universal Core/);
  assert.match(html, />Universal Core</);
  assert.doesNotMatch(html, />AI Center</i);
  assert.doesNotMatch(html, /Endpoint IA/i);
  assert.doesNotMatch(html, /Conectar inteligencia real/i);
  assert.doesNotMatch(html, /Inteligencia Universal/i);
});

test('premium shell disables the legacy voice channel before natural voice loads', async () => {
  const js = await read('polish-v2.js');
  assert.match(js, /localStorage\.setItem\('wae\.autoVoice','false'\)/);
  assert.match(js, /state\.autoVoice=false/);
  assert.match(js, /cloneNode\(true\)/);
  assert.match(js, /load\('\.\/voice-client\.js'/);
});

test('dynamic runtime chrome cannot expose model or provider identity', async () => {
  const js = await read('polish-v2.js');
  assert.match(js, /enforceRuntimeIdentity/);
  assert.match(js, /allowedMeta/);
  assert.match(js, /Universal Core · \$\{phase\}/);
  assert.match(js, /<small>WAE OS<\/small>/);
});

test('voice client falls back to audible browser speech when cloud TTS fails', async () => {
  const js = await read('voice-client.js');
  assert.match(js, /speechSynthesis/);
  assert.match(js, /SpeechSynthesisUtterance/);
  assert.match(js, /cloudBackoffUntil/);
  assert.match(js, /playBrowser/);
  assert.match(js, /es-MX/);
  assert.match(js, /iu\.voiceEnabled/);
  assert.match(js, /wae\.autoVoice/);
});

test('Experience v5 provides live voice state and responsive interaction layer', async () => {
  const js = await read('experience-v5.js');
  const css = await read('experience-v5.css');
  assert.match(js, /wae:voice-state/);
  assert.match(js, /v5-live-status/);
  assert.match(js, /v5-degraded/);
  assert.match(js, /scrollHeight/);
  assert.match(css, /100dvh/);
  assert.match(css, /v5MessageIn/);
  assert.match(css, /data-voice-state/);
  assert.match(css, /prefers-reduced-motion/);
});

test('PWA cache is invalidated for the Experience v5 voice release', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /wae-universal-v14-experience-voice/);
  assert.match(sw, /voice-client\.js/);
  assert.match(sw, /experience-v5\.js/);
  assert.match(sw, /experience-v5\.css/);
  assert.match(sw, /polish-v2\.js/);
});
