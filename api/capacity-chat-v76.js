import capacityChatV63 from './capacity-chat-v63.js';
import {generateWithGpuFabric,gpuFabricConfigured,gpuFabricSnapshot,GPU_FABRIC_VERSION} from '../lib/gpu-fabric-v76.js';
import {modernizePayload,MODERN_RESPONSE_VERSION} from '../lib/modern-response-v50.js';
import {applyAnswerIntelligence,ANSWER_INTELLIGENCE_VERSION} from '../lib/answer-intelligence-v60.js';
import {applyQualityReliability,QUALITY_RELIABILITY_VERSION} from '../lib/quality-reliability-v61.js';
import {isSafeAssistantOutput,publicContextFallback,CONTEXT_OUTPUT_FIREWALL_VERSION} from '../lib/context-output-firewall-v55.js';
import {applyHeaders,originAllowed,allowRequest} from '../lib/security.js';

function bufferedResponse(real){
  let code=200,payload,hasJson=false;
  const proxy=new Proxy(real,{
    get(target,prop){
      if(prop==='status')return status=>{code=Number(status)||500;return proxy};
      if(prop==='json')return body=>{payload=body;hasJson=true;return proxy};
      if(prop==='statusCode')return code;
      if(prop==='writableEnded')return false;
      const value=target[prop];
      return typeof value==='function'?value.bind(target):value;
    },
    set(target,prop,value){if(prop==='statusCode'){code=Number(value)||code;return true}target[prop]=value;return true}
  });
  return{proxy,get code(){return code},get payload(){return payload},get hasJson(){return hasJson}};
}

function replyOf(payload={}){return String(payload?.reply??payload?.response?.content??'').trim()}
function degradedPayload(payload={}){
  const provider=String(payload?.provider||'').toLowerCase(),model=String(payload?.model||'').toLowerCase(),reply=replyOf(payload).toLowerCase();
  return payload?.degraded===true
    || payload?.response?.metadata?.degraded===true
    || /deterministic_rescue|deterministic-rescue|web_recovery|evidence-rescue|continuity_core/.test(`${provider} ${model}`)
    || /rutas generativas.*(?:saturad|no estuv)|evidencia de archivo preservada|todos los proveedores configurados fallaron/.test(reply);
}
function recoverableFailure(code,payload={}){
  if(code<400)return false;
  const error=String(payload?.error||payload?.code||'').toUpperCase();
  if(['RATE_LIMITED','CAPACITY_BUSY','ORIGIN_NOT_ALLOWED','METHOD_NOT_ALLOWED'].includes(error))return false;
  return payload?.recoverable===true||code>=500||/PROVIDER|RUNTIME|COGNITIVE|QUALITY|DEADLINE|MODEL/.test(error);
}
function sensitiveRequest(body={}){
  if(body.sensitive===true||body.sensitive_data===true||body.contains_sensitive_data===true)return true;
  const sensitivity=String(body.sensitivity||body.data_sensitivity||body.classification||'').toUpperCase();
  if(/PRIVATE|CONFIDENTIAL|SECRET|RESTRICTED|SENSITIVE|PII|PHI/.test(sensitivity))return true;
  if(Array.isArray(body.attachments)&&body.attachments.length>0&&String(process.env.WAE_GPU_ALLOW_ATTACHMENTS||'0')!=='1')return true;
  return false;
}
function requiresGroundedData(body={}){
  if(String(process.env.WAE_GPU_ALLOW_UNGROUNDED_RESEARCH||'0')==='1')return false;
  const mode=String(body.mode||body.agent||'general').toLowerCase();
  const q=String(body.message||body.task||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return body.web_enabled===true||mode==='research'||/\b(hoy|today|actual|currently|current|latest|reciente|noticias|news|precio|cotizacion|ley vigente|jurisprudencia reciente)\b/.test(q);
}
function explicitGpu(body={}){return String(body.provider||'').toLowerCase()==='gpu_fabric'}
function gpuRecoveryAllowed(body={}){
  if(!gpuFabricConfigured()||sensitiveRequest(body)||requiresGroundedData(body))return false;
  if(body.disable_gpu_fabric===true)return false;
  return true;
}
function gpuBlockReason(body={}){
  if(!gpuFabricConfigured())return'not_configured';
  if(sensitiveRequest(body))return'sensitive_or_attachment';
  if(requiresGroundedData(body))return'grounded_research_required';
  if(body.disable_gpu_fabric===true)return'disabled_for_request';
  return null;
}
function gpuSystem(body={}){
  const mode=String(body.mode||body.agent||'general').toLowerCase();
  return `Eres Universal Core, núcleo de inteligencia de WAE OS Enterprise. Estás operando en el carril de resiliencia GPU ${GPU_FABRIC_VERSION}. Responde únicamente a la solicitud del usuario. No menciones infraestructura interna, proveedores ni fallos previos salvo que el usuario lo pregunte. No inventes fuentes, acciones ejecutadas ni datos actuales. Modo: ${mode}. Usa Markdown claro cuando ayude y no expongas razonamiento interno.`;
}
function gpuHistory(body={}){return Array.isArray(body.history)?body.history.slice(-10):[]}

function safeGpuPayload(result,body,previous={}){
  const raw=String(result?.text||'').trim();
  const safe=isSafeAssistantOutput(raw),text=safe?raw:publicContextFallback(),degraded=!safe;
  let payload={
    success:true,reply:text,speech_text:text,components:[],actions:[],web_sources:[],
    provider:'gpu_fabric',model:result?.model||GPU_FABRIC_VERSION,degraded,
    gpu_fabric:{version:GPU_FABRIC_VERSION,lane:result?.gpuLane||null,latency_ms:result?.latencyMs??null,previous_path_degraded:previous.degraded===true,previous_status:previous.code??null},
    response:{schema:'assistant-response/v1',content:text,speechText:text,components:[],actions:[],sources:[],metadata:{provider:'gpu_fabric',model:result?.model||GPU_FABRIC_VERSION,degraded,gpuFabric:GPU_FABRIC_VERSION,gpuLane:result?.gpuLane||null,gpuLatencyMs:result?.latencyMs??null,contextOutputFirewall:CONTEXT_OUTPUT_FIREWALL_VERSION}}
  };
  payload=modernizePayload(payload,body);
  payload=applyAnswerIntelligence(payload);
  payload=applyQualityReliability(payload,{prompt:body.message||body.task||''});
  return payload;
}

async function recoverWithGpu(body,previous){
  const result=await generateWithGpuFabric({system:gpuSystem(body),message:String(body.message||body.task||''),history:gpuHistory(body)});
  return safeGpuPayload(result,body,previous);
}

export default async function capacityChatV76(req,res){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const fabric=gpuFabricSnapshot();
  res.setHeader('X-WAE-GPU-Fabric',GPU_FABRIC_VERSION);
  res.setHeader('X-WAE-GPU-Lanes',String(fabric.configuredLanes));

  if(explicitGpu(body)){
    applyHeaders(res);
    if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
    if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
    if(!allowRequest(req,Number(process.env.WAE_GPU_RATE_LIMIT_PER_MINUTE||12)))return res.status(429).json({error:'gpu_rate_limited'});
    if(!gpuRecoveryAllowed(body))return res.status(503).json({error:'GPU_FABRIC_UNAVAILABLE',message:'GPU Fabric está bloqueado o no configurado para este turno.',recoverable:true,gpu_fabric:{version:GPU_FABRIC_VERSION,configured:fabric.configured,configured_lanes:fabric.configuredLanes,reason:gpuBlockReason(body)}});
    try{
      const payload=await recoverWithGpu(body,{code:null,degraded:false});
      res.setHeader('X-WAE-Cognitive-Path',GPU_FABRIC_VERSION);
      res.setHeader('X-WAE-Response-Style',MODERN_RESPONSE_VERSION);
      res.setHeader('X-WAE-Answer-Intelligence',ANSWER_INTELLIGENCE_VERSION);
      res.setHeader('X-WAE-Quality-Reliability',QUALITY_RELIABILITY_VERSION);
      res.setHeader('X-WAE-Context-Output-Firewall',CONTEXT_OUTPUT_FIREWALL_VERSION);
      return res.status(200).json(payload);
    }catch(error){
      return res.status(503).json({error:error?.code||'GPU_FABRIC_EXHAUSTED',message:'La malla GPU no pudo completar este turno.',recoverable:true,failures:error?.failures||undefined,gpu_fabric:{version:GPU_FABRIC_VERSION,configured_lanes:fabric.configuredLanes}});
    }
  }

  const buffered=bufferedResponse(res);
  await capacityChatV63(req,buffered.proxy);
  if(res.writableEnded||!buffered.hasJson)return;
  const payload=buffered.payload;
  const weak=buffered.code<400&&degradedPayload(payload);
  const failed=recoverableFailure(buffered.code,payload);

  if((weak||failed)&&gpuRecoveryAllowed(body)){
    try{
      const recovered=await recoverWithGpu(body,{code:buffered.code,degraded:weak});
      res.setHeader('X-WAE-GPU-Recovery','1');
      res.setHeader('X-WAE-Cognitive-Path',GPU_FABRIC_VERSION);
      res.setHeader('X-WAE-Response-Style',MODERN_RESPONSE_VERSION);
      res.setHeader('X-WAE-Answer-Intelligence',ANSWER_INTELLIGENCE_VERSION);
      res.setHeader('X-WAE-Quality-Reliability',QUALITY_RELIABILITY_VERSION);
      res.setHeader('X-WAE-Context-Output-Firewall',CONTEXT_OUTPUT_FIREWALL_VERSION);
      return res.status(200).json(recovered);
    }catch(error){
      if(payload&&typeof payload==='object')payload.gpu_fabric={version:GPU_FABRIC_VERSION,recovery_attempted:true,recovery_succeeded:false,failures:error?.failures||[{error:String(error?.message||error).slice(0,220)}]};
    }
  }

  if(payload&&typeof payload==='object')payload.gpu_fabric={...(payload.gpu_fabric||{}),version:GPU_FABRIC_VERSION,configured:fabric.configured,configured_lanes:fabric.configuredLanes,recovery_eligible:gpuRecoveryAllowed(body),recovery_block_reason:gpuBlockReason(body),recovery_attempted:false};
  return res.status(buffered.code).json(payload);
}
