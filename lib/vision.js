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
    const time=Number(frame?.timeSec),end=Number(frame?.endSec);
    return{mime_type:'image/'+match[1],data:match[2],timeSec:Number.isFinite(time)&&time>=0&&time<=86400?Math.round(time*10)/10:index,endSec:Number.isFinite(end)&&end>=time&&end<=86400?Math.round(end*10)/10:null};
  });
  const kind=body.kind==='video'?'video':'image';
  const question=String(body.question||'Describe lo que observas y distingue lo visible de cualquier inferencia.').trim().slice(0,4000);
  if(!question)throw Object.assign(new Error('Escribe qué deseas analizar'),{statusCode:400});
  const mode=['general','research','code','analysis','design','executive'].includes(body.mode)?body.mode:'general';
  return{frames:checked,kind,question,mode};
}
export function visionConfigured(env=process.env){
  // Explicit approval is required: provider free-tier availability and billing vary.
  return env.WAE_VISION_ENABLED==='true'&&!!env.GEMINI_API_KEY;
}
export async function analyzeVisual(body={},env=process.env,request=fetch){
  const {frames,kind,question,mode}=validateVisualRequest(body);
  if(!visionConfigured(env))throw Object.assign(new Error('El análisis visual no está habilitado: captura disponible, proveedor multimodal pendiente de habilitación explícita sin cargos.'),{statusCode:503,code:'vision_not_configured'});
  const model=env.GEMINI_VISION_MODEL||env.GEMINI_MODEL;
  if(!model)throw Object.assign(new Error('Falta configurar un modelo de visión compatible'),{statusCode:503,code:'vision_model_missing'});
  const instruction=kind==='video'
    ? 'Eres WAE Video Scan: observa hojas de contacto cronológicas con hasta 4 capturas por hoja y etiquetas t=mm:ss. Reconstruye el orden visible y los cambios entre tiempos. No afirmes haber visto cada segundo del video, ni escuchado audio, ni transcrito voz. Indica expresamente que se analizaron muestras visuales, no el audiovisual íntegro.'
    : 'Eres WAE Visual Scan: analiza únicamente los píxeles proporcionados, no el nombre del archivo ni suposiciones. Distingue lo observado, lo inferido y lo que no es legible o visible.';
  const specialties={code:'Si hay software o interfaz, identifica texto de error legible, pantalla y secuencia, hipótesis verificables y pasos reproducibles. No inventes trazas.',analysis:'Prioriza hallazgos, anomalías, incertidumbre y comprobaciones útiles.',design:'Analiza jerarquía visual, contraste, legibilidad, accesibilidad y mejoras prácticas cuando corresponda.',executive:'Separa hechos visibles, riesgos plausibles y acciones operativas. No inventes costos, identidades ni métricas.',research:'Describe evidencia visual; no afirmes haber consultado la web ni menciones fuentes no recuperadas.',general:'Da una respuesta natural y útil, con detalles específicos y recomendaciones solo cuando aporten valor.'};
  const contents=[{text:instruction+'\n'+specialties[mode]+'\nPrioriza la pregunta exacta del usuario. Si hay texto o UI visible, transcríbelo solo cuando sea legible. No atribuyas causas, emociones, diagnósticos ni identidades no demostrables.\nSolicitud: '+question},...frames.flatMap((frame,index)=>[{text:kind==='video'?'Hoja temporal '+(index+1)+' (desde '+frame.timeSec+'s'+(frame.endSec!==null?' hasta '+frame.endSec+'s':'')+'); las etiquetas de tiempo internas identifican cada captura.':'Imagen '+(index+1)},{inline_data:{mime_type:frame.mime_type,data:frame.data}}])];
  const endpoint='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';
  const result=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify({contents:[{role:'user',parts:contents}],generationConfig:{maxOutputTokens:2400,temperature:0.2}}),signal:AbortSignal.timeout(30000)});
  const data=await result.json().catch(()=>({}));
  if(!result.ok)throw Object.assign(new Error('El proveedor visual no completó la consulta ('+result.status+')'),{statusCode:result.status===429?429:502,code:'vision_provider_unavailable'});
  const reply=(data.candidates?.[0]?.content?.parts||[]).map(part=>part.text||'').join('\n').trim();
  if(!reply)throw Object.assign(new Error('No hubo un resultado visual interpretable; conserva tu captura.'),{statusCode:502,code:'empty_visual_response'});
  return{reply,mediaKind:kind,analyzedFrames:frames.length,videoScope:kind==='video'?'sampled_frames_only':'image',model};
}
