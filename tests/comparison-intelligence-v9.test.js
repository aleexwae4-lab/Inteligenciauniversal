import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {isCoreComparison,coreComparisonIssue,CORE_COMPARISON_GROUNDING} from '../lib/core-comparison-v9.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const question='Se podría decir que eres equivalente a Google?';
function browser(){
 const src=read('runtime-client.js'),start=src.indexOf('  const coreComparison=value=>'),end=src.indexOf('  window.fetch=async(',start);
 assert.ok(start>=0&&end>start);
 const context={};
 vm.runInNewContext(src.slice(start,end)+'\nthis.coreComparison=coreComparison;this.comparisonIssue=comparisonIssue;',context);
 return context;
}
test('video 16:33:43: distinguish Universal Core from a generic ChatGPT comparison',()=>{
 const client=browser();
 for(const ask of [question,'¿Se podría decir que eres equivalente a Google?','¿Tú eres como Gemini?','Compara Universal Core contra Google Search']){
  assert.equal(isCoreComparison(ask),true,ask);
  assert.equal(client.coreComparison(ask),true,ask);
 }
 for(const ask of ['¿Qué es Google?','¿Quién eres?','Busca Google Maps','¿Cómo funciona Google Search?']){
  assert.equal(isCoreComparison(ask),false,ask);
  assert.equal(client.coreComparison(ask),false,ask);
 }
 const clip='No, no soy equivalente a Google.\n\n| Característica | Google (buscador) | ChatGPT (modelo) |\n|---|---|---|\n| Resultados | Enlaces | Texto |\n\nResumen: Google es un buscador; ChatGPT genera respuestas.';
 assert.equal(coreComparisonIssue(clip,question),'wrong_product_subject');
 assert.equal(client.comparisonIssue(clip,question),'wrong_product_subject');
 const generic='**Universal Core**: no soy equivalente a Google.\n\n| Característica | Google | Universal Core |\n|---|---|---|\n| Meta | Buscar | Ayudar |';
 assert.equal(coreComparisonIssue(generic,question),'unrequested_mobile_table');
 assert.equal(client.comparisonIssue(generic,question),'unrequested_mobile_table');
});
test('short nuanced product-grounded answer is accepted without template or fake equivalence',()=>{
 const response='Depende de qué parte de Google compares. Google Search indexa páginas; Universal Core es la plataforma de WAE OS que puede ayudarte a conversar, analizar y construir en el Workspace. Si te refieres a Gemini, comparten funciones de asistencia, pero no son el mismo producto; no asumiría que ambos tienen el mismo acceso a información actual.';
 assert.equal(coreComparisonIssue(response,question),'');
 assert.equal(browser().comparisonIssue(response,question),'');
 assert.equal(coreComparisonIssue('solo texto','¿Qué eres?'),'');
 assert.match(CORE_COMPARISON_GROUNDING,/Google Search/);
 assert.match(CORE_COMPARISON_GROUNDING,/NO por ChatGPT/);
});
test('both model paths check contextual answer quality before marking response as success',()=>{
 const runtime=read('lib/runtime.js'),providers=read('lib/providers.js'),client=read('runtime-client.js');
 assert.match(runtime,/coreComparisonIssue\(answer,message\)\|\|purposeResponseIssue\(answer,message/);
 assert.match(runtime,/const groundedSystem=system\+/);
 assert.match(providers,/qualityGate=null/);
 assert.match(providers,/degradedAnswer\(result\?\.text\) \|\| \(typeof qualityGate/);
 const check=client.indexOf("throw new Error('comparison_quality_'+comparisonFailure)");
 const pointer=client.indexOf('localStorage.setItem(CONVERSATION_ID,data.conversation_id)');
 assert.ok(check>0&&check<pointer,'primary must reject wrong subject before persisting cloud pointer');
 assert.match(client,/comparisonBrief/);
});
test('tables contain safe data labels for a readable 320px viewport without JS execution',()=>{
 const parser=read('premium-render-v1.js'),css=read('wae-mobile-tables-v9.css'),html=read('index.html'),sw=read('sw.js');
 const start=parser.indexOf('function inline(value){'),end=parser.indexOf('function rawOf(article)');
 assert.ok(start>=0&&end>start);
 const context={text:v=>String(v??''),esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
 vm.runInNewContext(parser.slice(start,end)+'\nthis.rich=rich;',context);
 const rendered=context.rich('| Característica | Google | Universal Core |\n|---|---|---|\n| Función | Busca páginas | <img src=x onerror=alert(1)> |');
 assert.match(rendered,/data-label="Universal Core"/);
 assert.match(rendered,/data-label="Característica"/);
 assert.match(rendered,/&lt;img/);
 assert.doesNotMatch(rendered,/<img/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/content:attr\(data-label\)/);
 assert.match(css,/overflow-wrap:anywhere/);
 assert.match(html,/wae-mobile-tables-v9\.css\?v=1/);
 assert.match(html,/premium-render-v1\.js\?v=12/);
 assert.match(sw,/wae-universal-render-evidence-v40/);
 assert.match(sw,/runtime-client\.js\?v=24/);
});
