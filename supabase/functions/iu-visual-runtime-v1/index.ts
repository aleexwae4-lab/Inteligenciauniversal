// Universal Core · Render-only authenticated visual bridge, independent of WAE OS organization login.
// The browser submits its existing IU session, never a WAE OS private bucket path or Gemini key.
import {createClient} from 'npm:@supabase/supabase-js@2.57.4';

const ORIGIN='https://inteligenciauniversal.onrender.com';
const MAX_REQUEST_BYTES=1_450_000;
const MAX_FRAMES=4;
const MAX_DAILY_CALLS=12;
const KIND='iu_visual_v1';
const MIME=/^data:image\/(jpeg|png|webp);base64,([a-zA-Z0-9+/]+={0,2})$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder=new TextEncoder();
const cors=(origin:string|null)=>({
 'access-control-allow-origin':origin===ORIGIN?ORIGIN:ORIGIN,
 'access-control-allow-methods':'GET,POST,OPTIONS',
 'access-control-allow-headers':'apikey,content-type,x-client-info',
 'access-control-max-age':'86400',
 'vary':'Origin'
});
function json(status:number,body:Record<string,unknown>,origin:string|null){
 return new Response(JSON.stringify(body),{status,headers:{...cors(origin),'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
function error(status:number,code:string,message:string,origin:string|null){
 return json(status,{success:false,error:code,message},origin);
}
function text(value:unknown,max=4000){return typeof value==='string'?value.trim().slice(0,max):''}
async function hash(secret:string){
 const buffer=await crypto.subtle.digest('SHA-256',encoder.encode(secret));
 return [...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function validate(input:Record<string,unknown>){
 const files=input.frames;
 if(!Array.isArray(files)||files.length<1||files.length>MAX_FRAMES)throw Error('frames_invalid');
 const frames:Record<string,unknown>[]=[];
 let bytes=0;
 for(const raw of files){
  const f=typeof raw==='string'?{dataUrl:raw}:raw&&typeof raw==='object'?raw:{};
  const value=typeof (f as Record<string,unknown>).dataUrl==='string'?(f as Record<string,string>).dataUrl:'';
  if(value.length>360000||value.length<40)throw Error('image_size_invalid');
  const match=value.match(MIME);
  if(!match)throw Error('image_type_invalid');
  bytes+=value.length;
  if(bytes>1250000)throw Error('images_too_large');
  const time=Number((f as Record<string,unknown>).timeSec),end=Number((f as Record<string,unknown>).endSec);
  frames.push({mimeType:'image/'+match[1],data:match[2],timeSec:Number.isFinite(time)&&time>=0&&time<=86400?time:null,endSec:Number.isFinite(end)&&end>=time&&end<=86400?end:null});
 }
 const question=text(input.question,4000)||'Describe lo observado con precisión.';
 const kind=input.kind==='video'?'video':'image';
 const mode=['general','research','code','analysis','design','executive'].includes(text(input.mode,50))?text(input.mode,50):'general';
 return{frames,question,kind,mode};
}
function instructions(kind:string,mode:string,question:string){
 const domain:Record<string,string>={
  general:'Responde con naturalidad y suficiente detalle para la pregunta.',
  research:'No inventes fuentes web ni citas externas. El único material aportado es visual.',
  code:'Si hay una interfaz de software, identifica texto/error/elementos visibles y pasos de diagnóstico. No inventes logs.',
  analysis:'Separa observaciones, hipótesis y verificaciones concretas.',
  design:'Identifica jerarquía, legibilidad, contraste y recomendaciones concretas cuando proceda.',
  executive:'Identifica hechos visibles, riesgos posibles y siguientes pasos. No inventes datos financieros.'
 };
 const scope=kind==='video'
  ?'Recibes hojas de contacto de hasta cuatro fotogramas por imagen, etiquetados con tiempo. Describe secuencia y cambios SOLO en esos instantes; NO has visto video íntegro ni escuchado audio, por lo que NO transcribas conversaciones ni inventes acciones intermedias.'
  :'Recibes fotografía(s) auténtica(s) del usuario. Describe el contenido efectivamente visible.';
 return [
  'Eres WAE Visual Scan, asistente de análisis visual de Universal Core. Responde en español.',
  scope,domain[mode], 'PRIORIDAD: responde la pregunta textual exacta, con descripciones específicas y verificables.',
  'Nunca respondas solo con una plantilla genérica. No afirmes que capturaste evidencia distinta de estas imágenes.',
  'Lee el texto de pantalla solo cuando sea legible. Distingue lo observado de suposiciones; admite ambigüedad de iluminación o escala.',
  'No infieras identidad, emociones, causa médica o responsabilidad jurídica de una imagen. No atribuyas certeza a hipótesis.',
  'Si la escena es simple, sé conciso. No agregues enlaces ni bibliografía al final.',
  'PREGUNTA DEL USUARIO: '+question
 ].join('\n');
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
 if(origin!==ORIGIN)return error(403,'origin_denied','El análisis visual solo está disponible desde Universal Core de Render.',origin);
 if(req.method==='GET')return json(200,{ok:true,service:'WAE IU Visual Bridge',version:'1.0.0',authenticated:true,media:'images and sampled video contact sheets'},origin);
 if(req.method!=='POST')return error(405,'method_not_allowed','Método no permitido',origin);
 if(Number(req.headers.get('content-length')||0)>MAX_REQUEST_BYTES)return error(413,'payload_too_large','La imagen supera el tamaño admitido.',origin);
 let rawBody='';
 try{rawBody=await req.text()}catch{return error(400,'body_read_failed','No fue posible leer la captura.',origin)}
 if(rawBody.length>MAX_REQUEST_BYTES)return error(413,'payload_too_large','Reduce el tamaño o número de imágenes.',origin);
 let body:Record<string,unknown>;
 try{body=JSON.parse(rawBody)}catch{return error(400,'invalid_json','La solicitud no es válida.',origin)}
 const sessionId=text(body.session_id,80),sessionSecret=text(body.session_secret,200);
 if(!UUID.test(sessionId)||sessionSecret.length<30)return error(401,'session_required','La sesión de Universal Core debe estar activa.',origin);
 const url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(!url||!service)return error(503,'database_unavailable','No se pudo verificar la sesión.',origin);
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:user,error:sessionError}=await admin.from('iu_sessions')
  .select('id,status,expires_at').eq('id',sessionId).eq('secret_hash',await hash(sessionSecret)).maybeSingle();
 if(sessionError||!user||user.status!=='active'||(user.expires_at&&Date.parse(user.expires_at)<=Date.now()))
  return error(401,'invalid_session','La sesión expiró. Actualiza Universal Core e inténtalo de nuevo.',origin);
 let visual:ReturnType<typeof validate>;
 try{visual=validate(body)}catch(e){return error(422,'invalid_frames',String((e as Error).message),origin)}
 const apiKey=Deno.env.get('GEMINI_API_KEY')||'';
 const model=Deno.env.get('GEMINI_MODEL')||Deno.env.get('GEMINI_NATIVE_MODEL')||'';
 if(!apiKey||!model)return error(503,'vision_provider_unavailable','El motor visual compartido no está configurado.',origin);
 // Free-first guard: never route to a registry model marked PAID/LOCAL or not vision-capable.
 const {data:registry,error:registryError}=await admin.from('iu_adaptive_model_registry_v2')
  .select('provider,model_name,enabled,access_tier,vision_capable').eq('model_name',model).eq('enabled',true).eq('vision_capable',true).eq('access_tier','FREE').limit(1);
 if(registryError||!registry?.length)return error(503,'free_vision_model_unverified','El modelo configurado no figura como vision-capable FREE en el registro de WAE; no se ejecutó ningún cargo.',origin);
 const since=new Date(Date.now()-86400000).toISOString();
 const {count,error:countError}=await admin.from('iu_request_traces').select('request_id',{count:'exact',head:true}).eq('session_id',sessionId).eq('kind',KIND).gte('created_at',since);
 if(countError)return error(503,'quota_check_unavailable','No se pudo verificar la cuota gratuita.',origin);
 if((count||0)>=MAX_DAILY_CALLS)return error(429,'vision_daily_limit','Se alcanzó el límite diario de pruebas visuales para proteger el presupuesto.',origin);
 const started=Date.now(),requestId=crypto.randomUUID();
 const {error:reservationError}=await admin.from('iu_request_traces').insert({
  request_id:requestId,session_id:sessionId,kind:KIND,status:'processing',provider:'gemini_native',model_name:model,
  metadata:{surface:'render_visual',kind:visual.kind,mode:visual.mode,frame_count:visual.frames.length,source_uploaded:false}
 });
 if(reservationError)return error(503,'quota_reservation_failed','No se pudo reservar la cuota visual.',origin);
 try{
  const parts:Record<string,unknown>[]=[{text:instructions(visual.kind,visual.mode,visual.question)}];
  visual.frames.forEach((frame,i)=>{
   parts.push({text:visual.kind==='video'?'Hoja '+(i+1)+' desde '+frame.timeSec+'s'+(frame.endSec!==null?' hasta '+frame.endSec+'s':'')+'. Usa marcas temporales visibles.':'Fotografía '+(i+1)});
   parts.push({inline_data:{mime_type:frame.mimeType,data:frame.data}});
  });
  const endpoint='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':apiKey},
   body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{maxOutputTokens:1800,temperature:0.2}}),
   signal:AbortSignal.timeout(45000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error('gemini_http_'+response.status);
  const candidate=Array.isArray(data.candidates)?data.candidates[0]:null;
  const reply=(Array.isArray(candidate?.content?.parts)?candidate.content.parts:[]).map((p:Record<string,unknown>)=>text(p.text,15000)).filter(Boolean).join('\n').trim();
  if(!reply)throw Error('empty_model_response');
  const elapsed=Date.now()-started;
  await admin.from('iu_request_traces').update({status:'ok',total_latency_ms:elapsed,input_tokens:data.usageMetadata?.promptTokenCount||null,output_tokens:data.usageMetadata?.candidatesTokenCount||null}).eq('request_id',requestId).eq('session_id',sessionId);
  return json(200,{success:true,reply,model,provider:'gemini_native',mediaKind:visual.kind,analyzedFrames:visual.frames.length,
   videoScope:visual.kind==='video'?'sampled_frames_only':'image',latencyMs:elapsed},origin);
 }catch(error){
  const code=text((error as Error)?.message,120)||'provider_unavailable';
  await admin.from('iu_request_traces').update({status:'error',error_code:code,total_latency_ms:Date.now()-started}).eq('request_id',requestId).eq('session_id',sessionId);
  return error(502,'visual_inference_failed','El motor visual no completó la lectura ('+code+'). Tu captura se conserva para reintentar.',origin);
 }
});