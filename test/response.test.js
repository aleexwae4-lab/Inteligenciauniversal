import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAssistantResponse,parseResponseComponents,sanitizeSpeechText} from '../lib/response.js';

test('speech sanitizer removes markdown, emoji, URLs and source markers',()=>{
  const spoken=sanitizeSpeechText('## **Crecimiento:** +27% 📈\n- Ver [fuente](https://example.com) [W1]');
  assert.equal(spoken.includes('*'),false);
  assert.equal(spoken.includes('#'),false);
  assert.equal(spoken.includes('https://'),false);
  assert.equal(spoken.includes('📈'),false);
  assert.match(spoken,/27 por ciento/);
});

test('structured parser emits table, metric, progress and chart components',()=>{
  const content='## Resumen\n:::metric Ingresos|$120,000|MXN\n:::progress Avance|72\n\n| Mes | Venta |\n|---|---:|\n| Ene | 10 |\n\n```wae-chart\n{"type":"bar","title":"Ventas","items":[{"label":"Ene","value":10}]}\n```';
  const types=parseResponseComponents(content).map(x=>x.type);
  for(const type of ['heading','metric','progress','table','chart'])assert.ok(types.includes(type));
});

test('assistant response separates screen content from speech text',()=>{
  const response=buildAssistantResponse({content:'**Crecimiento:** 27% 📈',provider:'test',model:'unit',latencyMs:42});
  assert.equal(response.schema,'assistant-response/v1');
  assert.equal(response.content,'**Crecimiento:** 27% 📈');
  assert.notEqual(response.speechText,response.content);
  assert.equal(response.metadata.ttftMs,null);
  assert.equal(response.actions.every(x=>x.id&&x.kind),true);
});
