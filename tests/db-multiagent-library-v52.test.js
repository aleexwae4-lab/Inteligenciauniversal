import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildIdentityReply, formatCoverage, UNIVERSAL_CONTEXT_VERSION } from '../lib/universal-context-v52.js';
import { libraryRelevant, publicLibraryMetadata, LIBRARY_INTELLIGENCE_VERSION } from '../lib/library-intelligence-v52.js';
import { shouldUseExecutiveOrchestrator, planDatabaseExecutiveRoles, EXECUTIVE_ORCHESTRATION_VERSION } from '../lib/executive-orchestration-v52.js';

const manifest={
  activeAgentInstances:88,
  executiveRoles:22,
  collaborationEdges:448,
  agents:[
    {role:'CEO',name:'CEO Estratégico',mission:'Dirección estratégica y prioridades',responsibilities:['Definir rumbo'],frameworks:['OKR'],guardrails:['No inventar datos']},
    {role:'CTO',name:'CTO Tecnología',mission:'Arquitectura, ingeniería, resiliencia y costo técnico',responsibilities:['Evaluar arquitectura'],frameworks:['SRE','DORA'],guardrails:['Pruebas y rollback']},
    {role:'CFO',name:'CFO Financiero',mission:'Rentabilidad, presupuesto, ROI y escenarios',responsibilities:['Cuantificar impacto financiero'],frameworks:['FP&A','DCF'],guardrails:['Mostrar fórmulas']},
    {role:'CISO',name:'CISO',mission:'Reducir riesgo cibernético',responsibilities:['Evaluar amenazas'],frameworks:['NIST CSF'],guardrails:['No exponer secretos']},
    {role:'Consultor General',name:'Consultor General',mission:'Síntesis multidisciplinaria',responsibilities:['Enmarcar problemas'],frameworks:['MECE'],guardrails:['No ocultar incertidumbre']}
  ],
  collaborations:[
    {sourceRole:'CTO',targetRole:'CFO',type:'primary_advisory',weight:4},
    {sourceRole:'CFO',targetRole:'CTO',type:'primary_advisory',weight:4}
  ]
};

test('identity claim says Universal Core and millions of bibliographic records without claiming copyrighted fulltext',()=>{
  const reply=buildIdentityReply({
    executiveOrchestration:{executiveRoles:22,activeAgentInstances:88,collaborationEdges:448},
    library:{federatedMetadataCoverageEstimate:41743320,fulltextCoverageEstimate:79285}
  });
  assert.match(reply,/Universal Core/);
  assert.match(reply,/22 roles especializados/);
  assert.match(reply,/41\.7 millones de registros de libros/);
  assert.match(reply,/79,285 obras/);
  assert.doesNotMatch(reply,/41\.7 millones de libros completos|millones de libros completos|millones de textos completos/i);
  assert.equal(UNIVERSAL_CONTEXT_VERSION,'universal-context/v52');
});

test('coverage formatter preserves million-scale and open collection counts',()=>{
  assert.equal(formatCoverage(41743320),'41.7 millones');
  assert.equal(formatCoverage(79285),'79,285');
});

test('database orchestrator automatically activates for complex executive engineering task',()=>{
  const body={message:'Analiza la arquitectura de inteligencia artificial de la empresa, estima su costo y recomienda cómo escalarla de forma segura',mode:'auto'};
  assert.equal(shouldUseExecutiveOrchestrator(body),true);
  const plan=planDatabaseExecutiveRoles(body.message,manifest,[]);
  assert.equal(plan.dbBacked,true);
  assert.equal(plan.executiveRoles,22);
  assert.ok(plan.specialists.length>=2&&plan.specialists.length<=3);
  const roles=plan.specialists.map(x=>x.role);
  assert.ok(roles.includes('CTO'));
  assert.ok(roles.includes('CFO'));
  assert.equal(plan.schema,EXECUTIVE_ORCHESTRATION_VERSION);
});

test('ordinary short conversation does not fan out to executive committee',()=>{
  assert.equal(shouldUseExecutiveOrchestrator({message:'Hola, ¿cómo estás?',mode:'auto'}),false);
  assert.equal(shouldUseExecutiveOrchestrator({message:'¿Cuánto es 2 + 2?',mode:'auto'}),false);
});

test('book questions are eligible for the rights-aware library layer',()=>{
  assert.equal(libraryRelevant('Analiza el libro El arte de la guerra y compáralo con estrategia empresarial','general'),true);
  assert.equal(libraryRelevant('¿Cómo estás?','general'),false);
  const meta=publicLibraryMetadata({used:true,version:LIBRARY_INTELLIGENCE_VERSION,coverageEstimate:41743320,evidence:[{source:'open_library'},{source:'project_gutenberg'}]});
  assert.equal(meta.rights_aware,true);
  assert.equal(meta.coverage_estimate,41743320);
  assert.deepEqual(meta.sources,['open_library','project_gutenberg']);
});

test('main chat wrapper wires DB multi-agent, library intelligence and self-description before ordinary runtime',async()=>{
  const source=await readFile(new URL('../api/capacity-chat.js',import.meta.url),'utf8');
  assert.match(source,/runExecutiveOrchestration/);
  assert.match(source,/runLibraryAnswer/);
  assert.match(source,/getUniversalSelfDescription/);
  assert.match(source,/database-backed-v52/);
  assert.match(source,/rights-aware-v52/);
});

test('explicit orchestrate endpoint is DB-backed rather than legacy static planMission',async()=>{
  const source=await readFile(new URL('../api/orchestrate.js',import.meta.url),'utf8');
  assert.match(source,/runExecutiveOrchestration/);
  assert.match(source,/database-backed-v52/);
  assert.doesNotMatch(source,/planMission\(/);
  assert.doesNotMatch(source,/specialistPrompt\(/);
});
