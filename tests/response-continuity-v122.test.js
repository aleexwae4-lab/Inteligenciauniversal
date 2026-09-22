import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {datedResearchAnswer} from '../lib/dated-research-v122.js';
import {executeMission} from '../lib/runtime.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const prompt='¿Cuántos ingenieros tiene Anthropic, la empresa de inteligencia artificial?';
function browser(){
 const src=read('runtime-client.js'),start=src.indexOf('  const datedAnthropicQuestion=value=>'),end=src.indexOf('  // This edition uses Supabase',start);
 assert.ok(start>0&&end>start);
 const ctx={};vm.runInNewContext(src.slice(start,end)+'\nthis.detect=datedAnthropicQuestion;',ctx);return ctx.detect;
}
test('real 22:31 clip: a dated source answers factual headcount without hallucinating an exact current figure',async()=>{
 const direct=datedResearchAnswer(prompt);
 assert.ok(direct);assert.equal(direct.asOf,'2026-06-15');
 assert.match(direct.reply,/1\.680/);assert.match(direct.reply,/5\.306/);
 assert.match(direct.reply,/No es un censo oficial/);
 assert.match(direct.reply,/https:\/\/www\.techtimes\.com/);
 const actual=await executeMission({message:prompt});
 assert.equal(actual.reply,direct.reply);
 assert.equal(actual.provider,'wae_research_registry');
 assert.equal(actual.liveResearch,false);
 assert.equal(actual.asOf,'2026-06-15');
 assert.equal(actual.sources[0].url,direct.source.url);
});
test('browser and server agree on narrow dated research routing, preserve unrelated and historical questions',()=>{
 const detect=browser();
 for(const ask of [prompt,'Cuántos ingenieros tiene antropic?','How many engineers does Anthropic have?']){
  assert.ok(datedResearchAnswer(ask),ask);
  assert.equal(detect(ask),true,ask);
 }
 for(const ask of ['Cuántos empleados tiene OpenAI?','¿Cuántos ingenieros tiene Anthropic y OpenAI?','¿Cuántos ingenieros tenía Anthropic en 2024?','¿Cómo se construye una aplicación como Claude?','Los ingenieros de Anthropic son buenos?']){
  assert.equal(datedResearchAnswer(ask),null,ask);assert.equal(detect(ask),false,ask);
 }
 const client=read('runtime-client.js');
 assert.match(client,/quickGoogleComparison\(request\.message\)\|\|datedAnthropicQuestion\(request\.message\)/);
});
test('provider attempts have an abortable total budget and preserve safe non-answer rejection',()=>{
 const provider=read('lib/providers.js');
 assert.match(provider,/const deadline=Date\.now\(\)\+Math\.min\(50000/);
 assert.match(provider,/Math\.min\(16500,remaining\)/);
 assert.match(provider,/signal:controller\.signal/);
 assert.match(provider,/AbortSignal\.any\(\[parentSignal,timeout\(ms\)\]\)/);
 assert.match(provider,/finally \{clearTimeout\(timer\)\}/);
 for(const id of ["api.openai.com","api.anthropic.com","generativelanguage.googleapis.com","api.x.ai","openrouter.ai"]){
  assert.ok(provider.includes(id));
 }
 assert.match(provider,/degradedAnswer\(result\?\.text\)/);
});
test('primary timeout leaves space for the Render fallback, trace has no user prompt or secret',()=>{
 const client=read('runtime-client.js'),app=read('app.js'),api=read('api/chat.js'),pkg=JSON.parse(read('package.json'));
 assert.match(client,/signal,7000\)\.then\(data/);
 assert.match(client,/attachments:window\.__waeRuntimeAttachments\|\|\[\]\},init\.signal,16000\)/);
 assert.match(client,/if\(init\.signal\?\.aborted\)throw err/);
 assert.match(app,/setTimeout\(\(\)=>c\.abort\(\),65000\)/);
 assert.match(api,/X-WAE-Request-ID/);
 assert.match(api,/\[WAE Chat\]/);
 assert.doesNotMatch(api,/message:body\.message|sessionId:body\.sessionId/);
 assert.match(pkg.scripts.check,/tests\/response-continuity-v122\.test\.js/);
});
