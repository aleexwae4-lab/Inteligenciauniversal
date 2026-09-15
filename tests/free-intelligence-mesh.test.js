import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('free intelligence mesh continuously discovers and stages zero-cost routes', () => {
  const sql = read('supabase/migrations/20260915060426_free_intelligence_mesh_v1.sql');
  assert.match(sql,/universal-free-intelligence-mesh\/v1/);
  assert.match(sql,/model_name like '%:free'/);
  assert.match(sql,/input_per_million',0/);
  assert.match(sql,/output_per_million',0/);
  assert.match(sql,/wae-free-model-sync-v1/);
  assert.match(sql,/wae-free-model-promotion-v1/);
  assert.match(sql,/wae-model-discovery-free-mesh-v1/);
  assert.match(sql,/openai\/gpt-oss-120b/);
  assert.match(sql,/openai\/gpt-oss-20b/);
  assert.match(sql,/qwen\/qwen3\.6-27b/);
  assert.match(sql,/qwen\/qwen3\.8-27b/);
  assert.match(sql,/groq\/compound-mini/);
  assert.match(sql,/llama-3\.3-70b-versatile/);
  assert.match(sql,/deprecated_by_free_mesh_v1/);
});

test('free candidates must be recent and pass an isolated probe before promotion', () => {
  const sql = read('supabase/migrations/20260915060456_free_mesh_recent_probe_filter_v1.sql');
  const probe = read('supabase/functions/wae-model-probe-v73/index.ts');
  assert.match(sql,/last_seen_at/);
  assert.match(sql,/48 hours/);
  assert.match(sql,/quality_score/);
  assert.match(sql,/force',true/);
  assert.match(probe,/73\.1\.0-free-mesh/);
  assert.match(probe,/production_traffic:false/);
  assert.match(probe,/discovery_managed===true/);
  assert.match(probe,/endsWith\(':free'\)/);
  assert.match(probe,/quality_score,0\)>=80/);
  assert.match(probe,/health\.enabled=true/);
  assert.match(probe,/free_mesh_promoted:true/);
});

test('high-risk tasks cannot route to free providers lacking sensitive-data certification', () => {
  const router = read('supabase/functions/wae-local-voice-demo-v61/router.ts');
  const privacy = read('supabase/migrations/20260915060924_free_mesh_sensitive_routing_v1.sql');
  assert.match(router,/req\.risk==='high'&&m\.supports_sensitive_data!==true/);
  assert.match(router,/iu_adaptive_model_registry_v2/);
  assert.match(privacy,/supports_sensitive_data/);
  assert.match(privacy,/privacy_class/);
});
