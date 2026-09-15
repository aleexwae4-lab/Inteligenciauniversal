import { createHash, randomUUID } from 'node:crypto';
import { executeGithubSearch, executeWebSearch } from './tools.js';
import { recallMemory } from './memory.js';
import { getToolDefinition, inspectText, profileCsv, resolveTool, toolFabricSnapshot, validateToolInput, TOOL_FABRIC_VERSION } from './tool-fabric.js';

export const EXECUTION_PLANE_VERSION='universal-execution-plane/v38-tool-fabric';
export const EXECUTION_RECEIPT_SCHEMA='universal-execution-receipt/v1';

const MAX_TASK=30000;
const MAX_RESULT_TEXT=50000;
const EDGE_TIMEOUT_MS=35000;
const MUTATIONS_ENABLED=false;

const text=(value,max=MAX_TASK)=>String(value??'').trim().slice(0,max);
const sha256=(value)=>createHash('sha256').update(typeof value==='string'?value:stableJson(value)).digest('hex');
const stableJson=(value)=>JSON.stringify(sortValue(value));
function sortValue(value){
  if(Array.isArray(value))return value.map(sortValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,sortValue(value[key])]));
  return value;
}

function supabaseConfigured(){return Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)}

const TOOL_ADAPTER_IDS=Object.freeze({
  'web.search':'web_search_read',
  'github.code_search':'github_code_search_read',
  'memory.recall':'memory_recall_read',
  'intent.execute_ir':'certified_intent_ir_compute',
  'text.inspect':'text_inspect_compute',
  'data.csv_profile':'csv_profile_compute',
});

function adapterFromTool(tool){
  const id=TOOL_ADAPTER_IDS[tool?.id];
  if(!id||tool?.provider==='disabled')return null;
  return{
    id,
    toolId:tool.id,
    capabilities:[...tool.capabilities],
    actions:[...tool.actions],
    riskLevel:tool.riskLevel,
    sideEffect:tool.sideEffect,
    approvalRequired:tool.approval!=='none',
    configured:()=>Boolean(getToolDefinition(tool.id)?.configured),
    contractHash:tool.contractHash,
    timeoutMs:tool.timeoutMs,
  };
}

export function executionPlaneSnapshot(){
  const fabric=toolFabricSnapshot();
  const adapters=fabric.tools.map(adapterFromTool).filter(Boolean).map((adapter)=>({
    id:adapter.id,
    toolId:adapter.toolId,
    capabilities:adapter.capabilities,
    actions:adapter.actions,
    riskLevel:adapter.riskLevel,
    sideEffect:adapter.sideEffect,
    approvalRequired:adapter.approvalRequired,
    configured:adapter.configured(),
    contractHash:adapter.contractHash,
    runtimeState:adapter.configured()?'configured_unverified':'unconfigured',
  }));
  return{
    version:EXECUTION_PLANE_VERSION,
    receiptSchema:EXECUTION_RECEIPT_SCHEMA,
    toolFabric:TOOL_FABRIC_VERSION,
    policy:{failClosed:true,mutationsEnabled:MUTATIONS_ENABLED,humanApprovalForWrites:true,clientApprovalTrusted:false,rawSecretsInReceipts:false,toolOutputIsUntrusted:true},
    adapterCount:adapters.length,
    configuredAdapterCount:adapters.filter((adapter)=>adapter.configured).length,
    adapters,
  };
}

export function resolveExecutionAdapter(capability,action){
  const cap=text(capability,100).toLowerCase();
  const requested=text(action,100).toLowerCase();
  const tool=resolveTool(cap,requested);
  const adapter=adapterFromTool(tool);
  if(!adapter)return null;
  const resolvedAction=requested||tool.actions[0]||'';
  return{adapter,action:resolvedAction,tool};
}

function publicReceipt(receipt){
  const {user_key_hash,session_key_hash,...safe}=receipt;
  return safe;
}

export function createExecutionReceipt({capability,domainId,adapter,action,status,riskLevel,sideEffect,approvalRequired=false,approved=false,request,response,errorCode,latencyMs,userKey,sessionId,metadata={}}){
  const now=new Date().toISOString();
  return{
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
    user_key_hash:userKey?sha256(`wae:v38:user:${text(userKey,500)}`):null,
    session_key_hash:sessionId?sha256(`wae:v38:session:${text(sessionId,500)}`):null,
    latency_ms:Number.isFinite(Number(latencyMs))?Math.max(0,Math.round(Number(latencyMs))):null,
    error_code:errorCode?text(errorCode,160):null,
    metadata:metadata&&typeof metadata==='object'?metadata:{},
  };
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

function buildToolInput(toolId,task,input={}){
  const supplied=input&&typeof input==='object'?input:{};
  if(toolId==='web.search')return{query:text(supplied.query||task,12000)};
  if(toolId==='github.code_search')return{query:text(supplied.query||task,12000),...(supplied.repository?{repository:text(supplied.repository,240)}:{})};
  if(toolId==='memory.recall')return{query:text(supplied.query||task,12000),limit:Number.isInteger(supplied.limit)?supplied.limit:6};
  if(toolId==='intent.execute_ir')return{task:text(supplied.task||task,30000)};
  if(toolId==='text.inspect')return{content:String(supplied.content??task??'').slice(0,120000),name:text(supplied.name||'document.txt',240)};
  if(toolId==='data.csv_profile')return{content:String(supplied.content??task??'').slice(0,200000),delimiter:String(supplied.delimiter||',').slice(0,1)||','};
  return{supplied};
}

const DEFAULT_EXECUTORS={
  web_search_read:async({input})=>({sources:await executeWebSearch(input.query)}),
  github_code_search_read:async({input})=>{
    const query=input.repository?`${input.query} repo:${input.repository}`:input.query;
    return{matches:await executeGithubSearch(query,query)};
  },
  memory_recall_read:async({input,userKey})=>({items:await recallMemory(userKey,input.query,input.limit||6)}),
  certified_intent_ir_compute:async({input})=>runCertifiedIntent(input.task),
  text_inspect_compute:async({input})=>inspectText(input),
  csv_profile_compute:async({input})=>profileCsv(input),
};

export async function probeExecutionPlane(){
  const snapshot=executionPlaneSnapshot();
  const probes=[];
  for(const adapter of snapshot.adapters){
    if(!adapter.configured){probes.push({...adapter,reachable:false,reason:'unconfigured'});continue}
    if(['text_inspect_compute','csv_profile_compute'].includes(adapter.id)){probes.push({...adapter,reachable:true,reason:'local_primitive'});continue}
    if(adapter.id!=='certified_intent_ir_compute'){probes.push({...adapter,reachable:true,reason:'local_configuration'});continue}
    try{
      const base=String(process.env.SUPABASE_URL).replace(/\/$/,'');
      const response=await fetch(`${base}/functions/v1/wae-tools-engine-v3`,{method:'GET',signal:AbortSignal.timeout(8000)});
      probes.push({...adapter,reachable:response.ok,reason:response.ok?'edge_probe_ok':`edge_http_${response.status}`});
    }catch(error){probes.push({...adapter,reachable:false,reason:text(error?.message||'edge_probe_failure',180)})}
  }
  return{...snapshot,probedAt:new Date().toISOString(),adapters:probes,reachableAdapterCount:probes.filter((item)=>item.reachable).length};
}

async function blockExecution({capability,adapter='none',action='unsupported',riskLevel='high',sideEffect='none',approvalRequired=false,approved=false,requestDescriptor,errorCode,started,userKey,sessionId,persistReceipt,metadata={}}){
  const receipt=createExecutionReceipt({capability,adapter,action,status:'blocked',riskLevel,sideEffect,approvalRequired,approved,request:requestDescriptor,errorCode,latencyMs:Date.now()-started,userKey,sessionId,metadata});
  const audit=await persistReceipt(receipt);
  return{success:false,status:'blocked',error:errorCode,receipt:publicReceipt(receipt),audit};
}

export async function executeCapability({capability,action,task,message,input={},userKey,sessionId,approved=false,executors=DEFAULT_EXECUTORS,persistReceipt=persistExecutionReceipt}={}){
  const normalizedTask=text(task||message);
  const resolution=resolveExecutionAdapter(capability,action);
  const started=Date.now();
  const inputHash=sha256(input&&typeof input==='object'?input:{});
  const requestDescriptor={capability:text(capability,120),action:text(action,120),task:normalizedTask,inputHash};

  if(!resolution)return blockExecution({capability,requestDescriptor,errorCode:'capability_not_executable',started,userKey,sessionId,persistReceipt,metadata:{failClosed:true,toolFabric:TOOL_FABRIC_VERSION}});

  const {adapter,action:resolvedAction,tool}=resolution;
  const toolInput=buildToolInput(tool.id,normalizedTask,input);
  const validation=validateToolInput(tool.id,toolInput);
  if(!validation.ok){
    const errorCode=validation.error==='tool_input_required'&&validation.field==='query'?'task_required':validation.error;
    return blockExecution({capability,adapter:adapter.id,action:resolvedAction,riskLevel:adapter.riskLevel,sideEffect:adapter.sideEffect,requestDescriptor,errorCode,started,userKey,sessionId,persistReceipt,metadata:{toolId:tool.id,contractHash:tool.contractHash,field:validation.field||null}});
  }

  const mutative=['write','external_write'].includes(adapter.sideEffect);
  const requiresApproval=adapter.approvalRequired||mutative||['high','critical'].includes(adapter.riskLevel);

  if(mutative&&!MUTATIONS_ENABLED){
    return blockExecution({capability,adapter:adapter.id,action:resolvedAction,riskLevel:adapter.riskLevel,sideEffect:adapter.sideEffect,approvalRequired:true,approved:false,requestDescriptor,errorCode:'mutations_disabled',started,userKey,sessionId,persistReceipt,metadata:{failClosed:true,toolId:tool.id,contractHash:tool.contractHash}});
  }
  if(requiresApproval&&!approved){
    return blockExecution({capability,adapter:adapter.id,action:resolvedAction,riskLevel:adapter.riskLevel,sideEffect:adapter.sideEffect,approvalRequired:true,approved:false,requestDescriptor,errorCode:'approval_required',started,userKey,sessionId,persistReceipt,metadata:{toolId:tool.id,contractHash:tool.contractHash}});
  }
  if(!adapter.configured()){
    return blockExecution({capability,adapter:adapter.id,action:resolvedAction,riskLevel:adapter.riskLevel,sideEffect:adapter.sideEffect,approvalRequired:requiresApproval,approved:Boolean(approved),requestDescriptor,errorCode:'runtime_unconfigured',started,userKey,sessionId,persistReceipt,metadata:{toolId:tool.id,contractHash:tool.contractHash}});
  }

  const executor=executors[adapter.id];
  if(typeof executor!=='function')return blockExecution({capability,adapter:adapter.id,action:resolvedAction,riskLevel:adapter.riskLevel,sideEffect:adapter.sideEffect,requestDescriptor,errorCode:'executor_missing',started,userKey,sessionId,persistReceipt,metadata:{toolId:tool.id,contractHash:tool.contractHash}});

  try{
    const result=await executor({task:normalizedTask,input:toolInput,userKey,sessionId,capability:text(capability,120),action:resolvedAction,tool});
    const receipt=createExecutionReceipt({capability,adapter:adapter.id,action:resolvedAction,status:'completed',riskLevel:adapter.riskLevel,sideEffect:adapter.sideEffect,approvalRequired:requiresApproval,approved:Boolean(approved),request:requestDescriptor,response:result,latencyMs:Date.now()-started,userKey,sessionId,metadata:{plane:EXECUTION_PLANE_VERSION,toolFabric:TOOL_FABRIC_VERSION,toolId:tool.id,contractHash:tool.contractHash}});
    const audit=await persistReceipt(receipt);
    return{success:true,status:'completed',tool:{id:tool.id,contractHash:tool.contractHash},result,receipt:publicReceipt(receipt),audit};
  }catch(error){
    const errorCode=text(error?.code||'execution_failed',160);
    const receipt=createExecutionReceipt({capability,adapter:adapter.id,action:resolvedAction,status:'failed',riskLevel:adapter.riskLevel,sideEffect:adapter.sideEffect,approvalRequired:requiresApproval,approved:Boolean(approved),request:requestDescriptor,errorCode,latencyMs:Date.now()-started,userKey,sessionId,metadata:{plane:EXECUTION_PLANE_VERSION,toolFabric:TOOL_FABRIC_VERSION,toolId:tool.id,contractHash:tool.contractHash}});
    const audit=await persistReceipt(receipt);
    return{success:false,status:'failed',error:errorCode,message:text(error?.message||errorCode,500),receipt:publicReceipt(receipt),audit};
  }
}
