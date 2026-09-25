import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {
 WAE_IDENTITY_VERSION,WAE_PRODUCT,WAE_IDENTITY_POLICY,
 asksForTechnicalProvenance,isSelfIdentityQuestion,productIdentityIssue
} from '../lib/wae-product-identity-v126.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function browserGate(){
 const src=read('runtime-client.js');
 const start=src.indexOf('  const productIdentityIssue=(answer,question)=>{');
 const end=src.indexOf('  const comparisonIssue=',start);
 assert.ok(start>=0&&end>start,'browser identity gate is installed');
 const scope={};
 vm.runInNewContext(src.slice(start,end)+'\nthis.gate=productIdentityIssue;',scope);
 return scope.gate;
}
test('v126 identity contract belongs to WAE and distinguishes product from training provenance',()=>{
 assert.equal(WAE_IDENTITY_VERSION,'wae-product-identity/v126');
 assert.equal(WAE_PRODUCT.name,'Universal Core');
 assert.equal(WAE_PRODUCT.company,'WAE OS Enterprise');
 assert.match(WAE_IDENTITY_POLICY,/no afirmes que entrenó desde cero/i);
 assert.match(WAE_IDENTITY_POLICY,/No ocultes hechos materiales/i);
 assert.equal(asksForTechnicalProvenance('¿Cuáles son los modelos subyacentes?'),true);
 assert.equal(asksForTechnicalProvenance('¿Quién te entrenó?'),true);
 assert.equal(asksForTechnicalProvenance('¿Qué proyectos puedo construir?'),false);
 assert.equal(isSelfIdentityQuestion('¿Quién eres?'),true);
 assert.equal(isSelfIdentityQuestion('¿Qué es OpenAI?'),false);
});
test('v126 rejects fake vendor self-identification but permits honest discussion and quotations',()=>{
 const browser=browserGate();
 const pairs=[
  ['Soy ChatGPT, desarrollado por OpenAI.','¿Quién eres?','wrong_assistant_brand'],
  ['Hola, soy Gemini, el asistente.','Necesito una arquitectura de microservicios','wrong_assistant_brand'],
  ['Soy un modelo de lenguaje desarrollado por OpenAI.','¿Qué eres?','wrong_assistant_provenance'],
  ['I am Claude, an AI assistant.','Hello','wrong_assistant_brand'],
  ['Soy Universal Core, la inteligencia artificial de WAE OS Enterprise.','¿Quién eres?',''],
  ['La API de OpenAI tiene límites que debes verificar.','¿Cómo funciona OpenAI?',''],
  ['No soy ChatGPT; soy Universal Core de WAE OS Enterprise.','¿Eres ChatGPT?',''],
  ['«Soy ChatGPT», dijo el personaje.','Analiza este texto: "Soy ChatGPT"',''],
  ['La arquitectura utiliza modelos externos cuando están configurados.','¿Cuáles son los modelos subyacentes?',''],
 ];
 for(const [answer,question,expected] of pairs){
  assert.equal(productIdentityIssue(answer,question),expected,'Render: '+answer);
  assert.equal(browser(answer,question),expected === 'missing_wae_product_identity' ? '' : expected,'browser: '+answer);
 }
 assert.equal(productIdentityIssue('Un asistente conversacional.','¿Quién eres?'),'missing_wae_product_identity');
});
test('v126 quality gate precedes success in browser and applies in Render fallback',()=>{
 const runtime=read('lib/runtime.js'),client=read('runtime-client.js');
 assert.match(runtime,/WAE_IDENTITY_POLICY/);
 assert.match(runtime,/qualityGate:answer=>[\s\S]*productIdentityIssue\(answer,message\)/);
 const check=client.indexOf("throw new Error('product_identity_quality_'+identityFailure)");
 const pointer=client.indexOf('localStorage.setItem(CONVERSATION_ID,data.conversation_id)');
 assert.ok(check>0&&pointer>check,'wrong identity must not advance the conversation pointer');
 assert.match(client,/IDENTIDAD WAE/);
});
test('v126 Android cache invalidates old identity script and keeps factory',()=>{
 const html=read('index.html'),sw=read('sw.js');
 assert.match(html,/brand=v125&identity=v126/);
 assert.match(sw,/brand=v125&identity=v126/);
 assert.match(sw,/identity-v126/);
 for(const asset of ['canvas-render-factory-v1.js','factory-agent-render-v3.js','workspace-premium-v1.js'])assert.ok(html.includes(asset));
});
