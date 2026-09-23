import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {answerScope,focusGuidance,removeRedundantParagraphs} from '../lib/answer-density-v124.js';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const browser=()=>{
 const client=read('runtime-client.js'),start=client.indexOf('  const answerDepth='),end=client.indexOf('  // A dated, sourced finding',start);
 assert.ok(start>0&&end>start,'browser focus functions are extractable for parity tests');
 const ctx={};vm.runInNewContext(client.slice(start,end)+'\nthis.answerDepth=answerDepth;this.focusBrief=focusBrief;this.tidyAnswer=tidyAnswer;',ctx);return ctx;
};
const factual='¿Cuántos ingenieros tiene Anthropic?';
const deep='Construye una arquitectura completa con código, pruebas, riesgos y documentación paso a paso';
test('short factual request chooses direct answer even in research mode; explicit depth stays deep',()=>{
 const client=browser();
 for(const q of [factual,'¿Qué es recursión?','¿En qué se diferencia un buscador?']){
  assert.equal(answerScope(q,'general'),'direct',q);
  assert.equal(client.answerDepth(q,'general',[]),'direct',q);
 }
 assert.equal(answerScope(factual,'research'),'direct');
 assert.equal(client.answerDepth(factual,'research',[]),'direct');
 for(const q of [deep,'Explica exhaustivamente cómo implementar un sistema','Redacta una investigación completa']){
  assert.equal(answerScope(q),'deep',q);assert.equal(client.answerDepth(q,'general',[]),'deep',q);
 }
 assert.equal(answerScope('Analiza este documento','general',true),'deep');
 assert.equal(client.answerDepth('Analiza este documento','general',[{name:'evidence.txt'}]),'deep');
 assert.equal(answerScope('Hazlo en una frase, aunque sea un tema profundo'),'direct');
});
test('instructions choose dense facts or complete deliverables, never a hard output-length gate',()=>{
 const simple=focusGuidance(factual),complex=focusGuidance(deep);
 assert.match(simple,/CONSULTA PUNTUAL/);assert.match(simple,/respuesta concreta primero/);
 assert.match(complex,/ENCARGO AMPLIO O PROFESIONAL/);
 assert.match(complex,/no acortes información útil/);
 assert.match(browser().focusBrief(factual,'general'),/CONSULTA PUNTUAL/);
 assert.match(browser().focusBrief(deep,'general'),/ENCARGO PROFUNDO/);
});
test('the same paragraph repeated in giant fact answer appears once; distinct evidence survives',()=>{
 const repeat='El número se basa en una muestra de perfiles, no en un censo oficial ni actualizado de la empresa.';
 const useful='La muestra fue publicada en junio de 2026 y requiere verificar su metodología antes de sacar conclusiones.';
 const input=repeat+'\n\n'+useful+'\n\n'+repeat;
 const server=removeRedundantParagraphs(input,factual);
 const client=browser().tidyAnswer(input,factual,'general',[]);
 assert.equal(server,repeat+'\n\n'+useful);
 assert.equal(client,server);
 assert.equal((server.match(/El número se basa/g)||[]).length,1);
 const cited=repeat+' [Fuente 1]\n\n'+repeat+' [Fuente 2]';
 assert.equal(removeRedundantParagraphs(cited,factual),cited,'distinct citations may carry distinct evidence');
});
test('deep answers, tables and code retain all content without arbitrary truncation',()=>{
 const paragraph='Esta explicación aporta arquitectura, implementación y pruebas de funcionamiento reproducibles. ';
 const long=Array.from({length:28},(_,i)=>'Etapa '+i+': '+paragraph.repeat(3)).join('\n\n');
 assert.equal(removeRedundantParagraphs(long,deep),long);
 assert.equal(browser().tidyAnswer(long,deep,'general',[]),long);
 const table='| Componente | Uso |\n|---|---|\n| A | Dato |\n\n'+paragraph.repeat(3)+'\n\n'+paragraph.repeat(3);
 assert.equal(removeRedundantParagraphs(table,factual),table);
 const code='~~~js\nconst result = 42;\n~~~\n\n'+paragraph.repeat(3)+'\n\n'+paragraph.repeat(3);
 assert.equal(removeRedundantParagraphs(code,factual),code);
});
test('primary and fallback share intent and cleanup without triggering more failed-provider retries',()=>{
 const primary=read('runtime-client.js'),fallback=read('lib/runtime.js'),providers=read('lib/providers.js'),html=read('index.html'),sw=read('sw.js'),pkg=JSON.parse(read('package.json'));
 assert.match(primary,/focusBrief\(incoming\.message,runtimeMode/);
 assert.match(primary,/tidyAnswer\(withRetrievedSources\(data\.reply/);
 assert.match(fallback,/focusGuidance\(message,mode,attachments\.length>0\)/);
 assert.match(fallback,/removeRedundantParagraphs\(appendSourceLinks\(generated\.text/);
 assert.match(providers,/retryColdStart=false/);
 assert.doesNotMatch(fallback,/qualityGate:answer=>[^;\n]*removeRedundantParagraphs/);
 assert.match(html,/density=v124/);assert.match(sw,/density=v124/);
 assert.match(sw,/wae-universal-render-density-v43/);
 assert.match(pkg.scripts.check,/tests\/answer-density-v124\.test\.js/);
});
