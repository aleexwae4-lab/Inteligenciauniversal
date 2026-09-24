import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const edge=readFileSync(new URL('../supabase/functions/wae-local-voice-demo-v61/index-v63.ts',import.meta.url),'utf8');

test('Edge never turns arbitrary snippets into a success:true assistant completion',()=>{
  assert.doesNotMatch(edge,/generated=\{text:evidenceRecoveryText\(ctx\)/);
  assert.doesNotMatch(edge,/provider:'web_recovery'/);
  assert.doesNotMatch(edge,/function evidenceRecoveryText/);
});

test('Explicit web_enabled:false prevents surprise fallback searches',()=>{
  assert.match(edge,/rescueEligible&&ctx\.reqs\.web===true/);
  assert.match(edge,/if\(!run\.generated\)\{await trace/);
});

test('No generative reply returns HTTP 503, success false and evidence as diagnostics',()=>{
  assert.match(edge,/jsonResponse\(503,\{success:false,error:'all_models_unavailable'/);
  assert.match(edge,/web_sources:ctx\.sources,conversation_id:ctx\.cid/);
});
