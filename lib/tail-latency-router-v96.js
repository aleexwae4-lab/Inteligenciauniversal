export const TAIL_LATENCY_ROUTER_V96='tail-latency-router/v96';

const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const norm=value=>String(value||'').trim();

export function tailLatencyRiskV96({path='STANDARD',p95LatencyMs=null,confidence=0}={}){
  const route=String(path||'STANDARD').toUpperCase();
  const p95=finite(p95LatencyMs)?Math.max(0,Number(p95LatencyMs)):null;
  const conf=Math.max(0,Math.min(100,Number(confidence)||0));
  const threshold=route==='FAST'?6000:route==='STANDARD'?10000:null;
  const evidenceReady=threshold!==null&&p95!==null&&conf>=60;
  const risk=Boolean(evidenceReady&&p95>threshold);
  const ratio=risk?Math.min(3,p95/threshold):1;
  const penalty=risk?Number(Math.min(18,4+(ratio-1)*12).toFixed(3)):0;
  return{
    version:TAIL_LATENCY_ROUTER_V96,
    path:route,
    p95LatencyMs:p95,
    confidence:conf,
    thresholdMs:threshold,
    evidenceReady,
    risk,
    penalty,
    hardBlocked:false,
  };
}

export function rankFallbackOrderV96({selected='',candidates=[],baseFallbackOrder=[],path='STANDARD'}={}){
  const selectedId=norm(selected);
  const rows=(Array.isArray(candidates)?candidates:[]).filter(row=>norm(row?.id));
  const byId=new Map(rows.map(row=>[norm(row.id),row]));
  const ranked=rows
    .filter(row=>norm(row.id)!==selectedId&&!row.circuitOpen&&!row.persistentCircuitOpen)
    .slice()
    .sort((a,b)=>{
      const ar=a?.interactiveTailRisk===true?1:0;
      const br=b?.interactiveTailRisk===true?1:0;
      if(ar!==br)return ar-br;
      return Number(b?.score||0)-Number(a?.score||0);
    })
    .map(row=>norm(row.id));
  const remaining=(Array.isArray(baseFallbackOrder)?baseFallbackOrder:[])
    .map(norm)
    .filter(id=>id&&id!==selectedId&&!ranked.includes(id));
  const order=[selectedId,...ranked,...remaining].filter(Boolean);
  return{
    version:TAIL_LATENCY_ROUTER_V96,
    path:String(path||'STANDARD').toUpperCase(),
    order:[...new Set(order)],
    evidenceRanked:ranked.filter(id=>byId.has(id)).length,
  };
}

export function tailLatencyRouterCapabilitiesV96(){
  return{
    version:TAIL_LATENCY_ROUTER_V96,
    evidenceBased:true,
    minimumConfidence:60,
    thresholdsMs:{FAST:6000,STANDARD:10000,DEEP:null},
    hardBlock:false,
    deepRouteTailPenalty:false,
    explicitProviderOverridePreserved:true,
    goal:'reduce interactive P95 without weakening quality or removing last-resort recovery',
  };
}
