export const MULTIMODAL_EVIDENCE_QUALITY_VERSION='multimodal-evidence-quality/v1';

function clean(s='',n=500){return String(s||'').replace(/\s+/g,' ').trim().slice(0,n)}
function host(url=''){try{return new URL(url).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}}
function sourceQuality(source={}){
  const h=host(source.url), title=clean(source.title,220), snippet=clean(source.snippet||source.content,500);
  let score=.35;
  if(/^https:\/\//i.test(String(source.url||'')))score+=.1;
  if(/\.(gov|gob\.mx|edu|ac\.|int)$/i.test(h))score+=.2;
  if(/official|government|universidad|university|instituto|organización|organization/i.test(title+' '+h))score+=.12;
  if(source.published_at)score+=.05;
  if(snippet.length>=120)score+=.08;
  return {title,url:String(source.url||'').slice(0,1200),host:h,provider:clean(source.provider,100),publishedAt:source.published_at||null,qualitySignal:Number(Math.min(1,score).toFixed(3)),basis:{https:.test(String(source.url||'')),institutionalDomain:/\.(gov|gob\.mx|edu|ac\.|int)$/i.test(h),dated:Boolean(source.published_at),substantiveSnippet:snippet.length>=120}};
}
export function buildEvidenceQuality({verification=null}={}){
 const tasks=(verification?.tasks||[]).slice(0,32);
 const evaluations=tasks.map(task=>{
   const sources=(task.result?.evaluation?.sources||task.result?.sources||[]).slice(0,4);
   const enriched=sources.map(sourceQuality);
   const hosts=[...new Set(enriched.map(x=>x.host).filter(Boolean))];
   const avg=enriched.length?enriched.reduce((a,x)=>a+x.qualitySignal,0)/enriched.length:0;
   return {taskId:task.id,type:task.type,statement:clean(task.statement,700),sourceCount:enriched.length,independentHosts:hosts.length,averageQualitySignal:Number(avg.toFixed(3)),sources:enriched,independenceSignal:enriched.length?Number(Math.min(1,hosts.length/Math.min(3,enriched.length)).toFixed(3)):0};
 });
 return {version:MULTIMODAL_EVIDENCE_QUALITY_VERSION,evaluations,summary:{tasks:evaluations.length,withEvidence:evaluations.filter(x=>x.sourceCount>0).length,independentEvidence:evaluations.filter(x=>x.independentHosts>=2).length},policy:{qualityIsASignal:true,notTruthScore:true,independenceIsHostBasedSignal:true,noAutomaticTruthResolution:true,provenanceRequired:true}};
}
export function evidenceQualityInstruction(report){
 if(!report)return '';
 return '\n\nINTELIGENCIA DE CALIDAD DE EVIDENCIA ('+MULTIMODAL_EVIDENCE_QUALITY_VERSION+'):\n'+JSON.stringify(report)+'\n- qualitySignal e independenceSignal son señales de calidad, no probabilidades de verdad.\n- No confundas múltiples páginas del mismo dominio con fuentes independientes.\n- Prioriza procedencia explícita y conserva URLs.\n- Una fuente institucional no es automáticamente correcta; mantén conflictos visibles.\n';
}
export function publicEvidenceQuality(report){
 if(!report)return null;
 return {version:report.version||MULTIMODAL_EVIDENCE_QUALITY_VERSION,evaluations:(report.evaluations||[]).slice(0,32),summary:report.summary,policy:report.policy};
}
