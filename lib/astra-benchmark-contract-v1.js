import { createHash } from 'node:crypto';

export const ASTRA_BENCHMARK_CONTRACT_VERSION='astra-benchmark-contract/v1';
export const ASTRA_REFERENCE_MODEL='gpt-6-astra';

const hash=value=>createHash('sha256').update(String(value??'')).digest('hex');

const METRICS=[
  {id:'terminal-bench-4',domain:'coding',metric:'pass_rate',astra:0.579,protocol:'Terminal-Bench 4.0',source:'https://openai.com/index/gpt-6-astra/'},
  {id:'terminal-bench-science-0.1',domain:'science',metric:'pass_rate',astra:0.646,protocol:'Terminal-Bench Science 0.1',source:'https://openai.com/index/gpt-6-astra/'},
  {id:'agents-last-exam',domain:'computer_use',metric:'pass_rate',astra:0.593,protocol:"Agents' Last Exam",source:'https://openai.com/index/gpt-6-astra/'},
  {id:'osworld-2',domain:'computer_use',metric:'partial_score',astra:0.726,protocol:'OSWorld 2.0 v2026.08.08 offline set partial score',source:'https://openai.com/index/gpt-6-astra/'},
  {id:'screenspot-pro',domain:'computer_use',metric:'pass_rate',astra:0.927,protocol:'ScreenSpot-Pro no tools',source:'https://openai.com/index/gpt-6-astra/'},
  {id:'automation-bench',domain:'professional',metric:'pass_rate',astra:0.414,protocol:'AutomationBench',source:'https://openai.com/index/gpt-6-astra/'},
  {id:'benchcad',domain:'professional',metric:'geometric_overlap',astra:0.959,protocol:'BenchCAD with tools',source:'https://openai.com/index/gpt-6-astra/'},
  {id:'browsecomp',domain:'research',metric:'pass_rate',astra:0.915,protocol:'BrowseComp',source:'https://openai.com/index/gpt-6-astra/'},
  {id:'gpqa-diamond',domain:'science',metric:'accuracy',astra:0.960,protocol:'GPQA Diamond',source:'https://openai.com/index/gpt-6-astra/'}
];

export function astraBenchmarkContract(){
  return {
    version:ASTRA_BENCHMARK_CONTRACT_VERSION,
    referenceModel:ASTRA_REFERENCE_MODEL,
    officialSource:'https://openai.com/index/gpt-6-astra/',
    metrics:METRICS.map(x=>({...x})),
    policy:{
      publicMetricsAreReferenceOnly:true,
      directComparabilityRequiresSameProtocol:true,
      exactExternalExecutionRequiredForPairedClaim:true,
      simulatedAstraResponsesForbidden:true,
      globalSuperiorityClaimAllowed:false
    }
  };
}

export function scoreAstraGap({metricId,universalScore=null}={}){
  const metric=METRICS.find(x=>x.id===String(metricId));
  if(!metric) return {ok:false,error:'unknown_astra_metric'};
  const value=Number(universalScore);
  if(!Number.isFinite(value)) return {
    ok:true,metric:{...metric},
    state:'UNMEASURED',
    gap:null,
    requiredToExceed:Number((metric.astra+0.0001).toFixed(4))
  };
  const normalized=Math.max(0,Math.min(1,value));
  const gap=Number((normalized-metric.astra).toFixed(4));
  return {
    ok:true,
    metric:{...metric},
    universalScore:Number(normalized.toFixed(4)),
    astraReference:metric.astra,
    gap,
    state:normalized>metric.astra?'ABOVE_PUBLIC_REFERENCE':normalized===metric.astra?'MATCHES_PUBLIC_REFERENCE':'BELOW_PUBLIC_REFERENCE',
    directlyComparable:false,
    reason:'Public Astra result and Universal Core result are not a paired certification unless the exact benchmark protocol and execution conditions match.'
  };
}

export function buildAstraGapReport({measurements={}}={}){
  const rows=METRICS.map(metric=>scoreAstraGap({metricId:metric.id,universalScore:measurements?.[metric.id]}));
  const measured=rows.filter(x=>x.state!=='UNMEASURED');
  return {
    version:ASTRA_BENCHMARK_CONTRACT_VERSION,
    referenceModel:ASTRA_REFERENCE_MODEL,
    generatedAt:new Date().toISOString(),
    sourceHash:hash(JSON.stringify(METRICS)),
    counts:{total:rows.length,measured:measured.length,unmeasured:rows.length-measured.length},
    rows,
    claimPolicy:'No global or benchmark-superiority claim is authorized by this report alone.'
  };
}
