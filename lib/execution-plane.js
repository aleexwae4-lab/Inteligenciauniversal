import { createHash, randomUUID } from 'node:crypto';
import { executeGithubSearch, executeWebSearch } from './tools.js';
import { recallMemory } from './memory.js';

export const EXECUTION_PLANE_VERSION='universal-execution-plane/v37';
export const EXECUTION_RECEIPT_SCHEMA='universal-execution-receipt/v1';

const MAX_TASK=30000;
const MAX_RESULT_TEXT=50000;
const EDGE_TIMEOUT_MS=35000;

const text=(value,max=MAX_TASK)=>String(value??'').trim().slice(0,max);
const sha256=(value)=>createHash('sha256').update(typeof value==='string'?value:stableJson(value)).digest('hex');
const stableJson=(value)=>JSON.stringify(sortValue(value));
function sortValue(value){
  if(Array.isArray(value))return value.map(sortValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,sortValue(value[key])]));
  return value;
}

function supabaseConfigured(){return Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)}
function webConfigured(){return Boolean(process.env.TAVILY_API_KEY)}
function githubConfigured(){return Boolean(process.env.GITHUB_TOKEN)}

export const EXECUTION_ADAPTERS=Object.freeze([
  {id:'web_search_read',capabilities:['web_search','deep_research'],actions:['search'],riskLevel:'low',sideEffect:'read',approvalRequired:false,configured:webConfigured},
  {id:'github_code_search_read',capabilities:['software_engineering'],actions:['search_code'],riskLevel:'low',sideEffect:'read',approvalRequired:false,configured:githubConfigured},
  {id:'memory_recall_read',capabilities:['memory'],actions:['recall'],riskLevel:'low',sideEffect:'read',approvalRequired:false,configured:supabaseConfigured},
  {id:'certified_intent_ir_compute',capabilities:['work_mode','multiagent_engineering'],actions:['execute_intent'],riskLevel:'low',sideEffect:'none',approvalRequired:false,configured:supabaseConfigured},
]);

export function executionPlaneSnapshot(){
  const adapters=EXECUTION_ADAPTERS.map((adapter)=>({
    id:adapter.id,
    capabilities:adapter.capabilities,
    actions:adapter.actions,
    riskLevel:adapter.riskLevel,
    sideEffect:adapter.sideEffect,
    approvalRequired:adapter.approvalRequired,
    configured:adapter.configured(),
    runtimeState:adapter.configured()?'configured_unverified':'unconfigured',
  }));
  return{
    version:EXECUTION_PLANE_VERSION,
    receiptSchema:EXECUTION_RECEIPT_SCHEMA,
    policy:{failClosed:true,mutationsEnabled:false,humanApprovalForWrites:true,rawSecretsInReceipts:false},
    adapterCount:adapters.length,
    configuredAdapterCount:adapters.filter((adapter)=>adapter.configured).length,
    adapters,
  };
}

export function resolveExecutionAdapter(capability,action){
  const cap=text(capability,100).toLowerCase();
  const requested=text(action,100).toLowerCase();
  const defaults={web_search:'search',deep_research:'search',software_engineering:'search_code',memory:'recall',work_mode:'execute_intent',multiagent_engineering:'execute_intent'};
  const resolvedAction=requested||defaults[cap]||'';
  const adapter=EXECUTION_ADAPTERS.find((item)=>item.capabilities.includes(cap)&&item.actions.includes(resolvedAction));
  return adapter?{adapter,action:resolvedAction}:null;
}

function publicReceipt(receipt){
  const {user_key_hash,session_key_hash,...safe}=receipt;
  return safe;
}

export function createExecutionReceipt({capability,domainId,adapter,action,status,riskLevel,sideEffect,approvalRequired=false,approved=false,request,response,errorCode,latencyMs,userKey,sessionId,metadata={}}){
  const now=new Date().toISOString();
  const receipt={
    schema:EXECUTION_RECEIPT_SCHEMA,
    id:randomUUID(),
    created_at:now,
    finished_at:status==='started'?null:now,
    capability_id:text(capability,120),
    domain_id:text(domainId||capability,120)||null,
    adapter:text(adapter,160),
    action:text(action,120),
    status,
    risk_level:riskLevel,
    side_effect:sideEffect,
    approval_required:Boolean(approvalRequired),
    approved:Boolean(approved),
    request_hash:sha256(request??{}),
    response_hash:response===undefined||response===null?null:sha256(response),
    user_key_hash:userKey?sha256(`wae:v37:user:${text(userKey,500)}`):null,
    session_key_hash:sessionId?sha256(`wae:v37:session:${text(sessionId,500)}`):null,
    latency_ms:Number.isFinite(Number(latencyMs))?Math.max(0,Math.round(Number(latencyMs))):null,
    error_code:errorCode?text(errorCode,160):null,
    metadata:metadata&&typeof metadata==='object'?metadata:{},
  };
  return receipt;
}

async function persistExecutionReceipt(receipt){
  if(!supabaseConfigured())return{persisted:false,reason:'ledger_unconfigured'};
  const base=String(process.env.SUPABASE_URL).replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const row={...receipt};delete row.schema;
  try{
    const response=await fetch(`${base}/rest/v1/universal_execution_receipts_v37`,{
      method:'POST',
      headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'},
      body:JSON.stringify(row),
      signal:AbortSignal.timeout(10000),
    });
    return response.ok?{persisted:true}:{persisted:false,reason:`ledger_http_${response.status}`};
  }catch(error){return{persisted:false,reason:text(error?.message||'ledger_transport_failure',180)}}
}

async function runCertifiedIntent(task){
  if(!supabaseConfigured())throw Object.assign(new Error('certified_intent_runtime_unconfigured'),{code:'runtime_unconfigured'});
  const base=String(process.env.SUPABASE_URL).replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response=await fetch(`${base}/functions/v1/wae-tools-engine-v3`,{
    method:'POST',
    headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({intent_text:text(task),execution_mode:'structured_exact'}),
    signal:AbortSignal.timeout(EDGE_TIMEOUT_MS),
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(text(payload?.error||payload?.message||`intent_http_${response.status}`,500)),{code:`intent_http_${response.status}`});
  const content=text(payload?.choices?.[0]?.message?.content??payload?.content??payload?.answer??'',MAX_RESULT_TEXT);
  const unified=payload?.wae_unified&&typeof payload.wae_unified==='object'?payload.wae_unified:{};
  return{
    content,
    attestation:{
      capabilityRegistryVerified:Boolean(unified.capability_registry_verified),
      deterministic:Boolean(unified.zero_provider_execution||unified.zero_token_execution),
      graphHash:text(unified.graph_hash||'',160)||null,
      plannerDecision:text(unified.planner_decision||'',160)||null,
      receiptCount:Array.isArray(unified.capability_graph_receipts)?unified.capability_graph_receipts.length:0,
    },
  };
}

const DEFAULT_EXECUTORS={
  web_search_read:async({task})=>({sources:await executeWebSearch(task)}),
  github_code_search_read:async({task})=>({matches:await executeGithubSearch(task,task)}),
  memory_recall_read:async({task,userKey})=>({items:await recallMemory(userKey,task,6)}),
  certified_intent_ir_compute:async({task})=>runCertifiedIntent(task),
};

export async function probeExecutionPlane(){
  const snapshot=executionPlaneSnapshot();
  const probes=[];
  for(const adapter of snapshot.adapters){
    if(!adapter.configured){probes.push({...adapter,reachable:false,reason:'unconfigured'});continue}
    if(adapter.id!=='certified_intent_ir_compute'){probes.push({...adapter,reachable:true,reason:'local_configuration'});continue}
    try{
      const base=String(process.env.SUPABASE_URL).replace(/\/$/,'');
      const response=await fetch(`${base}/functions/v1/wae-tools-engine-v3`,{method:'GET',signal:AbortSignal.timeout(8000)});
      probes.push({...adapter,reachable:response.ok,reason:response.ok?'edge_probe_ok':`edge_http_${response.status}`});
    }catch(error){probes.push({...adapter,reachable:false,reason:text(error?.message||'edge_probe_failure',180)})}
  }
  return{...snapshot,probedAt:new Date().toISOString(),adapters:probes,reachableAdapterCount:probes.filter((item)=>item.reachable).length};
}

export async function executeCapability({capability,action,task,message,userKey,sessionId,approved=false,executors=DEFAULT_EXECUTORS,persistReceipt=persistExecutionReceipt}={}){
  const normalizedTask=text(task||message);
  const resolution=resolveExecutionAdapter(capability,action);
  const started=Date.now();
  const requestDescriptor={capability:text(capability,120),action:text(action,120),task:normalizedTask};

  if(!normalizedTask){
    const receipt=createExecutionReceipt({capability,adapter:'none',action:action||'none',status:'blocked',riskLevel:'low',sideEffect:'none',request:requestDescriptor,errorCode:'task_required',latencyMs:0,userKey,sessionId});
    const audit=await persistReceipt(receipt);
    return{success:false,status:'blocked',error:'task_required',receipt:publicReceipt(receipt),audit};
  }

  if(!resolution){
    const receipt=createExecutionReceipt({capability,adapter:'none',action:action||'unsupported',status:'blocked',riskLevel:'high',sideEffect:'none',request:requestDescriptor,errorCode:'capability_not_executable',latencyMs:Date.now()-started,userKey,sessionId,metadata:{failClosed:true}});
    const audit=await persistReceipt(receipt);
    return{success:false,status:'blocked',error:'capability_not_executable',receipt:publicReceipt(receipt),audit};
  }

  const {adapter,action:resolvedAction}=resolution;
  const requiresApproval=adapter.approvalRequired||['write','external_write'].includes(adapter.sideEffect)||['high','critical'].includes(adapter.riskLevel);
  if(requiresApproval&&!approved){
    const receipt=createExecutionReceipt({capability,adapter:adapter.id,action:resolvedAction,status:'blocked',riskLevel:adapter.riskLevel,sideEffect:adapter.sideEffect,approvalRequired:true,approved:false,request:requestDescriptor,errorCode:'approval_required',latencyMs:Date.now()-started,userKey,sessionId});
    const audit=await persistReceipt(receipt);
    return{success:false,status:'blocked',error:'approval_required',receipt:publicReceipt(receipt),audit};
  }

  if(!adapter.configured()){
    const receipt=createExecutionReceipt({capability,adapter:adapter.id,action:resolvedAction,status:'blocked',riskLevel:adapter.riskLevel,sideEffect:adapter.sideEffect,approvalRequired:requiresApproval,approved:Boolean(approved),request:requestDescriptor,errorCode:'runtime_unconfigured',latencyMs:Date.now()-started,userKey,sessionId});
    const audit=await persistReceipt(receipt);
    return{success:false,status:'blocked',error:'runtime_unconfigured',receipt:publicReceipt(receipt),audit};
  }

  const executor=executors[adapter.id];
  if(typeof executor!=='function'){
    const receipt=createExecutionReceipt({capability,adapter:adapter.id,action:resolvedAction,status:'blocked',riskLevel:adapter.riskLevel,sideEffect:adapter.sideEffect,request:requestDescriptor,errorCode:'executor_missing',latencyMs:Date.now()-started,userKey,sessionId});
    const audit=await persistReceipt(receipt);
    return{success:false,status:'blocked',error:'executor_missing',receipt:publicReceipt(receipt),audit};
  }

  try{
    const result=await executor({task:normalizedTask,userKey,sessionId,capability:text(capability,120),action:resolvedAction});
    const receipt=createExecutionReceipt({capability,adapter:adapter.id,action:resolvedAction,status:'completed',riskLevel:adapter.riskLevel,sideEffect:adapter.sideEffect,approvalRequired:requiresApproval,approved:Boolean(approved),request:requestDescriptor,response:result,latencyMs:Date.now()-started,userKey,sessionId,metadata:{plane:EXECUTION_PLANE_VERSION}});
    const audit=await persistReceipt(receipt);
    return{success:true,status:'completed',result,receipt:publicReceipt(receipt),audit};
  }catch(error){
    const errorCode=text(error?.code||'execution_failed',160);
    const receipt=createExecutionReceipt({capability,adapter:adapter.id,action:resolvedAction,status:'failed',riskLevel:adapter.riskLevel,sideEffect:adapter.sideEffect,approvalRequired:requiresApproval,approved:Boolean(approved),request:requestDescriptor,errorCode,latencyMs:Date.now()-started,userKey,sessionId,metadata:{plane:EXECUTION_PLANE_VERSION}});
    const audit=await persistReceipt(receipt);
    return{success:false,status:'failed',error:errorCode,message:text(error?.message||errorCode,500),receipt:publicReceipt(receipt),audit};
  }
}
