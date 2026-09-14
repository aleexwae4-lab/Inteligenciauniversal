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

test('PWA cache is invalidated for the Universal Core voice release', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /wae-universal-v13-core-voice/);
  assert.match(sw, /voice-client\.js/);
  assert.match(sw, /polish-v2\.js/);
});
