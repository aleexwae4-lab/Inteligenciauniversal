export const AGENT_EXECUTION_FABRIC_VERSION='agent-execution-fabric/v1';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(n))?Number(n):min));
const CACHE_TTL_MS=60_000;
const CACHE_MAX=32;
const cache=new Map();
function cacheKey(tools=[],actionGateway=null){return JSON.stringify({tools:(tools||[]).map(t=>[t.id||'',t.enabled===true,t.configured===true,t.sideEffect||'none',t.riskLevel||'unknown',t.timeoutMs||0,t.maxInputChars||0]),gateway:actionGateway?.verification?.status||'not_executed'});}
export function buildAgentExecutionFabric({tools=[],actionGateway=null}={}){
 const key=cacheKey(tools,actionGateway),now=Date.now(),hit=cache.get(key);
 if(hit&&hit.expiresAt>now)return hit.value;
 const list=(tools||[]).map(t=>({id:String(t.id||''),capabilities:t.capabilities||[],actions:t.actions||[],riskLevel:t.riskLevel||'unknown',sideEffect:t.sideEffect||'none',approval:t.approval||'none',configured:t.configured===true,enabled:t.enabled===true,timeoutMs:clamp(t.timeoutMs||0,0,120000),maxInputChars:clamp(t.maxInputChars||0,0,500000)}));
 const value={version:AGENT_EXECUTION_FABRIC_VERSION,policy:{defaultDeny:true,failClosed:true,humanApprovalRequiredForSideEffects:true,receiptRequiredForExternalWrites:true,maxRetries:1,rollback:'only_when_tool_contract_supports_it'},agents:list.map(t=>({agentId:`agent:${t.id}`,tool:t.id,status:t.enabled?'ready':'unavailable',execution:{timeoutMs:t.timeoutMs,maxInputChars:t.maxInputChars,retries:t.enabled?1:0},safety:{risk:t.riskLevel,sideEffect:t.sideEffect,approval:t.approval}})),gatewayState:actionGateway?.verification?.status||'not_executed'};
 cache.set(key,{value,expiresAt:now+CACHE_TTL_MS});
 if(cache.size>CACHE_MAX){const oldest=cache.keys().next().value;if(oldest!==undefined)cache.delete(oldest);}
 return value;}
export function agentExecutionInstruction(fabric){if(!fabric)return'';return`\n\nAGENT EXECUTION FABRIC (${fabric.version}):\n${JSON.stringify(fabric).slice(0,10000)}\nReglas: usa solo agentes/herramientas declarados como ready; respeta timeout, límites y aprobación. Para efectos externos exige autorización y recibo verificable. Un plan no equivale a ejecución.`;}
export function publicAgentExecutionContract(){return{version:AGENT_EXECUTION_FABRIC_VERSION,ready:['contract_bound_agents','timeouts','retry_budget','approval_boundary','receipt_requirement'],defaultPolicy:'fail_closed'};}
