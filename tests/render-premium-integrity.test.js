import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isCoreSelfQuery, coreSelfResponse } from '../lib/core-self-description.js';

test('product capability questions are routed to evidence-based introspection',()=>{
  for(const q of ['Qué tan inteligente eres?', 'Hola, quién eres?', '¿Qué puedes hacer?', '¿Qué modelo eres?'])assert.equal(isCoreSelfQuery(q),true,q);
  for(const q of ['¿Qué es la inteligencia artificial?', 'Quiero programar un modelo inteligente', 'Necesito explicar tus ideas'])assert.equal(isCoreSelfQuery(q),false,q);
});
test('capability response does not invent connections, model identity or measurable IQ',()=>{
  const out=coreSelfResponse({providers:[{id:'wae_edge',configured:true}],tools:[{id:'web_search',configured:false},{id:'github_search',configured:false}],memory:{configured:false}});
  assert.match(out,/Universal Core/);
  assert.match(out,/no hay búsqueda web/i);
  assert.doesNotMatch(out,/soy un modelo .* OpenAI/i);
  assert.doesNotMatch(out,/coeficiente intelectual de \d+/i);
});
test('UI hides unsourced statistics and preserves core capabilities',()=>{
  const polish=readFileSync(new URL('../polish-v2.js',import.meta.url),'utf8');
  const premium=readFileSync(new URL('../premium-render-v1.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../premium-render-v1.css',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(polish,/67%|['"]FREE['"]|4 mensajes/);
  assert.match(premium,/let auto=localStorage.getItem\(AUTO_KEY\)!=='off'/);
  assert.match(css,/footer\.runtime-bar/);
  assert.match(html,/premium-render-v1\.css\?v=7/);
});
