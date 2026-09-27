/**
 * Frontier Supremacy v2 — benchmark contract for Universal Core.
 * Public competitor figures are targets/reference data, not claims about our own performance.
 */
export const FRONTIER_SUPREMACY_VERSION='frontier-supremacy/v2';
const TARGETS=Object.freeze({
  arcAgi3:{reference:'GPT-6 Astra',reported:99.9,unit:'percent',source:'OpenAI public release'},
  frontierMathTier4:{reference:'GPT-6 Astra',reported:98,unit:'percent',source:'OpenAI public release'},
  exploitBench:{reference:'GPT-6 Astra',reported:100,unit:'percent',source:'OpenAI public release'},
  osworld2:{reference:'GPT-6 Astra',reported:72.6,unit:'percent',source:'OpenAI public release'},
  automationBench:{reference:'GPT-6 Astra',reported:41.4,unit:'percent',source:'OpenAI public release'},
  browseComp:{reference:'GPT-6 Astra',reported:91.5,unit:'percent',source:'OpenAI public release'},
  mrcr256to512k:{reference:'GPT-6 Astra',reported:100,unit:'percent',source:'OpenAI public release'},
  mrcr512kto1m:{reference:'GPT-6 Astra',reported:96.3,unit:'percent',source:'OpenAI public release'}
});
const DOMAINS=Object.freeze([
 {id:'reasoning',label:'Razonamiento',weight:.18},
 {id:'coding',label:'Software engineering',weight:.18},
 {id:'research',label:'Investigación y grounding',weight:.14},
 {id:'agentic',label:'Agentes / computer use',weight:.18},
 {id:'long_context',label:'Contexto largo',weight:.10},
 {id:'multimodal',label:'Multimodalidad',weight:.08},
 {id:'verification',label:'Verificación',weight:.09},
 {id:'efficiency',label:'Eficiencia',weight:.05}
]);
export function frontierSupremacyManifest(){
 return {version:FRONTIER_SUPREMACY_VERSION,objective:'Convertir cada mejora de Universal Core en una hipótesis medible y detectar regresiones antes de producción.',competitorReference:'GPT-6 Astra',referenceDataPolicy:'reported public figures are targets/reference only',targets:TARGETS,domains:DOMAINS,gates:{sameInput:true,sameAcceptance:true,noCherryPicking:true,noSyntheticCompetitor:true,versionedRuntime:true,evidenceRequired:true}};
}
export function scoreFrontierDomains(scores={}){
 const normalized={}; for(const d of DOMAINS){const n=Number(scores[d.id]);normalized[d.id]=Number.isFinite(n)?Math.max(0,Math.min(100,n)):null;}
 const active=DOMAINS.filter(d=>normalized[d.id]!==null),weight=active.reduce((s,d)=>s+d.weight,0),sum=active.reduce((s,d)=>s+normalized[d.id]*d.weight,0);
 return {scores:normalized,coverage:Number((weight*100).toFixed(1)),weightedOverall:weight?Number((sum/weight).toFixed(2)):null,complete:active.length===DOMAINS.length};
}
export function frontierGap({actual={},target={}}={}){
 const rows=Object.entries(target).map(([key,value])=>({key,target:Number(value),actual:Number.isFinite(Number(actual[key]))?Number(actual[key]):null,gap:Number.isFinite(Number(actual[key]))?Number((Number(actual[key])-Number(value)).toFixed(2)):null}));
 return {rows,measured:rows.filter(x=>x.actual!==null).length,beatingTargets:rows.filter(x=>x.actual!==null&&x.gap>=0).length};
}
