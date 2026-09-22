import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {industrialCatalog,planIndustrialMission,industrialSystemInstruction,publicIndustrialPlan,UNIVERSAL_INDUSTRIAL_VERSION} from '../lib/universal-industrial-v115.js';
import {runtimeHealth} from '../lib/runtime.js';
import {coreSelfResponse} from '../lib/core-self-description.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
function browserIndustrialMatcher(){
  const client=read('runtime-client.js');
  const start=client.indexOf('  const industrialQuery=value=>');
  const end=client.indexOf('  window.fetch=async(',start);
  assert.ok(start>0&&end>start,'v115 browser matcher must precede primary Supabase routing');
  const context={};
  vm.runInNewContext(client.slice(start,end)+'\nthis.industrialQuery=industrialQuery;',context);
  return context.industrialQuery;
}
test('this Render edition has all fourteen industrial and civilization domains',()=>{
  const catalog=industrialCatalog();
  assert.equal(catalog.version,UNIVERSAL_INDUSTRIAL_VERSION);
  assert.equal(catalog.domains.length,14);
  assert.equal(catalog.specialistProfileCount,21);
  for(const id of ['aerospace_aircraft','spaceflight','automotive','motorcycles','marine','engines','manufacturing','universities','computing','robotics','semiconductors','technology_plants','public_administration','society'])assert.ok(catalog.domains.some(x=>x.id===id),id);
  const status=runtimeHealth();
  assert.equal(status.industrialEngineering.version,UNIVERSAL_INDUSTRIAL_VERSION);
  assert.equal(status.industrialEngineering.specialistProfiles,21);
  assert.equal(status.industrialEngineering.physicalExecution,false);
});
test('actual Render and browser classifiers agree on sector missions',()=>{
  const browser=browserIndustrialMatcher();
  for(const text of ['Repara una moto','Diagnostica un avión','Diseña un cohete','Mantén un barco','Construye motores','Dirige una fábrica','Gestiona una universidad','Repara una computadora','Construye un robot','Diseña un chip','Administra una planta tecnológica','Organiza el gobierno municipal','Construye una sociedad cooperativa']){
    assert.ok(planIndustrialMission(text),text+' backend');
    assert.equal(browser(text),true,text+' browser');
  }
  for(const q of ['Hola, ¿cómo estás?','Escribe un poema de amor','¿Puedes competir contra Google?']){
    assert.equal(planIndustrialMission(q),null);
    assert.equal(browser(q),false);
  }
});
test('aircraft and spaceflight instructions require authoritative evidence and human release',()=>{
  for(const q of ['Repara un avión','Diseña un cohete']){
    const mission=planIndustrialMission(q);
    assert.equal(mission.safetyCritical,true);
    assert.match(industrialSystemInstruction(mission),/manuales autorizados/);
    assert.match(industrialSystemInstruction(mission),/Arquitectura aeronáutica y espacial/);
    assert.match(industrialSystemInstruction(mission),/No inventes torques/);
    assert.match(industrialSystemInstruction(mission),/firma del personal competente/);
    assert.equal(publicIndustrialPlan(mission).executionPolicy,'human-approved-authoritative-procedures');
  }
});
test('public-service missions remain politically neutral and never claim authority',()=>{
  const mission=planIndustrialMission('Dirige el gobierno de un municipio');
  assert.equal(mission.institutional,true);
  assert.match(industrialSystemInstruction(mission),/manera neutral/);
  assert.match(industrialSystemInstruction(mission),/no asumas autoridad/);
});
test('live user-visible chat routes industry to real Render backend without replacing Canvas or UI',()=>{
  const client=read('runtime-client.js'),runtime=read('lib/runtime.js');
  const shortcut=client.indexOf('if(request.canvas!==true&&(industrialQuery(request.message)||professionalQuery(request.message)))return nativeFetch(input,init);');
  const upstream=client.indexOf('      await bootstrap(init.signal);',shortcut);
  assert.ok(shortcut>0&&upstream>shortcut,'sector-specific chat must bypass generic upstream');
  assert.match(client,/request.canvas_direct===true\|\|request.canvas_blueprint===true/);
  assert.match(runtime,/const industrialMission = planIndustrialMission\(message,\{attachments\}\)/);
  assert.match(runtime,/industrialSystemInstruction\(industrialMission\)/);
  assert.match(runtime,/industrial_engineering:publicIndustrialPlan\(industrialMission\)/);
  assert.match(runtime,/webEnabled:researchEnabled/);
});
test('premium UI and cache-busted web route remain consistent',()=>{
  const html=read('index.html'),sw=read('sw.js'),app=read('app.js');
  assert.match(html,/runtime-client\.js\?v=24&industrial=v115/);
  assert.match(sw,/runtime-client\.js\?v=24&industrial=v115/);
  assert.match(sw,/wae-universal-render-intelligence-v38/);
  assert.match(app,/fetch\('\/api\/chat'/);
});
test('capability identity remains concise, honest and sector aware',()=>{
  const reply=coreSelfResponse({providers:[],tools:[],memory:{configured:false}});
  assert.match(reply,/Ingeniería y organizaciones/);
  assert.match(reply,/aeronaves/);
  assert.match(reply,/No opero equipos físicos/);
  assert.ok(reply.length<1100,'identity text must remain concise');
});
