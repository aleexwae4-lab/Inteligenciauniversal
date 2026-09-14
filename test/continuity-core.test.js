import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContinuityResult } from '../lib/continuity-core.js';

test('continuity core returns a degraded deterministic response',()=>{
  const result=buildContinuityResult({message:'Analiza el estado del sistema'});
  assert.equal(result.provider,'universal_continuity_core');
  assert.equal(result.model,'deterministic-evidence-v1');
  assert.equal(result.degraded,true);
  assert.match(result.text,/modo de continuidad/i);
  assert.match(result.text,/Analiza el estado del sistema/);
});

test('continuity core preserves literal web and file evidence',()=>{
  const result=buildContinuityResult({
    message:'Resume evidencia',
    attachments:[{name:'reporte.txt',type:'text/plain',text:'Total aprobado: 4200 MXN'}],
    toolResults:[{tool:'web_search',ok:true,data:[{title:'Fuente oficial',url:'https://example.com/a',content:'Dato verificado 2026'}]}]
  });
  assert.match(result.text,/Fuente oficial/);
  assert.match(result.text,/Dato verificado 2026/);
  assert.match(result.text,/4200 MXN/);
  assert.match(result.text,/https:\/\/example\.com\/a/);
});

test('continuity core does not expose recalled private memory',()=>{
  const secret='PRIVATE-MEMORY-DO-NOT-LEAK';
  const result=buildContinuityResult({message:'estado',memory:[{content:secret},{content:'otro secreto'}]});
  assert.match(result.text,/Se recuperaron 2 registros/);
  assert.doesNotMatch(result.text,new RegExp(secret));
});
