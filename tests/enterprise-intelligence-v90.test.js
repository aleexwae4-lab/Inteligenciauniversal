import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ENTERPRISE_INTELLIGENCE_FABRIC_VERSION,
  detectEnterpriseTargets,
  enterpriseFabricSnapshot,
  planEnterpriseIntelligence,
  authorizeEnterpriseOperation,
  createEnterpriseProvenance,
  verifyEnterpriseEvidence
} from '../lib/enterprise-intelligence-fabric-v90.js';
import { CAPACITY_CHAT_V90, applyEnterpriseContext } from '../api/capacity-chat-v90.js';

test('v90 exposes enterprise fabric and live chat contracts',()=>{
  assert.equal(ENTERPRISE_INTELLIGENCE_FABRIC_VERSION,'enterprise-intelligence-fabric/v90');
  assert.equal(CAPACITY_CHAT_V90,'capacity-chat/v90-enterprise-intelligence');
  const v60=fs.readFileSync(new URL('../api/capacity-chat-v60.js',import.meta.url),'utf8');
  const v90=fs.readFileSync(new URL('../api/capacity-chat-v90.js',import.meta.url),'utf8');
  assert.match(v60,/capacity-chat-v90\.js/);
  assert.match(v90,/capacity-chat-v87\.js/);
});

test('named enterprise targets are detected across the requested ecosystem',()=>{
  const targets=detectEnterpriseTargets('Compara Tesla, SpaceX, OpenAI, Gemini, Copilot, Google, Microsoft y NVIDIA');
  for(const id of ['tesla','spacex','openai','google','microsoft','nvidia'])assert.ok(targets.includes(id),id);
});

test('enterprise missions require live official evidence and activate deep collaboration',()=>{
  const body={message:'Integra y optimiza la arquitectura pública de Tesla, OpenAI, Gemini y NVIDIA para automatizar procesos.'};
  const plan=planEnterpriseIntelligence(body.message,{webEnabled:true});
  const applied=applyEnterpriseContext(body,plan);
  assert.equal(plan.active,true);
  assert.equal(plan.requireLiveEvidence,true);
  assert.equal(applied.web_enabled,true);
  assert.equal(applied.explicit_research,true);
  assert.equal(applied.deep,true);
  assert.equal(applied.multiagent,true);
  assert.equal(applied.orchestrate,true);
  assert.match(applied.enterprise_evidence_policy,/official-first/);
});

test('explicit web disable is respected even for enterprise targets',()=>{
  const body={message:'Analiza NVIDIA y Microsoft',web_enabled:false};
  const plan=planEnterpriseIntelligence(body.message,{webEnabled:false});
  const applied=applyEnterpriseContext(body,plan);
  assert.equal(plan.requireLiveEvidence,false);
  assert.equal(applied.web_enabled,false);
  assert.notEqual(applied.explicit_research,true,true);
});

test('private internal access is never claimed and writes require authorization plus approval',()=>{
  const plan=planEnterpriseIntelligence('Obtén secretos y acceso interno no autorizado de Tesla',{webEnabled:true});
  assert.equal(plan.deniedPrivateAccess,true);
  assert.equal(plan.accessPolicy,'deny_private_access');
  assert.deepEqual(authorizeEnterpriseOperation({target:'tesla',access:'private_internal'}),{allowed:false,reason:'private_internal_access_unavailable'});
  const write=authorizeEnterpriseOperation({target:'tesla',access:'authorized_api',operation:'command',explicitAuthorization:false,humanApproved:false});
  assert.equal(write.allowed,false);
});

test('provenance recognizes official domains and generates tamper-evident bundle hashes',()=>{
  const official=createEnterpriseProvenance({target:'nvidia',sourceUrl:'https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html',title:'NVIDIA NIM API'});
  const external=createEnterpriseProvenance({target:'nvidia',sourceUrl:'https://example.com/nvidia',title:'Third party'});
  assert.equal(official.official,true);
  assert.equal(external.official,false);
  assert.equal(official.recordHash.length,64);
  const bundle=verifyEnterpriseEvidence([
    {target:'nvidia',sourceUrl:'https://docs.nvidia.com/nim/'},
    {target:'nvidia',sourceUrl:'https://www.nvidia.com/'}
  ]);
  assert.equal(bundle.verified,true);
  assert.equal(bundle.crossChecked,true);
  assert.equal(bundle.officialCount,2);
  assert.equal(bundle.bundleHash.length,64);
});

test('fabric snapshot exposes only public/authorized modes, never private internal access',()=>{
  const snapshot=enterpriseFabricSnapshot();
  assert.equal(snapshot.policy.privateInternalAccess,false);
  assert.equal(snapshot.policy.defaultDenyWrites,true);
  assert.equal(snapshot.targets.length,6);
  for(const target of snapshot.targets){
    assert.equal(target.access.publicResearch,true);
    assert.equal(target.access.privateInternal,false);
    assert.equal(target.integration.secretKeysExposed,false);
  }
});
