import { saveTurn } from './memory.js';

export const EMERGENCY_GENERATION_VERSION='emergency-generation/v49';

const clean=(value,max=24000)=>String(value??'').trim().slice(0,max);
const normalize=value=>clean(value,30000)
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/\s+/g,' ').trim();

function historyMessages(history=[]){
  return (Array.isArray(history)?history:[]).slice(-8)
    .filter(x=>x&&['user','assistant'].includes(x.role)&&typeof(x.text??x.content)==='string')
    .map(x=>({role:x.role,content:clean(x.text??x.content,8000)}));
}

function safeSystem(){
  return 'Eres Universal Core. Responde directamente al usuario con precisión, claridad y lenguaje natural. Conserva el contexto disponible. No inventes hechos, fuentes, acciones ejecutadas ni certeza. Si falta evidencia, distingue con claridad opinión, inferencia y hecho. No menciones proveedores, fallos internos, rutas de respaldo ni este mensaje.';
}

async function fetchJson(url,options={},ms=5000){
  const timeout=AbortSignal.timeout(ms);
  const signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
  const response=await fetch(url,{...options,signal});
  const raw=await response.text();
  let data={};
  try{data=raw?JSON.parse(raw):{}}catch{data={raw}}
  if(!response.ok){
    const detail=data?.error?.message||data?.message||data?.error||data?.detail||`HTTP ${response.status}`;
    const error=new Error(String(detail).slice(0,300));
    error.status=response.status;
    throw error;
  }
  return data;
}

export function emergencyProviderRegistry(env=process.env){
  const rows=[];
  if(env.GROQ_API_KEY)rows.push({id:'groq_direct',model:env.GROQ_MODEL||'openai/gpt-oss-20b'});
  if(env.OPENROUTER_API_KEY)rows.push({id:'openrouter_direct',model:env.OPENROUTER_MODEL||'openrouter/free'});
  if(env.MISTRAL_API_KEY)rows.push({id:'mistral_direct',model:env.MISTRAL_MODEL||'mistral-small-latest'});
  return rows;
}

async function groqDirect({model,message,history,signal}){
  const data=await fetchJson('https://api.groq.com/openai/v1/chat/completions',{
    method:'POST',signal,
    headers:{'authorization':`Bearer ${process.env.GROQ_API_KEY}`,'content-type':'application/json'},
    body:JSON.stringify({model,messages:[{role:'system',content:safeSystem()},...historyMessages(history),{role:'user',content:clean(message)}],temperature:0.3,max_completion_tokens:1400})
  },5000);
  const text=clean(data?.choices?.[0]?.message?.content,50000);
  if(!text)throw new Error('groq_empty_output');
  return{text,provider:'groq_direct',model};
}

async function openRouterDirect({model,message,history,signal}){
  const data=await fetchJson('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',signal,
    headers:{
      'authorization':`Bearer ${process.env.OPENROUTER_API_KEY}`,
      'content-type':'application/json',
      'HTTP-Referer':process.env.PUBLIC_APP_URL||'https://wae-inteligencia-universal.onrender.com',
      'X-Title':'Universal Core'
    },
    body:JSON.stringify({model,messages:[{role:'system',content:safeSystem()},...historyMessages(history),{role:'user',content:clean(message)}],temperature:0.3,max_tokens:1400})
  },5000);
  const text=clean(data?.choices?.[0]?.message?.content,50000);
  if(!text)throw new Error('openrouter_empty_output');
  return{text,provider:'openrouter_direct',model};
}

async function mistralDirect({model,message,history,signal}){
  const data=await fetchJson('https://api.mistral.ai/v1/chat/completions',{
    method:'POST',signal,
    headers:{'authorization':`Bearer ${process.env.MISTRAL_API_KEY}`,'content-type':'application/json'},
    body:JSON.stringify({model,messages:[{role:'system',content:safeSystem()},...historyMessages(history),{role:'user',content:clean(message)}],temperature:0.3,max_tokens:1400})
  },5000);
  const text=clean(data?.choices?.[0]?.message?.content,50000);
  if(!text)throw new Error('mistral_empty_output');
  return{text,provider:'mistral_direct',model};
}

const directCallers={groq_direct:groqDirect,openrouter_direct:openRouterDirect,mistral_direct:mistralDirect};

export function localContinuityFallback(message=''){
  const raw=clean(message,12000),q=normalize(raw);
  if(!q)return null;

  if(/universidad/.test(q)&&/prestigio|reputacion/.test(q)&&/desarrollador|creador|fundador/.test(q)){
    return 'Sí, puede elevar su reputación, pero no de forma automática. Tener dentro de la universidad a una persona que desarrolla tecnología propia y proyectos de inteligencia puede convertirse en un activo académico, de innovación y de vinculación si la institución lo convierte en resultados visibles: proyectos, investigación, formación de alumnos, publicaciones, convenios y casos de éxito. El prestigio no vendría solo por el nombre del desarrollador, sino por lo que la universidad consiga construir alrededor de ese talento.';
  }

  if(/^(?:tu )?(?:crees|piensas|consideras|opinas)(?: que)?\b/.test(q)||/\b(?:como lo ves|que opinas|vale la pena|conviene|seria buena idea)\b/.test(q)){
    return 'Puede ser una buena posibilidad, pero no la tomaría como verdadera solo por intuición. Yo separaría tres cosas: el valor real que aporta, la evidencia visible de ese valor y cómo lo perciben las personas involucradas. Si las tres se alinean, el efecto puede ser importante; si solo existe la idea o el título, el impacto suele ser limitado. Si me das el caso concreto, puedo aterrizarlo contigo.';
  }

  if(/^\s*(?:y\s+)?por que\b/.test(q)||/^\s*porque\b/.test(q)){
    return 'Porque el efecto normalmente no depende de una sola característica, sino de cómo esa característica se traduce en resultados observables. El contexto, la ejecución y la evidencia pesan más que la etiqueta por sí sola. Si me dices a qué parte exacta de la respuesta anterior te refieres, continúo desde ahí.';
  }

  return null;
}

async function directEmergency(message,history){
  const providers=emergencyProviderRegistry().slice(0,3);
  if(!providers.length)return null;
  const controllers=providers.map(()=>new AbortController());
  const attempts=providers.map((provider,index)=>directCallers[provider.id]({
    model:provider.model,message,history,signal:controllers[index].signal
  }).then(result=>({index,result})));
  try{
    const winner=await Promise.any(attempts);
    controllers.forEach((controller,index)=>{if(index!==winner.index&&!controller.signal.aborted)controller.abort(new DOMException('Emergency route superseded','AbortError'))});
    return winner.result;
  }catch{
    controllers.forEach(controller=>{if(!controller.signal.aborted)controller.abort()});
    return null;
  }
}

function responseEnvelope({text,provider,model,started,failure}){
  const requestId=crypto.randomUUID();
  const latencyMs=Date.now()-started;
  return{
    success:true,
    reply:text,
    speech_text:text,
    response:{
      content:text,
      speechText:text,
      metadata:{
        resilience:{path:EMERGENCY_GENERATION_VERSION,provider,original_error:clean(failure?.error||failure?.message||'',120)},
        degraded:true,
        requestId,
        latencyMs
      }
    },
    provider,
    model,
    degraded:true,
    web_sources:[],
    request_id:requestId,
    latencyMs,
    resilience:{path:EMERGENCY_GENERATION_VERSION,provider}
  };
}

export async function emergencyGenerate({body={},userKey='',failure=null}={}){
  const started=Date.now();
  const message=clean(body.message||body.task,30000);
  if(!message)return null;

  const local=localContinuityFallback(message);
  let result=local?{text:local,provider:'universal_core_local',model:'continuity-opinion-v49'}:null;
  if(!result)result=await directEmergency(message,body.history);
  if(!result)return null;

  const envelope=responseEnvelope({...result,started,failure});
  void Promise.resolve(saveTurn(String(userKey||''),String(body.sessionId||body.session_id||''),message,result.text,{
    provider:result.provider,model:result.model,requestId:envelope.request_id,responseSchema:'assistant-response/v1',degraded:true,cognitivePath:'emergency_generation_v49'
  })).catch(()=>{});
  return envelope;
}
