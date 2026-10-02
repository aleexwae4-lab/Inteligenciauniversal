import test from 'node:test';
import assert from 'node:assert/strict';
import { frontierControlSnapshot, FRONTIER_CONTROL_VERSION } from '../lib/frontier-control-v1.js';

test('frontier control exposes a bounded certification state',()=>{
  const snapshot=frontierControlSnapshot();
  assert.equal(snapshot.success,true);
  assert.equal(snapshot.version,FRONTIER_CONTROL_VERSION);
  assert.equal(snapshot.certification.requiredCases,64);
  assert.equal(snapshot.certification.globalSuperiorityClaimAllowed,false);
  assert.equal(snapshot.measurement.status,'UNMEASURED');
});
