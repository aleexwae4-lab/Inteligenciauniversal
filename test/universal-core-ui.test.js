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
  const server = await read('server.js');
  assert.match(js, /v8LiveDock/);
  assert.match(js, /iu\.reasoningProfile/);
  assert.match(js, /\/api\/orchestrate/);
  assert.match(js, /Planificando misión/);
  assert.match(js, /wae:stream-event/);
  assert.match(css, /\.v8-live-dock/);
  assert.match(css, /data-reasoning-profile/);
  assert.match(shell, /experience-v8\.css/);
  assert.match(shell, /experience-v8\.js/);
  assert.match(server, /\/api\/orchestrate/);
});

test('mobile live chat stays inside the viewport without losing the send control', async () => {
  const js = await read('experience-v8.js');
  const css = await read('experience-v8.css');
  assert.match(js, /armLiveChatRender/);
  assert.match(js, /MutationObserver/);
  assert.match(js, /keepLatestVisible/);
  assert.match(js, /scrollIntoView/);
  assert.match(js, /visualViewport/);
  assert.match(css, /mobile-live-render\/v2/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /max-width:min\(900px,calc\(100vw - 16px\)\)/);
  assert.match(css, /\.iu-answer-actions\{[^}]*overflow-x:auto!important/);
  assert.match(css, /\.send-btn\{[^}]*visibility:visible!important/);
  assert.match(css, /max-height:100dvh!important/);
  assert.match(css, /overflow-x:hidden!important/);
});

test('critical interaction layers are loaded deterministically by the HTML shell', async () => {
  const html = await read('index.html');
  assert.match(html, /<link rel="stylesheet" href="\.\/experience-v8\.css" data-wae-v8="true"/);
  assert.match(html, /<script src="\.\/experience-v8\.js" defer data-src="\.\/experience-v8\.js"><\/script>/);
  assert.match(html, /<script src="\.\/interaction-v9\.js" defer><\/script>/);
  assert.match(html, /<script src="\.\/premium-v4\.js" defer data-src="\.\/premium-v4\.js"><\/script>/);
});

test('interaction v9 repairs a missing send control and exposes recovery for stranded turns', async () => {
  const js = await read('interaction-v9.js');
  assert.match(js, /interaction-v9\/v1/);
  assert.match(js, /ensureSendButton/);
  assert.match(js, /dataset\.sendReady='true'/);
  assert.match(js, /La última solicitud quedó pendiente\./);
  assert.match(js, /Reintentar respuesta/);
  assert.match(js, /requestSubmit\(\)/);
  assert.match(js, /last\.role!==['"]user['"]/);
});

test('PWA cache is invalidated for deterministic mobile interaction release', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /v19-mobile-interaction/);
  assert.match(sw, /voice-client\.js/);
  assert.match(sw, /experience-v7\.js/);
  assert.match(sw, /experience-v8\.js/);
  assert.match(sw, /interaction-v9\.js/);
  assert.match(sw, /polish-v2\.js/);
});
