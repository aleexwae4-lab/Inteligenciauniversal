import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAdaptiveAssetIntelligenceV102, buildAdaptiveAssetIntelligenceV102, ADAPTIVE_ASSET_INTELLIGENCE_V102 } from '../lib/adaptive-asset-intelligence-v102.js';

test('v102 adapts an explicit lawyer profile into legal work product without losing universal context',()=>{
  const {body,publicContext}=applyAdaptiveAssetIntelligenceV102({userKey:'u-1',message:'Analiza este contrato, detecta riesgos y prepara estrategia para una posible controversia.',operator_context:{profession:'Abogado',specialty:'derecho corporativo',jurisdiction:'Jalisco'}});
  assert.equal(body.adaptive_asset_intelligence_version,ADAPTIVE_ASSET_INTELLIGENCE_V102);assert.equal(publicContext.context.working_domain,'legal');assert.equal(publicContext.asset.type,'legal_work_product');assert.equal(publicContext.capability_router.verification.level,'strict');assert.match(body.preferences.projectInstructions,/Activo objetivo: legal_work_product/);
});

test('v102 detects forensic task specialization without inventing operator identity',()=>{const plan=buildAdaptiveAssetIntelligenceV102({message:'Analiza la evidencia digital, verifica hashes, cadena de custodia y prepara un dictamen pericial.'});assert.equal(plan.context.task.domain,'forensic');assert.equal(plan.context.operator.profession,null);assert.equal(plan.context.provenance.operator,'unknown');assert.equal(plan.asset.assetType,'forensic_work_product')});

test('v102 does not infer employment from a hypothetical company mention',()=>{const plan=buildAdaptiveAssetIntelligenceV102({message:'Por ejemplo, un ingeniero que trabaja en SpaceX debe recibir mejores herramientas de planificación.'});assert.equal(plan.context.operator.organization,null);assert.equal(plan.context.provenance.organization,'unknown')});

test('v102 accepts direct self-identification and creates engineering operating mode',()=>{const plan=buildAdaptiveAssetIntelligenceV102({message:'Soy ingeniero aeroespacial y trabajo en SpaceX. Necesito planear una campaña de pruebas térmicas.'});assert.equal(plan.context.operatorDomain,'engineering');assert.equal(plan.context.operator.organization,'SpaceX');assert.equal(plan.context.provenance.operator,'self_identified_in_message');assert.equal(plan.asset.assetType,'engineering_work_product')});

test('v102 partitions memory only with explicit scope identifiers and never exposes the scoped key',()=>{const {body,publicContext}=applyAdaptiveAssetIntelligenceV102({userKey:'user-77',projectId:'project-9',caseId:'case-4',message:'Analiza el expediente y prepara la cronología.'});assert.notEqual(body.userKey,'user-77');assert.match(body.userKey,/project:project-9/);assert.match(body.userKey,/case:case-4/);assert.equal(publicContext.memory.partitioned,true);assert.equal('scopedUserKey' in publicContext.memory,false)});

test('v102 keeps trivial general questions lightweight',()=>{const {body,publicContext}=applyAdaptiveAssetIntelligenceV102({message:'¿Cuánto es 100 x 200?'});assert.equal(publicContext.context.working_domain,'general');assert.equal(publicContext.asset.type,'actionable_answer');assert.equal(publicContext.context.complexity,'simple');assert.notEqual(body.multiagent,true)});
