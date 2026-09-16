import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ORCHESTRATOR_VERSION} from '../lib/orchestrator.js';
import {EXECUTIVE_ORCHESTRATION_VERSION} from '../lib/executive-orchestration-v52.js';

test('capabilities keep the stable public orchestration schema and expose the executive implementation separately',async()=>{
  assert.equal(ORCHESTRATOR_VERSION,'universal-orchestrator/v1');
  assert.match(EXECUTIVE_ORCHESTRATION_VERSION,/^db-executive-orchestrator\//);
  const source=await readFile(new URL('../api/capabilities.js',import.meta.url),'utf8');
  assert.match(source,/schema:ORCHESTRATOR_VERSION/);
  assert.match(source,/implementationVersion:EXECUTIVE_ORCHESTRATION_VERSION/);
  assert.doesNotMatch(source,/schema:EXECUTIVE_ORCHESTRATION_VERSION/);
});
