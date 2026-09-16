import { providerRegistry } from './providers.js';
import { loadPersistentRouterSnapshot } from './scale-control-v63.js';

export const PROVIDER_HEALTH_VERSION='provider-health/v81';
export const PROVIDER_RECOVERY_PROBE_AFTER_MS=5*60*1000;
export const PROVIDER_RECENT_SUCCESS_GRACE_MS=10*60*1000;

const normalize=value=>String(value||'').trim().toLowerCase();
const SUPABASE_DEPENDENT=new Set(['wae_edge','wae_supabase']);

function runtimeRow(rows=[],provider={}){
  const id=normalize(provider.id),model=normalize(provider.model);
  return rows.find(row=>normalize(row?.provider)===id&&normalize(row?.model)===model)
    ||rows.find(row=>normalize(row?.provider)===id)
    ||null;
}

export function classifyOperationalProvider(provider,row=null,now=Date.now()){
  const configured=provider?.configured===true;
  if(!configured)return{id:provider?.id||'',model:provider?.model||null,configured:false,state:'unconfigured',eligible:false,healthy:false,score:-1000};
  if(!row)return{id:provider.id,model:provider.model||null,configured:true,state:'unknown',eligible:true,healthy:false,score:200,reason:'no_persistent_observation'};

  const attempts=Math.max(0,Number(row.attempts||0));
  const successes=Math.max(0,Number(row.successes||0));
  const failures=Math.max(0,Number(row.failures||0));
  const consecutiveFailures=Math.max(0,Number(row.consecutiveFailures??row.consecutive_failures??0));
  const until=Date.parse(String(row.circuitUntil??row.circuit_until??''));
  const circuitOpen=Number.isFinite(until)&&until>now;
  const successRate=attempts>0?successes/attempts:null;
  const lastErrorClass=String(row.lastErrorClass??row.last_error_class??'').toLowerCase()||null;
  const lastFailureMs=Date.parse(String(row.lastFailureAt??row.last_failure_at??''));
  const failureAgeMs=Number.isFinite(lastFailureMs)?Math.max(0,now-lastFailureMs):null;
  const lastSuccessMs=Date.parse(String(row.lastSuccessAt??row.last_success_at??''));
  const successAgeMs=Number.isFinite(lastSuccessMs)?Math.max(0,now-lastSuccessMs):null;
  const recentSuccess=successAgeMs!==null&&successAgeMs<=PROVIDER_RECENT_SUCCESS_GRACE_MS&&consecutiveFailures===0;
  const staleFailureDebt=!circuitOpen&&failureAgeMs!==null&&failureAgeMs>=PROVIDER_RECOVERY_PROBE_AFTER_MS&&(consecutiveFailures>=3||(attempts>=10&&successRate!==null&&successRate<0.20));

  let state='unknown',eligible=true,healthy=false,reason='insufficient_observations';
  if(circuitOpen){state='unhealthy';eligible=false;reason='persistent_circuit_open'}
  else if(recentSuccess&&attempts>=3&&successRate!==null&&successRate<0.50){state='degraded';eligible=true;reason='recent_success_recovery'}
  else if(staleFailureDebt){state='degraded';eligible=true;reason='half_open_recovery_probe'}
  else if(consecutiveFailures>=3){state='unhealthy';eligible=false;reason='failure_debt'}
  else if(attempts>=10&&successRate!==null&&successRate<0.20){state='unhealthy';eligible=false;reason='low_recent_reliability'}
  else if(attempts>=3&&successRate!==null&&successRate>=0.50&&consecutiveFailures===0){state='healthy';healthy=true;reason='persistent_success'}
  else if(consecutiveFailures>0){state='degraded';reason='recent_failure'}

  const base=state==='healthy'?320:state==='unknown'?220:state==='degraded'?140:20;
  const reliability=successRate===null?0.5:successRate;
  const recoveryBoost=reason==='recent_success_recovery'?35:0;
  const score=base+Math.round(reliability*40)-Math.min(60,consecutiveFailures*12)+recoveryBoost;
  return{id:provider.id,model:provider.model||null,configured:true,state,eligible,healthy,score,reason,attempts,successes,failures,consecutiveFailures,successRate:successRate===null?null:Number(successRate.toFixed(4)),circuitOpen,circuitUntil:circuitOpen?new Date(until).toISOString():null,lastErrorClass,failureAgeMs,successAgeMs,recentSuccess,recoveryProbe:reason==='half_open_recovery_probe'||reason==='recent_success_recovery'};
}

export function rankOperationalProviders({registry=providerRegistry(),runtime=[],now=Date.now()}={}){
  const configured=(Array.isArray(registry)?registry:[]).filter(item=>item?.configured===true&&item?.id);
  const rows=configured.map((provider,index)=>({...classifyOperationalProvider(provider,runtimeRow(runtime,provider),now),registryIndex:index}));
  return rows.sort((a,b)=>{
    if(a.eligible!==b.eligible)return a.eligible?-1:1;
    if(a.healthy!==b.healthy)return a.healthy?-1:1;
    if(b.score!==a.score)return b.score-a.score;
    return a.registryIndex-b.registryIndex;
  });
}

export function directFallbackProvider(providers=[]){
  return (Array.isArray(providers)?providers:[]).find(row=>row?.eligible===true&&!SUPABASE_DEPENDENT.has(normalize(row.id)))?.id||null;
}

export async function operationalProviderSnapshot({force=false,registry=providerRegistry(),now=Date.now()}={}){
  let persistent={ok:false,runtime:[],error:'snapshot_unavailable'};
  try{persistent=await loadPersistentRouterSnapshot({capability:'general_reasoning',force})}catch(error){persistent={ok:false,runtime:[],error:String(error?.message||error).slice(0,160)}}
  const providers=rankOperationalProviders({registry,runtime:Array.isArray(persistent?.runtime)?persistent.runtime:[],now});
  const configuredProviderCount=providers.length;
  const healthyProviderCount=providers.filter(row=>row.healthy).length;
  const eligibleProviderCount=providers.filter(row=>row.eligible).length;
  const preferredProvider=providers.find(row=>row.eligible)?.id||null;
  const directFallback=directFallbackProvider(providers);
  return{
    version:PROVIDER_HEALTH_VERSION,
    persistentAvailable:persistent?.ok===true,
    configuredProviderCount,
    healthyProviderCount,
    eligibleProviderCount,
    generativeConfigured:configuredProviderCount>0,
    generativeHealthyNow:healthyProviderCount>0,
    generativeEligibleNow:eligibleProviderCount>0,
    preferredProvider,
    directFallbackProvider:directFallback,
    providers:providers.map(({registryIndex,...row})=>row)
  };
}

export async function chooseOperationalProvider({requestedProvider='auto',force=false}={}){
  const requested=String(requestedProvider||'auto').toLowerCase();
  if(requested!=='auto')return{provider:requested,overridden:false,snapshot:null,reason:'explicit_provider'};
  const snapshot=await operationalProviderSnapshot({force});
  if(!snapshot.persistentAvailable){
    if(snapshot.directFallbackProvider)return{provider:snapshot.directFallbackProvider,overridden:true,snapshot,reason:'control_plane_unavailable_direct_fallback'};
    return{provider:'auto',overridden:false,snapshot,reason:'control_plane_unavailable_no_direct_fallback'};
  }
  const edge=snapshot.providers.find(row=>row.id==='wae_edge');
  const preferred=snapshot.preferredProvider;
  if(edge?.eligible!==false||!preferred||preferred==='wae_edge')return{provider:'auto',overridden:false,snapshot,reason:edge?.recoveryProbe?'edge_half_open_recovery_probe':'edge_operational'};
  return{provider:preferred,overridden:true,snapshot,reason:'persistent_edge_unhealthy'};
}
