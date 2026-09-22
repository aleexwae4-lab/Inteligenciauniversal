import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('conversational builder is syntactically valid and runs on real Canvas API',()=>{
 const agent=read('factory-agent-render-v3.js');
 assert.doesNotThrow(()=>new vm.Script(agent));
 assert.match(agent,/multiFile\?'\/api\/factory-project':'\/api\/canvas'/);
 assert.match(agent,/quality\?\.structural!=='passed'/);
 assert.match(agent,/commitGenerated\(data\.html,snapshot\)/);
 assert.match(agent,/baseHtml:refining\?snapshot\.html:''/);
 assert.match(agent,/Conservé la versión anterior del producto/);
});
test('existing factory provides guarded revisions and verifies local save before replacing',()=>{
 const factory=read('factory-projects-render-v2.js');
 assert.doesNotThrow(()=>new vm.Script(factory));
 assert.match(factory,/current\.id!==expected\.id\|\|bundle\(\)!==expected\.html/);
 assert.match(factory,/verify\?\.files\.find/);
 assert.match(factory,/function restorePrevious\(/);
 assert.match(factory,/window\.__waeFactoryV1=\{version:'3'/);
});
test('Render shell installs agent after existing Canvas and factory, without replacing old endpoints',()=>{
 const html=read('index.html'),server=read('server.js');
 assert.ok(html.indexOf('canvas-premium-v2.js')<html.indexOf('factory-projects-render-v2.js'));
 assert.ok(html.indexOf('factory-projects-render-v2.js')<html.indexOf('factory-agent-render-v3.js'));
 assert.match(html,/factory-agent-render-v3\.css\?v=5/);
 assert.match(server,/['"]?\/api\/canvas['"]?, canvasHandler/);
 assert.match(server,/['"]?\/api\/chat['"]?, chatHandler/);
});
test('agent prioritizes conversation and preview, with code optional; never grants preview same origin',()=>{
 const css=read('factory-agent-render-v3.css'),agent=read('factory-agent-render-v3.js'),base=read('factory-projects-render-v2.js');
 assert.match(css,/\.wf-agent-mode #wfFiles.*display:none/);
 assert.match(css,/\.wf-agent-mode\.wf-code-visible/);
 assert.match(agent,/aria-pressed/);
 assert.match(base,/setAttribute\('sandbox','allow-scripts'\)/);
 assert.doesNotMatch(base,/allow-same-origin/);
});
test('mobile PWA refreshes chat factory assets and does not cache API responses',()=>{
 const sw=read('sw.js');
 assert.match(sw,/wae-universal-render-purpose-v39/);
 assert.match(sw,/factory-agent-render-v3\.js\?v=6/);
 assert.match(sw,/factory-agent-render-v3\.css\?v=5/);
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
});


test('premium leap preserves recent product intent and still caps the Canvas request',()=>{
 const agent=read('factory-agent-render-v3.js');
 assert.match(agent,/Contexto acumulado del proyecto/);
 assert.match(agent,/filter\(m=>m\.role==='user'\)\.slice\(-5\)/);
 assert.match(agent,/\.slice\(0,3400\)/);
 assert.match(agent,/request:mission/);
 assert.match(agent,/especialistas.*construcci.n.*QA/i);
});


test('native mobile factory retains briefs and synchronizes the selected product preview',()=>{
 const agent=read('factory-agent-render-v3.js'),factory=read('factory-projects-render-v2.js'),css=read('factory-agent-render-v3.css');
 assert.match(agent,/priorGoals\.length>0/);
 assert.match(agent,/entry\.value=instruction/);
 assert.match(agent,/wfAgentProject/);
 assert.match(agent,/wfAgentPreview/);
 assert.match(factory,/persist\(\);render\(\);preview\(\)/);
 assert.match(css,/overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain/);
});


test('Product Builder v4 has native Canvas transfers and asynchronous project context switching',()=>{
 const agent=read('factory-agent-render-v3.js'),factory=read('factory-projects-render-v2.js');
 const html=read('index.html'),sw=read('sw.js');
 assert.match(agent,/wfAgentToCanvas/);
 assert.match(agent,/wfAgentFromCanvas/);
 assert.match(agent,/wfSendCanvas.*click/);
 assert.match(agent,/wfImportCanvas.*click/);
 assert.match(agent,/document\.addEventListener\('wae:factory-project-changed'/);
 assert.match(factory,/function announceProjectChange\(/);
 assert.match(factory,/function importProject[\s\S]*?announceProjectChange\(\)/);
 assert.match(factory,/function importCanvas[\s\S]*?announceProjectChange\(\)/);
 assert.match(html,/factory-projects-render-v2\.js\?v=5/);
 assert.match(html,/factory-agent-render-v3\.js\?v=6/);
 assert.match(sw,/wae-universal-render-purpose-v39/);
});
