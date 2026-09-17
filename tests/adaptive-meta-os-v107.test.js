import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ADAPTIVE_META_OS_V107,
  executionLevelV107,
  professionalPacksV107,
  problemToProjectIntentV107,
  buildAdaptiveMetaOSStateV107,
} from '../lib/adaptive-meta-os-v107.js';
import {
  PERSONAL_VALUE_LEDGER_V107,
  valueCandidatesFromTurnV107,
  personalValueLedgerCapabilitiesV107,
} from '../lib/personal-value-ledger-v107.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('v107 separates KNOW, CREATE and DO without treating every creation as a side effect',()=>{
  assert.equal(executionLevelV107('Explícame qué es insuficiencia renal'),'know');
  assert.equal(executionLevelV107('Crea un informe clínico con estos datos'),'create');
  assert.equal(executionLevelV107('Despliega la aplicación en Render y actualiza el endpoint'),'do');
});

test('v107 activates professional packs from current task and explicit profile',()=>{
  const medical=professionalPacksV107('Analiza estos resultados de laboratorio y prepara una nota clínica',{});
  assert.equal(medical.some(x=>x.id==='medicine_core'),true);
  assert.equal(medical.find(x=>x.id==='medicine_core').humanValidationRequired,true);

  const developer=professionalPacksV107('Corrige el backend',{professional_roles:['médico']});
  assert.equal(developer.some(x=>x.id==='developer_core'),true);
  assert.equal(developer.some(x=>x.id==='medicine_core'),true);
});

test('v107 converts long-horizon operating problems into project candidates',()=>{
  const project=problemToProjectIntentV107('Quiero abrir una clínica y construir todo el sistema operativo del consultorio');
  assert.equal(project.convert,true);
  assert.notEqual(project.reason,'single_turn_sufficient');
});

test('v107 operating state composes profession, kernel capabilities, agents, assets and value candidates',()=>{
  const state=buildAdaptiveMetaOSStateV107({
    message:'Construye una plataforma SaaS para mi despacho y prepara el roadmap, automatizaciones y estrategia de monetización',
    profile:{professional_roles:['abogado'],goals:['operar un despacho digital']}
  });
  assert.equal(state.version,ADAPTIVE_META_OS_V107);
  assert.equal(state.executionLevel,'create');
  assert.equal(state.professionalPacks.some(x=>x.id==='legal_core'),true);
  assert.equal(state.professionalPacks.some(x=>x.id==='business_core'),true);
  assert.equal(state.capabilityDomains.includes('conversation_reasoning'),true);
  assert.equal(state.capabilityDomains.includes('software_engineering'),true);
  assert.equal(Array.isArray(state.orchestration.specialists),true);
  assert.equal(state.projectIntent.convert,true);
  assert.equal(state.valueMeasurementCandidates.some(x=>x.category==='knowledge_asset'),true);
  assert.equal(state.governance.inventedMonetaryValue,false);
});

test('v107 value candidates never fabricate money or hours',()=>{
  const candidates=valueCandidatesFromTurnV107({
    userText:'Crea una estrategia para automatizar ventas',
    assistantText:'# Estrategia\n1. Automatiza calificación.\n2. Mide conversión.\n3. Documenta el flujo para reutilizarlo en futuras campañas.'
  });
  assert.ok(candidates.length>0);
  for(const candidate of candidates){
    assert.equal(candidate.status,'candidate');
    assert.equal(candidate.amount_mxn,null);
    assert.equal(candidate.hours_saved,null);
    assert.equal(candidate.evidence.verified,false);
  }
  const caps=personalValueLedgerCapabilitiesV107();
  assert.equal(caps.version,PERSONAL_VALUE_LEDGER_V107);
  assert.equal(caps.inventedMonetaryValue,false);
  assert.equal(caps.verifiedTotalsOnly,true);
});

test('v107 is wired into memory, capabilities and runtime route',async()=>{
  const [memory,capabilities,server,api]=await Promise.all([
    read('lib/memory.js'),read('api/capabilities.js'),read('server.js'),read('api/meta-os.js')
  ]);
  assert.match(memory,/recordValueCandidatesFromTurnV107/);
  assert.match(memory,/personalValueIntelligence:true/);
  assert.match(capabilities,/adaptiveMetaOS:/);
  assert.match(capabilities,/personalValueIntelligence:/);
  assert.match(server,/\/api\/meta-os/);
  assert.match(api,/buildAdaptiveMetaOSStateV107/);
});

test('v107 workspace cockpit is syntactically valid and uses the same opaque user scope for chat and meta-os',async()=>{
  const [workspace,premium,css]=await Promise.all([
    read('adaptive-workspace-v107.js'),read('premium-v5.js'),read('adaptive-workspace-v107.css')
  ]);
  assert.doesNotThrow(()=>new Function(workspace));
  assert.match(workspace,/USER_SCOPE_KEY='wae\.userScope\.v107'/);
  assert.match(workspace,/url\.pathname==='\/api\/chat'/);
  assert.match(workspace,/body\.userKey=body\.userKey\|\|userScope\(\)/);
  assert.match(workspace,/upstreamFetch\('\/api\/meta-os'/);
  assert.match(workspace,/data-tab="core"|dataset\.tab='core'/);
  assert.match(premium,/loadAdaptiveWorkspace\(\)/);
  assert.match(css,/wae107-panel/);
});
