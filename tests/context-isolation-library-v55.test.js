import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildLibraryCapabilityReply } from '../lib/universal-context-v52.js';
import { isSafeAssistantOutput, privateContextLeakReason } from '../lib/context-output-firewall-v55.js';

const capacity=await readFile(new URL('../api/capacity-chat.js',import.meta.url),'utf8');
const common=await readFile(new URL('../supabase/functions/wae-local-voice-demo-v61/common.ts',import.meta.url),'utf8');
const rescue=await readFile(new URL('../supabase/functions/wae-deterministic-rescue-v1/index.ts',import.meta.url),'utf8');

test('output firewall blocks the exact private-context pattern seen in the mobile clip',()=>{
  const leaked='## Memoria recuperada\n\n[M1] Preferencia de presentación del producto: entrega respuestas de calidad premium.';
  assert.equal(isSafeAssistantOutput(leaked),false);
  assert.ok(privateContextLeakReason(leaked));
  assert.equal(isSafeAssistantOutput('Sí. Puedo consultar libros para ayudarte.'),true);
});

test('Edge cleanOutput contains defense-in-depth markers for private memory and runtime policy',()=>{
  for(const marker of ['MEMORIA RECUPERADA','Preferencia de presentaci','CONTEXTO CONVERSACIONAL DEL RUNTIME','EVIDENCIA DE HERRAMIENTAS','USER FILE EVIDENCE']){
    assert.match(common,new RegExp(marker,'i'));
  }
  assert.match(common,/unsafeOutput/);
  assert.match(common,/context-isolation\/v55/);
});

test('library capability reply reports audited federated coverage without claiming copyrighted fulltext ownership',()=>{
  const reply=buildLibraryCapabilityReply({library:{federatedMetadataCoverageEstimate:41743320,fulltextCoverageEstimate:79285}});
  assert.match(reply,/41\.7 millones/);
  assert.match(reply,/79,285|79\.3 mil|79 mil/);
  assert.match(reply,/no significa/i);
  assert.match(reply,/copyright|derechos|licencia/i);
});

test('the exact book questions from the clip use a provider-independent fast path',()=>{
  assert.match(capacity,/libraryCapabilityIntent/);
  assert.match(capacity,/tienes .*cuantos libros conoces/i);
  assert.match(capacity,/puedes consultar libros/i);
  assert.match(capacity,/library-capability-v55/);
  assert.match(capacity,/buildLibraryCapabilityReply/);
});

test('deterministic rescue cannot return generic raw memory and can preserve bibliographic evidence',()=>{
  assert.match(rescue,/private_memory_raw_output:false/);
  assert.match(rescue,/library_evidence_preserved:true/);
  assert.doesNotMatch(rescue,/return`## Memoria recuperada/);
});
