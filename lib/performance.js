const DEFAULT_GATE = Object.freeze({
  schema:'universal-performance-gate/v2',
  available:false,
  routing_state:'HOLD',
  candidate_promotable:false,
  stream_ready:false,
  fast_lane_ready:false,
  control:{ok:0,errors:0,error_rate:null,p50_ms:0,p95_ms:0,avg_ms:0,avg_ttft_ms:0},
  candidate:{ok:0,errors:0,error_rate:null,p50_ms:0,p95_ms:0,avg_ms:0,avg_ttft_ms:0},
  policy:{candidate_p95_improvement_required_pct:5,stream_ttft_ceiling_ms:2500,fast_lane_latency_ceiling_ms:3000}
});

const finite = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const bool = value => value === true;
const metricSet = raw => ({
  ok:Math.max(0, Math.trunc(finite(raw?.ok))),
  errors:Math.max(0, Math.trunc(finite(raw?.errors))),
  error_rate:Number.isFinite(Number(raw?.error_rate)) ? Number(raw.error_rate) : null,
  p50_ms:Math.max(0, Math.round(finite(raw?.p50_ms))),
  p95_ms:Math.max(0, Math.round(finite(raw?.p95_ms))),
  avg_ms:Math.max(0, Math.round(finite(raw?.avg_ms))),
  avg_ttft_ms:Math.max(0, Math.round(finite(raw?.avg_ttft_ms)))
});

export function normalizePerformanceGate(input={}) {
  const raw = Array.isArray(input) ? (input[0] || {}) : (input || {});
  const policy = raw.policy && typeof raw.policy === 'object' ? raw.policy : {};
  return {
    schema:String(raw.schema || DEFAULT_GATE.schema),
    available:true,
    generated_at:raw.generated_at || null,
    window_hours:Math.max(1, Math.trunc(finite(raw.window_hours,6))),
    min_ok_samples:Math.max(1, Math.trunc(finite(raw.min_ok_samples,20))),
    routing_state:['PROMOTE','HOLD','INSUFFICIENT_DATA'].includes(String(raw.routing_state)) ? String(raw.routing_state) : 'HOLD',
    candidate_promotable:bool(raw.candidate_promotable),
    stream_ready:bool(raw.stream_ready),
    stream_ready_count:Math.max(0, Math.trunc(finite(raw.stream_ready_count))),
    best_stream_ttft_ms:Math.max(0, Math.round(finite(raw.best_stream_ttft_ms))),
    fast_lane_ready:bool(raw.fast_lane_ready),
    fast_lane_ready_count:Math.max(0, Math.trunc(finite(raw.fast_lane_ready_count))),
    control:metricSet(raw.control),
    candidate:metricSet(raw.candidate),
    policy:{
      candidate_error_rate_lte_control:policy.candidate_error_rate_lte_control !== false,
      candidate_p95_improvement_required_pct:finite(policy.candidate_p95_improvement_required_pct,5),
      stream_ttft_ceiling_ms:finite(policy.stream_ttft_ceiling_ms,2500),
      fast_lane_latency_ceiling_ms:finite(policy.fast_lane_latency_ceiling_ms,3000)
    }
  };
}

export function defaultPerformanceGate(reason='unavailable') {
  return {...DEFAULT_GATE, reason:String(reason || 'unavailable')};
}

export async function fetchPerformanceGate({windowHours=6,minOk=20}={}) {
  const base=String(process.env.SUPABASE_URL || '').replace(/\/$/,'');
  const key=String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if(!base || !key) return defaultPerformanceGate('supabase_not_configured');
  try {
    const response=await fetch(`${base}/rest/v1/rpc/iu_performance_gate_v2`,{
      method:'POST',
      headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({p_window_hours:Math.max(1,Math.min(168,Number(windowHours)||6)),p_min_ok:Math.max(5,Math.min(1000,Number(minOk)||20))}),
      signal:AbortSignal.timeout(6000)
    });
    if(!response.ok) return defaultPerformanceGate(`supabase_${response.status}`);
    return normalizePerformanceGate(await response.json());
  } catch (error) {
    return defaultPerformanceGate(error?.name === 'TimeoutError' ? 'timeout' : 'request_failed');
  }
}
