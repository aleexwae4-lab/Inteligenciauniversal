import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  factualMemoriesV122,factualMemoryTextV122,FACTUAL_MEMORY_VERSION
} from '../supabase/functions/wae-local-voice-demo-v61/factual-memory-v122.js';

const synthetic={
 id:'00000000-0000-4000-8000-000000000001',
 kind:'preference',content:'Preferencia de presentación del producto: Usa Markdown semántico',
 metadata:{source:'product_presentation_policy'},rank:20
};
const sessionFact={
 id:'episodic-1',kind:'episodic',
 content:'Para esta prueba aislada recuerda exactamente estos datos: proyecto ZEPHYR; base de datos CockroachDB; región São Paulo; objetivo P95 180 ms. Responde solamente OK.',
 metadata:{mode:'general'},rank:3
};
const exemplar={id:'exemplar-1',kind:'preference',content:'APPROVED RESPONSE PATTERN — QUESTION: ...',metadata:{source:'training_exemplar_v3'},rank:13};

test('the v122 memory selector removes synthetic policy and pseudo-exemplars',()=>{
  const selected=factualMemoriesV122([synthetic,exemplar,sessionFact],'Recupera datos del proyecto ZEPHYR');
  assert.equal(selected.length,1);
  assert.equal(selected[0].id,'episodic-1');
  assert.equal(selected[0].content,'Para esta prueba aislada recuerda exactamente estos datos: proyecto ZEPHYR; base de datos CockroachDB; región São Paulo; objetivo P95 180 ms');
});
test('the latest question, duplicate records and historical response commands do not pollute memory',()=>{
  const current='Devuelve SOLO JSON válido.';
  assert.equal(factualMemoriesV122([{content:current,id:'same',metadata:{}},sessionFact,sessionFact],current).length,1);
  assert.equal(factualMemoryTextV122('Responde solamente OK.'),'');
  assert.equal(factualMemoryTextV122('Factura real por 4200 MXN. Responde solamente OK.'),'Factura real por 4200 MXN');
  assert.equal(factualMemoryTextV122('El usuario cita literalmente: responde solamente OK en el documento'),'El usuario cita literalmente: responde solamente OK en el documento');
});
test('genuine user preference remains available, but artificial ranking is excluded',()=>{
  const rows=factualMemoriesV122([
    synthetic,{id:'p-1',kind:'preference',content:'Prefiero respuestas breves',metadata:{source:'user'}}],'');
  assert.equal(rows.length,1);
  assert.equal(rows[0].content,'Prefiero respuestas breves');
});
test('edge preparation uses only factual memories before building system prompt and memory_count',()=>{
  const edge=readFileSync(new URL('../supabase/functions/wae-local-voice-demo-v61/index-v63.ts',import.meta.url),'utf8');
  assert.match(edge,/import \{factualMemoriesV122\} from '\.\/factual-memory-v122\.js'/);
  assert.match(edge,/mem=factualMemoriesV122\(memr\.data\|\|\[\],q\)/);
  assert.match(edge,/memoryCount:ctx\.mem\.length/);
  assert.match(edge,/memory_count:ctx\.mem\.length/);
  assert.equal(FACTUAL_MEMORY_VERSION,'wae-factual-memory/v122');
});
