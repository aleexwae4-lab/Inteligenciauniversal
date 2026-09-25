import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {capabilityProofSnapshot,capabilityProofLine,CAPABILITY_PROOF_VERSION} from '../lib/capability-proof-v153.js';

const fullMatrix={
  version:'universal-capability-registry/test',
  operational:{
    generativeInference:true,webResearch:true,publicResearch:true,githubSearch:true,persistentMemory:true,
    voiceInterface:true,visualEvidence:true,workspace:true,canvas:true,softwareFactory:true,digitalProductFoundry:true,
    projects:true,temporaryCollaboration:true,questDialogueSaveEngine:true
  },
  foundry:{version:'wae-product-foundry/v5',browserExecutable:['web_app','game_3d'],sourceTargets:['mobile_app'],threeD:{studio:'wae-game-studio/v12'}},
  intelligence:{
    agentModes:['general','research','code','analysis','design','executive'],
    industrialDomains:14,industrialSpecialists:21,
    professionalDomains:12,professionalSpecialists:30,
    worldDomains:14,worldSpecialists:18,
    worldMethod:['definition','baseline','system_map','options','pilot','scale','verification']
  },
  research:{academic:true,recentNews:true,encyclopedia:true},
  collaboration:{persistent:false,transport:'realtime',ttlHours:24}
};

test('v153 capability proof exposes runtime-backed areas without secrets',()=>{
  const proof=capabilityProofSnapshot({capabilityMatrix:fullMatrix});
  assert.equal(proof.version,CAPABILITY_PROOF_VERSION);
  assert.equal(proof.capabilityRegistry,fullMatrix.version);
  assert.equal(proof.summary.total,8);
  assert.equal(proof.summary.verified,8);
  assert.equal(proof.summary.unavailable,0);
  assert.equal(proof.policy.runtimeBackedClaimsOnly,true);
  assert.equal(proof.policy.secretsExcluded,true);
  assert.doesNotMatch(JSON.stringify(proof),/API_KEY|TOKEN|SERVICE_ROLE/i);
});

test('v153 degrades unavailable integrations instead of claiming them active',()=>{
  const matrix=structuredClone(fullMatrix);
  matrix.operational.webResearch=false;
  matrix.operational.publicResearch=false;
  matrix.operational.githubSearch=false;
  matrix.operational.persistentMemory=false;
  matrix.operational.generativeInference=false;
  matrix.research={academic:false,recentNews:false,encyclopedia:false};
  const proof=capabilityProofSnapshot({capabilityMatrix:matrix});
  const research=proof.areas.find(x=>x.id==='research');
  const runtime=proof.areas.find(x=>x.id==='inference_runtime');
  const experience=proof.areas.find(x=>x.id==='work_experience');
  assert.equal(research.state,'unavailable');
  assert.equal(runtime.state,'conditional');
  assert.ok(experience.limits.some(x=>/Persistencia remota no verificada/i.test(x)));
  assert.ok(experience.limits.some(x=>/GitHub requiere conexión autorizada/i.test(x)));
});

test('v153 proof line is concise and points to inspectable evidence',()=>{
  const proof=capabilityProofSnapshot({capabilityMatrix:fullMatrix});
  const line=capabilityProofLine(proof);
  assert.match(line,/Estado operativo verificable/i);
  assert.match(line,/8\/8 áreas verificadas/);
  assert.match(line,/\/api\/capabilities\/proof/);
});

test('v153 is wired into self-description, runtime, API and server routes',()=>{
  const core=readFileSync(new URL('../lib/core-self-description.js',import.meta.url),'utf8');
  const runtime=readFileSync(new URL('../lib/runtime.js',import.meta.url),'utf8');
  const api=readFileSync(new URL('../api/capabilities.js',import.meta.url),'utf8');
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.match(core,/v153-proof-layer/);
  assert.match(core,/capabilityProofLine\(proof\)/);
  assert.match(runtime,/runtime_capabilities\/v153/);
  assert.match(runtime,/extras:\{capabilityMatrix,capabilityProof\}/);
  assert.match(api,/\n\s*capabilityProof,/);
  assert.match(api,/\/api\/capabilities\/proof/);
  assert.match(server,/\['\/api\/capabilities\/proof', capabilitiesHandler\]/);
});
