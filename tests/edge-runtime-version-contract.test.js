import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

function capture(text,rx,label){
  const match=text.match(rx);
  assert.ok(match,`${label} not found`);
  return match[1];
}

test('production smoke and router canary certify the exact Edge runtime declared by source',async()=>{
  const [common,ci,canary]=await Promise.all([
    readFile(new URL('../supabase/functions/wae-local-voice-demo-v61/common.ts',import.meta.url),'utf8'),
    readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8'),
    readFile(new URL('../.github/workflows/adaptive-canary-v2.yml',import.meta.url),'utf8')
  ]);
  const sourceVersion=capture(common,/export const VERSION='([^']+)'/,'Edge source VERSION');
  const sourceRouter=capture(common,/export const ROUTER='([^']+)'/,'Edge source ROUTER');
  const ciVersion=capture(ci,/EDGE_VERSION:\s*([^\s]+)/,'CI EDGE_VERSION');
  const ciRouter=capture(ci,/EDGE_ROUTER:\s*([^\s]+)/,'CI EDGE_ROUTER');
  const canaryVersion=capture(canary,/EDGE_VERSION:\s*([^\s]+)/,'Canary EDGE_VERSION');
  const canaryRouter=capture(canary,/EDGE_ROUTER:\s*([^\s]+)/,'Canary EDGE_ROUTER');

  assert.equal(ciVersion,sourceVersion);
  assert.equal(canaryVersion,sourceVersion);
  assert.equal(ciRouter,sourceRouter);
  assert.equal(canaryRouter,sourceRouter);
  assert.equal(sourceVersion,'1.9.1-context-isolation-v55');
  assert.equal(sourceRouter,'wae-adaptive-router-v22');
});
