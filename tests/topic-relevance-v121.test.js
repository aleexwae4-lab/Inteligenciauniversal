import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {relevantSources,isHeadcountQuestion,irrelevantEvidenceAnswer,EVIDENCE_RELEVANCE_GUIDANCE} from '../lib/topic-relevance-v121.js';
import {needsWebResearch} from '../lib/response-quality.js';
import {formatToolContext} from '../lib/tools.js';

const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const q='Cuántos ingenieros tiene antropic para el desarrollo de su inteligencia artificial?';
const wrong='No existe información disponible en la evidencia proporcionada para determinar el número exacto de ingenieros que Anthropic tiene destinados al desarrollo de su inteligencia artificial.\n\nAnálisis de la situación\n\nLos documentos de la evidencia web [W1-W5] se centran en temas de salud pública (CDC), promociones de OpenAI y protocolos de seguridad de Google, sin mencionar a Anthropic.\n\nRecomendación de búsqueda: consultar LinkedIn.';
function browser(){
 const src=read('runtime-client.js');
 const start=src.indexOf('  const evidenceNonanswer=');
 const end=src.indexOf('  // This edition uses Supabase',start);
 assert.ok(start>0&&end>start);
 const ctx={};vm.runInNewContext(src.slice(start,end)+'\nthis.evidenceNonanswer=evidenceNonanswer;this.topicalSource=topicalSource;',ctx);return ctx;
}
test('real Android clip 21:22:46: irrelevance and evidence jargon are rejected, not treated as absence of fact',()=>{
 const c=browser();
 assert.equal(irrelevantEvidenceAnswer(wrong,q),'evidence_as_nonanswer');
 assert.equal(c.evidenceNonanswer(wrong,q),'evidence_as_nonanswer');
 assert.equal(irrelevantEvidenceAnswer('Universal Core: los documentos de la evidencia web [W1-W5] no sirven','¿Cuál es la capital de Francia?'),'internal_evidence_dump');
 assert.equal(irrelevantEvidenceAnswer('Los textos no contienen la cifra exacta.','Analiza la evidencia que te adjunté.'),'');
});
test('unrelated CDC/OpenAI/Google search hits cannot masquerade as Anthropic sources',()=>{
 const bad=[
  {title:'CDC dog import rules',url:'https://www.cdc.gov/dogs/',snippet:'public health'},
  {title:'OpenAI developer promotions',url:'https://openai.com/news/',snippet:'Offers'},
  {title:'Google account security',url:'https://google.com/security',snippet:'login'}
 ];
 const good={title:'Anthropic engineering team',url:'https://www.anthropic.com/careers',snippet:'Claude AI research roles'};
 assert.deepEqual(relevantSources(q,bad),[]);
 assert.deepEqual(relevantSources(q,[...bad,good]),[good]);
 const c=browser();
 assert.equal(c.topicalSource(q,bad[0]),false);
 assert.equal(c.topicalSource(q,bad[1]),false);
 assert.equal(c.topicalSource(q,bad[2]),false);
 assert.equal(c.topicalSource(q,good),true);
});
test('headcount asks for relevant current evidence, but non-web and general questions remain answerable',()=>{
 assert.equal(isHeadcountQuestion(q),true);
 assert.equal(needsWebResearch(q),true);
 assert.equal(needsWebResearch('¿Qué es la recursión?'),false);
 assert.equal(needsWebResearch('¿Cuántos ingenieros tiene antropic? No uses la web'),false);
 assert.equal(irrelevantEvidenceAnswer('No puedo confirmar cuántos ingenieros tiene Anthropic; la plantilla total no es el número de ingenieros.',q),'');
 assert.match(EVIDENCE_RELEVANCE_GUIDANCE,/NO confundas el total de empleados con ingenieros/);
});
test('failed or unrelated tools stay out of the model context and are never cited as evidence',()=>{
 const context=formatToolContext([
  {tool:'web_search',ok:false,error:'TAVILY_API_KEY no configurada'},
  {tool:'public_research',ok:true,data:[]}
 ]);
 assert.equal(context,'');
 const valid=formatToolContext([{tool:'public_research',ok:true,data:[{title:'Anthropic careers',url:'https://www.anthropic.com/careers'}]}]);
 assert.match(valid,/Anthropic careers/);assert.doesNotMatch(valid,/TAVILY_API_KEY/);
 const tools=read('lib/tools.js');
 assert.match(tools,/data=relevantSources\(message,data\)/);
});
test('primary and fallback gates run before persistence, product UI and v119 modules stay intact',()=>{
 const client=read('runtime-client.js'),runtime=read('lib/runtime.js'),html=read('index.html'),sw=read('sw.js'),pkg=JSON.parse(read('package.json'));
 const primaryGate=client.indexOf("throw new Error('topic_evidence_quality_'+evidenceFailure)");
 const pointer=client.indexOf('localStorage.setItem(CONVERSATION_ID,data.conversation_id)');
 assert.ok(primaryGate>0&&primaryGate<pointer);
 assert.match(client,/evidenceBrief/);
 assert.match(client,/topicalSource\(incoming\.message,item\)/);
 assert.match(runtime,/irrelevantEvidenceAnswer\(answer,message\)/);
 assert.match(runtime,/relevantSources\(message,\[\.\.\.\(generated\.sources/);
 assert.match(html,/evidence=v121/);
 assert.match(sw,/evidence=v121/);
 assert.match(sw,/wae-universal-render-waeweb-v44/);
 assert.match(pkg.scripts.check,/tests\/topic-relevance-v121\.test\.js/);
 assert.match(html,/live-workspace-v119\.js/);
});
