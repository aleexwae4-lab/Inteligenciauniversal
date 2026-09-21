// One real, non-generative session handshake during Render build.
// No image, no model tokens, no personal data, and never print a session secret.
import {bootstrapVisualSession} from '../lib/vision-gateway.js';
try{
 const data=await bootstrapVisualSession({},{});
 if(!data.session_id||!data.session_secret)throw Error('empty_visual_session');
 console.log('[WAE Visual Canary] REAL IU bootstrap PASS (no image, no provider charge)');
 // Authenticated, NO-INFERENCE check of the currently configured visual provider.
 try{
  const res=await fetch('https://pbswcbryxawsmltyromd.supabase.co/functions/v1/wae-ai-stream',{
   method:'POST',headers:{'content-type':'application/json',
    'apikey':process.env.WAE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-',
    'origin':'https://inteligenciauniversal.onrender.com'},
   body:JSON.stringify({action:'iu_visual_readiness_v1',session_id:data.session_id,session_secret:data.session_secret}),
   signal:AbortSignal.timeout(12000)
  });
  const state=await res.json().catch(()=>({}));
  console.log('[WAE Visual Canary] FREE provider readiness:',state.ready===true?'READY':'NOT_READY',
   'code='+String(state.error||'none').slice(0,65),
   'provider='+String(state.provider||'none').slice(0,45),
   'model='+String(state.model||'none').slice(0,80),
   'actualInferenceTested=false',
   'other_credentials='+JSON.stringify(state.otherCredentialPresent||{}));
 }catch(error){
  console.warn('[WAE Visual Canary] provider readiness could not be checked:',
   String(error?.name||'readiness_transport').slice(0,55));
 }
}catch(error){
 console.error('[WAE Visual Canary] REAL IU bootstrap FAIL:',String(error?.code||'unknown'),String(error?.message||'').slice(0,180));
 // Visual upstream may be unavailable while chat, Canvas and static shell remain
 // usable. Only a deployment explicitly configured for strict visual release
 // gating should fail the entire application build on this external dependency.
 if(process.env.WAE_VISUAL_BOOTSTRAP_REQUIRED==='true')process.exitCode=1;
 else console.warn('[WAE Visual Canary] DEGRADED visual dependency; chat deployment continues (strict gate disabled).');
}
