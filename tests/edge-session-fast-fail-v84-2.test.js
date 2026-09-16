import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourcePath=new URL('../supabase/functions/wae-local-voice-demo-v61/supabase-client-v84.ts',import.meta.url);

async function source(){return readFile(sourcePath,'utf8')}

test('v84.3 keeps session bootstrap retries idempotent and bounded',async()=>{
  const text=await source();
  assert.match(text,/EDGE_DB_TRANSPORT_VERSION='wae-edge-db-transport\/v84\.3-session-resilient'/);
  assert.match(text,/const SESSION_INSERT_ATTEMPTS=3/);
  assert.match(text,/new Set\(\[500,502,503,504\]\)/);
  assert.match(text,/WAE_EDGE_SESSION_ATTEMPT_MS/);
  assert.match(text,/\|\|4500/);
  assert.match(text,/Math\.max\(2000,Math\.min\(8000/);
  assert.match(text,/on_conflict','id'/);
  assert.match(text,/resolution=merge-duplicates/);
});

test('v84.3 applies the longer resilience budget only to idempotent session inserts',async()=>{
  const text=await source();
  assert.match(text,/const timeoutMs=sessionInsert\?sessionAttemptMs\(\):deadlineMs\(\)/);
  assert.match(text,/const attempts=sessionInsert\?SESSION_INSERT_ATTEMPTS:1/);
});
