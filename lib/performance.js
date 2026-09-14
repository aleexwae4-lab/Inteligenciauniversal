const DEFAULT_GATE = Object.freeze({
  schema:'universal-performance-gate/v2',available:false,routing_state:'HOLD',candidate_promotable:false,stream_ready:false,fast_lane_ready:false,
  control:{ok:0,errors:0,error_rate:null,p50_ms:0,p95_ms:0,avg_ms:0,avg_ttft_ms:0},candidate:{ok:0,errors:0,error_rate:null,p50_ms:0,p95_ms:0,avg_ms:0,avg_ttft_ms:0},
  policy:{candidate_p95_improvement_required_pct:5,stream_ttft_ceiling_ms:2500,fast_lane_latency_ceiling_ms:3000}
});
const DEFAULT_COGNITIVE = Object.freeze({
  schema:'universal-cognitive-scorecard/v1',available:false,state:'HOLD',blockers:['unavailable'],
  runtime:{requests:0,ok:0,degraded:0,errors:0,success_rate_pct:0,error_rate_pct:0,p50_ms:0,p95_ms:0,web_used_rate_pct:0,avg_memory_count:0},
  evals:{window_days:7,total:0,passed:0,availability_rate_pct:0,avg_passed_score:0},feedback:{window_days:7,total:0,positive_rate_pct:null},policy:{}
});
const DEFAULT_RELIABILITY = Object.freeze({
  schema:'universal-reliability-plane/v2',available:false,window_minutes:30,
  runtime:{requests:0,ok:0,errors:0,success_pct:0,p50_ms:0,p95_ms:0},
  models:{open:0,closed:0,healthy:0,half_open:0},best_route:null,last_reconciliation_event:null
});

const PUBLIC_SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
const PUBLIC_SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const bool=value=>value===true;
const metricSet=raw=>({ok:Math.max(0,Math.trunc(finite(raw?.ok))),errors:Math.max(0,Math.trunc(finite(raw?.errors))),error_rate:Number.isFinite(Number(raw?.error_rate))?Number(raw.error_rate):null,p50_ms:Math.max(0,Math.round(finite(raw?.p50_ms))),p95_ms:Math.max(0,Math.round(finite(raw?.p95_ms))),avg_ms:Math.max(0,Math.round(finite(raw?.avg_ms))),avg_ttft_ms:Math.max(0,Math.round(finite(raw?.avg_ttft_ms)))});
function connection(){return{base:String(process.env.SUPABASE_URL||PUBLIC_SUPABASE_URL).replace(/\/$/,''),key:String(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||PUBLIC_SUPABASE_KEY)}}

export function normalizePerformanceGate(input={}){
  const raw=Array.isArray(input)?(input[0]||{}):(input||{}),policy=raw.policy&&typeof raw.policy==='object'?raw.policy:{};
  return{schema:String(raw.schema||DEFAULT_GATE.schema),available:true,generated_at:raw.generated_at||null,window_hours:Math.max(1,Math.trunc(finite(raw.window_hours,6))),min_ok_samples:Math.max(1,Math.trunc(finite(raw.min_ok_samples,20))),routing_state:['PROMOTE','HOLD','INSUFFICIENT_DATA'].includes(String(raw.routing_state))?String(raw.routing_state):'HOLD',candidate_promotable:bool(raw.candidate_promotable),stream_ready:bool(raw.stream_ready),stream_ready_count:Math.max(0,Math.trunc(finite(raw.stream_ready_count))),best_stream_ttft_ms:Math.max(0,Math.round(finite(raw.best_stream_ttft_ms))),fast_lane_ready:bool(raw.fast_lane_ready),fast_lane_ready_count:Math.max(0,Math.trunc(finite(raw.fast_lane_ready_count))),control:metricSet(raw.control),candidate:metricSet(raw.candidate),policy:{candidate_error_rate_lte_control:policy.candidate_error_rate_lte_control!==false,candidate_p95_improvement_required_pct:finite(policy.candidate_p95_improvement_required_pct,5),stream_ttft_ceiling_ms:finite(policy.stream_ttft_ceiling_ms,2500),fast_lane_latency_ceiling_ms:finite(policy.fast_lane_latency_ceiling_ms,3000)}};
}
export function normalizeCognitiveScorecard(input={}){
  const raw=Array.isArray(input)?(input[0]||{}):(input||{}),runtime=raw.runtime||{},evals=raw.evals||{},feedback=raw.feedback||{};
  return{schema:String(raw.schema||DEFAULT_COGNITIVE.schema),available:true,generated_at:raw.generated_at||null,window_hours:Math.max(1,Math.trunc(finite(raw.window_hours,24))),state:['PASS','HOLD','INSUFFICIENT_DATA'].includes(String(raw.state))?String(raw.state):'HOLD',blockers:Array.isArray(raw.blockers)?raw.blockers.map(String).slice(0,20):[],runtime:{requests:Math.max(0,Math.trunc(finite(runtime.requests))),ok:Math.max(0,Math.trunc(finite(runtime.ok))),degraded:Math.max(0,Math.trunc(finite(runtime.degraded))),errors:Math.max(0,Math.trunc(finite(runtime.errors))),success_rate_pct:finite(runtime.success_rate_pct),error_rate_pct:finite(runtime.error_rate_pct),p50_ms:Math.max(0,Math.round(finite(runtime.p50_ms))),p95_ms:Math.max(0,Math.round(finite(runtime.p95_ms))),web_used_rate_pct:finite(runtime.web_used_rate_pct),avg_memory_count:finite(runtime.avg_memory_count)},evals:{window_days:Math.max(1,Math.trunc(finite(evals.window_days,7))),total:Math.max(0,Math.trunc(finite(evals.total))),passed:Math.max(0,Math.trunc(finite(evals.passed))),availability_rate_pct:finite(evals.availability_rate_pct),avg_passed_score:finite(evals.avg_passed_score)},feedback:{window_days:Math.max(1,Math.trunc(finite(feedback.window_days,7))),total:Math.max(0,Math.trunc(finite(feedback.total))),positive_rate_pct:Number.isFinite(Number(feedback.positive_rate_pct))?Number(feedback.positive_rate_pct):null},policy:raw.policy&&typeof raw.policy==='object'?raw.policy:{}};
}
export function normalizeReliabilityPlane(input={}){
  const raw=Array.isArray(input)?(input[0]||{}):(input||{}),runtime=raw.runtime||{},models=raw.models||{};
  return{schema:String(raw.schema||DEFAULT_RELIABILITY.schema),available:true,generated_at:raw.generated_at||null,window_minutes:Math.max(5,Math.trunc(finite(raw.window_minutes,30))),runtime:{requests:Math.max(0,Math.trunc(finite(runtime.requests))),ok:Math.max(0,Math.trunc(finite(runtime.ok))),errors:Math.max(0,Math.trunc(finite(runtime.errors))),success_pct:finite(runtime.success_pct),p50_ms:Math.max(0,Math.round(finite(runtime.p50_ms))),p95_ms:Math.max(0,Math.round(finite(runtime.p95_ms)))},models:{open:Math.max(0,Math.trunc(finite(models.open))),closed:Math.max(0,Math.trunc(finite(models.closed))),healthy:Math.max(0,Math.trunc(finite(models.healthy))),half_open:Math.max(0,Math.trunc(finite(models.half_open)))},best_route:raw.best_route&&typeof raw.best_route==='object'?raw.best_route:null,last_reconciliation_event:raw.last_reconciliation_event&&typeof raw.last_reconciliation_event==='object'?raw.last_reconciliation_event:null};
}
export function defaultPerformanceGate(reason='unavailable'){return{...DEFAULT_GATE,reason:String(reason||'unavailable')}}
export function defaultCognitiveScorecard(reason='unavailable'){return{...DEFAULT_COGNITIVE,blockers:[String(reason||'unavailable')],reason:String(reason||'unavailable')}}
export function defaultReliabilityPlane(reason='unavailable'){return{...DEFAULT_RELIABILITY,reason:String(reason||'unavailable')}}

async function postRpc(name,body,timeoutMs=6000){
  const{base,key}=connection();if(!base||!key)throw Object.assign(new Error('supabase_not_configured'),{code:'supabase_not_configured'});
  const response=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw Object.assign(new Error(`supabase_${response.status}`),{code:`supabase_${response.status}`});
  return response.json();
}
export async function fetchPerformanceGate({windowHours=6,minOk=20}={}){try{return normalizePerformanceGate(await postRpc('iu_performance_gate_v2',{p_window_hours:Math.max(1,Math.min(168,Number(windowHours)||6)),p_min_ok:Math.max(5,Math.min(1000,Number(minOk)||20))}))}catch(error){return defaultPerformanceGate(error?.name==='TimeoutError'?'timeout':error?.code||'request_failed')}}
export async function fetchCognitiveScorecard({windowHours=24}={}){try{return normalizeCognitiveScorecard(await postRpc('iu_cognitive_scorecard_v1',{p_window_hours:Math.max(1,Math.min(168,Number(windowHours)||24))}))}catch(error){return defaultCognitiveScorecard(error?.name==='TimeoutError'?'timeout':error?.code||'request_failed')}}
export async function fetchReliabilityPlane({windowMinutes=30}={}){try{return normalizeReliabilityPlane(await postRpc('iu_reliability_snapshot_v2',{p_window_minutes:Math.max(5,Math.min(180,Number(windowMinutes)||30))}))}catch(error){return defaultReliabilityPlane(error?.name==='TimeoutError'?'timeout':error?.code||'request_failed')}}
