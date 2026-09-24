// Real, zero-inference production origin and session handshake. Never print credentials.
import {readFileSync} from 'node:fs';
const origin='https://inteligenciauniversal.onrender.com';
const edge='https://pbswcbryxawsmltyromd.supabase.co/functions/v1/wae-local-voice-demo-v61';
const client=readFileSync(new URL('../runtime-client.js',import.meta.url),'utf8');
const publishable=process.env.SUPABASE_PUBLISHABLE_KEY||client.match(/const SUPABASE_KEY='([^']+)'/)?.[1];
if(!publishable)throw Error('no_public_key_for_origin_probe');
const reqHeaders={'origin':origin,'content-type':'application/json','apikey':publishable,'x-client-info':'wae-chat-origin-canary/1'};
try{
 const preflight=await fetch(edge,{method:'OPTIONS',headers:{
  origin,'Access-Control-Request-Method':'POST',
  'Access-Control-Request-Headers':'content-type,apikey,x-client-info'
 },signal:AbortSignal.timeout(12000)});
 if(preflight.status!==204||preflight.headers.get('access-control-allow-origin')!==origin)
  throw Error('browser_preflight_'+preflight.status);
 console.log('[WAE Chat E2E] PASS origin_preflight=204 allow_origin=production');
 const res=await fetch(edge,{method:'POST',headers:reqHeaders,
  body:JSON.stringify({action:'bootstrap'}),signal:AbortSignal.timeout(12000)});
 const data=await res.json().catch(()=>({}));
 if(!res.ok||!data.session_id||!data.session_secret)throw Error('browser_bootstrap_'+res.status);
 console.log('[WAE Chat E2E] PASS session_bootstrap=200 model_inference_tested=false');
 // No model tokens: optional route-preview only checks the live classifier.
 try{
  const preview=await fetch(edge,{method:'POST',headers:reqHeaders,
   body:JSON.stringify({action:'route_preview',session_id:data.session_id,
   session_secret:data.session_secret,mode:'general',web_enabled:false,
   message:'¿Puedo crear una especie de GPU con una computadora vieja?'}),
   signal:AbortSignal.timeout(14000)});
  const view=await preview.json().catch(()=>({}));
  if(preview.ok&&view.success===true)console.log('[WAE Chat E2E] PASS question_route_preview category='+String(view.task?.category||'unknown').slice(0,48)+' model_inference_tested=false');
  else console.warn('[WAE Chat E2E] WARN route_preview='+preview.status+' model_inference_tested=false');
 }catch(error){console.warn('[WAE Chat E2E] WARN route_preview_transport='+String(error?.name||'unknown').slice(0,48))}
}catch(error){
 console.error('[WAE Chat E2E] FAIL '+String(error?.message||'network_unavailable').slice(0,95));
 process.exitCode=1;
}
