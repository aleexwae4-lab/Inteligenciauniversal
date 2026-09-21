// Vision calls are opt-in: never charge a provider or claim visual understanding by merely capturing a file.
const FRAME_MIME=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_FRAME_CHARS=360_000, MAX_TOTAL_CHARS=1_250_000;
export function validateVisualRequest(body={}){
  const frames=body.frames;
  if(!Array.isArray(frames)||frames.length<1||frames.length>4)throw Object.assign(new Error('Adjunta de 1 a 4 imágenes para analizar'),{statusCode:400});
  let total=0;
  const checked=frames.map((frame,index)=>{
    const raw=typeof frame==='string'?frame:frame?.dataUrl;
    const match=typeof raw==='string'?raw.match(FRAME_MIME):null;
    if(!match||raw.length>MAX_FRAME_CHARS)throw Object.assign(new Error('Imagen no compatible o demasiado grande'),{statusCode:413});
    total+=raw.length;
    if(total>MAX_TOTAL_CHARS)throw Object.assign(new Error('Las imágenes exceden el límite de la consulta'),{statusCode:413});
    const time=Number(frame?.timeSec);
    return{mime_type:'image/'+match[1],data:match[2],timeSec:Number.isFinite(time)&&time>=0&&time<=60?Math.round(time*10)/10:index};
  });
  const kind=body.kind==='video'?'video':'image';
  const question=String(body.question||'Describe lo que observas y distingue lo visible de cualquier inferencia.').trim().slice(0,4000);
  if(!question)throw Object.assign(new Error('Escribe qué deseas analizar'),{statusCode:400});
  return{frames:checked,kind,question};
}
export function visionConfigured(env=process.env){
  // Explicit approval is required: provider free-tier availability and billing vary.
  return env.WAE_VISION_ENABLED==='true'&&!!env.GEMINI_API_KEY;
}
export async function analyzeVisual(body={},env=process.env,request=fetch){
  const {frames,kind,question}=validateVisualRequest(body);
  if(!visionConfigured(env))throw Object.assign(new Error('El análisis visual no está habilitado: captura disponible, proveedor multimodal pendiente de habilitación explícita sin cargos.'),{statusCode:503,code:'vision_not_configured'});
  const model=env.GEMINI_VISION_MODEL||env.GEMINI_MODEL;
  if(!model)throw Object.assign(new Error('Falta configurar un modelo de visión compatible'),{statusCode:503,code:'vision_model_missing'});
  const instruction=kind==='video'
    ? 'Analiza solo estas capturas muestreadas de un video, en orden cronológico. No afirmes haber visto todos los fotogramas, escuchado audio o reproducido el video completo. Señala incertidumbres.'
    : 'Analiza la imagen realmente proporcionada. Distingue observaciones directas, inferencias e información no visible.';
  const contents=[{text:instruction+'\nSolicitud: '+question},...frames.flatMap((frame,index)=>[{text:kind==='video'?'Fotograma '+(index+1)+' en segundo '+frame.timeSec:'Imagen '+(index+1)},{inline_data:{mime_type:frame.mime_type,data:frame.data}}])];
  const endpoint='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';
  const result=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify({contents:[{role:'user',parts:contents}],generationConfig:{maxOutputTokens:1200}}),signal:AbortSignal.timeout(30000)});
  const data=await result.json().catch(()=>({}));
  if(!result.ok)throw Object.assign(new Error('El proveedor visual no completó la consulta ('+result.status+')'),{statusCode:result.status===429?429:502,code:'vision_provider_unavailable'});
  const reply=(data.candidates?.[0]?.content?.parts||[]).map(part=>part.text||'').join('\n').trim();
  if(!reply)throw Object.assign(new Error('No hubo un resultado visual interpretable; conserva tu captura.'),{statusCode:502,code:'empty_visual_response'});
  return{reply,mediaKind:kind,analyzedFrames:frames.length,videoScope:kind==='video'?'sampled_frames_only':'image',model};
}
