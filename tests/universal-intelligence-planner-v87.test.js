import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import capacityChatV87, { CAPACITY_CHAT_V87 } from '../api/capacity-chat-v87.js';
import {
  UNIVERSAL_INTELLIGENCE_PLANNER_VERSION,
  planUniversalIntelligence,
  applyUniversalIntelligencePlan,
  publicUniversalIntelligencePlan
} from '../lib/universal-intelligence-planner-v87.js';

test('v87 exposes stable planner and handler contracts',()=>{
  assert.equal(UNIVERSAL_INTELLIGENCE_PLANNER_VERSION,'universal-intelligence-planner/v87');
  assert.equal(CAPACITY_CHAT_V87,'capacity-chat/v87-universal-intelligence-planner');
  assert.equal(typeof capacityChatV87,'function');
});

test('current questions automatically enter live research while preserving verification downstream',()=>{
  const body={message:'¿Quién es el CEO actual de esta empresa y qué anunció hoy?'};
  const plan=planUniversalIntelligence(body);
  const applied=applyUniversalIntelligencePlan(body,plan);
  assert.equal(plan.route,'live_research');
  assert.equal(plan.needs.live,true);
  assert.equal(plan.mode,'research');
  assert.equal(applied.web_enabled,true);
  assert.equal(applied.mode,'research');
});

test('book questions use the rights-aware library federation instead of pretending local full-text ownership',()=>{
  const body={message:'¿Quién escribió el libro Cien años de soledad y de qué trata?'};
  const plan=planUniversalIntelligence(body);
  const applied=applyUniversalIntelligencePlan(body,plan);
  assert.equal(plan.route,'library_federation');
  assert.equal(plan.needs.library,true);
  assert.equal(plan.needs.knowledge,false);
  assert.equal(applied.library,true);
  assert.notEqual(applied.web_enabled,true,true);
});

test('stable scientific questions activate Knowledge Fabric without forcing live web',()=>{
  const body={message:'Analiza la evidencia científica sobre la dispersión de Rayleigh.'};
  const plan=planUniversalIntelligence(body);
  const applied=applyUniversalIntelligencePlan(body,plan);
  assert.equal(plan.route,'scientific_knowledge');
  assert.equal(plan.needs.knowledge,true);
  assert.equal(plan.needs.live,false);
  assert.equal(applied.knowledge,true);
  assert.equal(applied.mode,'research');
  assert.notEqual(applied.web_enabled,true,true);
});

test('complex cross-domain enterprise missions activate the executive multiagent route',()=>{
  const body={message:'Analiza la arquitectura de software, el riesgo de seguridad, el costo operativo y diseña un plan de escalamiento para la empresa.'};
  const plan=planUniversalIntelligence(body);
  const applied=applyUniversalIntelligencePlan(body,plan);
  assert.equal(plan.route,'executive_multiagent');
  assert.equal(plan.needs.multiagent,true);
  assert.ok(plan.domains.includes('technology'));
  assert.ok(plan.domains.includes('finance'));
  assert.ok(plan.domains.includes('risk_legal'));
  assert.equal(applied.multiagent,true);
  assert.equal(applied.orchestrate,true);
  assert.equal(applied.deep,true);
  assert.equal(applied.mode,'executive');
});

test('general reasoning becomes analysis without unnecessarily invoking the executive committee',()=>{
  const body={message:'Razona este problema lógico y compara las dos hipótesis posibles.'};
  const plan=planUniversalIntelligence(body);
  const applied=applyUniversalIntelligencePlan(body,plan);
  assert.equal(plan.route,'deep_reasoning');
  assert.equal(plan.needs.reasoning,true);
  assert.equal(plan.needs.multiagent,false);
  assert.equal(applied.mode,'analysis');
  assert.notEqual(applied.multiagent,true,true);
});

test('explicit disable flags are respected by the planner',()=>{
  const plan=planUniversalIntelligence({message:'Dime las noticias de hoy',web_enabled:false});
  const applied=applyUniversalIntelligencePlan({message:'Dime las noticias de hoy',web_enabled:false},plan);
  assert.equal(plan.signals.current,true);
  assert.equal(plan.needs.live,false);
  assert.equal(applied.web_enabled,false);
});

test('public plan exposes routing decisions but not private classifier internals',()=>{
  const plan=planUniversalIntelligence({message:'Audita la arquitectura y el riesgo legal de la empresa.'});
  const publicPlan=publicUniversalIntelligencePlan(plan);
  assert.equal(publicPlan.version,UNIVERSAL_INTELLIGENCE_PLANNER_VERSION);
  assert.equal(publicPlan.evidence_policy,'verify-before-accept');
  assert.equal(Object.prototype.hasOwnProperty.call(publicPlan,'signals'),false);
  assert.equal(Object.prototype.hasOwnProperty.call(publicPlan,'constraints'),false);
});

test('public v60 compatibility alias advances through v87 and keeps v86 as final factual gate',()=>{
  const v60=fs.readFileSync(new URL('../api/capacity-chat-v60.js',import.meta.url),'utf8');
  const v87=fs.readFileSync(new URL('../api/capacity-chat-v87.js',import.meta.url),'utf8');
  const v86=fs.readFileSync(new URL('../api/capacity-chat-v86.js',import.meta.url),'utf8');
  assert.match(v60,/capacity-chat-v87\.js/);
  assert.match(v87,/capacity-chat-v86\.js/);
  assert.match(v87,/planUniversalIntelligence/);
  assert.match(v86,/factualityDecision/);
});
