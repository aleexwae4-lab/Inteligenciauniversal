import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import health from '../api/health.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
function res(){
  return{
    statusCode:200,headers:{},ended:false,
    setHeader(key,value){this.headers[key.toLowerCase()]=value},
    status(n){this.statusCode=n;return this},
    json(value){this.body=value;this.ended=true;return this},
    end(){this.ended=true;return this}
  };
}
test('liveness is free, no-provider-safe and not confused with inference readiness',()=>{
 const alive=res();health({method:'GET',url:'/api/health/liveness'},alive);
 assert.equal(alive.statusCode,200);
 assert.equal(alive.body.ok,true);
 assert.equal(alive.body.component,'node-http');
 assert.equal(alive.headers['cache-control'],'no-store');
 const ready=res();health({method:'GET',url:'/api/health/readiness'},ready);
 assert.ok([200,503].includes(ready.statusCode));
 assert.equal(ready.body.providerInferenceVerified,false);
 assert.match(ready.body.readiness,/providers_configured_not_tested|no_providers_configured/);
 assert.equal(ready.statusCode,ready.body.ready?200:503);
 const head=res();health({method:'HEAD',url:'/api/health/liveness'},head);
 assert.equal(head.statusCode,200);assert.equal(head.body,undefined);assert.equal(head.ended,true);
});
test('an exhausted LLM preserves the draft without fabricating assistant text or duplicate user turns',async()=>{
 const code=read('app.js'),start=code.indexOf('async function getAIReply(message){'),end=code.indexOf('const modeDescriptions=',start);
 assert.ok(start>0&&end>start);
 const part=code.slice(start,end);
 const context={
   window:{},state:{mode:'general',messages:[{role:'user',text:'Prueba de continuidad'}]},
   localStorage:{getItem:()=>''},
   AbortController,clearTimeout,setTimeout,
   fetch:async()=>({ok:false,status:503,json:async()=>({error:'ALL_PROVIDERS_FAILED'})}),
   sanitizeAssistantText:v=>String(v||''),console:{warn(){}}
 };
 vm.runInNewContext(part+';this.getAIReply=getAIReply',context);
 assert.equal(await context.getAIReply('Prueba de continuidad'),null);
 assert.match(code,/return null;\s*}finally\{clearTimeout\(timer\)/);
 assert.match(code,/if\(previous\?\.role!=='user'\|\|previous\.text!==m\)addMessage\('user',m\)/);
 assert.match(code,/i\.value=m;autosizeInput\(\)/);
 assert.match(code,/Conservé tu pregunta para reintentar/);
});
test('degraded upstream answer must not advance active cloud conversation',()=>{
 const client=read('runtime-client.js');
 const quality=client.indexOf("throw new Error('degraded_supabase_reply')");
 const conversation=client.indexOf('localStorage.setItem(CONVERSATION_ID,data.conversation_id)');
 assert.ok(quality>=0&&conversation>quality);
 assert.match(client,/return nativeFetch\(input,init\)/);
});
test('Render mounts no-cost probes and blocks private static paths',()=>{
 const server=read('server.js');
 for(const route of ['/api/health/liveness','/api/health/readiness'])assert.ok(server.includes("['"+route+"', healthHandler]"));
 assert.match(server,/\\bnode_modules\\b/);
 assert.match(server,/package\(\?:-lock\)\?/);
 assert.match(server,/function safeStaticPath/);
 assert.match(server,/if\(!filePath\)\{res\.statusCode=404/);
 const smoke=read('scripts/continuity-smoke.mjs');
 assert.match(smoke,/\/lib\/providers\.js/);
 assert.match(smoke,/\/api\/health\/liveness/);
 assert.match(smoke,/actualInferenceTested=false/);
});
test('external visual bootstrap warning cannot stop chat deployment by default',()=>{
 const script=read('scripts/visual-bootstrap-canary.mjs');
 assert.match(script,/WAE_VISUAL_BOOTSTRAP_REQUIRED==='true'/);
 assert.match(script,/DEGRADED visual dependency; chat deployment continues/);
 assert.doesNotMatch(script,/catch\(error\)\{[\s\S]*?process\.exitCode=1;\s*\}/);
});
