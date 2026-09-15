import { recallMemory } from './memory.js';
import { buildAssistantResponse } from './response.js';
import { evaluateAnswer } from './quality.js';

const EDGE_TIMEOUT_MS = 55000;
const EXACT_TIMEOUT_MS = 6500;
const RECYCLE_THRESHOLD = 0.88;
const SENSITIVE_OR_VOLATILE_RX = /\b(m[eé]dic|salud|diagn[oó]stic|tratamiento|dosis|farmacol|legal|jur[ií]dic|penal|delito|fiscal|tributar|inversi[oó]n|cr[eé]dito|fraude|contrase[nñ]a|password|token|api[_ -]?key|secreto|secret|privad[oa]|confidencial|hoy|actual|actualmente|reciente|latest|today|current|noticias|news|precio|cotizaci[oó]n|jurisprudencia|reforma|ley vigente)\b/i;
const EXACT_SIGNAL_RX = /\b(calcula|calcular|eval[uú]a|expresi[oó]n exacta|ruta cr[ií]tica|critical path|ingresos mensuales|costos variables|valor neto esperado|probabilidad|mql|sql|acv|aprobaci[oó]n humana|buggy_result|correct_result|fix_pattern)\b/i;

function supabaseUrl(){ return String(process.env.SUPABASE_URL || '').replace(/\/$/,''); }
function edgeUrl(){ return process.env.WAE_SUPABASE_EDGE_URL || `${supabaseUrl()}/functions/v1/wae-local-voice-demo-v61`; }
function publishableKey(){ return String(process.env.SUPABASE_PUBLISHABLE_KEY || ''); }
function serviceKey(){ return String(process.env.SUPABASE_SERVICE_ROLE_KEY || ''); }
function sleep(ms){ return new Promise(resolve => setTimeout(resolve,ms)); }

function normalized(value=''){
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/https?:\/\/\S+/g,' ').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
function tokens(value=''){
  return [...new Set((normalized(value).match(/[a-z0-9]{3,}/g) || []).filter(x => !['que','como','para','por','con','sin','una','uno','unos','unas','del','las','los','este','esta','estos','estas','sobre','and','the','for','with','what','how'].includes(x)))];
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
  return q.length>=3 && q.length<=2400 && !SENSITIVE_OR_VOLATILE_RX.test(q);
}

function localEnvelope({text,provider,model,userKey,path,quality=null,degraded=false,extra={}}){
  const requestId=crypto.randomUUID();
  const response=buildAssistantResponse({content:text,sources:[],provider,model,latencyMs:0,memoryCount:0,requestId,webUsed:false,degraded});
  response.metadata={...response.metadata,resilience:{active:true,path,...extra},quality};
  return {
    reply:text,response,speech_text:response.speechText,components:response.components,actions:response.actions,web_sources:[],request_id:requestId,response_schema:response.schema,
    provider,model,degraded,tools:[],memory:{recalled:path==='approved_memory_recycle'?1:0,persistent:true},usage:null,latencyMs:0,
    fallbackFailures:[],quality:quality||undefined,cognitive_policy:{path},repair_attempted:false,fast_lane:path!=='research_rescue',resilience:{active:true,path,...extra},user_key:userKey
  };
}

async function tryApprovedMemoryRecycle({userKey,message,mode}){
  if(!safeForRecycle(message) || !userKey) return null;
  const rows=await recallMemory(userKey,message,5).catch(()=>[]);
  let best=null;
  for(const row of rows){
    const turn=parseMemoryTurn(row?.content);
    if(!turn?.user || !turn?.assistant) continue;
    const score=similarity(message,turn.user);
    if(score<RECYCLE_THRESHOLD) continue;
    if(!best || score>best.score) best={...turn,score};
  }
  if(!best) return null;
  const quality=evaluateAnswer({question:message,answer:best.assistant,mode:String(mode||'general'),sources:[]});
  if(quality?.critical===true) return null;
  return localEnvelope({text:best.assistant,provider:'wae_recycled',model:'universal-core-approved-memory-v1',userKey,path:'approved_memory_recycle',quality,degraded:false,extra:{similarity:Number(best.score.toFixed(3))}});
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
  const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json','apikey':key,'Origin':process.env.PUBLIC_APP_URL||'https://wae-inteligencia-universal.onrender.com','X-Client-Info':'wae-universal-rescue/1.0'},body:JSON.stringify(payload),signal:AbortSignal.timeout(timeoutMs),cache:'no-store'});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw Object.assign(new Error(String(data?.error||`edge_${res.status}`)),{status:res.status,data});
  return data;
}

async function tryResearchRescue({message,mode,attachments=[],originalError}){
  if(!supabaseUrl() || !publishableKey()) return null;
  try{
    const boot=await edgeJson({action:'bootstrap'},15000);
    if(!boot?.session_id || !boot?.session_secret) return null;
    const data=await edgeJson({
      action:'chat',session_id:boot.session_id,session_secret:boot.session_secret,message:String(message).slice(0,24000),
      mode:'research',web_enabled:true,attachments:Array.isArray(attachments)?attachments.slice(0,5):[],routing_variant:'control'
    },EDGE_TIMEOUT_MS);
    if(!data?.reply) return null;
    data.resilience={active:true,path:'research_rescue',source_mode:String(mode||'general'),original_error:String(originalError?.code||originalError?.message||'provider_unavailable'),web_used:data.web_used===true};
    if(data.response?.metadata) data.response.metadata={...data.response.metadata,resilience:data.resilience};
    return data;
  }catch{return null}
}

export async function rescueMission({payload={},userKey='',error=null}={}){
  const message=String(payload.message||payload.task||'').trim();
  if(!message) return null;

  const memoryPromise=tryApprovedMemoryRecycle({userKey,message,mode:payload.mode});
  const exactPromise=tryExactBrain({message,userKey});
  const memory=await memoryPromise;
  if(memory) return memory;
  const exact=await exactPromise;
  if(exact) return exact;

  return await tryResearchRescue({message,mode:payload.mode,attachments:payload.attachments,originalError:error});
}

export function recoverableRuntimeError(error){
  const code=String(error?.code||'');
  const msg=String(error?.message||'');
  return ['NO_PROVIDER','ALL_PROVIDERS_FAILED','LOW_QUALITY'].includes(code) || /all_models_unavailable|all.*providers.*failed|continuity_pass_through|quality_gate_rejected/i.test(msg);
}
