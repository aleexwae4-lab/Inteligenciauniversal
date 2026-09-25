import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const app=read('app.js');
const html=read('index.html');
function chat(fetch){
  const start=app.indexOf('function captureResponseEnvelope(d){');
  const end=app.indexOf('const modeDescriptions=',start);
  assert.ok(start>=0&&end>start);
  const scope={
    fetch,window:{},state:{mode:'general',messages:[{role:'user',text:'consulta'}]},
    localStorage:{getItem:()=>null},AbortController,setTimeout,clearTimeout,TextDecoder,Uint8Array,
    sanitizeAssistantText:value=>String(value||'').trim(),console,
  };
  vm.runInNewContext(app.slice(start,end)+'\nthis.getAIReply=getAIReply;',scope);
  return scope.getAIReply;
}
const answer=data=>async()=>({ok:true,status:200,json:async()=>data});

test('Render v121 refuses a recoverable or failed HTTP 200 instead of presenting it as an answer',async()=>{
  for(const data of [
    {success:false,reply:'Texto de error',degraded:true},
    {success:true,reply:'La IA no respondió',degraded:true},
    {reply:'Consulta guardada',recoverable:true},
    {reply:'Una respuesta recuperable',answer_assurance:{finalSafeFallback:true}},
    {success:true,reply:'## Respuesta con evidencia recuperada',provider:'web_recovery',degraded:true},
    {success:true,reply:'Fragmentos no relacionados',resilience:{automatic_evidence_rescue:true},degraded:true},
  ]){
    assert.equal(await chat(answer(data))('consulta'),null);
  }
});
test('Render v121 still delivers a useful generated reply',async()=>{
  assert.equal(await chat(answer({success:true,reply:'Respuesta verificada y útil.'}))('consulta'),'Respuesta verificada y útil.');
});
test('Render v121 intercept rejects HTTP 200 non-generative rescue before advancing conversation',()=>{
  const runtimeClient=read('runtime-client.js');
  assert.match(runtimeClient,/data\.provider==='web_recovery'/);
  assert.match(runtimeClient,/data\.resilience\?\.automatic_evidence_rescue===true/);
  const guard=runtimeClient.indexOf("data.provider==='web_recovery'");
  const advance=runtimeClient.indexOf('localStorage.setItem(CONVERSATION_ID,data.conversation_id)');
  assert.ok(guard>=0&&advance>guard,'reject before conversation pointer changes');
});
test('Render v121 refreshes offline cache with the same scripts referenced by the HTML',()=>{
  const sw=read('sw.js');
  assert.match(sw,/wae-universal-render-waeweb-public-v45-recovery-v121/);
  const currentApp=html.match(/\.\/app\.js\?[^"']+/)?.[0];
  assert.ok(currentApp,'HTML must version app.js');
  assert.ok(sw.includes(currentApp),'offline cache must match the current HTML app asset');
  assert.match(sw,/waewebpublic=v126&recovery=v121/);
  assert.match(sw,/render-v121-recovery\.css\?v=1/);
  assert.match(html,/waewebpublic=v126&recovery=v121/);
});
test('Render v121 preserves advanced factory and navigation UI while making status honest',()=>{
  for(const marker of ['canvas-render-factory-v1.js','factory-agent-render-v3.js','navigation-premium-v1.js','workspace-premium-v1.js']){
    assert.ok(html.includes(marker),'lost '+marker);
  }
  for(const marker of ['id="profileBtn"','id="coreStatusLabel"','id="coreStatusMeta"','id="memoryStatus"','render-v121-recovery.css']){
    assert.ok(html.includes(marker),'missing '+marker);
  }
  assert.doesNotMatch(html,/18% utilizada|4 capacidades activas|Universal Core · online|<strong class="health">100%/);
  assert.match(app,/\$\('#profileBtn'\)\?\.addEventListener\('click',openSettings\)/);
  assert.match(app,/\$\$\('\.nav-list button\[data-view\]'\)\.forEach/);
  assert.match(app,/function showRetryTurn\(message\)/);
  assert.match(app,/Procesando · \$\{Math\.floor\(\(Date\.now\(\)-started\)\/1000\)\} s/);
  assert.match(app,/providerInferenceVerified===true/);
});