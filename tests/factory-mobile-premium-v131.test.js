import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('mobile factory has two accessible native views without hiding the product in a long scroll',()=>{
 const agent=read('factory-agent-render-v3.js'),css=read('factory-mobile-premium-v4.css');
 assert.doesNotThrow(()=>new vm.Script(agent));
 assert.match(agent,/mobileNav\.setAttribute\('aria-label','Vista de la Fábrica'\)/);
 assert.match(agent,/data-wf-mobile-view="build" aria-pressed="true"/);
 assert.match(agent,/data-wf-mobile-view="preview" aria-pressed="false"/);
 assert.match(agent,/stage\.dataset\.wfView=next/);
 assert.match(css,/\.wf-stage\[data-wf-view="build"\] \.wf-body\{display:none!important\}/);
 assert.match(css,/\.wf-stage\[data-wf-view="preview"\] \.wf-agent\{display:none!important\}/);
 assert.match(css,/height:100%!important;overflow:hidden!important/);
 assert.match(css,/min-height:42px!important/);
});

test('construction and undo surface the real preview after success while failures keep the brief',()=>{
 const agent=read('factory-agent-render-v3.js');
 assert.match(agent,/state\('Producto construido y guardado[^\n]*\n\s*if\(window\.matchMedia\('\(max-width:899px\)'\)\.matches\)setMobileView\('preview'\)/);
 assert.match(agent,/state\('Versión anterior restaurada\.'\);\s*if\(window\.matchMedia/);
 assert.match(agent,/entry\.value=instruction/);
 assert.match(agent,/Conservé la versión anterior del producto/);
 assert.match(agent,/factory\(\)\?\.preview\(\)/);
});

test('advanced commands stay native and discoverable without horizontal clipped toolbar',()=>{
 const agent=read('factory-agent-render-v3.js'),css=read('factory-mobile-premium-v4.css');
 assert.match(agent,/<details class="wf-agent-more"><summary>Más herramientas<\/summary>/);
 for(const id of ['wfAgentUndo','wfAgentCode','wfAgentExport','wfAgentProject','wfAgentToCanvas','wfAgentFromCanvas']){
  assert.match(agent,new RegExp('id="'+id+'"'));
  assert.match(agent,new RegExp("\\$\\('#"+id+"'\\)"));
 }
 assert.match(css,/\.wf-agent-actions\{display:grid!important;grid-template-columns/);
 assert.match(css,/\.wf-agent-more-items\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(agent,/Auditoría estructural aprobada; backend y pruebas de navegador no ejecutados/);
 assert.doesNotMatch(agent,/responsabilidades registradas/);
});

test('release assets are scoped to the correct Render edition and refreshed in PWA',()=>{
 const html=read('index.html'),sw=read('sw.js');
 assert.match(html,/factory-mobile-premium-v4\.css\?v=1/);
 assert.match(html,/factory-agent-render-v3\.js\?v=7/);
 assert.match(sw,/wae-universal-render-factory-mobile-v46/);
 assert.match(sw,/factory-mobile-premium-v4\.css\?v=1/);
 assert.match(sw,/factory-agent-render-v3\.js\?v=7/);
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
});
