import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {forwardVisual,bootstrapVisualSession} from '../lib/vision-gateway.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const photo='data:image/jpeg;base64,'+Buffer.from('wae visual payload').toString('base64');
const SID='73a6cf13-a11e-4b62-b940-dc11984de895';
const SECRET='x'.repeat(40);
const body={session_id:SID,session_secret:SECRET,question:'¿Qué ves?',kind:'image',frames:[{dataUrl:photo}],mode:'analysis'};

test('same-origin gateway forwards actual photo pixels with IU credentials to the existing WAE visual action',async()=>{
 let called=0;
 const result=await forwardVisual(body,{},async(url,init)=>{
  called++;
  assert.match(url,/functions\/v1\/wae-ai-stream$/);
  assert.equal(init.headers.origin,'https://inteligenciauniversal.onrender.com');
  assert.equal(init.headers['x-goog-api-key'],undefined);
  assert.ok(init.headers.apikey?.startsWith('sb_publishable_'));
  const sent=JSON.parse(init.body);
  assert.equal(sent.action,'iu_visual_v1');
  assert.equal(sent.session_id,SID);
  assert.equal(sent.session_secret,SECRET);
  assert.equal(sent.question,body.question);
  assert.equal(sent.frames[0].dataUrl,photo);
  assert.equal(sent.mode,'analysis');
  return {ok:true,status:200,json:async()=>({success:true,reply:'Se observan dos zapatos negros sobre un piso claro.',model:'free-vision-model',provider:'gemini_native',analyzedFrames:1,videoScope:'image'})};
 });
 assert.equal(called,1);
 assert.match(result.reply,/zapatos negros/);
 assert.equal(result.transport,'render_same_origin_gateway');
 assert.equal(result.analyzedFrames,1);
});

test('no active IU session or invalid photo is sent upstream',async()=>{
 let count=0;
 const upstream=async()=>{count++;throw Error('should not call')};
 await assert.rejects(forwardVisual({...body,session_secret:''},{},upstream),{code:'iu_session_required'});
 await assert.rejects(forwardVisual({...body,frames:[{dataUrl:'data:text/html;base64,PHNjcmlwdD4='}]},{},upstream),/compatible/);
 assert.equal(count,0);
});

test('a network failure returns a structured transport code, never Failed to fetch or imagined image details',async()=>{
 await assert.rejects(forwardVisual(body,{},async()=>{throw new TypeError('Failed to fetch')}),error=>{
  assert.equal(error.code,'visual_gateway_transport');
  assert.equal(error.statusCode,503);
  assert.match(error.message,/conectar el motor visual/);
  assert.doesNotMatch(error.message,/Failed to fetch/);
  return true;
 });
});

test('backend conveys FREE guard and quota errors without pretending an image was analyzed',async()=>{
 for(const [code,status] of [['iu_free_vision_unverified',503],['iu_daily_visual_limit',429],['iu_invalid_session',401]]){
  await assert.rejects(forwardVisual(body,{},async()=>({ok:false,status:503,json:async()=>({success:false,error:code})})),error=>{
   assert.equal(error.code,code);assert.equal(error.statusCode,status);return true;
  });
 }
});

test('same-origin session bootstrap works even when browser cannot contact Supabase directly',async()=>{
 const session=await bootstrapVisualSession({}, {},async(url,init)=>{
  assert.match(url,/wae-local-voice-demo-v61$/);
  assert.equal(JSON.parse(init.body).action,'bootstrap');
  assert.equal(init.headers.origin,undefined,'server-side bootstrap must not send a browser Origin rejected by the legacy Edge allowlist');
  assert.ok(init.headers.apikey?.startsWith('sb_publishable_'));
  return {ok:true,json:async()=>({session_id:SID,session_secret:SECRET})};
 });
 assert.equal(session.session_id,SID);
 assert.equal(session.session_secret,SECRET);
});

test('bootstrap forwards the real rejection code rather than hiding invalid origin or app key',async()=>{
 for(const [code,fragment] of [['denied','dominio autorizado'],['invalid_application_key','credencial pública'],['session_creation_failed','crear una sesión']]){
  await assert.rejects(bootstrapVisualSession({}, {},async(_url,init)=>{
   assert.equal(init.headers.origin,undefined);
   return {ok:false,status:403,json:async()=>({success:false,error:code})};
  }),error=>{assert.equal(error.code,code);assert.match(error.message,new RegExp(fragment));return true});
 }
});

test('real visual browser transport stays on Render origin for photo/video, retains image on errors',()=>{
 const runtime=read('runtime-client.js'),camera=read('camera-v1.js'),api=read('api/vision.js');
 const block=runtime.slice(runtime.indexOf('window.WAEVisualRuntime='),runtime.indexOf('function isLocalRuntime'));
 assert.match(runtime,/nativeFetch\('\/api\/vision'/);
 assert.match(runtime,/action:'bootstrap'/);
 assert.doesNotMatch(runtime,/nativeFetch\(VISUAL_EDGE/);
 assert.doesNotMatch(block,/x-goog-api-key/);
 assert.match(api,/forwardVisual\(body\)/);
 assert.match(api,/bootstrapVisualSession\(body\)/);
 assert.match(camera,/window.WAEVisualRuntime.analyze/);
 assert.match(camera,/if\(preparation\)await preparation/);
 assert.doesNotMatch(block,/await ensureVisualSession\(\)/);
 assert.match(runtime,/if\(error\?\.code!=='iu_invalid_session'/);
});

test('live readiness is IU-session-authenticated, zero-token and never claims image inference',()=>{
 const edge=read('supabase/functions/wae-ai-stream-render-visual/index.ts');
 const canary=read('scripts/visual-bootstrap-canary.mjs');
 const begin=edge.indexOf("if(s(b.action)==='iu_visual_readiness_v1'){");
 const end=edge.indexOf(" const inputs=Array.isArray(b.frames)",begin);
 assert.ok(begin>0&&end>begin);
 const code=edge.slice(begin,end);
 assert.match(edge.slice(0,begin),/secret_hash',await iuHash\(secret\)/);
 assert.match(code,/iuSelectFreeVision\(db\)/);
 assert.match(edge,/\.eq\('access_tier','FREE'\)/);
 assert.match(code,/actualInferenceTested:false/);
 assert.doesNotMatch(code,/generateContent|inline_data|iu_request_traces/);
 assert.ok(canary.includes("action:'iu_visual_readiness_v1'"));
 assert.ok(canary.includes('actualInferenceTested=false'));
 assert.match(canary,/session_secret:data\.session_secret/,'the authenticated health probe must supply the IU secret without logging it');
 assert.doesNotMatch(canary,/console\.log\([^\n]*session_secret/,'never print the IU secret');
 assert.match(edge,/if\(s\(b.action\)==='video_evidence_v131'\)return video/);
});

test('API prefers explicitly enabled Render-native vision and browser does not bootstrap before first image request',()=>{
 const api=read('api/vision.js'),runtime=read('runtime-client.js');
 assert.match(api,/process\.env\.WAE_VISION_ENABLED==='true'&&process\.env\.GEMINI_API_KEY/);
 assert.match(api,/result\.transport='render_native_provider'/);
 const block=runtime.slice(runtime.indexOf('window.WAEVisualRuntime='),runtime.indexOf('function isLocalRuntime'));
 assert.doesNotMatch(block,/await ensureVisualSession\(\);/);
 assert.match(block,/try\{return await visualRequest\(payload\)\}/);
});

test('zero-budget visual provider fallback checks live image modality and all chargeable pricing fields before making a model call',()=>{
 const edge=read('supabase/functions/wae-ai-stream-render-visual/index.ts');
 assert.match(edge,/async function iuSelectFreeVision\(db/);
 assert.match(edge,/input_modalities=image/);
 assert.match(edge,/inputs.includes\('image'\)/);
 assert.match(edge,/pricing.prompt===undefined\|\|pricing.completion===undefined/);
 assert.match(edge,/Number\(value\)===0/);
 assert.match(edge,/openrouter\/free/);
 assert.match(edge,/endsWith\(':free'\)/);
 assert.match(edge,/provider:\{data_collection:'deny',allow_fallbacks:false\}/);
 assert.match(edge,/if\(Number\(usage.cost\|\|0\)>0\)/);
 assert.match(edge,/iu_no_verified_free_visual_provider/);
 assert.match(edge,/if\(s\(b.action\)==='video_evidence_v131'\)return video/);
});
