import test from 'node:test';
import assert from 'node:assert/strict';
import {createSSEParser,streamingCanaryEligible} from '../lib/sse-events.js';

test('SSE parser reconstructs events across arbitrary chunks',()=>{
  const events=[];const p=createSSEParser(e=>events.push(e));
  p.push('event: response.start\nda');
  p.push('ta: {"request_id":"r1"}\n\nevent: content.delta\ndata: {"text":"Ho');
  p.push('la"}\n\nevent: content.delta\ndata: {"text":" mundo"}\n\n');
  p.push('event: response.complete\ndata: {"reply":"Hola mundo"}\n\n');p.end();
  assert.deepEqual(events.map(e=>e.event),['response.start','content.delta','content.delta','response.complete']);
  assert.equal(events[1].data.text,'Hola');
  assert.equal(events[3].data.reply,'Hola mundo');
});

test('SSE parser supports multiline data and comments',()=>{
  const events=[];const p=createSSEParser(e=>events.push(e));
  p.push(': keepalive\nevent: note\ndata: one\ndata: two\n\n');p.end();
  assert.equal(events.length,1);assert.equal(events[0].event,'note');assert.equal(events[0].raw,'one\ntwo');
});

test('streaming canary requires a verified transport',()=>{
  assert.equal(streamingCanaryEligible({sessionId:'abc',verifiedModels:0,canaryPct:100}),false);
  assert.equal(streamingCanaryEligible({sessionId:'abc',verifiedModels:1,canaryPct:100}),true);
});

test('streaming canary override can force on or off',()=>{
  assert.equal(streamingCanaryEligible({sessionId:'abc',verifiedModels:1,canaryPct:0,override:'on'}),true);
  assert.equal(streamingCanaryEligible({sessionId:'abc',verifiedModels:1,canaryPct:100,override:'off'}),false);
});
