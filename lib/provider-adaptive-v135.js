export const ADAPTIVE_ROUTER_VERSION='adaptive-router/v135';

const FIRST_PARTY=new Set(['wae_edge','wae_supabase']);
const state=new Map();
const MAX_SAMPLES=48;

function row(id){
  if(!state.has(id))state.set(id,{
    attempts:0,successes:0,failures:0,qualityRejects:0,
    latencySamples:[],ttftSamples:[],lastSelectedAt:null,lastSuccessAt:null,lastFailureAt:null,lastFailure:null
  });
  return state.get(id);
}
function pushSample(list,value){
  const n=Number(value);
  if(!Number.isFinite(n)||n<0)return;
  list.push(Math.round(n));
  if(list.length>MAX_SAMPLES)list.splice(0,list.length-MAX_SAMPLES);
}
function percentile(values,p){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  const idx=Math.min(sorted.length-1,Math.max(0,Math.ceil((p/100)*sorted.length)-1));
  return sorted[idx];
}
function routeClass(provider){return FIRST_PARTY.has(provider.id)?'wae':'external'}
function classRank(provider){return routeClass(provider)==='wae'?0:1}

export function adaptiveAttempt(id){
  const item=row(id);item.attempts++;item.lastSelectedAt=Date.now();
}
export function adaptiveSuccess(id,{latencyMs=null,ttftMs=null}={}){
  const item=row(id);item.successes++;item.lastSuccessAt=Date.now();item.lastFailure=null;
  pushSample(item.latencySamples,latencyMs);pushSample(item.ttftSamples,ttftMs);
}
export function adaptiveFailure(id,code,{latencyMs=null,ttftMs=null}={}){
  const item=row(id);item.failures++;item.lastFailureAt=Date.now();item.lastFailure=String(code||'provider_error').slice(0,80);
  pushSample(item.latencySamples,latencyMs);pushSample(item.ttftSamples,ttftMs);
}
export function adaptiveQualityReject(id,code,{latencyMs=null,ttftMs=null}={}){
  const item=row(id);item.qualityRejects++;item.lastFailure=String(code||'quality_rejected').slice(0,80);
  pushSample(item.latencySamples,latencyMs);pushSample(item.ttftSamples,ttftMs);
}

export function providerAdaptiveScore(provider){
  const item=row(provider.id);
  if(item.attempts===0)return 1000;
  const successRate=item.successes/Math.max(1,item.attempts);
  const failureRate=item.failures/Math.max(1,item.attempts);
  const rejectRate=item.qualityRejects/Math.max(1,item.attempts);
  const p50Latency=percentile(item.latencySamples,50)??0;
  const p50Ttft=percentile(item.ttftSamples,50)??0;
  return Math.round(
    1000
    +successRate*220
    -failureRate*320
    -rejectRate*180
    -Math.min(220,p50Latency/120)
    -Math.min(140,p50Ttft/45)
  );
}

export function adaptiveOrder(providers=[]){
  return providers.map((provider,index)=>({provider,index,rank:classRank(provider),score:providerAdaptiveScore(provider)}))
    .sort((a,b)=>a.rank-b.rank||b.score-a.score||a.index-b.index)
    .map(x=>x.provider);
}

export function adaptiveSnapshot(providers=[]){
  return providers.map(provider=>{
    const item=row(provider.id);
    const attempts=item.attempts;
    return {
      id:provider.id,
      routeClass:routeClass(provider),
      configured:!!provider.configured,
      score:providerAdaptiveScore(provider),
      attempts,
      successes:item.successes,
      failures:item.failures,
      qualityRejects:item.qualityRejects,
      successRate:attempts?Number((item.successes/attempts).toFixed(3)):null,
      latencyP50Ms:percentile(item.latencySamples,50),
      latencyP95Ms:percentile(item.latencySamples,95),
      ttftP50Ms:percentile(item.ttftSamples,50),
      ttftP95Ms:percentile(item.ttftSamples,95),
      lastSelectedAt:item.lastSelectedAt,
      lastSuccessAt:item.lastSuccessAt,
      lastFailureAt:item.lastFailureAt,
      lastFailure:item.lastFailure
    };
  });
}

export function adaptiveContract(){
  return {
    version:ADAPTIVE_ROUTER_VERSION,
    strategy:'cost-class-then-health',
    preservesFirstPartyPriority:true,
    metrics:['successRate','failureRate','qualityRejectRate','latencyP50','latencyP95','ttftP50','ttftP95']
  };
}
