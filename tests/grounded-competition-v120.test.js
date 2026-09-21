import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classifyGroundedCompetitionV120,buildGroundedCompetitionReplyV120,GROUNDED_COMPETITION_VERSION} from '../lib/grounded-competition-v120.js';

const classify=(message,extra={})=>classifyGroundedCompetitionV120({message,mode:'general',...extra});
const snapshot={domains:[
  {id:'web_search',status:'blocked'},
  {id:'conversation_reasoning',status:'ready'},
  {id:'software_engineering',status:'partial'},
  {id:'document_generation',status:'partial'}
]};

test('mobile clip: direct Google comparison gets a bounded capability-aware reply',()=>{
  const got=classify('¿Puedes competir contra Google?');
  assert.equal(got.eligible,true);
  assert.deepEqual(got.targets.map(t=>t.name),['Google']);
  const reply=buildGroundedCompetitionReplyV120({...got,snapshot});
  assert.match(reply,/Sí: Universal Core puede competir por trabajos y resultados concretos/);
  assert.match(reply,/Google.*condicionada por integraciones/s);
  assert.match(reply,/no significa que hoy iguale toda la infraestructura/i);
  assert.doesNotMatch(reply,/90\s*%|no existe evidencia de que WAE OS Enterprise pueda competir/i);
});

test('named platforms use their own task availability instead of an invented league table',()=>{
  const got=classify('¿Puedes competir contra Google, Microsoft, Copilot, GPT, Gemini, GitHub, Vercel, Grok y Claude?');
  assert.equal(got.eligible,true);
  assert.equal(got.targets.length,9);
  const reply=buildGroundedCompetitionReplyV120({...got,snapshot});
  assert.match(reply,/GitHub.*parcialmente disponible/s);
  assert.match(reply,/GPT.*disponible/s);
  assert.match(reply,/pruebas emparejadas/i);
  assert.equal(GROUNDED_COMPETITION_VERSION,'grounded-competition/v120');
});

test('fresh comparative research, third-party questions and explicit tools are not hijacked',()=>{
  assert.equal(classify('¿Cuál es la cuota de mercado de Google?').eligible,false);
  assert.equal(classify('¿Puedes competir contra Google? Investiga los resultados actuales.').eligible,false);
  assert.equal(classify('¿Puedes competir contra Google?', {web_enabled:true}).eligible,false);
  assert.equal(classify('¿Puedes competir contra Google?', {attachments:[{name:'evidence.txt',text:'x'}]}).eligible,false);
  assert.equal(classify('¿Puedes competir contra Google?', {mode:'research'}).eligible,false);
  assert.equal(classify('¿Puede Microsoft competir contra Google?').eligible,false);
});

test('actual mobile native endpoint handles the question before the LLM quality council',async()=>{
  const code=await readFile(new URL('../lib/native-brain-v5.js',import.meta.url),'utf8');
  assert.match(code,/classifyGroundedCompetitionV120\(payload\)/);
  assert.match(code,/path:'grounded-competition'/);
  assert.ok(code.indexOf('classifyGroundedCompetitionV120(payload)')<code.indexOf('const local=!needsContext'));
});


test('mobile tables wrap long cells instead of clipping the second column',async()=>{
  const mobile=await readFile(new URL('../api/mobile.js',import.meta.url),'utf8');
  assert.match(mobile,/\.assistant-body table\{[^}]*table-layout:fixed/);
  assert.match(mobile,/\.assistant-body th,\.assistant-body td\{[^}]*white-space:normal;overflow-wrap:anywhere/);
  assert.doesNotMatch(mobile,/\.assistant-body th,\.assistant-body td\{[^}]*white-space:nowrap/);
});
