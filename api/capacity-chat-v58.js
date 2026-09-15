import baseCapacityChatHandler from './capacity-chat.js';
import { allowRequest, originAllowed, applyHeaders, getClientIp } from '../lib/security.js';
import { tryAcquireChatSlot } from '../lib/concurrency-governor.js';
import { executeMission } from '../lib/runtime.js';
import { modernizePayload, MODERN_RESPONSE_VERSION } from '../lib/modern-response-v50.js';
import { isSafeAssistantOutput, publicContextFallback, CONTEXT_OUTPUT_FIREWALL_VERSION } from '../lib/context-output-firewall-v55.js';
import { runWithRequestSignal } from '../lib/network-deadlines-v46.js';
import { shouldUseExecutiveOrchestrator, runExecutiveOrchestration, EXECUTIVE_ORCHESTRATION_VERSION } from '../lib/executive-orchestration-v58.js';
import { retrieveLiveData, formatLiveDataContext, publicLiveDataMetadata, shouldUseLiveData, LIVE_DATA_MESH_VERSION } from '../lib/live-data-mesh-v58.js';

function safePayload(payload={}){
  const reply=String(payload?.reply??payload?.response?.content??'').trim();
  if(!reply||isSafeAssistantOutput(reply))return payload;
  const fallback=publicContextFallback();
  return{
    ...payload,reply:fallback,speech_text:fallback,components:[],
    response:{...(payload?.response||{}),content:fallback,speechText:fallback,components:[],metadata:{...(payload?.response?.metadata||{}),contextOutputBlocked:true,contextOutputFirewall:CONTEXT_OUTPUT_FIREWALL_VERSION}},
    context_output_blocked:true,provider:'universal_core',model:'context-output-firewall-v55',degraded:true
  };
}

async function bounded(ms,task){return runWithRequestSignal(AbortSignal.timeout(ms),task)}

function sourceList(live={}){
  return(Array.isArray(live?.sources)?live.sources:[]).slice(0,10).map((x,i)=>({
    key:String(x.key||`R${i+1}`),title:String(x.title||'Fuente reciente').slice(0,500),url:String(x.url||'').slice(0,1800),
    host:String(x.host||'').slice(0,250),snippet:String(x.snippet||'').slice(0,1800),published_at:x.published_at||null,
    retrieved_at:x.retrieved_at||live.retrievedAt||null,freshness_tier:x.freshness_tier||null
  })).filter(x=>/^https?:\/\//.test(x.url));
}

function mergeSources(...groups){
  const map=new Map();
  for(const source of groups.flat().filter(Boolean))if(source?.url&&!map.has(source.url))map.set(source.url,source);
  return[...map.values()].slice(0,10);
}

function controlledUnavailable(live){
  const reply='No pude verificar datos actuales con una fuente viva en este turno. Para evitar darte información desactualizada como si fuera vigente, bloqueé la afirmación temporal. Puedes reintentar la consulta; el resto del sistema sigue operativo.';
  return{
    success:true,reply,speech_text:reply,components:[],actions:[],provider:'universal_core',model:'live-data-fail-closed-v58',degraded:true,web_sources:[],
    response:{schema:'assistant-response/v1',content:reply,components:[],actions:[],sources:[],speechText:reply,metadata:{liveDataMesh:LIVE_DATA_MESH_VERSION,liveData:publicLiveDataMetadata(live),degraded:true,webUsed:false}},
    live_data:publicLiveDataMetadata(live)
  };
}

export default async function capacityChatV58(req,res){
  const original=req.body||{};
  const message=String(original.message||original.task||'').trim();
  const mode=String(original.mode||original.agent||'general').toLowerCase();
  const liveIntent=shouldUseLiveData({message,mode,webEnabled:original.web_enabled===true});
  if(!liveIntent)return baseCapacityChatHandler(req,res);

  applyHeaders(res);
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req,Number(process.env.WAE_LIVE_RATE_LIMIT_PER_MINUTE||12)))return res.status(429).json({error:'live_rate_limited'});
  if(!message)return res.status(400).json({error:'message_required'});

  const key=String(original.userKey||original.sessionId||original.session_id||getClientIp(req)).slice(0,160);
  const slot=tryAcquireChatSlot(`${key}:live`.slice(0,160));
  if(!slot.ok){
    res.setHeader('Retry-After',String(Math.max(1,Math.ceil(slot.retryAfterMs/1000))));
    return res.status(503).json({error:'CAPACITY_BUSY',message:'Universal Core está procesando datos vivos. El turno fue rechazado de forma controlada y puede reintentarse.',recoverable:true,retry_after_ms:slot.retryAfterMs});
  }

  try{
    const live=await bounded(10_000,()=>retrieveLiveData({message,mode,webEnabled:true,force:true,maxResults:8}));
    res.setHeader('X-WAE-Live-Data',LIVE_DATA_MESH_VERSION);
    res.setHeader('X-WAE-Live-Sources',String(live?.sourceCount||0));
    res.setHeader('X-WAE-Context-Output-Firewall',CONTEXT_OUTPUT_FIREWALL_VERSION);

    if(!live?.evidenceReady){
      res.setHeader('X-WAE-Live-Fail-Closed','1');
      return res.status(200).json(safePayload(controlledUnavailable(live)));
    }

    let result;
    if(shouldUseExecutiveOrchestrator(original)){
      result=await bounded(Number(process.env.WAE_ORCHESTRATION_DEADLINE_MS||24_000),()=>runExecutiveOrchestration({body:{...original,live_data:true,web_enabled:true},userKey:key,sessionId:String(original.sessionId||original.session_id||'')}));
      if(!result)throw new Error('live_executive_unavailable');
      res.setHeader('X-WAE-Cognitive-Path',EXECUTIVE_ORCHESTRATION_VERSION);
      res.setHeader('X-WAE-Multi-Agent','database-backed-v58-live');
    }else{
      const liveAttachment={name:'WAE_LIVE_DATA_V58.txt',type:'application/vnd.wae.live-evidence+text',text:formatLiveDataContext(live)};
      const userAttachments=Array.isArray(original.attachments)?original.attachments.slice(0,4):[];
      const runtimeMode=['general','auto'].includes(mode)?'research':mode;
      result=await bounded(26_000,()=>executeMission({...original,userKey:key,mode:runtimeMode,disableTools:true,attachments:[liveAttachment,...userAttachments]}));
      const sources=mergeSources(sourceList(live),result?.web_sources||[]);
      result={...result,web_sources:sources,live_data:publicLiveDataMetadata(live),speech_text:String(result?.speech_text||'').replace(/\[R\d+\]/gi,' ')};
      if(result.response){
        result.response={...result.response,sources,speechText:String(result.response.speechText||'').replace(/\[R\d+\]/gi,' '),metadata:{...(result.response.metadata||{}),webUsed:true,liveDataMesh:LIVE_DATA_MESH_VERSION,liveData:publicLiveDataMetadata(live)}};
      }
    }

    res.setHeader('X-WAE-Response-Style',MODERN_RESPONSE_VERSION);
    return res.status(200).json(safePayload(modernizePayload(result,{...original,mode:shouldUseExecutiveOrchestrator(original)?'executive':'research'})));
  }catch(error){
    return res.status(503).json({error:'LIVE_DATA_PATH_FAILED',message:'El canal de datos vivos no pudo completar este turno. Universal Core bloqueó una respuesta potencialmente desactualizada en lugar de inventarla.',recoverable:true,detail:String(error?.message||error).slice(0,180)});
  }finally{
    slot.release();
  }
}
