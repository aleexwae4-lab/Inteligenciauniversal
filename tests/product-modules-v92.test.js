import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  USER_CONTEXT_V92,
  OPERATING_PROFILE_V104,
  normalizeUserPreferencesV92,
  userContextStateV92,
  userContextSystemInstructionV92,
  applyUserContextToBodyV92,
  publicUserContextV92
} from '../lib/user-context-v92.js';
import { extractExplicitUserProfileV104, ADAPTIVE_USER_MODEL_V104 } from '../lib/memory.js';
import { getAgent, UNIVERSAL_HUMAN_COPILOT_V104 } from '../lib/agents.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('v92 user context has a stable privacy-aware contract',()=>{
  assert.equal(USER_CONTEXT_V92,'user-context/v92');
  const prefs=normalizeUserPreferencesV92({
    customInstructions:' Responde como CTO senior. ',
    projectName:'Universal Core',
    projectInstructions:'Prioriza pruebas reproducibles.',
    responseDepth:'deep'
  });
  assert.equal(prefs.globalInstructions,'Responde como CTO senior.');
  assert.equal(prefs.projectInstructions,'Prioriza pruebas reproducibles.');
  assert.equal(prefs.projectName,'Universal Core');
  assert.equal(prefs.responseDepth,'deep');
});

test('project instructions override global instructions inside private system context',()=>{
  const instruction=userContextSystemInstructionV92({
    customInstructions:'Usa tono global.',
    projectName:'Proyecto Atlas',
    projectInstructions:'Usa reglas del proyecto.',
    responseDepth:'concise'
  });
  assert.match(instruction,/INSTRUCCIONES PERSONALIZADAS GLOBALES/);
  assert.match(instruction,/INSTRUCCIONES DEL PROYECTO “Proyecto Atlas”/);
  assert.match(instruction,/tienen prioridad sobre las instrucciones globales/);
  assert.match(instruction,/Mantén la respuesta compacta/);
  assert.ok(instruction.indexOf('Usa tono global.')<instruction.indexOf('Usa reglas del proyecto.'));
});

test('public context never exposes raw private instructions and body message is not rewritten',()=>{
  const body={message:'Audita este sistema',preferences:{customInstructions:'SECRETO_GLOBAL_92',projectInstructions:'SECRETO_PROYECTO_92',projectName:'Omega'}};
  const state=userContextStateV92(body),applied=applyUserContextToBodyV92(body),publicState=publicUserContextV92(state);
  assert.equal(applied.body.message,'Audita este sistema');
  assert.equal(applied.body,body);
  assert.equal(publicState.global_instructions_applied,true);
  assert.equal(publicState.project_instructions_applied,true);
  assert.equal(publicState.project_name,'Omega');
  assert.doesNotMatch(JSON.stringify(publicState),/SECRETO_/);
});

test('v92 bounds instruction size before model context',()=>{
  const prefs=normalizeUserPreferencesV92({customInstructions:'a'.repeat(9000),projectInstructions:'b'.repeat(9000),projectName:'x'.repeat(200)});
  assert.equal(prefs.globalInstructions.length,8000);
  assert.equal(prefs.projectInstructions.length,8000);
  assert.equal(prefs.projectName.length,120);
});

test('v104 accepts an explicit professional operating profile without breaking v92 compatibility',()=>{
  assert.equal(OPERATING_PROFILE_V104,'adaptive-user-profile/v104');
  const prefs=normalizeUserPreferencesV92({
    professionalRole:'ingeniero civil',
    responsibilities:['supervisar obra','controlar costos'],
    goals:['reducir retrasos'],
    constraints:['sin aumentar plantilla'],
    outputPreferences:['planes con responsables y fechas']
  });
  assert.equal(prefs.professionalRole,'ingeniero civil');
  const state=userContextStateV92({preferences:prefs});
  assert.equal(state.version,'user-context/v92');
  assert.equal(state.operatingProfileVersion,OPERATING_PROFILE_V104);
  assert.equal(state.hasOperatingProfile,true);
  const instruction=userContextSystemInstructionV92(prefs);
  assert.match(instruction,/ingeniero civil/);
  assert.match(instruction,/reducir retrasos/);
  assert.match(instruction,/datos declarados, no inferencias/i);
});

test('v104 adaptive memory learns only explicit useful profile signals',()=>{
  assert.equal(ADAPTIVE_USER_MODEL_V104,'adaptive-user-model/v104');
  const profile=extractExplicitUserProfileV104('Soy ingeniero mecánico. Mi objetivo es reducir tiempos de diagnóstico. Prefiero respuestas con checklist. Me encargo de supervisar mantenimiento.');
  assert.ok(profile.professional_roles.some(x=>/ingeniero mecánico/i.test(x)));
  assert.ok(profile.goals.some(x=>/reducir tiempos de diagnóstico/i.test(x)));
  assert.ok(profile.preferences.some(x=>/checklist/i.test(x)));
  assert.ok(profile.responsibilities.some(x=>/supervisar mantenimiento/i.test(x)));
});

test('v104 adaptive memory refuses sensitive profile extraction',()=>{
  const profile=extractExplicitUserProfileV104('Mi objetivo es registrar mi religión católica. Prefiero guardar mi historial médico.');
  assert.equal(profile.goals.length,0);
  assert.equal(profile.preferences.length,0);
});

test('v104 universal copilot policy optimizes for reusable assets and human control',()=>{
  assert.equal(UNIVERSAL_HUMAN_COPILOT_V104,'universal-human-copilot/v104');
  const system=getAgent('general').system;
  assert.match(system,/activo reutilizable/i);
  assert.match(system,/control humano/i);
  assert.match(system,/atributos sensibles/i);
  assert.match(system,/capacidad cognitiva/i);
});

test('runtime and council consume private instructions without rewriting saved user message',async()=>{
  const [runtime,council,specialist,chat]=await Promise.all([read('lib/runtime.js'),read('lib/deliberation-plane.js'),read('lib/specialist-copilot-runtime-v91.js'),read('api/chat.js')]);
  assert.match(runtime,/userContextSystemInstructionV92\(payload\.preferences/);
  assert.match(runtime,/userContextState\.affectsGeneration/);
  assert.match(runtime,/contextualFollowup/);
  assert.match(runtime,/casualCoreReply\(message\)/);
  assert.match(runtime,/const cacheEligible=!contextualFollowup&&!userContextState\.affectsGeneration/);
  assert.match(runtime,/saveTurn\(userKey,sessionId,message,/);
  assert.match(council,/userContextSystemInstructionV92\(preferences/);
  assert.match(specialist,/userContextSystemInstructionV92\(body\.preferences/);
  assert.match(chat,/contextualFollowupV103/);
  assert.match(chat,/protocolFastPathEligible\(runtimeBody\)/);
  assert.match(chat,/conversationalHelpReply\(runtimeBody\)/);
  assert.match(chat,/!contextualFollowup/);
});

test('frontend module connects settings, projects, real attachments and device voices',async()=>{
  const source=await read('product-modules-v92.js');
  assert.doesNotThrow(()=>new Function(source));
  assert.match(source,/MAX_PROJECT_FILES=5/);
  assert.match(source,/MAX_FILE_BYTES=2_000_000/);
  assert.match(source,/indexedDB\.open\(DB_NAME,1\)/);
  assert.match(source,/speechSynthesis\.getVoices\(\)/);
  assert.match(source,/voiceRate/);
  assert.match(source,/voicePitch/);
  assert.match(source,/min="0\.60" max="1\.60"/);
  assert.match(source,/min="0\.50" max="1\.50"/);
  assert.match(source,/localStorage\.getItem\('wae\.autoVoice'\)!=='false'/);
  assert.match(source,/customInstructions/);
  assert.match(source,/projectInstructions/);
  assert.match(source,/attachments:dedupeAttachments/);
  assert.match(source,/url\.pathname==='\/api\/chat'/);
});

test('premium shell loads v92, v106 and adaptive workspace v107 without replacing the existing interface',async()=>{
  const source=await read('premium-v5.js');
  assert.match(source,/product-modules-v92\.css\?v=92/);
  assert.match(source,/product-modules-v92\.js\?v=92/);
  assert.match(source,/feedback-history-v106\.js\?v=106/);
  assert.match(source,/adaptive-workspace-v107\.css\?v=107/);
  assert.match(source,/adaptive-workspace-v107\.js\?v=107/);
  assert.match(source,/loadGptExperience\(\);loadProductModules\(\);loadFeedbackHistory\(\);loadAdaptiveWorkspace\(\);observe\(\)/);
});

test('parallel specialist council has a v92 private-context path',async()=>{
  const [handler,council]=await Promise.all([read('api/capacity-chat-v91.js'),read('lib/specialist-council-v92.js')]);
  assert.match(handler,/runSpecialistCouncilV92/);
  assert.match(handler,/parallel-specialist-council-v92-context/);
  assert.match(council,/userContextSystemInstructionV92/);
  assert.match(council,/EVIDENCIA SUMINISTRADA POR EL USUARIO/);
  assert.match(council,/slice\(0,5\)/);
});
