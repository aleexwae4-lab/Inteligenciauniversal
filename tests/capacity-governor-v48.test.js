import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tryAcquireChatSlot,capacitySnapshot} from '../lib/concurrency-governor.js';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('one conversation cannot consume two concurrent inference slots',()=>{
  const first=tryAcquireChatSlot('session-a');
  assert.equal(first.ok,true);
  const duplicate=tryAcquireChatSlot('session-a');
  assert.equal(duplicate.ok,false);
  assert.equal(duplicate.reason,'conversation_busy');
  first.release();
  const after=tryAcquireChatSlot('session-a');
  assert.equal(after.ok,true);
  after.release();
});

test('global governor sheds excess work instead of allowing unbounded hanging requests',()=>{
  const max=capacitySnapshot().maxActive;
  const held=[];
  for(let i=0;i<max;i++){
    const slot=tryAcquireChatSlot(`load-${i}`);
    assert.equal(slot.ok,true);
    held.push(slot);
  }
  const overflow=tryAcquireChatSlot('overflow');
  assert.equal(overflow.ok,false);
  assert.equal(overflow.reason,'global_capacity');
  assert.ok(overflow.retryAfterMs>=250);
  for(const slot of held)slot.release();
  assert.equal(capacitySnapshot().active,0);
});

test('shared-network rate limit uses session fairness plus a separate IP ceiling',()=>{
  const security=read('lib/security.js');
  assert.match(security,/sessionId\|\|req\?\.body\?\.session_id/);
  assert.match(security,/WAE_IP_RATE_LIMIT_PER_MINUTE \|\| 1200/);
  assert.match(security,/sessionAllowed&&ipAllowed/);
  assert.match(security,/session:/);
  assert.match(security,/ip:/);
});

test('capacity wrapper rejects overload fast with retry metadata and always releases admitted slots',()=>{
  const source=read('api/capacity-chat.js');
  assert.match(source,/tryAcquireChatSlot/);
  assert.match(source,/CAPACITY_BUSY/);
  assert.match(source,/Retry-After/);
  assert.match(source,/status\(503\)/);
  assert.match(source,/finally/);
  assert.match(source,/slot\.release\(\)/);
});

test('server routes both chat endpoints through v48 governor without replacing v47 mobile resilience',()=>{
  const source=read('server.js');
  assert.match(source,/api\/capacity-chat\.js/);
  assert.match(source,/X-WAE-Capacity-Release','capacity-governor-v48'/);
  assert.match(source,/universal-core-mobile-v47-long-session/);
  assert.match(source,/long-session-backpressure-v47/);
});
