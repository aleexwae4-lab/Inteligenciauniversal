import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MISSION_CONTROL_VERSION, planNativeMission, verifiedToolSources, executeNativeReadTools, attachMissionMetadata } from '../lib/mission-control-v114.js';

test('live research activates read-only web tool and evidence policy',()=>{
  const mission=planNativeMission({message:'Investiga las noticias de hoy sobre IA'},'Investiga las noticias de hoy sobre IA');
  assert.equal(mission.version,MISSION_CONTROL_VERSION);
  assert.equal(mission.requiresLive,true);
  assert.ok(mission.toolIds.includes('web_search'));
  assert.equal(mission.mode,'research');
});
test('explicit web disable is preserved even for news and requested tools',()=>{
  const message='Noticias de hoy sobre IA';
  const mission=planNativeMission({message,web_enabled:false,tools:['web_search']},message);
  assert.equal(mission.requiresLive,false);
  assert.equal(mission.toolIds.includes('web_search'),false);
});
test('repository tooling requires explicit repository reference, not invented default repo',()=>{
  const message='Audita el backend de repo:aleexwae4-lab/Inteligenciauniversal';
  const mission=planNativeMission({message},message);
  assert.ok(mission.toolIds.includes('github_search'));
  assert.equal(planNativeMission({message:'Audita este código'},'Audita este código').toolIds.includes('github_search'),false);
});
test('ordinary conversation avoids unnecessary tool execution',async()=>{
  const mission=planNativeMission({message:'Hola'},'Hola');
  assert.deepEqual(mission.toolIds,[]);
  assert.deepEqual(await executeNativeReadTools(mission,'Hola'),[]);
});
test('verified sources only come from successful observed tool results',()=>{
  const result=verifiedToolSources([
    {tool:'web_search',ok:false,data:[{url:'https://invalid.example'}]},
    {tool:'web_search',ok:true,data:[{url:'https://valid.example/one',title:'Source 1'},{url:'https://valid.example/one',title:'duplicate'},{url:'javascript:alert(1)',title:'unsafe'}]}
  ]);
  assert.equal(result.length,1);
  assert.equal(result[0].url,'https://valid.example/one');
});
test('response retains provenance, no claimed tool successes when not executed',()=>{
  const mission=planNativeMission({message:'Hola'},'Hola');
  const result=attachMissionMetadata({reply:'Hola',response:{metadata:{}}},mission,[]);
  assert.equal(result.response.metadata.missionControl.version,MISSION_CONTROL_VERSION);
  assert.deepEqual(result.mission_control.tools,[]);
  assert.equal(result.mission_control.evidenceSources,0);
});
test('native brain wires mission plan, memory, real tools and bounded quality path',()=>{
  const source=readFileSync(new URL('../lib/native-brain-v5.js',import.meta.url),'utf8');
  assert.match(source,/planNativeMission\(payload,message,history,attachments\)/);
  assert.match(source,/executeNativeReadTools\(mission,message\)/);
  assert.match(source,/missionToolContext\(toolResults\)/);
  assert.match(source,/verifiedToolSources\(toolResults\)/);
  assert.match(source,/attachMissionMetadata\(envelope\(args\),mission,observedTools\)/);
  assert.match(source,/payload.web_enabled===false\?false/);
  assert.match(source,/NATIVE_AUTO_PRIMARY/);
});
