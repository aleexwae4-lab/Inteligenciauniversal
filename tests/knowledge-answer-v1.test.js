import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shouldUseKnowledgeAnswer } from '../lib/knowledge/knowledge-answer-v1.js';
import { understandKnowledgeQuery } from '../lib/knowledge/fabric-v1.js';

test('stable Spanish clinical questions activate Knowledge Fabric while books stay in library lane',()=>{
  assert.equal(shouldUseKnowledgeAnswer({message:'¿Qué dice la evidencia clínica sobre hipertensión?',mode:'auto'}),true);
  assert.equal(shouldUseKnowledgeAnswer({message:'Analiza estudios científicos sobre genética',mode:'auto'}),true);
  assert.equal(shouldUseKnowledgeAnswer({message:'¿Conoces el libro Piense y hágase rico?',mode:'auto'}),false);
  assert.equal(shouldUseKnowledgeAnswer({message:'¿Cuál es el último estudio clínico publicado hoy?',mode:'auto',web_enabled:true}),false);
});

test('temporal awareness marks latest/current academic questions for the live-data lane',()=>{
  assert.equal(understandKnowledgeQuery('último estudio clínico sobre hipertensión').temporal,true);
  assert.equal(understandKnowledgeQuery('evidencia clínica sobre hipertensión').temporal,false);
});

test('direct Knowledge Fabric answer path remains behind output firewall and distributed admission',async()=>{
  const answer=await readFile(new URL('../lib/knowledge/knowledge-answer-v1.js',import.meta.url),'utf8');
  const wrapper=await readFile(new URL('../api/capacity-chat-v63.js',import.meta.url),'utf8');
  assert.match(answer,/isSafeAssistantOutput/);
  assert.match(answer,/CONTEXT_OUTPUT_FIREWALL_VERSION/);
  assert.match(wrapper,/distributedAdmission/);
  assert.match(wrapper,/authorizeKnowledge/);
  assert.ok(wrapper.indexOf('distributedAdmission')<wrapper.indexOf('stableKnowledgeIntent(body)'));
});

test('public knowledge API cannot bind arbitrary tenant ids or client-supplied request ids',async()=>{
  const source=await readFile(new URL('../api/knowledge.js',import.meta.url),'utf8');
  assert.match(source,/organizationId:null/);
  assert.match(source,/requestId:undefined/);
  assert.doesNotMatch(source,/organizationId:body\.organization_id/);
});
