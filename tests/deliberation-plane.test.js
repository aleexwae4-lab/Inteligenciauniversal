import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { councilEligible, selectCouncilProviders, COUNCIL_VERSION } from '../lib/deliberation-plane.js';

const route=(overrides={})=>({
  applied:true,
  task:{category:'analysis',path:'STANDARD',risk:'low',complexity:'medium'},
  fallbackOrder:['wae_edge','wae_supabase','gemini'],
  ...overrides
});

const registry=[
  {id:'wae_edge',configured:true,model:'edge'},
  {id:'wae_supabase',configured:true,model:'gateway'},
  {id:'gemini',configured:true,model:'gemini'},
  {id:'openai',configured:false,model:'gpt'}
];

test('Council v40 is opt-in or reserved for explicit deep analytical modes',()=>{
  assert.equal(COUNCIL_VERSION,'universal-council/v40');
  const message='Analiza esta arquitectura y compara sus riesgos operativos con alternativas de producción.';
  assert.equal(councilEligible({route:route(),body:{message,mode:'general',provider:'auto'}}),false);
  assert.equal(councilEligible({route:route(),body:{message,mode:'analysis',provider:'auto'}}),false);
  assert.equal(councilEligible({route:route({task:{category:'analysis',path:'DEEP',risk:'low',complexity:'high'}}),body:{message,mode:'analysis',provider:'auto'}}),true);
  assert.equal(councilEligible({route:route(),body:{message,mode:'general',provider:'auto',council_mode:true}}),true);
  assert.equal(councilEligible({route:route(),body:{message,mode:'analysis',provider:'auto',council_mode:false}}),false);
});

test('Council v40 fails closed for sensitive data, attachments, research and high-risk routes',()=>{
  assert.equal(councilEligible({route:route(),body:{message:'Analiza el expediente del paciente con CURP ABCD000000HJCLXX00',mode:'analysis',provider:'auto',council_mode:true}}),false);
  assert.equal(councilEligible({route:route(),body:{message:'Analiza esta estrategia empresarial con profundidad suficiente para decidir.',mode:'analysis',provider:'auto',attachments:[{name:'private.txt'}],council_mode:true}}),false);
  assert.equal(councilEligible({route:route(),body:{message:'Investiga noticias recientes y compara las fuentes.',mode:'research',provider:'auto',web_enabled:true,council_mode:true}}),false);
  assert.equal(councilEligible({route:route({task:{category:'high_risk',path:'DEEP',risk:'high',complexity:'high'}}),body:{message:'Analiza este caso legal complejo con información privada.',mode:'analysis',provider:'auto',council_mode:true}}),false);
});

test('Council v40 respects explicit provider choice and requires multiple configured providers',()=>{
  assert.equal(councilEligible({route:route({task:{category:'analysis',path:'DEEP',risk:'low',complexity:'high'}}),body:{message:'Analiza esta arquitectura en profundidad y produce una recomendación.',mode:'analysis',provider:'gemini'}}),false);
  assert.deepEqual(selectCouncilProviders(route(),registry,3),['wae_edge','wae_supabase','gemini']);
  assert.deepEqual(selectCouncilProviders(route(),registry.slice(0,1),3),['wae_edge']);
});

test('chat endpoint wires Council before normal mission execution with graceful fallback',()=>{
  const source=readFileSync(new URL('../api/chat.js',import.meta.url),'utf8');
  assert.match(source,/deliberateMission/);
  assert.match(source,/councilEligible/);
  assert.match(source,/X-WAE-Cognitive-Path/);
  assert.match(source,/universal-council-v40/);
  assert.ok(source.indexOf('deliberateMission')<source.indexOf('executeMission({ ...routedBody'));
  assert.match(source,/console\.warn\('\[Universal Council v40\]'/);
});

test('Council implementation uses blind evaluation and hides raw candidate text from metadata',()=>{
  const source=readFileSync(new URL('../lib/deliberation-plane.js',import.meta.url),'utf8');
  assert.match(source,/compareBenchmarkCandidates/);
  assert.match(source,/provider_identity_used_for_scoring:false/);
  assert.match(source,/DATOS NO CONFIABLES/);
  assert.match(source,/No expongas cadena de pensamiento/);
  assert.doesNotMatch(source,/council=\{[^}]*text:/s);
});
