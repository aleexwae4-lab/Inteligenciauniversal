import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildIdentityReply, formatCoverage, UNIVERSAL_CONTEXT_VERSION } from '../lib/universal-context-v52.js';
import { libraryRelevant, publicLibraryMetadata, LIBRARY_INTELLIGENCE_VERSION, compactLibraryQuery } from '../lib/library-intelligence-v52.js';
import { shouldUseLibraryAnswer, directBibliographicIntent, buildLibraryMetadataFallback, resolveLibraryConversation, bookFollowUpIntent, buildGroundedSummaryFallback } from '../lib/library-answer-v52.js';
import { shouldUseExecutiveOrchestrator, planDatabaseExecutiveRoles, EXECUTIVE_ORCHESTRATION_VERSION } from '../lib/executive-orchestration-v52.js';

const manifest={activeAgentInstances:88,executiveRoles:22,collaborationEdges:448,agents:[{role:'CEO',name:'CEO Estratégico',mission:'Dirección estratégica y prioridades',responsibilities:['Definir rumbo'],frameworks:['OKR'],guardrails:['No inventar datos']},{role:'CTO',name:'CTO Tecnología',mission:'Arquitectura, ingeniería, resiliencia y costo técnico',responsibilities:['Evaluar arquitectura'],frameworks:['SRE','DORA'],guardrails:['Pruebas y rollback']},{role:'CFO',name:'CFO Financiero',mission:'Rentabilidad, presupuesto,ROI y escenarios',responsibilities:['Cuantificar impacto financiero'],frameworks:['FP&A','DCF'],guardrails:['Mostrar fórmulas']},{role:'CISO',name:'CISO',mission:'Reducir riesgo cibernético',responsibilities:['Evaluar amenazas'],frameworks:['NIST CSF'],guardrails:['No exponer secretos']},{role:'Consultor General',name:'Consultor General',mission:'Síntesis multidisciplinaria',responsibilities:['Enmarcar problemas'],frameworks:['MECE'],guardrails:['No ocultar incertidumbre']}],collaborations:[{sourceRole:'CTO',targetRole:'CFO',type:'primary_advisory',weight:4},{sourceRole:'CFO',targetRole:'CTO',type:'primary_advisory',weight:4}]};

test('identity claim says Universal Core and millions of bibliographic records without claiming copyrighted fulltext',()=>{const reply=buildIdentityReply({executiveOrchestration:{executiveRoles:22,activeAgentInstances:88,collaborationEdges:448},library:{federatedMetadataCoverageEstimate:41743320,fulltextCoverageEstimate:79285}});assert.match(reply,/Universal Core/);assert.match(reply,/22 roles especializados/);assert.match(reply,/41\.7 millones de registros de libros/);assert.match(reply,/79,285 obras/);assert.doesNotMatch(reply,/41\.7 millones de libros completos|millones de libros completos|millones de textos completos/i);assert.equal(UNIVERSAL_CONTEXT_VERSION,'universal-context/v52')});

test('coverage formatter preserves million-scale and open collection counts',()=>{assert.equal(formatCoverage(41743320),'41.7 millones');assert.equal(formatCoverage(79285),'79,285')});

test('database orchestrator automatically activates for complex executive engineering task',()=>{const body={message:'Analiza la arquitectura de inteligencia artificial de la empresa, estima su costo y recomienda cómo escalarla de forma segura',mode:'auto'};assert.equal(shouldUseExecutiveOrchestrator(body),true);const plan=planDatabaseExecutiveRoles(body.message,manifest,[]);assert.equal(plan.dbBacked,true);assert.equal(plan.executiveRoles,22);assert.ok(plan.specialists.length>=2&&plan.specialists.length<=3);const roles=plan.specialists.map(x=>x.role);assert.ok(roles.includes('CTO'));assert.ok(roles.includes('CFO'));assert.equal(plan.schema,EXECUTIVE_ORCHESTRATION_VERSION)});

test('ordinary short conversation does not fan out to executive committee',()=>{assert.equal(shouldUseExecutiveOrchestrator({message:'Hola, ¿cómo estás?',mode:'auto'}),false);assert.equal(shouldUseExecutiveOrchestrator({message:'¿Cuánto es 2 + 2?',mode:'auto'}),false)});

test('book questions are rights-aware, while complex book missions are delegated to the executive committee',()=>{assert.equal(libraryRelevant('Analiza el libro El arte de la guerra y compáralo con estrategia empresarial','general'),true);assert.equal(libraryRelevant('¿Cómo estás?','general'),false);assert.equal(shouldUseLibraryAnswer({message:'¿Quién escribió El arte de la guerra?',mode:'auto'}),true);const complex={message:'Analiza libros de estrategia y diseña un plan de crecimiento empresarial para Universal Core con riesgos, costos y arquitectura',mode:'auto'};assert.equal(shouldUseExecutiveOrchestrator(complex),true);assert.equal(shouldUseLibraryAnswer(complex),false);const meta=publicLibraryMetadata({used:true,version:LIBRARY_INTELLIGENCE_VERSION,coverageEstimate:41743320,evidence:[{source:'open_library'},{source:'project_gutenberg'}]});assert.equal(meta.rights_aware,true);assert.equal(meta.coverage_estimate,41743320);assert.deepEqual(meta.sources,['open_library','project_gutenberg'])});

test('v67 normalizes the exact mobile book-recognition prompt into a title query',()=>{
  const prompt='¿Conoces el libro de Piense y hágase rico?';
  assert.equal(compactLibraryQuery(prompt),'Piense y hágase rico');
  assert.equal(shouldUseLibraryAnswer({message:prompt,mode:'auto'}),true);
  assert.equal(directBibliographicIntent(prompt),true);
});

test('v67 direct bibliographic answer stays useful when generative providers are unavailable',()=>{
  const prompt='¿Conoces el libro de Piense y hágase rico?';
  const reply=buildLibraryMetadataFallback(prompt,[{title:'Piense y hágase rico',authors:['Napoleon Hill'],year:1937,yearKind:'first_publish_year',source:'open_library',evidenceClass:'bibliographic_metadata'}]);
  assert.match(reply,/Piense y hágase rico/i);
  assert.match(reply,/Napoleon Hill/);
  assert.match(reply,/1937/);
  assert.match(reply,/Puedo resumirlo|analizarlo/i);
  assert.doesNotMatch(reply,/proveedores|fallaron|reintenta|no llegó completa/i);
});

test('v68 recognizes the exact elliptical follow-up from the clip and restores the book referent from history',()=>{
  const body={
    message:'De que trata ?',
    mode:'auto',
    history:[
      {role:'user',text:'Conoces el libro piense y hágase rico?'},
      {role:'assistant',text:'Sí. Encontré un registro bibliográfico de Piense y Hágase Rico.'}
    ]
  };
  assert.equal(bookFollowUpIntent(body.message),true);
  const resolved=resolveLibraryConversation(body);
  assert.equal(resolved.followUp,true);
  assert.match(resolved.message,/De qué trata el libro Piense y hágase rico/i);
  assert.equal(resolved.title.toLowerCase(),'piense y hágase rico');
  assert.equal(shouldUseLibraryAnswer(body),true);
});

test('v68 does not confuse a recent translation/catalog year with the original publication and suppresses polluted contributor lists',()=>{
  const prompt='¿Conoces el libro de Piense y hágase rico?';
  const library=[
    {title:'Piense y Hágase Rico',authors:['Napoleon Hill','Salvador vares','Damian Duarte','Editorial Editorial Americana'],year:2015,yearKind:'edition_or_catalog_year',source:'local_library',evidenceClass:'bibliographic_metadata'},
    {title:'Piense y Hágase Rico',authors:['Napoleon Hill','Otro colaborador'],year:2015,yearKind:'first_publish_year',source:'open_library',evidenceClass:'bibliographic_metadata'}
  ];
  const grounding=[
    {source:'wikipedia_es',title:'Piense y hágase rico',excerpt:'Piense y hágase rico es un libro de Napoleon Hill. Publicado en 1937, se asocia con la literatura de superación personal.'},
    {source:'google_books',title:'Piense y Hágase Rico',authors:['Napoleon Hill'],excerpt:'Libro de desarrollo personal sobre éxito, riqueza, deseo, planificación y persistencia.'}
  ];
  const reply=buildLibraryMetadataFallback(prompt,library,grounding);
  assert.match(reply,/Napoleon Hill/);
  assert.match(reply,/1937/);
  assert.doesNotMatch(reply,/2015|Salvador|Damian|Editorial Editorial|Otro colaborador/i);
});

test('v68 grounded follow-up summary remains useful without any generative provider',()=>{
  const message='¿De qué trata el libro Piense y hágase rico?';
  const library=[{title:'Piense y hágase rico',authors:['Napoleon Hill'],year:1937,yearKind:'first_publish_year',source:'open_library',subjects:['Self-help','Success in business']}];
  const grounding=[{source:'google_books',title:'Piense y hágase rico',authors:['Napoleon Hill'],excerpt:'A personal development and success book about wealth, desire, goals, faith, autosuggestion, organized planning, persistence, mastermind collaboration and fear.'}];
  const reply=buildGroundedSummaryFallback(message,grounding,library);
  assert.match(reply,/Piense y hágase rico/i);
  assert.match(reply,/Napoleon Hill/);
  assert.match(reply,/desarrollo personal|éxito|riqueza/i);
  assert.match(reply,/planificación|persistencia|metas/i);
  assert.doesNotMatch(reply,/proveedores|fallaron|reintenta|no llegó completa/i);
});

test('v68 library runtime contains context resolution and grounded direct follow-up lanes before provider generation',async()=>{
  const source=await readFile(new URL('../lib/library-answer-v52.js',import.meta.url),'utf8');
  assert.match(source,/library-grounded-followup-v68/);
  assert.match(source,/resolveLibraryConversation\(body\)/);
  assert.match(source,/resolved\.followUp&&groundedSummary/);
  assert.match(source,/edition_or_catalog_year/);
  assert.match(source,/corroboratedYears/);
});

test('automatic multi-agent execution is bounded to two specialists and explicit deep mode to three',async()=>{const source=await readFile(new URL('../lib/executive-orchestration-v52.js',import.meta.url),'utf8');assert.match(source,/maxSpecialists=explicit\?3:2/);assert.match(source,/plan\.specialists=plan\.specialists\.slice\(0,maxSpecialists\)/)});

test('main chat wrapper wires DB multi-agent, library intelligence and self-description before ordinary runtime',async()=>{const source=await readFile(new URL('../api/capacity-chat.js',import.meta.url),'utf8');assert.match(source,/runExecutiveOrchestration/);assert.match(source,/runLibraryAnswer/);assert.match(source,/getUniversalSelfDescription/);assert.match(source,/database-backed-v52/);assert.match(source,/rights-aware-v52/)});

test('explicit orchestrate endpoint is DB-backed rather than legacy static planMission',async()=>{const source=await readFile(new URL('../api/orchestrate.js',import.meta.url),'utf8');assert.match(source,/runExecutiveOrchestration/);assert.match(source,/database-backed-v52/);assert.doesNotMatch(source,/planMission\(/);assert.doesNotMatch(source,/specialistPrompt\(/)});
