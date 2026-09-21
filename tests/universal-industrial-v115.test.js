import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {industrialCatalog,planIndustrialMission,industrialSystemInstruction,publicIndustrialPlan,UNIVERSAL_INDUSTRIAL_VERSION} from '../lib/universal-industrial-v115.js';
import {planNativeMission,attachMissionMetadata} from '../lib/mission-control-v114.js';

test('industrial catalog covers physical, digital and institutional sectors without claiming hardware',()=>{
  const catalog=industrialCatalog();
  assert.equal(catalog.version,UNIVERSAL_INDUSTRIAL_VERSION);
  assert.equal(catalog.domains.length,14);
  for(const id of ['aerospace_aircraft','spaceflight','automotive','motorcycles','marine','engines','manufacturing','universities','computing','robotics','semiconductors','technology_plants','public_administration','society'])
    assert.ok(catalog.domains.some(x=>x.id===id),id);
});
test('aviation maintenance selects evidence-gated lifecycle and specialist roles',()=>{
  const mission=planIndustrialMission('Diagnostica y da mantenimiento a un avión');
  assert.ok(mission.domains.some(x=>x.id==='aerospace_aircraft'));
  assert.equal(mission.safetyCritical,true);
  assert.ok(mission.lifecycle.includes('diagnose'));
  assert.ok(mission.lifecycle.includes('maintain'));
  assert.ok(mission.roles.includes('aerospace_systems'));
  assert.match(industrialSystemInstruction(mission),/No inventes torques/);
  assert.match(industrialSystemInstruction(mission),/firma del personal competente/);
});
test('road vehicle, motorcycle, marine and engines map to distinct roles',()=>{
  for(const [q,id] of [
    ['Repara una moto','motorcycles'],['Revisa el motor de un barco','marine'],
    ['Diseña un motor térmico','engines'],['Da mantenimiento a un carro','automotive']
  ])assert.ok(planIndustrialMission(q)?.domains.some(x=>x.id===id),q);
});
test('semiconductors, robotics and industrial plants do not silently promise physical execution',()=>{
  for(const q of ['Diseña un chip','Construye un robot','Administra una planta tecnológica','Dirige una fábrica']){
    const plan=planIndustrialMission(q);
    assert.ok(plan, q);
    assert.equal(plan.safetyCritical,true);
    assert.match(industrialSystemInstruction(plan),/no lo simules/i);
  }
});
test('education and public administration remain neutral institutional support',()=>{
  const university=planIndustrialMission('Dirige una universidad');
  const government=planIndustrialMission('Administra los servicios de un municipio');
  const society=planIndustrialMission('Construye una cooperativa para una sociedad');
  assert.equal(university.safetyCritical,false);
  assert.equal(government.institutional,true);
  assert.equal(society.institutional,true);
  assert.match(industrialSystemInstruction(government),/manera neutral/);
  assert.match(industrialSystemInstruction(government),/no asumas autoridad/);
});
test('unrelated casual messages do not activate industrial expertise',()=>{
  assert.equal(planIndustrialMission('Hola, ¿cómo estás?'),null);
  assert.equal(planIndustrialMission('Escribe un poema corto'),null);
});
test('native mission and metadata expose sector plan without leaking internal instruction',()=>{
  const message='Repara una motocicleta';
  const plan=planNativeMission({message},message);
  assert.ok(plan.industrial);
  const result=attachMissionMetadata({reply:'Diagnóstico preliminar',response:{metadata:{}}},plan,[]);
  assert.equal(result.mission_control.industrial.version,UNIVERSAL_INDUSTRIAL_VERSION);
  assert.ok(result.mission_control.industrial.domains.some(x=>x.id==='motorcycles'));
  assert.equal(publicIndustrialPlan(plan.industrial).executionPolicy,'human-approved-authoritative-procedures');
  assert.equal(JSON.stringify(result.mission_control).includes('SEGURIDAD CRÍTICA'),false);
});
test('the primary and native runtime actually inject the industrial system contract',()=>{
  const main=readFileSync(new URL('../lib/runtime.js',import.meta.url),'utf8');
  const native=readFileSync(new URL('../lib/native-brain-v5.js',import.meta.url),'utf8');
  assert.match(main,/industrialSystemInstruction\(industrialMission\)/);
  assert.match(main,/!contextualFollowup&&!userContextState\.affectsGeneration&&!industrialMission/);
  assert.match(native,/industrialSystemInstruction\(industrial\)/);
  assert.match(native,/industrial:mission\.industrial/);
});
