import capacityChatV87 from './capacity-chat-v87.js';
import {
  ENTERPRISE_INTELLIGENCE_FABRIC_VERSION,
  planEnterpriseIntelligence
} from '../lib/enterprise-intelligence-fabric-v90.js';

export const CAPACITY_CHAT_V90='capacity-chat/v90-enterprise-intelligence';

const DEEP_OPERATIONS=new Set(['reconstruct_public_system','integrate','automate','optimize','compare']);

function bufferedResponse(real){
  let code=200,payload,hasJson=false;
  const proxy=new Proxy(real,{
    get(target,prop){
      if(prop==='status')return status=>{code=Number(status)||500;return proxy};
      if(prop==='json')return body=>{payload=body;hasJson=true;return proxy};
      if(prop==='statusCode')return code;
      if(prop==='writableEnded')return false;
      if(prop==='headersSent')return false;
      const value=target[prop];
      return typeof value==='function'?value.bind(target):value;
    },
    set(target,prop,value){
      if(prop==='statusCode'){code=Number(value)||code;return true}
      target[prop]=value;return true;
    }
  });
  return{proxy,get code(){return code},get payload(){return payload},get hasJson(){return hasJson}};
}

export function applyEnterpriseContext(body={},plan=planEnterpriseIntelligence(body?.message||body?.task||body?.prompt||'',{webEnabled:body?.web_enabled!==false})){
  const next={...(body&&typeof body==='object'?body:{})};
  if(!plan.active)return next;
  next.enterprise_intelligence=true;
  next.enterprise_targets=[...plan.targets];
  next.enterprise_operations=[...plan.operations];
  next.enterprise_evidence_policy=plan.evidencePolicy;
  next.enterprise_access_policy=plan.accessPolicy;
  next.web_enabled=body?.web_enabled===false?false:true;
  if(next.web_enabled)next.explicit_research=true;
  if(plan.operations.some((operation)=>DEEP_OPERATIONS.has(operation))){
    next.deep=true;
    if(body?.multiagent!==false)next.multiagent=true;
    if(body?.orchestrate!==false)next.orchestrate=true;
  }
  return next;
}

function decorate(payload={},plan={}){
  if(!payload||typeof payload!=='object')return payload;
  const enterprise={
    version:plan.version||ENTERPRISE_INTELLIGENCE_FABRIC_VERSION,
    active:plan.active===true,
    targets:Array.isArray(plan.targets)?plan.targets:[],
    operations:Array.isArray(plan.operations)?plan.operations:[],
    route:plan.route||'standard',
    require_live_evidence:plan.requireLiveEvidence===true,
    evidence_policy:plan.evidencePolicy||'official-first-cross-check-verify-before-accept',
    access_policy:plan.accessPolicy||'public_or_explicitly_authorized_only',
    denied_private_access:plan.deniedPrivateAccess===true,
    integrations:plan.integrations&&typeof plan.integrations==='object'?plan.integrations:{},
  };
  const response=payload.response&&typeof payload.response==='object'?payload.response:{};
  return{
    ...payload,
    enterprise_intelligence:enterprise,
    response:{
      ...response,
      metadata:{...(response.metadata||{}),enterpriseIntelligence:enterprise}
    }
  };
}

function setEnterpriseHeaders(res,plan={}){
  res.setHeader('X-WAE-Enterprise-Intelligence',ENTERPRISE_INTELLIGENCE_FABRIC_VERSION);
  res.setHeader('X-WAE-Enterprise-Targets',(plan.targets||[]).join(',').slice(0,220));
  res.setHeader('X-WAE-Enterprise-Evidence',plan.active?'official-first':'inactive');
  res.setHeader('X-WAE-Enterprise-Private-Access',plan.deniedPrivateAccess?'denied':'not-requested');
}

export default async function capacityChatV90(req,res){
  const original=req.body&&typeof req.body==='object'?req.body:{};
  const message=String(original.message||original.task||original.prompt||'').trim();
  const plan=planEnterpriseIntelligence(message,{webEnabled:original.web_enabled!==false});
  if(!plan.active)return capacityChatV87(req,res);

  const planned=applyEnterpriseContext(original,plan);
  const buffered=bufferedResponse(res);
  req.body=planned;
  try{
    await capacityChatV87(req,buffered.proxy);
  }finally{
    req.body=original;
  }
  if(res.writableEnded||!buffered.hasJson)return;
  setEnterpriseHeaders(res,plan);
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V90);
  return res.status(buffered.code).json(decorate(buffered.payload,plan));
}
