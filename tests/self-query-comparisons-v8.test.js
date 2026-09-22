import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {isCoreSelfQuery,coreSelfResponse} from '../lib/core-self-description.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
function browserMatcher(){
 const client=read('runtime-client.js');
 const start=client.indexOf('  const selfQuery=value=>');
 const end=client.indexOf('  window.fetch=async(',start);
 assert.ok(start>0&&end>start,'browser matcher must exist before the real provider route');
 const context={};
 vm.runInNewContext(client.slice(start,end)+'\nthis.selfQuery=selfQuery;',context);
 return context.selfQuery;
}
test('clip reproduction: "equivalente a Google" is a comparison for real conversational AI, never an identity card',()=>{
 const browser=browserMatcher();
 const questions=[
  'Se podría decir que eres equivalente a Google?',
  '¿Se podría decir que eres equivalente a Google?',
  '¿Tú crees que eres equivalente a Google?',
  'No sé qué eres capaz de encontrar en Google',
  '¿Qué eres comparado con Gemini?',
  '¿Por qué eres distinto de un buscador?',
  'Si digo que eres Google, ¿estaría en lo correcto?',
  'Quiero saber en qué eres diferente a ChatGPT'
 ];
 for(const question of questions){
  assert.equal(isCoreSelfQuery(question),false,'Render classified comparison as identity: '+question);
  assert.equal(browser(question),false,'Supabase primary classified comparison as identity: '+question);
 }
});
test('real short identity queries still receive evidence-based installation summary',()=>{
 const browser=browserMatcher();
 for(const question of ['Qué tan inteligente eres?','Hola, quién eres?','¿Qué puedes hacer?','¿Qué modelo eres?','¿Qué eres exactamente?','¿Cómo funcionas?','¿Tienes acceso a internet?']){
  assert.equal(isCoreSelfQuery(question),true,'Render missed '+question);
  assert.equal(browser(question),true,'browser missed '+question);
 }
 const response=coreSelfResponse({providers:[{id:'wae_edge',configured:true}],tools:[{id:'web_search',configured:false},{id:'github_search',configured:false}],memory:{configured:false}});
 assert.match(response,/Universal Core/);
 assert.match(response,/No hay búsqueda web/i);
 assert.ok(response.length<1100,'self-introduction became a long infrastructure report');
 assert.doesNotMatch(response,/coeficiente intelectual/i);
});
test('comparison routing, primary policy and cache version agree with live Render and leave existing apps intact',()=>{
 const server=read('lib/runtime.js'),client=read('runtime-client.js'),html=read('index.html'),sw=read('sw.js');
 assert.match(server,/if \(isCoreSelfQuery\(message\)\)/);
 assert.match(server,/preguntas comparativas/);
 assert.match(client,/selfQuery\(request\.message\)/);
 assert.match(client,/Si comparan Universal Core con Google/);
 assert.match(html,/runtime-client\.js\?v=24/);
 assert.match(sw,/runtime-client\.js\?v=24/);
 assert.match(sw,/wae-universal-render-firstturn-v42/);
 assert.match(sw,/factory-projects-render-v2/);
 assert.match(sw,/continuity-backup-v7/);
});
