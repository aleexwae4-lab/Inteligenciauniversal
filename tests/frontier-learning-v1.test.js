import test from 'node:test';
import assert from 'node:assert/strict';
import { frontierLearningSnapshot,frontierLearningTargets,frontierTrainingPlan } from '../lib/frontier-learning-v1.js';

test('targets use current official Astra references',()=>{
 const r=frontierLearningTargets();
 assert.equal(r.targets['frontiermath-tier4-v2'].target,.976);
 assert.equal(r.targets['terminal-bench-4'].target,.579);
 assert.equal(r.targets['sre-bench'].target,.880);
 assert.equal(r.policy.noSyntheticScores,true);
});

test('missing measurements remain unmeasured',()=>{
 const r=frontierLearningSnapshot({});
 assert.equal(r.coverage,0);
 assert.equal(r.nextFocus,'collect_measurements');
 assert.equal(r.verdict,'NO_EVIDENCE');
});

test('largest measured gap determines next focus',()=>{
 const r=frontierLearningSnapshot({'terminal-bench-4':.20,'gpqa-diamond':.95,'sre-bench':.87});
 assert.equal(r.nextFocus,'coding-agents');
 assert.ok(r.priorities[0].priorityScore>0);
});

test('cyber plan is defensive',()=>{
 const r=frontierTrainingPlan('cybersecurity');
 assert.match(r.plan.safeTasks.join(' '),/threat modeling|secure-code review|patch validation/);
 assert.doesNotMatch(r.plan.safeTasks.join(' '),/exploit chain|payload|zero-day/);
});
