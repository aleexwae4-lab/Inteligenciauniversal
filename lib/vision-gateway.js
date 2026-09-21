// WAE Visual Gateway: same-origin transport for the IU-authenticated multimodal tool.
// The public publishable key is not a secret. The user's IU session is checked by
// the existing Supabase function; Render never stores the media or session secret.
import {validateVisualRequest} from './vision.js';

const URL='https://pbswcbryxawsmltyromd.supabase.co/functions/v1/wae-ai-stream';
const ORIGIN='https://inteligenciauniversal.onrender.com';
const PUBLIC_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statusFor=code=>code==='iu_daily_visual_limit'?429:code==='iu_invalid_session'||code==='iu_session_required'?401:code==='iu_image_invalid'||code==='iu_frames_invalid'?422:503;
function failure(code,message,statusCode=503){
 return Object.assign(new Error(message),{code,statusCode});
}
const fallbackMessages={
 iu_invalid_session:'La sesión de Universal Core expiró. Actualiza la página para renovarla.',
 iu_daily_visual_limit:'Se alcanzó el límite gratuito de análisis visual por hoy. Conserva tu captura para intentarlo después.',
 iu_free_vision_unverified:'El proveedor visual no está certificado como FREE en WAE. No se realizó inferencia.',
 iu_vision_provider_not_configured:'El motor visual compartido no está configurado. Tu captura sigue disponible.',
 iu_visual_provider_failed:'El motor visual no terminó el análisis. Conserva la foto o el video para reintentar.',
 iu_image_invalid:'La imagen o los fotogramas no son compatibles o exceden el límite de tamaño.'
};
export async function bootstrapVisualSession(body={},env=process.env,request=fetch){
 const sid=String(body.session_id||''),secret=String(body.session_secret||'');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15_000);
 let response;
 try{
  response=await request('https://pbswcbryxawsmltyromd.supabase.co/functions/v1/wae-local-voice-demo-v61',{
   method:'POST',headers:{
    'content-type':'application/json','apikey':env.WAE_SUPABASE_PUBLISHABLE_KEY||PUBLIC_KEY,
    // Server-to-server bootstrap: the IU Edge function's legacy CORS whitelist rejects
    // inteligenciauniversal.onrender.com. An Origin header is a browser signal;
    // omit it here, while /api/vision still enforces the incoming Render browser origin.
    'x-client-info':'wae-iu-render-bootstrap-gateway/1.1'
   },
   body:JSON.stringify({action:'bootstrap',session_id:UUID.test(sid)?sid:'',session_secret:secret.length>=30?secret:''}),
   signal:controller.signal
  });
 }catch(error){
  throw failure('visual_bootstrap_transport',controller.signal.aborted?'La conexión para iniciar el análisis visual tardó demasiado.':'No se pudo establecer la sesión visual. Revisa la conexión.',503);
 }finally{clearTimeout(timeout)}
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!UUID.test(String(data.session_id||''))||String(data.session_secret||'').length<30){
  const code=typeof data.error==='string'?data.error:'visual_bootstrap_failed';
  const message=code==='session_creation_failed'?'No fue posible crear una sesión. La foto se conserva y puedes reintentar.':
    code==='invalid_application_key'?'La credencial pública del sistema no coincide con Supabase; la imagen no fue enviada al modelo.':
    code==='denied'||code==='origin_denied'?'El servicio rechazó la solicitud de sesión por el dominio autorizado.':
    'No se pudo crear o renovar la sesión visual ('+code+'). La imagen permanece preparada.';
  throw failure(code,message,response.status===429?429:503);
 }
 return {session_id:data.session_id,session_secret:data.session_secret};
}
export async function forwardVisual(body={},env=process.env,request=fetch){
 // Validate media BEFORE making an external request. Neither text nor frame URLs are trusted.
 validateVisualRequest(body);
 const sid=String(body.session_id||''),secret=String(body.session_secret||'');
 if(!UUID.test(sid)||secret.length<30||secret.length>200)
   throw failure('iu_session_required','Necesitas una sesión activa de Universal Core para analizar la captura.',401);
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),57_000);
 let response;
 try{
  response=await request(URL,{
   method:'POST',
   headers:{
    'content-type':'application/json','apikey':env.WAE_SUPABASE_PUBLISHABLE_KEY||PUBLIC_KEY,
    'origin':ORIGIN,'x-client-info':'wae-iu-render-visual-gateway/2.0'
   },
   body:JSON.stringify({action:'iu_visual_v1',session_id:sid,session_secret:secret,question:body.question,kind:body.kind,frames:body.frames,mode:body.mode}),
   signal:controller.signal
  });
 }catch(error){
  if(controller.signal.aborted||error?.name==='AbortError'||error?.name==='TimeoutError')
   throw failure('visual_gateway_timeout','El motor visual tardó demasiado. Conservamos la captura; reintenta cuando haya conexión.',504);
  // Network/DNS/TLS errors are NOT model inference errors. No fallback to fictitious image understanding.
  throw failure('visual_gateway_transport','No se pudo conectar el motor visual. Comprueba la conexión y reintenta; tu captura sigue preparada.',503);
 }finally{clearTimeout(timeout)}
 let data;
 try{data=await response.json()}catch{
  throw failure('visual_gateway_invalid_response','El motor devolvió una respuesta inválida. Conservamos la captura.',502);
 }
 const code=typeof data?.error==='string'?data.error:'visual_gateway_upstream';
 if(!response.ok||data?.success!==true){
  const safe=typeof data?.message==='string'&&data.message.length<=240?data.message:null;
  throw failure(code,fallbackMessages[code]||safe||'No se completó el análisis visual. Puedes reintentar sin perder tu captura.',statusFor(code));
 }
 const reply=typeof data.reply==='string'?data.reply.trim():'';
 if(!reply)throw failure('visual_gateway_empty','El motor no devolvió contenido visual interpretable. La captura sigue preparada.',502);
 return {reply,model:data.model||null,provider:data.provider||null,
   mediaKind:data.mediaKind||body.kind,analyzedFrames:data.analyzedFrames||body.frames.length,
   videoScope:data.videoScope|| (body.kind==='video'?'sampled_frames_only':'image'),
   transport:'render_same_origin_gateway',latencyMs:data.latencyMs||null};
}
