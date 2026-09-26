export const MULTIMODAL_INVESTIGATION_VERSION='multimodal-investigation/v1';

function clean(s='',n=260){return String(s||'').replace(/\s+/g,' ').trim().slice(0,n)}
function key(s=''){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
function relationType(a,b){
 const sa=new Set((a.terms||[]).map(key)), sb=new Set((b.terms||[]).map(key));
 const shared=[...sa].filter(x=>x&&sb.has(x)).slice(0,10);
 if(!shared.length)return null;
 return {type:'corroboration_signal',sharedTerms:shared};
}
export function buildMultimodalInvestigation({attachments=[],findings=null,evidenceGraph=null}={}){
 const fs=(findings?.findings||[]).slice(0,32);
 const claims=fs.filter(x=>x.type==='textual_evidence').map(x=>({
   id:x.id,source:x.sourceFileId,name:x.sourceName,statement:clean(x.statement,420),location:x.location||{},confidence:x.confidence||0,verified:!!x.verified
 }));
 const relations=[];
 for(let i=0;i<claims.length;i++)for(let j=i+1;j<claims.length;j++){
   const rel=relationType(claims[i],claims[j]); if(rel)relations.push({from:claims[i].id,to:claims[j].id,...rel});
 }
 const contradictions=[];
 const sourceCount=new Set(claims.map(x=>x.source)).size;
 return {
  version:MULTIMODAL_INVESTIGATION_VERSION,
  scope:{files:Math.min(Array.isArray(attachments)?attachments.length:0,8),findings:fs.length,sources:sourceCount},
  evidenceMatrix:claims,
  relations:relations.slice(0,32),
  contradictions,
  synthesis:{corroborationSignals:relations.length,contradictionSignals:0,independentSources:sourceCount},
  policy:{matrixIsDescriptive:true,relationsAreSignals:true,contradictionsRequireEvidence:true,noAutomaticConclusion:true}
 };
}
export function investigationInstruction(report){
 if(!report)return '';
 return '\n\nWORKSPACE DE INVESTIGACION MULTIMEDIA ('+MULTIMODAL_INVESTIGATION_VERSION+'):\n'+
 '- Usa la matriz para responder preguntas que requieran cruzar varios archivos.\n'+
 '- Una relación es una señal de corroboración, no una conclusión automática.\n'+
 '- Solo reporta contradicciones cuando existan evidencias incompatibles; no las inventes.\n'+
 '- Cuando sea posible, identifica fuente y localizador.\n'+
 '- Separa hechos documentados, señales y síntesis inferida.\n';
}
export function publicInvestigation(report){
 return {version:MULTIMODAL_INVESTIGATION_VERSION,scope:report?.scope,evidenceMatrix:(report?.evidenceMatrix||[]).slice(0,32),relations:(report?.relations||[]).slice(0,32),contradictions:report?.contradictions||[],synthesis:report?.synthesis,policy:report?.policy};
}