import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {isPurposeQuestion,purposeResponseIssue,PURPOSE_GROUNDING} from '../lib/purpose-quality-v120.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const question='Universal Core, si Google organiza la información del mundo, ¿cuál es tu propósito? ¿En qué te diferencias de un buscador y qué podrías hacer por mí que una búsqueda tradicional no resuelve?';
function browser(){
 const src=read('runtime-client.js'),start=src.indexOf('  const purposeQuestion=value=>'),end=src.indexOf('  // This edition uses Supabase',start);
 assert.ok(start>0&&end>start,'client purpose functions must remain accessible to regression tests');
 const context={};vm.runInNewContext(src.slice(start,end)+'\nthis.purposeQuestion=purposeQuestion;this.purposeIssue=purposeIssue;',context);return context;
}
test('20:51 clip: detects natural mission question without catching unrelated tasks',()=>{
 const client=browser();
 for(const text of [question,'¿Cuál es tu propósito como Universal Core ante Google?','Universal Core, ¿qué podrías hacer por mí que una búsqueda tradicional no resuelve?']){
  assert.equal(isPurposeQuestion(text),true,text);
  assert.equal(client.purposeQuestion(text),true,text);
 }
 for(const text of ['Crea una tabla de ventas de mi tienda','¿Cómo abrir Google Maps?','¿Qué es una búsqueda binaria?']){
  assert.equal(isPurposeQuestion(text),false,text);assert.equal(client.purposeQuestion(text),false,text);
 }
});
test('reject video catalog table and unsupported email claim before success',()=>{
 const client=browser();
 const table='**Propósito de Universal Core**\n\n| Característica | Salida |\n|---|---|\n| Google | Solo enlaces |\n| Universal Core | Actúa y envía correos |';
 assert.equal(purposeResponseIssue(table,question),'unrequested_table');
 assert.equal(client.purposeIssue(table,question),'unrequested_table');
 const emails='Universal Core interpreta tu intención y puede crear archivos, enviar correos y generar scripts.';
 assert.equal(purposeResponseIssue(emails,question),'unverified_email_action');
 assert.equal(client.purposeIssue(emails,question),'unverified_email_action');
 assert.equal(purposeResponseIssue('Universal Core: Google solo devuelve URLs, aquí te explico.',question),'false_search_binary');
 assert.equal(client.purposeIssue('Universal Core: Google solo devuelve URLs, aquí te explico.',question),'false_search_binary');
});
test('accept helpful conversational answer, not an indiscriminate length or subject filter',()=>{
 const answer='Universal Core sirve para convertir tu pregunta en un trabajo útil: si traes tres fuentes sobre tu mercado, puedo compararlas contigo y ayudarte a escribir un plan en el Workspace. Un buscador también puede resumir y contestar, así que la diferencia se ve en lo que necesitas construir aquí. No afirmo haber publicado ese plan ni enviado nada fuera del chat.';
 assert.equal(purposeResponseIssue(answer,question),'');
 assert.equal(browser().purposeIssue(answer,question),'');
 assert.equal(purposeResponseIssue('| Dato | Valor |\n|---|---|\n| A | B |','Haz una tabla de ventas.'),'');
 assert.match(PURPOSE_GROUNDING,/Google Search|buscadores modernos/);
 assert.match(PURPOSE_GROUNDING,/no hay herramientas reales|no digas que envías correos/i);
});
test('primary route and Render fallback both reject quality problems before saving',()=>{
 const client=read('runtime-client.js'),runtime=read('lib/runtime.js'),sw=read('sw.js'),html=read('index.html'),pkg=JSON.parse(read('package.json'));
 const gate=client.indexOf("throw new Error('purpose_quality_'+purposeFailure)");
 const save=client.indexOf('localStorage.setItem(CONVERSATION_ID,data.conversation_id)');
 assert.ok(gate>0&&save>gate,'reject invalid primary before cloud pointer update');
 assert.match(client,/purposeBrief/);assert.match(client,/purposeQuestion\(incoming\.message\)/);
 assert.match(runtime,/purposeResponseIssue\(answer,message/);
 assert.match(runtime,/PURPOSE_GROUNDING/);
 assert.match(sw,/wae-universal-render-evidence-v40/);
 assert.match(html,/purpose=v120/);
 assert.match(sw,/purpose=v120/);
 assert.match(pkg.scripts.check,/tests\/purpose-quality-v120\.test\.js/);
});
