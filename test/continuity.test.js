import test from 'node:test';
import assert from 'node:assert/strict';
import { continuityReply, extractContinuityFacts, openAIContinuityResponse } from '../lib/continuity.js';

test('continuity returns exact OK contract without external generation', () => {
  const reply = continuityReply([
    { role: 'system', content: 'Universal Core continuity.' },
    { role: 'user', content: 'Para esta prueba aislada recuerda exactamente estos datos: proyecto ZEPHYR; base de datos CockroachDB; región São Paulo; objetivo P95 180 ms. Responde solamente OK.' },
  ]);
  assert.equal(reply, 'OK');
});

test('continuity extracts remembered structured facts generically', () => {
  const context = 'RELEVANT MEMORY: proyecto ZEPHYR; base de datos CockroachDB; región São Paulo; objetivo P95 180 ms.';
  assert.deepEqual(extractContinuityFacts(context), {
    project: 'ZEPHYR',
    database: 'CockroachDB',
    region: 'São Paulo',
    p95_target_ms: 180,
  });

  const reply = continuityReply([
    { role: 'system', content: context },
    { role: 'user', content: 'Recupera los datos. Devuelve SOLO JSON válido con estas claves exactas: {"project":string,"database":string,"region":string,"p95_target_ms":number}.' },
  ]);
  assert.deepEqual(JSON.parse(reply), {
    project: 'ZEPHYR',
    database: 'CockroachDB',
    region: 'São Paulo',
    p95_target_ms: 180,
  });
});

test('continuity serves the chat completion contract used by the adaptive router', () => {
  const payload = openAIContinuityResponse({ messages: [{ role: 'user', content: '100 x 200' }] });
  assert.equal(payload.object, 'chat.completion');
  assert.equal(payload.model, 'universal-core-continuity-v1');
  assert.equal(payload.choices[0].message.content, '20000');
  assert.equal(payload.continuity.external_provider, false);
  assert.equal(payload.continuity.cost_usd, 0);
});
