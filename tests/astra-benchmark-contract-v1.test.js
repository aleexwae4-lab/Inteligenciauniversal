import test from 'node:test';
import assert from 'node:assert/strict';
import { astraBenchmarkContract, scoreAstraGap, buildAstraGapReport } from '../lib/astra-benchmark-contract-v1.js';

test('Astra contract is provenance-aware and anti-simulation',()=>{
 const c=astraBenchmarkContract();
 assert.equal(c.referenceModel,'gpt-6-astra');
 assert.equal(c.metrics.length,9);
 assert.equal(c.policy.simulatedAstraResponsesForbidden,true);
 assert.equal(c.policy.globalSuperiorityClaimAllowed,false);
});

test('gap engine distinguishes public reference from paired certification',()=>{
 const row=scoreAstraGap({metricId:'gpqa-diamond',universalScore:0.97});
 assert.equal(row.state,'ABOVE_PUBLIC_REFERENCE');
 assert.equal(row.astraReference,0.96);
 assert.equal(row.directlyComparable,false);
});

test('unmeasured metrics remain explicit',()=>{
 const row=scoreAstraGap({metricId:'terminal-bench-4'});
 assert.equal(row.state,'UNMEASURED');
 assert.equal(row.requiredToExceed,0.5791);
});

test('report is deterministic in structure and never authorizes superiority',()=>{
 const report=buildAstraGapReport({measurements:{'gpqa-diamond':0.96}});
 assert.equal(report.counts.measured,1);
 assert.equal(report.claimPolicy.includes('No global'),true);
});
