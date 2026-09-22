import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {worldCatalog,planWorldMission,worldSystemInstruction,publicWorldPlan,WORLD_INTELLIGENCE_VERSION} from '../lib/universal-world-intelligence-v117.js';
import {planIndustrialMission} from '../lib/universal-industrial-v115.js';
import {planProfessionalMission} from '../lib/universal-professional-v116.js';
import {runtimeHealth} from '../lib/runtime.js';
import {coreSelfResponse} from '../lib/core-self-description.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function browserWorld(){
  const src=read('runtime-client.js');
  const start=src.indexOf('  const worldQuery=value=>'),end=src.indexOf('  window.fetch=async(',start);
  assert.ok(start>0&&end>start,'global selector exists before provider route');
  const ctx={};vm.runInNewContext(src.slice(start,end)+'\nthis.worldQuery=worldQuery;',ctx);
  return ctx.worldQuery;
}
test('v117 exposes 14 global problem packs and 16 concrete analytical disciplines',()=>{
  const catalog=worldCatalog(),health=runtimeHealth().worldIntelligence;
  assert.equal(catalog.version,WORLD_INTELLIGENCE_VERSION);
  assert.equal(catalog.domainCount,14);
  assert.equal(catalog.specialistProfileCount,16);
  assert.equal(health.version,WORLD_INTELLIGENCE_VERSION);
  assert.equal(health.realWorldIntervention,false);
  assert.equal(health.unverifiedOutcomes,false);
  for(const id of ['public_health','climate','water','food','energy','education','poverty','housing','cybersecurity','disasters','science','supply_chain','biodiversity','displacement'])assert.ok(catalog.domains.some(d=>d.id===id),id);
});
test('browser and real server both route world problems to the new local brain',()=>{
  const browser=browserWorld();
  const cases=[
    ['Ayúdame a resolver problemas de nivel mundial','cross_sector'],
    ['Busco soluciones para problemas complejos que afectan a la humanidad a nivel mundial','cross_sector'],
    ['Solucionar hambre mundial y escasez de agua','food'],
    ['Analiza el cambio climático','climate'],
    ['Respuesta a una pandemia de salud pública','public_health'],
    ['Seguridad alimentaria mundial','food'],
    ['Resolver la crisis energética','energy'],
    ['Eliminar la brecha educativa','education'],
    ['Reducir pobreza y desigualdad','poverty'],
    ['Crisis de vivienda','housing'],
    ['Defenderse de ciberataques','cybersecurity'],
    ['Respuesta a desastres naturales','disasters'],
    ['Investigar retos científicos','science'],
    ['Resolver cadenas de suministro','supply_chain'],
    ['Proteger biodiversidad','biodiversity'],
    ['Ayuda ante la crisis migratoria','displacement']
  ];
  for(const [q,id] of cases){
    assert.equal(browser(q),true,'client missed '+q);
    assert.ok(planWorldMission(q)?.domains.some(d=>d.id===id),'server missed '+q);
  }
  for(const q of ['Hola, ¿cómo estás?','Escribe un poema de amor','¿Qué puedes hacer?','Se podría decir que eres equivalente a Google?']){
    assert.equal(browser(q),false,'client misrouted '+q);
    assert.equal(planWorldMission(q),null,'backend misrouted '+q);
  }
});
test('cross-sector missions provide reproducible fieldwork and honest evidence status',()=>{
  const mission=planWorldMission('Solucionar hambre mundial y escasez de agua',{attachments:[{name:'user.csv'}]});
  assert.equal(mission.crossSector,true);
  assert.equal(mission.attachmentCount,1);
  assert.equal(mission.evidenceStatus,'not_verified_by_classifier');
  for(const phase of ['define','baseline','systems_map','options','pilot','scale','verify'])assert.ok(mission.phases.some(x=>x.id===phase),phase);
  const output=publicWorldPlan(mission);
  assert.ok(output.roles.includes('data_evidence'));
  assert.ok(output.roles.includes('ethics_safety'));
  assert.ok(output.dataRequired.includes('fuentes primarias verificables'));
  assert.equal(Object.hasOwn(output,'attachmentCount'),false);
});
test('global instruction requires measurable, locally authorized and neutral solutions',()=>{
  const instruction=worldSystemInstruction(planWorldMission('Resolver problemas de nivel mundial'));
  assert.match(instruction,/pregunta específica/);
  assert.match(instruction,/pilotos medibles/);
  assert.match(instruction,/neutralidad/);
  assert.match(instruction,/atribución y fecha/);
  assert.match(instruction,/No afirmes que resolviste materialmente/);
  assert.match(instruction,/decisión y ejecución corresponden a humanos/);
});
test('public-health and disaster interventions preserve professional safeguards',()=>{
  for(const q of ['Mejora la salud pública durante una pandemia','Respuesta a desastres naturales']){
    const mission=planWorldMission(q);
    assert.equal(mission.critical,true);
    assert.match(worldSystemInstruction(mission),/autorización local/);
    assert.match(worldSystemInstruction(mission),/no inventes protocolos/);
  }
});
test('v117 augments v115 engineering and v116 financial contexts without replacing them',()=>{
  const q='Planifica un laboratorio para una pandemia mundial y su presupuesto empresarial';
  assert.ok(planWorldMission(q));
  assert.ok(planProfessionalMission(q));
  const runtime=read('lib/runtime.js'),client=read('runtime-client.js');
  assert.match(runtime,/worldSystemInstruction\(worldMission\)/);
  assert.match(runtime,/industrialSystemInstruction\(industrialMission\)/);
  assert.match(runtime,/professionalSystemInstruction\(professionalMission\)/);
  assert.match(runtime,/world_intelligence:publicWorldPlan\(worldMission\)/);
  assert.match(runtime,/worldDomain:worldMission\?\.domains/);
  assert.match(client,/if\(request\.canvas!==true&&worldQuery\(request\.message\)\)return nativeFetch\(input,init\);/);
  assert.match(client,/if\(request\.canvas!==true&&\(industrialQuery\(request\.message\)\|\|professionalQuery\(request\.message\)\)\)return nativeFetch\(input,init\);/);
  assert.match(client,/request\.canvas_direct===true\|\|request\.canvas_blueprint===true/);
  assert.ok(planIndustrialMission('Diseña un cohete'));
});
test('PWA, existing UI and installation health remain compatible',()=>{
  const html=read('index.html'),sw=read('sw.js');
  assert.match(html,/runtime-client\.js\?v=24&industrial=v115&professional=v116&world=v117/);
  assert.match(sw,/runtime-client\.js\?v=24&industrial=v115&professional=v116&world=v117/);
  assert.match(sw,/wae-universal-render-firstturn-v42/);
  const identity=coreSelfResponse({providers:[{id:'wae_edge',configured:true}],tools:[{id:'web_search',configured:false},{id:'github_search',configured:false}],memory:{configured:false}});
  assert.match(identity,/retos mundiales con evidencia/);
  assert.ok(identity.length<1100,'identity must remain mobile friendly');
});
