import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCoreSelfQuery,coreSelfResponse,capabilitySnapshot,CORE_CAPABILITY_VERSION} from '../lib/core-self-description.js';
import {executeMission} from '../lib/runtime.js';

test('v132 reproduces the clip identity and capability prompts with WAE-native intelligence',()=>{
  for(const q of ['Quién eres?','Cuáles son tus capacidades?','Que más sabes hacer?'])assert.equal(isCoreSelfQuery(q),true,q);
  const identity=coreSelfResponse({question:'Quién eres?'});
  assert.match(identity,/Universal Core/);
  assert.match(identity,/WAE OS Enterprise/);
  assert.match(identity,/orquestaci[oó]n/i);
  assert.ok(identity.length<320);
  assert.doesNotMatch(identity,/soy (?:ChatGPT|Gemini|Claude)|modelo de OpenAI/i);

  const capabilities=coreSelfResponse({question:'Cuáles son tus capacidades?'});
  assert.match(capabilities,/F[aá]brica de software/i);
  assert.match(capabilities,/Industria y sistemas/i);
  assert.match(capabilities,/Problemas complejos y globales/i);
  assert.match(capabilities,/Workspace/i);
  assert.doesNotMatch(capabilities,/Comprensi[oó]n y generaci[oó]n de texto en espa[nñ]ol e ingl[eé]s/i);
  assert.doesNotMatch(capabilities,/Estas funciones est[aá]n disponibles a trav[eé]s de la interfaz/i);
});

test('v132 capability follow-up expands the previous turn instead of repeating a static card',()=>{
  const first=coreSelfResponse({question:'Cuáles son tus capacidades?'});
  const follow=coreSelfResponse({question:'Que más sabes hacer?',history:[{role:'assistant',text:first}]});
  assert.match(follow,/Adem[aá]s de lo anterior/i);
  assert.match(follow,/Convertir una idea en activo/i);
  assert.match(follow,/Mantener contexto/i);
  assert.match(follow,/Orquestar especialidades/i);
  assert.notEqual(follow,first);
});

test('v132 derives capability claims from runtime catalogs and configuration',()=>{
  const snapshot=capabilitySnapshot({
    providers:[{id:'wae_edge',configured:true}],
    tools:[{id:'waeweb_search',configured:true},{id:'github_search',configured:false},{id:'public_research',configured:true}],
    memory:{configured:true}
  });
  assert.equal(snapshot.version,CORE_CAPABILITY_VERSION);
  assert.equal(snapshot.operational.generativeInference,true);
  assert.equal(snapshot.operational.webResearch,true);
  assert.equal(snapshot.operational.persistentMemory,true);
  assert.ok(snapshot.intelligence.industrialDomains>=10);
  assert.ok(snapshot.intelligence.professionalDomains>=8);
  assert.ok(snapshot.intelligence.worldDomains>=10);
  assert.deepEqual(snapshot.intelligence.agentModes,['general','research','code','analysis','design','executive']);
});

test('v132 deterministic capability turns now use assistant-response/v2 and preserve conversation context',async()=>{
  const first=await executeMission({message:'Cuáles son tus capacidades?',history:[]});
  assert.equal(first.provider,'wae_core');
  assert.equal(first.model,'runtime_capabilities/v153');
  assert.equal(first.response.schema,'assistant-response/v2');
  assert.equal(first.speech_text,first.response.speechText);
  assert.deepEqual(first.actions.map(x=>x.id),['listen','copy','workspace']);
  assert.equal(first.capabilityMatrix.version,CORE_CAPABILITY_VERSION);

  const follow=await executeMission({
    message:'Que más sabes hacer?',
    history:[{role:'assistant',text:first.reply}]
  });
  assert.match(follow.reply,/Adem[aá]s de lo anterior/i);
  assert.equal(follow.response.schema,'assistant-response/v2');
});

test('v132 capabilities API exposes the same capability matrix source of truth',()=>{
  const api=readFileSync(new URL('../api/capabilities.js',import.meta.url),'utf8');
  const runtime=readFileSync(new URL('../lib/runtime.js',import.meta.url),'utf8');
  assert.match(api,/const capabilityMatrix=capabilitySnapshot\(\)/);
  assert.match(runtime,/deterministicTurn/);
  assert.match(runtime,/coreSelfResponse\(\{question:message,history\}\)/);
  assert.match(runtime,/runtime_capabilities\/v132/);
});

test('v132 injected capability registries stay deterministic even when Render web env exists',()=>{
  const beforeUrl=process.env.WAEWEB_BASE_URL,beforeKey=process.env.WAEWEB_CONNECT_KEY;
  process.env.WAEWEB_BASE_URL='https://example.invalid';
  process.env.WAEWEB_CONNECT_KEY='render-test-key';
  try{
    const answer=coreSelfResponse({providers:[{id:'wae_edge',configured:true}],tools:[{id:'web_search',configured:false},{id:'waeweb_search',configured:false},{id:'github_search',configured:false}],memory:{configured:false}});
    assert.match(answer,/No hay búsqueda web/i);
  }finally{
    if(beforeUrl===undefined)delete process.env.WAEWEB_BASE_URL;else process.env.WAEWEB_BASE_URL=beforeUrl;
    if(beforeKey===undefined)delete process.env.WAEWEB_CONNECT_KEY;else process.env.WAEWEB_CONNECT_KEY=beforeKey;
  }
});
