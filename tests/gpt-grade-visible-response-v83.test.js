import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getAgent, VISIBLE_RESPONSE_POLICY_VERSION } from '../lib/agents.js';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('v83 visible response policy is attached to every agent', () => {
  assert.equal(VISIBLE_RESPONSE_POLICY_VERSION, 'gpt-grade-visible/v83');
  for (const mode of ['general','research','code','analysis','design','executive']) {
    const agent = getAgent(mode);
    assert.match(agent.system, /Responde la pregunta o ejecuta la tarea desde la primera frase/);
    assert.match(agent.system, /Ajusta la profundidad a la complejidad/);
    assert.match(agent.system, /No hagas una pregunta de seguimiento innecesaria/);
    assert.match(agent.system, /No menciones proveedores, rutas de fallback, recuperación/);
    assert.match(agent.system, /Nunca expongas cadena de pensamiento/);
  }
});

test('v83 activates the existing GPT-style renderer from the production-loaded premium layer', () => {
  const premium = read('premium-v5.js');
  assert.match(premium, /gpt-visible-response\/v83/);
  assert.match(premium, /gpt-experience-v1\.js\?v=83/);
  assert.match(premium, /waeVisibleResponse='v83'/);
});

test('GPT-style renderer supports rich visible answers and real streaming lifecycle', () => {
  const renderer = read('gpt-experience-v1.js');
  assert.match(renderer, /function renderMarkdown/);
  assert.match(renderer, /rich-table-wrap/);
  assert.match(renderer, /iu-code-copy/);
  assert.match(renderer, /sourcesFromRuntime/);
  assert.match(renderer, /content\.delta/);
  assert.match(renderer, /response\.complete/);
  assert.match(renderer, /response\.error/);
});

test('visible renderer remains HTML-escaped and URL-protocol constrained', () => {
  const renderer = read('gpt-experience-v1.js');
  assert.match(renderer, /replace\(\/\[&<>/);
  assert.match(renderer, /\^https\?:\$/);
  assert.doesNotMatch(renderer, /innerHTML\s*=\s*raw/);
});
