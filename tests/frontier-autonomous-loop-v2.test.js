import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFrontierQueue, orchestrateFrontierCycle } from '../lib/frontier-autonomous-loop-v2.js';

test('builds a prioritized queue from measured gaps only',()=>{
  const r=buildFrontierQueue({measured:{'gpqa-diamond':.50,'terminal-bench-4':.20}});
  assert.equal(r.status,'READY');
  assert.equal(r.queue[0].domain,'expert-knowledge');
  assert.ok(r.queue[0].priorityScore>0);
});

test('does not turn missing benchmarks into failures',()=>{
  const r=buildFrontierQueue({measured:{}});
  assert.equal(r.status,'NO_EVIDENCE');
  assert.equal(r.queue.length,0);
  assert.equal(r.nextAction,'collect_reproducible_measurements');
});

test('regression blocks the autonomous promotion path',()=>{
  const r=orchestrateFrontierCycle({
    measured:{'gpqa-diamond':.80},
    evaluation:{
      model:'Universal Core',harness:'h/v1',graderVersion:'g/v1',datasetVersion:'d/v1',commit:'abc',
      measurements:[{benchmark:'gpqa-diamond',score:.70}],
      baselines:{'gpqa-diamond':.80}
    }
  });
  assert.equal(r.decision,'HOLD_AND_REPAIR_REGRESSION');
  assert.equal(r.next.action,'repair_regression');
});

test('never claims global superiority',()=>{
  const r=orchestrateFrontierCycle({measured:{'gpqa-diamond':.99}});
  assert.doesNotMatch(JSON.stringify(r),/superior|#1|winner|beats/i);
});
