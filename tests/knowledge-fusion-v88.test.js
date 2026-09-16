import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planUniversalIntelligence } from '../lib/universal-intelligence-planner-v87.js';
import { fusionSignals, shouldFuseUniversalKnowledge, KNOWLEDGE_FUSION_VERSION } from '../lib/knowledge-fusion-v88.js';

test('v88 fusion activates when a turn mixes current information with scientific evidence',()=>{
  const body={message:'Compara las investigaciones científicas recientes sobre hipertensión con lo que se sabe actualmente.',mode:'general'};
  const plan=planUniversalIntelligence(body);
  const signals=fusionSignals(body,plan);
  assert.equal(signals.live,true);
  assert.equal(signals.knowledge,true);
  assert.equal(shouldFuseUniversalKnowledge(body,plan),true);
});

test('v88 fusion activates for book plus scientific comparison but not for a simple book lookup',()=>{
  const mixed={message:'Compara el libro Thinking, Fast and Slow con investigaciones científicas sobre sesgos cognitivos.',mode:'general'};
  const mixedPlan=planUniversalIntelligence(mixed);
  assert.equal(fusionSignals(mixed,mixedPlan).library,true);
  assert.equal(fusionSignals(mixed,mixedPlan).knowledge,true);
  assert.equal(shouldFuseUniversalKnowledge(mixed,mixedPlan),true);

  const simple={message:'¿Quién escribió Thinking, Fast and Slow?',mode:'general'};
  const simplePlan=planUniversalIntelligence(simple);
  assert.equal(shouldFuseUniversalKnowledge(simple,simplePlan),false);
});

test('user attachments can participate in fusion without being treated as external evidence by routing',()=>{
  const body={message:'Compara este documento con la evidencia científica disponible.',attachments:[{name:'memo.txt',text:'contenido'}]};
  const plan=planUniversalIntelligence(body);
  const signals=fusionSignals(body,plan);
  assert.equal(signals.attachments,true);
  assert.equal(signals.knowledge,true);
  assert.equal(shouldFuseUniversalKnowledge(body,plan),true);
});

test('explicit fusion can be enabled or disabled deterministically',()=>{
  const body={message:'Analiza esta estrategia.',fusion:true};
  assert.equal(shouldFuseUniversalKnowledge(body,planUniversalIntelligence(body)),true);
  const disabled={message:'Compara evidencia reciente y estudios científicos.',fusion:false};
  assert.equal(shouldFuseUniversalKnowledge(disabled,planUniversalIntelligence(disabled)),false);
});

test('public v60 alias advances through v91, v90, v89 and v88 while v87 and v86 remain downstream',async()=>{
  const alias=await readFile(new URL('../api/capacity-chat-v60.js',import.meta.url),'utf8');
  const v91=await readFile(new URL('../api/capacity-chat-v91.js',import.meta.url),'utf8');
  const v90=await readFile(new URL('../api/capacity-chat-v90.js',import.meta.url),'utf8');
  const v89=await readFile(new URL('../api/capacity-chat-v89.js',import.meta.url),'utf8');
  const v88=await readFile(new URL('../api/capacity-chat-v88.js',import.meta.url),'utf8');
  const v87=await readFile(new URL('../api/capacity-chat-v87.js',import.meta.url),'utf8');
  assert.equal(KNOWLEDGE_FUSION_VERSION,'universal-knowledge-fusion/v88');
  assert.match(alias,/capacity-chat-v91\.js/);
  assert.match(v91,/capacity-chat-v90\.js/);
  assert.match(v90,/capacity-chat-v89\.js/);
  assert.match(v89,/capacity-chat-v88\.js/);
  assert.match(v88,/capacity-chat-v87\.js/);
  assert.match(v88,/KNOWLEDGE_FUSION_VERSION/);
  assert.match(v88,/runKnowledgeFusion/);
  assert.match(v87,/capacity-chat-v86\.js/);
});
