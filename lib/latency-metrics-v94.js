export const LATENCY_METRICS_V94='latency-metrics/v94';
const MAX_SAMPLES=Math.max(64,Math.min(4096,Number(process.env.WAE_LATENCY_SAMPLE_LIMIT||1024)));
const samples=[];

const cleanRoute=value=>String(value||'unknown').replace(/[^a-zA-Z0-9_.:-]/g,'_').slice(0,120)||'unknown';
const finite=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):null;
const round=value=>Number(Number(value||0).toFixed(2));

function percentile(sorted,p){
  if(!sorted.length)return null;
  const rank=Math.min(sorted.length-1,Math.max(0,Math.ceil((p/100)*sorted.length)-1));
  return round(sorted[rank]);
}

function summarize(rows=[]){
  const durations=rows.map(row=>finite(row.durationMs)).filter(value=>value!==null).sort((a,b)=>a-b);
  const successes=rows.filter(row=>row.success===true).length;
  return{
    count:rows.length,
    success_count:successes,
    error_count:rows.length-successes,
    success_rate:rows.length?round(successes*100/rows.length):null,
    p50_ms:percentile(durations,50),
    p95_ms:percentile(durations,95),
    p99_ms:percentile(durations,99),
    max_ms:durations.length?round(durations[durations.length-1]):null,
  };
}

export function recordLatencyV94({route='unknown',durationMs,statusCode=200,success}={}){
  const duration=finite(durationMs);
  if(duration===null)return false;
  const status=Math.max(0,Number(statusCode)||0);
  samples.push({route:cleanRoute(route),durationMs:duration,statusCode:status,success:typeof success==='boolean'?success:(status>=200&&status<500),at:Date.now()});
  if(samples.length>MAX_SAMPLES)samples.splice(0,samples.length-MAX_SAMPLES);
  return true;
}

export function latencySnapshotV94({windowMs=60*60*1000,now=Date.now()}={}){
  const cutoff=now-Math.max(60_000,Number(windowMs)||60*60*1000);
  const recent=samples.filter(row=>row.at>=cutoff);
  const routes={};
  for(const route of [...new Set(recent.map(row=>row.route))])routes[route]=summarize(recent.filter(row=>row.route===route));
  return{
    version:LATENCY_METRICS_V94,
    privacy:{prompt_content_stored:false,user_identifiers_stored:false,request_bodies_stored:false},
    sample_limit:MAX_SAMPLES,
    window_ms:Math.max(60_000,Number(windowMs)||60*60*1000),
    aggregate:summarize(recent),
    routes,
  };
}

export function __resetLatencyMetricsV94(){samples.length=0;}
