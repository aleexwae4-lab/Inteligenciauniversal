import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localContinuityFallback,emergencyProviderRegistry,EMERGENCY_GENERATION_VERSION} from '../lib/emergency-generation-v49.js';

test('v49 locally answers the exact third-turn question from the production clip',()=>{
  const reply=localContinuityFallback('Tu crees que el desarrollador de universal core eleve la reputación de una universidad?');
  assert.ok(reply);
  assert.match(reply,/reputaci[oó]n|prestigio/i);
  assert.match(reply,/universidad/i);
  assert.doesNotMatch(reply,/no pude|respuesta incompleta|reintenta|continuity/i);
});

test('v49 has a useful local opinion fallback instead of continuity_pass_through',()=>{
  const reply=localContinuityFallback('¿Tú crees que sería buena idea integrar este proyecto en una universidad?');
  assert.ok(reply);
  assert.match(reply,/posibilidad|valor|evidencia|impacto/i);
  assert.doesNotMatch(reply,/no pude|fallo|proveedor/i);
});

test('OpenRouter emergency route does not require a separately configured model',()=>{
  const rows=emergencyProviderRegistry({OPENROUTER_API_KEY:'test'});
  assert.deepEqual(rows,[{id:'openrouter_direct',model:'openrouter/free'}]);
});

test('Groq emergency route has a current free-capable default model',()=>{
  const rows=emergencyProviderRegistry({GROQ_API_KEY:'test'});
  assert.equal(rows[0]?.id,'groq_direct');
  assert.equal(rows[0]?.model,'openai/gpt-oss-20b');
});

test('capacity wrapper intercepts recoverable failures before they reach the mobile client',()=>{
  const source=readFileSync(new URL('../api/capacity-chat.js',import.meta.url),'utf8');
  assert.match(source,/bufferedResponse/);
  assert.match(source,/retryableFailure/);
  assert.match(source,/emergencyGenerate/);
  assert.match(source,/X-WAE-Resilience/);
  assert.match(source,/EMERGENCY_GENERATION_VERSION/);
});

test('emergency generator has stable v49 contract',()=>{
  assert.equal(EMERGENCY_GENERATION_VERSION,'emergency-generation/v49');
  const source=readFileSync(new URL('../lib/emergency-generation-v49.js',import.meta.url),'utf8');
  assert.match(source,/Promise\.any/);
  assert.match(source,/AbortSignal\.timeout/);
  assert.match(source,/openrouter\/free/);
  assert.match(source,/saveTurn/);
  assert.doesNotMatch(source,/console\.log\(.*API_KEY/s);
});
