import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planUniversalIntelligence } from '../lib/universal-intelligence-planner-v87.js';
import { LATENCY_GOVERNOR_VERSION, planLatencyV90, shouldAttemptFastFactualV90, withinLatencyBudget, latencyGovernorCapabilitiesV90 } from '../lib/latency-governor-v90.js';
import { KNOWLEDGE_EXPANSION_VERSION, knowledgeExpansionCandidatesV90, auditKnowledgeExpansionV90, knowledgeExpansionCapabilitiesV90 } from '../lib/knowledge-expansion-v90.js';
import { KNOWLEDGE_FUSION_V90 } from '../lib/knowledge-fusion-v90.js';
import capacityChatV90, { CAPACITY_CHAT_V90 } from '../api/capacity-chat-v90.js';

test('v90 exposes stable latency-first contracts without claiming benchmark superiority',()=>{
  assert.equal(LATENCY_GOVERNOR_VERSION,'latency-governor/v90');
  assert.equal(KNOWLEDGE_EXPANSION_VERSION,'autonomous-knowledge-expansion/v90');
  assert.equal(KNOWLEDGE_FUSION_V90,'universal-knowledge-fusion/v90');
  assert.equal(CAPACITY_CHAT_V90,'capacity-chat/v90-latency-autonomous-knowledge');
  assert.equal(typeof capacityChatV90,'function');
  const caps=latencyGovernorCapabilitiesV90();
  assert.equal(caps.measuredProductionAdvantage,false);
  assert.equal(caps.comparativeCertificationRequired,true);
  assert.equal(caps.superiorityClaim,false);
});

test('simple precise stable facts enter the verified fast factual lane',()=>{
  const body={message:'¿Quién escribió Cien años de soledad?',mode:'general'};
  const plan=planLatencyV90(body,planUniversalIntelligence(body));
  assert.equal(plan.profile,'fast_factual');
  assert.equal(shouldAttemptFastFactualV90(plan),true);
  assert.ok(plan.budgets.focused_timeout_ms<=2200);
  assert.equal(plan.policy.verificationPreserved,true);
});

test('current facts prefer live retrieval and never use the simple fast lane',()=>{
  const body={message:'¿Quién es el CEO actual de esta empresa?',mode:'general'};
  const plan=planLatencyV90(body,planUniversalIntelligence(body));
  assert.equal(plan.profile,'live_current');
  assert.equal(shouldAttemptFastFactualV90(plan),false);
  assert.ok(plan.budgets.live_timeout_ms>0);
});

test('deep research and executive work receive bounded wider budgets',()=>{
  const research={message:'Investiga profundamente la evidencia científica reciente sobre hipertensión.',mode:'research'};
  const researchPlan=planLatencyV90(research,planUniversalIntelligence(research));
  assert.equal(researchPlan.profile,'live_current');
  assert.ok(researchPlan.budgets.knowledge_timeout_ms<=6800);

  const executive={message:'Audita arquitectura, seguridad, costos y estrategia de escalamiento de la empresa.',mode:'executive'};
  const executivePlan=planLatencyV90(executive,{needs:{multiagent:true}});
  assert.equal(executivePlan.profile,'executive');
  assert.ok(executivePlan.budgets.multiagent_timeout_ms<=8000);
});

test('creative transforms bypass knowledge latency overhead',()=>{
  const body={message:'Reescribe este mensaje para que suene profesional.',mode:'general'};
  const plan=planLatencyV90(body,planUniversalIntelligence(body));
  assert.equal(plan.profile,'bypass');
  assert.equal(plan.signals.knowledge,false);
});

test('latency budget fails fast instead of waiting for a slow dependency',async()=>{
  const started=Date.now();
  const result=await withinLatencyBudget(30,()=>new Promise(resolve=>setTimeout(()=>resolve('late'),180)));
  assert.equal(result,null);
  assert.ok(Date.now()-started<140);
});

test('autonomous expansion scouts candidates but cannot auto-promote them',async()=>{
  const planned=knowledgeExpansionCandidatesV90('papers científicos de inteligencia artificial');
  assert.equal(planned.candidates[0].id,'semantic_scholar');
  const audit=await auditKnowledgeExpansionV90({query:'historia de México',candidateId:'library_of_congress',live:false});
  assert.equal(audit.results.length,1);
  assert.equal(audit.results[0].promotion,'HOLD');
  assert.equal(audit.results[0].active_in_answer_path,false);
  assert.ok(audit.results[0].blockers.includes('license_review_required_before_fulltext_or_training'));
  const caps=knowledgeExpansionCapabilitiesV90();
  assert.equal(caps.autoPromote,false);
  assert.equal(caps.promotionRequiresCertification,true);
});

test('v90 fusion runs evidence and multiagent work in parallel and preserves factuality gates',async()=>{
  const source=await readFile(new URL('../lib/knowledge-fusion-v90.js',import.meta.url),'utf8');
  assert.match(source,/Promise\.all\(\[/);
  assert.match(source,/collectEvidence/);
  assert.match(source,/collectMultiagent/);
  assert.match(source,/factualityDecision/);
  assert.match(source,/applyAnswerIntelligence/);
  assert.match(source,/applyQualityReliability/);
});

test('public v60 alias advances to v90 while documenting v89 as downstream fallback',async()=>{
  const alias=await readFile(new URL('../api/capacity-chat-v60.js',import.meta.url),'utf8');
  const v90=await readFile(new URL('../api/capacity-chat-v90.js',import.meta.url),'utf8');
  assert.match(alias,/capacity-chat-v90\.js/);
  assert.match(alias,/capacity-chat-v89\.js/);
  assert.match(v90,/capacity-chat-v89\.js/);
  assert.match(v90,/runFocusedFactualAnswer/);
  assert.match(v90,/runKnowledgeFusionV90/);
  assert.match(v90,/factualityDecision/);
});
