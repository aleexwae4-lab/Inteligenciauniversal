import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('control priority is health-first before base priority',()=>{
  const sql=read('supabase/migrations/20260915064700_health_first_control_priority_v42.sql');
  assert.match(sql,/effective_health,'unknown'\)\)='healthy'/);
  assert.match(sql,/circuit_state,'CLOSED'\)='CLOSED'/);
  assert.match(sql,/10000/);
  assert.match(sql,/20000/);
  assert.match(sql,/30000/);
  assert.match(sql,/consecutive_failures,0\),0\),999\) \* 100/);
  assert.match(sql,/greatest\(coalesce\(v1\.priority,999\),0\)/);
});

test('Edge Council v42 prefers proven healthy closed low-debt recent models',()=>{
  const council=read('supabase/functions/wae-local-voice-demo-v61/council.ts');
  assert.match(council,/EDGE_COUNCIL_VERSION='edge-council\/v42'/);
  assert.match(council,/health\(m\)==='healthy'/);
  assert.match(council,/circuit_state\|\|'CLOSED'/);
  assert.match(council,/debt\(m\)<=5/);
  assert.match(council,/recentSuccess\(m,24\)/);
  assert.match(council,/reliable\(m\).*>=70/);
  assert.match(council,/councilCandidates\(ctx,3\)/);
  assert.match(council,/selection_policy:'healthy_closed_recent_success_low_debt'/);
});

test('Council v42 still excludes deterministic rescue and does not force synthesis',()=>{
  const council=read('supabase/functions/wae-local-voice-demo-v61/council.ts');
  assert.match(council,/model\?\.provider===RESCUE/);
  assert.match(council,/valid\.length<2/);
  assert.match(council,/synthesisScore\.score>=winner\.score\.score-0\.02/);
  assert.match(council,/synthesis_accepted:synthesisAccepted/);
});
