export const MULTIMODAL_EVIDENCE_SYNTHESIS_VERSION='multimodal-evidence-synthesis/v1';

function clean(s='',n=900){return String(s||'').replace(/\s+/g,' ').trim().slice(0,n)}
function uniq(xs=[]){return [...new Set((Array.isArray(xs)?xs:[]).filter(Boolean))]}
function ids(x){return uniq([...(x?.sourceFileIds||[]),x?.sourceFileId])}
function sourceName(a=''){return clean(a,180)}

export function buildMultimodalEvidenceSynthesis({attachments=[],findings=null,investigation=null,truthConflict=null,temporalCausal=null}={}){
  const items=(Array.isArray(attachments)?attachments:[]).slice(0,8);
  const fs=(findings?.findings||findings?.evidence||[]).slice(0,120);
  const conflicts=(truthConflict?.conflictSignals||[]).slice(0,40);
  const corroborations=(truthConflict?.corroborations||[]).slice(0,40);
  const temporal=(temporalCausal?.events||[]).slice(0,60);
  const causal=(temporalCausal?.causalClaims||[]).slice(0,40);
  const byId=new Map(items.map((a,i)=>[String(a?.id||'attachment-'+(i+1)),a]));
  const provenance=(fileIds=[])=>uniq(fileIds.map(id=>({fileId:id,name:sourceName(byId.get(id)?.name||id),mime:sourceName(byId.get(id)?.mime||'')})));
  const documented=fs.filter(f=>f?.verified===true&&String(f?.type||'')==='textual_evidence').slice(0,40).map((f,i)=>({
    id:'fact-'+(i+1),statement:clean(f.statement),sourceFileIds:ids(f),location:f.location||null,confidence:Number(f.confidence||0),provenance:provenance(ids(f)),status:'documented'
  }));
  const corroborated=corroborations.slice(0,24).map((c,i)=>({
    id:'corroborated-'+(i+1),sourceFileIds:ids(c),terms:uniq(c.sharedTerms||c.terms||[]).slice(0,12),statement:clean(c.statement||'Los archivos comparten señales textuales.'),status:'corroboration_signal',requiresVerification:true
  }));
  const conflictPoints=conflicts.slice(0,24).map((c,i)=>({
    id:'conflict-'+(i+1),sourceFileIds:ids(c),reasons:uniq(c.reasons||[]).slice(0,8),statements:(c.statements||[]).map(x=>clean(x,600)).slice(0,4),locations:c.locations||[],status:'unresolved_conflict_signal',requiresVerification:true
  }));
  const sequence=temporal.slice(0,30).map((e,i)=>({
    id:'event-'+(i+1),sourceFileId:e.sourceFileId,sourceName:sourceName(e.sourceName),statement:clean(e.statement),dates:e.dates||[],times:e.times||[],temporalSignals:e.temporalSignals||[],location:e.location||null,status:'temporal_evidence'
  }));
  const causalClaims=causal.slice(0,24).map((c,i)=>({
    id:'causal-'+(i+1),sourceFileId:c.sourceFileId,statement:clean(c.statement),signals:c.causalSignals||[],status:'requires_verification'
  }));
  const unresolved=[];
  conflictPoints.forEach(x=>unresolved.push({id:x.id,type:'conflict',reason:'Existe una señal de incompatibilidad que no debe resolverse automáticamente.',sourceFileIds:x.sourceFileIds}));
  corroborated.filter(x=>x.requiresVerification).forEach(x=>unresolved.push({id:x.id,type:'corroboration',reason:'La coincidencia textual no demuestra identidad ni causalidad.',sourceFileIds:x.sourceFileIds}));
  causalClaims.forEach(x=>unresolved.push({id:x.id,type:'causality',reason:'La causalidad está expresada por la fuente y requiere verificación independiente.',sourceFileIds:[x.sourceFileId]}));
  return {
    version:MULTIMODAL_EVIDENCE_SYNTHESIS_VERSION,
    documentedFacts:documented,
    corroboratedPoints:corroborated,
    conflictPoints,
    temporalSequence:sequence,
    causalClaims,
    unresolvedQuestions:unresolved.slice(0,60),
    verificationNeeded:unresolved.slice(0,60),
    provenance:uniq([...documented.flatMap(x=>x.sourceFileIds||[]),...corroborated.flatMap(x=>x.sourceFileIds||[]),...conflictPoints.flatMap(x=>x.sourceFileIds||[]),...sequence.map(x=>x.sourceFileId),...causalClaims.map(x=>x.sourceFileId)]).slice(0,40).map(id=>({fileId:id,name:sourceName(byId.get(id)?.name||id),mime:sourceName(byId.get(id)?.mime||'')})),
    scope:{files:items.length,findings:fs.length,temporalEvents:temporal.length,conflictSignals:conflicts.length,corroborationSignals:corroborations.length},
    policy:{
      factsAreSourceBound:true,
      conflictsRemainUnresolved:true,
      corroborationIsNotProof:true,
      temporalOrderRequiresEvidence:true,
      causalClaimsRequireVerification:true,
      noAutomaticTruthWinner:true,
      noAutomaticCausalConclusion:true,
      noSyntheticEvidence:true,
      provenanceRequired:true
    }
  };
}

export function evidenceSynthesisInstruction(report){
  if(!report)return '';
  return '\n\nSÍNTESIS DE EVIDENCIA MULTIMODAL ('+MULTIMODAL_EVIDENCE_SYNTHESIS_VERSION+'):\n'+JSON.stringify(report)+'\n- Separa hechos documentados, señales de corroboración, conflictos, secuencia temporal, afirmaciones causales y asuntos no resueltos.\n- Cada hecho debe conservar su archivo y localizador cuando exista.\n- Una corroboración textual no prueba identidad; una coincidencia temporal no prueba causalidad.\n- Los conflictos no se resuelven automáticamente ni se elige un archivo ganador.\n- Las afirmaciones causales se atribuyen a la evidencia y requieren verificación.\n- Si falta evidencia, declara la incertidumbre; nunca rellenes huecos con observaciones inventadas.';
}

export function publicEvidenceSynthesis(report){
  if(!report)return null;
  return {
    version:report.version||MULTIMODAL_EVIDENCE_SYNTHESIS_VERSION,
    documentedFacts:(report.documentedFacts||[]).slice(0,24),
    corroboratedPoints:(report.corroboratedPoints||[]).slice(0,20),
    conflictPoints:(report.conflictPoints||[]).slice(0,20),
    temporalSequence:(report.temporalSequence||[]).slice(0,24),
    causalClaims:(report.causalClaims||[]).slice(0,20),
    unresolvedQuestions:(report.unresolvedQuestions||[]).slice(0,32),
    verificationNeeded:(report.verificationNeeded||[]).slice(0,32),
    provenance:(report.provenance||[]).slice(0,32),
    scope:report.scope,
    policy:report.policy
  };
}
