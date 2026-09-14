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
  assert.match(js, /experience-v6\.css/);
  assert.match(js, /experience-v6\.js/);
  assert.match(css, /100dvh/);
  assert.match(css, /v5MessageIn/);
  assert.match(css, /data-voice-state/);
  assert.match(css, /prefers-reduced-motion/);
});

test('Experience v6 makes the conversation primary and verifies voice activation', async () => {
  const js = await read('experience-v6.js');
  const css = await read('experience-v6.css');
  assert.match(js, /v6-gpt-feel/);
  assert.match(js, /enableVoiceIntent/);
  assert.match(js, /Voz activada\./);
  assert.match(js, /visualViewport/);
  assert.match(css, /message\.assistant/);
  assert.match(css, /background:transparent!important/);
  assert.match(css, /runtime-bar\.v2-runtime\{display:none!important/);
  assert.match(css, /composer/);
});

test('Experience v7 converts static navigation into runtime-backed modules', async () => {
  const js = await read('experience-v7.js');
  const css = await read('experience-v7.css');
  const shell = await read('polish-v2.js');
  assert.match(js, /\/api\/capabilities/);
  assert.match(js, /\/api\/performance/);
  assert.match(js, /\/api\/tasks/);
  assert.match(js, /__waeRuntimeAttachments/);
  assert.match(js, /data-agent/);
  assert.match(js, /iu\.projects/);
  assert.match(css, /\.v7-panel/);
  assert.match(css, /100dvh/);
  assert.match(shell, /experience-v7\.css/);
  assert.match(shell, /experience-v7\.js/);
});

test('Experience v8 makes the primary interface live and exposes bounded Deep orchestration', async () => {
  const js = await read('experience-v8.js');
  const css = await read('experience-v8.css');
  const shell = await read('polish-v2.js');
  const html = await read('index.html');
  const server = await read('server.js');
  assert.match(js, /v8LiveDock/);
  assert.match(js, /iu\.reasoningProfile/);
  assert.match(js, /\/api\/orchestrate/);
  assert.match(js, /Planificando misión/);
  assert.match(js, /wae:stream-event/);
  assert.doesNotMatch(js, /armLiveChatRender/);
  assert.match(css, /\.v8-live-dock/);
  assert.doesNotMatch(css, /mobile-live-render/);
  assert.match(shell, /experience-v8\.css/);
  assert.match(shell, /experience-v8\.js/);
  assert.doesNotMatch(html, /interaction-v9\.js/);
  assert.doesNotMatch(html, /<script src="\.\/experience-v8\.js"/);
  assert.match(server, /\/api\/orchestrate/);
});

test('v23 makes the mobile composer interactive before premium enhancement', async () => {
  const html = await read('index.html');
  const startup = await read('startup-guard-v23.js');
  const progressive = await read('progressive-boot-v23.js');
  assert.match(html, /id="mobileSafeComposer"/);
  assert.match(html, /startup-guard-v23\.js/);
  assert.match(html, /progressive-boot-v23\.js/);
  assert.doesNotMatch(html, /<script src="\.\/polish-v2\.js" defer><\/script>/);
  assert.match(html, /z-index:2147483647/);
  assert.match(html, /font-size:16px/);
  assert.match(startup, /BOOT_TIMEOUT_MS=5000/);
  assert.match(startup, /wae:boot-interactive/);
  assert.match(progressive, /requestIdleCallback/);
  assert.match(progressive, /\.\/polish-v2\.js/);
});

test('PWA v23 serves the app shell cache-first and refreshes in background', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /v23-progressive-boot/);
  assert.match(sw, /startup-guard-v23\.js/);
  assert.match(sw, /progressive-boot-v23\.js/);
  assert.match(sw, /mobile-safe-composer\.js/);
  assert.match(sw, /mobile-safe-composer\.css/);
  assert.match(sw, /if\(cached\)\{event\.waitUntil\(network\);return cached\}/);
  assert.match(sw, /Promise\.allSettled/);
  assert.match(sw, /voice-client\.js/);
  assert.match(sw, /experience-v8\.js/);
  assert.doesNotMatch(sw, /interaction-v9\.js/);
  assert.match(sw, /interaction-guard-v21\.js/);
  assert.match(sw, /polish-v2\.js/);
});
