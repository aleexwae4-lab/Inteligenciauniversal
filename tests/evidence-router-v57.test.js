import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planEvidenceRoutes, framesForRole, synthesisFrames, publicEvidenceTrace, EVIDENCE_ROUTER_VERSION } from '../lib/evidence-router-v57.js';
import { EXECUTIVE_ORCHESTRATION_VERSION } from '../lib/executive-orchestration-v52.js';

const specialists=[
  {role:'CTO',name:'CTO Tecnología'},
  {role:'CFO',name:'CFO Financiero'}
];

const library={
  used:true,
  coverageEstimate:41743320,
  evidence:[
    {title:'Designing Data-Intensive Applications',authors:['Martin Kleppmann'],subjects:['software architecture','data systems','scalability'],source:'open_library',evidenceClass:'bibliographic_metadata'},
    {title:'Corporate Finance',authors:['Jonathan Berk','Peter DeMarzo'],subjects:['finance','valuation','investment','cash flow'],source:'open_library',evidenceClass:'bibliographic_metadata'},
    {title:'Site Reliability Engineering',authors:['Betsy Beyer'],subjects:['software','reliability','systems engineering'],source:'open_library',evidenceClass:'bibliographic_metadata'}
  ]
};

test('v57 routes shared bibliographic retrieval to the most relevant executive role',()=>{
  const plan=planEvidenceRoutes({message:'Diseña una arquitectura de software escalable y calcula inversión, ROI y costo operativo',specialists,library,maxPerRole:2});
  assert.equal(plan.version,EVIDENCE_ROUTER_VERSION);
  assert.equal(plan.strategy,'single-retrieval+role-scoped-ranking+typed-context');
  const cto=plan.routes.find(x=>x.role==='CTO');
  const cfo=plan.routes.find(x=>x.role==='CFO');
  assert.equal(cto.evidence[0].item.title,'Designing Data-Intensive Applications');
  assert.equal(cfo.evidence[0].item.title,'Corporate Finance');
  assert.ok(cto.evidenceCount<=2);
  assert.ok(cfo.evidenceCount<=2);
});

test('role evidence is emitted as typed bibliographic context rather than user-message contamination',()=>{
  const plan=planEvidenceRoutes({message:'Arquitectura escalable y finanzas',specialists,library,maxPerRole:2});
  const cto=plan.routes.find(x=>x.role==='CTO');
  const frames=framesForRole(cto,library);
  assert.equal(frames.length,1);
  assert.equal(frames[0].type,'library_evidence');
  assert.equal(frames[0].disclosure,'cite_metadata');
  assert.match(frames[0].source,/evidence-router\/v57:CTO/);
  assert.match(frames[0].content,/41,743,320 registros bibliográficos/);
});

test('synthesis receives specialist work as private tool evidence and bibliographic metadata separately',()=>{
  const plan=planEvidenceRoutes({message:'Arquitectura escalable y finanzas',specialists,library,maxPerRole:2});
  const frames=synthesisFrames(plan,[{role:'CTO',reply:'Propongo arquitectura desacoplada.'},{role:'CFO',reply:'Propongo escenarios de ROI.'}],library);
  assert.ok(frames.some(x=>x.type==='library_evidence'&&x.disclosure==='cite_metadata'));
  assert.ok(frames.some(x=>x.type==='tool_evidence'&&x.disclosure==='never'));
});

test('public evidence trace exposes routing metadata but never raw book text or specialist analysis',()=>{
  const plan=planEvidenceRoutes({message:'Arquitectura escalable y finanzas',specialists,library,maxPerRole:2});
  const trace=publicEvidenceTrace(plan);
  const serialized=JSON.stringify(trace);
  assert.equal(trace.library_used,true);
  assert.equal(trace.routed_roles.length,2);
  assert.doesNotMatch(serialized,/Kleppmann|Corporate Finance|Propongo|snippet/i);
});

test('executive v57 uses context trust plane and never concatenates library context into the user prompt',async()=>{
  const source=await readFile(new URL('../lib/executive-orchestration-v52.js',import.meta.url),'utf8');
  assert.equal(EVIDENCE_ROUTER_VERSION,'evidence-router/v57');
  assert.equal(EXECUTIVE_ORCHESTRATION_VERSION,'db-executive-orchestrator/v57-evidence-router');
  assert.match(source,/planEvidenceRoutes/);
  assert.match(source,/buildTrustedContextHistory/);
  assert.match(source,/framesForRole/);
  assert.match(source,/synthesisFrames/);
  assert.doesNotMatch(source,/specialistPrompt\(agent,message,library\.context\)/);
  assert.doesNotMatch(source,/synthesisPrompt\(message,usable,library\.context\)/);
  assert.match(source,/maxSpecialists=explicit\?3:2/);
});
