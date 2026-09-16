import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripGreetingPrefix, sameOriginKnowledgeEligible, RECOVERY_POLICY_V82 } from '../lib/recovery-policy-v82.js';
import capacityChatV82, { CAPACITY_CHAT_V82 } from '../api/capacity-chat-v82.js';

test('v82 exposes stable GPT-style recovery contracts',()=>{
  assert.equal(RECOVERY_POLICY_V82,'recovery-policy/v82');
  assert.equal(CAPACITY_CHAT_V82,'capacity-chat/v82-same-origin-knowledge-recovery');
  assert.equal(typeof capacityChatV82,'function');
});

test('substantive question remains factual after a greeting prefix',()=>{
  const prompt='Hola para que sirven los GPUs?';
  assert.equal(stripGreetingPrefix(prompt),'para que sirven los GPUs?');
  assert.equal(sameOriginKnowledgeEligible(prompt,'general'),true);
});

test('pure greetings do not trigger an expensive knowledge recovery',()=>{
  assert.equal(sameOriginKnowledgeEligible('Hola','general'),false);
  assert.equal(sameOriginKnowledgeEligible('Buenas noches','general'),false);
});

test('high-risk requests do not fall into generic knowledge recovery',()=>{
  assert.equal(sameOriginKnowledgeEligible('Hola, qué dosis de medicamento debo tomar?','general'),false);
  assert.equal(sameOriginKnowledgeEligible('Qué estrategia legal debo usar en un delito?','general'),false);
});

test('v86 is the live alias over v84 and v83 while v82 remains independently callable over v81',()=>{
  const v60=fs.readFileSync(new URL('../api/capacity-chat-v60.js',import.meta.url),'utf8');
  const v86=fs.readFileSync(new URL('../api/capacity-chat-v86.js',import.meta.url),'utf8');
  const v84=fs.readFileSync(new URL('../api/capacity-chat-v84.js',import.meta.url),'utf8');
  const v83=fs.readFileSync(new URL('../api/capacity-chat-v83.js',import.meta.url),'utf8');
  const v82=fs.readFileSync(new URL('../api/capacity-chat-v82.js',import.meta.url),'utf8');
  assert.match(v60,/capacity-chat-v86\.js/);
  assert.match(v86,/capacity-chat-v84\.js/);
  assert.match(v86,/factualityDecision/);
  assert.match(v84,/capacity-chat-v83\.js/);
  assert.match(v84,/callIaGratisChat/);
  assert.match(v83,/capacity-chat-v81\.js/);
  assert.match(v83,/runKnowledgeAnswer/);
  assert.match(v82,/capacity-chat-v81\.js/);
  assert.match(v82,/runKnowledgeAnswer/);
  assert.match(v82,/same-origin-knowledge-v82/);
});