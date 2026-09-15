import capacityChatV62 from './capacity-chat-v62.js';
import { getClientIp } from '../lib/security.js';
import {
  distributedAdmission,
  releaseDistributedAdmission,
  persistProviderObservation,
  SCALE_CONTROL_VERSION,
  SCALE_TARGET_SUBSCRIBERS
} from '../lib/scale-control-v63.js';
import {
  hydratePersistentProviderReputation,
  drainPersistentObservations,
  PERFORMANCE_ROUTER_VERSION
} from '../lib/provider-mesh-v63.js';

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

function capabilityFor(body={}){
  const mode=String(body.mode||body.agent||'general').toLowerCase();
  const q=String(body.message||body.task||'').toLowerCase();
  if(/legal|jur[ií]dic|contrato|ley|demanda|fiscal[ií]a/.test(`${mode} ${q}`))return'legal_reasoning';
  if(/financ|ebitda|flujo de caja|presupuesto|contab/.test(`${mode} ${q}`))return'finance';
  if(/ventas|sales|prospect|crm|pipeline comercial/.test(`${mode} ${q}`))return'sales';
  if(/strategy|estrateg|executive|ceo|direcci[oó]n/.test(`${mode} ${q}`))return'strategy';
  if(/code|software|arquitect|program|javascript|typescript|api|backend|frontend/.test(`${mode} ${q}`))return'technology';
  return'general_reasoning';
}

function routeFromPayload(payload={}){
  const mesh=payload?.provider_mesh||payload?.response?.metadata?.providerMesh||{};
  return{selectedProvider:mesh?.selected_provider||mesh?.selectedProvider||'',selectedModel:mesh?.selected_model||mesh?.selectedModel||''};
}

function qualityFromPayload(payload={}){
  const q=payload?.quality_reliability||payload?.response?.metadata?.qualityReliability||{};
  const d=q?.dimensions||{};
  return{quality:q?.score,evidence:d?.evidence,instruction:d?.instruction,qualityGrade:q?.grade,costMicrounits:payload?.cost_microunits??payload?.response?.metadata?.costMicrounits};
}

async function flushPersistentObservations(payload){
  const batch=drainPersistentObservations(12);
  if(!batch.length)return;
  if(payload&&typeof payload==='object'){
    const route=routeFromPayload(payload),quality=qualityFromPayload(payload);
    const target=batch.find(item=>item.success===true&&item.provider===route.selectedProvider);
    if(target)Object.assign(target,quality);
  }
  await Promise.allSettled(batch.map(item=>persistProviderObservation(item)));
}

export default async function capacityChatV63(req,res){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const principal=body.userKey||body.user_id||body.userId||body.sessionId||body.session_id||getClientIp(req);
  const session=body.sessionId||body.session_id||body.conversationId||body.conversation_id||principal;
  const tenant=body.organizationId||body.organization_id||body.tenantId||body.tenant_id||'';
  let admission=null;
  let responded=false;
  let responsePayload=null;
  try{
    await hydratePersistentProviderReputation({capability:capabilityFor(body)}).catch(()=>null);
    admission=await distributedAdmission({principal,session,tenant,body});
    res.setHeader('X-WAE-Scale-Control',SCALE_CONTROL_VERSION);
    res.setHeader('X-WAE-Subscriber-Target',String(SCALE_TARGET_SUBSCRIBERS));
    res.setHeader('X-WAE-Performance-Router',PERFORMANCE_ROUTER_VERSION);
    res.setHeader('X-WAE-Distributed-Admission',admission?.applied?String(admission?.allowed?'admitted':'rejected'):'bypassed');

    if(admission?.allowed===false){
      const rateLimited=admission.reason==='distributed_rate_limit';
      const retry=Math.max(1,Number(admission.retryAfterSeconds||1));
      res.setHeader('Retry-After',String(retry));
      responded=true;
      return res.status(rateLimited?429:503).json({
        error:rateLimited?'RATE_LIMITED':'CAPACITY_BUSY',
        message:rateLimited?'Universal Core aplicó el límite distribuido de este suscriptor para proteger la calidad del servicio.':'Universal Core está absorbiendo una ráfaga distribuida de concurrencia. El turno fue rechazado de forma controlada y puede reintentarse.',
        recoverable:true,
        retry_after_ms:retry*1000,
        scale_control:SCALE_CONTROL_VERSION
      });
    }

    const buffered=bufferedResponse(res);
    await capacityChatV62(req,buffered.proxy);
    if(res.writableEnded||!buffered.hasJson)return;
    responsePayload=buffered.payload;
    responded=true;
    return res.status(buffered.code).json(responsePayload);
  }finally{
    if(admission?.leaseId)await releaseDistributedAdmission(admission).catch(()=>null);
    await flushPersistentObservations(responsePayload).catch(()=>null);
    if(!responded&&!res.writableEnded&&res.headersSent===false)res.setHeader('X-WAE-Scale-Control',SCALE_CONTROL_VERSION);
  }
}
