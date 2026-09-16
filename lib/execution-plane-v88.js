import {
  executeCapability as executeBaseCapability,
  executionPlaneSnapshot as baseExecutionPlaneSnapshot,
  probeExecutionPlane as probeBaseExecutionPlane,
  createExecutionReceipt,
} from './execution-plane.js';
import { executeOpenSourceTool } from './open-source-capability-mesh-v88.js';
import { getToolDefinition, resolveTool, toolFabricSnapshot, TOOL_FABRIC_V88_VERSION } from './tool-fabric-v88.js';

export const EXECUTION_PLANE_V88_VERSION='universal-execution-plane/v88-open-source-zero-cost';
const text=(value,max=30000)=>String(value??'').trim().slice(0,max);
const isOss=(tool)=>String(tool?.id||'').startsWith('oss.');

function ossAdapter(tool){
  return{
    id:`oss_${String(tool.project||'tool').replace(/[^a-z0-9]+/gi,'_')}_${String(tool.actions?.[0]||'execute')}`.toLowerCase(),
    toolId:tool.id,
    capabilities:[...(tool.capabilities||[])],
    actions:[...(tool.actions||[])],
    riskLevel:tool.riskLevel,
    sideEffect:tool.sideEffect,
    approvalRequired:tool.approval!=='none',
    configured:Boolean(tool.configured),
    contractHash:null,
    runtimeState:tool.configured?'configured_unverified':'unconfigured',
    zeroLicenseCost:true,
    apiFeeRequired:false,
    license:tool.license||null,
    repository:tool.repository||null,
  };
}

export function executionPlaneSnapshot(){
  const base=baseExecutionPlaneSnapshot();
  const fabric=toolFabricSnapshot();
  const ossAdapters=(fabric.openSource?.tools||[]).map(ossAdapter);
  const adapters=[...(base.adapters||[]),...ossAdapters];
  return{
    ...base,
    version:EXECUTION_PLANE_V88_VERSION,
    baseVersion:base.version,
    toolFabric:TOOL_FABRIC_V88_VERSION,
    policy:{...(base.policy||{}),zeroCostOpenSourcePreferred:true,ossMutationsDisabled:true,mcpReadAllowlistRequired:true},
    adapterCount:adapters.length,
    configuredAdapterCount:adapters.filter(adapter=>adapter.configured).length,
    adapters,
    openSource:fabric.openSource,
  };
}

export async function probeExecutionPlane(){
  const [base,fabric]=await Promise.all([probeBaseExecutionPlane(),Promise.resolve(toolFabricSnapshot())]);
  const ossAdapters=(fabric.openSource?.tools||[]).map(tool=>({
    ...ossAdapter(tool),
    reachable:false,
    reason:tool.configured?'configured_not_probed':'unconfigured',
  }));
  const adapters=[...(base.adapters||[]),...ossAdapters];
  return{
    ...base,
    version:EXECUTION_PLANE_V88_VERSION,
    toolFabric:TOOL_FABRIC_V88_VERSION,
    adapters,
    adapterCount:adapters.length,
    configuredAdapterCount:adapters.filter(adapter=>adapter.configured).length,
    reachableAdapterCount:adapters.filter(adapter=>adapter.reachable).length,
    openSource:fabric.openSource,
  };
}

function buildOssInput(toolId,task,input={}){
  const supplied=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  if(toolId==='oss.searxng.search')return{...supplied,query:text(supplied.query||task,12000)};
  if(toolId==='oss.ollama.chat'||toolId==='oss.llamacpp.chat')return{...supplied,prompt:text(supplied.prompt||task,30000)};
  if(toolId==='oss.ollama.embed')return{...supplied,input:supplied.input??task};
  if(toolId==='oss.meilisearch.search')return{...supplied,query:text(supplied.query||task,12000)};
  if(toolId==='oss.qdrant.query')return supplied;
  if(toolId==='oss.mcp.discover')return supplied;
  if(toolId==='oss.mcp.call_read')return supplied;
  return supplied;
}

function publicReceipt(receipt={}){
  const {user_key_hash,session_key_hash,...safe}=receipt;
  return safe;
}

async function persistOssReceipt(receipt={}){
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return{persisted:false,reason:'ledger_unconfigured'};
  const base=String(process.env.SUPABASE_URL).replace(/\/$/,'');
  const key=String(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const row={...receipt};delete row.schema;
  try{
    const response=await fetch(`${base}/rest/v1/universal_execution_receipts_v37`,{
      method:'POST',
      headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'},
      body:JSON.stringify(row),
      signal:AbortSignal.timeout(7000),
    });
    return response.ok?{persisted:true,mode:'service_role'}:{persisted:false,reason:`ledger_http_${response.status}`};
  }catch(error){return{persisted:false,reason:text(error?.message||'ledger_transport_failure',180)}}
}

async function executeOssCapability({tool,capability,action,task,input,userKey,sessionId,fetchImpl}){
  const started=Date.now();
  const toolInput=buildOssInput(tool.id,task,input);
  const result=await executeOpenSourceTool(tool.id,toolInput,{fetchImpl});
  const status=result.success?'completed':result.status==='blocked'?'blocked':'failed';
  const receipt=createExecutionReceipt({
    capability:capability||tool.capabilities?.[0]||tool.id,
    domainId:capability||tool.capabilities?.[0]||tool.id,
    adapter:`oss:${tool.project}`,
    action:action||tool.actions?.[0]||'execute',
    status,
    riskLevel:tool.riskLevel,
    sideEffect:tool.sideEffect,
    approvalRequired:tool.approval!=='none',
    approved:false,
    request:{toolId:tool.id,input:toolInput},
    response:result.success?result.result:null,
    errorCode:result.success?null:result.error,
    latencyMs:Date.now()-started,
    userKey,
    sessionId,
    metadata:{toolId:tool.id,repository:tool.repository,license:tool.license,zeroLicenseCost:true,apiFeeRequired:false,mesh:'v88'},
  });
  const audit=await persistOssReceipt(receipt);
  return{
    success:result.success,
    status,
    ...(result.success?{result:result.result}:{error:result.error}),
    tool,
    latency_ms:Date.now()-started,
    receipt:publicReceipt(receipt),
    audit,
    executionPlane:EXECUTION_PLANE_V88_VERSION,
  };
}

export async function executeCapability(args={}){
  const capability=text(args.capability,120).toLowerCase();
  const action=text(args.action,120).toLowerCase();
  const task=text(args.task||args.message,30000);
  const explicitToolId=text(args.toolId,180).toLowerCase();
  const explicit=explicitToolId?getToolDefinition(explicitToolId):null;
  const resolved=explicit||resolveTool(capability,action);
  if(resolved&&isOss(resolved)){
    return executeOssCapability({tool:resolved,capability,action,task,input:args.input,userKey:args.userKey,sessionId:args.sessionId,fetchImpl:args.fetchImpl});
  }
  return executeBaseCapability(args);
}
