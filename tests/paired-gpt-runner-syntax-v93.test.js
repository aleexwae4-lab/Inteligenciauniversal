import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('paired GPT v93 network runner remains syntactically executable',()=>{
  const result=spawnSync(process.execPath,['--check','scripts/paired-gpt-benchmark-v93.mjs'],{encoding:'utf8'});
  assert.equal(result.status,0,`${result.stdout||''}\n${result.stderr||''}`.trim());
});
