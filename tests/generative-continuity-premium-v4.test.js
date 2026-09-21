import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nonGenerativeReason} from '../lib/non-generative-guard.js';
import {generateWithFallback} from '../lib/providers.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('outage and deterministic rescue are not valid chat answers',()=>{
 const quote='La ruta generativa avanzada no está disponible en este intento y no existe evidencia pública suficiente para responder sin inventar información. Intenta nuevamente.';
 assert.equal(nonGenerativeReason({provider:'wae_deterministic_rescue',text:'Cualquier texto'}),'provider_not_generative');
 assert.equal(nonGenerativeReason({provider:'web_recovery',text:'## Respuesta con evidencia recuperada'}),'provider_not_generative');
 assert.equal(nonGenerativeReason({provider:'google_gemma',text:quote}),'outage_text_not_answer');
 assert.equal(nonGenerativeReason({provider:'google_gemma',text:'Esta consulta no requiere evidencia pública; aquí está la explicación.'}),null);
 assert.equal(nonGenerativeReason({provider:'google_gemma',text:''}),'empty_reply');
});

test('Render provider failover rejects rescue as 200 and tries another configured generator',async()=>{
 const keys=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','WAE_SUPABASE_MACHINE_KEY','WAE_SUPABASE_GATEWAY_URL'];
 const prior=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const oldFetch=globalThis.fetch;
 try{
  process.env.SUPABASE_URL='https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='test-publishable';
  process.env.WAE_SUPABASE_MACHINE_KEY='test-machine';
  process.env.WAE_SUPABASE_GATEWAY_URL='https://example.supabase.co/functions/v1/wae-ai-gateway';
  let edge=0,gateway=0;
  globalThis.fetch=async(url,options)=>{
   const body=JSON.parse(options.body||'{}');
   const data=body.action==='bootstrap'?{session_id:'test-session',session_secret:'test-secret'}
    :String(url).includes('wae-ai-gateway')?(gateway++,{output_text:'Respuesta útil sin inventar fuentes.',id:'test-result'})
    :(edge++,{reply:'La ruta generativa avanzada no está disponible en este intento.',provider:'wae_deterministic_rescue',model:'wae-deterministic-rescue-v1'});
   return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
  };
  const result=await generateWithFallback({message:'Explícame cómo diseñar una interfaz.',system:'Responde útil.',provider:'auto'});
  assert.equal(result.provider,'wae_supabase');
  assert.equal(result.text,'Respuesta útil sin inventar fuentes.');
  assert.equal(edge,1);assert.equal(gateway,1);
  assert.equal(result.failures[0]?.provider,'wae_edge');
 }finally{
  globalThis.fetch=oldFetch;
  for(const k of keys)if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k];
 }
});

test('browser primary and fallback both reject a false-success 200 before storing a conversation',()=>{
 const client=read('runtime-client.js');
 const replyGuard=client.indexOf('if(nonGenerativeChatResult(data))');
 const archival=client.indexOf("if(data.conversation_id&&!incoming.canvas)");
 assert.ok(replyGuard>0&&archival>replyGuard);
 assert.match(client,/if\(nonGenerativeChatResult\(body\)\)/);
 assert.match(read('lib/providers.js'),/nonGenerativeReason\(/);
});

test('chat leaves failed question available to retry without creating an assistant answer',()=>{
 const app=read('app.js');
 assert.match(app,/let pendingRetry=''/);
 assert.match(app,/if\(!r\)\{pendingRetry=m/);
 assert.match(app,/if\(!i\.value\.trim\(\)\)\{i\.value=m;autosizeInput\(\)\}/);
 assert.doesNotMatch(app,/return 'No pude recuperar la respuesta de los proveedores de IA/);
});

test('factory premium exposes actual QA, type selection, mobile preview and retryable brief',()=>{
 const agent=read('factory-agent-render-v3.js'),css=read('factory-agent-render-v3.css');
 assert.match(agent,/now\.quality=data\.quality/);
 assert.match(agent,/Pruebas reales de navegador: NO EJECUTADAS/);
 assert.match(agent,/id="wfAgentKind"/);
 assert.match(agent,/id="wfAgentDeviceMobile"/);
 assert.match(agent,/id="wfAgentDeviceDesktop"/);
 assert.match(agent,/entry\.value=instruction/);
 assert.match(css,/#panel-factory #wfAgentQAResult/);
 const sw=read('sw.js'),html=read('index.html');
 assert.match(sw,/wae-universal-render-canvas-factory-v32/);
 assert.match(html,/factory-agent-render-v3\.js\?v=4/);
 assert.match(html,/runtime-client\.js\?v=22/);
 assert.match(html,/app\.js\?v=17/);
});
