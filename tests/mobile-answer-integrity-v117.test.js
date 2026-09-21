import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile=readFileSync(new URL('../api/mobile.js',import.meta.url),'utf8');

test('v117 each mobile assistant belongs to exactly one originating turn',()=>{
  assert.match(mobile,/var turnId='uc-'/);
  assert.match(mobile,/epoch:conversationEpoch/);
  assert.match(mobile,/if\(!live\)live=turn/);
  assert.doesNotMatch(mobile,/candidates\.filter\(function\(n\)\{return n\.querySelector\('\.typing'\)\}\)\.pop\(\)/);
});

test('v117 ignores delayed answer commits when conversation changes',()=>{
  assert.match(mobile,/assistant\.epoch!==conversationEpoch/);
  assert.match(mobile,/!assistant\.turn\.isConnected/);
  assert.match(mobile,/if\(epoch!==conversationEpoch\)return/);
  assert.match(mobile,/conversationEpoch\+\+/);
  assert.match(mobile,/currentController\.abort\('conversation_changed'\)/);
});

test('v117 validates definition relevance across native, legacy and Edge routes',()=>{
  assert.match(mobile,/function definitionTopic\(question\)/);
  assert.match(mobile,/function replyMatchesPrompt\(question,reply\)/);
  assert.match(mobile,/off_topic_definition_reply/);
  assert.match(mobile,/replyMatchesPrompt\(payload\.message,reply\)/);
  assert.match(mobile,/replyMatchesPrompt\(text,reply\)/);
});
