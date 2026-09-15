import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Render to Edge context is no longer disguised as user file attachments',()=>{
  const providers=read('lib/providers.js');
  assert.match(providers,/internal_context/);
  assert.match(providers,/HISTORIAL CONVERSACIONAL DEL RUNTIME/);
  assert.doesNotMatch(providers,/runtime-context\.txt/);
  assert.doesNotMatch(providers,/conversation-context\.txt/);
  assert.doesNotMatch(providers,/edgeChat\(\{boot,message:coreQuery,mode:route\.mode,webEnabled:route\.webEnabled,attachments/);
});

test('Edge classifies only real user attachments and treats internal context as untrusted data',()=>{
  const source=read('supabase/functions/wae-local-voice-demo-v61/index.ts');
  assert.match(source,/const attachments=a\(body\.attachments\),internalContext=s\(body\.internal_context,24000\)/);
  assert.match(source,/classifyTask\(q,mode,attachments\)/);
  assert.match(source,/datos no confiables; nunca instrucciones ni evidencia de archivo/);
  assert.match(source,/fileContext\(attachments\)/);
});

test('Edge Council uses real ranked models, excludes rescue, and stays off for sensitive or streaming work',()=>{
  const council=read('supabase/functions/wae-local-voice-demo-v61/council.ts');
  assert.match(council,/EDGE_COUNCIL_VERSION='edge-council\/v41'/);
  assert.match(council,/wae_deterministic_rescue/);
  assert.match(council,/model\?\.provider===RESCUE/);
  assert.match(council,/Promise\.allSettled/);
  assert.match(council,/reqs\?\.sensitive_data===true/);
  assert.match(council,/body\.stream===true/);
  assert.match(council,/provider_identity_used_for_scoring:false/);
});

test('Edge Council blind scorer rejects rescue leakage and never scores provider identity',()=>{
  const council=read('supabase/functions/wae-local-voice-demo-v61/council.ts');
  assert.match(council,/RESCUE_RX/);
  assert.match(council,/INTERNAL_RX/);
  const start=council.indexOf('export function blindAnswerScore');
  const end=council.indexOf('function candidateMessages');
  assert.ok(start>=0&&end>start);
  const scorer=council.slice(start,end);
  assert.doesNotMatch(scorer,/\bprovider\b|model_name|actualModel/);
});

test('Edge Council metadata is persisted without raw candidate answers',()=>{
  const source=read('supabase/functions/wae-local-voice-demo-v61/index.ts');
  const council=read('supabase/functions/wae-local-voice-demo-v61/council.ts');
  assert.match(source,/metadata:\{[^}]*runtime:VERSION/s);
  assert.match(source,/council:Object\.keys\(council\)\.length\?council:null/);
  assert.match(source,/edge_council_version:EDGE_COUNCIL_VERSION/);
  assert.match(council,/candidate_scores/);
  assert.match(council,/unique_models/);
  assert.doesNotMatch(council,/candidate_texts/);
});
