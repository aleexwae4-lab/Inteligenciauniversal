import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSelfImprovement } from '../lib/performance.js';

test('self-improvement plane normalizes learned routing signals without claiming base-model training', () => {
  const out=normalizeSelfImprovement({
    contract:'universal-core-self-improvement/v1',
    mode:'blended_shadow_router_training',
    router_learning_active:true,
    base_model_weights_changed:false,
    raw_content_used:false,
    window_hours:24,
    signals:{total:2271,positive:1165,negative:337,neutral:769,avg_operational_score:87.56,learned_routes:18},
    training_readiness:{explicit_feedback_examples:1,rejected_examples:0},
    supremacy_gate:{state:'HOLD_GPT_COMPARATOR_MISSING',claim_allowed:false},
    top_learned_routes:[{provider:'google_gemma',model:'gemma-4-26b-a4b-it',reputation_score:80.29}]
  });
  assert.equal(out.available,true);
  assert.equal(out.router_learning_active,true);
  assert.equal(out.base_model_weights_changed,false);
  assert.equal(out.raw_content_used,false);
  assert.equal(out.signals.total,2271);
  assert.equal(out.signals.learned_routes,18);
  assert.equal(out.supremacy_gate.claim_allowed,false);
  assert.equal(out.top_learned_routes[0].provider,'google_gemma');
});
