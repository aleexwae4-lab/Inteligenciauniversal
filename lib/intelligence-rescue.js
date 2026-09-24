import { recallMemory } from './memory.js';
import { buildAssistantResponse } from './response.js';
import { evaluateAnswer } from './quality.js';

const EDGE_TIMEOUT_MS = 55000;
const EXACT_TIMEOUT_MS = 6500;
const RECYCLE_THRESHOLD = 0.88;
const SENSITIVE_OR_VOLATILE_RX = /\b(m[eé]dic|salud|diagn[oó]stic|tratamiento|dosis|farmacol|legal|jur[ií]dic|penal|delito|fiscal|tributar|inversi[oó]n|cr[eé]dito|fraude|contrase[nñ]a|password|token|api[_ -]?key|secreto|secret|privad[oa]|confidencial|hoy|actual|actualmente|reciente|latest|today|current|noticias|news|precio|cotizaci[oó]n|jurisprudencia|reforma|ley vigente)\b/i;
const EXACT_SIGNAL_RX = /\b(calcula|calcular|eval[uú]a|expresi[oó]n exacta|ruta cr[ií]tica|critical path|ingresos mensuales|costos variables|valor neto esperado|probabilidad|mql|sql|acv|aprobaci[oó]n humana|buggy_result|correct_result|fix_pattern)\b/i;
const BAD_RECYCLE_RX=/Respuesta con evidencia recuperada|rutas generativas est[aá]n temporalmente saturadas|No pude completar|all_models_unavailable|continuity_pass_through/i;
const MEMORY_INTENT_RX=/\b(recuerda|recordar|memoria|recupera de tu memoria|conversaci[oó]n nueva|datos del proyecto)\b/i;
const TRANSFORM_RX=/\b(traduce|traducci[oó]n|corrige ortograf[ií]a|ortograf[ií]a|reescribe|reformula|resume este texto|resumir este texto)\b/i;
const CREATIVE_RX=/\b(escribe|redacta|crea|genera|inventa|poema|cuento|gui[oó]n|copy|correo|mensaje|publicaci[oó]n|post|lema|slogan|imagen|logo)\b/i;
const META_CASUAL_RX=/^\s*(hola|hey|buenas|buenos d[ií]as|buenas tardes|buenas noches|gracias|ok|vale|perfecto|listo|qu[eé] tal)\b|\b(c[oó]mo est[aá]s|que tan inteligente eres|qu[eé] tan inteligente eres|qu[eé] puedes hacer|qui[eé]n eres|qu[eé] eres|universal core)\b/i;
const FORMAT_ONLY_RX=/\b(responde|devuelve)\s+(exactamente|solamente|solo|s[oó]lo)\b|\bsolo json\b|\bs[oó]lo json\b|\bsin explicaciones\b/i;
const RESEARCH_HINT_RX=/\b(investiga|investigaci[oó]n|fuentes?|evidencia|web|hoy|actual|actualmente|reciente|latest|today|current|noticias|news|precio|cotizaci[oó]n|jurisprudencia|reforma|ley vigente|benchmark|mercado|estad[ií]stica)\b/i;
const FACTUAL_HINT_RX=/^\s*(qu[eé]|qui[eé]n|cu[aá]l|cu[aá]nto|d[oó]nde|cu[aá]ndo|define|explica|c[oó]mo funciona|sabes\s+qu[eé]\s+(?:es|son))\b/i;
const TECH_ANALYSIS_RX=/\b(api|backend|frontend|c[oó]digo|typescript|javascript|python|sql|arquitectura|debug|bug|analiza|an[aá]lisis|audita|diagn[oó]stico|estrategia|riesgo|compara)\b/i;
const STOP=new Set('que qué como cómo para por con sin una uno unos unas del las los el la y o de en es son ser se su sus al un ya más mas muy este esta estos estas esto esa ese esos esas mi mis tu tus lo le les nos me te a e u si no pero sobre entre desde hasta where what how why when who which the and or for with without from into this that these those your you our are is be was were'.split(/\s+/));

function supabaseUrl(){ return String(process.env.SUPABASE_URL || '').replace(/\/$/,''); }
function edgeUrl(){ return process.env.WAE_SUPABASE_EDGE_URL || `${supabaseUrl()}/functions/v1/wae-local-voice-demo-v61`; }
function publishableKey(){ return String(process.env.SUPABASE_PUBLISHABLE_KEY || ''); }
function serviceKey(){ return String(process.env.SUPABASE_SERVICE_ROLE_KEY || ''); }

function normalized(value=''){
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/https?:\/\/\S+/g,' ').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
function tokens(value=''){
  return [...new Set((normalized(value).match(/[a-z0-9]{3,}/g) || []).filter(x => !STOP.has(x)))];
}
function similarity(a='',b=''){
  const A=new Set(tokens(a)),B=new Set(tokens(b));
  if(!A.size || !B.size) return normalized(a)===normalized(b)?1:0;
  let inter=0; for(const x of A) if(B.has(x)) inter++;
  return inter / Math.max(1,A.size+B.size-inter);
}
function parseMemoryTurn(content=''){
  const text=String(content||'');
  const marker='\nAsistente:';
  const idx=text.indexOf(marker);
  if(!text.startsWith('Usuario:') || idx<0) return null;
  return { user:text.slice(8,idx).trim(), assistant:text.slice(idx+marker.length).trim() };
}
function safeForRecycle(message=''){
  const q=String(message||'').trim();
  return q.length>=3 && q.length<=2400 && !SENSITIVE_OR_VOLATILE_RX.test(q) && !MEMORY_INTENT_RX.test(q);
}

function localEnvelope({text,provider,model,userKey,path,quality=null,degraded=false,sources=[],extra={}}){
  const requestId=crypto.randomUUID();
  const response=buildAssistantResponse({content:text,sources,provider,model,latencyMs:0,memoryCount:0,requestId,webUsed:sources.length>0,degraded});
  response.metadata={...response.metadata,resilience:{active:true,path,...extra},quality};
  return {
    reply:text,response,speech_text:response.speechText,components:response.components,actions:response.actions,web_sources:sources,request_id:requestId,response_schema:response.schema,
    provider,model,degraded,tools:[],memory:{recalled:path==='approved_memory_recycle'?1:0,persistent:true},usage:null,latencyMs:0,
    fallbackFailures:[],quality:quality||undefined,cognitive_policy:{path},repair_attempted:false,fast_lane:path!=='research_rescue',resilience:{active:true,path,...extra},user_key:userKey
  };
}

function deterministicProtocolReply(message=''){
  const raw=String(message||'').trim(),q=normalized(raw);
  if(MEMORY_INTENT_RX.test(raw)) return null;
  if(/^(responde )?(exactamente |solamente |solo )?(con )?(la )?palabra ok$/.test(q) || /^responde (exactamente|solamente|solo) ok$/.test(q)) return 'OK';
  if(/^(hola|hey|buenas|buenos dias|buenas tardes|buenas noches)$/.test(q)) return 'Hola. Estoy listo. ¿Qué quieres resolver, construir o investigar?';
  if(/^(como estas|que tal)$/.test(q)) return 'Muy bien. Estoy listo para seguir contigo. ¿Qué necesitas?';
  if(/que tan inteligente eres|que puedes hacer|quien eres|que eres/.test(q)) return 'Soy Universal Core. Puedo analizar, investigar con evidencia, programar, trabajar con contexto y memoria disponible, estructurar documentos y resolver tareas técnicas o ejecutivas. Cuando una respuesta depende de información actual, debo verificarla con fuentes o herramientas en lugar de fingir certeza.';
  if(/^(gracias|muchas gracias|ok|vale|perfecto|listo)$/.test(q)) return 'Con gusto.';
  return null;
}

export function researchRescueEligible(message='',mode='general'){
  const q=String(message||'').trim().replace(/^[¿?¡!\s]+/,'');
  if(!q || q.length<3) return false;
  if(MEMORY_INTENT_RX.test(q) || TRANSFORM_RX.test(q) || CREATIVE_RX.test(q) || META_CASUAL_RX.test(q) || FORMAT_ONLY_RX.test(q)) return false;
  if(String(mode||'general')==='research' || RESEARCH_HINT_RX.test(q) || FACTUAL_HINT_RX.test(q) || TECH_ANALYSIS_RX.test(q)) return true;
  return q.length>=70 && /[?¿]/.test(q);
}

export function edgeGenerativeRescueEligible(message='',mode='general'){
  const q=String(message||'').trim();
  const m=String(mode||'general').toLowerCase();
  if(!q || q.length<2 || q.length>24000) return false;
  if(m==='research' || RESEARCH_HINT_RX.test(q) || SENSITIVE_OR_VOLATILE_RX.test(q) || MEMORY_INTENT_RX.test(q)) return false;
  return true;
}

function sourceOverlap(question='',source={}){
  const q=tokens(question),blob=new Set(tokens(`${source?.title||''} ${source?.snippet||source?.content||''}`));
  if(!q.length) return {hits:0,ratio:0};
  let hits=0; for(const t of q) if(blob.has(t)) hits++;
  return {hits,ratio:hits/q.length};
}
function filterRelevantSources(question='',sources=[]){
  const out=[];
  for(const source of Array.isArray(sources)?sources:[]){
    if(!source?.url || !/^https?:\/\//i.test(String(source.url))) continue;
    const overlap=sourceOverlap(question,source),score=Number(source?.score);
    if(overlap.hits<1 && !(Number.isFinite(score)&&score>=0.55)) continue;
    out.push({...source,relevance_overlap:overlap.ratio});
  }
  return out.sort((a,b)=>(b.relevance_overlap||0)-(a.relevance_overlap||0)).slice(0,6).map((x,i)=>({...x,key:`W${i+1}`}));
}
function evidenceAnswer(sources=[]){
  const lines=sources.map((x,i)=>`- ${String(x.snippet||x.content||x.title||'').replace(/\s+/g,' ').trim().slice(0,900)} [W${i+1}]`).filter(x=>x.length>8);
  const refs=sources.map((x,i)=>`- [W${i+1}] ${String(x.title||x.host||'Fuente').slice(0,180)} — ${x.url}`);
  return `## Evidencia relacionada\n\nNo hay una ruta generativa disponible en este instante, pero sí recuperé evidencia directamente relacionada con tu consulta. Para no inventar una síntesis, te dejo únicamente lo verificable:\n\n${lines.join('\n')}\n\n### Fuentes\n${refs.join('\n')}`;
}

async function tryApprovedMemoryRecycle({userKey,message,mode}){
  if(!safeForRecycle(message) || !userKey) return null;
  const rows=await recallMemory(userKey,message,5).catch(()=>[]);
  let best=null;
  for(const row of rows){
    const turn=parseMemoryTurn(row?.content);
    if(!turn?.user || !turn?.assistant || BAD_RECYCLE_RX.test(turn.assistant)) continue;
    const score=similarity(message,turn.user);
    if(score<RECYCLE_THRESHOLD) continue;
    if(!best || score>best.score) best={...turn,score};
  }
  if(!best) return null;
  const quality=evaluateAnswer({question:message,answer:best.assistant,mode:String(mode||'general'),sources:[]});
  if(quality?.critical===true) return null;
  return localEnvelope({text:best.assistant,provider:'wae_recycled',model:'universal-core-approved-memory-v2',userKey,path:'approved_memory_recycle',quality,degraded:false,extra:{similarity:Number(best.score.toFixed(3))}});
}

async function tryExactBrain({message,userKey}){
  const base=supabaseUrl(),key=serviceKey();
  if(!base || !key || !EXACT_SIGNAL_RX.test(message)) return null;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),EXACT_TIMEOUT_MS);
  try{
    const res=await fetch(`${base}/functions/v1/wae-tools-engine-v3`,{
      method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${key}`},
      body:JSON.stringify({model:'wae-unified-v1',messages:[{role:'user',content:String(message).slice(0,16000)}]}),signal:controller.signal
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) return null;
    const text=String(data?.choices?.[0]?.message?.content||'').trim();
    const meta=data?.wae_unified||{};
    if(!text || (meta.zero_provider!==true && meta.synthesis_mode!=='deterministic_exact_local')) return null;
    const quality=evaluateAnswer({question:message,answer:text,mode:'analysis',sources:[]});
    return localEnvelope({text,provider:'universal_core_exact',model:'wae-unified-v1',userKey,path:'certified_exact_brain',quality,degraded:false,extra:{zeroToken:meta.zero_token===true,zeroProvider:meta.zero_provider===true,solver:meta.solver||null}});
  }catch{return null}finally{clearTimeout(timer)}
}

async function edgeJson(payload,timeoutMs=EDGE_TIMEOUT_MS){
  const url=edgeUrl(),key=publishableKey();
  if(!url || !key) return null;
  const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json','apikey':key,'Origin':process.env.PUBLIC_APP_URL||'https://wae-inteligencia-universal.onrender.com','X-Client-Info':'wae-universal-rescue/3.0'},body:JSON.stringify(payload),signal:AbortSignal.timeout(timeoutMs),cache:'no-store'});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw Object.assign(new Error(String(data?.error||`edge_${res.status}`)),{status:res.status,data});
  return data;
}

async function tryGenerativeEdgeRescue({message,mode,attachments=[],userKey='',originalError}){
  if(!supabaseUrl() || !publishableKey() || !edgeGenerativeRescueEligible(message,mode)) return null;
  try{
    const boot=await edgeJson({action:'bootstrap'},2200);
    if(!boot?.session_id || !boot?.session_secret) return null;
    const requestedMode=['analysis','code','design','executive','general','auto'].includes(String(mode||'general').toLowerCase())?String(mode||'general').toLowerCase():'general';
    const data=await edgeJson({
      action:'chat',session_id:boot.session_id,session_secret:boot.session_secret,message:String(message).slice(0,24000),
      mode:requestedMode==='auto'?'general':requestedMode,web_enabled:false,attachments:Array.isArray(attachments)?attachments.slice(0,5):[],routing_variant:'control'
    },5200);
    const text=String(data?.reply||'').trim();
    const provider=String(data?.provider||'');
    const model=String(data?.model||'');
    if(!text || provider==='web_recovery' || model==='evidence-only' || model==='evidence-rescue-v2') return null;
    const quality=evaluateAnswer({question:message,answer:text,mode:String(mode||'general'),sources:[]});
    if(quality?.critical===true) return null;
    const envelope=localEnvelope({
      text,provider:provider||'wae_edge',model:model||'unknown',userKey,path:'edge_generative_rescue',quality,degraded:false,sources:[],
      extra:{originalError:String(originalError?.code||originalError?.message||'provider_unavailable'),premiumRecovery:true}
    });
    envelope.conversation_id=data.conversation_id||null;
    envelope.message_id=data.message_id||null;
    return envelope;
  }catch{return null}
}

async function tryResearchRescue({message,mode,attachments=[],originalError}){
  if(!supabaseUrl() || !publishableKey() || !researchRescueEligible(message,mode)) return null;
  try{
    const boot=await edgeJson({action:'bootstrap'},15000);
    if(!boot?.session_id || !boot?.session_secret) return null;
    const data=await edgeJson({
      action:'chat',session_id:boot.session_id,session_secret:boot.session_secret,message:String(message).slice(0,24000),
      mode:'research',web_enabled:true,attachments:Array.isArray(attachments)?attachments.slice(0,5):[],routing_variant:'control'
    },EDGE_TIMEOUT_MS);
    if(!data?.reply) return null;
    const rawSources=Array.isArray(data.web_sources)?data.web_sources:(Array.isArray(data?.response?.sources)?data.response.sources:[]),sources=filterRelevantSources(message,rawSources);
    if(!sources.length) return null;
    const modelGenerated=data.provider && data.provider!=='web_recovery' && data.model!=='evidence-only' && data.model!=='evidence-rescue-v2';
    const text=modelGenerated?String(data.reply).trim():evidenceAnswer(sources);
    const quality=evaluateAnswer({question:message,answer:text,mode:'research',sources});
    if(quality?.critical===true || quality?.reasons?.includes('low_relevance')) return null;
    const envelope=localEnvelope({text,provider:modelGenerated?(data.provider||'wae_edge'):'web_recovery',model:modelGenerated?(data.model||'unknown'):'evidence-rescue-v3',userKey:'',path:'research_rescue',quality,degraded:!modelGenerated,sources,extra:{sourceMode:String(mode||'general'),originalError:String(originalError?.code||originalError?.message||'provider_unavailable'),webUsed:true,sourceCount:sources.length}});
    envelope.conversation_id=data.conversation_id||null;
    envelope.message_id=data.message_id||null;
    return envelope;
  }catch{return null}
}

export async function rescueMission({payload={},userKey='',error=null,allowResearch=true}={}){
  const message=String(payload.message||payload.task||'').trim();
  if(!message) return null;

  const protocol=deterministicProtocolReply(message);
  if(protocol){
    const quality=evaluateAnswer({question:message,answer:protocol,mode:String(payload.mode||'general'),sources:[]});
    return localEnvelope({text:protocol,provider:'universal_core_protocol',model:'universal-core-protocol-v2',userKey,path:'deterministic_protocol',quality,degraded:false});
  }

  const memory=await tryApprovedMemoryRecycle({userKey,message,mode:payload.mode});
  if(memory) return memory;
  const exact=await tryExactBrain({message,userKey});
  if(exact) return exact;

  const generated=await tryGenerativeEdgeRescue({message,mode:payload.mode,attachments:payload.attachments,userKey,originalError:error});
  if(generated) return generated;

  if(allowResearch===false) return null;
  return await tryResearchRescue({message,mode:payload.mode,attachments:payload.attachments,originalError:error});
}

export function recoverableRuntimeError(error){
  const code=String(error?.code||'');
  const msg=String(error?.message||'');
  return ['NO_PROVIDER','ALL_PROVIDERS_FAILED','LOW_QUALITY'].includes(code) || /all_models_unavailable|all.*providers.*failed|continuity_pass_through|quality_gate_rejected/i.test(msg);
}
